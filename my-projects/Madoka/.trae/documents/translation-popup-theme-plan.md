# 翻译弹窗主题适配优化计划

## 当前问题分析

翻译弹窗 (`src/content/translation-popup.ts`) 当前存在以下问题：

1. **硬编码样式**: 所有颜色都是硬编码的，不支持主题切换
2. **无主题感知**: 内容脚本无法直接访问 sidepanel 的主题状态
3. **视觉不统一**: 与 sidepanel 的主题风格不一致

## 当前硬编码颜色

| 元素 | 当前颜色 | 问题 |
|------|---------|------|
| 弹窗背景 | `#ffffff` | 不适配暗色主题 |
| Header 渐变 | `#667eea → #764ba2 → #f093fb` | 不适配 Cyber 主题 |
| 原文区域背景 | `#f8fafc → #f1f5f9` | 不适配暗色主题 |
| 译文区域背景 | `#ede9fe → #ddd6fe` | 不适配暗色主题 |
| 文字颜色 | `#374151`, `#475569` | 不适配暗色主题 |
| 按钮颜色 | 紫色渐变 | 不适配 Cyber 主题 |

## 解决方案

### 方案：通过 Chrome Storage 同步主题

1. **读取主题**: 从 `chrome.storage.local` 读取当前主题
2. **监听变化**: 监听主题变化事件，实时更新弹窗样式
3. **CSS 变量**: 使用 CSS 变量定义主题颜色，便于切换

## 实施步骤

### 步骤 1: 定义主题颜色常量

在 `translation-popup.ts` 中定义三种主题的颜色配置：

```typescript
const THEME_STYLES = {
  light: {
    bg: '#ffffff',
    headerGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
    textPrimary: '#1a1a1a',
    textSecondary: '#4b5563',
    originalBg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    translatedBg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
    buttonPrimary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    buttonSecondary: '#fff',
    borderColor: '#e5e7eb',
    overlayBg: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    bg: '#1e1e1e',
    headerGradient: 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 50%, #6366f1 100%)',
    textPrimary: '#e0e0e0',
    textSecondary: '#a0a0a0',
    originalBg: 'linear-gradient(135deg, #2d2d2d 0%, #252526 100%)',
    translatedBg: 'linear-gradient(135deg, #1e3a5f 0%, #172554 100%)',
    buttonPrimary: 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)',
    buttonSecondary: '#2d2d2d',
    borderColor: '#3c3c3c',
    overlayBg: 'rgba(0, 0, 0, 0.7)',
  },
  cyber: {
    bg: '#1A0B2E',
    headerGradient: 'linear-gradient(135deg, #FF4D8D 0%, #FF2E63 50%, #00F0FF 100%)',
    textPrimary: '#F0F0FF',
    textSecondary: '#B8B8D0',
    originalBg: 'linear-gradient(135deg, #2D1B4E 0%, #3D2B5E 100%)',
    translatedBg: 'linear-gradient(135deg, #1A3A5F 0%, #0A2A4F 100%)',
    buttonPrimary: 'linear-gradient(135deg, #FF4D8D 0%, #FF2E63 100%)',
    buttonSecondary: 'transparent',
    borderColor: 'rgba(0, 240, 255, 0.3)',
    overlayBg: 'rgba(26, 11, 46, 0.8)',
    neonShadow: '0 0 20px rgba(255, 77, 141, 0.3)',
  },
}
```

### 步骤 2: 添加主题读取和监听

```typescript
class TranslationPopup {
  private currentTheme: 'light' | 'dark' | 'cyber' = 'light'
  
  constructor() {
    // 初始化时读取主题
    this.loadTheme()
    // 监听主题变化
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.theme) {
        this.currentTheme = changes.theme.newValue
        this.updatePopupTheme()
      }
    })
  }
  
  private async loadTheme(): Promise<void> {
    const result = await chrome.storage.local.get('theme')
    this.currentTheme = result.theme || 'light'
  }
}
```

### 步骤 3: 重构弹窗渲染逻辑

将硬编码样式替换为主题感知样式：

```typescript
private getThemeStyles() {
  return THEME_STYLES[this.currentTheme]
}

private applyThemeStyles() {
  const styles = this.getThemeStyles()
  // 应用样式到弹窗元素
}
```

### 步骤 4: 添加 Cyber 主题特效

为 Cyber 主题添加霓虹发光效果：
- 弹窗边框发光
- 按钮悬停发光
- Header 霓虹渐变

### 步骤 5: 更新样式类

创建主题感知的 CSS 类：
- `.madoka-popup-light`
- `.madoka-popup-dark`
- `.madoka-popup-cyber`

## 文件变更

| 文件 | 变更内容 |
|------|---------|
| `src/content/translation-popup.ts` | 添加主题支持，重构样式系统 |

## 验证测试

1. **Light 主题**: 白色背景，紫色渐变 header
2. **Dark 主题**: 深色背景，蓝色渐变 header
3. **Cyber 主题**: 紫色背景，霓虹渐变 header，发光效果
4. **主题切换**: 实时更新弹窗样式（如果弹窗已打开）
5. **持久化**: 刷新页面后主题保持

## 预期效果

- 翻译弹窗与 sidepanel 视觉风格统一
- 支持三种主题实时切换
- Cyber 主题下有霓虹发光效果
- 更好的暗色模式体验
