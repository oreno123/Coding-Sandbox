# 修复 PDF Viewer 本地调用 Bug Spec

## Why

用户点击"使用 Madoka 查看"按钮后，PDF 文件无法加载，报错"文件消失"。这是因为：
1. PDF Viewer 页面检测路径错误
2. viewer-config.js 的初始化时机问题
3. 脚本加载顺序不正确

## What Changes

- **修复** `pdf-handler.ts` 中的 `isPdfViewerPage` 路径检查
- **修复** `viewer-config.js` 的初始化逻辑，使用正确的事件监听方式
- **修复** `viewer.html` 中的脚本加载顺序

## Impact

- Affected specs: PDF 查看功能
- Affected code:
  - `src/content/pdf-handler.ts`
  - `public/pdfjs/web/viewer-config.js`
  - `public/pdfjs/web/viewer.html`

## 问题根因分析

### 问题 1: isPdfViewerPage 路径错误

**当前代码** ([pdf-handler.ts:154](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/content/pdf-handler.ts#L154)):
```typescript
export function isPdfViewerPage(): boolean {
  return window.location.href.includes('/public/pdfjs/viewer.html')
}
```

**问题**: 实际 viewer 路径是 `/public/pdfjs/web/viewer.html`，检查路径错误导致：
- 划词翻译功能无法在 PDF 页面启用
- PDF 处理逻辑判断错误

### 问题 2: viewer-config.js 初始化时机问题

**当前代码** ([viewer-config.js:97-102](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/public/pdfjs/web/viewer-config.js#L97-L102)):
```javascript
setTimeout(() => {
  openPdfWhenReady();
}, 1000);
```

**问题**:
- 使用固定延迟等待，不可靠
- `webviewerloaded` 事件监听器在 setTimeout 之后才注册，可能错过事件
- viewer.mjs 是 module 脚本，异步加载，1 秒可能不够

### 问题 3: viewer.html 脚本加载顺序

**当前代码** ([viewer.html:49-50](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/public/pdfjs/web/viewer.html#L49-L50)):
```html
<script src="viewer.mjs" type="module"></script>
<script src="viewer-config.js"></script>
```

**问题**:
- viewer-config.js 在 viewer.mjs 之后立即执行
- 此时 PDFViewerApplication 可能还未定义
- 需要等待 DOMContentLoaded 和 webviewerloaded 事件

## 修复方案

### 修复 1: 更正 isPdfViewerPage 路径

```typescript
export function isPdfViewerPage(): boolean {
  return window.location.href.includes('/public/pdfjs/web/viewer.html')
}
```

### 修复 2: 重构 viewer-config.js 初始化逻辑

```javascript
// 在脚本加载时立即注册事件监听器
document.addEventListener('webviewerloaded', function onWebViewerLoaded() {
  console.log('[Madoka PDF] webviewerloaded 事件触发');
  openPdfWhenReady();
}, { once: true });

// 同时监听 DOMContentLoaded 作为备用
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function onDOMReady() {
    // 如果 webviewerloaded 已经触发，直接执行
    if (window.PDFViewerApplication) {
      openPdfWhenReady();
    }
  });
} else {
  // DOM 已加载，检查 PDFViewerApplication
  if (window.PDFViewerApplication) {
    openPdfWhenReady();
  }
}
```

### 修复 3: 使用 defaultPdfUrl 让 PDF.js 自动加载

PDF.js 官方 viewer 支持 `defaultUrl` 配置，在 viewer.html 中已经设置了 `window.defaultPdfUrl`，但需要确保 viewer-config.js 不干扰这个流程。

修改 viewer-config.js 只做配置，不主动调用 open：

```javascript
// 仅配置选项，不主动加载 PDF
window.PDFViewerApplicationOptions = {
  disableOriginCheck: true,
  enableScripting: false,
  enableXfa: true,
  // ... 其他配置
};

// PDF.js 会自动使用 window.defaultPdfUrl 加载 PDF
```

## ADDED Requirements

### Requirement: PDF Viewer 页面检测

系统应正确检测 PDF Viewer 页面，路径应为 `/public/pdfjs/web/viewer.html`。

#### Scenario: PDF Viewer 页面检测成功
- **WHEN** 用户访问 `chrome-extension://xxx/public/pdfjs/web/viewer.html?file=xxx.pdf`
- **THEN** `isPdfViewerPage()` 返回 `true`
- **AND** 划词翻译功能启用

### Requirement: PDF 文件加载

系统应在 PDF Viewer 页面正确加载 PDF 文件。

#### Scenario: PDF 加载成功
- **WHEN** 用户点击"使用 Madoka 查看"按钮
- **THEN** 页面重定向到 viewer.html
- **AND** PDF 文件正确加载显示
- **AND** 控制台无错误信息
