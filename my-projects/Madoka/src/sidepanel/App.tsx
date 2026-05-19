/**
 * Madoka App
 * AI-powered browser assistant
 */

import { useState } from 'react'
import { ChatProvider, useChatContext } from './context/ChatContext'
import { ToastProvider } from './context/ToastContext'
import { useSettings } from './hooks/useSettings'
import { MessageList } from './components/MessageList'
import { Composer } from './components/composer'
import { SettingsPanel } from './components/SettingsPanel'
import { LinkSummaryPanel } from './components/LinkSummaryPanel'
import { MemoryOverview } from './components/MemoryOverview'
import { ApiKeySetup } from './components/ApiKeySetup'
import { ConversationSelector } from './components/ConversationSelector'
import { motion } from 'framer-motion'
import { MadokaIcon } from './components/common/MadokaIcon'

function MainContent() {
  const {
    state,
    messages,
    setView,
  } = useChatContext()
  const { view, isResponding, linkSummary } = state
  const [conversationSelectorOpen, setConversationSelectorOpen] = useState(false)

  // Show link summary panel
  if (view === 'linkSummary' && linkSummary) {
    return (
      <motion.div
        className="flex-1 flex flex-col h-full bg-[var(--bg-primary)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <LinkSummaryPanel linkSummary={linkSummary} />
      </motion.div>
    )
  }

  // Show settings panel
  if (view === 'settings') {
    return (
      <motion.div
        className="flex-1 flex flex-col h-full bg-[var(--bg-primary)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <SettingsPanel />
      </motion.div>
    )
  }

  // Show memory overview
  if (view === 'memory') {
    return (
      <motion.div
        className="flex-1 flex flex-col h-full bg-[var(--bg-primary)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <MemoryOverview />
      </motion.div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-gradient-to-b from-[var(--bg-secondary)]/10 via-[var(--bg-primary)] to-[var(--bg-primary)]">
      {/* Header - Logo left, actions + status right */}
      <header className="flex items-center px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 shrink-0 flex-col overflow-hidden rounded-lg ring-1 ring-[var(--border-primary)]/25">
            <span className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-px">
              <MadokaIcon
                variant="toolbar"
                className="max-h-full max-w-full object-contain object-center"
              />
            </span>
          </span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Madoka</span>
        </div>

        {/* 右上：对话列表、设置 */}
        <div className="flex items-center gap-1 ml-auto">
          <div className="conversation-selector-wrapper">
            <button
              className="composer-tool-btn"
              onClick={() => setConversationSelectorOpen(!conversationSelectorOpen)}
              title="对话列表"
              type="button"
            >
              <ChatListIcon />
            </button>
            <ConversationSelector
              isOpen={conversationSelectorOpen}
              onClose={() => setConversationSelectorOpen(false)}
            />
          </div>
          <button
            className="composer-tool-btn"
            onClick={() => setView('settings')}
            title="设置"
            type="button"
          >
            <SettingsIcon />
          </button>
          {isResponding && (
            <div className="flex items-center gap-1.5 ml-2 text-xs text-[var(--text-muted)]">
              <span className="w-1.5 h-1.5 bg-[var(--accent-success)] rounded-full animate-pulse" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </header>

      {/* Main chat area */}
      <main className="flex-1 overflow-hidden flex flex-col container-chat">
        <div className="chat-area">
          <div className="flex-1 overflow-hidden">
            {messages.length === 0 ? (
              <ChatWelcome />
            ) : (
              <MessageList />
            )}
          </div>
          <Composer />
        </div>
      </main>
    </div>
  )
}

function ChatWelcome() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center px-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Logo */}
      <motion.div
        className="mb-5 flex h-11 w-11 flex-col overflow-hidden rounded-2xl p-1 shadow-lg ring-1 ring-[var(--border-primary)]/20 box-border [transform-origin:center]"
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
          <MadokaIcon
            variant="hero"
            imgSizes="44px"
            className="max-h-full max-w-full object-contain object-center"
          />
        </div>
      </motion.div>

      {/* Title */}
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        How can I help you?
      </h2>

      {/* Description */}
      <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-sm">
        Ask anything. Type <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-xs">@</kbd> to reference tabs, bookmarks, or history.
      </p>

    </motion.div>
  )
}

function AppContent() {
  const { config, loading } = useSettings()

  // Wait for config to load
  if (loading) {
    return (
      <div className="flex h-screen bg-[var(--bg-primary)] overflow-hidden items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    )
  }

  // First time setup - no API Key configured
  if (!config.apiKey) {
    return (
      <div className="flex h-screen bg-[var(--bg-primary)] overflow-hidden">
        <ApiKeySetup />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] overflow-hidden">
      {/* Main Content */}
      <MainContent />
    </div>
  )
}

function ChatListIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

export default function App() {
  return (
    <ChatProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ChatProvider>
  )
}
