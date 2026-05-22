# Checklist

## viewer-wrapper 文件删除
- [ ] viewer-wrapper.html 已删除
- [ ] viewer-wrapper.js 已删除

## viewer-config.js 创建
- [ ] PDFViewerApplicationOptions 配置正确
- [ ] disableOriginCheck: true 已设置
- [ ] URL 参数解析逻辑正确
- [ ] PDFViewerApplication.open() 调用正确

## viewer.html 修改
- [ ] viewer-config.js 引用已添加
- [ ] 加载顺序正确

## pdf-handler.ts 修改
- [ ] 直接重定向到 web/viewer.html
- [ ] URL 参数编码正确

## 构建验证
- [ ] 构建成功无错误
- [ ] PDF 能正常加载
- [ ] 划词翻译功能正常
