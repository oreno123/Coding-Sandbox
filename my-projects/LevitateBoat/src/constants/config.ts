// 配置常量
export const DB_NAME = 'levitate_boat_db'
export const DB_VERSION = 31

export const STORES = {
  MEMORIES: 'memories',
  TAGS: 'tags',
  MEMORY_TAG: 'memory_tag',
  USER_PROFILE: 'user_profile',
  QUERY_CACHE: 'query_cache',
  SEARCH_INDEX: 'search_index',
  CONVERSATIONS: 'conversations',
  ARCHIVED_MEMORIES: 'archived_memories'
} as const

export const INDEXES = {
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  ACCESSED_AT: 'accessedAt',
  DOMAIN: 'domain',
  TAGS: 'tags',
  MEMORY_STRENGTH: 'memoryStrength',
  MEMORY_TYPE: 'type'
} as const

export const CACHE_TTL = 5 * 60 * 1000 // 5分钟
export const DEFAULT_PAGE_SIZE = 20
export const MAX_CACHE_SIZE = 100
export const DEFAULT_TOP_K = 10
export const MAX_CONTEXT_TOKENS = 4000
export const MEMORY_STRENGTH_THRESHOLD = 0.2 // 低于此值归档
