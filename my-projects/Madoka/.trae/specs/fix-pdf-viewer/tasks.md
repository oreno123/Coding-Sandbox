# Tasks

- [ ] Task 1: 删除 viewer-wrapper 文件
  - [ ] SubTask 1.1: 删除 public/pdfjs/viewer-wrapper.html
  - [ ] SubTask 1.2: 删除 public/pdfjs/viewer-wrapper.js

- [ ] Task 2: 创建 viewer-config.js
  - [ ] SubTask 2.1: 配置 PDFViewerApplicationOptions
  - [ ] SubTask 2.2: 实现 URL 参数解析
  - [ ] SubTask 2.3: 实现 PDF 加载逻辑

- [ ] Task 3: 修改 viewer.html
  - [ ] SubTask 3.1: 添加 viewer-config.js 引用

- [ ] Task 4: 修改 pdf-handler.ts
  - [ ] SubTask 4.1: 直接重定向到 web/viewer.html

- [ ] Task 5: 构建验证
  - [ ] SubTask 5.1: 运行 npm run build
  - [ ] SubTask 5.2: 测试 PDF 加载

# Task Dependencies
- [Task 2] 依赖 [Task 1]
- [Task 3] 依赖 [Task 2]
- [Task 4] 依赖 [Task 3]
- [Task 5] 应在所有任务之后执行
