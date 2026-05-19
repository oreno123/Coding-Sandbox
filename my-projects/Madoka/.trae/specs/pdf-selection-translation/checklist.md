# Checklist

## PDF.js 依赖和配置
- [ ] pdfjs-dist 已安装
- [ ] PDF.js worker 路径配置正确
- [ ] PDF.js 文件在 public/pdfjs/ 目录

## PDF 拦截处理器
- [ ] pdf-handler.ts 文件创建
- [ ] PDF URL 检测函数正常工作
- [ ] PDF.js 查看器重定向正常

## Manifest 配置
- [ ] web_accessible_resources 配置正确
- [ ] 权限配置完整

## Content Script 集成
- [ ] PDF 环境检测正常
- [ ] 划词翻译在 PDF 页面初始化

## 翻译弹窗适配
- [ ] 弹窗在 PDF 环境正常显示
- [ ] 主题样式正确应用
- [ ] 拖拽和固定功能正常

## 构建验证
- [ ] 构建成功无错误
- [ ] PDF 拦截功能正常
- [ ] PDF 划词翻译功能正常
- [ ] 网页划词翻译不受影响
