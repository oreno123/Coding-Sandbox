import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { FolderOpen as FolderOpenIcon } from '@mui/icons-material';
import CustomWindow from '../components/CustomWindow';

type UpdatePhase = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

interface UpdateState {
  phase: UpdatePhase;
  message: string;
  currentVersion: string;
  availableVersion?: string;
  downloadedVersion?: string;
  progress?: number;
}

const defaultUpdateState: UpdateState = {
  phase: 'idle',
  message: '未检查更新',
  currentVersion: '1.0.0'
};

const Settings: React.FC = () => {
  const [savePath, setSavePath] = useState('');
  const [recordingShortcut, setRecordingShortcut] = useState('');
  const [recordFrameRate, setRecordFrameRate] = useState(60);
  const [updateState, setUpdateState] = useState<UpdateState>(defaultUpdateState);

  useEffect(() => {
    window.api.getConfig().then((config: any) => {
      setSavePath(config.savePath);
      setRecordingShortcut(config.recordingShortcut || 'CommandOrControl+F9');
      setRecordFrameRate(config.recordFrameRate || 60);
    });
    window.api.getUpdateState?.().then((state: UpdateState) => {
      if (state) setUpdateState(state);
    });
    const unsubscribe = window.api.onUpdateStateChanged?.((state: UpdateState) => {
      setUpdateState(state);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleSelectDirectory = async () => {
    const path = await window.api.selectDirectory();
    if (path) {
      setSavePath(path);
      updateConfig({ savePath: path });
    }
  };

  const updateConfig = (newConfig: any) => {
    window.api.setConfig(newConfig);
  };

  const handleShortcutKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();

    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      return;
    }

    const modifiers: string[] = [];
    if (e.ctrlKey) modifiers.push('CommandOrControl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.metaKey) modifiers.push('Super');

    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();
    if (key === 'ArrowUp') key = 'Up';
    if (key === 'ArrowDown') key = 'Down';
    if (key === 'ArrowLeft') key = 'Left';
    if (key === 'ArrowRight') key = 'Right';

    const shortcut = [...modifiers, key].join('+');
    setRecordingShortcut(shortcut);
    updateConfig({ recordingShortcut: shortcut });
  };

  const handleCheckUpdate = async () => {
    await window.api.checkForUpdates?.();
  };

  const handleDownloadUpdate = async () => {
    await window.api.downloadUpdate?.();
  };

  const handleInstallUpdate = async () => {
    await window.api.quitAndInstallUpdate?.();
  };

  const busy = updateState.phase === 'checking' || updateState.phase === 'downloading';

  return (
    <CustomWindow title="设置">
      <Box sx={{ p: 3 }}>
        <Box mb={4}>
          <TextField
            fullWidth
            label="录屏文件保存地址"
            value={savePath}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleSelectDirectory} edge="end">
                    <FolderOpenIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
            variant="outlined"
            helperText="点击文件夹图标修改保存路径"
          />
        </Box>

        <Box mb={4}>
          <TextField
            fullWidth
            label="录制快捷键"
            value={recordingShortcut}
            onKeyDown={handleShortcutKeyDown}
            helperText="点击输入框并按下键盘组合键修改"
            variant="outlined"
          />
        </Box>

        <Box mb={4}>
          <FormControl fullWidth variant="outlined">
            <InputLabel>录制帧率 (FPS)</InputLabel>
            <Select
              value={recordFrameRate}
              onChange={(e) => {
                const fps = Number(e.target.value);
                setRecordFrameRate(fps);
                updateConfig({ recordFrameRate: fps });
              }}
              label="录制帧率 (FPS)"
            >
              <MenuItem value={30}>30 FPS</MenuItem>
              <MenuItem value={60}>60 FPS</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.2)',
            bgcolor: 'rgba(15,23,42,0.2)'
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} mb={1}>
            版本更新
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={0.5}>
            当前版本：{updateState.currentVersion}
          </Typography>
          {(updateState.availableVersion || updateState.downloadedVersion) && (
            <Typography variant="body2" color="text.secondary" mb={1.5}>
              最新版本：{updateState.downloadedVersion || updateState.availableVersion}
            </Typography>
          )}
          <Alert severity={updateState.phase === 'error' ? 'error' : 'info'} sx={{ mb: 1.5 }}>
            {updateState.message}
          </Alert>
          {updateState.phase === 'downloading' && (
            <Box sx={{ mb: 1.5 }}>
              <LinearProgress variant="determinate" value={updateState.progress || 0} sx={{ mb: 0.5 }} />
              <Typography variant="caption" color="text.secondary">
                下载进度：{Math.round(updateState.progress || 0)}%
              </Typography>
            </Box>
          )}
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={handleCheckUpdate} disabled={busy}>
              检查更新
            </Button>
            {updateState.phase === 'available' && (
              <Button variant="contained" onClick={handleDownloadUpdate}>
                下载更新
              </Button>
            )}
            {updateState.phase === 'downloaded' && (
              <Button variant="contained" color="success" onClick={handleInstallUpdate}>
                立即安装
              </Button>
            )}
          </Stack>
        </Box>
      </Box>
    </CustomWindow>
  );
};

export default Settings;
