# 点击对话框自动折叠侧边栏

## 需求理解

用户希望：点击侧边栏的对话框区域时，自动触发现有的折叠功能（`toggleSidebar`），将侧边栏收起来。

## 现有功能分析

从代码分析，已有折叠功能：
- `sidebarOpen` 状态控制侧边栏显示/隐藏
- `toggleSidebar()` 函数切换状态
- Sidebar 组件根据 `sidebarOpen` 显示或隐藏

## 实现方案

### 方案：点击消息列表区域自动折叠侧边栏

**修改文件**：`src/sidepanel/components/MessageList.tsx`

**实现思路**：
1. 在 MessageList 组件中获取 `toggleSidebar` 函数
2. 给消息列表容器添加点击事件
3. 点击时调用 `toggleSidebar()` 折叠侧边栏

**代码实现**：

```typescript
export function MessageList() {
  const { messages, toggleSidebar } = useChatContext()  // 添加 toggleSidebar
  const containerRef = useRef<HTMLDivElement>(null)

  // 处理点击事件，折叠侧边栏
  const handleClick = () => {
    toggleSidebar()  // 调用折叠函数
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-4 py-4 hide-scrollbar show-scrollbar-on-hover cursor-pointer"
      onClick={handleClick}  // 添加点击事件
    >
      {/* ... 消息列表内容 ... */}
    </div>
  )
}
```

### 注意事项

1. **避免误触发**：点击消息内容时不应该折叠
   - 可以给消息列表容器添加点击事件
   - 但消息项（Message 组件）的点击事件需要阻止冒泡

2. **用户体验**：
   - 添加 `cursor-pointer` 样式提示可点击
   - 或者添加提示文字"点击折叠侧边栏"

3. **防止冲突**：
   - 确保点击消息内的按钮（如复制）不会触发折叠
   - 需要在 Message 组件中阻止事件冒泡

## 修改步骤

### 步骤1：修改 MessageList.tsx

1. 从 `useChatContext` 解构 `toggleSidebar`
2. 给容器 div 添加 `onClick={handleClick}`
3. 添加 `cursor-pointer` 样式

### 步骤2：修改 Message.tsx（防止误触发）

在 Message 组件中阻止点击事件冒泡：

```typescript
<div 
  className="message-content"
  onClick={(e) => e.stopPropagation()}  // 阻止冒泡
>
  {/* 消息内容 */}
</div>
```

### 步骤3：测试验证

1. 打开侧边栏
2. 点击消息列表区域
3. 验证侧边栏自动折叠
4. 验证点击消息内容不会折叠
5. 验证其他功能正常

## 预期效果

- 用户点击消息列表区域时，侧边栏自动折叠
- 界面更简洁，专注于对话内容
- 再次点击侧边栏切换按钮可展开
