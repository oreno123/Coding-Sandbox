import React, { useState, useEffect } from 'react';
import { Box, Typography, Link, Paper } from '@mui/material';

const Countdown: React.FC = () => {
  const [count, setCount] = useState(3);

  useEffect(() => {
    const resetCountdown = () => setCount(3);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetCountdown();
      }
    };

    window.addEventListener('focus', resetCountdown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', resetCountdown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    // Ensure transparent background for the window
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    if (count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown finished
      window.api.countdownFinished();
    }
  }, [count]);

  const handleCancel = () => {
    window.api.cancelCountdown();
  };

  return (
    <Box 
      sx={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        bgcolor: 'transparent'
      }}
    >
      <Paper 
        elevation={10}
        sx={{
          width: 200,
          height: 200,
          borderRadius: '50%',
          bgcolor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)'
        }}
      >
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', pt: 2 }}>
          <Typography variant="h1" fontWeight="bold" sx={{ fontSize: '5rem' }}>
            {count > 0 ? count : 'GO'}
          </Typography>
        </Box>
        
        <Box sx={{ pb: 4 }}>
          <Link 
            component="button" 
            variant="body1" 
            onClick={handleCancel}
            sx={{ 
              color: '#ff4444', 
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' } 
            }}
          >
            取消录制
          </Link>
        </Box>
      </Paper>
    </Box>
  );
};

export default Countdown;
