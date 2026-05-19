import Dexie, { type Table } from 'dexie'
import type { MemoryItem, TagItem, UserProfile } from '@/types'
import { DB_NAME, DB_VERSION, STORES } from '@/constants/config'

interface CachedQuery {
  id: string
  queryHash: string
  results: MemoryItem[]
  expiresAt: number
}

interface SearchIndexEntry {
  word: string
  memoryIds: string[]
}

interface MemoryTagRelation {
  memoryId: string
  tagId: string
}

interface ConversationRecord {
  id: string
  messages: { role: string; content: string; timestamp: number }[]
  memoryIds: string[]
  /** 用户新建时填的话题，作为标题 */
  title?: string
  /** 该对话偏好的回复风格 */
  preferredStyle?: string
  createdAt: number
  updatedAt: number
}

export class LevitateBoatDB extends Dexie {
  memories!: Table<MemoryItem>
  tags!: Table<TagItem>
  memoryTag!: Table<MemoryTagRelation>
  userProfile!: Table<UserProfile>
  queryCache!: Table<CachedQuery>
  searchIndex!: Table<SearchIndexEntry>
  archivedMemories!: Table<MemoryItem>
  conversations!: Table<ConversationRecord>

  constructor() {
    super(DB_NAME)
    this.version(2).stores({
      [STORES.MEMORIES]: 'id, createdAt, updatedAt, accessedAt, domain, type, memoryStrength',
      [STORES.TAGS]: 'id, lastUsed, count',
      [STORES.MEMORY_TAG]: '[memoryId+tagId], memoryId, tagId',
      [STORES.USER_PROFILE]: 'id',
      [STORES.QUERY_CACHE]: 'id, queryHash, expiresAt',
      [STORES.SEARCH_INDEX]: 'word',
      [STORES.ARCHIVED_MEMORIES]: 'id, createdAt',
      [STORES.CONVERSATIONS]: 'id, createdAt'
    })
    this.version(3).stores({
      [STORES.MEMORIES]: 'id, createdAt, updatedAt, accessedAt, domain, type, memoryStrength',
      [STORES.TAGS]: 'id, lastUsed, count',
      [STORES.MEMORY_TAG]: '[memoryId+tagId], memoryId, tagId',
      [STORES.USER_PROFILE]: 'id',
      [STORES.QUERY_CACHE]: 'id, queryHash, expiresAt',
      [STORES.SEARCH_INDEX]: 'word',
      [STORES.ARCHIVED_MEMORIES]: 'id, createdAt',
      [STORES.CONVERSATIONS]: 'id, createdAt, updatedAt'
    })
    // 与已有 DB 版本对齐
    this.version(30).stores({
      [STORES.MEMORIES]: 'id, createdAt, updatedAt, accessedAt, domain, type, memoryStrength',
      [STORES.TAGS]: 'id, lastUsed, count',
      [STORES.MEMORY_TAG]: '[memoryId+tagId], memoryId, tagId',
      [STORES.USER_PROFILE]: 'id',
      [STORES.QUERY_CACHE]: 'id, queryHash, expiresAt',
      [STORES.SEARCH_INDEX]: 'word',
      [STORES.ARCHIVED_MEMORIES]: 'id, createdAt',
      [STORES.CONVERSATIONS]: 'id, createdAt, updatedAt'
    })
    this.version(DB_VERSION).stores({
      [STORES.MEMORIES]: 'id, createdAt, updatedAt, accessedAt, domain, type, memoryStrength, conversationId',
      [STORES.TAGS]: 'id, lastUsed, count',
      [STORES.MEMORY_TAG]: '[memoryId+tagId], memoryId, tagId',
      [STORES.USER_PROFILE]: 'id',
      [STORES.QUERY_CACHE]: 'id, queryHash, expiresAt',
      [STORES.SEARCH_INDEX]: 'word',
      [STORES.ARCHIVED_MEMORIES]: 'id, createdAt',
      [STORES.CONVERSATIONS]: 'id, createdAt, updatedAt'
    })
  }
}

export const db = new LevitateBoatDB()
