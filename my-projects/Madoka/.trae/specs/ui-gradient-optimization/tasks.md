# UI渐变优化任务列表

## Step 1: 数据层扩充
- [x] Task 1.1: 修改theme.ts，为所有4种主题添加accentPrimaryRgb和accentSecondaryRgb
  - [x] SubTask 1.1.1: Light主题添加RGB变量
  - [x] SubTask 1.1.2: Dark主题添加RGB变量  
  - [x] SubTask 1.1.3: Cyber主题添加RGB变量
  - [x] SubTask 1.1.4: Neon主题添加RGB变量

## Step 2: 样式库更新
- [x] Task 2.1: 在index.css末尾追加CSS动画和减少动画支持
  - [x] SubTask 2.1.1: 添加gradient-flow流光动画关键帧
  - [x] SubTask 2.1.2: 添加pulse-glow脉冲光晕动画
  - [x] SubTask 2.1.3: 添加prefers-reduced-motion媒体查询

## Step 3: 组件重构
- [x] Task 3.1: 更新Welcome.tsx，Logo应用渐变+彩色光晕
  - [x] SubTask 3.1.1: 替换Logo类名为渐变背景
  - [x] SubTask 3.1.2: 添加box-shadow彩色光晕效果
  - [x] SubTask 3.1.3: 添加hover状态增强效果

- [x] Task 3.2: 更新App.tsx
  - [x] SubTask 3.2.1: 主容器背景改为边缘晕染渐变
  - [x] SubTask 3.2.2: QuickPrompt按钮添加hover光泽效果

- [x] Task 3.3: 更新ThemeToggle.tsx
  - [x] SubTask 3.3.1: ThemeToggleSwitch开关轨道添加选中/未选中渐变
  - [x] SubTask 3.3.2: ThemeSelector选中项添加渐变+内阴影

- [x] Task 3.4: 更新SettingsPanel.tsx
  - [x] SubTask 3.4.1: 搜索引擎Tab选中状态添加渐变
  - [x] SubTask 3.4.2: 保存按钮添加gradient-flow类
  - [x] SubTask 3.4.3: Toggle开关添加渐变层次效果

## Step 4: 验证与测试
- [x] Task 4.1: 视觉验证 - 切换4种主题确认渐变色和谐
- [x] Task 4.2: 对比度检查 - Light主题下渐变按钮文字清晰
- [x] Task 4.3: 动画性能 - 确认只有保存按钮在流动
- [x] Task 4.4: 无障碍测试 - 开启减少动画确认效果停止

# Task Dependencies
- Task 1.1 必须在 Task 2.1 之前完成
- Task 2.1 必须在 Task 3.x 之前完成
- Task 3.x 可以并行执行
- Task 4.x 必须在所有Task 3.x完成后执行
