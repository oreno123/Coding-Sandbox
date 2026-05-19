/**
 * 用户画像存储（IndexedDB）
 * 独立的 IndexedDB：MadokaProfile
 */

import type {
  ProfileTag,
  ProfileColumn,
  UserProfileV2,
} from '../shared/memory-types'
import { DEFAULT_PROFILE_COLUMNS } from '../shared/memory-types'

const DB_NAME = 'MadokaProfile'
const DB_VERSION = 1
const STORE_COLUMNS = 'columns'
const STORE_TAGS = 'tags'
const STORE_META = 'meta'

/** 打开数据库 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_COLUMNS)) {
        db.createObjectStore(STORE_COLUMNS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_TAGS)) {
        db.createObjectStore(STORE_TAGS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' })
      }
    }
  })
}

/** 初始化默认栏配置（等待事务完成后再关闭 DB） */
export async function initDefaultColumns(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COLUMNS, 'readwrite')
    const store = tx.objectStore(STORE_COLUMNS)
    for (const col of DEFAULT_PROFILE_COLUMNS) {
      store.put(col)
    }
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

/** 获取所有栏（若为空则初始化默认栏） */
export async function getAllColumns(): Promise<ProfileColumn[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_COLUMNS, 'readonly')
  const store = tx.objectStore(STORE_COLUMNS)
  const req = store.getAll()
  let result = await new Promise<ProfileColumn[]>((resolve, reject) => {
    req.onsuccess = () => {
      db.close()
      resolve(req.result || [])
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
  if (result.length === 0) {
    try {
      await initDefaultColumns()
      const db2 = await openDB()
      const tx2 = db2.transaction(STORE_COLUMNS, 'readonly')
      const req2 = tx2.objectStore(STORE_COLUMNS).getAll()
      result = await new Promise<ProfileColumn[]>((resolve, reject) => {
        req2.onsuccess = () => { db2.close(); resolve(req2.result || []); }
        req2.onerror = () => { db2.close(); reject(req2.error); }
      })
    } catch {
      return DEFAULT_PROFILE_COLUMNS
    }
  }
  return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** 添加栏 */
export async function addColumn(column: ProfileColumn): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_COLUMNS, 'readwrite')
  const store = tx.objectStore(STORE_COLUMNS)
  return new Promise((resolve, reject) => {
    const req = store.put(column)
    req.onsuccess = () => {
      db.close()
      resolve()
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

/** 删除栏（只能删除非默认栏） */
export async function deleteColumn(columnId: string): Promise<void> {
  const columns = await getAllColumns()
  const col = columns.find(c => c.id === columnId)
  if (col?.isDefault) {
    throw new Error('默认栏不可删除')
  }
  const db = await openDB()
  const tx = db.transaction(STORE_COLUMNS, 'readwrite')
  const store = tx.objectStore(STORE_COLUMNS)
  return new Promise((resolve, reject) => {
    const req = store.delete(columnId)
    req.onsuccess = () => {
      db.close()
      resolve()
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

/** 获取所有标签 */
export async function getAllTags(): Promise<ProfileTag[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_TAGS, 'readonly')
  const store = tx.objectStore(STORE_TAGS)
  const req = store.getAll()
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      db.close()
      resolve(req.result)
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

/** 按栏获取标签 */
export async function getTagsByColumn(columnId: string): Promise<ProfileTag[]> {
  const tags = await getAllTags()
  return tags.filter(t => t.columnId === columnId)
}

/** 添加标签 */
export async function addTag(tag: ProfileTag): Promise<void> {
  const columns = await getAllColumns()
  const col = columns.find(c => c.id === tag.columnId)
  if (!col) {
    throw new Error('栏不存在')
  }
  const existing = await getTagsByColumn(tag.columnId)
  if (existing.length >= col.maxTags) {
    throw new Error(`该栏最多只能有 ${col.maxTags} 个标签`)
  }
  const db = await openDB()
  const tx = db.transaction(STORE_TAGS, 'readwrite')
  const store = tx.objectStore(STORE_TAGS)
  return new Promise((resolve, reject) => {
    const req = store.put(tag)
    req.onsuccess = () => {
      db.close()
      resolve()
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

/** 更新标签 */
export async function updateTag(tagId: string, updates: Partial<ProfileTag>): Promise<void> {
  const tags = await getAllTags()
  const tag = tags.find(t => t.id === tagId)
  if (!tag) {
    throw new Error('标签不存在')
  }
  if (tag.locked && updates.value !== undefined) {
    throw new Error('锁定的标签不可修改值')
  }
  const updated = { ...tag, ...updates, updatedAt: Date.now() }
  const db = await openDB()
  const tx = db.transaction(STORE_TAGS, 'readwrite')
  const store = tx.objectStore(STORE_TAGS)
  return new Promise((resolve, reject) => {
    const req = store.put(updated)
    req.onsuccess = () => {
      db.close()
      resolve()
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

/** 删除标签 */
export async function deleteTag(tagId: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_TAGS, 'readwrite')
  const store = tx.objectStore(STORE_TAGS)
  return new Promise((resolve, reject) => {
    const req = store.delete(tagId)
    req.onsuccess = () => {
      db.close()
      resolve()
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

/** 清空栏内所有标签 */
export async function clearColumnTags(columnId: string): Promise<void> {
  const tags = await getTagsByColumn(columnId)
  const db = await openDB()
  const tx = db.transaction(STORE_TAGS, 'readwrite')
  const store = tx.objectStore(STORE_TAGS)
  return new Promise((resolve, reject) => {
    let count = 0
    for (const tag of tags) {
      const req = store.delete(tag.id)
      req.onsuccess = () => {
        count++
        if (count === tags.length) {
          db.close()
          resolve()
        }
      }
      req.onerror = () => {
        db.close()
        reject(req.error)
      }
    }
    if (tags.length === 0) {
      db.close()
      resolve()
    }
  })
}

/** 获取完整用户画像 */
export async function getUserProfileV2(): Promise<UserProfileV2> {
  const [columns, tags] = await Promise.all([getAllColumns(), getAllTags()])
  return {
    columns,
    tags,
    version: 2,
    updatedAt: Date.now(),
  }
}

/** 批量更新标签冲突 */
export async function updateTagConflicts(tagId: string, conflictIds: string[]): Promise<void> {
  await updateTag(tagId, { conflictWith: conflictIds })
}

/** 导出用户画像 */
export async function exportUserProfile(): Promise<string> {
  const profile = await getUserProfileV2()
  return JSON.stringify({
    version: 2,
    type: 'user_profile',
    exportedAt: new Date().toISOString(),
    data: profile,
  }, null, 2)
}

/** 导入用户画像（增量合并） */
export async function importUserProfile(jsonStr: string): Promise<{ added: number; updated: number; conflicts: number }> {
  const data = JSON.parse(jsonStr)
  if (data.type !== 'user_profile') {
    throw new Error('无效的导入文件')
  }
  const imported = data.data as UserProfileV2
  const existingTags = await getAllTags()
  let added = 0, updated = 0, conflicts = 0
  for (const tag of imported.tags) {
    const exist = existingTags.find(t => t.value === tag.value && t.columnId === tag.columnId)
    if (exist) {
      if (!exist.locked) {
        await updateTag(exist.id, { ...tag, id: exist.id, updatedAt: Date.now() })
        updated++
      } else {
        conflicts++
      }
    } else {
      await addTag({ ...tag, id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`, createdAt: Date.now(), updatedAt: Date.now() })
      added++
    }
  }
  return { added, updated, conflicts }
}

/** 重置所有用户画像 */
export async function resetUserProfile(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction([STORE_TAGS, STORE_COLUMNS], 'readwrite')
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      const req = tx.objectStore(STORE_TAGS).clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    }),
    new Promise<void>((resolve, reject) => {
      const req = tx.objectStore(STORE_COLUMNS).clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    }),
  ])
  db.close()
  await initDefaultColumns()
}