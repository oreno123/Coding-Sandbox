import React, { useState, useEffect } from 'react';
import { Container, Box, Accordion, AccordionSummary, AccordionDetails, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { InputInfo, SavedConfig, ExtractResult, ReplicaElementData } from '@/types';
import { Messenger } from '@/utils/messaging';
import { ScanSection } from './components/ScanSection';
import { SelectSection } from './components/SelectSection';
import { ConfigSection } from './components/ConfigSection';
import { UtilSection } from './components/UtilSection';
import { ReplicaPreview } from './components/ReplicaPreview';

export const SidePanelApp: React.FC = () => {
  const [scannedInputs, setScannedInputs] = useState<InputInfo[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [replicaElements, setReplicaElements] = useState<ReplicaElementData[]>([]);

  // 扫描输入框
  const handleScan = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const result = await Messenger.sendToContent('SCAN_ALL');
      setScannedInputs(result || []);
      setSelectedIndexes(new Set());
      setMessage({
        type: 'success',
        text: `🔍 扫描到 ${result?.length || 0} 个输入框`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `❌ 扫描失败: ${(error as Error).message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // 切换输入框选择
  const toggleSelect = (index: number) => {
    const newSet = new Set(selectedIndexes);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndexes(newSet);

    // 高亮
    Messenger.sendToContent('HIGHLIGHT_BY_INDEX', { index }).catch(console.error);
  };

  // 保存配置
  const handleSaveConfig = async () => {
    if (selectedIndexes.size === 0) {
      setMessage({
        type: 'error',
        text: '❌ 请先选择输入框',
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const indexes = Array.from(selectedIndexes);
      const result = await Messenger.sendToContent('SAVE_BY_INDEXES', { indexes });

      setSavedConfigs(result || []);
      setMessage({
        type: 'success',
        text: `✅ 已保存 ${result?.length || 0} 个配置`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `❌ 保存失败: ${(error as Error).message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // 提取输入框
  const handleExtract = async () => {
    if (savedConfigs.length === 0) {
      setMessage({
        type: 'error',
        text: '❌ 没有保存的配置',
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await Messenger.sendToContent('EXTRACT_BY_CONFIG', {
        config: savedConfigs,
      });

      setMessage({
        type: 'success',
        text: `✅ 成功提取 ${result?.length || 0}/${savedConfigs.length} 个输入框`,
      });

      // 生成预览数据（在 content script 中生成，可以访问 DOM）
      if (result && result.length > 0) {
        try {
          const replicaData = await Messenger.sendToContent('GENERATE_REPLICA_DATA', {
            config: savedConfigs,
          });
          setReplicaElements(replicaData || []);
        } catch (error) {
          console.error('生成预览数据失败:', error);
        }
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `❌ 提取失败: ${(error as Error).message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // 导出配置
  const handleExportConfig = async () => {
    if (savedConfigs.length === 0) {
      setMessage({
        type: 'error',
        text: '❌ 没有配置可导出',
      });
      return;
    }

    try {
      const json = JSON.stringify(savedConfigs, null, 2);
      await navigator.clipboard.writeText(json);
      setMessage({
        type: 'success',
        text: '📤 配置已复制到剪贴板',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `❌ 复制失败: ${(error as Error).message}`,
      });
    }
  };

  // 清除高亮
  const handleClearHighlight = async () => {
    try {
      await Messenger.sendToContent('CLEAR_HIGHLIGHT');
      setMessage({
        type: 'success',
        text: '✅ 已清除高亮',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `❌ 清除失败: ${(error as Error).message}`,
      });
    }
  };

  // 处理预览元素点击
  const handleReplicaElementClick = async (configIndex: number) => {
    try {
      // 同时传入配置索引和对应的配置数据，避免依赖 content script 实例状态
      await Messenger.sendToContent('HIGHLIGHT_BY_CONFIG_INDEX', { 
        configIndex,
        config: savedConfigs[configIndex]
      });
    } catch (error) {
      console.error('高亮失败:', error);
    }
  };

  // 智能折叠：保存配置后自动折叠工具区
  useEffect(() => {
    if (savedConfigs.length > 0 && replicaElements.length > 0) {
      setToolsExpanded(false);
    }
  }, [savedConfigs.length, replicaElements.length]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      {/* 工具区（可折叠） */}
      <Accordion 
        expanded={toolsExpanded} 
        onChange={(_, expanded) => setToolsExpanded(expanded)}
        disableGutters
        elevation={0}
        sx={{ 
          borderBottom: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary 
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            minHeight: 48,
            '&.Mui-expanded': { minHeight: 48 }
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold">
            🔧 工具区
            {savedConfigs.length > 0 && (
              <Typography component="span" variant="caption" sx={{ ml: 1, color: 'primary.main' }}>
                ({savedConfigs.length} 个配置)
              </Typography>
            )}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0, maxHeight: '400px', overflow: 'auto' }}>
          <Container maxWidth="sm" disableGutters sx={{ px: 1.5, py: 1.5 }}>
            <ScanSection
              loading={loading}
              onScan={handleScan}
              message={message}
              scannedCount={scannedInputs.length}
            />

            {scannedInputs.length > 0 && (
              <SelectSection
                inputs={scannedInputs}
                selectedIndexes={selectedIndexes}
                onToggle={toggleSelect}
                onSave={handleSaveConfig}
                loading={loading}
              />
            )}

            {savedConfigs.length > 0 && (
              <ConfigSection
                configs={savedConfigs}
                onExtract={handleExtract}
                onExport={handleExportConfig}
                onClearHighlight={handleClearHighlight}
                loading={loading}
              />
            )}

            <UtilSection
              configs={savedConfigs}
              onClearHighlight={handleClearHighlight}
            />
          </Container>
        </AccordionDetails>
      </Accordion>

      {/* 预览区 */}
      {replicaElements.length > 0 && (
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <ReplicaPreview 
            elements={replicaElements}
            onElementClick={handleReplicaElementClick}
          />
        </Box>
      )}

      {/* 占位提示（没有预览数据时） */}
      {replicaElements.length === 0 && savedConfigs.length > 0 && (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            📊 点击"提取"按钮生成页面预览
          </Typography>
        </Box>
      )}
    </Box>
  );
};

