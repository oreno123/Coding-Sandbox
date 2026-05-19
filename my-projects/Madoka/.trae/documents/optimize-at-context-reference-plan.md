# 优化 @ 触发文件引用功能 - 计划文档

## 当前实现分析

### 数据流
1. **用户输入 `@`** → ContextPicker 弹出
2. **选择文件/标签页** → 调用 `handleSelectContext` (Composer.tsx)
3. **添加到 attachedContext** → `addContextRef(ref)`
4. **解析内容** → `resolveContextRef(ref)` 发送消息到 background
5. **发送消息时** → 遍历 `attachedContext.refs`，拼接内容到消息中

### 当前代码位置
- **ContextPicker**: `src/sidepanel/components/composer/ContextPicker.tsx`
- **AttachedContextBar**: `src/sidepanel/components/composer/AttachedContextBar.tsx`
- **Composer 处理**: `src/sidepanel/components/composer/Composer.tsx` (lines 163-220)
- **Context 解析**: `src/sidepanel/context/ChatContext.tsx` `resolveContextRef` (lines 1072-1118)
- **消息发送**: `src/sidepanel/components/composer/Composer.tsx` `handleSend` (lines 263-308)

### 当前消息格式
```
--- Context from: 标题 (URL) ---
内容

--- User Query ---
用户输入
```

## 问题与优化点

### 问题 1: 内容解析时机
- 当前在用户选择引用时立即解析内容
- 如果页面内容变化，引用的仍是旧内容
- **优化**: 延迟到发送消息前解析，或提供刷新机制

### 问题 2: 消息格式不够清晰
- 当前格式较为简单
- **优化**: 添加更清晰的标记和元数据

### 问题 3: 缺乏内容预览
- 用户无法看到已引用内容的摘要
- **优化**: 在 AttachedContextBar 中显示内容摘要或字符数

### 问题 4: 无重复引用检测
- 可能重复添加同一页面
- **优化**: 添加重复检测和提示

## 实施步骤

### 步骤 1: 优化消息格式
修改 `handleSend` 中的内容拼接逻辑：
```typescript
// 优化后的格式
parts.push(`<context-ref>
<source>${ref.title}</source>
<url>${ref.url}</url>
<content>${content}</content>
</context-ref>`);
```

### 步骤 2: 添加内容预览
修改 `AttachedContextBar`：
- 鼠标悬停显示内容摘要 tooltip
- 显示已加载内容的字符数

### 步骤 3: 延迟解析优化
修改 `handleSelectContext`：
- 移除立即调用 `resolveContextRef`
- 改为在 `handleSend` 前统一解析
- 添加解析状态指示

### 步骤 4: 重复引用检测
修改 `handleSelectContext`：
- 检查是否已存在相同 URL 的引用
- 如果存在，提示用户或自动替换

## 具体修改位置

### 1. Composer.tsx - 优化消息格式 (lines 283-292)
```typescript
// 当前代码
parts.push(`--- Context from: ${ref.title} (${ref.url}) ---\n${content}\n`);

// 改为结构化格式
parts.push(`<context-ref>\n<source>${escapeXml(ref.title)}</source>\n<url>${ref.url}</url>\n<content>${content}</content>\n</context-ref>`);
```

### 2. AttachedContextBar.tsx - 添加内容预览
- 添加 tooltip 显示内容前 200 字符
- 显示内容加载状态和字符数

### 3. Composer.tsx - 延迟解析
- 修改 `handleSelectContext`，移除 `resolveContextRef(ref)` 调用
- 在 `handleSend` 中添加批量解析逻辑

### 4. Composer.tsx - 重复检测
```typescript
const handleSelectContext = useCallback((ref: AnyContextRef) => {
  // 检查是否已存在相同 URL
  const existingRef = attachedContext.refs.find(r => r.url === ref.url);
  if (existingRef) {
    // 提示用户或自动替换
    showToast('该页面已引用，将替换为最新内容', 'info');
    removeContextRef(existingRef.id);
  }
  // ... 原有逻辑
}, [attachedContext.refs]);
```

## 测试要点
1. @ 触发选择器正常工作
2. 消息格式正确包含