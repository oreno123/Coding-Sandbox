import { app, shell, BrowserWindow, ipcMain, desktopCapturer, dialog, Tray, Menu, nativeImage, globalShortcut, screen, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import ffmpegStatic from 'ffmpeg-static'
import { autoUpdater } from 'electron-updater'

app.commandLine.appendSwitch('no-sandbox');
// Disable WGC screen/window capturer to allow 'cursor: never' constraint to work properly on Windows (fallback to DXGI)
// Update: WebRTC cursor hiding is still unreliable on some Windows machines even with WGC disabled.
// Reverting to FFmpeg with ddagrab which guarantees no cursor.
app.commandLine.appendSwitch('disable-features', 'WebRtcAllowWgcScreenCapturer,WebRtcAllowWgcWindowCapturer');
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
app.setName('Keyu·See');

// --- Configuration Management ---
const CONFIG_PATH = join(app.getPath('userData'), 'config.json');

interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AppConfig {
  savePath: string;
  recordSystemAudio: boolean;
  enableCountdown: boolean;
  lastSelectedSourceId?: string;
  lastSelectedSourceName?: string;
  lastSelectedCameraId?: string;
  lastSelectedMicId?: string;
  recordingShortcut?: string;
  cameraPosition?: { x: number; y: number };
  recordFrameRate?: number;
}

type UpdatePhase = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

interface UpdateState {
  phase: UpdatePhase;
  message: string;
  currentVersion: string;
  availableVersion?: string;
  downloadedVersion?: string;
  progress?: number;
}

interface RecordingHistoryItem {
  id: string;
  recordedAt: string;
  startedAtMs?: number;
  createdAtMs: number;
  durationMs: number;
  durationText: string;
  name: string;
  absolutePath: string;
  screenVideoPath?: string;
  cameraVideoPath?: string;
  micAudioPath?: string;
  inputLogPath?: string;
}

interface InputEventPayload {
  type?: number;
  timestamp?: number;
  time?: number;
  keycode?: number;
  x?: number;
  y?: number;
  button?: number;
  clicks?: number;
  amount?: number;
  direction?: number;
  rotation?: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

interface StartFfmpegRecordingPayload {
  mode: 'screen' | 'window' | 'region';
  sourceId?: string;
  sourceName?: string;
  recordFrameRate?: number;
  region?: CaptureRegion | null;
}

const defaultConfig: AppConfig = {
  savePath: app.getPath('downloads'),
  recordSystemAudio: true,
  enableCountdown: true,
  recordingShortcut: 'CommandOrControl+F9',
  cameraPosition: undefined,
  recordFrameRate: 60
};

const MAIN_WINDOW_BASE_SIZE = { width: 900, height: 670 };
const MAIN_WINDOW_SCALE = 1.2;
const MAIN_WINDOW_SIZE = {
  width: Math.round(MAIN_WINDOW_BASE_SIZE.width * MAIN_WINDOW_SCALE),
  height: Math.round(MAIN_WINDOW_BASE_SIZE.height * MAIN_WINDOW_SCALE)
};
const UPDATE_FEED_URL = 'http://page.keyu.live/keyusee/upload/';

let updateState: UpdateState = {
  phase: 'idle',
  message: '未检查更新',
  currentVersion: app.getVersion()
};
let updaterInitialized = false;

function broadcastUpdateState() {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('updater-state-changed', updateState);
    }
  }
}

function setUpdateState(nextState: Partial<UpdateState>) {
  updateState = {
    ...updateState,
    ...nextState,
    currentVersion: app.getVersion()
  };
  broadcastUpdateState();
}

function initAutoUpdater() {
  if (updaterInitialized) return;
  updaterInitialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: UPDATE_FEED_URL
  });

  autoUpdater.on('checking-for-update', () => {
    setUpdateState({
      phase: 'checking',
      message: '正在检查更新...',
      availableVersion: undefined,
      downloadedVersion: undefined,
      progress: undefined
    });
  });

  autoUpdater.on('update-available', (info) => {
    setUpdateState({
      phase: 'available',
      message: `发现新版本 ${info.version}`,
      availableVersion: info.version,
      downloadedVersion: undefined,
      progress: undefined
    });
  });

  autoUpdater.on('update-not-available', () => {
    setUpdateState({
      phase: 'not-available',
      message: '当前已是最新版本',
      availableVersion: undefined,
      downloadedVersion: undefined,
      progress: undefined
    });
  });

  autoUpdater.on('error', (error) => {
    setUpdateState({
      phase: 'error',
      message: error?.message || '更新失败',
      progress: undefined
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdateState({
      phase: 'downloading',
      message: `正在下载更新 ${Math.round(progress.percent)}%`,
      progress: progress.percent
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateState({
      phase: 'downloaded',
      message: `更新已下载完成，准备安装 ${info.version}`,
      downloadedVersion: info.version,
      progress: 100
    });
  });
}

async function checkForAppUpdates() {
  if (is.dev) {
    setUpdateState({
      phase: 'error',
      message: '开发模式下不检查更新'
    });
    return updateState;
  }
  initAutoUpdater();
  await autoUpdater.checkForUpdates();
  return updateState;
}

async function downloadAppUpdate() {
  if (is.dev) {
    setUpdateState({
      phase: 'error',
      message: '开发模式下不可下载更新'
    });
    return updateState;
  }
  initAutoUpdater();
  await autoUpdater.downloadUpdate();
  return updateState;
}

function registerShortcuts(config: AppConfig) {
  globalShortcut.unregisterAll();
  
  if (config.recordingShortcut) {
    try {
      const ret = globalShortcut.register(config.recordingShortcut, () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('toggle-recording');
        }
      });
      if (!ret) {
        console.warn('Registration failed for shortcut:', config.recordingShortcut);
      }
    } catch (error) {
      console.error('Failed to register shortcut:', error);
    }
  }
}

function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const config = { ...defaultConfig, ...JSON.parse(data) };
      // Ensure shortcut is registered on load
      return config;
    }
  } catch (e) {
    console.error('Failed to load config', e);
  }
  return defaultConfig;
}

function saveConfig(config: AppConfig) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    registerShortcuts(config); // Re-register when config saved
  } catch (e) {
    console.error('Failed to save config', e);
  }
}

