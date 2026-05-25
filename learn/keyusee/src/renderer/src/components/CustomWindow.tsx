import React, { useEffect } from 'react';
import { Box, Paper, Typography, IconButton, useTheme } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface CustomWindowProps {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  width?: string | number;
  height?: string | number;
  sx?: any;
}

const CustomWindow: React.FC<CustomWindowProps> = ({ 
  title, 
  children, 
  onClose, 
  width = '100%', 
  height = '100%',
  sx 
}) => {
  const theme = useTheme();

  useEffect(() => {
    // Set body and html to transparent to allow custom window shape and shadow
    // This is safe because Save and Settings open in their own BrowserWindow instances
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    return () => {
      // Optional: Reset if we were to navigate within the same window (unlikely for these dialogs)
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
    };
  }, []);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      // Default to closing window via API if no handler provided
      if (window.api && window.api.closeWindow) {
        window.api.closeWindow();
      } else {
        console.warn('Close window API not available');
      }
    }
  };

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'transparent',
        p: 2, // Padding for shadow visibility
        boxSizing: 'border-box',
        ...sx
      }}
    >
      <Paper
        elevation={8}
        sx={{
          width: width,
          height: height,
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* Title Bar */}
        <Box
          sx={{
            height: 48,
            minHeight: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.default',
            userSelect: 'none',
          }}
          style={{ WebkitAppRegion: 'drag' } as any}
        >
          <Typography variant="subtitle1" fontWeight="bold" noWrap>
            {title}
          </Typography>
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{ 
              color: 'text.secondary',
              '&:hover': { 
                color: 'error.main', 
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(211, 47, 47, 0.1)'
              } 
            }}
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Content Area */}
        <Box sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {children}
        </Box>
      </Paper>
    </Box>
  );
};

export default CustomWindow;
