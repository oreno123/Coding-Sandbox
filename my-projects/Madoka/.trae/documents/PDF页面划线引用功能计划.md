# PDF 页面划线引用功能注入计划

## 问题分析

### 当前状态
1. **划线引用功能**：已在 `src/content/index.ts` 中实现 `setupSelectionStorage()` 函数
2. **PDF 查看器**：使用 `public/pdfjs/web/viewer.html` 作为 PDF 查看器
3. **Content Script 注入**：manifest.json 配置了 `<all_urls>` 匹配，理论上会注入到 PDF 查看器页面

### 问题原因
PDF.js 使用 Canvas 渲染 PDF，文本选择行为与普通 DOM 不同：
1. PDF.js 的文本层（text layer）是覆盖在 Canvas 上的透明 DOM 层
2. 文本层的选择事件可能被 PDF.js 内部处理拦截
3. 需要确保 content script 正确初始化并监听 PDF 文本层的选择事件

### 验证点
- 检查 `window.getSelection()` 在 PDF 文本层上是否正常工作
- 检查 `selectionchange` 和 `mouseup` 事件是否被正确触发

## 解决方案

### 方案：修改 content script 以支持 PDF 文本层

在 `src/content/index.ts` 中增强 PDF 页面的划线引用功能：

1. **检测 PDF 文本层加载完成**
   - PDF.js 的文本层是异步渲染的
   - 需要等待文本层 DOM 元素出现后再绑定事件

2. **针对 PDF 文本层的事件监听**
   - 监听 PDF.js 的 `textlayerrendered` 事件
   - 或使用 MutationObserver 监听文本层 DOM 的创建

3. **确保选择功能正常工作**
   - PDF 文本层使用 `span` 元素包裹每个字符/词
   - 标准的 `window.getSelection()` 应该可以正常获取选中文本

## 实现步骤

### 步骤 1：修改 `src/content/index.ts`
在 `init()` 函数中，针对 PDF 查看器页面添加特殊处理：
- 等待 PDF 文本层加载完成
- 确保划线引用功能在 PDF 文本层上正常工作

### 步骤 2：添加 PDF 文本层检测逻辑
- 使用 MutationObserver 监听 `#viewer` 容器的 DOM 变化
- 检测 `.textLayer` 元素的出现
- 在文本层加载完成后初始化划线引用功能

### 步骤 3：测试验证
- 在 PDF 查看器中选择文本
- 验证划线引用是否正确保存
- 验证 sidepanel 中的 SelectionRefBar 是否正确显示

## 代码修改位置

- `src/content/index.ts`：添加 PDF 文本层检测和初始化逻辑
