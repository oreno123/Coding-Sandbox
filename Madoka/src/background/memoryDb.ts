/**
 * 记忆 IndexedDB 封装
 * 纯本地，无网络
 */

import type { Episode, UserProfile, MemorySettings, ObsidianSettings, CleanupLogEntry, ProfileUpdatesFromLLM } from '../shared/memory-types'
import { DEFAULT_MEMORY_SETTINGS, DEFAULT_OBSIDIAN_SETTINGS } from '../shared/memory-types'
import { MEMORY_DB_NAME, MEMORY_DB_VERSION } from '../shared/memory-db-constants'

const DB_NAME = MEMORY_DB_NAME
const DB_VERSION = MEMORY_DB_VERSION
const STORE_EPISODES = 'episodes'
const STORE_PROFILE = 'userProfile'
const STORE_SETTINGS = 'memorySettings'
const STORE_OBSIDIAN = 'obsidianSettings'
const STORE_LOGS = 'cleanupLogs'
const STORE_AUTO_EXPORT_RULES = 'autoExportRules'
const STORE_CLEANUP_CONFIG = 'cleanupConfig'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.error('[memoryDb] IndexedDB open timeout after 5s')
      reject(new Error('IndexedDB open timeout'))
    }, 5000)
    
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => {
      clearTimeout(timer)
      console.error('[memoryDb] Failed to open IndexedDB:', req.error)
      reject(req.error)
    }
    req.onsuccess = () => {
      clearTimeout(timer)
      console.log('[memoryDb] IndexedDB opened successfully')
      resolve(req.result)
    }
    req.onupgradeneeded = (e) => {
      console.log('[memoryDb] Upgrading IndexedDB to version', DB_VERSION)
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_EPISODES)) {
        const os = db.createObjectStore(STORE_EPISODES, { keyPath: 'uid' })
        os.createIndex('createdAt', 'createdAt', { unique: false })
        os.createIndex('conversationId', 'metadata.conversationId', { unique: false })
        os.createIndex('lastAccessed', 'lastAccessed', { unique: false })
        os.createIndex('weight', 'weight', { unique: false })
        console.log('[memoryDb] Created episodes store')
      }
      if (!db.objectStoreNames.contains(STORE_PROFILE)) {
        db.createObjectStore(STORE_PROFILE, { keyPath: 'id' })
        console.log('[memoryDb] Created userProfile store')
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' })
        console.log('[memoryDb] Created memorySettings store')
      }
      if (!db.objectStoreNames.contains(STORE_OBSIDIAN)) {
        db.createObjectStore(STORE_OBSIDIAN, { keyPath: 'id' })
        console.log('[memoryDb] Created obsidianSettings store')
      }
      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        db.createObjectStore(STORE_LOGS, { keyPath: 'id' })
        console.log('[memoryDb] Created cleanupLogs store')
      }
      if (!db.objectStoreNames.contains(STORE_AUTO_EXPORT_RULES)) {
        const st = db.createObjectStore(STORE_AUTO_EXPORT_RULES, { keyPath: 'id' })
        st.createIndex('byBlock', ['mainBlock', 'subBlock'], { unique: false })
        console.log('[memoryDb] Created autoExportRules store')
      }
      if (!db.objectStoreNames.contains(STORE_CLEANUP_CONFIG)) {
        db.createObjectStore(STORE_CLEANUP_CONFIG, { keyPath: 'key' })
        console.log('[memoryDb] Created cleanupConfig store')
      }
    }
  })
  return dbPromise
}

/** 供 autoExportDb / cleanupConfigDb 等与 memoryDb 共用同一连接，勿 close */
export function openMemoryDatabase(): Promise<IDBDatabase> {
  return openDb()
}

// Helper function to wrap IndexedDB operations with timeout
async function withDbTimeout<T>(operation: () => Promise<T>, timeoutMs = 5000, defaultValue: T): Promise<T> {
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('IndexedDB operation timeout')), timeoutMs)
      )
    ])
  } catch (e) {
    console.warn('[memoryDb] Operation timeout or error, returning default:', e)
    return defaultValue
  }
}

export async function addEpisode(ep: Episode): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EPISODES, 'readwrite')
    tx.objectStore(STORE_EPISODES).put(ep)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function updateEpisode(uid: string, updates: Partial<Episode>): Promise<void> {
  const db = await openDb()
  const existing = await getEpisode(uid)
  if (!existing) return
  const updated = { ...existing, ...updates, lastAccessed: Date.now() }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EPISODES, 'readwrite')
    tx.objectStore(STORE_EPISODES).put(updated)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getEpisode(uid: string): Promise<Episode | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EPISODES, 'readonly')
    const req = tx.objectStore(STORE_EPISODES).get(uid)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteEpisode(uid: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EPISODES, 'readwrite')
    tx.objectStore(STORE_EPISODES).delete(uid)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAllEpisodes(): Promise<Episode[]> {
  return withDbTimeout(async () => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_EPISODES, 'readonly')
      const req = tx.objectStore(STORE_EPISODES).getAll()
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
    })
  }, 5000, [])
}

export async function getEpisodesByConversation(conversationId: string): Promise<Episode[]> {
  const all = await getAllEpisodes()
  return all.filter((e) => e.metadata.conversationId === conversationId)
}

