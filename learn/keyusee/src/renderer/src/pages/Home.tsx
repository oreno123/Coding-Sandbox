import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardActionArea,
  CardMedia,
  CardContent,
  Tab,
  Tabs,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Stack,
  Divider
} from '@mui/material';
import {
  Settings as SettingsIcon,
  FiberManualRecord as FiberManualRecordIcon,
  Stop as StopIcon,
  DesktopWindows as DesktopWindowsIcon,
  Videocam as VideocamIcon,
  Mic as MicIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FolderOpen as FolderOpenIcon
} from '@mui/icons-material';
import { TextField, Tooltip } from '@mui/material';

// Define types for IPC exposed API
declare global {
  interface Window {
    api: {
      setZoomFactor: (factor: number) => void;
      getZoomFactor: () => number;
      getSources: () => Promise<any[]>;
      setPreferredCaptureSource: (sourceId: string, withSystemAudio: boolean) => Promise<boolean>;
      startInputTracking: () => Promise<boolean>;
      stopInputTracking: () => Promise<boolean>;
      onInputEvent: (callback: (event: any) => void) => () => void;
      
      // Config
      getConfig: () => Promise<any>;
      setConfig: (config: any) => Promise<any>;
      getUpdateState: () => Promise<any>;
      checkForUpdates: () => Promise<any>;
      downloadUpdate: () => Promise<any>;
      quitAndInstallUpdate: () => Promise<boolean>;
      selectDirectory: () => Promise<string | null>;
      onConfigChanged: (callback: (config: any) => void) => () => void;
      onUpdateStateChanged: (callback: (state: any) => void) => () => void;
      
      // Window Management
      openSettings: () => void;
      openSaveDialog: () => void;
      closeSaveDialog: () => void;
      submitFilename: (filename: string) => void;
      
      // Save Process
      onStartSaveProcess: (callback: (filename: string) => void) => () => void;
      saveRecording: (data: any) => Promise<{ success: boolean, path?: string, error?: string }>;
      saveExportedVideo: (data: any) => Promise<{ success: boolean, path?: string, error?: string }>;
      getRecordingHistory: () => Promise<any[]>;
      getRecordingHistoryItem: (recordId: string) => Promise<any>;
      deleteRecordingHistoryItem: (recordId: string) => Promise<boolean>;
      renameRecordingHistoryItem: (id: string, newName: string) => Promise<boolean>;
      getParsedInputLog: (inputLogPath: string) => Promise<{ success: boolean; actions: any[]; error?: string }>;
      openHistoryDetail: (recordId: string) => void;
      openPath: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
      openExternal: (targetUrl: string) => Promise<{ success: boolean; error?: string }>;
      readFileText: (filePath: string) => Promise<{ success: boolean; data?: string | null; error?: string }>;
      writeFileText: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      
      // FFmpeg & Region Capture
      startFfmpegRecording: (payload: any) => Promise<{ success: boolean; error?: string }>;
      stopFfmpegRecording: () => Promise<{ success: boolean; path?: string; error?: string }>;
      selectCaptureRegion: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
      confirmRegionSelection: (region: { x: number; y: number; width: number; height: number }) => void;
      cancelRegionSelection: () => void;
      
      // Tray
      setRecordingState: (isRecording: boolean) => void;
      
      // Tray Menu Actions
      isMainWindowVisible: () => Promise<boolean>;
      isCameraPreviewVisible: () => Promise<boolean>;
      toggleMainWindow: () => Promise<void>;
      toggleCameraPreview: () => Promise<void>;
      quitApp: () => Promise<void>;
      closeTrayWindow: () => Promise<void>;

      // Camera Preview Window
      openCameraPreview: (deviceId: string) => void;
      closeCameraPreview: () => void;
      closeWindow: () => void;
      resizeCameraWindow: (factor: number) => void;
      moveWindow: (mouseX: number, mouseY: number) => void;
      startWindowDrag: () => void;
      cameraPreviewReady: () => void;
      onCameraPreview: (callback: (deviceId: string) => void) => () => void;
      onRecordingStateChanged: (callback: (isRecording: boolean) => void) => () => void;
      
      // Global Shortcuts
      onToggleRecording: (callback: () => void) => () => void;
      onStopRecording: (callback: () => void) => () => void;

      // Countdown
      startCountdown: () => void;
      cancelCountdown: () => void;
      countdownFinished: () => void;
      onStartActualRecording: (callback: () => void) => () => void;

      // Resources
      getResourceFiles: (type: 'background' | 'cursor') => Promise<string[]>;
    }
  }
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

const Home: React.FC = () => {
  const [sources, setSources] = useState<any[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [selectedSourceName, setSelectedSourceName] = useState<string>('');
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  
  const [captureMode, setCaptureMode] = useState<'screen' | 'window' | 'region'>('screen');
  const [selectedRegion, setSelectedRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [recordSystemAudio, setRecordSystemAudio] = useState(true);
  const [enableCountdown, setEnableCountdown] = useState(true);
  const [recordFrameRate, setRecordFrameRate] = useState(60);
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [recordingShortcut, setRecordingShortcut] = useState('');
  const [mainTab, setMainTab] = useState<'record' | 'history'>('record');
  const [historyList, setHistoryList] = useState<RecordingHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const ffmpegVideoPathRef = useRef<string | null>(null);
  const ffmpegRecordingRef = useRef(false);
  const cameraRecorderRef = useRef<MediaRecorder | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const cameraChunksRef = useRef<Blob[]>([]);
  const micChunksRef = useRef<Blob[]>([]);
  const inputEventsRef = useRef<any[]>([]);
  const cleanupInputListenerRef = useRef<(() => void) | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const isStartingRecordingRef = useRef(false);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Load Devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === 'videoinput');
        const mics = devices.filter(d => d.kind === 'audioinput');
        setCameras(cams);
        setMics(mics);

        // 2. Load Config
        const config = await window.api.getConfig();
        setRecordSystemAudio(config.recordSystemAudio);
        setEnableCountdown(typeof config.enableCountdown === 'boolean' ? config.enableCountdown : true);
        setRecordFrameRate(config.recordFrameRate || 60);
        if (config.recordingShortcut) {
          setRecordingShortcut(config.recordingShortcut);
        }

        // 3. Restore Selections
        if (config.lastSelectedCameraId) {
          // If saved as 'none' or device exists, restore it
          if (config.lastSelectedCameraId === 'none' || cams.some(c => c.deviceId === config.lastSelectedCameraId)) {
            setSelectedCameraId(config.lastSelectedCameraId);
          }
        }

        if (config.lastSelectedMicId) {
          if (config.lastSelectedMicId === 'none' || mics.some(m => m.deviceId === config.lastSelectedMicId)) {
            setSelectedMicId(config.lastSelectedMicId);
          }
        }

        if (config.lastSelectedSourceId) {
           setIsLoadingSources(true);
           try {
             const sources = await window.api.getSources();
             setSources(sources);
             
             // Try to match by ID first
             let match = sources.find(s => s.id === config.lastSelectedSourceId);
             
             // If not found by ID, and we have a name, try to match by name (loose matching for windows)
             if (!match && config.lastSelectedSourceName) {
               match = sources.find(s => s.name === config.lastSelectedSourceName);
             }

             if (match) {
               setSelectedSourceId(match.id);
               setSelectedSourceName(match.name);
             }
           } catch (e) {
             console.error("Failed to restore source:", e);
           } finally {
             setIsLoadingSources(false);
           }
        }
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsInitialized(true);
      }
    };

    init();

    // Listen for config changes
    const cleanupConfig = window.api.onConfigChanged((config) => {
      setRecordSystemAudio(config.recordSystemAudio);
      if (typeof config.enableCountdown === 'boolean') {
        setEnableCountdown(config.enableCountdown);
      }
      if (config.recordFrameRate) setRecordFrameRate(config.recordFrameRate);
      if (config.recordingShortcut) {
        setRecordingShortcut(config.recordingShortcut);
      }
    });

    // Listen for save process start
    const cleanupSave = window.api.onStartSaveProcess((filename) => {
      handleSaveProcess(filename);
    });

    return () => {
      cleanupConfig();
      cleanupSave();
    };
  }, []);

  // Auto-save selections
  useEffect(() => {
    if (isInitialized) {
      window.api.setConfig({ lastSelectedCameraId: selectedCameraId });
    }
  }, [selectedCameraId, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      window.api.setConfig({ lastSelectedMicId: selectedMicId });
    }
  }, [selectedMicId, isInitialized]);

  useEffect(() => {
    if (isInitialized && selectedSourceId) {
      window.api.setConfig({ 
        lastSelectedSourceId: selectedSourceId,
        lastSelectedSourceName: selectedSourceName
      });
    }
  }, [selectedSourceId, selectedSourceName, isInitialized]);

  // Handle Camera Preview Window
  useEffect(() => {
    if (selectedCameraId && selectedCameraId !== 'none') {
      window.api.openCameraPreview(selectedCameraId);
    } else {
      window.api.closeCameraPreview();
    }

    return () => {
      // Don't close on unmount necessarily, but good practice if leaving Home
      // window.api.closeCameraPreview();
    };
  }, [selectedCameraId]);


  const handleGetSources = async () => {
    setIsLoadingSources(true);
    try {
      const _sources = await window.api.getSources();
      setSources(_sources);
      setShowSourceSelector(true);
    } catch (err) {
      console.error(err);
      alert('获取屏幕源失败');
    } finally {
      setIsLoadingSources(false);
    }
  };

  const handlePickRegion = async () => {
    const region = await window.api.selectCaptureRegion();
    if (region) {
      setCaptureMode('region');
      setSelectedRegion(region);
      setShowSourceSelector(false);
      
      // Auto-select the first screen (usually primary) for region capture
      // if no screen is currently selected, to ensure coordinates match
      if (!selectedSourceId || !selectedSourceId.startsWith('screen')) {
        const firstScreen = sources.find(s => s.id.startsWith('screen'));
        if (firstScreen) {
          setSelectedSourceId(firstScreen.id);
          setSelectedSourceName(firstScreen.name);
        }
      }
    }
  };

  const screens = sources.filter(s => s.id.startsWith('screen'));
  const windows = sources.filter(s => s.id.startsWith('window'));
  const [sourceTab, setSourceTab] = useState<'screen' | 'window' | 'region'>('screen');

  const formatDateTime = (isoTime: string) => {
    const date = new Date(isoTime);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', { hour12: false });
  };

  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const handleHistoryDelete = async (id: string) => {
    if (!confirm('确定要删除这条记录吗？文件也将被永久删除。')) {
      return;
    }
    const success = await window.api.deleteRecordingHistoryItem(id);
    if (!success) {
      alert('删除失败，请重试');
      return;
    }
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null);
    }
    loadHistory();
  };

  const handleHistoryRenameStart = (item: RecordingHistoryItem) => {
    setSelectedHistoryId(item.id);
    setRenameValue(item.name);
    setRenameDialogOpen(true);
  };

  const handleRenameDialogClose = () => {
    setRenameDialogOpen(false);
    setSelectedHistoryId(null);
    setRenameValue('');
  };

  const handleOpenHistoryFolder = async (absolutePath: string) => {
    const result = await window.api.openPath(absolutePath);
    if (!result?.success) {
      alert(result?.error || '打开文件夹失败');
    }
  };

  const handleOpenExternal = async (targetUrl: string) => {
    const result = await window.api.openExternal(targetUrl);
    if (!result?.success) {
      alert(result?.error || '打开链接失败');
    }
  };
  
  const handleHistoryRenameConfirm = async () => {
    if (selectedHistoryId && renameValue.trim()) {
      const success = await window.api.renameRecordingHistoryItem(selectedHistoryId, renameValue.trim());
      if (!success) {
        alert('重命名失败，请重试');
        return;
      }
      await loadHistory();
    }
    handleRenameDialogClose();
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const history = await window.api.getRecordingHistory();
      setHistoryList(Array.isArray(history) ? history : []);
    } catch (error) {
      console.error('Load history failed:', error);
      alert('加载历史录屏失败');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (mainTab === 'history') {
      loadHistory();
    }
  }, [mainTab]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const stopRecorderSafely = (recorder: MediaRecorder | null) => {
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const stopStreamSafely = (stream: MediaStream | null) => {
    stream?.getTracks().forEach(track => track.stop());
  };

  const resetLocalRecordingResources = ({ clearChunks = false } = {}) => {
    stopRecorderSafely(cameraRecorderRef.current);
    stopRecorderSafely(micRecorderRef.current);
    stopStreamSafely(cameraStreamRef.current);
    stopStreamSafely(micStreamRef.current);

    cameraStreamRef.current = null;
    micStreamRef.current = null;
    cameraRecorderRef.current = null;
    micRecorderRef.current = null;

    if (clearChunks) {
      cameraChunksRef.current = [];
      micChunksRef.current = [];
    }

    if (cleanupInputListenerRef.current) {
      cleanupInputListenerRef.current();
      cleanupInputListenerRef.current = null;
    }
  };

  const restoreCameraPreviewIfNeeded = () => {
    if (selectedCameraId && selectedCameraId !== 'none') {
      window.api.openCameraPreview(selectedCameraId);
    }
  };

  const cleanupFailedRecordingStart = async () => {
    resetLocalRecordingResources({ clearChunks: true });

    await window.api.stopFfmpegRecording();
    ffmpegRecordingRef.current = false;

    await window.api.stopInputTracking();
    ffmpegVideoPathRef.current = null;
    inputEventsRef.current = [];
    recordingStartedAtRef.current = null;
    setIsRecording(false);
    window.api.setRecordingState(false);
    restoreCameraPreviewIfNeeded();
  };

  const getStartupErrorMessage = (error: unknown) => {
    if (error instanceof DOMException && error.name === 'NotReadableError') {
      return '无法启动摄像头或麦克风。请确认设备没有被其他软件占用，并重新选择可用设备。';
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  };

  const startRecording = () => {
    if (isRecording || isStartingRecordingRef.current) {
      return;
    }
    if ((captureMode === 'screen' || captureMode === 'window') && !selectedSourceId) {
      alert('请先选择录制屏幕/窗口');
      return;
    }
    if (captureMode === 'region' && !selectedRegion) {
      alert('请先框选录制区域');
      return;
    }
    if (enableCountdown) {
      window.api.startCountdown();
      return;
    }
    performRecording();
  };

  const performRecording = async () => {
    if (isRecording || isStartingRecordingRef.current) {
      return;
    }
    if ((captureMode === 'screen' || captureMode === 'window') && !selectedSourceId) {
      alert('请先选择录制屏幕/窗口');
      return;
    }
    if (captureMode === 'region' && !selectedRegion) {
      alert('请先框选录制区域');
      return;
    }

    isStartingRecordingRef.current = true;
    setIsStartingRecording(true);

    try {
      if (selectedCameraId && selectedCameraId !== 'none') {
        window.api.closeCameraPreview();
        await sleep(300);
      }

      // 1. Start FFmpeg Recording for Screen/Window/Region
      const startResult = await window.api.startFfmpegRecording({
        mode: captureMode,
        sourceId: selectedSourceId,
        sourceName: selectedSourceName,
        recordFrameRate,
        region: selectedRegion
      });
      if (!startResult.success) {
        throw new Error(startResult.error || 'FFmpeg 启动失败');
      }
      ffmpegRecordingRef.current = true;
      ffmpegVideoPathRef.current = null;

      // 2. Get Mic Stream (if selected)
      if (selectedMicId && selectedMicId !== 'none') {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: selectedMicId ? { exact: selectedMicId } : undefined }
        });
        micStreamRef.current = micStream;
        const micRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm' });
        micRecorderRef.current = micRecorder;
        micChunksRef.current = [];
        micRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            micChunksRef.current.push(e.data);
          }
        };
        micRecorder.start();
      } else {
        micStreamRef.current = null;
        micRecorderRef.current = null;
        micChunksRef.current = [];
      }

      // 3. Setup Camera Recorder (if selected)
      if (selectedCameraId && selectedCameraId !== 'none') {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: { exact: selectedCameraId },
            frameRate: { ideal: recordFrameRate }
          }
        });
        cameraStreamRef.current = cameraStream;
        const camRecorder = new MediaRecorder(cameraStream, { mimeType: 'video/webm; codecs=vp9' });
        cameraRecorderRef.current = camRecorder;
        cameraChunksRef.current = [];

        camRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) cameraChunksRef.current.push(e.data);
        };
        camRecorder.start();
      } else {
        cameraStreamRef.current = null;
        cameraRecorderRef.current = null;
        cameraChunksRef.current = [];
      }

      // 4. Start Input Tracking
      inputEventsRef.current = [];
      await window.api.startInputTracking();
      cleanupInputListenerRef.current = window.api.onInputEvent((event) => {
        let adjustedEvent = { ...event };
        
        // 如果是区域录制，需要减去区域的左上角坐标，使得鼠标轨迹坐标相对于视频左上角
        if (captureMode === 'region' && selectedRegion) {
          // uIOhook 返回的是物理像素坐标，而 selectedRegion 是逻辑坐标
          // 所以我们需要将 selectedRegion 的坐标乘以 dpr 转换为物理坐标再进行相减
          const dpr = (selectedRegion as any).dpr || window.devicePixelRatio || 1;
          const physW = Math.round(selectedRegion.width * dpr);
          const physH = Math.round(selectedRegion.height * dpr);
          
          if (typeof adjustedEvent.x === 'number') {
            adjustedEvent.x -= Math.round(selectedRegion.x * dpr);
            // 限制在视频范围内，防止鼠标移出录制区域时，导致回放端(buildAxisNormalizer)的启发式坐标映射算法失效
            adjustedEvent.x = Math.max(0, Math.min(physW, adjustedEvent.x));
          }
          if (typeof adjustedEvent.y === 'number') {
            adjustedEvent.y -= Math.round(selectedRegion.y * dpr);
            adjustedEvent.y = Math.max(0, Math.min(physH, adjustedEvent.y));
          }
        }

        inputEventsRef.current.push({
          ...adjustedEvent,
          timestamp: Date.now()
        });
      });

      new Notification('开始录制', { body: '屏幕录制已开始' });
      setIsRecording(true);
      recordingStartedAtRef.current = Date.now();
      window.api.setRecordingState(true);

    } catch (err) {
      console.error("Error starting recording:", err);
      await cleanupFailedRecordingStart();
      alert('录制启动失败: ' + getStartupErrorMessage(err));
    } finally {
      isStartingRecordingRef.current = false;
      setIsStartingRecording(false);
    }
  };

  const stopRecording = async () => {
    resetLocalRecordingResources();
    
    if (ffmpegRecordingRef.current) {
      const ffmpegResult = await window.api.stopFfmpegRecording();
      ffmpegRecordingRef.current = false;
      if (ffmpegResult.success && ffmpegResult.path) {
        ffmpegVideoPathRef.current = ffmpegResult.path;
      } else {
        alert(ffmpegResult.error || 'FFmpeg 停止失败');
      }
    }
    
    // Stop Input Tracking
    await window.api.stopInputTracking();
    
    setIsRecording(false);
    window.api.setRecordingState(false);
    restoreCameraPreviewIfNeeded();

    // Wait a bit for final chunks
    setTimeout(() => {
      // Open Save Dialog Window
      window.api.openSaveDialog();
    }, 500);
  };

  const handleSaveProcess = async (filename: string) => {
    try {
      // Prepare Data
      const cameraBlob = cameraChunksRef.current.length > 0 
        ? new Blob(cameraChunksRef.current, { type: 'video/webm' }) 
        : null;
      const micBlob = micChunksRef.current.length > 0
        ? new Blob(micChunksRef.current, { type: 'audio/webm' })
        : null;
      const inputLog = JSON.stringify(inputEventsRef.current, null, 2);

      // Convert Blobs to ArrayBuffers
      const cameraBuffer = cameraBlob ? await cameraBlob.arrayBuffer() : null;
      const micBuffer = micBlob ? await micBlob.arrayBuffer() : null;

      // Send to Main Process
      const durationMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : 0;
      const result = await window.api.saveRecording({
        folderName: filename,
        screenBlob: null,
        ffmpegVideoPath: ffmpegVideoPathRef.current,
        cameraBlob: cameraBuffer,
        micBlob: micBuffer,
        inputLog,
        durationMs,
        startedAtMs: recordingStartedAtRef.current
      });

      if (result.success) {
        // Clear buffers
        cameraChunksRef.current = [];
        micChunksRef.current = [];
        ffmpegVideoPathRef.current = null;
        inputEventsRef.current = [];
        recordingStartedAtRef.current = null;
        await loadHistory();
      } else {
        alert(`保存失败：${result.error}`);
      }

    } catch (err) {
      console.error("Save error:", err);
      alert('保存过程出错: ' + err);
    }
  };

  useEffect(() => {
    const cleanup = window.api.onStartActualRecording(() => {
      performRecording();
    });
    return cleanup;
  }, [performRecording]);

  // Shortcut Handler
  useEffect(() => {
    const handleToggle = () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    };

    const cleanup = window.api.onToggleRecording(handleToggle);
    return cleanup;
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    const cleanup = window.api.onStopRecording(() => {
      if (isRecording) stopRecording();
    });
    return cleanup;
  }, [isRecording, stopRecording]);

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0} color="transparent">
        <Toolbar>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <svg width="140" height="36" viewBox="0 0 140 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: '#1976d2' }}>
              <rect x="4" y="6" width="28" height="20" rx="4" stroke="currentColor" strokeWidth="2.5" fill="transparent"/>
              <rect x="20" y="16" width="12" height="10" rx="2" fill="currentColor" />
              <circle cx="11" cy="11" r="2" fill="currentColor" />
              <text x="40" y="24" fontFamily="system-ui, sans-serif" fontSize="20" fontWeight="900" fill="currentColor" letterSpacing="-0.5">Keyu·See</text>
            </svg>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleOpenExternal('http://page.keyu.live/keyusee')}
            >
              软件官网
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleOpenExternal('http://www.keyu.live')}
            >
              更多产品
            </Button>
            <IconButton color="primary" onClick={() => window.api.openSettings()}>
              <SettingsIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', py: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight="bold" color="text.primary" gutterBottom>
            从“录屏”到“讲清楚”
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            先录后剪 · 自动着重 · 画中画讲解，让知识输出更清晰
          </Typography>
        </Box>

        <Paper elevation={3} sx={{ p: 3, borderRadius: 4, bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Tabs value={mainTab} onChange={(_, value) => setMainTab(value)} textColor="primary" indicatorColor="primary">
            <Tab value="record" label="录制中心" />
            <Tab value="history" label={`历史录屏 (${historyList.length})`} />
          </Tabs>

          {mainTab === 'record' ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Box mb={4}>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={isLoadingSources ? <CircularProgress size={24} color="inherit" /> : <DesktopWindowsIcon />}
                  onClick={handleGetSources}
                  disabled={isRecording || isStartingRecording || isLoadingSources}
                  fullWidth
                  sx={{ height: 60, fontSize: '1.1rem', borderColor: 'divider', color: 'text.primary', justifyContent: 'flex-start', px: 3 }}
                >
                  {isLoadingSources ? '正在加载屏幕源...' : (captureMode === 'region' && selectedRegion ? `已选择区域 (${selectedRegion.width}x${selectedRegion.height})` : (selectedSourceId ? (selectedSourceName || '已选屏幕/窗口') : '选择屏幕/窗口'))}
                </Button>
              </Box>

              <Grid container spacing={3} mb={5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth disabled={isRecording || isStartingRecording}>
                    <InputLabel>摄像头</InputLabel>
                    <Select
                      value={selectedCameraId || 'none'}
                      label="摄像头"
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                      startAdornment={<VideocamIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                    >
                      <MenuItem value="none">不录制摄像头</MenuItem>
                      {cameras.map((cam) => (
                        <MenuItem key={cam.deviceId} value={cam.deviceId}>{cam.label || `Camera ${cam.deviceId}`}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth disabled={isRecording || isStartingRecording}>
                    <InputLabel>麦克风</InputLabel>
                    <Select
                      value={selectedMicId || 'none'}
                      label="麦克风"
                      onChange={(e) => setSelectedMicId(e.target.value)}
                      startAdornment={<MicIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                    >
                      <MenuItem value="none">不录制麦克风</MenuItem>
                      {mics.map((mic) => (
                        <MenuItem key={mic.deviceId} value={mic.deviceId}>{mic.label || `Mic ${mic.deviceId}`}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Box
                sx={{
                  mb: 4,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 4,
                  flexWrap: 'wrap'
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={recordSystemAudio}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRecordSystemAudio(checked);
                        window.api.setConfig({ recordSystemAudio: checked });
                      }}
                      color="primary"
                      disabled={isRecording || isStartingRecording}
                    />
                  }
                  label="录制系统声音"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={enableCountdown}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEnableCountdown(checked);
                        window.api.setConfig({ enableCountdown: checked });
                      }}
                      color="primary"
                      disabled={isRecording || isStartingRecording}
                    />
                  }
                  label="开启倒计时"
                />
              </Box>

              <Box display="flex" justifyContent="center" alignItems="center" flexDirection="column">
                {!isRecording ? (
                  <Box display="flex" alignItems="center" gap={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      size="large"
                      startIcon={<FiberManualRecordIcon />}
                      onClick={startRecording}
                      disabled={isStartingRecording}
                      sx={{
                        borderRadius: 50,
                        px: 6,
                        py: 2,
                        fontSize: '1.2rem',
                        boxShadow: '0 4px 20px rgba(33, 150, 243, 0.4)',
                        transition: 'transform 0.2s',
                        '&:hover': {
                          transform: 'scale(1.05)'
                        }
                      }}
                    >
                      {isStartingRecording ? '正在启动...' : '开始录制'}
                    </Button>
                    {recordingShortcut && (
                      <Typography variant="caption" sx={{ bgcolor: 'action.selected', px: 1, py: 0.5, borderRadius: 1, color: 'text.secondary' }}>
                        {recordingShortcut.replace('CommandOrControl', 'Ctrl')}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Box display="flex" alignItems="center" gap={2}>
                    <Button
                      variant="contained"
                      color="secondary"
                      size="large"
                      startIcon={<StopIcon />}
                      onClick={stopRecording}
                      sx={{
                        borderRadius: 50,
                        px: 6,
                        py: 2,
                        fontSize: '1.2rem',
                        boxShadow: '0 4px 20px rgba(245, 0, 87, 0.4)',
                        animation: 'pulse 2s infinite',
                        '@keyframes pulse': {
                          '0%': { boxShadow: '0 0 0 0 rgba(245, 0, 87, 0.7)' },
                          '70%': { boxShadow: '0 0 0 15px rgba(245, 0, 87, 0)' },
                          '100%': { boxShadow: '0 0 0 0 rgba(245, 0, 87, 0)' }
                        }
                      }}
                    >
                      停止录制
                    </Button>
                    {recordingShortcut && (
                      <Typography variant="caption" sx={{ bgcolor: 'action.selected', px: 1, py: 0.5, borderRadius: 1, color: 'text.secondary' }}>
                        {recordingShortcut.replace('CommandOrControl', 'Ctrl')}
                      </Typography>
                    )}
                  </Box>
                )}
                {isRecording && (
                  <Typography variant="caption" display="block" mt={3} color="error">
                    正在录制中...
                  </Typography>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ minHeight: 380 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1, py: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <HistoryIcon color="primary" />
                  <Typography variant="h6">历史录屏列表</Typography>
                </Stack>
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={loadHistory}
                  disabled={isLoadingHistory}
                >
                  刷新
                </Button>
              </Stack>
              <Divider />
              {isLoadingHistory ? (
                <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress />
                </Box>
              ) : historyList.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                  <Typography color="text.secondary">暂无录屏历史，请先完成一次录制。</Typography>
                </Box>
              ) : (
                <List sx={{ maxHeight: 420, overflow: 'auto' }}>
                  {historyList.map((item) => (
                    <ListItemButton 
                      key={item.id} 
                      onClick={() => window.api.openHistoryDetail(item.id)} 
                      sx={{ borderRadius: 2, mb: 1 }}
                    >
                      <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                        <ListItemText
                          primary={item.name}
                          secondary={`录制时间：${formatDateTime(item.recordedAt)} | 保存路径：${item.absolutePath}`}
                          secondaryTypographyProps={{ sx: { mt: 0.5 } }}
                        />
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={`时长 ${item.durationText}`} color="primary" variant="outlined" />
                          <Tooltip title="查看素材文件夹">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenHistoryFolder(item.absolutePath);
                              }}
                            >
                              <FolderOpenIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="重命名">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHistoryRenameStart(item);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="删除">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHistoryDelete(item.id);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>
          )}
        </Paper>
      </Container>
      
      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={handleRenameDialogClose}>
        <DialogTitle>重命名记录</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="新名称"
            fullWidth
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRenameDialogClose}>取消</Button>
          <Button onClick={handleHistoryRenameConfirm} variant="contained">确定</Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={showSourceSelector} 
        onClose={() => setShowSourceSelector(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{ sx: { minHeight: '60vh' } }}
      >
        <DialogTitle>选择录制源</DialogTitle>
        <DialogContent dividers>
          <Tabs 
            value={sourceTab} 
            onChange={(_, val) => setSourceTab(val)} 
            indicatorColor="primary" 
            textColor="primary"
            sx={{ mb: 3 }}
          >
            <Tab label={`屏幕 (${screens.length})`} value="screen" />
            <Tab label={`窗口 (${windows.length})`} value="window" />
            <Tab label="框选区域" value="region" />
          </Tabs>
          
          {sourceTab === 'region' ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" color="text.secondary" mb={3}>
                框选屏幕上的任意区域进行录制，支持自定义大小和位置。
              </Typography>
              <Button variant="contained" onClick={handlePickRegion}>
                开始框选
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {(sourceTab === 'screen' ? screens : windows).map((source) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={source.id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer', 
                      border: selectedSourceId === source.id ? '2px solid #2196f3' : '1px solid transparent',
                      transition: 'all 0.2s',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
                    }}
                    onClick={() => { 
                      setCaptureMode(sourceTab === 'screen' ? 'screen' : 'window');
                      setSelectedSourceId(source.id); 
                      setSelectedSourceName(source.name);
                      setShowSourceSelector(false); 
                    }}
                  >
                  <CardActionArea>
                    <CardMedia 
                      component="img" 
                      height="140" 
                      image={source.thumbnail} 
                      alt={source.name} 
                      sx={{ objectFit: 'contain', bgcolor: '#000', p: 1 }} 
                    />
                    <CardContent>
                      <Typography variant="body2" noWrap title={source.name}>
                        {source.name}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSourceSelector(false)}>取消</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Home;
