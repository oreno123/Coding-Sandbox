# 划词翻译双模式功能实现文档

## 概述

本文档详细记录了为 Madoka 浏览器扩展添加划词翻译双模式功能的完整实现过程。

## 需求背景

用户希望划词翻译支持两种工作模式：
- **常态模式**：选中文本后显示"翻译"按钮，点击后才进行翻译
- **专注模式**：选中文本后直接翻译（原有行为）
- **切换方式**：使用 Alt+T 快捷键在两种模式间切换

## 实现时间

2026-03-06

## 涉及文件

1. **新增文件**：
   - `src/content/translate-button.ts` - 翻译按钮组件

2. **修改文件**：
   - `src/content/index.ts` - 内容脚本主文件

## 详细实现过程

### 第一步：创建翻译按钮组件

**文件**：`src/content/translate-button.ts`

#### 1.1 设计思路

- 使用单例模式管理按钮实例
- 支持显示/隐藏动画
- 3秒自动消失，悬停时暂停
- 点击外部区域消失
- 粉色渐变主题，与扩展整体风格一致

#### 1.2 核心代码结构

```typescript
export interface TranslateButtonOptions {
  x: number           // 鼠标 X 坐标
  y: number           // 鼠标 Y 坐标
  onClick: () => void // 点击回调
  onDismiss?: () => void // 消失回调
}

export class TranslateButton {
  private element: HTMLElement | null = null
  private dismissTimer: ReturnType<typeof setTimeout> | null = null

  show(options: TranslateButtonOptions): void
  destroy(): void
  isVisible(): boolean
}
```

#### 1.3 样式设计

按钮采用粉色渐变背景，符合 Madoka 主题色：

```css
background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
border-radius: 20px;
box-shadow: 0 4px 15px rgba(250, 112, 154, 0.4);
```

动画效果：
- 进入：从上方淡入 + 缩放
- 退出：淡出 + 缩小
- 悬停：放大 1.05 倍，阴影加深

### 第二步：修改内容脚本

**文件**：`src/content/index.ts`

#### 2.1 导入翻译按钮组件

```typescript
import { getTranslateButton } from './translate-button'
```

#### 2.2 定义模式类型和状态

```typescript
// 翻译模式类型
type TranslationMode = 'normal' | 'focus'

// 当前翻译模式（默认专注模式，保持与现有行为一致）
let currentTranslationMode: TranslationMode = 'focus'

// 存储键名
const TRANSLATION_MODE_KEY = 'translationMode'

// 存储待翻译的文本和位置（用于常态模式）
let pendingSelection: { text: string; rect: DOMRect } | null = null
```

#### 2.3 修改状态提示样式

将原有的黑色提示改为粉色渐变主题：

```typescript
function showTranslationStatus(message: string): void {
  toast.style.cssText = `
    background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    box-shadow: 0 4px 15px rgba(250, 112, 154, 0.4);
    /* ... */
  `
}
```

#### 2.4 重构快捷键处理

将 Alt+T 从"启用/禁用翻译"改为"切换翻译模式"：

```typescript
function setupTranslationShortcut(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.altKey && e.key === 't') {
      e.preventDefault()

      // 切换模式
      currentTranslationMode = currentTranslationMode === 'normal' ? 'focus' : 'normal'

      // 保存状态
      chrome.storage.local.set({ [TRANSLATION_MODE_KEY]: currentTranslationMode })

      // 显示状态提示
      const modeText = currentTranslationMode === 'normal'
        ? '常态模式：点击翻译'
        : '专注模式：直接翻译'
      showTranslationStatus(modeText)
    }
  })
}
```

#### 2.5 提取翻译执行逻辑

将翻译逻辑提取为独立函数，便于复用：

```typescript
function performTranslation(text: string, rect?: DOMRect): void {
  const textToTranslate = text.length > MAX_TRANSLATE_LENGTH
    ? text.substring(0, MAX_TRANSLATE_LENGTH)
    : text

  const popup = getTranslationPopup()
  popup.show({
    originalText: textToTranslate,
    isLoading: true,
    rect,
  })

  // 发送翻译请求...
  chrome.runtime.sendMessage(
    { action: 'translate', text: textToTranslate, langpair },
    (response) => { /* 处理响应 */ }
  )
}
```

