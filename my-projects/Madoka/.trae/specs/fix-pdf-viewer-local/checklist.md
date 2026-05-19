# Checklist

## isPdfViewerPage 路径修复
- [x] 路径检查从 `/public/pdfjs/viewer.html` 改为 `/public/pdfjs/web/viewer.html`
- [x] PDF Viewer 页面能正确识别

## viewer-config.js 初始化修复
- [x] 移除 setTimeout 延迟启动
- [x] 正确监听 webviewerloaded 事件
- [x] PDF.js 能自动加载 defaultUrl

## 构建验证
- [x] npm run build 成功无错误
- [ ] 点击"使用 Madoka 查看"能正确加载 PDF
- [ ] PDF 页面划词翻译功能正常
