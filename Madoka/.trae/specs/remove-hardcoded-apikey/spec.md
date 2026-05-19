# 移除硬编码 API Key 并添加首次使用提醒 Spec

## Why

当前代码中硬编码了 API Key（`sk-b8570d1d70dd4968afad113dc334a254`），存在安全风险且不方便用户使用。需要在首次使用时提醒用户填写自己的 API Key。

## What Changes

- 移除 `src/shared/types.ts` 中的硬编码 API Key
- 修改默认配置，apiKey 为空字符串
- 创建 API Key 设置页面/弹窗，首次使用时强制填写
- 在设置面板中保留 API Key 修改功能
- 在 API 调用前检查 API Key 是否已配置

## Impact

- Affected code:
  - `src/shared/types.ts` - 移除硬编码 API Key
  - `src/sidepanel/App.tsx` - 添加首次使用检测
  - `src/sidepanel/components/ApiKeySetup.tsx` - 新建 API Key 设置组件
  - `src/background/api.ts` - 添加 API Key 检查

## ADDED Requirements

### Requirement: 移除硬编码 API Key

The system SHALL remove the hardcoded API Key from the codebase.

#### Scenario: Default configuration
- **GIVEN** 默认配置
- **THEN** apiKey 为空字符串
- **AND** 用户必须填写自己的 API Key

### Requirement: 首次使用提醒

The system SHALL prompt user to enter API Key on first use.

#### Scenario: First time user opens extension
- **GIVEN** 用户首次打开扩展
- **WHEN** apiKey 未配置（为空）
- **THEN** 显示 API Key 设置界面
- **AND** 用户必须填写有效 API Key 才能继续使用

#### Scenario: User enters API Key
- **GIVEN** 用户在 API Key 设置界面
- **WHEN** 输入 API Key 并保存
- **THEN** 验证 API Key 格式（以 sk- 开头）
- **AND** 保存到配置
- **AND** 进入主界面

### Requirement: API Key 验证

The system SHALL validate API Key before making API calls.

#### Scenario: API call without API Key
- **GIVEN** apiKey 未配置
- **WHEN** 发起 API 请求
- **THEN** 显示错误提示"请先配置 API Key"
- **AND** 跳转到设置页面

## MODIFIED Requirements

### Requirement: Default Config

**Current**: `apiKey: 'sk-b8570d1d70dd4968afad113dc334a254'`

**Modified**: `apiKey: ''`

## REMOVED Requirements

None
