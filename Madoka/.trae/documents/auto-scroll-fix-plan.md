# AI 输出自动滚动问题修复计划

## 问题分析

### 根本原因
在 [MessageList.tsx](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/sidepanel/components/MessageList.tsx) 中，当前的自动滚动逻辑存在以下问题：

```typescript
// 当前代码 (第16-21行)
useEffect(() => {
  if (containerRef.current) {
    containerRef.current.scrollTop = containerRef.current.scrollHeight
  }
}, [messages])
```

**问题：**
1. **无条件自动滚动** - 每当 `messages` 数组变化时，都会强制滚动到底部
2. **用户无法向上滚动查看历史内容** - 即使用户手动向上滚动，新消息到来时仍会被强制拉回底部
3. **缺乏智能判断** - 没有判断用户是否正在查看历史消息

### 预期行为
- 当用户正在查看最新消息（滚动位置在底部附近）时，新消息到来应自动滚动到底部
- 当用户向上滚动查看历史消息时，不应强制滚动，保持当前滚动位置
- 当用户不在底部时，显示一个"向下箭头"按钮，点击可快速回到最新消息

## 解决方案

### 步骤 1: 修改 MessageList 组件的滚动逻辑

**文件:** [src/sidepanel/components/MessageList.tsx](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/sidepanel/components/MessageList.tsx)

**修改内容:**
1. 添加状态管理：
   - `isAtBottom`: 布尔值，表示用户是否滚动到底部
   - `showScrollButton`: 布尔值，控制向下箭头按钮的显示

2. 添加滚动监听：
   - 监听容器的 `scroll` 事件
   - 判断用户是否滚动到底部（容差值约 50-100px）

3. 修改自动滚动逻辑：
   - 只有当 `isAtBottom` 为 true 时才自动滚动
   - 使用 `scrollTo({ behavior: 'smooth' })` 实现平滑滚动

4. 添加"回到底部"按钮：
   - 固定在消息列表右下角
   - 显示条件：当用户不在底部且消息数量 > 0
   - 点击后平滑滚动到底部

### 步骤 2: 实现细节

**核心逻辑伪代码:**
```typescript
// 判断是否接近底部
const isNearBottom = () => {
  const container = containerRef.current
  if (!container) return true
  const threshold = 100 // 容差值
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
}

// 滚动事件处理
const handleScroll = () => {
  const atBottom = isNearBottom()
  setIsAtBottom(atBottom)
  setShowScrollButton(!atBottom)
}

// 消息更新时的滚动处理
useEffect(() => {
  if (isAtBottom && containerRef.current) {
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth'
    })
  } else if (!isAtBottom) {
    setShowScrollButton(true)
  }
}, [messages])
```

### 步骤 3: UI 组件

**"回到底部"按钮设计:**
- 位置：消息列表容器右下角，距离底部 20px，距离右侧 20px
- 样式：圆形按钮，深色背景，白色向下箭头图标
- 动画：淡入淡出效果
- 点击：平滑滚动到底部

## 实施检查清单

- [ ] 修改 MessageList.tsx，添加滚动状态管理
- [ ] 实现 `isNearBottom` 判断函数
- [ ] 添加滚动事件监听器
- [ ] 修改自动滚动逻辑，增加条件判断
- [ ] 实现"回到底部"按钮组件
- [ ] 添加按钮的显示/隐藏动画
- [ ] 测试场景：
  - [ ] 正常对话时自动滚动到底部
  - [ ] 向上滚动后，新消息不强制滚动
  - [ ] 点击向下箭头按钮回到底部
  - [ ] 切换对话后滚动行为正常