let currentConfig = loadConfig();
const HISTORY_CONFIG_PATH = join(app.getPath('userData'), 'recording-history.json');

function ensureHistoryConfigFile() {
  if (!fs.existsSync(HISTORY_CONFIG_PATH)) {
    fs.writeFileSync(HISTORY_CONFIG_PATH, JSON.stringify([], null, 2), 'utf-8');
  }
}

function loadRecordingHistory(): RecordingHistoryItem[] {
  try {
    ensureHistoryConfigFile();
    const content = fs.readFileSync(HISTORY_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load recording history:', error);
    return [];
  }
}

function saveRecordingHistory(history: RecordingHistoryItem[]) {
  try {
    ensureHistoryConfigFile();
    fs.writeFileSync(HISTORY_CONFIG_PATH, JSON.stringify(history, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save recording history:', error);
  }
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function appendRecordingHistory(item: RecordingHistoryItem) {
  const history = loadRecordingHistory();
  history.unshift(item);
  saveRecordingHistory(history);
}

// Countdown IPC
ipcMain.on('start-countdown', () => {
  if (!countdownWindow) {
    createCountdownWindow();
  }
  if (countdownWindow) {
    countdownWindow.center();
    countdownWindow.show();
    countdownWindow.focus();
  }
});

ipcMain.on('cancel-countdown', () => {
  countdownWindow?.hide();
  // Optional: Notify main window that recording was cancelled
});

ipcMain.on('countdown-finished', () => {
  countdownWindow?.hide();
  if (mainWindow) {
    mainWindow.webContents.send('start-actual-recording');
  }
});

// --- Window Management ---
let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let saveWindow: BrowserWindow | null = null;
let cameraWindow: BrowserWindow | null = null;
let countdownWindow: BrowserWindow | null = null;
let historyDetailWindow: BrowserWindow | null = null;
let regionSelectorWindow: BrowserWindow | null = null;
let regionIndicatorWindow: BrowserWindow | null = null;
let currentCameraDeviceId: string = '';
let isTrackingInput = false;
let preferredCaptureSourceId = '';
let preferredCaptureSystemAudio = true;
let pendingRegionSelectionResolver: ((value: CaptureRegion | null) => void) | null = null;
let ffmpegProcess: ReturnType<typeof spawn> | null = null;
let ffmpegOutputPath = '';

let ffmpegPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : '';
if (ffmpegPath && ffmpegPath.includes('app.asar')) {
  ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}

// --- Tray Management ---
let tray: Tray | null = null;
let trayWindow: BrowserWindow | null = null;
let blinkInterval: NodeJS.Timeout | null = null;

function createCountdownWindow() {
  if (countdownWindow) return;

  countdownWindow = new BrowserWindow({
    width: 300,
    height: 300,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      contextIsolation: true
    }
  });

  const url = is.dev && process.env['ELECTRON_RENDERER_URL']
    ? `${process.env['ELECTRON_RENDERER_URL']}#/countdown`
    : `file://${join(__dirname, '../renderer/index.html')}#/countdown`;

  countdownWindow.loadURL(url);

  countdownWindow.on('closed', () => {
    countdownWindow = null;
  });
}

function createTrayWindow() {
  if (trayWindow) return;

  trayWindow = new BrowserWindow({
    width: 250,
    height: 220,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    transparent: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  const url = is.dev && process.env['ELECTRON_RENDERER_URL']
    ? `${process.env['ELECTRON_RENDERER_URL']}#/tray-menu`
    : `file://${join(__dirname, '../renderer/index.html')}#/tray-menu`;

  trayWindow.loadURL(url);

  // Hide when losing focus
  trayWindow.on('blur', () => {
    if (!trayWindow?.webContents.isDevToolsOpened()) {
      trayWindow?.hide();
    }
  });
}

function toggleTrayWindow() {
  if (!trayWindow || !tray) return;

  if (trayWindow.isVisible()) {
    trayWindow.hide();
  } else {
    const trayBounds = tray.getBounds();
    const windowBounds = trayWindow.getBounds();
    
    // Calculate position (center horizontally above/below tray icon)
    // For Windows, tray is usually at bottom right
    // We'll try to position it above the icon first
    
    // Simple logic: Center x, place y above icon
    let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
    let y = Math.round(trayBounds.y - windowBounds.height);
    
    // Handle edge cases if needed (e.g. taskbar at top)
    // But for now simple positioning is usually enough for Windows default bottom taskbar
    
    trayWindow.setPosition(x, y, false);
    trayWindow.show();
    trayWindow.focus();
  }
}

function createTray() {
  const iconPath = join(__dirname, '../../icon/keyusee.ico');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  
  // Custom click handler instead of context menu
  tray.setToolTip('Keyu·See');
  
  tray.on('click', () => {
    // If recording, stop it
    if (isAppRecording) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stop-recording');
      }
    } else {
      // Left click toggles our custom menu
      toggleTrayWindow();
    }
  });

  tray.on('right-click', () => {
    // Right click also toggles our custom menu
    toggleTrayWindow();
  });
  
  // Create the window
  createTrayWindow();
}


function startBlinking() {
  if (blinkInterval) return;
  
  const iconPath = join(__dirname, '../../icon/keyusee.ico');
  const blinkIconPath = join(__dirname, '../../icon/ing.ico');
  const normalIcon = nativeImage.createFromPath(iconPath);
  const blinkIcon = nativeImage.createFromPath(blinkIconPath);
  
  let showBlink = true;
  
  blinkInterval = setInterval(() => {
    if (tray && !tray.isDestroyed()) {
      tray.setImage(showBlink ? blinkIcon : normalIcon);
      showBlink = !showBlink;
    }
  }, 500);
}

function stopBlinking() {
  if (blinkInterval) {
    clearInterval(blinkInterval);
    blinkInterval = null;
  }
  if (tray && !tray.isDestroyed()) {
    const iconPath = join(__dirname, '../../icon/keyusee.ico');
    tray.setImage(nativeImage.createFromPath(iconPath));
  }
}

let isAppRecording = false;

ipcMain.on('set-recording-state', (_, isRecording) => {
  isAppRecording = isRecording;
  if (isRecording) {
    startBlinking();
  } else {
    stopBlinking();
  }
  
  // Notify camera preview window about recording state
  if (cameraWindow && !cameraWindow.isDestroyed()) {
    cameraWindow.webContents.send('recording-state-changed', isRecording);
  }
});

// Tray IPC
ipcMain.handle('is-main-window-visible', () => {
  return mainWindow ? mainWindow.isVisible() : false;
});

ipcMain.handle('is-camera-preview-visible', () => {
  return cameraWindow ? cameraWindow.isVisible() : false;
});

ipcMain.handle('toggle-main-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  }
});

ipcMain.handle('toggle-camera-preview', () => {
  if (cameraWindow && !cameraWindow.isDestroyed()) {
    if (cameraWindow.isVisible()) {
      cameraWindow.hide();
    } else {
      cameraWindow.show();
      // Ensure position is valid every time we show it? 
      // User only asked for initial/drag behavior. But checking on show is safer.
      // However, createCameraWindow handles initialization.
    }
  } else if (currentCameraDeviceId) {
    // If destroyed or not created but we have ID, try to recreate/open
    createCameraWindow();
    if (cameraWindow) {
      cameraWindow.show();
      cameraWindow.webContents.send('set-camera-source', currentCameraDeviceId);
    }
  }
});

ipcMain.handle('quit-app', () => {
  isQuitting = true;
  app.quit();
});

ipcMain.handle('close-tray-window', () => {
  trayWindow?.hide();
});

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: MAIN_WINDOW_SIZE.width,
    height: MAIN_WINDOW_SIZE.height,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: join(__dirname, '../../build/icon.png') } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Prevent closing, hide instead
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
      }
      return false;
    }
    return true;
  });
}

