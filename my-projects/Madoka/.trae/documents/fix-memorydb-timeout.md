# 修复 memoryDb 超时警告

## 问题分析

错误信息：
```
[memoryDb] getMemorySettings timeout, returning default
```

发生在 `obsidianSync-CxE27ZxQ.js:35`，说明是在 Obsidian 同步模块中调用 `getMemorySettings` 时超时。

**根本原因**：
1. `getMemorySettings` 函数内部有 3 秒超时回退机制
2. 但 `openDb()` 可能在某些情况下卡住或很慢
3. 虽然函数返回了默认值，但会打印警告信息

## 解决方案

### 方案1：增加超时时间（推荐）

将 `getMemorySettings` 内部的超时时间从 3 秒增加到 5 秒，与 `openDb()` 的超时一致。

```typescript
setTimeout(() => {
  console.warn('[memoryDb] getMemorySettings timeout, returning default')
  resolve(DEFAULT_MEMORY_SETTINGS)
}, 5000)  // 从 3000 改为 5000
```

### 方案2：使用 withDbTimeout 包装

将 `getMemorySettings` 改为使用 `withDbTimeout` 包装，统一超时处理。

```typescript
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
      req.onerror = () => reject(req.error)
    })
  }, 5000, DEFAULT_MEMORY_SETTINGS)
}
```

### 方案3：静默处理（不打印警告）

如果超时是正常现象（如首次使用、数据库未初始化），可以改为静默处理，不打印警告。

## 推荐方案

采用**方案2**，统一使用 `withDbTimeout` 包装，保持代码一致性。

## 需要修改的函数

以下函数都有内部超时机制，建议统一改为使用 `withDbTimeout`：

1. `getMemorySettings` - 第 252 行
2. `getObsidianSettings` - 类似结构
3. `getUserProfile` - 类似结构

## 实施步骤

1. 修改 `getMemorySettings`，使用 `withDbTimeout` 包装
2. 同样修改 `getObsidianSettings`
3. 同样修改 `getUserProfile`
4. 构建测试
