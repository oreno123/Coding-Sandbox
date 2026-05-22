# 改进记忆内容评分系统 Spec

## Why

当前记忆内容评分系统存在以下问题：
1. **评分维度单一**：仅依赖简单的正则匹配，无法准确评估内容价值
2. **阈值设置不合理**：60分阈值过高，导致重要个人信息无法被记住
3. **缺乏权重机制**：不同类型的信息应该有不同权重
4. **没有上下文感知**：无法根据对话上下文调整评分

## What Changes

- **多维度评分体系**：从内容类型、信息密度、用户意图等维度评分
- **动态阈值调整**：根据内容类型动态调整阈值
- **权重优先级系统**：个人信息 > 偏好 > 重要事实 > 一般信息
- **上下文感知评分**：考虑对话的连续性和上下文

## Impact

- Affected specs: 记忆系统、内容分析
- Affected code:
  - `src/background/memoryContentAnalyzer.ts` - 重构评分系统
  - `src/background/memoryScoring.ts` - 添加权重计算
  - `src/background/index.ts` - 调整记忆保存逻辑

## ADDED Requirements

### Requirement: 多维度评分体系

The system SHALL evaluate content from multiple dimensions to determine memory value.

#### Scenario: Personal information detected
- **GIVEN** 对话内容包含姓名、年龄、职业等个人信息
- **WHEN** 系统进行内容分析
- **THEN** 个人信息维度获得高分（30-40分）
- **AND** 该维度权重最高

#### Scenario: User preferences detected
- **GIVEN** 对话内容包含喜欢/不喜欢、偏好等
- **WHEN** 系统进行内容分析
- **THEN** 偏好维度获得中等分数（20-30分）
- **AND** 权重次于个人信息

#### Scenario: Important facts detected
- **GIVEN** 对话内容包含目标、计划、学习等
- **WHEN** 系统进行内容分析
- **THEN** 重要事实维度获得中等分数（15-25分）
- **AND** 权重适中

### Requirement: 动态阈值系统

The system SHALL use dynamic thresholds based on content type.

#### Scenario: High priority content
- **GIVEN** 内容包含明确的"记住"指令或个人信息
- **WHEN** 评估是否保存
- **THEN** 使用较低阈值（25-30分）
- **AND** 确保重要信息被保存

#### Scenario: Normal content
- **GIVEN** 内容不包含明确的记忆指令
- **WHEN** 评估是否保存
- **THEN** 使用标准阈值（40-50分）
- **AND** 过滤掉日常寒暄

### Requirement: 评分透明度

The system SHALL provide clear scoring details for debugging.

#### Scenario: Content analysis
- **GIVEN** 系统进行内容评分
- **WHEN** 评分完成
- **THEN** 输出详细的评分 breakdown
- **AND** 包含每个维度的得分和原因

## MODIFIED Requirements

### Requirement: Content Analysis Threshold

**Current**: 固定阈值 60分

**Modified**: 
- 基础阈值：30分（包含"记住"指令时）
- 标准阈值：40分（一般内容）
- 严格阈值：50分（无明确记忆价值的内容）

## REMOVED Requirements

### Requirement: Fixed 60-point Threshold
**Reason**: 过高导致重要信息被过滤
**Migration**: 使用动态阈值系统
