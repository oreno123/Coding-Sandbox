# 修复板块选择功能不显示的问题

## 问题分析

**用户反馈**：板块选择的功能没有看到

**根本原因**：

1. **组件使用错误**：
   - 我们创建了 `BlockSelector` 并集成到 `InputArea.tsx`
   - 但 `App.tsx` 实际使用的是 `Composer` 组件
   - `Composer` 中没有集成 `BlockSelector`

2. **文件关系**：
   ```
   App.tsx
     ↓ 使用
   Composer.tsx (实际使用的输入组件)
   
   InputArea.tsx (未被使用)
     ↓ 包含
   BlockSelector.tsx
   ```

## 解决方案

### 方案1：将 BlockSelector 集成到 Composer（推荐）

修改 `src/sidepanel/components/composer/Composer.tsx`，添加 BlockSelector。

**修改步骤**：
1. 导入 BlockSelector 组件
2. 获取 selectedBlocks 状态
3. 在 Composer 的合适位置渲染 BlockSelector
4. 确保样式与 Composer 风格一致

### 方案2：替换 Composer 为 InputArea

将 `App.tsx` 中的 `Composer` 替换为 `InputArea`。

**风险**：
- Composer 包含很多功能（模板、优化、ContextPicker 等）
- 替换可能导致功能丢失

## 推荐采用方案1

## 具体修改步骤

### 步骤1：修改 Composer.tsx

**文件**：`src/sidepanel/components/composer/Composer.tsx`

**添加导入**：
```typescript
import { BlockSelector } from '../BlockSelector'
```

**获取 selectedBlocks**：
```typescript
const { 
  mode, 
  setMode, 
  attachedContext,
  activeConversation,  // 添加这行
  dispatch,  // 添加这行
  ...
} = useChatContext()

const selectedBlocks = activeConversation?.selectedBlocks || []
```

**在合适位置渲染 BlockSelector**：
在 `composer-card` 内部、输入区域上方添加 BlockSelector。

### 步骤2：调整样式

确保 BlockSelector 与 Composer 的暗色主题风格一致。

### 步骤3：测试验证

1. 打开侧边栏
2. 检查输入区域上方是否显示板块选择器
3. 测试选择板块后发送消息
4. 验证记忆是否正确携带

## 预期效果

- 在输入框上方显示板块选择器
- 显示可用的记忆板块
- 支持多选/取消选择
- 选择板块后发送消息，自动携带该板块的记忆
