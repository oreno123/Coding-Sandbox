# 划词翻译快捷键功能计划

## 需求
使用快捷键 Ctrl+T (Windows/Linux) 或 Cmd+T (Mac) 来控制是否启用划词翻译功能。

## 实现方案

### 方案1：在 content script 中监听快捷键
在翻译功能的 content script 中添加键盘事件监听，当按下快捷键时切换翻译功能的启用/禁用状态。

### 方案2：使用 Chrome Commands API
在 manifest.json 中定义快捷键命令，通过 background script 控制翻译功能的启用/禁用。

## 推荐方案

采用**方案1**，在 content script 中直接监听键盘事件，实现更简单直接。

## 具体实现步骤

### 1. 修改翻译 content script
文件：`src/content/translation.ts` 或 `src/content/translation-popup.ts`

添加：
- 状态变量记录翻译功能是否启用
- 键盘事件监听器（Ctrl+T / Cmd+T）
- 切换状态时显示提示

### 2. 添加快捷键监听代码

```typescript
// 翻译功能启用状态
let translationEnabled = true

// 监听快捷键
document.addEventListener('keydown', (e) => {
  // Ctrl+T (Windows/Linux) 或 Cmd+T (Mac)
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault() // 阻止默认行为（打开新标签页）
    translationEnabled = !translationEnabled
    
    // 显示状态提示
    showStatusNotification(translationEnabled ? '划词翻译已启用' : '划词翻译已禁用')
    
    // 保存状态到 storage
    chrome.storage.local.set({ translationEnabled })
  }
})

// 加载时读取状态
chrome.storage.local.get('translationEnabled').then((result) => {
  if (result.translationEnabled !== undefined) {
    translationEnabled = result.translationEnabled
  }
})

// 修改选中文本处理逻辑
function handleTextSelection() {
  if (!translationEnabled) return // 禁用时直接返回
  
  // 原有的翻译逻辑...
}
```

### 3. 添加状态提示 UI

创建一个简单的 toast 通知显示当前状态：

```typescript
function showStatusNotification(message: string) {
  const toast = document.createElement('div')
  toast.textContent = message
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    z-index: 999999;
    font-size: 14px;
    transition: opacity 0.3s;
  `
  document.body.appendChild(toast)
  
  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}
```

### 4. 可选：在设置面板中添加开关

在 SettingsPanel 中添加一个可视化开关，显示当前翻译功能状态。

## 注意事项

1. **阻止默认行为**：Ctrl+T / Cmd+T 默认是打开新标签页，需要调用 `e.preventDefault()`
2. **状态持久化**：使用 chrome.storage 保存用户的选择
3. **跨页面同步**：不同标签页之间的状态同步
4. **Mac 兼容性**：Mac 使用 Cmd 键，Windows/Linux 使用 Ctrl 键

## 文件修改

- `src/content/translation-popup.ts` - 添加快捷键监听和状态管理
- （可选）`src/sidepanel/components/SettingsPanel.tsx` - 添加可视化开关
