/**
 * 手动清理配置（MadokaMemory DB）
 */

import type { CleanupConfig } from '../shared/memory-types'
import { DEFAULT_CLEANUP_CONFIG } from '../shared/memory-types'
import { openMemoryDatabase } from './memoryDb'

const STORE_CONFIG = 'cleanupConfig'
const KEY_CONFIG = 'default'

export async function getCleanupConfig(): Promise<CleanupConfig> {
  const db = await openMemoryDatabase()
  if (!db.objectStoreNames.contains(STORE_CONFIG)) {
    return DEFAULT_CLEANUP_CONFIG
  }
  const tx = db.transaction(STORE_CONFIG, 'readonly')
  const store = tx.objectStore(STORE_CONFIG)
  return new Promise((resolve, reject) => {
    const req = store.get(KEY_CONFIG)
    req.onsuccess = () => {
      if (req.result?.config) {
        resolve(req.result.config as CleanupConfig)
      } else {
        resolve(DEFAULT_CLEANUP_CONFIG)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

export async function saveCleanupConfig(config: CleanupConfig): Promise<void> {
  const db = await openMemoryDatabase()
  const tx = db.transaction(STORE_CONFIG, 'readwrite')
  const store = tx.objectStore(STORE_CONFIG)
  return new Promise((resolve, reject) => {
    const req = store.put({ key: KEY_CONFIG, config })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
