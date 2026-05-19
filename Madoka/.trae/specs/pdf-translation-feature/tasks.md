# Tasks

- [ ] Task 1: 安装 pdf.js 依赖
  - [ ] SubTask 1.1: 运行 `npm install pdfjs-dist` 安装依赖
  - [ ] SubTask 1.2: 配置 pdf.js worker

- [ ] Task 2: 创建 PDF 解析工具函数
  - [ ] SubTask 2.1: 创建 `src/shared/pdf-utils.ts` 文件
  - [ ] SubTask 2.2: 实现 PDF 文本提取函数
  - [ ] SubTask 2.3: 实现文本分段函数

- [ ] Task 3: 添加分段翻译 API
  - [ ] SubTask 3.1: 在 `src/background/api.ts` 添加批量翻译函数
  - [ ] SubTask 3.2: 实现分段翻译逻辑
  - [ ] SubTask 3.3: 添加翻译进度回调

- [ ] Task 4: 创建 PDF 翻译组件
  - [ ] SubTask 4.1: 创建 `src/sidepanel/components/PdfTranslator.tsx`
  - [ ] SubTask 4.2: 实现文件上传 UI
  - [ ] SubTask 4.3: 实现翻译进度显示
  - [ ] SubTask 4.4: 实现翻译结果展示
  - [ ] SubTask 4.5: 实现导出功能

- [ ] Task 5: 集成到 Composer
  - [ ] SubTask 5.1: 在 Composer 工具栏添加 PDF 上传按钮
  - [ ] SubTask 5.2: 连接文件选择和翻译流程
  - [ ] SubTask 5.3: 处理翻译状态和错误

- [ ] Task 6: 添加消息处理
  - [ ] SubTask 6.1: 在 background 添加 PDF 翻译消息处理
  - [ ] SubTask 6.2: 实现前端与 background 通信

- [ ] Task 7: 构建验证
  - [ ] SubTask 7.1: 运行 `npm run build` 确保无错误
  - [ ] SubTask 7.2: 测试 PDF 上传和翻译功能

# Task Dependencies
- [Task 2] 依赖 [Task 1]（需要 pdf.js 依赖）
- [Task 3] 可以与 [Task 2] 并行
- [Task 4] 依赖 [Task 2] 和 [Task 3]
- [Task 5] 依赖 [Task 4]
- [Task 6] 依赖 [Task 3]
- [Task 7] 应在所有任务之后执行