let isQuitting = false;

function createCameraWindow(): void {
  if (cameraWindow) return;

  cameraWindow = new BrowserWindow({
    width: 300,
    height: 300,
    minWidth: 150,
    minHeight: 150,
    maxWidth: 600,
    maxHeight: 600,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false, // Prevent user resizing via border, API resizing still works
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      contextIsolation: true
    }// ...
  });

  // Prevent camera window from being captured in screen recording
  cameraWindow.setContentProtection(true);

  const url = is.dev && process.env['ELECTRON_RENDERER_URL']
    ? `${process.env['ELECTRON_RENDERER_URL']}#/camera-preview`
    : `file://${join(__dirname, '../renderer/index.html')}#/camera-preview`;

  cameraWindow.loadURL(url);

  // Set initial position
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  // Default position: Bottom-left, 128px margin
  // workArea.y + workArea.height is the bottom edge coordinate
  // 300 is initial height
  let finalX = workArea.x + 128;
  let finalY = workArea.y + workArea.height - 300 - 128;

  if (currentConfig.cameraPosition) {
    const { x, y } = currentConfig.cameraPosition;
    // Check if position is valid
    const display = screen.getDisplayMatching({ x, y, width: 300, height: 300 });
    const bounds = display.workArea;

    // Check if fully visible
    if (
      x >= bounds.x &&
      y >= bounds.y &&
      x + 300 <= bounds.x + bounds.width &&
      y + 300 <= bounds.y + bounds.height
    ) {
      finalX = x;
      finalY = y;
    }
  }
  cameraWindow.setPosition(finalX, finalY);

  cameraWindow.on('closed', () => {
    cameraWindow = null;
  });
}

// Camera Window IPC
ipcMain.on('open-camera-preview', (_, deviceId) => {
  try {
    currentCameraDeviceId = String(deviceId || '');
    
    if (!cameraWindow) {
      createCameraWindow();
    }
    
    if (cameraWindow && !cameraWindow.isDestroyed()) {
      cameraWindow.show();
      // Also send immediately in case window is already ready
      cameraWindow.webContents.send('set-camera-source', currentCameraDeviceId);
    }
  } catch (error) {
    console.error('Failed to open camera preview:', error);
  }
});

ipcMain.on('camera-preview-ready', (event) => {
  try {
    if (cameraWindow && !cameraWindow.isDestroyed() && currentCameraDeviceId) {
       cameraWindow.webContents.send('set-camera-source', currentCameraDeviceId);
    }
  } catch (error) {
    console.error('Failed to handle camera-preview-ready:', error);
  }
});

ipcMain.on('close-camera-preview', () => {
  try {
    if (cameraWindow && !cameraWindow.isDestroyed()) {
      cameraWindow.close();
    }
    cameraWindow = null;
  } catch (error) {
    console.error('Failed to close camera preview:', error);
  }
});

ipcMain.on('resize-camera-window', (_, factor) => {
  try {
    if (cameraWindow && !cameraWindow.isDestroyed()) {
      const [w, h] = cameraWindow.getSize();
      const newSize = Math.max(150, Math.min(600, w + Number(factor)));
      cameraWindow.setSize(newSize, newSize);
    }
  } catch (error) {
    console.error('Failed to resize camera window:', error);
  }
});

ipcMain.on('window-drag-start', () => {
  // Logic handled by window-moving
});

let saveTimeout: NodeJS.Timeout | null = null;
function saveConfigDebounced(config: AppConfig) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveConfig(config);
  }, 1000);
}

ipcMain.on('window-moving', (event, { mouseX, mouseY }) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    
    // Ensure mouseX and mouseY are valid numbers
    const mX = Number(mouseX);
    const mY = Number(mouseY);
    
    if (isNaN(mX) || isNaN(mY)) {
      console.warn('Invalid mouse coordinates received:', mouseX, mouseY);
      return;
    }

    const { x, y } =  screen.getCursorScreenPoint();
    const newX = Math.round(x - mX);
    const newY = Math.round(y - mY);
    
    // Double check result is valid number
    if (!isNaN(newX) && !isNaN(newY)) {
      win.setPosition(newX, newY);

      if (win === cameraWindow) {
        currentConfig.cameraPosition = { x: newX, y: newY };
        saveConfigDebounced(currentConfig);
      }
    }
  } catch (error) {
    console.error('Failed to move window:', error);
  }
});

