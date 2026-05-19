# 点击对话区域自动收起侧边栏 V2 Spec

## Why

用户希望点击侧边栏右边对话区域的空白部分和对话框（消息气泡）时都能收起左边历史记录，但点击消息内的具体内容（文字、按钮等）时不触发。

## What Changes

- 修改 MessageList 组件，点击空白区域时触发 toggleSidebar
- 修改 Message 组件，点击对话框气泡时触发 toggleSidebar，但点击内容时阻止冒泡

## Impact

- Affected code:
  - `src/sidepanel/components/MessageList.tsx` - 空白区域点击事件
  - `src/sidepanel/components/Message.tsx` - 对话框点击事件

## ADDED Requirements

### Requirement: 点击空白区域收起侧边栏

The system SHALL call toggleSidebar when user clicks on the empty area of message list.

#### Scenario: User clicks empty area
- **GIVEN** 侧边栏处于展开状态
- **WHEN** 用户点击消息列表的空白区域
- **THEN** 自动调用 toggleSidebar 收起侧边栏

### Requirement: 点击对话框收起侧边栏

The system SHALL call toggleSidebar when user clicks on the message bubble.

#### Scenario: User clicks message bubble
- **GIVEN** 侧边栏处于展开状态
- **WHEN** 用户点击消息对话框（气泡）
- **THEN** 自动调用 toggleSidebar 收起侧边栏

#### Scenario: User clicks message content
- **GIVEN** 侧边栏处于展开状态
- **WHEN** 用户点击消息内的具体内容（文字、按钮、链接等）
- **THEN** 不触发收起操作
- **AND** 消息的正常交互功能正常工作

## REMOVED Requirements

None
