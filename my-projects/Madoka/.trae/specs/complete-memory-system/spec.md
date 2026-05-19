# 完善记忆系统功能 Spec

## Why

根据功能检查报告，记忆系统的核心后端代码已存在，但缺少关键的 UI 入口和对话流程集成。用户无法：
1. 选择 Obsidian 库目录进行同步
2. 手动触发 Obsidian 同步
3. 自动保存对话记忆
4. 按板块携带记忆上下文提问

本 spec 旨在补全这些缺失功能，使记忆系统完整可用。

## What Changes

- **新增**: SettingsPanel 中选择 Obsidian 库目录按钮
- **新增**: SettingsPanel 中手动同步到 Obsidian 按钮
- **新增**: 对话结束后自动解析 LLM 返回的 JSON 并保存记忆
- **新增**: 输入框上方板块选择组件（本次导入）
- **新增**: 发送消息时自动携带选中板块的记忆上下文

## Impact

- Affected specs: 记忆系统设置、Obsidian 同步、对话流程
- Affected code:
  - `src/sidepanel/components/SettingsPanel.tsx`
  - `src/background/index.ts`
  - `src/sidepanel/components/ChatInput.tsx` (或新建)
  - `src/sidepanel/context/ChatContext.tsx`

## ADDED Requirements

### Requirement: Obsidian 库目录选择

The system SHALL provide a button in SettingsPanel to select Obsidian vault directory.

#### Scenario: Success case
- **GIVEN** 用户在设置页面
- **WHEN** 点击「选择 Obsidian 库目录」按钮
- **THEN** 弹出文件选择器，用户选择目录后保存句柄到 IndexedDB

#### Scenario: Permission denied
- **GIVEN** 用户拒绝授予目录权限
- **THEN** 显示错误提示，不保存句柄

### Requirement: 手动同步到 Obsidian

The system SHALL provide a button to manually sync unsynced memories to Obsidian.

#### Scenario: Success case
- **GIVEN** 用户在设置页面且已选择 Obsidian 目录
- **WHEN** 点击「立即同步到 Obsidian」按钮
- **THEN** 只同步 syncStatus 不为 'success' 的记忆到 Obsidian
- **AND** 更新同步状态到 IndexedDB
- **AND** 显示同步结果（成功/失败数量）

#### Scenario: No directory selected
- **GIVEN** 用户未选择 Obsidian 目录
- **WHEN** 点击同步按钮
- **THEN** 提示用户先选择目录

### Requirement: 自动保存对话记忆

The system SHALL automatically save conversation memories after each assistant response.

#### Scenario: Memory enabled
- **GIVEN** 记忆功能已启用
- **WHEN** 助手回复完成
- **THEN** 解析回复末尾的 JSON 代码块
- **AND** 提取 memory 和 profile 数据
- **AND** 调用 memoryAddEpisode 保存记忆
- **AND** 调用 memorySaveUserProfile 更新画像

#### Scenario: Memory disabled
- **GIVEN** 记忆功能已禁用
- **WHEN** 助手回复完成
- **THEN** 不执行记忆保存逻辑

#### Scenario: JSON parse failed
- **GIVEN** 助手回复不包含有效 JSON
- **WHEN** 解析失败
- **THEN** 静默失败，不影响对话流程

### Requirement: 板块选择（本次导入）

The system SHALL provide a block selection UI above the chat input.

#### Scenario: Display blocks
- **GIVEN** 用户打开侧边栏
- **THEN** 在输入框上方显示所有可用板块列表
- **AND** 板块从 memoryGetBlockList 获取

#### Scenario: Select blocks
- **GIVEN** 板块列表已显示
- **WHEN** 用户点击一个或多个板块
- **THEN** 高亮选中的板块
- **AND** 记录选中的板块到状态

### Requirement: 携带记忆上下文发送

The system SHALL automatically include selected blocks' memories in the conversation context.

#### Scenario: Send with blocks selected
- **GIVEN** 用户选中了某些板块
- **WHEN** 用户发送消息
- **THEN** 调用 memoryQuery 获取选中板块的记忆
- **AND** 将记忆内容拼接到 system prompt
- **AND** 同时携带人物画像

#### Scenario: No blocks selected
- **GIVEN** 用户未选中任何板块
- **WHEN** 用户发送消息
- **THEN** 不携带额外记忆上下文
