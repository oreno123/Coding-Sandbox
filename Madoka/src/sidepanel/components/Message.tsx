/**
 * Message Component
 * Single message with Markdown rendering, search results, and GitHub repo cards
 * Enhanced with gradient backgrounds and improved visual hierarchy
 */

import { motion,AnimatePresence } from 'framer-motion'
import { marked } from 'marked'
import type { Message as MessageType, GitHubRepoItem } from '../../shared/types'
import { variants } from '../styles/animations'
import { ImageViewer } from './ImageViewer'
import { MessageActionBar } from './MessageAction'
import { useState } from 'react'
interface MessageProps {
  message: MessageType
}

export function Message({ message }: MessageProps) {
  const [viewingImage,setViewingImage] = useState<string | null>(null)
  const { role, content, images, searchResults, githubItems, isStreaming, resource_infos } = message
  
  const isUser = role === 'user'
  const isSystem = role === 'system'

  // Render Markdown content
  const renderContent = () => {
    if (!content && !images?.length) {
      return isStreaming ? (
        <span className="inline-block w-2 h-4 bg-current animate-pulse" />
      ) : null
    }

    if (isUser) {
      return (
        <div className="flex flex-col gap-2">
          {images && images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((dataUrl, i) => (
                <img
                  key={i}
                  src={dataUrl}
                  alt={`截图 ${i + 1}`}
                  onClick={() => setViewingImage(dataUrl)}
                  className="max-w-full max-h-48 rounded-lg border border-[var(--border-primary)] object-contain"
                />
              ))}
            </div>
          )}
          {content ? <p className="whitespace-pre-wrap">{content}</p> : null}
        </div>
      )
    }

    // AI and system messages use Markdown
    const html = marked.parse(content, { async: false }) as string
    return (
      <div
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <motion.div
      className={`flex flex-col gap-3 ${isUser ? 'items-end' : 'items-start'}`}
      variants={variants.message}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      {/* Search results sources */}
      {searchResults && searchResults.length > 0 && (
        <motion.div 
          className="w-full max-w-[95%] bg-[var(--bg-tertiary)] rounded-xl p-3 text-xs border border-[var(--border-primary)]"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="font-medium">Sources</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {searchResults.slice(0, 3).map((result, index) => (
              <a
                key={index}
                href={result.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-primary)] hover:text-[var(--accent-primary)] hover:underline truncate block transition-all duration-200"
              >
                <span className="inline-flex items-center justify-center w-4 h-4 mr-1.5 text-[10px] bg-[var(--bg-secondary)] rounded text-[var(--text-muted)]">
                  {index + 1}
                </span>
                {result.title}
              </a>
            ))}
          </div>
        </motion.div>
      )}

      {/* GitHub 找项目卡片 */}
      {githubItems && githubItems.length > 0 && (
        <div className="w-full max-w-[95%] flex flex-col gap-2">
          {githubItems.map((repo: GitHubRepoItem, index: number) => (
            <motion.a
              key={repo.html_url || index}
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block bg-[var(--bg-tertiary)] rounded-xl p-3 border border-[var(--border-primary)] hover:border-[var(--accent-primary)] hover:shadow-md transition-all duration-200 text-left"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <div className="font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors">{repo.full_name}</div>
              </div>
              {repo.description ? (
                <div className="text-xs text-[var(--text-secondary)] mt-1.5 line-clamp-2">{repo.description}</div>
              ) : null}
              <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                  </svg>
                  <span>{repo.stargazers_count?.toLocaleString()}</span>
                </span>
                {repo.language ? (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]"></span>
                    {repo.language}
                  </span>
                ) : null}
                {repo.updated_at ? (
                  <span>更新于 {new Date(repo.updated_at).toLocaleDateString()}</span>
                ) : null}
              </div>
            </motion.a>
          ))}
        </div>
      )}

      {/* Message content */}
      <motion.div
        className={`
          ${isUser
            ? 'max-w-[85%] message-user rounded-br-md'
            : isSystem
              ? 'max-w-[85%] message-system rounded-lg'
              : 'w-full message-assistant rounded-bl-md'
          }
          min-w-0 rounded-2xl px-4 py-3 text-sm relative overflow-hidden
          ${isStreaming ? 'min-h-[2.5rem]' : ''}
        `}
        onClick={(e) => e.stopPropagation()}
        whileHover={{ scale: 1.005 }}
        transition={{ duration: 0.2 }}
      >
        {/* Background gradient overlay */}
        <div className="message-bg absolute inset-0 -z-10" />

        {renderContent()}

        {/* Streaming cursor */}
        {isStreaming && content && (
          <motion.span
            className="inline-block w-0.5 h-4 bg-current ml-0.5 align-middle"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* 功能栏 - 只在 AI 消息且非流式状态下显示 */}
      {!isUser && !isSystem && !isStreaming && (
        <MessageActionBar messageId={message.id} content={content} />
      )}

      {/* 用户消息的引用标签 */}
      {isUser && resource_infos && resource_infos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-end max-w-[85%]">
          {resource_infos.map((ref) => (
            <a
              key={ref.id}
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-full text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
              title={ref.file_name}
            >
              {ref.favicon ? (
                <img src={ref.favicon} alt="" className="w-3 h-3 rounded" />
              ) : (
                <span>📎</span>
              )}
              <span className="max-w-[100px] truncate">{ref.file_name}</span>
            </a>
          ))}
        </div>
      )}
      {/*image*/}
      <AnimatePresence>
        {viewingImage && (
         <ImageViewer
        imageUrl={viewingImage}
        onClose={() => setViewingImage(null)}
         />
       )}
     </AnimatePresence>
    </motion.div>
  )
}
