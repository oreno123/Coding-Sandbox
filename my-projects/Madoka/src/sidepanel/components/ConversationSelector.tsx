/**
 * ConversationSelector Component
 * Dropdown selector for conversations with date grouping
 */

import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatContext, type Conversation } from '../context/ChatContext'
import { useToast } from '../context/ToastContext'

interface ConversationSelectorProps {
  isOpen: boolean
  onClose: () => void
}

export function ConversationSelector({ isOpen, onClose }: ConversationSelectorProps) {
  const { state, switchConversation, deleteConversation, createNewConversation } = useChatContext()
  const { showToast } = useToast()
  const { conversations, activeConversationId } = state
  const selectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayTime = yesterday.getTime()

  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 7)
  const lastWeekTime = lastWeek.getTime()

  const groupedConversations = {
    today: [] as Conversation[],
    yesterday: [] as Conversation[],
    lastWeek: [] as Conversation[],
    older: [] as Conversation[],
  }

  conversations.forEach(conv => {
    if (conv.updatedAt >= todayTime) {
      groupedConversations.today.push(conv)
    } else if (conv.updatedAt >= yesterdayTime) {
      groupedConversations.yesterday.push(conv)
    } else if (conv.updatedAt >= lastWeekTime) {
      groupedConversations.lastWeek.push(conv)
    } else {
      groupedConversations.older.push(conv)
    }
  })

  const handleSelect = (id: string) => {
    switchConversation(id)
    onClose()
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteConversation(id)
  }

  const handleNewConversation = () => {
    createNewConversation()
    showToast('新对话已创建', 'success')
    onClose()
  }

  const renderGroup = (title: string, convs: Conversation[]) => {
    if (convs.length === 0) return null

    return (
      <div key={title} className="conversation-selector-group">
        <div className="conversation-selector-group-title">{title}</div>
        {convs.map(conv => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isActive={conv.id === activeConversationId}
            onSelect={() => handleSelect(conv.id)}
            onDelete={(e) => handleDelete(e, conv.id)}
          />
        ))}
      </div>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={selectorRef}
          className="conversation-selector"
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <div className="conversation-selector-header">
            <span className="conversation-selector-title">对话列表</span>
            <button
              className="conversation-selector-new-btn"
              onClick={handleNewConversation}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新对话
            </button>
          </div>

          <div className="conversation-selector-list">
            {renderGroup('今天', groupedConversations.today)}
            {renderGroup('昨天', groupedConversations.yesterday)}
            {renderGroup('过去7天', groupedConversations.lastWeek)}
            {renderGroup('更早', groupedConversations.older)}

            {conversations.length === 0 && (
              <div className="conversation-selector-empty">
                暂无对话
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
}

function ConversationItem({ conversation, isActive, onSelect, onDelete }: ConversationItemProps) {
  return (
    <motion.div
      className={`conversation-selector-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      whileHover={{ backgroundColor: 'var(--bg-hover)' }}
    >
      <div className="conversation-selector-item-content">
        <span className="conversation-selector-item-title">{conversation.title}</span>
        <span className="conversation-selector-item-time">
          {formatTime(conversation.updatedAt)}
        </span>
      </div>
      <button
        className="conversation-selector-item-delete"
        onClick={onDelete}
        title="删除对话"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </motion.div>
  )
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`

  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')

  if (diff < 172800000) return `昨天 ${hour}:${minute}`

  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${month}/${day} ${hour}:${minute}`
}
