# 修复对话框点击收起功能

## 问题分析

当前实现的问题：
- MessageList 容器有 `onClick={toggleSidebar}`
- Message 内容有 `onClick={(e) => e.stopPropagation()}` 阻止冒泡
- 但 Message 组件作为整体没有触发 toggleSidebar

用户想要的效果：
- 点击对话框气泡（消息整体）→ 触发收起
- 点击消息内容（文字、按钮）→ 不触发收起

## 解决方案

需要在 Message 组件中显式调用 toggleSidebar，而不是依赖事件冒泡。

### 修改方案

**MessageList.tsx** - 保持不变
```typescript
<div onClick={toggleSidebar}>
  {/* 消息列表 */}
</div>
```

**Message.tsx** - 需要修改
1. 从 props 或通过 context 获取 toggleSidebar
2. 在 motion.div 上添加 onClick 调用 toggleSidebar
3. 消息内容仍然阻止冒泡

```typescript
export function Message({ message, toggleSidebar }: MessageProps) {
  // ...
  
  return (
    <motion.div
      // ...
      onClick={() => toggleSidebar?.()}  // 点击消息整体触发收起
    >
      {/* 搜索结果、GitHub卡片等 */}
      
      {/* 消息内容 - 阻止冒泡 */}
      <div onClick={(e) => e.stopPropagation()}>
        {/* 消息文字 */}
      </div>
    </motion.div>
  )
}
```

## 实现步骤

1. 修改 MessageList.tsx，将 toggleSidebar 传递给 Message 组件
2. 修改 Message.tsx，接收 toggleSidebar 并在 motion.div 上调用
3. 消息内容 div 仍然阻止冒泡

## 代码修改

### MessageList.tsx
```typescript
{messages.map((message) => (
  <Message 
    key={message.id} 
    message={message} 
    toggleSidebar={toggleSidebar}  // 传递 toggleSidebar
  />
))}
```

### Message.tsx
```typescript
interface MessageProps {
  message: MessageType
  toggleSidebar?: () => void  // 添加可选属性
}

export function Message({ message, toggleSidebar }: MessageProps) {
  // ...
  
  return (
    <motion.div
      // ...
      onClick={() => toggleSidebar?.()}  // 点击消息触发收起
    >
      {/* 其他内容 */}
      
      <div onClick={(e) => e.stopPropagation()}>
        {/* 消息内容 */}
      </div>
    </motion.div>
  )
}
```
