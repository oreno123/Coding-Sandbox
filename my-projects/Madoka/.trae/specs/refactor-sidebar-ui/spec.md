# 侧边栏 UI 重构 Spec

## Why
当前侧边栏占用空间且功能分散，用户需要点击展开侧边栏才能访问历史对话和新对话功能。通过移除侧边栏，将核心功能集成到输入框旁，可以简化界面、提升操作效率，同时让设置页面更加独立完整。

## What Changes
- **移除** Sidebar 组件的历史对话列表区域
- **移除** Sidebar 组件的整体折叠/展开逻辑
- **新增** Composer 输入框旁的对话管理按钮组（新对话 + 对话选择器）
- **新增** 独立的对话选择器下拉组件（ConversationSelector）
- **修改** SettingsPanel 为完全独立的设置页面
- **修改** App.tsx 布局结构，移除 Sidebar 相关逻辑
- **修改** ChatContext，移除 sidebarOpen 状态

## Impact
- Affected specs: 无
- Affected code:
  - `src/sidepanel/App.tsx` - 主布局重构
  - `src/sidepanel/components/layout/Sidebar.tsx` - 移除或大幅简化
  - `src/sidepanel/components/composer/Composer.tsx` - 添加对话管理按钮
  - `src/sidepanel/components/ConversationSelector.tsx` - 新组件
  - `src/sidepanel/context/ChatContext.tsx` - 移除 sidebarOpen 状态
  - `src/sidepanel/components/SettingsPanel.tsx` - 独立设置页面

## ADDED Requirements

### Requirement: 对话管理按钮组
系统应在 Composer 输入框左侧提供对话管理按钮组，包含：
- 新对话按钮：点击创建新对话
- 对话选择器按钮：点击展开下拉菜单，显示所有历史对话

#### Scenario: 创建新对话
- **WHEN** 用户点击新对话按钮
- **THEN** 系统创建新的空对话并切换到该对话

#### Scenario: 选择历史对话
- **WHEN** 用户点击对话选择器按钮
- **THEN** 系统显示下拉菜单，按日期分组展示所有历史对话
- **WHEN** 用户点击某个历史对话
- **THEN** 系统切换到该对话并关闭下拉菜单

### Requirement: 对话选择器组件
系统应提供 ConversationSelector 组件，功能包括：
- 按日期分组显示对话（Today, Yesterday, Previous 7 Days, Older）
- 显示对话标题和最后更新时间
- 支持删除对话
- 当前对话高亮显示

#### Scenario: 对话列表为空
- **WHEN** 没有任何历史对话
- **THEN** 显示"No conversations yet"提示

### Requirement: 独立设置页面
设置页面应作为完全独立的视图存在，不依赖侧边栏导航。

#### Scenario: 进入设置页面
- **WHEN** 用户点击设置入口
- **THEN** 系统切换到设置视图，显示完整设置面板

#### Scenario: 退出设置页面
- **WHEN** 用户点击设置页面的返回按钮
- **THEN** 系统返回到对话视图

## MODIFIED Requirements

### Requirement: 主布局结构
主布局应简化为单一内容区域，移除侧边栏折叠逻辑。

#### Scenario: 正常对话视图
- **WHEN** 用户处于对话模式
- **THEN** 显示消息列表和输入框，输入框旁有对话管理按钮

#### Scenario: 设置视图
- **WHEN** view 状态为 'settings'
- **THEN** 显示设置页面，隐藏对话界面

## REMOVED Requirements

### Requirement: 可折叠侧边栏
**Reason**: 功能已集成到输入框旁，不再需要独立侧边栏
**Migration**: 
- 历史对话列表 → ConversationSelector 下拉组件
- 新对话按钮 → Composer 左侧按钮
- 设置入口 → 顶部工具栏或 Composer 区域

### Requirement: sidebarOpen 状态
**Reason**: 不再需要侧边栏折叠状态
**Migration**: 从 ChatContext 中移除相关状态和方法
