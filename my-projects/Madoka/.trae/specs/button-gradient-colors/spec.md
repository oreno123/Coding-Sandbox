# 按钮渐变色彩优化 Spec

## Why

当前按钮样式较为单调，缺乏视觉层次感。参考 homuro.css 的设计风格，为按钮添加渐变色彩效果，提升 UI 的精致度和视觉吸引力。

## What Changes

- 为 `.btn-primary` 添加渐变背景
- 为 `.composer-tool-btn` hover 状态添加渐变效果
- 为 `.composer-send-btn` 添加渐变背景和发光效果
- 为 Cyber 主题按钮添加霓虹发光效果
- 添加按钮过渡动画优化

## Impact
- Affected specs: 无
- Affected code: `src/sidepanel/index.css`

## ADDED Requirements

### Requirement: 主按钮渐变效果
主要操作按钮应使用渐变背景色，增强视觉吸引力。

#### Scenario: 显示主按钮
- **WHEN** 渲染 `.btn-primary` 按钮
- **THEN** 按钮显示从主强调色到次强调色的渐变背景

### Requirement: 工具按钮渐变 hover 效果
工具按钮 hover 时应显示渐变背景效果。

#### Scenario: hover 工具按钮
- **WHEN** 用户 hover `.composer-tool-btn`
- **THEN** 按钮显示渐变背景和文字颜色变化

### Requirement: 发送按钮渐变发光
发送按钮应具有渐变背景和微妙的发光效果。

#### Scenario: 显示发送按钮
- **WHEN** 渲染发送按钮
- **THEN** 按钮显示渐变背景，hover 时有发光效果

### Requirement: Cyber 主题霓虹按钮
Cyber 主题下的按钮应具有霓虹发光效果。

#### Scenario: Cyber 主题按钮
- **WHEN** 使用 Cyber 主题
- **THEN** 按钮显示霓虹边框和发光效果

## MODIFIED Requirements

### Requirement: 按钮过渡动画
按钮的过渡动画应更加平滑流畅。

## REMOVED Requirements

无移除的需求。
