# 修复消息通道关闭错误

## 问题分析

错误信息：
```
Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received
[Settings] 加载记忆设置失败: Error: The message port closed before a response was received.
```

这个错误发生在 SettingsPanel 加载记忆设置时，说明 `memoryGetSettings` 或 `memoryGetObsidianSettings` 的消息处理器没有正确响应。

## 可能的原因

1. **IndexedDB 初始化问题**：如果 IndexedDB 在第一次访问时卡住或失败，可能导致异步操作无法完成
2. **Service Worker 被终止**：Chrome 可能会在等待响应时终止 Service Worker
3. **消息处理器顺序问题**：某些处理器可能在其他处理器之前执行，导致冲突
4. **缺少错误处理**：如果 memoryGetSettings 内部抛出错误但没有被捕获

## 修复方案

### 1. 检查 memoryDb.ts 的初始化逻辑

检查 `getMemorySettings` 和 `getObsidianSettings` 函数：
- 确保它们有超时机制
- 确保 IndexedDB 初始化失败时有降级处理
- 添加更多的错误日志

### 2. 优化消息处理器

在 background/index.ts 中：
- 确保所有异步处理器都正确返回 true
- 添加超时保护
- 确保在 catch 块中也调用 sendResponse

### 3. 添加 IndexedDB 初始化检查

在 memoryDb.ts 中添加：
- 初始化状态检查
- 重试机制
- 更详细的错误日志

### 4. 检查 SettingsPanel 的调用方式

确保：
- 消息发送格式正确
- 有超时处理
- 错误处理完善

## 具体修复步骤

### 步骤 1: 检查 memoryDb.ts 的错误处理

查看 `getMemorySettings` 和 `getObsidianSettings` 函数，确保：
- 它们不会无限等待 IndexedDB
- 有 try-catch 包裹
- 返回默认值而不是卡住

### 步骤 2: 添加消息处理超时

在 SettingsPanel.tsx 中，为 sendToBackground 添加超时：
```typescript
const res = await Promise.race([
  sendToBackground<...>({ action: 'memoryGetSettings' }),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
])
```

### 步骤 3: 检查 Service Worker 生命周期

确保 background script 不会因为长时间运行而被终止。

### 步骤 4: 添加调试日志

在关键位置添加 console.log，帮助定位问题。

## 需要检查的文件

1. `src/background/memoryDb.ts` - 检查 getMemorySettings 和 getObsidianSettings
2. `src/background/index.ts` - 检查消息处理器
3. `src/sidepanel/components/SettingsPanel.tsx` - 检查调用方式
