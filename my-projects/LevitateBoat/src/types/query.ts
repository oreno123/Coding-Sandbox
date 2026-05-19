import type { MemoryItem } from './memory'

export interface QueryOptions {
  type?: 'exact' | 'fuzzy' | 'tag' | 'time' | 'semantic'
  tags?: string[]
  timeRange?: { start: Date; end: Date }
  limit?: number
  offset?: number
  sortBy?: 'relevance' | 'time' | 'access'
}

export interface SearchResult {
  items: MemoryItem[]
  total: number
  query: string
  took: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
