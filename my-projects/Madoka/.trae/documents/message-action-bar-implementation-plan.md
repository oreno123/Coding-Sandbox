# 消息功能栏完整实现计划

## 任务概述

在 AI 输出的消息下方添加功能栏，包含：复制（带下拉菜单）、重新生成、删除功能。

## 已完成部分

1. ✅ ChatContext.tsx - 添加 DELETE_MESSAGE action 类型
2. ✅ ChatContext.tsx - 在 reducer 中实现删除逻辑
3. ✅ ChatContext.tsx - 在 ChatContextType 接口添加 deleteMessage 方法
4. ✅ ChatContext.tsx - 实现 deleteMessage 函数并添加到 value
5. ✅ MessageActionBar.tsx - 创建基础组件结构

## 剩余任务

### 步骤 1: 完善 MessageActionBar 组件

**文件:** `src/sidepanel/components/MessageActionBar.tsx`

**需要添加的内容:**
1. 复制功能的实际实现（使用 Clipboard API）
2. Markdown 转纯文本的工具函数
3. 重新生成功能
4. Toast 提示反馈

### 步骤 2: 在 Message 组件中集成功能栏

**文件:** `src/sidepanel/components/Message.tsx`

**修改内容:**
1. 导入 MessageActionBar 组件
2. 在 AI 消息（assistant）的渲染部分添加功能栏
3. 只在非流式状态下显示功能栏

### 步骤 3: 添加重新生成功能到 ChatContext

**文件:** `src/sidepanel/context/ChatContext.tsx`

**需要添加:**
1. REGENERATE_MESSAGE action 类型
2. 在 reducer 中实现重新生成逻辑
3. 在 ChatContextType 接口添加 regenerateMessage 方法
4. 实现 regenerateMessage 函数

### 步骤 4: 测试验证

1. 构建项目检查错误
2. 验证复制功能（纯文本和 Markdown）
3. 验证删除功能
4. 验证重新生成功能

## 实现细节

### 复制功能实现

```typescript
// Markdown 转纯文本
function markdownToPlainText(md: string): string {
  return md
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/`{3}[\s\S]*?`{3}/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    // 显示成功提示
  } catch (err) {
    // 显示错误提示
  }
}
```

### 重新生成逻辑

```typescript
const regenerateMessage = useCallback((messageId: string) => {
  const conv = getActiveConversation(state)
  if (!conv) return

  // 找到当前消息的索引
  const messageIndex = conv.messages.findIndex(m => m.id === messageId)
  if (messageIndex === -1) return

  // 找到上一条用户消息
  let userMessageIndex = -1
  for (let i = messageIndex - 1; i >= 0; i--) {
    if (conv.messages[i].role === 'user') {
      userMessageIndex = i
      break
    }
  }

  if (userMessageIndex === -1) return

  const userMessage = conv.messages[userMessageIndex]

  // 删除从用户消息到当前消息的所有消息
  dispatch({
    type: "DELETE_MESSAGES_RANGE",
    payload: { startIndex: userMessageIndex, endIndex: messageIndex }
  })

  // 重新发送用户消息
  // ... 调用发送逻辑
}, [])
```

### Message 组件集成位置

在 Message.tsx 中，找到 AI 消息的渲染部分（大约在 150-179 行），在 `</motion.div>` 结束标签之前添加功能栏：

```typescript
{/* Message content */}
<motion.div ...>
  ...
</motion.div>

{/* 功能栏 - 只在 AI 消息且非流式状态下显示 */}
{!isUser && !isSystem && !isStreaming && (
  <MessageActionBar messageId={message.id} content={content} />
)}
```

## 文件修改清单

- [ ] `src/sidepanel/components/MessageActionBar.tsx` - 完善组件
- [ ] `src/sidepanel/components/Message.tsx` - 集成功能栏
- [ ] `src/sidepanel/context/ChatContext.tsx` - 添加重新生成功能

## UI 样式规范

- 按钮间距: `gap-2`
- 按钮样式: `text-xs`, `text-[var(--text-muted)]`, `hover:text-[var(--accent-primary)]`
- 下拉菜单: `absolute`, `bg-[var(--bg-primary)]`, `border`, `rounded-lg`, `shadow-lg`
- 图标大小: `w-3.5 h-3.5`
