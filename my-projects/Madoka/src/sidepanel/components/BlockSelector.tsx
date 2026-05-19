/**
 * 板块选择组件
 * 支持多选记忆板块，用于筛选和过滤记忆
 */

import { useState, useEffect, useCallback } from 'react'
import { sendToBackground } from '../../shared/messaging'

interface BlockSelectorProps {
  selectedBlocks: string[]
  onChange: (blocks: string[]) => void
}

export function BlockSelector({ selectedBlocks, onChange }: BlockSelectorProps) {
  const [blocks, setBlocks] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBlocks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await sendToBackground<{ success: boolean; blocks?: string[]; error?: string }>({
        action: 'memoryGetBlockList'
      })
      if (res.success && res.blocks) {
        setBlocks(res.blocks)
      } else {
        setBlocks([])
        if (res.error) setError(res.error)
      }
    } catch (e) {
      setError((e as Error).message)
      setBlocks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBlocks()
  }, [loadBlocks])

  const handleToggleBlock = (block: string) => {
    if (selectedBlocks.includes(block)) {
      onChange(selectedBlocks.filter(b => b !== block))
    } else {
      onChange([...selectedBlocks, block])
    }
  }

  const handleClearAll = () => {
    onChange([])
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[var(--text-muted)]">加载板块...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-[var(--accent-danger)] py-2">
        加载失败: {error}
      </div>
    )
  }

  if (blocks.length === 0) {
    return (
      <div className="text-sm text-[var(--text-muted)] py-2">
        暂无板块数据
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)]">
          本次导入: 已选择 {selectedBlocks.length} 个板块
        </span>
        {selectedBlocks.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-danger)] transition-colors"
          >
            清除选择
          </button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {blocks.map((block) => {
          const isSelected = selectedBlocks.includes(block)
          return (
            <button
              key={block}
              type="button"
              onClick={() => handleToggleBlock(block)}
              className={`
                text-xs px-3 py-1.5 rounded-full transition-colors
                ${isSelected 
                  ? 'bg-[var(--accent-primary)] text-white' 
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }
              `}
              title={isSelected ? '点击取消选择' : '点击选择'}
            >
              {block}
            </button>
          )
        })}
      </div>
    </div>
  )
}
