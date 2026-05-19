/**
 * 在侧栏将 Obsidian 目录句柄写入 IndexedDB
 * File System Access 句柄只能在 window 上下文获取，故在此保存
 */

import { MEMORY_DB_NAME, MEMORY_DB_VERSION, STORE_OBSIDIAN } from '../../shared/memory-db-constants'

export function saveObsidianRootHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MEMORY_DB_NAME, MEMORY_DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_OBSIDIAN)) {
        db.close()
        reject(new Error('Obsidian store not found'))
        return
      }
      const tx = db.transaction(STORE_OBSIDIAN, 'readwrite')
      const store = tx.objectStore(STORE_OBSIDIAN)
      const getReq = store.get('default')
      getReq.onsuccess = () => {
        const existing = getReq.result || { id: 'default', subDir: 'MadokaMemory', frontmatterFormat: 'yaml', lastSyncAt: 0 }
        store.put({ ...existing, rootDirHandle: handle })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      getReq.onerror = () => reject(getReq.error)
    }
  })
}
