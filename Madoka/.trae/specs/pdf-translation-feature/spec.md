# PDF 翻译功能 Spec

## Why

用户经常需要翻译 PDF 文档，但目前插件只支持网页文本翻译。添加 PDF 翻译功能可以让用户直接上传 PDF 文件进行翻译，提升实用性。

## What Changes

- 添加 PDF 文件上传入口
- 使用 pdf.js 库解析 PDF 文本内容
- 实现分段翻译逻辑（处理长文档）
- 添加翻译进度显示
- 提供翻译结果导出功能

## Impact
- Affected specs: 无
- Affected code: 
  - `src/sidepanel/components/composer/Composer.tsx` - 添加 PDF 上传按钮
  - `src/background/api.ts` - 添加分段翻译 API
  - `src/sidepanel/components/` - 新增 PDF 翻译相关组件
  - `package.json` - 添加 pdf.js 依赖

## ADDED Requirements

### Requirement: PDF 文件上传
用户应能够上传 PDF 文件进行翻译。

#### Scenario: 上传 PDF 文件
- **WHEN** 用户点击 PDF 上传按钮
- **THEN** 系统打开文件选择对话框，筛选 PDF 文件

### Requirement: PDF 文本提取
系统应能够从 PDF 文件中提取文本内容。

#### Scenario: 提取 PDF 文本
- **WHEN** 用户选择 PDF 文件
- **THEN** 系统使用 pdf.js 提取所有页面的文本内容

### Requirement: 分段翻译
系统应将长 PDF 内容分段进行翻译。

#### Scenario: 翻译长文档
- **WHEN** PDF 内容超过一定长度
- **THEN** 系统将内容分段，逐段翻译并显示进度

### Requirement: 翻译进度显示
系统应显示翻译进度。

#### Scenario: 显示翻译进度
- **WHEN** 正在翻译 PDF
- **THEN** 显示当前翻译进度（如 "正在翻译第 3/10 段"）

### Requirement: 翻译结果展示
系统应以清晰的方式展示翻译结果。

#### Scenario: 展示翻译结果
- **WHEN** 翻译完成
- **THEN** 显示原文和译文对照，或仅显示译文

### Requirement: 翻译结果导出
用户应能够导出翻译结果。

#### Scenario: 导出翻译结果
- **WHEN** 用户点击导出按钮
- **THEN** 将翻译结果保存为文本文件或 Markdown 文件

## MODIFIED Requirements

无修改的需求。

## REMOVED Requirements

无移除的需求。

## 技术方案

### 依赖库
- `pdfjs-dist` - Mozilla 的 PDF.js 库，用于解析 PDF

### 实现流程
1. 用户点击 PDF 上传按钮
2. 选择 PDF 文件
3. 使用 pdf.js 提取文本内容
4. 将文本分段（每段约 2000 字符）
5. 逐段调用翻译 API
6. 显示翻译进度
7. 完成后展示结果，提供导出选项

### UI 设计
- 在 Composer 工具栏添加 PDF 上传按钮
- 翻译过程中显示进度条
- 翻译完成后在消息区域显示结果
- 提供"复制译文"和"导出文件"按钮
