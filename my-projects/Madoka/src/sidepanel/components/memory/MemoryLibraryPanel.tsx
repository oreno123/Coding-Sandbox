/**
 * 记忆库页面组件
 * 折叠树结构展示板块和记忆，支持批量选择、导出、自动导出设置
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { sendToBackground } from '../../../shared/messaging'
import type { Episode, AutoExportRule } from '../../../shared/memory-types'

interface BlockNode {
  mainBlock: string
  subBlocks: {
    subBlock: string
    episodes: Episode[]
  }[]
}

export const MemoryLibraryPanel: React.FC = () => {
  const [blocks, setBlocks] = useState<BlockNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())
  const [expandedSubBlocks, setExpandedSubBlocks] = useState<Set<string>>(new Set())

  // 选择状态
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set())
  const [selectedSubBlocks, setSelectedSubBlocks] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // 导出设置弹窗
  const [showExportSettings, setShowExportSettings] = useState(false)
  const [, setExportRules] = useState<AutoExportRule[]>([])

  // 加载数据
  useEffect(() => {
    loadMemories()
    loadExportRules()
  }, [])

  const loadMemories = async () => {
    setLoading(true)
    const response = await sendToBackground<{ success: boolean; episodes?: Episode[] }>({
      action: 'memoryGetAll',
    })
    if (response.success && response.episodes) {
      // 组织为层级结构
      const blockMap = new Map<string, Map<string, Episode[]>>()
      for (const ep of response.episodes) {
        const mainBlock = ep.block || '未分类'
        const subBlock = ep.subBlock || '其他'
        if (!blockMap.has(mainBlock)) {
          blockMap.set(mainBlock, new Map())
        }
        const subMap = blockMap.get(mainBlock)!
        if (!subMap.has(subBlock)) {
          subMap.set(subBlock, [])
        }
        subMap.get(subBlock)!.push(ep)
      }
      const organized: BlockNode[] = []
      for (const [mainBlock, subMap] of blockMap) {
        organized.push({
          mainBlock,
          subBlocks: Array.from(subMap.entries())
            .map(([subBlock, episodes]) => ({
              subBlock,
              episodes: episodes.sort((a, b) => b.weight - a.weight),
            }))
            .sort((a, b) => a.subBlock.localeCompare(b.subBlock)),
        })
      }
      setBlocks(organized.sort((a, b) => a.mainBlock.localeCompare(b.mainBlock)))
    }
    setLoading(false)
  }

  const loadExportRules = async () => {
    const response = await sendToBackground<{ success: boolean; rules?: AutoExportRule[] }>({
      action: 'memoryGetAutoExportRules',
    })
    if (response.success && response.rules) {
      setExportRules(response.rules)
    }
  }

  // 计算权重
  const calculateWeight = useCallback((ep: Episode) => {
    const now = Date.now()
    const ageDays = (now - ep.createdAt) / (1000 * 60 * 60 * 24)
    const unaccessedDays = (now - ep.lastAccessed) / (1000 * 60 * 60 * 24)
    let weight = 0.5 + 0.5 * Math.exp(-0.02 * ageDays) * Math.exp(-0.05 * unaccessedDays)
    if (ep.pinned) weight = Math.max(weight, 0.9)
    if (ep.isLongTerm) weight = Math.max(weight, 0.65)
    return weight
  }, [])

  // 展开/折叠
  const toggleBlock = (mainBlock: string) => {
    const newSet = new Set(expandedBlocks)
    if (newSet.has(mainBlock)) {
      newSet.delete(mainBlock)
    } else {
      newSet.add(mainBlock)
    }
    setExpandedBlocks(newSet)
  }

  const toggleSubBlock = (key: string) => {
    const newSet = new Set(expandedSubBlocks)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setExpandedSubBlocks(newSet)
  }

  // 选择处理
  const toggleSelectBlock = (mainBlock: string) => {
    const newSet = new Set(selectedBlocks)
    const block = blocks.find(b => b.mainBlock === mainBlock)
    if (!block) return

    if (newSet.has(mainBlock)) {
      // 取消选择大类及其所有小类
      newSet.delete(mainBlock)
      const newSubSet = new Set(selectedSubBlocks)
      for (const sub of block.subBlocks) {
        newSubSet.delete(`${mainBlock}/${sub.subBlock}`)
      }
      setSelectedSubBlocks(newSubSet)
    } else {
      // 选择大类及其所有小类
      newSet.add(mainBlock)
      const newSubSet = new Set(selectedSubBlocks)
      for (const sub of block.subBlocks) {
        newSubSet.add(`${mainBlock}/${sub.subBlock}`)
      }
      setSelectedSubBlocks(newSubSet)
    }
    setSelectedBlocks(newSet)
    setSelectAll(newSet.size === blocks.length)
  }

  const toggleSelectSubBlock = (mainBlock: string, subBlock: string) => {
    const key = `${mainBlock}/${subBlock}`
    const newSet = new Set(selectedSubBlocks)
    if (newSet.has(key)) {
      newSet.delete(key)
      // 如果大类被选中，取消选择
      const newBlockSet = new Set(selectedBlocks)
      newBlockSet.delete(mainBlock)
      setSelectedBlocks(newBlockSet)
    } else {
      newSet.add(key)
    }
    setSelectedSubBlocks(newSet)
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedBlocks(new Set())
      setSelectedSubBlocks(new Set())
    } else {
      const allBlocks = new Set(blocks.map(b => b.mainBlock))
      const allSubBlocks = new Set<string>()
      for (const block of blocks) {
        for (const sub of block.subBlocks) {
          allSubBlocks.add(`${block.mainBlock}/${sub.subBlock}`)
        }
      }
      setSelectedBlocks(allBlocks)
      setSelectedSubBlocks(allSubBlocks)
    }
    setSelectAll(!selectAll)
  }

  // 删除记忆
  const deleteEpisode = async (uid: string) => {
    if (!confirm('确定要删除这条记忆吗？')) return
    await sendToBackground({
      action: 'memoryDelete',
      uid,
    })
    await loadMemories()
  }

  // 删除大类（该板块下所有记忆）
  const deleteMainBlock = async (mainBlock: string) => {
    const block = blocks.find(b => b.mainBlock === mainBlock)
    const count = block ? block.subBlocks.reduce((s, sub) => s + sub.episodes.length, 0) : 0
    if (!confirm(`确定要删除大类「${mainBlock}」及其下全部 ${count} 条记忆吗？此操作不可恢复。`)) return
    const res = await sendToBackground<{ success: boolean; deleted?: number }>({
      action: 'memoryDeleteByMainBlock',
      mainBlock,
    })
    if (res.success) {
      await loadMemories()
      setSelectedBlocks(prev => { const n = new Set(prev); n.delete(mainBlock); return n })
      setSelectedSubBlocks(prev => {
        const n = new Set(prev)
        block?.subBlocks.forEach(sub => n.delete(`${mainBlock}/${sub.subBlock}`))
        return n
      })
    }
  }

  // 删除选中的大类
  const deleteSelectedMainBlocks = async () => {
    if (selectedBlocks.size === 0) {
      alert('请先勾选要删除的大类')
      return
    }
    const total = blocks
      .filter(b => selectedBlocks.has(b.mainBlock))
      .reduce((s, b) => s + b.subBlocks.reduce((s2, sub) => s2 + sub.episodes.length, 0), 0)
    if (!confirm(`确定要删除选中的 ${selectedBlocks.size} 个大类及其下全部 ${total} 条记忆吗？此操作不可恢复。`)) return
    for (const mainBlock of selectedBlocks) {
      await sendToBackground({ action: 'memoryDeleteByMainBlock', mainBlock })
    }
    await loadMemories()
    setSelectedBlocks(new Set())
    setSelectedSubBlocks(new Set())
    setSelectAll(false)
  }

  // 导出选中
  const exportSelected = async () => {
    const selectedEpisodes: Episode[] = []
    for (const block of blocks) {
      for (const sub of block.subBlocks) {
        const key = `${block.mainBlock}/${sub.subBlock}`
        if (selectedSubBlocks.has(key) || selectedBlocks.has(block.mainBlock)) {
          selectedEpisodes.push(...sub.episodes)
        }
      }
    }
    if (selectedEpisodes.length === 0) {
      alert('请先选择要导出的板块')
      return
    }
    const response = await sendToBackground<{ success: boolean; data?: string }>({
      action: 'memoryExportEpisodes',
      episodes: selectedEpisodes.map(e => e.uid),
    })
    if (response.success && response.data) {
      const blob = new Blob([response.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `madoka-memory-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // 导入记忆（与 Madoka-main 一致：解析 JSON 后写入 DB）
  const importMemories = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (event) => {
      const content = event.target?.result as string
      const res = await sendToBackground<{ success: boolean; added?: number; skipped?: number; error?: string }>({
        action: 'memoryImportEpisodes',
        data: content,
      })
      if (res.success && res.added !== undefined) {
        await loadMemories()
        alert(`导入完成：成功 ${res.added} 条，跳过 ${res.skipped ?? 0} 条`)
      } else {
        alert(res.error || '导入失败')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // 同步到 Obsidian（与 Madoka-main 一致：用句柄 + writeEpisodesToObsidianWithHandle）
  const syncToObsidian = async () => {
    const selectedEpisodes: Episode[] = []
    for (const block of blocks) {
      for (const sub of block.subBlocks) {
        const key = `${block.mainBlock}/${sub.subBlock}`
        if (selectedSubBlocks.has(key) || selectedBlocks.has(block.mainBlock)) {
          selectedEpisodes.push(...sub.episodes)
        }
      }
    }
    if (selectedEpisodes.length === 0) {
      alert('请先勾选要同步的板块或小类')
      return
    }
    const settingsRes = await sendToBackground<{ success: boolean; settings?: { rootDirHandle?: unknown } }>({
      action: 'memoryGetObsidianSettings',
    })
    if (!settingsRes.success || !settingsRes.settings?.rootDirHandle) {
      alert('请先在「记忆配置」中选择 Obsidian 库目录并保存')
      return
    }
    try {
      const { writeEpisodesToObsidianWithHandle } = await import('../../../background/obsidianSync')
      const result = await writeEpisodesToObsidianWithHandle(
        settingsRes.settings.rootDirHandle as FileSystemDirectoryHandle,
        selectedEpisodes
      )
      for (const entry of result.writtenEntries) {
        await sendToBackground({
          action: 'memoryUpdateEpisodeSyncStatus',
          uid: entry.uid,
          syncStatus: 'success',
          markdownPath: entry.markdownPath,
        })
      }
      await loadMemories()
      alert(`已同步到 Obsidian：成功 ${result.written} 条，失败 ${result.failed} 条`)
    } catch (err) {
      alert('同步失败：' + (err as Error).message)
    }
  }

  // 检查小类是否已存在
  const checkSubBlockDuplicate = (mainBlock: string, subBlock: string) => {
    for (const block of blocks) {
      if (block.mainBlock !== mainBlock) {
        for (const sub of block.subBlocks) {
          if (sub.subBlock === subBlock) {
            return block.mainBlock
          }
        }
      }
    }
    return null
  }

  // 获取选中的统计
  const selectionStats = useMemo(() => {
    let blockCount = 0
    let subBlockCount = 0
    let episodeCount = 0
    for (const block of blocks) {
      if (selectedBlocks.has(block.mainBlock)) {
        blockCount++
        subBlockCount += block.subBlocks.length
        episodeCount += block.subBlocks.reduce((sum, sub) => sum + sub.episodes.length, 0)
      } else {
        for (const sub of block.subBlocks) {
          const key = `${block.mainBlock}/${sub.subBlock}`
          if (selectedSubBlocks.has(key)) {
            subBlockCount++
            episodeCount += sub.episodes.length
          }
        }
      }
    }
    return { blockCount, subBlockCount, episodeCount }
  }, [blocks, selectedBlocks, selectedSubBlocks])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--bg-primary)]">
        <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mr-2" />
        <span className="text-[var(--text-muted)]">加载中...</span>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar bg-[var(--bg-primary)]">
      {/* 工具栏 */}
      <div className="flex flex-wrap gap-2">
        <button 
          className="px-3 py-2 bg-[var(--accent-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          onClick={exportSelected}
        >
          📤 导出选中
        </button>
        <button 
          className="px-3 py-2 bg-[var(--accent-danger)]/10 text-[var(--accent-danger)] text-sm font-medium rounded-lg border border-[var(--accent-danger)]/30 hover:bg-[var(--accent-danger)]/20 transition-colors"
          onClick={deleteSelectedMainBlocks}
          title="删除选中的大类及其下全部记忆"
        >
          🗑️ 删除选中大类
        </button>
        <label className="px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
          📥 导入记忆
          <input type="file" accept=".json" onChange={importMemories} className="hidden" />
        </label>
        <button 
          className="px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          onClick={syncToObsidian}
        >
          📝 同步到Obsidian
        </button>
        <button 
          className="px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          onClick={() => setShowExportSettings(true)}
        >
          ⚙️ 设置自动导出
        </button>
      </div>

      {/* 选择栏 */}
      <div className="flex items-center gap-4 p-2 bg-[var(--bg-secondary)] rounded-lg">
        <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
          <input
            type="checkbox"
            checked={selectAll}
            onChange={toggleSelectAll}
            className="w-4 h-4"
          />
          全选
        </label>
        <span className="text-xs text-[var(--text-muted)]">
          已选 {selectionStats.blockCount} 个大类, {selectionStats.subBlockCount} 个小类, {selectionStats.episodeCount} 条记忆
        </span>
      </div>

      {/* 无数据时的提示 */}
      {blocks.length === 0 && (
        <div className="p-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-sm text-[var(--text-muted)]">
          <p className="text-[var(--text-primary)] font-medium mb-1">暂无记忆</p>
          <p className="text-xs">请确认：1）「记忆配置」中已开启「启用记忆」；2）对话后模型会返回板块记忆与用户画像（可在浏览器扩展 Service Worker 控制台查看日志）。</p>
        </div>
      )}

      {/* 板块树 */}
      <div className="space-y-2">
        {blocks.map(block => {
          const isBlockSelected = selectedBlocks.has(block.mainBlock)
          const isExpanded = expandedBlocks.has(block.mainBlock)
          return (
            <div key={block.mainBlock} className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
              {/* 大类标题 */}
              <div className="flex items-center gap-2 p-3">
                <input
                  type="checkbox"
                  checked={isBlockSelected}
                  onChange={() => toggleSelectBlock(block.mainBlock)}
                  className="w-4 h-4"
                />
                <button
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  onClick={() => toggleBlock(block.mainBlock)}
                >
                  {isExpanded ? '📂' : '📁'}
                </button>
                <span className="font-medium text-[var(--text-primary)] flex-1">{block.mainBlock}</span>
                <span className="text-xs text-[var(--text-muted)]">({block.subBlocks.length} 小类)</span>
                <button
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-colors"
                  onClick={() => deleteMainBlock(block.mainBlock)}
                  title={`删除大类「${block.mainBlock}」`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                </button>
              </div>

              {/* 小类列表 */}
              {isExpanded && (
                <div className="pl-8 pr-3 pb-3 space-y-2">
                  {block.subBlocks.map(sub => {
                    const subKey = `${block.mainBlock}/${sub.subBlock}`
                    const isSubSelected = selectedSubBlocks.has(subKey)
                    const isSubExpanded = expandedSubBlocks.has(subKey)
                    const duplicateIn = checkSubBlockDuplicate(block.mainBlock, sub.subBlock)
                    return (
                      <div key={subKey} className="border-l-2 border-[var(--border-primary)] pl-3">
                        <div className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={isSubSelected}
                            onChange={() => toggleSelectSubBlock(block.mainBlock, sub.subBlock)}
                            className="w-4 h-4"
                          />
                          <button
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            onClick={() => toggleSubBlock(subKey)}
                          >
                            {isSubExpanded ? '📄' : '📃'}
                          </button>
                          <span className="text-sm text-[var(--text-primary)]">{sub.subBlock}</span>
                          <span className="text-xs text-[var(--text-muted)]">({sub.episodes.length} 条)</span>
                          {duplicateIn && (
                            <span className="text-xs text-[var(--accent-warning)]" title={`已存在于 ${duplicateIn}`}>
                              ⚠️
                            </span>
                          )}
                        </div>

                        {/* 记忆列表：全部展示，每条带删除小图标 */}
                        {isSubExpanded && (
                          <div className="pl-8 space-y-1 mt-1">
                            {sub.episodes.map(ep => (
                              <div key={ep.uid} className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg text-sm">
                                <span className="text-[var(--text-primary)] truncate flex-1">{ep.summary || ep.content.slice(0, 50)}...</span>
                                <span className="text-xs text-[var(--text-muted)] mx-2 shrink-0">权重: {calculateWeight(ep).toFixed(2)}</span>
                                <button
                                  className="p-1 shrink-0 text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-colors"
                                  title="删除"
                                  onClick={() => deleteEpisode(ep.uid)}
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 自动导出设置弹窗 */}
      {showExportSettings && (
        <AutoExportSettingsDialog
          selectedBlocks={selectedBlocks}
          selectedSubBlocks={selectedSubBlocks}
          blocks={blocks}
          onClose={() => setShowExportSettings(false)}
          onSave={async () => {
            await loadExportRules()
            setShowExportSettings(false)
          }}
        />
      )}
    </div>
  )
}

// 自动导出设置对话框
interface AutoExportSettingsDialogProps {
  selectedBlocks: Set<string>
  selectedSubBlocks: Set<string>
  blocks: BlockNode[]
  onClose: () => void
  onSave: () => void
}

const AutoExportSettingsDialog: React.FC<AutoExportSettingsDialogProps> = ({
  selectedBlocks,
  selectedSubBlocks,
  blocks,
  onClose,
  onSave,
}) => {
  const [triggerType, setTriggerType] = useState<AutoExportRule['triggerType']>('onClose')
  const [time, setTime] = useState('02:00')
  const [count, setCount] = useState(100)

  const handleSave = async () => {
    // 为选中的每个板块创建规则
    for (const block of blocks) {
      if (selectedBlocks.has(block.mainBlock)) {
        // 整个大类
        await sendToBackground({
          action: 'memoryAddAutoExportRule',
          rule: {
            id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            mainBlock: block.mainBlock,
            enabled: true,
            triggerType,
            triggerConfig: triggerType === 'scheduled' ? { time } : triggerType === 'threshold' ? { count } : undefined,
            lastExportedAt: 0,
          },
        })
      } else {
        // 特定小类
        for (const sub of block.subBlocks) {
          const key = `${block.mainBlock}/${sub.subBlock}`
          if (selectedSubBlocks.has(key)) {
            await sendToBackground({
              action: 'memoryAddAutoExportRule',
              rule: {
                id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
                mainBlock: block.mainBlock,
                subBlock: sub.subBlock,
                enabled: true,
                triggerType,
                triggerConfig: triggerType === 'scheduled' ? { time } : triggerType === 'threshold' ? { count } : undefined,
                lastExportedAt: 0,
              },
            })
          }
        }
      }
    }
    onSave()
  }

  const selectedCount = selectedBlocks.size + selectedSubBlocks.size

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-primary)] p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">设置自动导出</h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">将为选中的 {selectedCount} 个板块创建自动导出规则</p>
        <div className="space-y-3 mb-6">
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
        <div className="flex gap-2">
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