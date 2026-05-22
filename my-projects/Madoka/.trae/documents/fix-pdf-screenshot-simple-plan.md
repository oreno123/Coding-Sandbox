# 修复 PDF 界面截图功能 - 简单集成方案

## 方案概述
直接在 PDF.js viewer.html 中添加截图按钮和脚本，避免复杂的动态注入逻辑。

## 实施步骤

### 任务 1: 创建 PDF 截图脚本
- **文件**: `public/pdfjs/web/madoka-screenshot.js`
- **功能**: 
  - 区域选择器（showRegionSelector）
  - 截图裁剪（cropScreenshot）
  - 与 background 通信

### 任务 2: 修改 viewer.html
- **文件**: `public/pdfjs/web/viewer.html`
- **修改内容**:
  1. 在 toolbar 中添加截图按钮（在 Madoka 按钮旁边）
  2. 引入 `madoka-screenshot.js` 脚本

### 任务 3: 修改 background/index.ts
- **文件**: `src/background/index.ts`
- **修改内容**:
  - 检测 PDF 查看器页面时，使用 `chrome.tabs.sendMessage` 发送消息
  - 监听来自 PDF 页面的截图结果消息

## 具体修改点

### 1. viewer.html 添加按钮（约第 562 行后）
在 Madoka 按钮后添加截图按钮：
```html
<button id="madokaScreenshotButton" class="toolbarButton" type="button" title="截图并发送到 Madoka" tabindex="0">
  <span>📷</span>
</button>
```

在 `</head>` 前添加脚本引用：
```html
<script src="madoka-screenshot.js"></script>
```

### 2. madoka-screenshot.js 功能
- 监听按钮点击
- 显示区域选择覆盖层
- 截图后发送到 background
- 与侧边栏通信

### 3. background/index.ts 修改
- 在 `startRegionCapture` 中检测是否为 PDF 查看器页面
- 如果是，发送消息到该标签页
- 监听 `pdfScreenshotCaptured` 消息

## 优势
1. 实现简单直接
2. 用户体验一致（PDF 页面有专门的截图按钮）
3. 不依赖复杂的脚本注入
4. 维护成本低

## 测试要点
1. 普通网页截图功能不受影响
2. PDF 页面截图按钮正常显示
3. 截图后能正确发送到侧边栏
4. 截图流程完整可用