function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 520,
    show: false,
    frame: false, // Frameless
    transparent: true, // Transparent for custom shadow/rounded corners
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      contextIsolation: true
    }
  });

  settingsWindow.on('ready-to-show', () => {
    settingsWindow?.show();
    settingsWindow?.webContents.send('updater-state-changed', updateState);
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  const url = is.dev && process.env['ELECTRON_RENDERER_URL']
    ? `${process.env['ELECTRON_RENDERER_URL']}#/settings`
    : `file://${join(__dirname, '../renderer/index.html')}#/settings`;

  settingsWindow.loadURL(url);
}

function createSaveWindow(): void {
  if (saveWindow) {
    saveWindow.focus();
    return;
  }

  saveWindow = new BrowserWindow({
    width: 400,
    height: 250,
    show: false,
    frame: false, // Frameless
    transparent: true, // Transparent for custom shadow/rounded corners
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    modal: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      contextIsolation: true
    }
  });

  saveWindow.on('ready-to-show', () => {
    saveWindow?.show();
  });

  saveWindow.on('closed', () => {
    saveWindow = null;
  });

  const url = is.dev && process.env['ELECTRON_RENDERER_URL']
    ? `${process.env['ELECTRON_RENDERER_URL']}#/save`
    : `file://${join(__dirname, '../renderer/index.html')}#/save`;

  saveWindow.loadURL(url);
}

let isCameraVisibleBeforeHistoryDetail = false;

function createHistoryDetailWindow(recordId: string): void {
  if (historyDetailWindow && !historyDetailWindow.isDestroyed()) {
    historyDetailWindow.loadURL(
      is.dev && process.env['ELECTRON_RENDERER_URL']
        ? `${process.env['ELECTRON_RENDERER_URL']}#/history-detail?recordId=${encodeURIComponent(recordId)}`
        : `file://${join(__dirname, '../renderer/index.html')}#/history-detail?recordId=${encodeURIComponent(recordId)}`
    );
    historyDetailWindow.focus();
    return;
  }

  // Remember camera window state and hide it
  if (cameraWindow && !cameraWindow.isDestroyed()) {
    isCameraVisibleBeforeHistoryDetail = cameraWindow.isVisible();
    if (isCameraVisibleBeforeHistoryDetail) {
      cameraWindow.hide();
    }
  }

  historyDetailWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    show: false,
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      contextIsolation: true
    }
  });

  historyDetailWindow.maximize(); // Auto maximize on open

  historyDetailWindow.on('ready-to-show', () => {
    historyDetailWindow?.show();
  });

  historyDetailWindow.on('closed', () => {
    historyDetailWindow = null;
    
    // Restore camera window state
    if (isCameraVisibleBeforeHistoryDetail && cameraWindow && !cameraWindow.isDestroyed()) {
      cameraWindow.show();
    }
  });

  const url = is.dev && process.env['ELECTRON_RENDERER_URL']
    ? `${process.env['ELECTRON_RENDERER_URL']}#/history-detail?recordId=${encodeURIComponent(recordId)}`
    : `file://${join(__dirname, '../renderer/index.html')}#/history-detail?recordId=${encodeURIComponent(recordId)}`;

  historyDetailWindow.loadURL(url);
}

function createRegionSelectorWindow(): void {
  if (regionSelectorWindow && !regionSelectorWindow.isDestroyed()) {
    regionSelectorWindow.show();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  regionSelectorWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  });

  regionSelectorWindow.setFullScreen(true);

  regionSelectorWindow.on('closed', () => {
    regionSelectorWindow = null;
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    regionSelectorWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/region-selector`);
  } else {
    regionSelectorWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'region-selector' });
  }
}

function createRegionIndicatorWindow(region: CaptureRegion): void {
  if (regionIndicatorWindow) {
    regionIndicatorWindow.close();
  }

  const borderSize = 4;
  const borderPadding = 2; // Extra transparent gap to prevent subpixel bleeding into recording
  const labelHeight = 26;
  
  const offsetTop = borderSize + borderPadding + labelHeight;
  const offsetBottom = borderSize + borderPadding;
  const offsetLeft = borderSize + borderPadding;
  const offsetRight = borderSize + borderPadding;

  regionIndicatorWindow = new BrowserWindow({
    x: Math.floor(region.x - offsetLeft),
    y: Math.floor(region.y - offsetTop),
    width: Math.ceil(region.width + offsetLeft + offsetRight),
    height: Math.ceil(region.height + offsetTop + offsetBottom),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  regionIndicatorWindow.setIgnoreMouseEvents(true, { forward: true });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: transparent;
          }
          .border {
            position: absolute;
            top: ${labelHeight}px; 
            left: 0; 
            right: 0; 
            bottom: 0;
            border: ${borderSize}px dashed red;
            box-sizing: border-box;
            border-radius: 6px;
            animation: blink 1.5s infinite;
          }
          .label {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            background: red;
            color: white;
            padding: 2px 12px;
            height: ${labelHeight}px;
            line-height: ${labelHeight - 4}px;
            box-sizing: border-box;
            border-radius: 6px 6px 0 0;
            font-family: sans-serif;
            font-size: 13px;
            font-weight: bold;
            white-space: nowrap;
          }
          @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        </style>
      </head>
      <body>
        <div class="border"></div>
        <div class="label">录制中...</div>
      </body>
    </html>
  `;
  
  regionIndicatorWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  regionIndicatorWindow.on('closed', () => {
    regionIndicatorWindow = null;
  });
}


function formatInputEventType(type?: number): string {
  const map: Record<number, string> = {
    4: '键盘按下',
    5: '键盘抬起',
    6: '鼠标点击',
    7: '鼠标按下',
    8: '鼠标抬起',
    9: '鼠标移动',
    11: '鼠标滚轮'
  };
  return typeof type === 'number' ? map[type] || `未知动作(${type})` : '未知动作';
}

const reverseKeyMap = Object.entries(UiohookKey).reduce((acc, [key, value]) => {
  acc[value as number] = key;
  return acc;
}, {} as Record<number, string>);

function formatModifierKeys(event: InputEventPayload) {
  const keys: string[] = [];
  if (event.ctrlKey) keys.push('Ctrl');
  if (event.altKey) keys.push('Alt');
  if (event.shiftKey) keys.push('Shift');
  if (event.metaKey) keys.push('Meta');
  return keys.length > 0 ? keys.join('+') : '';
}

function formatInputEventDetail(event: InputEventPayload): string {
  const type = event.type;
  if (type === 4 || type === 5) {
    let keyName = reverseKeyMap[event.keycode as number] ?? `未知(${event.keycode})`;
    
    // Normalize some key names to match modifiers
    if (keyName === 'CtrlRight') keyName = 'Ctrl';
    if (keyName === 'AltRight') keyName = 'Alt';
    if (keyName === 'ShiftRight') keyName = 'Shift';
    if (keyName === 'MetaRight') keyName = 'Meta';

    const keys: string[] = [];
    if (event.ctrlKey && keyName !== 'Ctrl') keys.push('Ctrl');
    if (event.altKey && keyName !== 'Alt') keys.push('Alt');
    if (event.shiftKey && keyName !== 'Shift') keys.push('Shift');
    if (event.metaKey && keyName !== 'Meta') keys.push('Meta');
    
    keys.push(keyName);
    
    return `按键${keys.join('+')}`;
  }
  if (type === 6 || type === 7 || type === 8 || type === 9) {
    return `坐标 (${event.x ?? '-'}, ${event.y ?? '-'})，按键 ${event.button ?? '-'}，点击次数 ${event.clicks ?? '-'}`;
  }
  if (type === 11) {
    return `坐标 (${event.x ?? '-'}, ${event.y ?? '-'})，滚轮方向 ${event.direction ?? '-'}，滚动量 ${event.amount ?? '-'}，旋转 ${event.rotation ?? '-'}`;
  }
  const modifiers = formatModifierKeys(event);
  return `time=${event.time ?? '-'}${modifiers ? `，组合键 ${modifiers}` : ''}`;
}

// --- IPC Handlers ---

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({ 
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 }, // 16:9 aspect ratio, small enough for preview
    fetchWindowIcons: false // We don't use window icons, skipping them might save time
  });
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL()
  }));
});

