# Tasks

## Task 1: 修改 MessageList 组件
- [ ] 保持现有的 `onClick={toggleSidebar}` 在容器 div 上
- [ ] 确保点击空白区域时触发 toggleSidebar

**Dependencies**: None

**代码**: MessageList.tsx 已有 `onClick={toggleSidebar}`，无需修改

## Task 2: 修改 Message 组件
- [ ] 移除 motion.div 上的 `onClick={(e) => e.stopPropagation()}`
- [ ] 在消息内容 div 上添加 `onClick={(e) => e.stopPropagation()}`
- [ ] 确保点击对话框气泡时触发 toggleSidebar
- [ ] 确保点击消息内容时不触发

**Dependencies**: None

**代码修改**:
```typescript
// 1. 移除 motion.div 上的阻止冒泡
<motion.div
  className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}
  variants={variants.message}
  initial="initial"
  animate="animate"
  exit="exit"
  layout
  // 移除 onClick={(e) => e.stopPropagation()}
>

// 2. 在消息内容 div 上添加阻止冒泡
<div
  className={`
    max-w-[85%] rounded-2xl px-4 py-2.5 text-sm
    ...
  `}
  onClick={(e) => e.stopPropagation()}  // 添加在这里
>
  {renderContent()}
</div>
```

## Task 3: 构建和测试
- [ ] 运行 `npm run build` 确保无 TypeScript 错误
- [ ] 测试点击空白区域收起侧边栏
- [ ] 测试点击对话框气泡收起侧边栏
- [ ] 测试点击消息内容不触发收起

**Dependencies**: Task 2

# Task Dependencies

```
Task 1 已完成（已有代码）
Task 2 需要修改
Task 3 依赖 Task 2
```
