# 修复 PDF Viewer 调用机制 Spec

## 问题分析

当前实现的问题：
1. 使用 iframe 包装官方 viewer，但 URL 参数传递不正确
2. 缺少 `viewer-config.js` 配置 `disableOriginCheck: true`
3. 没有正确调用 `PDFViewerApplication.open()` 加载 PDF

## 正确调用机制（基于 PDF.js内置viewer调用机制分析.md）

### 核心流程

```
用户访问 PDF → 显示弹窗 → 用户点击 → 重定向到 viewer.html?file=xxx
                                      ↓
                              viewer.html 加载
                                      ↓
                              viewer-config.js 解析 URL 参数
                                      ↓
                              PDFViewerApplication.open() 加载 PDF
```

### 关键配置

**viewer-config.js 必须包含：**
1. `window.PDFViewerApplicationOptions.disableOriginCheck = true` - 允许跨域
2. 解析 `?file=` URL 参数
3. 调用 `PDFViewerApplication.open({ url: pdfUrl })`

## 修改方案

### Step 1: 删除 viewer-wrapper.html

不再使用 iframe 包装，直接重定向到官方 viewer。

### Step 2: 创建 viewer-config.js

在 `public/pdfjs/web/viewer-config.js` 中：
- 配置 `PDFViewerApplicationOptions`
- 解析 URL 参数
- 调用 `PDFViewerApplication.open()`

### Step 3: 修改 viewer.html

添加 `<script src="viewer-config.js"></script>`

### Step 4: 修改 pdf-handler.ts

直接重定向到 `web/viewer.html?file=xxx`

### Step 5: 更新 manifest.json

确保 web_accessible_resources 包含所有必要文件

## 文件变更

- **删除**: `public/pdfjs/viewer-wrapper.html`, `public/pdfjs/viewer-wrapper.js`
- **新增**: `public/pdfjs/web/viewer-config.js`
- **修改**: `public/pdfjs/web/viewer.html`, `src/content/pdf-handler.ts`
