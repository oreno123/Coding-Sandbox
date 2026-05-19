# 优化记忆系统 Spec

## Why

当前记忆系统存在以下问题：
1. **JSON 代码块影响美观**：LLM 在回复末尾输出 JSON 代码块，用户可见，影响阅读体验
2. **记忆判定不够智能**：依赖 LLM 自行判断 `shouldPersist`，容易漏记或误记
3. **缺乏记忆读取验证**：无法确认 LLM 是否真正使用了携带的记忆上下文

## What Changes

- **移除 JSON 代码块**：改为使用 function calling 或隐藏格式，用户不可见
- **智能记忆判定**：基于内容特征自动判定是否值得记忆，而非依赖 LLM 判断
- **添加记忆读取标记**：在回复中检测 LLM 是否引用了记忆内容
- **优化记忆上下文格式**：更自然的融入对话，减少 token 消耗

## Impact

- Affected specs: 记忆系统、对话流程、LLM 交互
- Affected code:
  - `src/background/api.ts` - 修改 MEMORY_TAGS_INSTRUCTION
  - `src/background/index.ts` - 修改记忆保存逻辑
  - `src/background/memoryWorker.ts` - 修改记忆判定逻辑
  - `src/background/memoryScoring.ts` - 添加内容特征评分

## ADDED Requirements

### Requirement: 隐藏式记忆标签

The system SHALL use a hidden format for memory tags that users cannot see.

#### Scenario: Normal conversation
- **GIVEN** 用户发送消息且记忆功能启用
- **WHEN** LLM 生成回复
- **THEN** 记忆标签以不可见格式嵌入（如 XML 注释、特殊 token 或 function calling）
- **AND** 用户只能看到干净的回复内容

### Requirement: 智能记忆判定

The system SHALL automatically determine if content is worth remembering based on content features.

#### Scenario: Important information detected
- **GIVEN** 对话内容包含个人信息、偏好、重要事实
- **WHEN** 内容特征评分超过阈值
- **THEN** 自动标记为需要保存
- **AND** 无需 LLM 判断 shouldPersist

#### Scenario: Trivial conversation
- **GIVEN** 对话内容为日常寒暄、简单问答
- **WHEN** 内容特征评分低于阈值
- **THEN** 不保存记忆
- **AND** 不占用存储空间

### Requirement: 记忆使用检测

The system SHALL detect if LLM has utilized the provided memory context.

#### Scenario: Memory referenced
- **GIVEN** 对话携带了记忆上下文
- **WHEN** LLM 回复中引用了记忆内容
- **THEN** 系统检测到引用并记录
- **AND** 可用于评估记忆质量

#### Scenario: Memory ignored
- **GIVEN** 对话携带了记忆上下文
- **WHEN** LLM 回复未引用记忆内容
- **THEN** 系统记录记忆未被使用
- **AND** 可降低该记忆权重

## MODIFIED Requirements

### Requirement: Memory Context Format

**Current**: 明文拼接记忆内容到 system prompt

**Modified**: 使用更自然的格式，如：
```
[系统提示]
...
[相关背景]
- 用户之前提到：...
- 用户偏好：...
```

## REMOVED Requirements

### Requirement: JSON Code Block Output
**Reason**: 影响用户体验，过于显眼
**Migration**: 改用隐藏式标签

### Requirement: LLM shouldPersist Judgment
**Reason**: 不够稳定，容易误判
**Migration**: 使用基于规则的自动判定
