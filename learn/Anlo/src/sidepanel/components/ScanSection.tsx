import React from 'react';
import { Paper, Button, Box, Alert, Chip, CircularProgress, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

interface ScanSectionProps {
  loading: boolean;
  onScan: () => void;
  message: { type: 'info' | 'success' | 'error'; text: string } | null;
  scannedCount: number;
}

export const ScanSection: React.FC<ScanSectionProps> = ({ loading, onScan, message, scannedCount }) => {
  const getAlertSeverity = (type: string) => {
    const severityMap: { [key: string]: 'success' | 'error' | 'info' } = {
      success: 'success',
      error: 'error',
      info: 'info',
    };
    return severityMap[type] || 'info';
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2, color: 'primary.main' }}>
        <SearchIcon sx={{ mr: 1, fontSize: 20 }} />
        第一步：扫描输入框
      </Typography>

      <Button
        fullWidth
        variant="contained"
        color="primary"
        onClick={onScan}
        disabled={loading}
        sx={{ mb: 1.5 }}
        startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
      >
        {loading ? '扫描中...' : '扫描当前页面所有输入框'}
      </Button>

      {message && (
        <Alert severity={getAlertSeverity(message.type)} sx={{ mb: 1 }}>
          {message.text}
        </Alert>
      )}

      {scannedCount > 0 && (
        <Alert severity="info">
          已扫描 <Chip label={scannedCount} size="small" color="primary" sx={{ ml: 0.5 }} /> 个输入框
        </Alert>
      )}
    </Paper>
  );
};

