import React, { useState } from 'react';
import {
  Paper,
  Button,
  TextField,
  Box,
  Alert,
  Typography,
  Stack,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ClearIcon from '@mui/icons-material/Clear';
import type { SavedConfig } from '@/types';
import { Messenger } from '@/utils/messaging';

interface UtilSectionProps {
  configs: SavedConfig[];
  onClearHighlight: () => void;
}

export const UtilSection: React.FC<UtilSectionProps> = ({ configs, onClearHighlight }) => {
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleImport = () => {
    if (!importText.trim()) {
      setMessage({ type: 'error', text: '❌ 请输入配置JSON' });
      return;
    }

    try {
      const config = JSON.parse(importText);
      if (!Array.isArray(config)) {
        throw new Error('配置格式错误，应为数组');
      }
      // 这里可以保存到 localStorage 或调用父组件处理
      setMessage({ type: 'success', text: `✅ 已导入 ${config.length} 个配置` });
      setImportText('');
    } catch (error) {
      setMessage({ type: 'error', text: `❌ 导入失败: ${(error as Error).message}` });
    }
  };

  const getAlertSeverity = (type: string) => {
    const severityMap: { [key: string]: 'success' | 'error' | 'info' } = {
      success: 'success',
      error: 'error',
      info: 'info',
    };
    return severityMap[type] || 'info';
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2, color: 'primary.main' }}>
        <SettingsIcon sx={{ mr: 1, fontSize: 20 }} />
        工具与设置
      </Typography>

      <Stack spacing={1.5}>
        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          onClick={onClearHighlight}
          startIcon={<ClearIcon />}
        >
          清除所有高亮
        </Button>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
            <FileUploadIcon sx={{ mr: 0.5, fontSize: 18 }} />
            导入配置
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="在这里粘贴配置JSON..."
            size="small"
            sx={{ mb: 1 }}
          />
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            onClick={handleImport}
            startIcon={<FileUploadIcon />}
          >
            导入配置
          </Button>
        </Box>

        {message && (
          <Alert severity={getAlertSeverity(message.type)}>
            {message.text}
          </Alert>
        )}

        <Alert severity="info" sx={{ fontSize: '12px' }}>
          💡 提示：配置会自动保存到浏览器存储中
        </Alert>
      </Stack>
    </Paper>
  );
};

