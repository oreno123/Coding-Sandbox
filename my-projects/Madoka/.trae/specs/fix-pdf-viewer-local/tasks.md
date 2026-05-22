# Tasks

- [x] Task 1: 修复 isPdfViewerPage 路径检测
  - [x] SubTask 1.1: 修改 src/content/pdf-handler.ts 中的路径检查

- [x] Task 2: 重构 viewer-config.js 初始化逻辑
  - [x] SubTask 2.1: 移除 setTimeout 延迟启动
  - [x] SubTask 2.2: 使用正确的事件监听方式
  - [x] SubTask 2.3: 确保 PDF.js 能自动使用 defaultUrl

- [x] Task 3: 验证修复
  - [x] SubTask 3.1: 运行 npm run build
  - [x] SubTask 3.2: 测试 PDF 加载功能

# Task Dependencies

- [Task 2] 和 [Task 1] 可以并行执行
- [Task 3] 依赖 [Task 1] 和 [Task 2]
