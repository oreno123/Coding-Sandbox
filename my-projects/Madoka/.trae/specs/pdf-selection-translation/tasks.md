# Tasks

- [ ] Task 1: 检查 PDF.js 依赖和配置
  - [ ] SubTask 1.1: 确认 pdfjs-dist 已安装
  - [ ] SubTask 1.2: 配置 PDF.js worker 路径
  - [ ] SubTask 1.3: 将 PDF.js 文件复制到 public/pdfjs/

- [ ] Task 2: 创建 PDF 拦截处理器
  - [ ] SubTask 2.1: 创建 `src/content/pdf-handler.ts`
  - [ ] SubTask 2.2: 实现 PDF URL 检测函数
  - [ ] SubTask 2.3: 实现 PDF.js 查看器重定向

- [ ] Task 3: 修改 manifest.json
  - [ ] SubTask 3.1: 添加 web_accessible_resources 配置
  - [ ] SubTask 3.2: 添加 webNavigation 权限（如需要）

- [ ] Task 4: 集成到 content/index.ts
  - [ ] SubTask 4.1: 添加 PDF 环境检测
  - [ ] SubTask 4.2: 在 PDF.js 页面初始化划词翻译

- [ ] Task 5: 适配翻译弹窗
  - [ ] SubTask 5.1: 检查 translation-popup.ts 在 PDF 环境的兼容性
  - [ ] SubTask 5.2: 修复可能的样式或 DOM 问题

- [ ] Task 6: 构建验证
  - [ ] SubTask 6.1: 运行 `npm run build` 确保无错误
  - [ ] SubTask 6.2: 测试 PDF 拦截功能
  - [ ] SubTask 6.3: 测试 PDF 划词翻译

# Task Dependencies
- [Task 2] 依赖 [Task 1]（需要 PDF.js 文件）
- [Task 4] 依赖 [Task 2] 和 [Task 3]
- [Task 5] 依赖 [Task 4]
- [Task 6] 应在所有任务之后执行