#### 2.6 修改文本选择处理

根据当前模式决定行为：

```typescript
function setupSelectionTranslate(): void {
  document.addEventListener('mouseup', (e: MouseEvent) => {
    // ... 前置检查 ...

    debounceTimer = setTimeout(() => {
      const selection = window.getSelection()
      const text = selection?.toString()?.trim()
      if (!text) return

      const rect = selection?.getRangeAt(0).getBoundingClientRect()

      if (currentTranslationMode === 'normal') {
        // 常态模式：显示翻译按钮
        pendingSelection = { text, rect }
        const translateBtn = getTranslateButton()
        translateBtn.show({
          x: e.clientX,
          y: e.clientY,
          onClick: () => {
            if (pendingSelection) {
              performTranslation(pendingSelection.text, pendingSelection.rect)
              pendingSelection = null
            }
          },
          onDismiss: () => {
            pendingSelection = null
          }
        })
      } else {
        // 专注模式：直接翻译
        performTranslation(text, rect)
      }
    }, TRANSLATE_DEBOUNCE_MS)
  })
}
```

#### 2.7 修改初始化逻辑

```typescript
async function init() {
  // 加载翻译模式
  await loadTranslationMode()

  // 设置快捷键监听
  setupTranslationShortcut()

  // 设置划词翻译
  setupSelectionTranslate()

  console.log('[Madoka Content] 划词翻译已启用，当前模式:', currentTranslationMode)
}
```

### 第三步：状态持久化

使用 `chrome.storage.local` 保存用户选择的模式：

```typescript
// 加载时
const result = await chrome.storage.local.get(TRANSLATION_MODE_KEY)
if (result.translationMode) {
  currentTranslationMode = result.translationMode
}

// 切换时
chrome.storage.local.set({ [TRANSLATION_MODE_KEY]: currentTranslationMode })
```

## 功能特性

### 常态模式

1. 选中文本后，在鼠标位置下方显示"翻译"按钮
2. 按钮 3 秒后自动消失
3. 鼠标悬停时暂停计时
4. 点击按钮后执行翻译
5. 点击页面其他区域按钮消失

### 专注模式

1. 选中文本后直接显示翻译弹窗
2. 保持原有翻译行为不变

### 模式切换

1. 按 Alt+T 在两种模式间切换
2. 切换时显示粉色渐变提示
3. 模式状态持久化保存
4. 重启浏览器后保持上次选择的模式

## 向后兼容性

- 默认使用专注模式，与原有行为完全一致
- 原有用户无需任何操作即可继续使用
- 状态提示样式统一为粉色渐变主题

## 测试验证

构建命令：
```bash
npm run build
```

验证结果：✓ built in 3.05s

## 代码统计

- 新增代码行数：约 220 行
- 修改代码行数：约 80 行
- 新增文件：1 个
- 修改文件：1 个

## 注意事项

1. **单例模式**：TranslateButton 使用单例模式，确保同时只有一个按钮实例
2. **事件清理**：按钮销毁时清理所有事件监听器和定时器
3. **防抖处理**：文本选择使用 150ms 防抖，避免误触发
4. **扩展上下文**：翻译前检查扩展上下文是否有效
5. **超时处理**：翻译请求 15 秒超时

## 后续优化建议

1. 在设置面板中添加模式切换选项
2. 为按钮添加键盘快捷键支持（如 Enter 键直接翻译）
3. 添加 ESC 键关闭按钮的功能
4. 支持自定义按钮显示位置和样式
5. 添加模式指示器图标在页面角落显示当前模式

## 相关文件路径

- 实现文档：`docs/translation-mode-implementation.md`
- 计划文档：`.trae/documents/translation-mode-plan.md`
- 按钮组件：`src/content/translate-button.ts`
- 内容脚本：`src/content/index.ts`
