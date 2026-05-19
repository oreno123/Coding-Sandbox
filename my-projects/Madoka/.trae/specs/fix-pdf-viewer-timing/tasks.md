# Tasks

- [x] Task 1: 修复 viewer-config.js 时序问题
  - [x] SubTask 1.1: 分析当前 waitForPDFViewerApplication 实现
  - [x] SubTask 1.2: 修改等待逻辑，使用 initializedPromise
  - [x] SubTask 1.3: 添加更可靠的初始化检测

- [x] Task 2: 添加缺失的本地化翻译
  - [x] SubTask 2.1: 检查 locale/locale.json 结构
  - [x] SubTask 2.2: 添加 Madoka 按钮翻译键
  - [x] SubTask 2.3: 添加其他缺失的翻译键

- [x] Task 3: 构建和验证
  - [x] SubTask 3.1: 运行 npm run build
  - [x] SubTask 3.2: 测试 PDF 加载
  - [x] SubTask 3.3: 验证控制台无错误

# Task Dependencies
- [Task 2] 依赖 [Task 1]
- [Task 3] 应在所有任务之后执行
