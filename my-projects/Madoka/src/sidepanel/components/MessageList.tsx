/**
 * MessageList Component
 * Container for messages with smart auto-scroll
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatContext } from '../context/ChatContext'
import { Message } from './Message'
import { staggerContainer } from '../styles/animations'

export function MessageList() {
  const { messages } = useChatContext()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const isUserScrolling = useRef(false)
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null)

  // Check if user is near bottom (within threshold)
  const isNearBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return true
    const threshold = 100 // pixels from bottom
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return distanceFromBottom < threshold
  }, [])

  // Handle scroll event
  const handleScroll = useCallback(() => {
    // Mark that user is actively scrolling
    isUserScrolling.current = true

    // Clear existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current)
    }

    // Check if near bottom
    const nearBottom = isNearBottom()
    setIsAtBottom(nearBottom)
    setShowScrollButton(!nearBottom && messages.length > 0)

    // Reset user scrolling flag after a delay
    scrollTimeout.current = setTimeout(() => {
      isUserScrolling.current = false
    }, 150)
  }, [isNearBottom, messages.length])

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      })
      setIsAtBottom(true)
      setShowScrollButton(false)
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive (only if user is at bottom)
  useEffect(() => {
    if (containerRef.current && isAtBottom) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    } else if (!isAtBottom && messages.length > 0) {
      // User is not at bottom, show scroll button
      setShowScrollButton(true)
    }
  }, [messages, isAtBottom])

  // Add scroll event listener
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current)
      }
    }
  }, [handleScroll])

  // Initial scroll to bottom when component mounts
  useEffect(() => {
    if (containerRef.current && messages.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [])

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto px-4 py-4 hide-scrollbar show-scrollbar-on-hover"
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key="messages"
            className="flex flex-col gap-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 w-10 h-10 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
            title="回到底部"
            type="button"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
