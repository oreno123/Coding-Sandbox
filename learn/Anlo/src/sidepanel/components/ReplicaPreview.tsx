/**
 * ReplicaPreview - 复刻页面预览组件
 * 显示页面元素的可视化布局，支持点击高亮真实页面元素
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Tooltip,
} from '@mui/material';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import type { ReplicaElementData } from '@/types';

interface ReplicaPreviewProps {
  elements: ReplicaElementData[];
  onElementClick?: (configIndex: number) => void;
}

export const ReplicaPreview: React.FC<ReplicaPreviewProps> = ({
  elements,
  onElementClick,
}) => {
  const [scale, setScale] = useState<number>(100);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 处理元素点击
  const handleElementClick = (configIndex: number) => {
    setActiveIndex(configIndex);
    onElementClick?.(configIndex);

    // 1秒后取消激活状态
    setTimeout(() => {
      setActiveIndex(null);
    }, 1000);
  };

  // 获取元素类型图标
  const getElementIcon = (elementType: string): string => {
    switch (elementType) {
      case 'input':
        return '📝';
      case 'button':
        return '🔘';
      case 'select-display':
        return '📋';
      case 'text-display':
        return '📄';
      default:
        return '📦';
    }
  };

  // 获取元素类型颜色
  const getElementColor = (elementType: string): string => {
    switch (elementType) {
      case 'input':
        return '#00bfff';
      case 'button':
        return '#ff9800';
      case 'select-display':
        return '#4caf50';
      case 'text-display':
        return '#9c27b0';
      default:
        return '#757575';
    }
  };

  if (elements.length === 0) {
    return (
      <Paper sx={{ p: 3, m: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          📭 暂无元素可预览
        </Typography>
        <Typography variant="caption" color="text.secondary">
          请先扫描并保存配置
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 控制栏 */}
      <Paper
        sx={{
          p: 1.5,
          m: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight="bold">
            🖼️ 页面预览
          </Typography>
          <Chip label={`${elements.length} 个元素`} size="small" color="primary" />
        </Box>

        <ToggleButtonGroup
          value={scale}
          exclusive
          onChange={(_, newScale) => newScale && setScale(newScale)}
          size="small"
        >
          <ToggleButton value={50}>
            <ZoomOutIcon fontSize="small" />
            <Typography variant="caption" sx={{ ml: 0.5 }}>
              50%
            </Typography>
          </ToggleButton>
          <ToggleButton value={75}>
            <Typography variant="caption">75%</Typography>
          </ToggleButton>
          <ToggleButton value={100}>
            <ZoomInIcon fontSize="small" />
            <Typography variant="caption" sx={{ ml: 0.5 }}>
              100%
            </Typography>
          </ToggleButton>
          <ToggleButton value={0}>
            <FitScreenIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* 预览区域 */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: '#f5f5f5',
          p: 2,
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: scale === 0 ? '100%' : `${scale}%`,
            paddingBottom: scale === 0 ? '120%' : `${scale * 1.4}%`,
            bgcolor: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderRadius: 1,
          }}
        >
          {/* 渲染所有元素 */}
          {elements.map((elem) => {
            const isActive = activeIndex === elem.configIndex;
            const color = getElementColor(elem.elementType);

            return (
              <Tooltip
                key={elem.configIndex}
                title={
                  <Box>
                    <Typography variant="caption" display="block">
                      {getElementIcon(elem.elementType)} {elem.label || '(无标签)'}
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
                      类型: {elem.elementType}
                    </Typography>
                    {elem.value && (
                      <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
                        值: {elem.value.slice(0, 20)}
                        {elem.value.length > 20 ? '...' : ''}
                      </Typography>
                    )}
                  </Box>
                }
                arrow
              >
                <Box
                  onClick={() => handleElementClick(elem.configIndex)}
                  sx={{
                    position: 'absolute',
                    left: `${elem.x * 100}%`,
                    top: `${elem.y * 100}%`,
                    width: `${elem.width * 100}%`,
                    height: `${elem.height * 100}%`,
                    border: `2px solid ${color}`,
                    borderRadius: '4px',
                    bgcolor: isActive ? `${color}22` : `${color}11`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: scale >= 75 ? '12px' : '10px',
                    fontWeight: 500,
                    color: color,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    px: 0.5,
                    transition: 'all 0.2s',
                    boxShadow: isActive ? `0 0 12px ${color}` : `0 0 4px ${color}88`,
                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                    '&:hover': {
                      bgcolor: `${color}33`,
                      transform: 'scale(1.03)',
                      boxShadow: `0 0 8px ${color}`,
                      zIndex: 10,
                    },
                  }}
                >
                  {scale >= 75 && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: 'inherit',
                        fontWeight: 'inherit',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {getElementIcon(elem.elementType)}{' '}
                      {elem.label || elem.value || `#${elem.configIndex}`}
                    </Typography>
                  )}
                  {scale < 75 && (
                    <Typography variant="caption" sx={{ fontSize: 'inherit' }}>
                      {elem.configIndex}
                    </Typography>
                  )}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {/* 提示信息 */}
      <Paper sx={{ p: 1, m: 1, bgcolor: '#e3f2fd' }}>
        <Typography variant="caption" color="text.secondary">
          💡 点击预览中的元素可以在真实页面中高亮显示
        </Typography>
      </Paper>
    </Box>
  );
};

