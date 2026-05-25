import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Paper } from '@mui/material';
import { VisibilityOff as VisibilityOffIcon } from '@mui/icons-material';
import { keyframes } from '@emotion/react';

// Ripple Animation Keyframes
const ripple = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4),
                0 0 0 0 rgba(103, 58, 183, 0.4);
  }
  50% {
    box-shadow: 0 0 0 20px rgba(33, 150, 243, 0),
                0 0 0 10px rgba(103, 58, 183, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0),
                0 0 0 0 rgba(103, 58, 183, 0);
  }
`;

const gradientBg = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const CameraPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Make window transparent
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    // Listen for device ID from main process
    const cleanup = window.api.onCameraPreview((id: string) => {
      setDeviceId(id);
    });
    
    // Listen for recording state
    const cleanupRecording = window.api.onRecordingStateChanged((recording: boolean) => {
      setIsRecording(recording);
    });

    // Notify main process that we are ready to receive device ID
    // This is crucial for the first open when window is just created
    setTimeout(() => {
        window.api.cameraPreviewReady();
    }, 100);

    return () => {
      cleanup();
      cleanupRecording();
    };
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    const startCamera = async () => {
      setLoading(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setLoading(false);
          };
        }
      } catch (err) {
        console.error("Camera preview error:", err);
        setLoading(true); // Keep loading state on error to show animation
      }
    };

    startCamera();

    return () => {
      // Cleanup stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [deviceId]);

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 0) { // Left click only
      (e.target as Element).setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragOffset.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      window.api.moveWindow(dragOffset.current.x, dragOffset.current.y);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        overflow: 'hidden',
        userSelect: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Paper
        elevation={24}
        sx={{
          width: '90%', // Leave space for shadow
          height: '90%',
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(-45deg, #2196f3, #673ab7, #2196f3)',
          backgroundSize: '400% 400%',
          animation: loading ? `${gradientBg} 3s ease infinite, ${ripple} 2s infinite` : 'none',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8)',
          cursor: 'move',
          opacity: isHovering ? 0.62 : 1,
          transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: loading ? 'none' : 'block',
            pointerEvents: 'none', // Pass events to container
          }}
          muted
        />
        
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 20,
          }}
        >
          <IconButton
            size="small"
            aria-label="隐藏预览"
            sx={{
              bgcolor: 'rgba(15, 15, 18, 0.88)',
              color: '#fff',
              width: 30,
              height: 30,
              border: '1px solid rgba(255, 255, 255, 0.28)',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: 'rgba(211, 47, 47, 0.92)',
                transform: 'scale(1.08)',
              },
            }}
            onClick={(e) => {
              e.stopPropagation();
              window.api.closeCameraPreview();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <VisibilityOffIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
};

export default CameraPreview;
