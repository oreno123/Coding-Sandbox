import React from 'react';
import {
  Paper,
  Button,
  Box,
  Alert,
  Chip,
  List,
  ListItem,
  Typography,
  Stack,
} from '@mui/material';
import TargetIcon from '@mui/icons-material/FiberManualRecord';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ClearIcon from '@mui/icons-material/Clear';
import type { SavedConfig } from '@/types';

interface ConfigSectionProps {
  configs: SavedConfig[];
  onExtract: () => void;
  onExport: () => void;
  onClearHighlight: () => void;
  loading: boolean;
}

export const ConfigSection: React.FC<ConfigSectionProps> = ({
  configs,
  onExtract,
  onExport,
  onClearHighlight,
  loading,
}) => {
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2, color: 'primary.main' }}>
        <TargetIcon sx={{ mr: 1, fontSize: 20 }} />
        第三步：管理配置
      </Typography>

      <Stack spacing={1} sx={{ mb: 2 }}>
        <Button
          fullWidth
          variant="contained"
          color="secondary"
          onClick={onExtract}
          disabled={loading}
        >
          根据配置重新提取输入框
        </Button>

        <Button
          fullWidth
          variant="contained"
          onClick={onExport}
          disabled={loading}
          startIcon={<FileDownloadIcon />}
        >
          导出配置到剪贴板
        </Button>

        <Button
          fullWidth
          variant="outlined"
          color="error"
          onClick={onClearHighlight}
          disabled={loading}
          startIcon={<ClearIcon />}
        >
          清除所有高亮
        </Button>
      </Stack>

      <Box sx={{ maxHeight: 150, overflow: 'auto' }}>
        <Alert severity="info" sx={{ mb: 1 }}>
          已保存 <Chip label={configs.length} size="small" color="primary" sx={{ ml: 0.5 }} /> 个配置
        </Alert>

        <List sx={{ p: 0 }}>
          {configs.map((config, idx) => (
            <ListItem
              key={idx}
              sx={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 0.5,
                mb: 0.5,
                backgroundColor: 'background.default',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {config.label || config.name || '(无名称)'}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: '10px',
                  wordBreak: 'break-all',
                  mt: 0.5,
                }}
              >
                {config.containerSelector}
              </Typography>
            </ListItem>
          ))}
        </List>
      </Box>
    </Paper>
  );
};

