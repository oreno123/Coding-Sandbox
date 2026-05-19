# 重新生成直接发送方案

## 问题描述

当前的重新生成实现是将用户消息塞回输入栏，然后调用 handleSend。这种方式：
1. 用户体验不好（看到输入框内容变化）
2. 依赖 Composer 组件的处理逻辑
3. 不够直接

## 期望行为

点击"重新生成"后：
1. 直接删除旧的 AI 回复和对应用户消息
2. 直接使用原来的用户消息内容发送到 AI
3. 不需要经过输入框

## 实现方案

### 方案：在 ChatContext 中直接调用发送逻辑

修改 `regenerateMessage` 函数，不再通过自定义事件，而是直接调用发送消息的逻辑。

**步骤 1: 修改 ChatContext.tsx**

需要获取 `sendMessage` 或 `sendMessages` 的能力。由于 useChat hook 不能在 ChatContext 中直接使用，我们需要：

1. 将发送逻辑提取到 context 中，或者
2. 通过 dispatch 触发一个特殊的 action 来发送消息

**推荐方案：通过 window 事件传递完整消息信息**

修改 regenerateMessage，传递完整的用户消息信息（包括图片、resource_infos 等）：

```typescript
const regenerateMessage = useCallback(
  (messageId: string) => {
    const conv = getActiveConversation(state);
    if (!conv) return;

    // 找到当前消息的索引
    const messageIndex = conv.messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // 找到上一条用户消息
    let userMessageIndex = -1;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (conv.messages[i].role === "user") {
        userMessageIndex = i;
        break;
      }
    }

    if (userMessageIndex === -1) return;

    const userMessage = conv.messages[userMessageIndex];

    // 删除从用户消息到当前消息的所有消息
    dispatch({
      type: "DELETE_MESSAGES_RANGE",
      payload: { startIndex: userMessageIndex, endIndex: messageIndex },
    });

    // 直接发送 - 传递完整的用户消息信息
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("regenerateMessage", {
          detail: { 
            content: userMessage.content,
            images: userMessage.images,
            resource_infos: userMessage.resource_infos 
          },
        }),
      );
    }, 0);
  },
  [state],
);
```

**步骤 2: 修改 Composer.tsx**

修改事件监听，直接调用 `sendMessages` 而不是设置输入框：

```typescript
// 监听重新生成消息事件
useEffect(() => {
  const handleRegenerate = (e: CustomEvent<{ 
    content: string;
    images?: string[];
    resource_infos?: ResourceInfo[];
  }>) => {
    // 直接发送，不经过输入框
    const messages: MessageItem[] = [];
    
    // 如果有 resource_infos，添加 context/reference 消息
    if (e.detail.resource_infos && e.detail.resource_infos.length > 0) {
      messages.push({
        role: "user",
        mime_type: "context/reference",
        meta_data: {
          resource_infos: e.detail.resource_infos,
          ori_query: e.detail.content
        }
      });
    }
    
    // 添加用户输入消息
    messages.push({
      role: "user",
      content: e.detail.content,
      mime_type: "text/plain"
    });
    
    // 直接发送
    sendMessages(messages, e.detail.images, e.detail.resource_infos);
  };

  window.addEventListener("regenerateMessage", handleRegenerate as EventListener);

  return () => {
    window.removeEventListener("regenerateMessage", handleRegenerate as EventListener);
  };
}, [sendMessages]);
```

## 文件修改清单

- [ ] `src/sidepanel/context/ChatContext.tsx` - 修改 regenerateMessage，传递完整消息信息
- [ ] `src/sidepanel/components/composer/Composer.tsx` - 修改事件监听，直接调用 sendMessages

## 优点

1. **用户体验好** - 输入框不会闪烁或变化
2. **直接高效** - 直接发送，不经过中间步骤
3. **保留完整信息** - 包括图片、resource_infos 等都能正确重新发送
