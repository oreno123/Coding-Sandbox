# 修复记忆触发机制

## 问题分析

用户询问"记忆怎么触发"，经检查发现：

**根本原因**：`handleSmartChatRequest` 中调用 `handleChat` 时没有设置 `requestMemoryTags: true`，导致 LLM 不会输出记忆标签 JSON。

当前代码（background/index.ts 第847-851行）：
```typescript
const messages = await handleChat(request.message, request.history || [], {
  pageContent: pageContent || undefined,
  searchContext: searchContext || undefined,
  memoryContext: memoryContext || undefined,
})
```

缺少 `requestMemoryTags: true`，所以 LLM 不会收到 `MEMORY_TAGS_INSTRUCTION`，也就不会输出记忆 JSON。

## 修复方案

### 方案1：始终启用记忆标签（推荐）

在 `handleChat` 调用中添加 `requestMemoryTags: true`：

```typescript
const messages = await handleChat(request.message, request.history || [], {
  pageContent: pageContent || undefined,
  searchContext: searchContext || undefined,
  memoryContext: memoryContext || undefined,
  requestMemoryTags: true,  // 添加这行
})
```

### 方案2：根据记忆设置动态启用

先检查记忆设置是否启用，再决定是否添加记忆标签：

```typescript
const settings = await memoryGetSettings()
const messages = await handleChat(request.message, request.history || [], {
  pageContent: pageContent || undefined,
  searchContext: searchContext || undefined,
  memoryContext: memoryContext || undefined,
  requestMemoryTags: settings.enabled,  // 根据设置决定
})
```

## 建议采用方案2

理由：
1. 用户可以在设置中关闭记忆功能
2. 关闭后不会浪费 token 在记忆标签上
3. 符合用户预期

## 修复步骤

1. 修改 `background/index.ts` 中的 `handleSmartChatRequest` 函数
2. 在调用 `handleChat` 之前获取记忆设置
3. 根据设置传递 `requestMemoryTags`
4. 构建并测试
