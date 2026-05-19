# 修复 PDF Viewer 时序问题 Spec

## 问题分析

根据错误分析报告，PDF Viewer 存在严重的时序问题：

### 错误现象
1. `AltTextManager` 初始化错误 - `dialog` 为 null
2. `_hideViewBookmark` 错误 - `secondaryToolbar` 为 null
3. `setDocument` 错误 - `pdfViewer` 为 null
4. `firstPagePromise` 初始化错误 - 变量提升问题
5. 缺失本地化翻译 - Madoka 按钮翻译键不存在

### 根本原因
`viewer-config.js` 在 DOM 加载完成后立即调用 `PDFViewerApplication.open()`，但 PDF.js 作为 ES 模块是异步加载的，此时 `PDFViewerApplication` 尚未完全初始化，导致各种 `null` 引用错误。

## 解决方案

### 方案 1: 修复 viewer-config.js 的等待逻辑
- 正确等待 `PDFViewerApplication.initialized` 变为 true
- 使用 `initializedPromise` 确保初始化完成后再调用 `open()`

### 方案 2: 添加缺失的本地化翻译
- 在 `locale/locale.json` 中添加 Madoka 相关翻译键
- 或者从 viewer.html 中移除未使用的按钮

### 方案 3: 增强错误处理
- 在 `waitForPDFViewerApplication()` 中添加更健壮的错误处理
- 添加超时和重试机制

## 修改方案

### Step 1: 修复 viewer-config.js 时序问题
- 修改 `waitForPDFViewerApplication()` 函数
- 确保等待 `initializedPromise` 而不仅仅是检查 `initialized` 标志
- 添加更可靠的初始化检测逻辑

### Step 2: 添加缺失的本地化翻译
- 在 `public/pdfjs/web/locale/locale.json` 中添加 Madoka 按钮的翻译
- 添加其他缺失的翻译键（first-page, last-page 等）

### Step 3: 验证修复
- 构建项目
- 测试 PDF 加载是否正常
- 验证控制台无错误

## 文件变更

- **修改**: `public/pdfjs/web/viewer-config.js` - 修复时序等待逻辑
- **修改**: `public/pdfjs/web/locale/locale.json` - 添加缺失翻译
