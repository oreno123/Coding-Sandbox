# 点击侧边栏对话框自动折叠历史对话功能

## 功能描述

用户点击侧边栏的对话框区域时，自动将历史对话折叠起来，只保留最近的对话或显示一个折叠状态，让界面更简洁。

## 交互设计

### 方案1：点击对话框区域折叠（推荐）

**触发方式**：
- 点击消息列表区域（非输入框区域）
- 或添加一个专门的折叠按钮

**折叠效果**：
- 历史消息折叠成摘要形式（如"共 10 条历史对话"）
- 只保留最近 2-3 条消息展开
- 再次点击可展开所有消息

**视觉反馈**：
- 折叠时显示提示文字"点击展开历史对话"
- 展开时显示提示文字"点击折叠历史对话"

### 方案2：滚动到顶部自动折叠

**触发方式**：
- 用户滚动到消息列表顶部时自动折叠
- 滚动到底部时自动展开

### 方案3：双击折叠/展开

**触发方式**：
- 双击消息列表区域切换折叠状态

## 推荐方案：方案1

原因：
1. 交互直观，用户容易发现
2. 实现简单
3. 符合用户习惯（类似微信等应用）

## 实现思路

### 1. 修改 MessageList 组件

添加折叠状态管理：
```typescript
const [isFolded, setIsFolded] = useState(false)
const [foldCount, setFoldCount] = useState(2) // 保留最近2条

// 点击切换折叠状态
const handleFoldToggle = () => {
  setIsFolded(!isFolded)
}

// 根据折叠状态显示消息
const displayedMessages = isFolded 
  ? messages.slice(-foldCount) 
  : messages
```

### 2. 添加折叠提示条

在消息列表顶部或底部添加折叠提示：
```typescript
{isFolded && messages.length > foldCount && (
  <div 
    className="fold-hint"
    onClick={handleFoldToggle}
  >
    <span>已折叠 {messages.length - foldCount} 条历史对话</span>
    <span>点击展开</span>
  </div>
)}
```

### 3. 样式设计

折叠提示条样式：
- 背景：半透明灰色
- 文字：浅色提示文字
- 居中显示
- 鼠标悬停时高亮

### 4. 动画效果

使用 framer-motion 添加平滑过渡：
```typescript
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
>
  {/* 折叠的消息 */}
</motion.div>
```

## 具体实现步骤

### 步骤1：修改 MessageList.tsx

1. 添加折叠状态 `useState`
2. 添加点击事件处理
3. 根据状态过滤显示的消息
4. 添加折叠提示条

### 步骤2：添加样式

在 index.css 或组件内添加折叠相关样式：
- 折叠提示条样式
- 折叠动画
- 悬停效果

### 步骤3：测试验证

1. 多轮对话后点击折叠
2. 验证只显示最近 N 条
3. 点击展开恢复正常
4. 验证动画流畅

## 预期效果

- 对话较多时界面更简洁
- 用户可快速查看历史摘要
- 点击即可展开查看完整对话
- 提升用户体验
