# Tasks

## Task 1: 修改 MessageList 组件添加点击事件
- [ ] 打开 `src/sidepanel/components/MessageList.tsx`
- [ ] 从 `useChatContext` 解构添加 `toggleSidebar`
- [ ] 给消息列表容器 div 添加 `onClick={toggleSidebar}` 属性

**Dependencies**: None

**代码修改**:
```typescript
export function MessageList() {
  const { messages, toggleSidebar } = useChatContext()  // 添加 toggleSidebar
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-4 py-4 hide-scrollbar show-scrollbar-on-hover"
      onClick={toggleSidebar}  // 添加点击事件
    >
      {/* ... */}
    </div>
  )
}
```

## Task 2: 修改 Message 组件阻止事件冒泡
- [ ] 打开 `src/sidepanel/components/Message.tsx`
- [ ] 找到消息内容的最外层容器元素
- [ ] 添加 `onClick={(e) => e.stopPropagation()}`

**Dependencies**: None

**代码修改**:
```typescript
<div 
  className="message-bubble ..."
  onClick={(e) => e.stopPropagation()}  // 阻止冒泡
>
  {/* 消息内容 */}
</div>
```

## Task 3: 构建和测试
- [ ] 运行 `npm run build` 确保无 TypeScript 错误
- [ ] 测试点击对话区域收起侧边栏
- [ ] 测试点击消息内容不触发收起

**Dependencies**: Task 1, Task 2

# Task Dependencies

```
Task 1 和 Task 2 可以并行执行
Task 3 依赖 Task 1 和 Task 2
```
