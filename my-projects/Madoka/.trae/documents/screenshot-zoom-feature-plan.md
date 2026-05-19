# 截图放大功能实现计划

## 📋 任务概述
实现点击侧边栏中已发送消息的截图时，能够放大查看图片的功能。

## 🎯 学习目标
通过这个任务，你将学会：
1. 如何创建模态框（Modal）组件
2. 如何使用 React 状态管理模态框的显示/隐藏
3. 如何处理图片的点击事件
4. 如何使用 framer-motion 实现平滑的动画效果

## 📝 实现步骤

### Step 1: 创建图片查看器组件 (ImageViewer)
**目标**：创建一个新的组件用于显示放大的图片

**知识点**：
- React 组件的基本结构
- Props 接口定义
- framer-motion 动画库的使用
- 点击外部区域关闭功能

**提示**：
- 需要接收 `imageUrl` 和 `onClose` 作为 props
- 使用 `AnimatePresence` 实现进入/退出动画
- 添加遮罩层（overlay）和关闭按钮

---

### Step 2: 修改 Message 组件
**目标**：在 Message 组件中添加图片点击事件处理

**知识点**：
- React 状态管理（useState）
- 条件渲染
- 事件处理函数

**提示**：
- 在 Message 组件中添加 `viewingImage` 状态
- 为图片添加 `onClick` 事件处理
- 当点击图片时，设置 `viewingImage` 为图片的 dataUrl

---

### Step 3: 在 Message 组件中集成 ImageViewer
**目标**：将 ImageViewer 组件集成到 Message 组件中

**知识点**：
- 组件组合
- 条件渲染（使用 AnimatePresence）
- 传递 props

**提示**：
- 使用 `AnimatePresence` 包裹 ImageViewer
- 当 `viewingImage` 有值时显示 ImageViewer
- 传递 `imageUrl` 和 `onClose` 回调

---

### Step 4: 测试功能
**目标**：验证功能是否正常工作

**测试要点**：
- 点击消息中的缩略图，图片是否放大显示
- 点击遮罩层或关闭按钮，图片查看器是否关闭
- 动画效果是否流畅
- 多张图片时是否都能正常点击

---

## 💡 技术要点

### 关键概念
1. **模态框（Modal）**：覆盖在页面之上的弹出层，用于显示重要内容
2. **状态提升**：将子组件的状态提升到父组件管理
3. **条件渲染**：根据条件决定是否渲染某个组件
4. **动画效果**：使用 framer-motion 实现平滑的过渡动画

### 代码模式
```tsx
// 基本的模态框结构
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* 内容 */}
    </motion.div>
  )}
</AnimatePresence>
```

---

## 📂 相关文件
- `src/sidepanel/components/Message.tsx` - 消息组件（需要修改）
- `src/sidepanel/components/ImageViewer.tsx` - 新建图片查看器组件

---

## 🎓 学习顺序
1. 先理解现有的 Message 组件结构
2. 创建 ImageViewer 组件
3. 修改 Message 组件集成 ImageViewer
4. 测试功能

---

## ⚠️ 注意事项
1. 保持代码风格与现有代码一致
2. 使用现有的 CSS 变量（如 `--bg-primary`、`--border-primary`）
3. 确保动画流畅，不影响用户体验
4. 考虑移动端适配（如果需要）
