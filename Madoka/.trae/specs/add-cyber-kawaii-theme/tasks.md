# Tasks

## Task 1: 添加 Cyber 主题 CSS 变量
- [x] 修改 `src/sidepanel/index.css`
- [x] 添加 `[data-theme="cyber"]` 选择器
- [x] 定义 Cyber 主题的核心颜色变量：
  - [x] 背景色系：`--bg-primary: #1A0B2E`, `--bg-secondary: #2D1B4E`
  - [x] 文字色系：`--text-primary: #F0F0FF`
  - [x] 强调色系：`--accent-primary: #FF4D8D`, `--accent-secondary: #00F0FF`
  - [x] 装饰色：`--accent-gold: #FFD93D`
- [x] 添加霓虹发光阴影变量：
  - [x] `--shadow-neon-pink: 0 0 15px rgba(255, 77, 141, 0.6)`
  - [x] `--shadow-neon-cyan: 0 0 15px rgba(0, 240, 255, 0.6)`
- [x] 添加毛玻璃效果变量：
  - [x] `--glass-bg: rgba(45, 27, 78, 0.4)`
  - [x] `--glass-border: rgba(255, 255, 255, 0.15)`
- [x] 更新消息气泡颜色适配 Cyber 主题

**Dependencies**: None

## Task 2: 更新 Tailwind 配置
- [x] 修改 `tailwind.config.js`
- [x] 添加 cyber 色系到 theme.extend.colors
- [x] 添加霓虹阴影到 theme.extend.boxShadow

**Dependencies**: None

## Task 3: 更新主题类型定义
- [x] 查找主题相关类型定义文件
- [x] 将主题类型从 `'light' | 'dark'` 扩展为 `'light' | 'dark' | 'cyber'`

**Dependencies**: None

## Task 4: 更新设置面板主题选择器
- [x] 修改 `src/sidepanel/components/SettingsPanel.tsx`
- [x] 添加 Cyber 主题选项到主题选择器
- [x] 更新主题切换逻辑支持三种主题

**Dependencies**: Task 3

## Task 5: 添加 Cyber 主题专属样式类
- [x] 在 `src/sidepanel/index.css` 中添加 Cyber 专属样式类：
  - [x] `.cyber-glass-panel` - 毛玻璃面板
  - [x] `.cyber-btn-primary` - 发光按钮
  - [x] `.cyber-tech-border` - 科技边框
- [x] 确保样式类只在 Cyber 主题下生效

**Dependencies**: Task 1

## Task 6: 验证和测试
- [x] 运行 `npm run build` 确保无编译错误
- [x] 测试主题切换功能：
  - [x] Light → Dark 切换正常
  - [x] Dark → Cyber 切换正常
  - [x] Cyber → Light 切换正常
- [x] 验证 Cyber 主题视觉效果：
  - [x] 背景色正确显示
  - [x] 霓虹发光效果正常
  - [x] 毛玻璃效果正常
- [x] 验证主题偏好持久化：
  - [x] 刷新页面后主题保持

**Dependencies**: Task 1, Task 2, Task 3, Task 4, Task 5

# Task Dependencies

```
Task 3 depends on None (可并行)
Task 4 depends on Task 3
Task 5 depends on Task 1
Task 6 depends on Task 1, Task 2, Task 3, Task 4, Task 5
```

# Parallelizable Work

- Task 1, Task 2, Task 3 可以并行执行
