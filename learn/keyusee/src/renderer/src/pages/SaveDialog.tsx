import React, { useState } from 'react';
import { Button, TextField, Typography, Stack, Box } from '@mui/material';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import CustomWindow from '../components/CustomWindow';

const SaveDialog: React.FC = () => {
  const generateDefaultName = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `录屏_${year}${month}${day}_${hours}${minutes}${seconds}`;
  };

  const [filename, setFilename] = useState(generateDefaultName());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filename.trim()) {
      window.api.submitFilename(filename.trim());
    }
  };

  const handleCancel = () => {
    window.api.closeSaveDialog();
  };

  return (
    <CustomWindow title="保存录屏" onClose={handleCancel} height="auto">
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" mb={3}>
          请输入文件名，系统将自动创建同名文件夹。
        </Typography>
        
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            autoFocus
            label="文件名"
            placeholder="例如：第一次会议记录"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            variant="outlined"
            sx={{ mb: 3 }}
          />
          
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button 
              variant="outlined" 
              color="inherit" 
              startIcon={<CancelIcon />} 
              onClick={handleCancel}
            >
              取消
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              startIcon={<SaveIcon />}
              disabled={!filename.trim()}
            >
              保存
            </Button>
          </Stack>
        </form>
      </Box>
    </CustomWindow>
  );
};

export default SaveDialog;
