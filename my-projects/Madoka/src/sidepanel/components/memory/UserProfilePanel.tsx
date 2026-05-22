/**
 * 用户画像页面组件
 * 表格形式展示标签，支持增删改、导入导出
 */

import React, { useState, useEffect, useCallback } from 'react'
import { sendToBackground } from '../../../shared/messaging'
import type { ProfileColumn, ProfileTag } from '../../../shared/memory-types'

// 默认7个栏配置
const DEFAULT_COLUMNS: ProfileColumn[] = [
  { id: 'basicInfo', name: '基本信息', maxTags: 25, order: 1, isDefault: true },
  { id: 'learning', name: '正在学什么', maxTags: 25, order: 2, isDefault: true },
  { id: 'doing', name: '正在做什么', maxTags: 25, order: 3, isDefault: true },
  { id: 'likes', name: '喜欢什么', maxTags: 25, order: 4, isDefault: true },
  { id: 'dislikes', name: '不喜欢什么', maxTags: 25, order: 5, isDefault: true },
  { id: 'style', name: '喜欢的风格', maxTags: 25, order: 6, isDefault: true },
  { id: 'preferences', name: '需求与偏好', maxTags: 25, order: 7, isDefault: true },
]

export const UserProfilePanel: React.FC = () => {
  const [columns, setColumns] = useState<ProfileColumn[]>(DEFAULT_COLUMNS)
  const [tags, setTags] = useState<ProfileTag[]>([])
  const [loading, setLoading] = useState(true)

  // 编辑状态
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [editingTag, setEditingTag] = useState<{ columnId: string } | null>(null)
  const [newTagValue, setNewTagValue] = useState('')

  // 确认弹窗
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'tag' | 'column' | 'clear'; id: string; name: string } | null>(null)

  // 查重弹窗
  const [showDedupModal, setShowDedupModal] = useState(false)
  const [dedupGroups, setDedupGroups] = useState<{ tags: ProfileTag[] }[]>([])
  const [dedupLoading, setDedupLoading] = useState(false)

  // 加载数据
  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    const response = await sendToBackground<{ success: boolean; profile?: { columns: ProfileColumn[]; tags: ProfileTag[] } }>({
      action: 'memoryGetUserProfileV2',
    })
    if (response.success && response.profile) {
      // 合并默认栏和用户自定义栏，确保7个默认栏始终显示
      const loadedColumns = response.profile.columns
      const defaultIds = DEFAULT_COLUMNS.map(c => c.id)
      
      // 保留加载的默认栏（保持用户顺序）
      const loadedDefaultCols = loadedColumns.filter(c => defaultIds.includes(c.id))
      // 保留用户自定义栏
      const customCols = loadedColumns.filter(c => !defaultIds.includes(c.id))
      // 找出缺失的默认栏
      const loadedDefaultIds = loadedDefaultCols.map(c => c.id)
      const missingDefaultCols = DEFAULT_COLUMNS.filter(c => !loadedDefaultIds.includes(c.id))
      
      // 合并：加载的默认栏 + 缺失的默认栏 + 自定义栏
      setColumns([...loadedDefaultCols, ...missingDefaultCols, ...customCols])
      setTags(response.profile.tags)
    }
    setLoading(false)
  }

  // 获取标签颜色
  const getTagColor = useCallback((tagId: string) => {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
      '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
    ]
    const hash = tagId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }, [])

  // 添加栏
  const addColumn = async () => {
    if (!newColumnName.trim()) return
    const maxOrder = Math.max(...columns.map(c => c.order), 0)
    const newColumn: ProfileColumn = {
      id: `col-${Date.now()}`,
      name: newColumnName.trim(),
      maxTags: 25,
      order: maxOrder + 1,
      isDefault: false,
    }
    await sendToBackground({
      action: 'memoryAddColumn',
      column: newColumn,
    })
    setAddingColumn(false)
    setNewColumnName('')
    // 直接更新前端状态，无需重新加载
    setColumns(prev => [...prev, newColumn])
  }

  // 删除栏
  const deleteColumn = async (columnId: string) => {
    await sendToBackground({
      action: 'memoryDeleteColumn',
      columnId,
    })
    setConfirmDelete(null)
    // 直接更新前端状态
    setColumns(prev => prev.filter(c => c.id !== columnId))
    // 同时删除该栏下的所有标签
    setTags(prev => prev.filter(t => t.columnId !== columnId))
  }

  // 添加标签
  const addTag = async (columnId: string) => {
    if (!newTagValue.trim()) return
    const column = columns.find(c => c.id === columnId)
    if (!column) return
    const columnTags = tags.filter(t => t.columnId === columnId)
    if (columnTags.length >= column.maxTags) {
      alert(`该栏最多只能有 ${column.maxTags} 个标签`)
      return
    }
    const newTag: ProfileTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      value: newTagValue.trim(),
      columnId,
      source: 'manual',
      locked: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await sendToBackground({
      action: 'memoryAddTag',
      tag: newTag,
    })
    setEditingTag(null)
    setNewTagValue('')
    // 直接更新前端状态
    setTags(prev => [...prev, newTag])
  }

  // 删除标签
  const deleteTag = async (tagId: string) => {
    await sendToBackground({
      action: 'memoryDeleteTag',
      tagId,
    })
    setConfirmDelete(null)
    // 直接更新前端状态
    setTags(prev => prev.filter(t => t.id !== tagId))
  }

  // 清空栏
  const clearColumn = async (columnId: string) => {
    await sendToBackground({
      action: 'memoryClearColumnTags',
      columnId,
    })
    setConfirmDelete(null)
    // 直接更新前端状态
    setTags(prev => prev.filter(t => t.columnId !== columnId))
  }

  // 导出画像
  const exportProfile = async () => {
    const response = await sendToBackground<{ success: boolean; data?: string }>({
      action: 'memoryExportUserProfile',
    })
    if (response.success && response.data) {
      const blob = new Blob([response.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `madoka-profile-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // 导入画像
  const importProfile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (event) => {
      const content = event.target?.result as string
      const response = await sendToBackground<{ success: boolean; result?: { added: number; updated: number; conflicts: number } }>({
        action: 'memoryImportUserProfile',
        data: content,
      })
      if (response.success && response.result) {
        const { added, updated, conflicts } = response.result
        alert(`导入完成：新增 ${added} 条，更新 ${updated} 条，冲突 ${conflicts} 条`)
        await loadProfile()
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // 重置所有
  const resetAll = async () => {
    if (!confirm('确定要重置所有用户画像吗？此操作不可恢复。')) return
    await sendToBackground({ action: 'memoryResetUserProfile' })
    await loadProfile()
  }

  // 查重：查找重叠/重复标签
  const openDedupModal = async () => {
    setDedupLoading(true)
    setShowDedupModal(true)
    const res = await sendToBackground<{ success: boolean; groups?: { tags: ProfileTag[] }[] }>({
      action: 'memoryFindDuplicateTags',
    })
    if (res.success && res.groups) {
      setDedupGroups(res.groups)
    } else {
      setDedupGroups([])
    }
    setDedupLoading(false)
  }

  // 在查重弹窗中删除选中的重复标签
  const deleteTagFromDedup = async (tagId: string) => {
    await sendToBackground({ action: 'memoryDeleteTag', tagId })
    setTags(prev => prev.filter(t => t.id !== tagId))
    setDedupGroups(prev =>
      prev.map(g => ({ tags: g.tags.filter(t => t.id !== tagId) })).filter(g => g.tags.length > 1)
    )
  }

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
      <div className="flex gap-2 flex-wrap">
        <button 
          className="px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          onClick={exportProfile}
        >
          📤 导出画像
        </button>
        <label className="px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
          📥 导入画像
          <input type="file" accept=".json" onChange={importProfile} className="hidden" />
        </label>
        <button 
          className="px-3 py-2 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-sm font-medium rounded-lg hover:bg-[var(--accent-primary)]/20 transition-colors"
          onClick={openDedupModal}
          title="查找重复或重叠的标签"
        >
          🔍 查重
        </button>
        <button 
          className="px-3 py-2 bg-[var(--accent-danger)]/10 text-[var(--accent-danger)] text-sm font-medium rounded-lg hover:bg-[var(--accent-danger)]/20 transition-colors"
          onClick={resetAll}
        >
          🗑️ 重置所有
        </button>
      </div>

      {/* 添加栏按钮 */}
      <div className="mb-4">
        {addingColumn ? (
          <div className="flex gap-2">
            <input
              value={newColumnName}
              onChange={e => setNewColumnName(e.target.value)}
              placeholder="栏名称"
              onKeyDown={e => e.key === 'Enter' && addColumn()}
              autoFocus
              className="flex-1 px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
            />
            <button 
              onClick={addColumn}
              className="px-3 py-2 bg-[var(--accent-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              添加
            </button>
            <button 
              onClick={() => { setAddingColumn(false); setNewColumnName('') }}
              className="px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              取消
            </button>
          </div>
        ) : (
          <button 
            className="w-full py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => setAddingColumn(true)}
          >
            + 添加栏
          </button>
        )}
      </div>

      {/* 栏表格 */}
      <div className="space-y-4">
        {columns.sort((a, b) => a.order - b.order).map(column => {
          const columnTags = tags.filter(t => t.columnId === column.id)
          return (
            <div key={column.id} className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
              {/* 栏标题 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--text-primary)]">{column.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{columnTags.length}/{column.maxTags}</span>
                </div>
                <div className="flex gap-1">
                  {!column.isDefault && (
                    <button
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-danger)] hover:bg-[var(--bg-hover)] rounded transition-colors"
                      onClick={() => setConfirmDelete({ type: 'column', id: column.id, name: column.name })}
                      title="删除栏"
                    >
                      🗑️
                    </button>
                  )}
                  <button
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded transition-colors"
                    onClick={() => setConfirmDelete({ type: 'clear', id: column.id, name: column.name })}
                    title="清空本栏"
                  >
                    🧹
                  </button>
                </div>
              </div>

              {/* 标签区域 */}
              <div className="flex flex-wrap gap-2 mb-2">
                {columnTags.map(tag => (
                  <div
                    key={tag.id}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm text-white ${tag.conflictWith?.length ? 'ring-2 ring-[var(--accent-danger)]' : ''}`}
                    style={{ backgroundColor: getTagColor(tag.id) }}
                    title={tag.conflictWith?.length ? `冲突: ${tag.conflictWith.join(', ')}` : ''}
                  >
                    <span>{tag.value}</span>
                    {tag.locked && <span className="text-xs opacity-75">🔒</span>}
                    <button
                      className="ml-1 text-white/75 hover:text-white"
                      onClick={() => setConfirmDelete({ type: 'tag', id: tag.id, name: tag.value })}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* 添加标签输入框 */}
                {editingTag?.columnId === column.id ? (
                  <div className="flex gap-1">
                    <input
                      value={newTagValue}
                      onChange={e => setNewTagValue(e.target.value)}
                      placeholder="新标签"
                      onKeyDown={e => {
                        if (e.key === 'Enter') addTag(column.id)
                        if (e.key === 'Escape') { setEditingTag(null); setNewTagValue('') }
                      }}
                      autoFocus
                      className="px-2 py-1 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded outline-none focus:border-[var(--border-focus)] w-24"
                    />
                    <button 
                      onClick={() => addTag(column.id)}
                      className="px-2 py-1 bg-[var(--accent-primary)] text-white text-xs rounded-lg hover:opacity-90"
                    >
                      添加
                    </button>
                  </div>
                ) : (
                  <button
                    className="px-3 py-1 rounded-full text-sm border border-dashed border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-colors"
                    onClick={() => setEditingTag({ columnId: column.id })}
                  >
                    + 添加标签
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 确认删除弹窗 */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-primary)] p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              确认{confirmDelete.type === 'clear' ? '清空' : '删除'}?
            </h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              {confirmDelete.type === 'tag' && `确定要删除标签"${confirmDelete.name}"吗？`}
              {confirmDelete.type === 'column' && `确定要删除栏"${confirmDelete.name}"吗？栏内所有标签都将被删除。`}
              {confirmDelete.type === 'clear' && `确定要清空栏"${confirmDelete.name}"内的所有标签吗？`}
            </p>
            <div className="flex gap-2">
              <button 
                className="flex-1 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => setConfirmDelete(null)}
              >
                取消
              </button>
              <button 
                className="flex-1 py-2 bg-[var(--accent-danger)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                onClick={() => {
                  if (confirmDelete.type === 'tag') deleteTag(confirmDelete.id)
                  else if (confirmDelete.type === 'column') deleteColumn(confirmDelete.id)
                  else if (confirmDelete.type === 'clear') clearColumn(confirmDelete.id)
                }}
              >
                确认{confirmDelete.type === 'clear' ? '清空' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 查重弹窗 */}
      {showDedupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-primary)] p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">查重：重复或重叠标签</h3>
              <button
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => setShowDedupModal(false)}
              >
                ×
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              以下为同栏内内容相同或相互包含的标签组，建议保留其一、删除其余。
            </p>
            {dedupLoading ? (
              <div className="flex items-center gap-2 py-8 text-[var(--text-muted)]">
                <span className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                查找中...
              </div>
            ) : dedupGroups.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4">暂无重复标签</p>
            ) : (
              <div className="space-y-4">
                {dedupGroups.map((group, idx) => (
                  <div key={idx} className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
                    <div className="flex flex-wrap gap-2">
                      {group.tags.map(tag => (
                          <div
                            key={tag.id}
                            className="flex items-center gap-1 px-3 py-1 rounded-full text-sm text-white"
                            style={{ backgroundColor: getTagColor(tag.id) }}
                          >
                            <span>{tag.value}</span>
                            {tag.locked && <span className="text-xs opacity-75">🔒</span>}
                            <button
                              className="ml-1 text-white/75 hover:text-white"
                              onClick={() => {
                                if (confirm(`确定删除标签"${tag.value}"？`)) deleteTagFromDedup(tag.id)
                              }}
                              title="删除此标签"
                            >
                              ×
                            </button>
                          </div>
                      ))}
                    </div>
                    {group.tags[0] && (
                      <p className="text-xs text-[var(--text-muted)] mt-2">
                        栏：{columns.find(c => c.id === group.tags[0].columnId)?.name ?? group.tags[0].columnId}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              className="mt-4 w-full py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              onClick={() => setShowDedupModal(false)}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}