# 删除消息同步删除对应用户消息方案

## 需求描述

当前删除 AI 消息时，只删除了 AI 的回复，但对应的用户消息还保留在对话中。

期望行为：删除 AI 消息时，同步删除对应的用户消息（即删除整个问答对）。

## 实现方案

### 方案：在 ChatContext 中添加 deleteMessagePair 方法

**步骤 1: 在 ChatContextType 接口添加新方法**

```typescript
// Message methods
addMessage: (message: Omit<Message, "id" | "timestamp">) => string;
updateMessage: (id: string, content: string) => void;
clearMessages: () => void;
deleteMessage: (id: string) => void;
deleteMessagePair: (assistantMessageId: string) => void;  // 新增
regenerateMessage: (messageId: string) => void;
```

**步骤 2: 实现 deleteMessagePair 函数**

```typescript
const deleteMessagePair = useCallback((assistantMessageId: string) => {
  const conv = getActiveConversation(state);
  if (!conv) return;

  // 找到 AI 消息的索引
  const assistantIndex = conv.messages.findIndex((m) => m.id === assistantMessageId);
  if (assistantIndex === -1) return;

  // 验证是 AI 消息
  if (conv.messages[assistantIndex].role !== "assistant") {
    // 如果不是 AI 消息，只删除该消息
    dispatch({ type: "DELETE_MESSAGE", payload: assistantMessageId });
    return;
  }

  // 找到对应的用户消息（AI 消息前最近的一条用户消息）
  let userMessageIndex = -1;
  for (let i = assistantIndex - 1; i >= 0; i--) {
    if (conv.messages[i].role === "user") {
      userMessageIndex = i;
      break;
    }
  }

  if (userMessageIndex === -1) {
    // 没有找到用户消息，只删除 AI 消息
    dispatch({ type: "DELETE_MESSAGE", payload: assistantMessageId });
    return;
  }

  // 删除从用户消息到 AI 消息的所有消息
  dispatch({
    type: "DELETE_MESSAGES_RANGE",
    payload: { startIndex: userMessageIndex, endIndex: assistantIndex },
  });
}, [state]);
```

**步骤 3: 将方法添加到 value 对象**

```typescript
const value: ChatContextType = {
  // ... 其他属性
  deleteMessage,
  deleteMessagePair,  // 新增
  regenerateMessage,
  // ...
};
```

**步骤 4: 在 MessageActionBar 中使用新方法**

修改 `MessageActionBar` 组件，使用 `deleteMessagePair` 替代 `deleteMessage`：

```typescript
// 删除消息（连同对应的用户消息）
const handleDelete = useCallback(() => {
  deleteMessagePair(messageId)
  showToast('对话已删除', 'success')
}, [deleteMessagePair, messageId, showToast])
```

## 文件修改清单

- [ ] `src/sidepanel/context/ChatContext.tsx` - 添加 deleteMessagePair 方法
- [ ] `src/sidepanel/components/MessageAction.tsx` - 使用 deleteMessagePair

## 用户体验

点击 AI 消息下方的"删除"按钮后：
- 该 AI 回复被删除
- 对应的用户提问也被删除
- 整个问答对从对话中移除

## 注意事项

1. 如果 AI 消息前没有用户消息（例如系统消息后的第一条 AI 消息），则只删除 AI 消息
2. 如果删除的是用户消息（虽然功能栏只在 AI 消息下显示），则只删除该消息
