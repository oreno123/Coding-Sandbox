import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';

const RegionSelector: React.FC = () => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.api.cancelRegionSelection();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.backgroundColor = '';
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsSelecting(true);
    setStartPoint({ x: e.clientX, y: e.clientY });
    setCurrentPoint({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting) return;
    setCurrentPoint({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isSelecting || !startPoint || !currentPoint) return;
    setIsSelecting(false);
    
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    if (width > 50 && height > 50) {
      window.api.confirmRegionSelection({ 
        x, y, width, height, 
        dpr: window.devicePixelRatio || 1 
      } as any);
    } else {
      window.api.cancelRegionSelection();
    }
  };

  let boxStyle: React.CSSProperties = { display: 'none' };
  if (isSelecting && startPoint && currentPoint) {
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);
    
    boxStyle = {
      position: 'absolute',
      left: x,
      top: y,
      width,
      height,
      border: '2px solid #2196f3',
      backgroundColor: 'rgba(33, 150, 243, 0.2)',
      pointerEvents: 'none',
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
    };
  }

  return (
    <Box 
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      sx={{ 
        width: '100vw', 
        height: '100vh', 
        cursor: 'crosshair',
        position: 'relative'
      }}
    >
      {!isSelecting && !startPoint && (
        <Typography 
          sx={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            color: 'white',
            bgcolor: 'rgba(0,0,0,0.7)',
            px: 3,
            py: 1.5,
            borderRadius: 2,
            pointerEvents: 'none',
            fontSize: '1.2rem'
          }}
        >
          拖动鼠标框选录制区域，按 ESC 取消
        </Typography>
      )}
      
      <div style={boxStyle} />
    </Box>
  );
};

export default RegionSelector;