ipcMain.handle('set-preferred-capture-source', async (_, payload: { sourceId?: string; withSystemAudio?: boolean }) => {
  preferredCaptureSourceId = String(payload?.sourceId || '');
  preferredCaptureSystemAudio = Boolean(payload?.withSystemAudio);
  return true;
});

ipcMain.handle('start-input-tracking', () => {
  if (!isTrackingInput) {
    try {
      uIOhook.start();
      isTrackingInput = true;
    } catch (error) {
      console.error('Failed to start input tracking:', error);
      return false;
    }
  }
  return true;
});

ipcMain.handle('stop-input-tracking', () => {
  if (isTrackingInput) {
    uIOhook.stop();
    isTrackingInput = false;
  }
  return true;
});

// Config IPC
ipcMain.handle('get-config', () => {
  return currentConfig;
});

ipcMain.handle('set-config', (_, newConfig: Partial<AppConfig>) => {
  currentConfig = { ...currentConfig, ...newConfig };
  saveConfig(currentConfig);
  // Notify all windows of config change
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('config-changed', currentConfig);
  });
  return currentConfig;
});

ipcMain.handle('get-update-state', () => {
  return updateState;
});

ipcMain.handle('check-for-updates', async () => {
  return checkForAppUpdates();
});

ipcMain.handle('download-update', async () => {
  return downloadAppUpdate();
});

