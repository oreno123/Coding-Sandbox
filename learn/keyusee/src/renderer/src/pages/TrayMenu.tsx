import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Switch,
  Divider,
  Paper
} from '@mui/material';
import {
  DesktopWindows as DesktopWindowsIcon,
  Videocam as VideocamIcon,
  Settings as SettingsIcon,
  ExitToApp as ExitToAppIcon
} from '@mui/icons-material';

const TrayMenu: React.FC = () => {
  const [showMainWindow, setShowMainWindow] = useState(true);
  const [showCameraPreview, setShowCameraPreview] = useState(false);

  useEffect(() => {
    // Check initial states
    const checkStatus = async () => {
      const isMainVisible = await window.api.isMainWindowVisible();
      setShowMainWindow(isMainVisible);
      
      const isCameraVisible = await window.api.isCameraPreviewVisible();
      setShowCameraPreview(isCameraVisible);
    };
    
    checkStatus();
    
    // Listen for visibility changes if needed, or just poll on mount since menu is short-lived
    // For now, checking on mount is sufficient as menu is recreated/re-rendered on show
  }, []);

  const handleToggleMainWindow = async () => {
    const newState = !showMainWindow;
    setShowMainWindow(newState);
    await window.api.toggleMainWindow();
    // Close menu after action? usually tray menus stay open for toggles, close for actions
  };

  const handleToggleCameraPreview = async () => {
    const newState = !showCameraPreview;
    setShowCameraPreview(newState);
    await window.api.toggleCameraPreview();
  };

  const handleOpenSettings = () => {
    window.api.openSettings();
    window.api.closeTrayWindow(); // Close menu after opening settings
  };

  const handleQuit = () => {
    window.api.quitApp();
  };

  return (
    <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', bgcolor: 'background.paper' }}>
      <Paper elevation={0} square sx={{ height: '100%', border: '1px solid rgba(0,0,0,0.12)' }}>
        <List dense>
          {/* Main Window Toggle */}
          <ListItem>
            <ListItemIcon>
              <DesktopWindowsIcon />
            </ListItemIcon>
            <ListItemText primary="显示主窗口" />
            <Switch
              edge="end"
              checked={showMainWindow}
              onChange={handleToggleMainWindow}
              size="small"
            />
          </ListItem>

          {/* Camera Preview Toggle */}
          <ListItem>
            <ListItemIcon>
              <VideocamIcon />
            </ListItemIcon>
            <ListItemText primary="显示摄像头预览" />
            <Switch
              edge="end"
              checked={showCameraPreview}
              onChange={handleToggleCameraPreview}
              size="small"
            />
          </ListItem>

          <Divider />

          {/* Settings */}
          <ListItemButton onClick={handleOpenSettings}>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="软件设置" />
          </ListItemButton>

          <Divider />

          {/* Quit */}
          <ListItemButton onClick={handleQuit}>
            <ListItemIcon>
              <ExitToAppIcon color="error" />
            </ListItemIcon>
            <ListItemText primary="退出" primaryTypographyProps={{ color: 'error' }} />
          </ListItemButton>
        </List>
      </Paper>
    </Box>
  );
};

export default TrayMenu;
