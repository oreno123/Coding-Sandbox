# 修复翻译功能中"一键询问 AI"功能

## 问题分析

**用户反馈**：点击"问 AI"按钮后不能自动输入到侧边栏

**根本原因**：

1. **background 只存储问题，没有自动打开侧边栏**（index.ts 第166-183行）
   ```typescript
   if (request.action === 'askAI') {
     await chrome.storage.session.set({ pendingQuestion: text })
     sendResponse({ success: true })
   }
   ```
   - 问题被存储到 `chrome.storage.session`
   - 但**没有调用 `chrome.sidePanel.open()`**
   - 注释说明："sidePanel.open() 必须在用户手势的同步调用链中执行"

2. **sidepanel 没有读取 pendingQuestion**（全局搜索只找到设置，没有找到读取）
   - 搜索 `pendingQuestion` 只找到 background 中的设置代码
   - sidepanel 中没有读取这个存储的代码
   - 所以即使用户手动打开侧边栏，问题也不会自动填入

## 解决方案

### 方案1：自动打开侧边栏并填入问题（推荐）

修改 background/index.ts，在存储问题后尝试打开侧边栏：

```typescript
if (request.action === 'askAI') {
  const text = request.text as string
  if (!text?.trim()) {
    sendResponse({ success: false, error: '原文为空' })
    return true
  }

  ;(async () => {
    try {
      await chrome.storage.session.set({ pendingQuestion: text })
      
      // 尝试打开侧边栏（需要在用户手势上下文中）
      try {
        // 获取当前活动标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.id) {
          await chrome.sidePanel.open({ tabId: tab.id })
        }
      } catch (e) {
        console.warn('[Madoka BG] Failed to open sidepanel:', e)
        // 打开失败也没关系，问题已保存，用户手动打开时会看到
      }
      
      sendResponse({ success: true })
    } catch (e) {
      console.error('[Madoka BG] Ask AI failed:', e)
      sendResponse({ success: false, error: (e as Error).message })
    }
  })()
  return true
}
```

然后在 sidepanel 初始化时读取 pendingQuestion：

```typescript
// 在 App.tsx 或 ChatView.tsx 的 useEffect 中
useEffect(() => {
  // 检查是否有待处理的问题
  chrome.storage.session.get('pendingQuestion').then((result) => {
    if (result.pendingQuestion) {
      // 将问题填入输入框
      setInput(result.pendingQuestion)
      // 清空存储，避免重复填入
      chrome.storage.session.remove('pendingQuestion')
    }
  })
}, [])
```

### 方案2：仅修复 sidepanel 读取逻辑

如果不修改 background（保持不自动打开侧边栏），至少修复 sidepanel 读取逻辑：

1. sidepanel 启动时检查 `pendingQuestion`
2. 自动填入输入框
3. 清除存储

这样用户点击"问 AI"后，手动打开侧边栏，问题会自动填入。

## 建议实施方案

**采用方案1**，因为：
1. 用户体验更好，一键直达
2. 即使自动打开失败，问题也已保存
3. 符合用户"一键询问"的预期

## 具体修复步骤

### 步骤1：修改 background/index.ts

在 `askAI` handler 中添加自动打开侧边栏的逻辑。

### 步骤2：修改 sidepanel 初始化逻辑

在 App.tsx 或 ChatView.tsx 中添加读取 pendingQuestion 的逻辑。

### 步骤3：测试验证

1. 在网页上选中文本翻译
2. 点击"问 AI"按钮
3. 验证侧边栏是否自动打开
4. 验证问题是否自动填入输入框

## 预期效果

用户点击"问 AI"后：
1. 问题自动保存
2. 侧边栏自动打开（如果可能）
3. 问题自动填入输入框
4. 用户可以直接发送或修改后发送
