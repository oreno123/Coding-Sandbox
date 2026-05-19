# PDF 划词翻译功能 Spec

## Why

当前 Madoka 插件已经实现了网页划词翻译功能，但 PDF 文件中的文本无法被选择和翻译。用户需要能够在浏览器中打开的 PDF 文件上进行划词翻译，提升阅读外文 PDF 文档的体验。

## What Changes

- **PDF 自动拦截**: 当用户访问 PDF 文件时，自动使用 PDF.js 渲染器打开
- **PDF 文本可选择**: 使用 PDF.js 渲染后，PDF 内容变为可选文本
- **划词翻译集成**: 复用现有的划词翻译功能，支持 PDF 和普通网页
- **配置统一**: 使用 Madoka 现有的配置系统管理划词翻译开关和设置

## Impact

- **新增文件**:
  - `src/content/pdf-handler.ts` - PDF 拦截和 PDF.js 加载
  - `src/content/pdf-translate-bridge.ts` - PDF 页面与翻译功能桥接
  - `public/pdfjs/` - PDF.js 库文件

- **修改文件**:
  - `src/content/index.ts` - 添加 PDF 检测和初始化逻辑
  - `src/content/translation-popup.ts` - 适配 PDF 环境
  - `src/manifest.json` - 添加 web_accessible_resources 配置

- **依赖添加**:
  - `pdfjs-dist` - Mozilla PDF.js 库

## ADDED Requirements

### Requirement: PDF 自动拦截
当用户访问 PDF 文件时，插件应自动拦截并使用内置 PDF.js 查看器打开。

#### Scenario: 访问 PDF 文件
- **WHEN** 用户访问以 `.pdf` 结尾的 URL
- **THEN** 插件自动重定向到 PDF.js 查看器并加载该 PDF

### Requirement: PDF 文本可选择
使用 PDF.js 渲染的 PDF 内容应支持文本选择。

#### Scenario: 在 PDF 中选择文本
- **WHEN** 用户在 PDF.js 查看器中打开 PDF
- **AND** 用户拖动鼠标选择文本
- **THEN** 文本被高亮选中，可以触发划词翻译

### Requirement: PDF 划词翻译
在 PDF 中选择的文本应触发与网页相同的划词翻译流程。

#### Scenario: PDF 划词翻译
- **WHEN** 用户在 PDF 中选择文本
- **THEN** 显示翻译弹窗
- **AND** 调用 DeepLX API 进行翻译
- **AND** 显示翻译结果

### Requirement: 配置统一
PDF 划词翻译应使用与网页划词翻译相同的配置。

#### Scenario: 禁用划词翻译
- **WHEN** 用户在设置中禁用划词翻译
- **THEN** PDF 中的划词翻译也被禁用

## MODIFIED Requirements

无修改的需求。

## REMOVED Requirements

无移除的需求。

## 技术方案

### 1. PDF 拦截策略

使用 `chrome.webNavigation.onBeforeNavigate` 监听导航事件，检测 PDF URL 并重定向到本地 PDF.js 查看器。

### 2. PDF.js 集成

- 使用 `pdfjs-dist` 库
- 将 PDF.js 文件放入 `public/pdfjs/` 目录
- 通过 `chrome.runtime.getURL` 获取资源路径

### 3. 文本选择检测

PDF.js 渲染的文本层支持标准的选择事件，复用现有的 `SelectionDetector` 逻辑。

### 4. 翻译流程

复用现有的翻译弹窗和 API 调用逻辑，无需修改。

## UI 设计

- 复用现有的 `TranslationPopup` 组件
- 支持 Light / Dark / Cyber 三种主题
- 保持与网页划词翻译一致的交互体验
