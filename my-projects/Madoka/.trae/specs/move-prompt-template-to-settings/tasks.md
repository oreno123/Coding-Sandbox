# Tasks

- [x] Task 1: 在 SettingsPanel 中添加提示词模板管理入口
  - [x] SubTask 1.1: 导入 PromptTemplateManager 组件和 usePromptTemplates hook
  - [x] SubTask 1.2: 在设置面板最下方添加"提示词模板"区域
  - [x] SubTask 1.3: 显示当前激活模板名称和"管理模板"按钮
  - [x] SubTask 1.4: 实现点击按钮打开 PromptTemplateManager

- [x] Task 2: 修改 PromptTemplateManager 样式支持多主题
  - [x] SubTask 2.1: 将硬编码样式改为 CSS 变量
  - [x] SubTask 2.2: 背景色使用 `--bg-primary`, `--bg-secondary`
  - [x] SubTask 2.3: 文字色使用 `--text-primary`, `--text-muted`
  - [x] SubTask 2.4: 边框色使用 `--border-primary`
  - [x] SubTask 2.5: 强调色使用 `--accent-primary`, `--accent-secondary`

- [x] Task 3: 从 Composer 中移除模板选择器
  - [x] SubTask 3.1: 移除模板选择器按钮代码
  - [x] SubTask 3.2: 移除 TemplateIcon 组件
  - [x] SubTask 3.3: 移除相关 state 和逻辑（保留 PromptTemplateManager 引用用于设置面板）

# Task Dependencies
- Task 2 可以并行执行
- Task 3 可以并行执行
- Task 1 需要在 Task 2 完成后验证样式