ipcMain.handle('quit-and-install-update', () => {
  if (updateState.phase !== 'downloaded') {
    return false;
  }
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
  return true;
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(settingsWindow || mainWindow!, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// --- Region Selector IPC ---
function closeRegionSelectorWindow(result: CaptureRegion | null) {
  if (pendingRegionSelectionResolver) {
    pendingRegionSelectionResolver(result);
    pendingRegionSelectionResolver = null;
  }
  if (regionSelectorWindow && !regionSelectorWindow.isDestroyed()) {
    regionSelectorWindow.close();
  }
}

ipcMain.handle('select-capture-region', async () => {
  return new Promise((resolve) => {
    if (regionSelectorWindow && !regionSelectorWindow.isDestroyed()) {
      resolve(null);
      return;
    }
    pendingRegionSelectionResolver = resolve;
    createRegionSelectorWindow();
    if (regionSelectorWindow) {
      (regionSelectorWindow as BrowserWindow).show();
      (regionSelectorWindow as BrowserWindow).focus();
    }
  });
});

ipcMain.on('region-selector-confirm', (_, region: CaptureRegion) => {
  closeRegionSelectorWindow(region);
});

ipcMain.on('region-selector-cancel', () => {
  closeRegionSelectorWindow(null);
});

function normalizeRegion(region?: CaptureRegion | null): CaptureRegion | null {
  if (!region) return null;
  const x = Math.round(region.x);
  const y = Math.round(region.y);
  let width = Math.round(region.width);
  let height = Math.round(region.height);
  
  if (width <= 0 || height <= 0) return null;
  // FFmpeg usually requires even dimensions for x264
  if (width % 2 !== 0) width -= 1;
  if (height % 2 !== 0) height -= 1;
  if (width <= 0 || height <= 0) return null;

  return { x, y, width, height };
}

async function buildFfmpegInputArgs(payload: StartFfmpegRecordingPayload, fps: number) {
  const safeFps = Math.max(10, Math.min(120, Math.floor(Number(fps) || 60)));
  
  if (payload.mode === 'window') {
    const sources = await desktopCapturer.getSources({ types: ['window'] });
    const target = sources.find((source) => source.id === payload.sourceId)
      || sources.find((source) => source.name === payload.sourceName);
    if (!target || !target.name) {
      throw new Error('未找到可录制的窗口');
    }
    // Windows requires gdigrab for window capture, but we can't reliably hide cursor.
    // However, ddagrab doesn't support capturing a specific window by title.
    // So for window capture, we fall back to gdigrab.
    return ['-f', 'gdigrab', '-framerate', String(safeFps), '-draw_mouse', '0', '-i', `title=${target.name}`];
  }

  if (payload.mode === 'region') {
    const region = normalizeRegion(payload.region);
    if (!region) {
      throw new Error('无效的录制区域');
    }
    
    // Convert logical coordinates to physical coordinates for ddagrab
    const display = screen.getPrimaryDisplay();
    const scale = display.scaleFactor || 1;
    
    // Apply scale to region coordinates
    let physX = Math.round(region.x * scale);
    let physY = Math.round(region.y * scale);
    let physW = Math.round(region.width * scale);
    let physH = Math.round(region.height * scale);
    
    // FFmpeg requires even dimensions
    if (physW % 2 !== 0) physW -= 1;
    if (physH % 2 !== 0) physH -= 1;

    return [
      '-f', 'lavfi',
      '-i', `ddagrab=framerate=${safeFps}:draw_mouse=0:offset_x=${physX}:offset_y=${physY}:video_size=${physW}x${physH}`,
      '-vf', 'hwdownload,format=bgra'
    ];
  }

  const sourceId = String(payload.sourceId || '');
  const displayIdMatch = sourceId.match(/^screen:(\d+):/);
  if (displayIdMatch) {
    const display = screen.getAllDisplays().find((item) => String(item.id) === displayIdMatch[1]);
    if (display) {
      // Use physical bounds for ddagrab
      const scale = display.scaleFactor || 1;
      const x = Math.round(display.bounds.x * scale);
      const y = Math.round(display.bounds.y * scale);
      const w = Math.round(display.bounds.width * scale);
      const h = Math.round(display.bounds.height * scale);

      return [
        '-f', 'lavfi',
        '-i', `ddagrab=framerate=${safeFps}:draw_mouse=0:offset_x=${x}:offset_y=${y}:video_size=${w}x${h}`,
        '-vf', 'hwdownload,format=bgra'
      ];
    }
  }
  return [
    '-f', 'lavfi', 
    '-i', `ddagrab=framerate=${safeFps}:draw_mouse=0`,
    '-vf', 'hwdownload,format=bgra'
  ];
}

ipcMain.handle('start-ffmpeg-recording', async (_, payload: StartFfmpegRecordingPayload) => {
  if (ffmpegProcess) {
    return { success: false, error: '录制已在进行中' };
  }
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    console.error('FFmpeg path missing or invalid:', ffmpegPath);
    return { success: false, error: `FFmpeg 不可用 (${ffmpegPath})` };
  }
  try {
    const fps = Math.max(10, Math.min(120, Math.floor(Number(payload?.recordFrameRate) || 60)));
    const inputArgs = await buildFfmpegInputArgs(payload, fps);
    
    if (payload.mode === 'region' && payload.region) {
      const region = normalizeRegion(payload.region);
      if (region) {
        createRegionIndicatorWindow(region);
      }
    }

    const outputPath = join(app.getPath('temp'), `keyusee-screen-${Date.now()}.mp4`);
    const args = [
      '-y',
      ...inputArgs,
      '-an',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outputPath
    ];
    ffmpegProcess = spawn(ffmpegPath, args, { windowsHide: true });
    ffmpegOutputPath = outputPath;
    ffmpegProcess.stderr?.on('data', (_data) => {
      console.log(`FFmpeg: ${_data}`); // For debugging
    });
    ffmpegProcess.once('exit', () => {
      ffmpegProcess = null;
    });
    return { success: true };
  } catch (error) {
    if (regionIndicatorWindow) {
      regionIndicatorWindow.close();
      regionIndicatorWindow = null;
    }
    ffmpegProcess = null;
    ffmpegOutputPath = '';
    console.error('Failed to start FFmpeg:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('stop-ffmpeg-recording', async () => {
  if (regionIndicatorWindow) {
    regionIndicatorWindow.close();
    regionIndicatorWindow = null;
  }
  if (!ffmpegProcess) {
    return { success: true, path: ffmpegOutputPath };
  }
  return new Promise((resolve) => {
    // Flag to ensure we only resolve once
    let resolved = false;

    const doResolve = () => {
      if (!resolved) {
        resolved = true;
        ffmpegProcess = null;
        resolve({ success: true, path: ffmpegOutputPath });
      }
    };

    const timeout = setTimeout(() => {
      if (ffmpegProcess) {
        try {
          ffmpegProcess.kill('SIGKILL');
        } catch(e) {}
      }
      doResolve();
    }, 5000);

    ffmpegProcess!.once('exit', () => {
      clearTimeout(timeout);
      doResolve();
    });
    
    try {
      ffmpegProcess!.stdin?.write('q\n');
    } catch(e) {
      doResolve();
    }
  });
});

ipcMain.handle('get-resource-files', async (_, type: 'background' | 'cursor') => {
  const resolveResourcePath = (t: 'background' | 'cursor') => {
    const candidates = [
      path.resolve(app.getAppPath(), 'src', 'image', t),
      path.resolve(process.cwd(), 'src', 'image', t),
      path.resolve(__dirname, '..', '..', 'src', 'image', t)
    ];
    return candidates.find(p => fs.existsSync(p)) || candidates[0];
  };

  const resourcePath = resolveResourcePath(type);
  
  try {
    if (fs.existsSync(resourcePath)) {
      const files = fs.readdirSync(resourcePath);
      return files.filter(f => /\.(png|jpg|jpeg|svg|gif)$/i.test(f)).map(f => join(resourcePath, f));
    }
    return [];
  } catch (error) {
    console.error(`Failed to list ${type} files:`, error);
    return [];
  }
});

// Window IPC
ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

ipcMain.on('open-save-dialog', () => {
  createSaveWindow();
});

ipcMain.on('open-history-detail', (_, recordId: string) => {
  createHistoryDetailWindow(String(recordId || ''));
});

ipcMain.handle('open-path', async (_, targetPath: string) => {
  if (!targetPath || !String(targetPath).trim()) {
    return { success: false, error: '路径不能为空' };
  }
  const result = await shell.openPath(String(targetPath));
  if (result) {
    return { success: false, error: result };
  }
  return { success: true };
});

ipcMain.handle('open-external', async (_, targetUrl: string) => {
  if (!targetUrl || !String(targetUrl).trim()) {
    return { success: false, error: '链接不能为空' };
  }
  try {
    await shell.openExternal(String(targetUrl));
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.on('close-save-dialog', () => {
  if (saveWindow) saveWindow.close();
});

ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.on('submit-filename', (_, filename) => {
  // Forward filename to main window to trigger save process
  if (mainWindow) {
    mainWindow.webContents.send('start-save-process', filename);
  }
  if (saveWindow) saveWindow.close();
});

// File Save IPC
ipcMain.handle('save-recording', async (_, { folderName, screenBlob, ffmpegVideoPath, cameraBlob, micBlob, inputLog, durationMs, startedAtMs }) => {
  try {
    const baseDir = join(currentConfig.savePath, folderName);
    
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    // Helper to write buffer
    const writeBuffer = (filePath: string, buffer: ArrayBuffer) => {
      fs.writeFileSync(filePath, Buffer.from(buffer));
    };

    // Wait up to 3 seconds for FFmpeg to finish writing the file if it's not ready
    if (ffmpegVideoPath) {
      let retries = 0;
      while (!fs.existsSync(ffmpegVideoPath) && retries < 30) {
        await new Promise(r => setTimeout(r, 100));
        retries++;
      }
    }

    if (ffmpegVideoPath && fs.existsSync(ffmpegVideoPath)) {
      fs.copyFileSync(ffmpegVideoPath, join(baseDir, '录屏.mp4'));
      try {
        fs.unlinkSync(ffmpegVideoPath);
      } catch (e) {
        console.error('Failed to cleanup temp video:', e);
      }
    } else if (screenBlob) {
      writeBuffer(join(baseDir, '录屏.webm'), screenBlob);
    }
    
    if (cameraBlob) {
      writeBuffer(join(baseDir, '摄像头.webm'), cameraBlob);
    }

    if (micBlob) {
      writeBuffer(join(baseDir, '麦克风.webm'), micBlob);
    }
    
    if (inputLog) {
      fs.writeFileSync(join(baseDir, '键鼠操作.json'), inputLog, 'utf-8');
    }

    const now = Date.now();
    const historyItem: RecordingHistoryItem = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      recordedAt: new Date(now).toISOString(),
      startedAtMs: Number.isFinite(Number(startedAtMs)) ? Number(startedAtMs) : undefined,
      createdAtMs: now,
      durationMs: Number(durationMs) || 0,
      durationText: formatDuration(Number(durationMs) || 0),
      name: folderName,
      absolutePath: baseDir,
      screenVideoPath: (ffmpegVideoPath && fs.existsSync(join(baseDir, '录屏.mp4'))) ? join(baseDir, '录屏.mp4') : (screenBlob ? join(baseDir, '录屏.webm') : undefined),
      cameraVideoPath: cameraBlob ? join(baseDir, '摄像头.webm') : undefined,
      micAudioPath: micBlob ? join(baseDir, '麦克风.webm') : undefined,
      inputLogPath: inputLog ? join(baseDir, '键鼠操作.json') : undefined
    };
    appendRecordingHistory(historyItem);

    return { success: true, path: baseDir };
  } catch (error) {
    console.error('Save failed:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('save-exported-video', async (_, { baseDir, fileName, videoBlob }) => {
  try {
    if (!baseDir || !fileName || !videoBlob) {
      return { success: false, error: '导出参数不完整' };
    }
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    const safeFileName = String(fileName).replace(/[\\/:*?"<>|]/g, '_');
    const outputPath = join(baseDir, safeFileName);
    fs.writeFileSync(outputPath, Buffer.from(videoBlob));
    return { success: true, path: outputPath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

interface ConvertVideoWithFfmpegPayload {
  inputPath: string;
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  format: 'mp4' | 'webm';
}

ipcMain.handle('convert-video-with-ffmpeg', async (event, payload: ConvertVideoWithFfmpegPayload) => {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    console.error('FFmpeg path missing or invalid:', ffmpegPath);
    return { success: false, error: `FFmpeg 不可用 (${ffmpegPath})` };
  }

  try {
    if (!fs.existsSync(payload.inputPath)) {
      return { success: false, error: '输入视频文件不存在' };
    }

    const args: string[] = ['-y', '-i', payload.inputPath];
    args.push('-vf', `scale=${payload.width}:${payload.height}`);
    args.push('-r', String(payload.fps));

    if (payload.format === 'mp4') {
      args.push('-c:v', 'libx264');
      args.push('-preset', 'slow');
      args.push('-crf', '18');
      args.push('-pix_fmt', 'yuv420p');
      args.push('-movflags', '+faststart');
      args.push('-profile:v', 'high');
      args.push('-level', '4.2');
      args.push('-c:a', 'aac');
      args.push('-b:a', '320k');
      args.push('-ar', '48000');
    } else {
      args.push('-c:v', 'libvpx-vp9');
      args.push('-crf', '15');
      args.push('-b:v', '0');
      args.push('-c:a', 'libopus');
      args.push('-b:a', '320k');
      args.push('-ar', '48000');
    }

    args.push(payload.outputPath);

    return new Promise((resolve) => {
      const ffmpegProcess = spawn(ffmpegPath, args, { windowsHide: true });
      
      let lastProgress = 0;
      ffmpegProcess.stderr?.on('data', (data) => {
        const output = String(data);
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch && durationMatch) {
          const hours = parseInt(timeMatch[1]) * 3600;
          const minutes = parseInt(timeMatch[2]) * 60;
          const seconds = parseFloat(timeMatch[3]);
          const currentTime = hours + minutes + seconds;
          
          const durationHours = parseInt(durationMatch[1]) * 3600;
          const durationMinutes = parseInt(durationMatch[2]) * 60;
          const durationSeconds = parseFloat(durationMatch[3]);
          const totalDuration = durationHours + durationMinutes + durationSeconds;
          
          const progress = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100));
          
          if (progress > lastProgress + 1) {
            lastProgress = progress;
            event.sender.send('export-progress', progress);
          }
        }
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(payload.outputPath)) {
          resolve({ success: true, path: payload.outputPath });
        } else {
          resolve({ success: false, error: `FFmpeg 退出码: ${code}` });
        }
      });

      ffmpegProcess.on('error', (error) => {
        resolve({ success: false, error: String(error) });
      });
    });
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

interface ExportVideoWithFfmpegPayload {
  baseDir: string;
  fileName: string;
  videoPath: string;
  audioPath?: string;
  startTime?: number;
  endTime?: number;
  width: number;
  height: number;
  fps: number;
  format: 'mp4' | 'webm';
  onProgress?: (progress: number) => void;
}

ipcMain.handle('export-video-with-ffmpeg', async (event, payload: ExportVideoWithFfmpegPayload) => {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    console.error('FFmpeg path missing or invalid:', ffmpegPath);
    return { success: false, error: `FFmpeg 不可用 (${ffmpegPath})` };
  }

  try {
    if (!fs.existsSync(payload.baseDir)) {
      fs.mkdirSync(payload.baseDir, { recursive: true });
    }

    const safeFileName = String(payload.fileName).replace(/[\\/:*?"<>|]/g, '_');
    const outputPath = join(payload.baseDir, safeFileName);

    const args: string[] = ['-y'];

    if (payload.videoPath && fs.existsSync(payload.videoPath)) {
      args.push('-i', payload.videoPath);
    } else {
      return { success: false, error: '视频文件不存在' };
    }

    if (payload.audioPath && fs.existsSync(payload.audioPath)) {
      args.push('-i', payload.audioPath);
    }

    if (typeof payload.startTime === 'number' && typeof payload.endTime === 'number') {
      const duration = payload.endTime - payload.startTime;
      if (duration > 0) {
        args.push('-ss', String(payload.startTime), '-t', String(duration));
      }
    }

    args.push('-vf', `scale=${payload.width}:${payload.height}`);
    args.push('-r', String(payload.fps));

    if (payload.format === 'mp4') {
      args.push('-c:v', 'libx264');
      args.push('-preset', 'medium');
      args.push('-crf', '23');
      args.push('-pix_fmt', 'yuv420p');
      args.push('-movflags', '+faststart');
      if (payload.audioPath && fs.existsSync(payload.audioPath)) {
        args.push('-c:a', 'aac');
        args.push('-b:a', '192k');
      }
    } else {
      args.push('-c:v', 'libvpx');
      args.push('-crf', '30');
      args.push('-b:v', '0');
      if (payload.audioPath && fs.existsSync(payload.audioPath)) {
        args.push('-c:a', 'libvorbis');
        args.push('-b:a', '192k');
      }
    }

    args.push(outputPath);

    return new Promise((resolve) => {
      const ffmpegProcess = spawn(ffmpegPath, args, { windowsHide: true });
      
      let lastProgress = 0;
      ffmpegProcess.stderr?.on('data', (data) => {
        const output = String(data);
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch && typeof payload.startTime === 'number' && typeof payload.endTime === 'number') {
          const hours = parseInt(timeMatch[1]) * 3600;
          const minutes = parseInt(timeMatch[2]) * 60;
          const seconds = parseFloat(timeMatch[3]);
          const currentTime = hours + minutes + seconds;
          const totalDuration = payload.endTime - payload.startTime;
          const progress = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100));
          
          if (progress > lastProgress + 1) {
            lastProgress = progress;
            event.sender.send('export-progress', progress);
          }
        }
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve({ success: true, path: outputPath });
        } else {
          resolve({ success: false, error: `FFmpeg 退出码: ${code}` });
        }
      });

      ffmpegProcess.on('error', (error) => {
        resolve({ success: false, error: String(error) });
      });
    });
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('read-file-text', (_, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      return { success: true, data: fs.readFileSync(filePath, 'utf-8') };
    }
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('write-file-text', (_, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('delete-file', async (_, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('get-recording-history', () => {
  const history = loadRecordingHistory();
  return history.sort((a, b) => b.createdAtMs - a.createdAtMs);
});

ipcMain.handle('delete-recording-history-item', (_, recordId: string) => {
  const history = loadRecordingHistory();
  const index = history.findIndex(item => item.id === recordId);
  if (index !== -1) {
    const item = history[index];
    // Delete files
    try {
      if (item.absolutePath && fs.existsSync(item.absolutePath)) {
        fs.rmSync(item.absolutePath, { recursive: true, force: true });
      }
    } catch (e) {
      console.error('Failed to delete files for record:', recordId, e);
    }
    history.splice(index, 1);
    saveRecordingHistory(history);
    return true;
  }
  return false;
});

ipcMain.handle('rename-recording-history-item', (_, { id, newName }) => {
  const history = loadRecordingHistory();
  const index = history.findIndex(item => item.id === id);
  if (index !== -1) {
    history[index].name = newName;
    saveRecordingHistory(history);
    return true;
  }
  return false;
});

ipcMain.handle('get-recording-history-item', (_, recordId: string) => {
  const history = loadRecordingHistory();
  return history.find((item) => item.id === recordId) || null;
});

ipcMain.handle('get-input-log-parsed', (_, inputLogPath: string) => {
  try {
    if (!inputLogPath || !fs.existsSync(inputLogPath)) {
      return { success: true, actions: [] };
    }
    const raw = fs.readFileSync(inputLogPath, 'utf-8');
    const events = JSON.parse(raw);
    if (!Array.isArray(events)) {
      return { success: true, actions: [] };
    }
    const actions = events.map((event: InputEventPayload, index: number) => {
      const timestamp = typeof event.timestamp === 'number' ? new Date(event.timestamp) : null;
      const displayTime = timestamp ? timestamp.toLocaleTimeString('zh-CN', { hour12: false }) : '-';
      return {
        id: `${index + 1}`,
        order: index + 1,
        time: displayTime,
        timestamp: event.timestamp,
        type: event.type,
        x: event.x,
        y: event.y,
        button: event.button,
        clicks: event.clicks,
        amount: event.amount,
        direction: event.direction,
        rotation: event.rotation,
        keycode: event.keycode,
        action: formatInputEventType(event.type),
        detail: formatInputEventDetail(event)
      };
    });
    return { success: true, actions };
  } catch (error) {
    return { success: false, actions: [], error: String(error) };
  }
});


// Setup uIOhook events
uIOhook.on('input', (e) => {
  if (isTrackingInput && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('input-event', e);
  }
});

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  ensureHistoryConfigFile();
  initAutoUpdater();
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
      const selected = sources.find((source) => source.id === preferredCaptureSourceId) || sources[0];
      callback({
        video: selected,
        audio: preferredCaptureSystemAudio ? 'loopback' : undefined
      });
    } catch (error) {
      console.error('setDisplayMediaRequestHandler failed:', error);
      callback({});
    }
  });

  registerShortcuts(currentConfig);

  createTray()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  void checkForAppUpdates();

  app.removeAllListeners('activate');
  app.on('activate', function () {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true;
  if (isTrackingInput) {
    uIOhook.stop();
  }
});
