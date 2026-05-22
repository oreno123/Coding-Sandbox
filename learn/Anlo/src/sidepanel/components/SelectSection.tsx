import React from 'react';
import {
  Paper,
  Button,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Typography,
  Stack,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { InputInfo } from '@/types';

interface SelectSectionProps {
  inputs: InputInfo[];
  selectedIndexes: Set<number>;
  onToggle: (index: number) => void;
  onSave: () => void;
  loading: boolean;
}

export const SelectSection: React.FC<SelectSectionProps> = ({
  inputs,
  selectedIndexes,
  onToggle,
  onSave,
  loading,
}) => {
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2, color: 'primary.main' }}>
        <CheckCircleIcon sx={{ mr: 1, fontSize: 20 }} />
        第二步：选择输入框
      </Typography>

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          maxHeight: 300,
          overflow: 'auto',
          mb: 2,
        }}
      >
        <List sx={{ p: 0 }}>
          {inputs.map((input) => (
            <ListItemButton
              key={input.index}
              onClick={() => onToggle(input.index)}
              selected={selectedIndexes.has(input.index)}
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                py: 1,
                '&:last-child': { borderBottom: 'none' },
                '&.Mui-selected': {
                  backgroundColor: 'success.light',
                  '&:hover': { backgroundColor: 'success.light' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Checkbox edge="start" checked={selectedIndexes.has(input.index)} tabIndex={-1} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      #{input.index}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {input.label || '(无标签)'}
                    </Typography>
                  </Stack>
                }
                secondary={
                  <Box sx={{ fontSize: '11px', color: 'text.secondary', mt: 0.5 }}>
                    <Box>name: {input.name || '(无)'} | type: {input.type}</Box>
                    <Box sx={{ fontSize: '10px', opacity: 0.7 }}>
                      {input.containerPath || '(无容器)'}
                    </Box>
                  </Box>
                }
              />
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Button
        fullWidth
        variant="contained"
        color="success"
        onClick={onSave}
        disabled={loading || selectedIndexes.size === 0}
      >
        保存选中的输入框配置 ({selectedIndexes.size})
      </Button>
    </Paper>
  );
};

