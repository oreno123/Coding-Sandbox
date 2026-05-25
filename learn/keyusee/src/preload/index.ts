import { contextBridge, ipcRenderer, webFrame } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Zoom
  setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
  getZoomFactor: () => webFrame.getZoomFactor(),

  getSources: () => ipcRenderer.invoke('get-sources'),
  setPreferredCaptureSource: (sourceId: string, withSystemAudio: boolean) => ipcRenderer.invoke('set-preferred-capture-source', { sourceId, withSystemAudio }),
  startInputTracking: () => ipcRenderer.invoke('start-input-tracking'),
  stopInputTracking: () => ipcRenderer.invoke('stop-input-tracking'),
  onInputEvent: (callback: (event: any) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('input-event', subscription);
    return () => ipcRenderer.removeListener('input-event', subscription);
  },
  
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config: any) => ipcRenderer.invoke('set-config', config),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getResourceFiles: (type: 'background' | 'cursor') => ipcRenderer.invoke('get-resource-files', type),
  onConfigChanged: (callback: (config: any) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('config-changed', subscription);
    return () => ipcRenderer.removeListener('config-changed', subscription);
  },
  onUpdateStateChanged: (callback: (state: any) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('updater-state-changed', subscription);
    return () => ipcRenderer.removeListener('updater-state-changed', subscription);
  },

  // Window Management
  openSettings: () => ipcRenderer.send('open-settings'),
  openSaveDialog: () => ipcRenderer.send('open-save-dialog'),
  closeSaveDialog: () => ipcRenderer.send('close-save-dialog'),
  submitFilename: (filename: string) => ipcRenderer.send('submit-filename', filename),
  
  // Save Process
  onStartSaveProcess: (callback: (filename: string) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('start-save-process', subscription);
    return () => ipcRenderer.removeListener('start-save-process', subscription);
  },
  saveRecording: (data: any) => ipcRenderer.invoke('save-recording', data),
  saveExportedVideo: (data: any) => ipcRenderer.invoke('save-exported-video', data),
  exportVideoWithFfmpeg: (data: any) => ipcRenderer.invoke('export-video-with-ffmpeg', data),
  convertVideoWithFfmpeg: (data: any) => ipcRenderer.invoke('convert-video-with-ffmpeg', data),
  onExportProgress: (callback: (progress: number) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('export-progress', subscription);
    return () => ipcRenderer.removeListener('export-progress', subscription);
  },
  getRecordingHistory: () => ipcRenderer.invoke('get-recording-history'),
  getRecordingHistoryItem: (recordId: string) => ipcRenderer.invoke('get-recording-history-item', recordId),
  deleteRecordingHistoryItem: (recordId: string) => ipcRenderer.invoke('delete-recording-history-item', recordId),
  renameRecordingHistoryItem: (id: string, newName: string) => ipcRenderer.invoke('rename-recording-history-item', { id, newName }),
  getParsedInputLog: (inputLogPath: string) => ipcRenderer.invoke('get-input-log-parsed', inputLogPath),
  openHistoryDetail: (recordId: string) => ipcRenderer.send('open-history-detail', recordId),
  openPath: (targetPath: string) => ipcRenderer.invoke('open-path', targetPath),
  openExternal: (targetUrl: string) => ipcRenderer.invoke('open-external', targetUrl),
  readFileText: (filePath: string) => ipcRenderer.invoke('read-file-text', filePath),
  writeFileText: (filePath: string, content: string) => ipcRenderer.invoke('write-file-text', { filePath, content }),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  
  // FFmpeg & Region Capture
  startFfmpegRecording: (payload: any) => ipcRenderer.invoke('start-ffmpeg-recording', payload),
  stopFfmpegRecording: () => ipcRenderer.invoke('stop-ffmpeg-recording'),
  selectCaptureRegion: () => ipcRenderer.invoke('select-capture-region'),
  confirmRegionSelection: (region: { x: number; y: number; width: number; height: number }) => ipcRenderer.send('region-selector-confirm', region),
  cancelRegionSelection: () => ipcRenderer.send('region-selector-cancel'),
  
  // Tray
  setRecordingState: (isRecording: boolean) => ipcRenderer.send('set-recording-state', isRecording),
  
  // Tray Menu Actions
  isMainWindowVisible: () => ipcRenderer.invoke('is-main-window-visible'),
  isCameraPreviewVisible: () => ipcRenderer.invoke('is-camera-preview-visible'),
  toggleMainWindow: () => ipcRenderer.invoke('toggle-main-window'),
  toggleCameraPreview: () => ipcRenderer.invoke('toggle-camera-preview'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  closeTrayWindow: () => ipcRenderer.invoke('close-tray-window'),

  // Camera Preview Window
  openCameraPreview: (deviceId: string) => ipcRenderer.send('open-camera-preview', deviceId),
  closeCameraPreview: () => ipcRenderer.send('close-camera-preview'),
  closeWindow: () => ipcRenderer.send('close-window'),
  resizeCameraWindow: (factor: number) => ipcRenderer.send('resize-camera-window', factor),
  moveWindow: (mouseX: number, mouseY: number) => ipcRenderer.send('window-moving', { mouseX: Number(mouseX || 0), mouseY: Number(mouseY || 0) }),
  startWindowDrag: () => ipcRenderer.send('window-drag-start'),
  cameraPreviewReady: () => ipcRenderer.send('camera-preview-ready'),
  onCameraPreview: (callback: (deviceId: string) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('set-camera-source', subscription);
    return () => ipcRenderer.removeListener('set-camera-source', subscription);
  },
  onRecordingStateChanged: (callback: (isRecording: boolean) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('recording-state-changed', subscription);
    return () => ipcRenderer.removeListener('recording-state-changed', subscription);
  },

  // Global Shortcuts
  onToggleRecording: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('toggle-recording', subscription);
    return () => ipcRenderer.removeListener('toggle-recording', subscription);
  },
  onStopRecording: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('stop-recording', subscription);
    return () => ipcRenderer.removeListener('stop-recording', subscription);
  },

  // Countdown
  startCountdown: () => ipcRenderer.send('start-countdown'),
  cancelCountdown: () => ipcRenderer.send('cancel-countdown'),
  countdownFinished: () => ipcRenderer.send('countdown-finished'),
  onStartActualRecording: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('start-actual-recording', subscription);
    return () => ipcRenderer.removeListener('start-actual-recording', subscription);
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
