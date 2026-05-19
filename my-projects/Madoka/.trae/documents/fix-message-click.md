# 修复对话框点击收起功能

## 问题分析

当前代码状态：
- MessageList.tsx: 有 `onClick={toggleSidebar}` - 点击空白区域会触发收起
- Message.tsx motion.div: **没有**阻止冒泡
- Message.tsx 内容 div: 有 `onClick={(e) => e.stopPropagation()}` - 点击内容不触发收起

**问题**：
点击对话框气泡（非内容区域）时，事件会冒泡到 MessageList，触发收起。

## 正确实现

如果用户希望：
- 点击**空白区域** → 触发收起
- 点击**对话框**（包括气泡）→ **不触发**收起
- 点击**消息内容** → **不触发**收起

则需要在 motion.div（消息最外层容器）上添加阻止冒泡：

```typescript
<motion.div
  className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}
  variants={variants.message}
  initial="initial"
  animate="animate"
  exit="exit"
  layout
  onClick={(e) => e.stopPropagation()}  // 添加这行
>
```

这样：
- 点击消息内容 → 阻止冒泡 → 不触发收起
- 点击对话框气泡 → 阻止冒泡 → 不触发收起
- 点击空白区域 → 触发收起

## 修改步骤

1. 在 Message.tsx 的 motion.div 上添加 `onClick={(e) => e.stopPropagation()}`
2. 可以移除消息内容 div 上的阻止冒泡（因为父元素已经阻止了）
