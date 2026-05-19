# 分离文件引用与用户输入 Spec

## Why
当前文件引用内容被拼接到用户输入中一起发送，导致：
1. 用户输入框显示混乱（有 `@` 符号残留）
2. AI 看到的消息格式混杂，影响理解
3. 引用内容和用户查询混在一起

参考通义千问的实现方式：文件引用作为独立的消息项，使用 `mime_type` 标识，与用户输入完全分离。

## What Changes
- **修改**: Composer.tsx 的消息构建逻辑，分离上下文引用和用户输入
- **修改**: useChat hook 支持消息数组格式
- **修改**: background 处理消息数组，将上下文引用附加到系统提示词
- **新增**: 消息类型定义支持 `mime_type` 和 `meta_data`

## Impact
- Affected specs: 无
- Affected code:
  - `src/sidepanel/components/composer/Composer.tsx`
  - `src/sidepanel/hooks/useChat.ts`
  - `src/background/index.ts`
  - `src/shared/types.ts`

## ADDED Requirements

### Requirement: 消息数组格式支持
The system SHALL support sending messages as an array with mime_type metadata.

#### Scenario: 用户发送带引用的消息
- **WHEN** 用户输入查询并附加文件引用
- **THEN** 构建消息数组，上下文引用和用户输入作为独立项
- **AND** 上下文引用使用 `mime_type: "context/reference"`
- **AND** 用户输入使用 `mime_type: "text/plain"`

### Requirement: 上下文引用结构
The system SHALL structure context references with complete metadata.

#### Scenario: 构建上下文引用消息
- **WHEN** 构建上下文引用消息
- **THEN** 包含 `file_name`, `file_format`, `url`, `id`, `content`, `type`
- **AND** 元数据放在 `meta_data.resource_infos` 数组中

### Requirement: 系统提示词构建
The system SHALL append context references to system prompt.

#### Scenario: 发送消息到 AI
- **WHEN** background 处理消息数组
- **THEN** 提取上下文引用消息
- **AND** 将引用内容格式化为系统提示词附加内容
- **AND** 用户消息保持纯净

## MODIFIED Requirements
无

## REMOVED Requirements
无
