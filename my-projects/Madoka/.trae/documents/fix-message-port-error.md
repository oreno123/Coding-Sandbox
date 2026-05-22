# 修复消息通道关闭错误

## 问题分析

**错误信息**：
```
Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received
```

**根本原因**：

1. `memoryGetBlockList` → `getAllEpisodes` → `openDb` 链式调用
2. 如果 IndexedDB 初始化卡住，`openDb` 会无限等待
3. Chrome 的消息通道超时（默认约 5 分钟），但用户等不了那么久
4. 消息通道关闭，但 handler 还在等待，导致错误

**之前修复的问题**：
- `getMemorySettings` 和 `getObsidianSettings` 已添加超时保护
- 但 `getAllEpisodes` 等其他函数没有超时保护

## 解决方案

### 方案1：为所有 memoryDb 函数添加超时保护

修改 `memoryDb.ts` 中的关键函数，添加超时机制。

**需要修改的函数**：
- `getAllEpisodes`
- `getEpisodesByConversation`
- `getEpisodesForRecall`
- `getEpisode`
- `addEpisode`
- `updateEpisode`
- `deleteEpisode`
- `getUserProfile`
- `saveUserProfile`
- `getMemorySettings`
- `saveMemorySettings`
- `getObsidianSettings`
- `saveObsidianSettings`

### 方案2：优化 openDb 添加超时

在 `openDb` 函数本身添加超时，这样所有调用者都受益。

### 方案3：添加全局超时包装器

创建一个包装函数，为所有 IndexedDB 操作添加超时。

## 推荐方案

**方案2 + 方案3 组合**：

1. 为 `openDb` 添加超时（5秒）
2. 创建一个带超时的包装函数
3. 所有 IndexedDB 操作都通过包装函数执行

## 具体修复步骤

### 步骤1：修改 openDb 添加超时

```typescript
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('IndexedDB open timeout'))
    }, 5000)
    
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => {
      clearTimeout(timer)
      reject(req.error)
    }
    req.onsuccess = () => {
      clearTimeout(timer)
      resolve(req.result)
    }
    // ... onupgradeneeded
  })
  return dbPromise
}
```

### 步骤2：创建带超时的包装函数

```typescript
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, defaultValue: T): Promise<T> {
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ])
  } catch (e) {
    console.warn('[memoryDb] Operation timeout, returning default:', e)
    return defaultValue
  }
}
```

### 步骤3：为关键函数添加超时保护

```typescript
export async function getAllEpisodes(): Promise<Episode[]> {
  return withTimeout(
    (async () => {
      const db = await openDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_EPISODES, 'readonly')
        const req = tx.objectStore(STORE_EPISODES).getAll()
        req.onsuccess = () => resolve(req.result ?? [])
        req.onerror = () => reject(req.error)
      })
    })(),
    5000,
    []
  )
}
```

## 预期效果

- IndexedDB 操作超过 5 秒自动返回默认值
- 不会阻塞消息通道
- 用户体验更流畅
