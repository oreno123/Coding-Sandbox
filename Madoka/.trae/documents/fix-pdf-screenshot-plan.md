# 修复 PDF 界面截图功能的计划

## 问题描述
在 PDF.js 查看器页面（chrome-extension://.../public/pdfjs/web/viewer.html）无法使用截图功能。

## 问题根源

1. **Content Script 未注入 PDF.js 查看器页面**
   - Chrome 扩展的 content script **默认不会注入到扩展自己的页面**（包括 `chrome-extension://` 协议的页面）
   - PDF.js 查看器是通过 `chrome.runtime.getURL('public/pdfjs/web/viewer.html')` 打开的，属于扩展页面

2. **截图功能依赖 Content Script**
   - 截图功能（`showRegionSelector` 和 `cropScreenshot`）是在 `src/content/index.ts` 中实现的
   - 当用户点击截图按钮时，`background/index.ts` 发送消息到当前标签页的 content script
   - 但 PDF 查看器页面没有注入 content script，所以无法响应截图请求

## 修复方案

采用**动态脚本注入方案**：
- 在 `background/index.ts` 中检测当前标签页是否为 PDF 查看器页面
- 如果是，使用 `chrome.scripting.executeScript` 动态注入截图功能
- 这种方式不需要修改第三方 PDF.js 的文件

## 实施步骤

### 任务 1: 提取截图功能为独立模块
- **文件**: 新建 `src/content/screenshot-injectable.ts`
- **内容**: 将 `showRegionSelector` 和 `cropScreenshot` 函数提取为可独立注入的代码
- **说明**: 确保代码不依赖 content script 的其他功能，可以独立运行

### 任务 2: 修改 background/index.ts
- **文件**: `src/background/index.ts`
- **修改**: 
  - 在 `startRegionCapture` 处理中检测是否为 PDF 查看器页面
  - 如果是 PDF 查看器页面，使用 `chrome.scripting.executeScript` 注入并执行区域选择器
  - 截图完成后通过消息传递回 background

### 任务 3: 测试验证
- 在普通网页测试截图功能（确保不破坏原有功能）
- 在 PDF 查看器页面测试截图功能
- 验证截图能正确附加到消息中并发送给 AI

## 技术细节

### PDF 查看器页面检测
```typescript
function isPdfViewerPage(url: string): boolean {
  return url.includes('/public/pdfjs/web/viewer.html')
}
```

### 动态脚本注入流程
1. 用户点击截图按钮
2. Background 检测当前页面是否为 PDF 查看器
3. 如果是，使用 `chrome.scripting.executeScript` 注入 `showRegionSelector` 函数
4. 用户选择区域后，使用 `chrome.tabs.captureVisibleTab` 截图
5. 再次注入 `cropScreenshot` 函数进行裁剪
6. 将结果返回给侧边栏

## 风险与注意事项

1. **权限检查**: 确保 `manifest.json` 中有 `scripting` 权限（已有）
2. **错误处理**: 需要处理脚本注入失败的情况
3. **用户体验**: 保持与普通页面截图相同的交互体验
