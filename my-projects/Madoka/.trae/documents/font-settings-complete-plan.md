# 字体设置功能完整实现计划

## 当前状态

已完成：
- ✅ 定义字体选项（FONT_OPTIONS、FONT_SIZE_OPTIONS）
- ✅ 添加状态管理（selectedFont、selectedFontSize）
- ✅ 添加 UI 界面（两个下拉选择框）

还缺少：
- ❌ 保存设置到浏览器存储
- ❌ 加载已保存的设置
- ❌ 应用字体到整个应用

## 需要实现的功能

### 1. 保存设置到 Chrome Storage

当用户选择字体时，需要保存到浏览器存储，下次打开还在。

**代码位置**：SettingsPanel.tsx 的 onChange 处理函数

```typescript
// 保存字体设置
const saveFontSettings = async (font: FontOption, size: FontSizeOption) => {
  await chrome.storage.local.set({
    fontFamily: font,
    fontSize: size
  })
}
```

### 2. 加载已保存的设置

组件加载时，从存储中读取之前的设置。

**代码位置**：SettingsPanel.tsx 的 useEffect

```typescript
// 加载字体设置
useEffect(() => {
  const loadFontSettings = async () => {
    const result = await chrome.storage.local.get(['fontFamily', 'fontSize'])
    if (result.fontFamily) {
      setSelectedFont(result.fontFamily)
    }
    if (result.fontSize) {
      setSelectedFontSize(result.fontSize)
    }
  }
  loadFontSettings()
}, [])
```

### 3. 应用字体到整个应用

需要把字体设置应用到整个侧边栏的文本。

**方案 A：CSS 变量方式（推荐）**

在 index.css 中定义 CSS 变量：
```css
:root {
  --font-family: system-ui, -apple-system, sans-serif;
  --font-size: 16px;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size);
}
```

在 SettingsPanel 中动态修改：
```typescript
// 应用字体到页面
document.documentElement.style.setProperty('--font-family', fontValue)
document.documentElement.style.setProperty('--font-size', sizeValue)
```

**方案 B：Context 方式**

创建 FontContext 共享字体设置给所有组件。

## 实现步骤

### 步骤 1：修改 onChange 处理函数

修改两个 select 的 onChange，添加保存逻辑：

```typescript
onChange={(e) => {
  const newFont = e.target.value as FontOption
  setSelectedFont(newFont)
  // 保存到存储
  chrome.storage.local.set({ fontFamily: newFont })
  // 应用到页面
  applyFont(newFont, selectedFontSize)
}}
```

### 步骤 2：添加加载逻辑

在组件 mount 时加载设置：

```typescript
useEffect(() => {
  chrome.storage.local.get(['fontFamily', 'fontSize']).then((result) => {
    if (result.fontFamily) setSelectedFont(result.fontFamily)
    if (result.fontSize) setSelectedFontSize(result.fontSize)
  })
}, [])
```

### 步骤 3：添加应用字体函数

```typescript
const applyFont = (font: FontOption, size: FontSizeOption) => {
  const fontMap = {
    system: 'system-ui, -apple-system, sans-serif',
    sans: 'Arial, Helvetica, sans-serif',
    serif: 'Georgia, Times New Roman, serif',
    mono: 'Consolas, Monaco, monospace'
  }
  
  const sizeMap = {
    small: '14px',
    medium: '16px',
    large: '18px',
    xlarge: '20px'
  }
  
  document.body.style.fontFamily = fontMap[font]
  document.body.style.fontSize = sizeMap[size]
}
```

### 步骤 4：初始化时应用字体

在加载设置后，立即应用到页面：

```typescript
useEffect(() => {
  chrome.storage.local.get(['fontFamily', 'fontSize']).then((result) => {
    const font = result.fontFamily || 'system'
    const size = result.fontSize || 'medium'
    setSelectedFont(font)
    setSelectedFontSize(size)
    applyFont(font, size)  // 立即应用
  })
}, [])
```

## 完整代码修改

### SettingsPanel.tsx 修改

1. 添加 applyFont 函数
2. 修改 onChange 处理
3. 添加 useEffect 加载和应用

### index.css 修改（可选）

如果需要更精细的控制，可以添加 CSS 类。

## 预期效果

1. 用户选择字体 → 立即看到效果
2. 关闭浏览器 → 重新打开后设置还在
3. 所有文本都应用新字体