export async function getEpisodesForRecall(opts: {
  conversationId?: string
  sourceUrl?: string
  limit: number
  minWeight?: number
}): Promise<Episode[]> {
  let list = await getAllEpisodes()
  if (opts.conversationId) {
    list = list.filter((e) => e.metadata.conversationId === opts.conversationId)
  }
  if (opts.sourceUrl) {
    list = list.filter((e) => e.metadata.sourceUrl === opts.sourceUrl)
  }
  if (opts.minWeight !== undefined) {
    list = list.filter((e) => e.weight >= (opts.minWeight as number))
  }
  list.sort((a, b) => b.lastAccessed - a.lastAccessed)
  return list.slice(0, opts.limit)
}

export async function getUserProfile(): Promise<UserProfile | null> {
  return withDbTimeout(async () => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROFILE, 'readonly')
      const req = tx.objectStore(STORE_PROFILE).get('default')
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  }, 5000, null)
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const db = await openDb()
  const withId = { ...profile, id: 'default' }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROFILE, 'readwrite')
    tx.objectStore(STORE_PROFILE).put(withId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 将单值转为多标签数组（兼容旧数据 string） */
function toTagArray(v: string | string[] | undefined): string[] {
  if (v == null) return []
  if (Array.isArray(v)) return v.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
  return typeof v === 'string' && v.trim() ? [v.trim()] : []
}

/** 将 LLM/手动输入的字符串按逗号、顿号、分号拆成多标签，并 trim（不按空格拆，保留多词短语） */
function splitFieldValue(v: string): string[] {
  return v
    .split(/[,，、;；]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 多标签按去重（以 trim 后值为准）保留唯一 */
function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  return tags.filter((t) => {
    const k = t.trim()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** 将 LLM 返回的画像更新合并到当前画像（多标签：拆分、追加并去重，避免手动记入重复） */
export async function mergeUserProfile(updates: ProfileUpdatesFromLLM): Promise<void> {
  const current = (await getUserProfile()) || { updatedAt: 0 }
  const now = Date.now()
  const merged: UserProfile = { ...current, updatedAt: now }
  const sectionKeys = [
    '基本信息',
    '正在学什么',
    '正在做什么',
    '喜欢什么',
    '不喜欢什么',
    '喜欢的风格',
    '需求与偏好',
  ] as const
  for (const key of sectionKeys) {
    const upd = updates[key]
    if (!upd || typeof upd !== 'object') continue
    const base = (merged[key] || {}) as Record<string, string | string[]>
    const next: Record<string, string[]> = {}
    for (const [k, existingVal] of Object.entries(base)) {
      const arr = dedupeTags(toTagArray(existingVal))
      if (arr.length) next[k] = arr
    }
    for (const [k, v] of Object.entries(upd)) {
      const raw = typeof v === 'string' ? [v] : Array.isArray(v) ? v.map((s) => String(s)) : []
      const newTags = raw.flatMap((s) => splitFieldValue(s))
      const cur = dedupeTags(toTagArray(next[k]))
      for (const tag of newTags) {
        const t = tag.trim()
        if (t && !cur.some((c) => c.trim() === t)) cur.push(t)
      }
      if (cur.length) next[k] = dedupeTags(cur)
    }
    if (Object.keys(next).length) (merged as unknown as Record<string, unknown>)[key] = next
  }
  await saveUserProfile(merged)
}

export async function getMemorySettings(): Promise<MemorySettings> {
  return withDbTimeout(async () => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly')
      const req = tx.objectStore(STORE_SETTINGS).get('default')
      req.onsuccess = () => {
        const raw = req.result
        resolve(raw ? { ...DEFAULT_MEMORY_SETTINGS, ...raw } : DEFAULT_MEMORY_SETTINGS)
      }
      req.onerror = () => {
        console.error('[memoryDb] getMemorySettings failed:', req.error)
        reject(req.error)
      }
    })
  }, 5000, DEFAULT_MEMORY_SETTINGS)
}

export async function saveMemorySettings(settings: MemorySettings): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite')
    tx.objectStore(STORE_SETTINGS).put({ id: 'default', ...settings })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getObsidianSettings(): Promise<ObsidianSettings> {
  return withDbTimeout(async () => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OBSIDIAN, 'readonly')
      const req = tx.objectStore(STORE_OBSIDIAN).get('default')
      req.onsuccess = () => {
        const raw = req.result
        resolve(raw ? { ...DEFAULT_OBSIDIAN_SETTINGS, ...raw } : DEFAULT_OBSIDIAN_SETTINGS)
      }
      req.onerror = () => {
        console.error('[memoryDb] getObsidianSettings failed:', req.error)
        reject(req.error)
      }
    })
  }, 5000, DEFAULT_OBSIDIAN_SETTINGS)
}

export async function saveObsidianSettings(settings: Partial<ObsidianSettings> & { id?: string }): Promise<void> {
  const db = await openDb()
  const current = await getObsidianSettings()
  const merged = { ...current, ...settings, id: 'default' }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OBSIDIAN, 'readwrite')
    tx.objectStore(STORE_OBSIDIAN).put(merged)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function addCleanupLog(entry: CleanupLogEntry): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LOGS, 'readwrite')
    tx.objectStore(STORE_LOGS).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getCleanupLogs(limit: number): Promise<CleanupLogEntry[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LOGS, 'readonly')
    const req = tx.objectStore(STORE_LOGS).getAll()
    req.onsuccess = () => {
      const list = (req.result ?? []).sort((a: CleanupLogEntry, b: CleanupLogEntry) => b.at - a.at)
      resolve(list.slice(0, limit))
    }
    req.onerror = () => reject(req.error)
  })
}

/** 估算当前存储使用量（字节） */
export async function estimateEpisodesSize(): Promise<number> {
  const list = await getAllEpisodes()
  const json = JSON.stringify(list)
  return new TextEncoder().encode(json).length
}
