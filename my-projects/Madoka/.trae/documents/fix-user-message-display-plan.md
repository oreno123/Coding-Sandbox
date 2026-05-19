# 修复用户输入在对话栏中不显示的问题 - 计划文档

## 问题分析

当前 `sendMessages` 函数在发送消息时，没有将用户消息添加到对话历史中，导致用户输入在对话栏中不显示。

对比 `sendMessage` 和 `sendMessages`：

**sendMessage（正常）**：
```typescript
addMessage({ role: "user", content, images });  // ✅ 添加用户消息到对话
dispatch({ type: "SET_STATUS", payload: "responding" });
startResponse();
// ... 发送消息到 background
```

**sendMessages（有问题）**：
```typescript
dispatch({ type: "SET_STATUS", payload: "responding" });
startResponse();
// ❌ 缺少 addMessage 调用
// ... 发送消息到 background
```

## 解决方案

在 `sendMessages` 函数中添加 `addMessage` 调用，将用户输入添加到对话历史中。

需要从 `messages` 数组中提取用户输入消息（`mime_type: "text/plain"`），然后调用 `addMessage`。

## 实施步骤

### 步骤 1: 修改 sendMessages 函数

**文件**: `src/sidepanel/hooks/useChat.ts`

在 `sendMessages` 函数中添加：

```typescript
const sendMessages = useCallback(
  async (messages: MessageItem[], images?: string[]) => {
    if ((!messages.length && !images?.length) || state.isResponding) return;

    const forceSearch = state.forceSearch;

    // 提取用户输入消息（mime_type: "text/plain"）
    const userMessage = messages.find(m => m.mime_type === "text/plain");
    const userContent = userMessage?.content || "";

    // 添加用户消息到对话历史
    addMessage({ role: "user", content: userContent, images });

    dispatch({ type: "SET_STATUS", payload: "responding" });
    startResponse();

    // ... 其余代码保持不变
  },
  [...]
);
```

## 测试要点

1. 用户输入正常显示在对话栏中
2. 引用的文件内容不显示在用户输入中
3. AI 回复正常显示
4. 对话历史完整保存
