/**
 * MessageActionBar Component
 * Action buttons for AI messages (copy, regenerate, delete)
 */

import { useState, useCallback } from 'react'
import { useChatContext } from '../context/ChatContext'
import { useToast } from '../context/ToastContext'

interface MessageActionBarProps {
  messageId: string
  content: string
}

// Markdown 转纯文本
function markdownToPlainText(md: string): string {
  return md
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/`{3}[\s\S]*?`{3}/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function MessageActionBar({ messageId, content }: MessageActionBarProps) {
  const { deleteMessagePair, regenerateMessage, state } = useChatContext()
  const { showToast } = useToast()
  const [showCopyMenu, setShowCopyMenu] = useState(false)

  const isResponding = state.isResponding

  // 复制到剪贴板
  const copyToClipboard = useCallback(async (text: string, type: 'plain' | 'markdown') => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(type === 'plain' ? '已复制纯文本' : '已复制 Markdown', 'success')
    } catch (err) {
      showToast('复制失败', 'error')
    }
  }, [showToast])

  // 复制为纯文本
  const copyPlainText = useCallback(() => {
    const plainText = markdownToPlainText(content)
    copyToClipboard(plainText, 'plain')
    setShowCopyMenu(false)
  }, [content, copyToClipboard])

  // 复制为 Markdown
  const copyAsMarkdown = useCallback(() => {
    copyToClipboard(content, 'markdown')
    setShowCopyMenu(false)
  }, [content, copyToClipboard])

  // 重新生成
  const handleRegenerate = useCallback(() => {
    regenerateMessage(messageId)
  }, [regenerateMessage, messageId])

  // 删除消息（连同对应的用户消息）
  const handleDelete = useCallback(() => {
    deleteMessagePair(messageId)
    showToast('对话已删除', 'success')
  }, [deleteMessagePair, messageId, showToast])

  return (
    <div className="flex items-center gap-2 mt-2">
      {/* 复制按钮组 */}
      <div className="relative">
        <button
          className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors rounded hover:bg-[var(--bg-tertiary)]"
          type="button"
          onClick={() => setShowCopyMenu((prev) => !prev)}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>复制</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* 下拉菜单 */}
        {showCopyMenu && (
          <div className="absolute bottom-full left-0 mb-1 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-lg z-20 min-w-[120px]">
            <button
              onClick={copyPlainText}
              className="w-full px-3 py-1.5 text-xs text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              type="button"
            >
              复制纯文本
            </button>
            <button
              onClick={copyAsMarkdown}
              className="w-full px-3 py-1.5 text-xs text-left text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              type="button"
            >
              复制为 Markdown
            </button>
          </div>
        )}
      </div>

      {/* 重新生成按钮 */}
      <button
        onClick={handleRegenerate}
        disabled={isResponding}
        className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed"
        type="button"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>重新生成</span>
      </button>

      {/* 删除按钮 */}
      <button
        onClick={handleDelete}
        className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors rounded hover:bg-[var(--bg-tertiary)]"
        type="button"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span>删除</span>
      </button>
    </div>
  )
}
