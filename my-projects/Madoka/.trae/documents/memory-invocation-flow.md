# 当前对话调用记忆流程说明

## 整体流程图

```
用户发送消息
    ↓
[Sidepanel] useChat.ts
    ↓ 传递 selectedBlocks
[Background] handleSmartChatRequest
    ↓ 调用 memoryQuery
[Background] memoryWorker.ts
    ↓ 返回记忆列表
[Background] 构建 memoryContext
    ↓ 拼接到 system prompt
[Background] handleChat (api.ts)
    ↓ 发送给 LLM
[LLM] 生成回复（含记忆标签）
    ↓
[Background] 解析记忆标签
    ↓ 保存记忆
[Background] memoryAddEpisode
```

## 详细步骤

### 1. 用户选择板块（Sidepanel）

**文件**: `src/sidepanel/components/BlockSelector.tsx`

- 组件加载时调用 `memoryGetBlockList` 获取所有板块
- 用户点击板块进行选择/取消
- 选中状态保存到 `ChatContext` 的 `selectedBlocks`

**界面位置**: 输入框上方显示板块标签

### 2. 发送消息时携带板块信息

**文件**: `src/sidepanel/hooks/useChat.ts` (第14行, 第72行)

```typescript
const selectedBlocks = activeConversation?.selectedBlocks || []

chrome.runtime.sendMessage({
  action: 'smartChat',
  message: content,
  history,
  selectedBlocks,  // 传递选中的板块
  // ...其他参数
})
```

### 3. Background 接收请求并查询记忆

**文件**: `src/background/index.ts` (第812-846行)

```typescript
// Build memory context if blocks are selected
let memoryContext = ''
if (request.selectedBlocks && request.selectedBlocks.length > 0) {
  // Query memories for selected blocks
  const memoryRes = await memoryQuery({
    blocks: request.selectedBlocks,
    limit: 10,
  })
  
  // Format memories
  if (memoryRes.episodes && memoryRes.episodes.length > 0) {
    memoryContext = memoryRes.episodes
      .map(ep => `- ${ep.summary || ep.content.slice(0, 150)}${ep.block ? ` [${ep.block}]` : ''}`)
      .join('\n')
  }
  
  // Add user profile
  const profileRes = await memoryGetUserProfile()
  if (profileRes.profile) {
    // ...格式化用户画像
    memoryContext += '\n- 用户画像: ' + profileItems.slice(0, 5).join('；')
  }
}
```

### 4. 构建带记忆上下文的消息

**文件**: `src/background/index.ts` (第849-856行)

```typescript
const messages = await handleChat(request.message, request.history || [], {
  pageContent: pageContent || undefined,
  searchContext: searchContext || undefined,
  memoryContext: memoryContext || undefined,  // 传递记忆上下文
  requestMemoryTags: shouldRequestMemoryTags,
})
```

### 5. API 层拼接记忆到 System Prompt

**文件**: `src/background/api.ts` (第106-109行)

```typescript
// Add memory context if provided
if (options.memoryContext) {
  systemContent = systemContent + '\n\n[相关背景]\n' + options.memoryContext
}
```

**最终 System Prompt 示例**:
```
[系统提示]
你是 Madoka，一个智能助手...

[相关背景]
- 用户正在学习 TypeScript [学习板块]
- 用户是软件工程师 [工作板块]
- 用户画像: 身份: 工程师；喜欢编程
```

### 6. 对话结束后保存记忆

**文件**: `src/background/index.ts` (第884-928行)

```typescript
// Auto-save memory after conversation ends
if (shouldRequestMemoryTags) {
  // Extract XML comment format memory tag
  const memoryMatch = fullResponse.match(/<!--MEMORY:([\s\S]*?)-->/)
  if (memoryMatch) {
    const memoryData = JSON.parse(memoryMatch[1])
    // Save episode
    await memoryAddEpisode({
      conversationId,
      userContent,
      assistantContent,
      tags: { summary, topics, block, subBlock, shortTitle },
      profileUpdates: profile,
    })
  }
}
```

## 关键参数说明

| 参数 | 位置 | 说明 |
|------|------|------|
| `selectedBlocks` | ChatContext → useChat → background | 用户选中的板块列表 |
| `memoryContext` | background/index.ts → api.ts | 格式化后的记忆文本 |
| `requestMemoryTags` | background/index.ts | 是否请求 LLM 输出记忆标签 |

## 使用方式

### 方式1：按板块携带记忆（推荐）

1. 在输入框上方的板块选择器中点击选择板块
2. 输入问题并发送
3. 系统会自动查询选中板块的记忆并携带

### 方式2：自动保存记忆

1. 在设置中开启「启用记忆」
2. 正常对话
3. 每轮对话结束后自动保存（如果内容有价值）

## 注意事项

1. **板块选择是可选的**：不选择板块时不会携带记忆上下文
2. **记忆上下文有长度限制**：最多10条记忆，每条150字符摘要
3. **用户画像始终携带**：如果存在用户画像，会自动附加
4. **记忆标签对用户不可见**：使用 XML 注释格式 `<!--MEMORY:...-->`
