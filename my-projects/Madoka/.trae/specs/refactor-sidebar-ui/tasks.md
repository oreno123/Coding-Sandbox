# Tasks

- [x] Task 1: 创建 ConversationSelector 组件
  - [x] SubTask 1.1: 创建 `src/sidepanel/components/ConversationSelector.tsx` 组件文件
  - [x] SubTask 1.2: 实现按日期分组显示对话列表（Today, Yesterday, Previous 7 Days, Older）
  - [x] SubTask 1.3: 实现当前对话高亮和切换功能
  - [x] SubTask 1.4: 实现删除对话功能
  - [x] SubTask 1.5: 添加空状态提示

- [x] Task 2: 修改 ChatContext 移除 sidebarOpen 状态
  - [x] SubTask 2.1: 从 ChatState 中移除 sidebarOpen 字段
  - [x] SubTask 2.2: 移除 toggleSidebar 方法
  - [x] SubTask 2.3: 更新相关类型定义

- [x] Task 3: 修改 Composer 组件添加对话管理按钮
  - [x] SubTask 3.1: 在 Composer 底部工具栏左侧添加新对话按钮
  - [x] SubTask 3.2: 在新对话按钮旁添加对话选择器按钮
  - [x] SubTask 3.3: 集成 ConversationSelector 下拉组件
  - [x] SubTask 3.4: 添加设置页面入口按钮

- [x] Task 4: 重构 App.tsx 主布局
  - [x] SubTask 4.1: 移除 Sidebar 组件引用
  - [x] SubTask 4.2: 移除 sidebarOpen 相关的条件渲染逻辑
  - [x] SubTask 4.3: 简化 header 组件（移除侧边栏切换按钮）
  - [x] SubTask 4.4: 确保设置页面和记忆页面正常显示

- [x] Task 5: 清理无用代码
  - [x] SubTask 5.1: 删除或简化 `src/sidepanel/components/layout/Sidebar.tsx`
  - [x] SubTask 5.2: 删除 `src/sidepanel/components/sidebar/` 目录下的组件（如不再需要）
  - [x] SubTask 5.3: 清理 CSS 中与侧边栏相关的样式

- [x] Task 6: 构建并验证
  - [x] SubTask 6.1: 运行 `npm run build` 确保无编译错误
  - [x] SubTask 6.2: 测试新对话创建功能
  - [x] SubTask 6.3: 测试对话切换功能
  - [x] SubTask 6.4: 测试设置页面入口和返回

# Task Dependencies
- [Task 2] 应在 [Task 3] 之前完成（Composer 需要使用更新后的 Context）
- [Task 3] 应在 [Task 1] 之后完成（需要 ConversationSelector 组件）
- [Task 4] 应在 [Task 2] 之后完成（App.tsx 需要使用更新后的 Context）
- [Task 5] 应在 [Task 4] 之后完成（先完成重构再清理）
- [Task 6] 应在所有任务之后执行
