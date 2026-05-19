/**
 * 记忆配置：记忆系统开关（启用记忆 / 用户画像 / Obsidian）、库目录与同步、清理与自动导出。
 * 主题与搜索仍在「常规」。
 */

import React, { useState, useEffect } from 'react'
import { sendToBackground } from '../../../shared/messaging'
import type {
  CleanupConfig,
  AutoExportRule,
  MemorySettings,
  ObsidianSettings,
  Episode,
} from '../../../shared/memory-types'
import { DEFAULT_CLEANUP_CONFIG, DEFAULT_MEMORY_SETTINGS } from '../../../shared/memory-types'

interface ConfigPanelProps {
  onSwitchToMemoryTab?: () => void
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ onSwitchToMemoryTab }) => {
  const [memorySettings, setMemorySettings] = useState<MemorySettings>(DEFAULT_MEMORY_SETTINGS)
  const [memoryLoading, setMemoryLoading] = useState(true)
  const [memorySaving, setMemorySaving] = useState(false)
  const [memorySaveStatus, setMemorySaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [obsidianSettings, setObsidianSettings] = useState<ObsidianSettings | null>(null)
  const [obsidianError, setObsidianError] = useState<string | null>(null)
  const [selectingDir, setSelectingDir] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: number; failed: number } | null>(null)

  const [cleanupConfig, setCleanupConfig] = useState<CleanupConfig>(DEFAULT_CLEANUP_CONFIG)
  const [exportRules, setExportRules] = useState<AutoExportRule[]>([])
  const [showAddRule, setShowAddRule] = useState(false)

  useEffect(() => {
    const loadMemoryAndObsidian = async () => {
      try {
        const [res, obsRes] = await Promise.all([
          sendToBackground<{ success: boolean; settings?: MemorySettings }>({ action: 'memoryGetSettings' }),
          sendToBackground<{ success: boolean; settings?: ObsidianSettings }>({ action: 'memoryGetObsidianSettings' }),
        ])
        if (res.success && res.settings) setMemorySettings(res.settings)
        if (obsRes.success && obsRes.settings) setObsidianSettings(obsRes.settings)
      } catch {
        // ignore
      } finally {
        setMemoryLoading(false)
      }
    }
    loadMemoryAndObsidian()
    loadCleanupConfig()
    loadExportRules()
  }, [])

  const updateMemorySetting = (key: keyof MemorySettings, value: unknown) => {
    setMemorySettings((prev) => ({ ...prev, [key]: value as never }))
  }

  const saveMemorySettings = async () => {
    setMemorySaving(true)
    setMemorySaveStatus('idle')
    try {
      const res = await sendToBackground<{ success: boolean }>({
        action: 'memorySaveSettings',
        settings: memorySettings,
      })
      if (res.success) {
        setMemorySaveStatus('success')
        setTimeout(() => setMemorySaveStatus('idle'), 2000)
      } else {
        setMemorySaveStatus('error')
      }
    } catch {
      setMemorySaveStatus('error')
    } finally {
      setMemorySaving(false)
    }
  }

  const handleSelectObsidianDir = async () => {
    setSelectingDir(true)
    setObsidianError(null)
    try {
      if (typeof window.showDirectoryPicker !== 'function') {
        setObsidianError('您的浏览器不支持选择目录功能')
        return
      }
      const dirHandle = await window.showDirectoryPicker()
      const res = await sendToBackground<{ success: boolean }>({
        action: 'memorySaveObsidianSettings',
        settings: { rootDirHandle: dirHandle },
      })
      if (res.success) {
        setObsidianSettings((prev) =>
          prev
            ? { ...prev, rootDirHandle: dirHandle }
            : {
                rootDirHandle: dirHandle,
                subDir: 'MadokaMemory',
                frontmatterFormat: 'yaml',
                lastSyncAt: 0,
              },
        )
      } else {
        setObsidianError('保存设置失败')
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 用户取消
      } else if ((err as Error).name === 'SecurityError') {
        setObsidianError('权限被拒绝：无法访问所选目录')
      } else {
        setObsidianError('选择目录失败：' + (err as Error).message)
      }
    } finally {
      setSelectingDir(false)
    }
  }

  const handleSyncToObsidian = async () => {
    if (!obsidianSettings?.rootDirHandle) {
      setObsidianError('请先选择 Obsidian 库目录')
      return
    }
    setSyncing(true)
    setSyncResult(null)
    setObsidianError(null)
    try {
      const allRes = await sendToBackground<{ success: boolean; episodes?: Episode[] }>({ action: 'memoryGetAll' })
      if (!allRes.success || !allRes.episodes) {
        setObsidianError('获取记忆失败')
        return
      }
      const unsynced = allRes.episodes.filter((ep) => ep.syncStatus !== 'success')
      if (unsynced.length === 0) {
        setSyncResult({ success: 0, failed: 0 })
        return
      }
      const { writeEpisodesToObsidianWithHandle } = await import('../../../background/obsidianSync')
      const result = await writeEpisodesToObsidianWithHandle(
        obsidianSettings.rootDirHandle as FileSystemDirectoryHandle,
        unsynced,
      )
      for (const entry of result.writtenEntries) {
        await sendToBackground({
          action: 'memoryUpdateEpisodeSyncStatus',
          uid: entry.uid,
          syncStatus: 'success',
          markdownPath: entry.markdownPath,
        })
      }
      setSyncResult({ success: result.written, failed: result.failed })
    } catch (err) {
      setObsidianError('同步失败：' + (err as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  const loadCleanupConfig = async () => {
    const response = await sendToBackground<{ success: boolean; config?: CleanupConfig }>({
      action: 'memoryGetCleanupConfig',
    })
    if (response.success && response.config) {
      setCleanupConfig(response.config)
    } else {
      setCleanupConfig(DEFAULT_CLEANUP_CONFIG)
    }
  }

  const loadExportRules = async () => {
    const response = await sendToBackground<{ success: boolean; rules?: AutoExportRule[] }>({
      action: 'memoryGetAutoExportRules',
    })
    if (response.success && response.rules) {
      setExportRules(response.rules)
    }
  }

  // 预览并手动清理：跳转到记忆库页面，用户可逐条删除
  const previewCleanup = async () => {
    const percentage = cleanupConfig.cleanupPercentage
    await sendToBackground<{
      success: boolean
      preview?: { toDelete: unknown[]; totalCount: number; estimatedSize: number }
    }>({
      action: 'memoryPreviewCleanup',
      percentage,
    })
    onSwitchToMemoryTab?.()
  }

  // 添加自动导出规则
  const addExportRule = async (rule: Omit<AutoExportRule, 'id'>) => {
    const newRule: AutoExportRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      lastExportedAt: 0,
    }
    await sendToBackground({
      action: 'memoryAddAutoExportRule',
      rule: newRule,
    })
    await loadExportRules()
    setShowAddRule(false)
  }

  // 删除自动导出规则
  const deleteExportRule = async (ruleId: string) => {
    await sendToBackground({
      action: 'memoryDeleteAutoExportRule',
      ruleId,
    })
    await loadExportRules()
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 hide-scrollbar bg-[var(--bg-primary)]">
      <p className="text-xs text-[var(--text-muted)] px-1">
        主题与默认搜索请在「<span className="text-[var(--text-secondary)]">常规</span>」中设置。
      </p>

      {!memoryLoading && (
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            记忆系统
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
              <div>
                <div className="text-sm text-[var(--text-primary)]">启用记忆</div>
                <div className="text-xs text-[var(--text-muted)]">自动保存对话中的重要信息</div>
              </div>
              <button
                type="button"
                onClick={() => updateMemorySetting('enabled', !memorySettings.enabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  memorySettings.enabled
                    ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-[0_0_10px_rgba(var(--accent-primary-rgb,59,130,246),0.5)]'
                    : 'bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)]'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    memorySettings.enabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
              <div>
                <div className="text-sm text-[var(--text-primary)]">用户画像</div>
                <div className="text-xs text-[var(--text-muted)]">记录您的偏好和特征</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateMemorySetting('userProfileEnabled', !memorySettings.userProfileEnabled)
                }
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  memorySettings.userProfileEnabled
                    ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-[0_0_10px_rgba(var(--accent-primary-rgb,59,130,246),0.5)]'
                    : 'bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)]'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    memorySettings.userProfileEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
              <div>
                <div className="text-sm text-[var(--text-primary)]">Obsidian 同步</div>
                <div className="text-xs text-[var(--text-muted)]">将记忆同步到 Obsidian 笔记</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateMemorySetting('obsidianSyncEnabled', !memorySettings.obsidianSyncEnabled)
                }
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  memorySettings.obsidianSyncEnabled
                    ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-[0_0_10px_rgba(var(--accent-primary-rgb,59,130,246),0.5)]'
                    : 'bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)]'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    memorySettings.obsidianSyncEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            {memorySettings.obsidianSyncEnabled && (
              <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-[var(--text-primary)]">Obsidian 库目录</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {obsidianSettings?.rootDirHandle ? '已选择目录' : '请选择 Obsidian 库根目录'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-xs font-medium rounded-lg disabled:opacity-50"
                    onClick={handleSelectObsidianDir}
                    disabled={selectingDir}
                  >
                    {selectingDir ? '选择中...' : '选择目录'}
                  </button>
                </div>
                {obsidianSettings?.rootDirHandle && (
                  <button
                    type="button"
                    className="w-full py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
                    onClick={handleSyncToObsidian}
                    disabled={syncing}
                  >
                    {syncing ? '同步中...' : '立即同步到 Obsidian'}
                  </button>
                )}
                {syncResult !== null && (
                  <div className="text-center text-xs text-[var(--accent-success)]">
                    同步完成：成功 {syncResult.success} 条，失败 {syncResult.failed} 条
                  </div>
                )}
                {obsidianError && (
                  <div className="text-xs text-[var(--accent-danger)]">{obsidianError}</div>
                )}
              </div>
            )}

            <button
              type="button"
              className="w-full py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
              onClick={saveMemorySettings}
              disabled={memorySaving}
            >
              {memorySaving ? '保存中...' : '保存记忆设置'}
            </button>
            {memorySaveStatus !== 'idle' && (
              <div
                className={`text-center text-xs ${
                  memorySaveStatus === 'success'
                    ? 'text-[var(--accent-success)]'
                    : 'text-[var(--accent-danger)]'
                }`}
              >
                {memorySaveStatus === 'success' ? '✓ 记忆设置已保存' : '✕ 保存失败'}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 记忆清理设置 */}
      <section className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">记忆清理设置</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg">
            <div>
              <div className="text-sm text-[var(--text-primary)]">启用自动清理</div>
            </div>
            <button
              onClick={() => {
                const base = cleanupConfig
                const newConfig = { ...base, enabled: !base.enabled }
                setCleanupConfig(newConfig)
                sendToBackground({ action: 'memorySaveCleanupConfig', config: newConfig })
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                cleanupConfig.enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-primary)]'
              }`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                cleanupConfig.enabled ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-[var(--text-primary)]">清理比例（%）</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={5}
                max={50}
                value={cleanupConfig.cleanupPercentage * 100}
                onChange={e => {
                  const newConfig = { ...cleanupConfig, cleanupPercentage: parseInt(e.target.value, 10) / 100 }
                  setCleanupConfig(newConfig)
                  sendToBackground({ action: 'memorySaveCleanupConfig', config: newConfig })
                }}
                className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm text-[var(--text-muted)] w-12">{Math.round(cleanupConfig.cleanupPercentage * 100)}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg">
            <div>
              <div className="text-sm text-[var(--text-primary)]">达到阈值时自动清理</div>
            </div>
            <button
              onClick={() => {
                const newConfig = { ...cleanupConfig, autoCleanup: !cleanupConfig.autoCleanup }
                setCleanupConfig(newConfig)
                sendToBackground({ action: 'memorySaveCleanupConfig', config: newConfig })
              }}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                cleanupConfig.autoCleanup ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-primary)]'
              }`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                cleanupConfig.autoCleanup ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-[var(--text-primary)]">自动清理阈值（条）</label>
            <input
              type="number"
              min={100}
              step={100}
              value={cleanupConfig.autoCleanupThreshold}
              onChange={e => {
                const newConfig = { ...cleanupConfig, autoCleanupThreshold: parseInt(e.target.value, 10) }
                setCleanupConfig(newConfig)
                sendToBackground({ action: 'memorySaveCleanupConfig', config: newConfig })
              }}
              className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
            />
          </div>
          <button 
            className="w-full py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={previewCleanup}
          >
            🧹 预览并手动清理
          </button>
        </div>
      </section>

      {/* 自动导出设置 */}
      <section className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">自动导出设置</h3>
        <div className="space-y-2 mb-3">
          {exportRules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg">
              <span className="text-sm text-[var(--text-primary)]">
                {rule.mainBlock || '全部'}
                {rule.subBlock && ` > ${rule.subBlock}`}
                {' '}
                ({rule.triggerType === 'onClose' ? '关闭时' : rule.triggerType === 'scheduled' ? `每日${rule.triggerConfig?.time}` : `超${rule.triggerConfig?.count}条`})
              </span>
              <button 
                onClick={() => deleteExportRule(rule.id)}
                className="px-2 py-1 text-xs text-[var(--accent-danger)] hover:bg-[var(--bg-hover)] rounded transition-colors"
              >
                删除
              </button>
            </div>
          ))}
        </div>
        <button 
          className="w-full py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          onClick={() => setShowAddRule(true)}
        >
          + 添加自动导出规则
        </button>
      </section>

      {/* 添加规则弹窗 */}
      {showAddRule && (
        <AutoExportRuleDialog
          onClose={() => setShowAddRule(false)}
          onSave={addExportRule}
        />
      )}
    </div>
  )
}

// 自动导出规则对话框
interface AutoExportRuleDialogProps {
  onClose: () => void
  onSave: (rule: Omit<AutoExportRule, 'id'>) => void
}

const AutoExportRuleDialog: React.FC<AutoExportRuleDialogProps> = ({ onClose, onSave }) => {
  const [mainBlock, setMainBlock] = useState('')
  const [subBlock, setSubBlock] = useState('')
  const [triggerType, setTriggerType] = useState<AutoExportRule['triggerType']>('onClose')
  const [time, setTime] = useState('02:00')
  const [count, setCount] = useState(100)

  const handleSave = () => {
    onSave({
      mainBlock: mainBlock || undefined,
      subBlock: subBlock || undefined,
      enabled: true,
      triggerType,
      triggerConfig: triggerType === 'scheduled' ? { time } : triggerType === 'threshold' ? { count } : undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-primary)] p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">添加自动导出规则</h3>
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm text-[var(--text-primary)]">大类（可选）</label>
            <input 
              value={mainBlock} 
              onChange={e => setMainBlock(e.target.value)} 
              placeholder="留空表示全部" 
              className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-[var(--text-primary)]">小类（可选）</label>
            <input 
              value={subBlock} 
              onChange={e => setSubBlock(e.target.value)} 
              placeholder="留空表示全部" 
              className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-[var(--text-primary)]">触发条件</label>
            <select 
              value={triggerType} 
              onChange={e => setTriggerType(e.target.value as AutoExportRule['triggerType'])}
              className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
            >
              <option value="onClose">关闭侧边栏时</option>
              <option value="scheduled">每日定时</option>
              <option value="threshold">记忆数量达到</option>
            </select>
          </div>
          {triggerType === 'scheduled' && (
            <div className="space-y-2">
              <label className="text-sm text-[var(--text-primary)]">时间</label>
              <input 
                type="time" 
                value={time} 
                onChange={e => setTime(e.target.value)} 
                className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
              />
            </div>
          )}
          {triggerType === 'threshold' && (
            <div className="space-y-2">
              <label className="text-sm text-[var(--text-primary)]">数量阈值</label>
              <input 
                type="number" 
                value={count} 
                onChange={e => setCount(parseInt(e.target.value))} 
                className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
              />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          <button 
            className="flex-1 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={onClose}
          >
            取消
          </button>
          <button 
            className="flex-1 py-2 bg-[var(--accent-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            onClick={handleSave}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}