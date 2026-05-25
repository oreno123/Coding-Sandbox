import React, { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import Home from './pages/Home';
import Settings from './pages/Settings';
import SaveDialog from './pages/SaveDialog';
import CameraPreview from './pages/CameraPreview';
import TrayMenu from './pages/TrayMenu';
import Countdown from './pages/Countdown';
import HistoryDetail from './pages/HistoryDetail';
import RegionSelector from './pages/RegionSelector';

const App: React.FC = () => {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        // Prevent default browser zoom behavior
        e.preventDefault();

        // Check if zoom APIs are available
        if (window.api?.getZoomFactor && window.api?.setZoomFactor) {
          const currentZoom = window.api.getZoomFactor();
          // Adjust zoom factor based on scroll direction
          // deltaY > 0 means scrolling down (zoom out), deltaY < 0 means scrolling up (zoom in)
          const zoomStep = 0.1;
          let newZoom = currentZoom;

          if (e.deltaY > 0) {
            newZoom = Math.max(0.3, currentZoom - zoomStep);
          } else if (e.deltaY < 0) {
            newZoom = Math.min(3.0, currentZoom + zoomStep);
          }

          if (newZoom !== currentZoom) {
            window.api.setZoomFactor(newZoom);
          }
        }
      }
    };

    // Add passive: false so we can call preventDefault()
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/save" element={<SaveDialog />} />
          <Route path="/camera-preview" element={<CameraPreview />} />
          <Route path="/tray-menu" element={<TrayMenu />} />
          <Route path="/countdown" element={<Countdown />} />
          <Route path="/history-detail" element={<HistoryDetail />} />
          <Route path="/region-selector" element={<RegionSelector />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
};

export default App;
