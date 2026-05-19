# 修复"一键询问 AI"自动填入输入框

## 问题分析

**用户反馈**：侧边栏一直开着，点击"问 AI"后应该直接输入到侧边栏中

**根本原因**：
- background 将问题存储到 `chrome.storage.session.set({ pendingQuestion: text })`
- 但 sidepanel **没有读取** `pendingQuestion` 并填入输入框

## 解决方案

在 sidepanel 中定期检查（或监听）`pendingQuestion`，一旦有新问题就填入输入框。

## 具体修复步骤

### 步骤1：在 Composer.tsx 中添加读取逻辑

**文件**：`src/sidepanel/components/composer/Composer.tsx`

在 Composer 组件的 `useEffect` 中定期检查 `pendingQuestion`：

```typescript
useEffect(() => {
  // 检查是否有待处理的问题（从翻译功能的"问 AI"按钮）
  const checkPendingQuestion = async () => {
    try {
      const result = await chrome.storage.session.get('pendingQuestion')
      if (result.pendingQuestion) {
        // 将问题填入输入框
        setInput(result.pendingQuestion)
        // 清空存储，避免重复填入
        await chrome.storage.session.remove('pendingQuestion')
        // 聚焦输入框
        textareaRef.current?.focus()
      }
    } catch (e) {
      console.error('[Composer] Failed to check pending question:', e)
    }
  }

  // 立即检查一次
  checkPendingQuestion()

  // 定期检查（每2秒检查一次）
  const interval = setInterval(checkPendingQuestion, 2000)

  return () => clearInterval(interval)
}, [])
```

### 步骤2：确保 textareaRef 已定义

Composer.tsx 中应该已经有 `textareaRef`，用于引用 textarea 元素：

```typescript
const textareaRef = useRef<HTMLTextAreaElement>(null)
```

### 步骤3：测试验证

1. 打开侧边栏（保持打开状态）
2. 在网页上选中文本翻译
3. 点击"问 AI"按钮
4. 观察侧边栏输入框是否自动填入原文
5. 输入框应该获得焦点，用户可以直接发送或修改

## 预期效果

用户点击"问 AI"后：
1. 原文自动填入侧边栏输入框
2. 输入框获得焦点
3. 用户可以直接按 Enter 发送，或修改后再发送
