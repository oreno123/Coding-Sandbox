# 扩大AI消息气泡宽度计划

## 问题理解

用户想要AI的对话消息占满整个对话区域的最右边，而不是被限制在85%宽度内。

## 当前实现

文件：`src/sidepanel/components/Message.tsx` 第132-142行

```tsx
<motion.div
  className={`
    max-w-[85%] rounded-2xl px-4 py-3 text-sm relative overflow-hidden
    ${isUser 
      ? 'message-user rounded-br-md' 
      : isSystem
        ? 'message-system rounded-lg'
        : 'message-assistant rounded-bl-md'
    }
    ${isStreaming ? 'min-h-[2.5rem]' : ''}
  `}
>
```

**问题**：`max-w-[85%]` 限制了消息气泡最大只能占父容器宽度的85%。

## 解决方案

### 方案1：移除AI消息的宽度限制（推荐）

对于AI消息（`message-assistant`），移除 `max-w-[85%]` 限制：

```tsx
<motion.div
  className={`
    ${isUser 
      ? 'max-w-[85%] message-user rounded-br-md' 
      : isSystem
        ? 'max-w-[85%] message-system rounded-lg'
        : 'w-full message-assistant rounded-bl-md'
    }
    rounded-2xl px-4 py-3 text-sm relative overflow-hidden
    ${isStreaming ? 'min-h-[2.5rem]' : ''}
  `}
```

变化：
- 用户消息：保持 `max-w-[85%]`
- 系统消息：保持 `max-w-[85%]`
- **AI消息**：改为 `w-full`（占满整个宽度）

### 方案2：增加AI消息宽度到95%

如果不想完全占满，可以增加到95%：

```tsx
<motion.div
  className={`
    ${isUser 
      ? 'max-w-[85%] message-user rounded-br-md' 
      : isSystem
        ? 'max-w-[85%] message-system rounded-lg'
        : 'max-w-[95%] message-assistant rounded-bl-md'
    }
    rounded-2xl px-4 py-3 text-sm relative overflow-hidden
    ${isStreaming ? 'min-h-[2.5rem]' : ''}
  `}
```

## 推荐方案

**方案1** 是最佳选择，因为：
1. AI消息通常较长，占满宽度可以显示更多内容
2. 用户消息保持85%可以区分对话双方
3. 视觉效果更好

## 实现步骤

1. 修改 `src/sidepanel/components/Message.tsx`
2. 将AI消息的 `max-w-[85%]` 改为 `w-full`
3. 重新构建验证

## 代码修改

文件：`src/sidepanel/components/Message.tsx`
行号：第132-142行

```tsx
{/* Message content */}
<motion.div
  className={`
    ${isUser 
      ? 'max-w-[85%] message-user rounded-br-md' 
      : isSystem
        ? 'max-w-[85%] message-system rounded-lg'
        : 'w-full message-assistant rounded-bl-md'
    }
    rounded-2xl px-4 py-3 text-sm relative overflow-hidden
    ${isStreaming ? 'min-h-[2.5rem]' : ''}
  `}
  onClick={(e) => e.stopPropagation()}
  whileHover={{ scale: 1.005 }}
  transition={{ duration: 0.2 }}
>
```

## 预期效果

- 用户消息：保持右侧对齐，最大宽度85%
- AI消息：左侧对齐，**占满整个对话区域宽度**
