# 点击对话区域自动收起侧边栏 Spec

## Why

用户希望点击侧边栏右边的对话区域时，能够自动收起左边的历史记录部分，让界面更简洁。

## What Changes

- 修改 MessageList 组件，添加点击事件调用 toggleSidebar
- 修改 Message 组件，阻止事件冒泡避免误触发

## Impact

- Affected code:
  - `src/sidepanel/components/MessageList.tsx` - 添加点击事件
  - `src/sidepanel/components/Message.tsx` - 阻止事件冒泡

## ADDED Requirements

### Requirement: 点击对话区域收起侧边栏

The system SHALL call toggleSidebar when user clicks on the message list area.

#### Scenario: User clicks message list
- **GIVEN** 侧边栏处于展开状态
- **WHEN** 用户点击对话区域
- **THEN** 自动调用 toggleSidebar 收起侧边栏

#### Scenario: User clicks message content
- **GIVEN** 侧边栏处于展开状态
- **WHEN** 用户点击具体的消息内容
- **THEN** 不触发收起操作
- **AND** 消息的正常交互功能正常工作

## REMOVED Requirements

None
