# AI 消息功能栏实现计划

## 需求概述

在 AI 输出的消息下方添加一个功能栏，类似于千问和豆包的交互设计，包含以下功能：
1. **复制回答** - 带下拉菜单，可选择"直接复制"或"复制为 Markdown"
2. **重新生成** - 重新生成当前 AI 回复
3. **删除对话** - 删除这条对话记录

## 问题分析

### 当前代码结构
- **Message.tsx** - 单条消息的渲染组件
- **ChatContext.tsx** - 全局状态管理，包含消息的增删改操作
- **types.ts** - 消息类型定义

### 需要新增的功能
1. **删除单条消息** - 当前只有 `CLEAR_MESSAGES`（清空所有），需要添加删除单条消息的能力
2. **重新生成** - 需要实现重新发送上一条用户消息并生成新回复
3. **复制功能** - 需要处理纯文本复制和 Markdown 格式复制

## 实现方案

### 步骤 1: 添加删除单条消息的 Action

**文件:** [src/sidepanel/context/ChatContext.tsx](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/sidepanel/context/ChatContext.tsx)

**修改内容:**
1. 在 `AppAction` 类型中添加 `DELETE_MESSAGE` action
2. 在 `appReducer` 中实现删除逻辑
3. 在 `ChatContextType` 接口中添加 `deleteMessage` 方法
4. 在 `ChatProvider` 中实现 `deleteMessage` 函数

### 步骤 2: 添加重新生成功能

**文件:** [src/sidepanel/context/ChatContext.tsx](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/sidepanel/context/ChatContext.tsx)

**修改内容:**
1. 在 `ChatContextType` 接口中添加 `regenerateMessage` 方法
2. 实现重新生成逻辑：
   - 找到当前 AI 消息对应的用户消息
   - 删除当前的 AI 回复
   - 重新发送用户消息并生成新回复

### 步骤 3: 创建消息功能栏组件

**文件:** 新建 `src/sidepanel/components/MessageActionBar.tsx`

**组件功能:**
1. **复制按钮**
   - 主按钮显示"复制"文字 + 向下箭头图标
   - 鼠标悬停时显示下拉菜单
   - 下拉菜单选项：
     - "复制纯文本" - 复制去除 Markdown 格式的纯文本
     - "复制为 Markdown" - 保留原始 Markdown 格式

2. **重新生成按钮**
   - 刷新图标 + "重新生成"文字
   - 点击后触发重新生成
   - 生成过程中显示 loading 状态

3. **删除按钮**
   - 垃圾桶图标 + "删除"文字
   - 点击后删除当前消息
   - 可选：添加确认提示

### 步骤 4: 在 Message 组件中集成功能栏

**文件:** [src/sidepanel/components/Message.tsx](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/sidepanel/components/Message.tsx)

**修改内容:**
1. 仅在 AI 消息（`role === 'assistant'`）下显示功能栏
2. 功能栏位置：消息内容下方，左对齐
3. 样式：
   - 背景透明或使用消息背景色
   - 按钮使用图标 + 文字的形式
   - 悬停时显示操作提示
   - 使用主题色高亮

### 步骤 5: 样式设计

**功能栏样式:**
```
┌─────────────────────────────────────────────────────────┐
│  [复制 ▼]  [🔄 重新生成]  [🗑️ 删除]                      │
│   └── 悬停展开 ──┐                                       │
│                  ▼                                       │
│            ┌──────────────┐                              │
│            │ 复制纯文本   │                              │
│            │ 复制为 MD    │                              │
│            └──────────────┘                              │
└─────────────────────────────────────────────────────────┘
```

**设计细节:**
- 按钮间距：gap-2
- 按钮样式：圆角、小字体、图标+文字
- 下拉菜单：带阴影、圆角、悬停高亮
- 整体位置：消息内容下方，margin-top: 8px

### 步骤 6: 工具函数实现

**复制功能:**
- `copyPlainText(content: string)` - 去除 Markdown 标记，保留纯文本
- `copyAsMarkdown(content: string)` - 直接复制原始内容
- 使用 Clipboard API 实现复制

**Markdown 转纯文本:**
- 移除 `#`、`*`、`-` 等标记符号
- 保留链接文本（移除 URL）
- 保留代码块内容

## 文件修改清单

- [ ] `src/sidepanel/context/ChatContext.tsx` - 添加 deleteMessage 和 regenerateMessage
- [ ] `src/sidepanel/components/MessageActionBar.tsx` - 新建功能栏组件
- [ ] `src/sidepanel/components/Message.tsx` - 集成功能栏
- [ ] `src/sidepanel/index.css` - 添加必要的样式（如需要）

## 技术要点

### 1. 删除消息逻辑
```typescript
// 在 reducer 中
case "DELETE_MESSAGE": {
  return updateActiveConversation(state, (conv) => ({
    ...conv,
    messages: conv.messages.filter((m) => m.id !== action.payload),
  }));
}
```

### 2. 重新生成逻辑
```typescript
const regenerateMessage = useCallback((messageId: string) => {
  // 1. 找到当前消息在数组中的索引
  // 2. 找到对应的上一条用户消息
  // 3. 删除从用户消息到当前消息的所有消息
  // 4. 重新发送用户消息
}, []);
```

### 3. Markdown 转纯文本
```typescript
function markdownToPlainText(md: string): string {
  return md
    .replace(/#{1,6}\s/g, '')           // 移除标题标记
    .replace(/\*\*|__/g, '')            // 移除粗体标记
    .replace(/\*|_/g, '')               // 移除斜体标记
    .replace(/`{3}[\s\S]*?`{3}/g, '')   // 移除代码块
    .replace(/`([^`]+)`/g, '$1')        // 保留行内代码内容
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接保留文本
    .replace(/\n{3,}/g, '\n\n');        // 规范化换行
}
```

## 用户体验考虑

1. **复制反馈** - 复制成功后显示 Toast 提示
2. **重新生成 Loading** - 显示加载状态，禁用按钮
3. **删除确认** - 可选的二次确认，防止误删
4. **悬停显示** - 功能栏在鼠标悬停在消息上时显示，减少视觉干扰

## 后续优化

1. **点赞/点踩** - 添加反馈功能
2. **编辑消息** - 允许编辑用户消息后重新发送
3. **分享功能** - 生成分享链接或图片
