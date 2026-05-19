// 记忆类型
export type MemoryType = 'fact' | 'preference' | 'event'

// 遗忘曲线参数
export interface ForgettingParams {
  interval: number      // 复习间隔（天）
  easeFactor: number
  repetitions: number
  lastReviewAt: number
}

// 记忆项数据结构（扩展版）
export interface MemoryItem {
  id: string
  content: string
  title?: string
  summary?: string
  tags: string[]
  type: MemoryType
  url: string
  domain: string
  /** 归属的对话 id，空表示旧数据/全局 */
  conversationId?: string
  embedding?: number[]
  memoryStrength: number
  forgettingParams?: ForgettingParams
  createdAt: number
  updatedAt: number
  accessedAt: number
  accessCount: number
  source?: 'conversation' | 'page' | 'manual'
  metadata?: {
    selection?: string
    position?: { x: number; y: number }
    [key: string]: unknown
  }
}

export interface TagItem {
  id: string
  count: number
  lastUsed: number
  color?: string
}

export interface ExportData {
  version: string
  memories: MemoryItem[]
  tags: TagItem[]
  profile?: unknown
  exportedAt: number
}

export interface StorageStats {
  totalMemories: number
  totalSize: number
  usedSpace: number
  availableSpace: number
}
