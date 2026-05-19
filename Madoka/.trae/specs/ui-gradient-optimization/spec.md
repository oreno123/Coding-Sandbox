# UI渐变优化规格说明

## Why
根据UI优化计划，需要将主界面（含欢迎页）和设置页面的核心交互元素升级为动态渐变风格，通过微妙的流光动画和彩色光晕打破纯色块的沉闷，同时确保主题一致性和无障碍性。

## What Changes
- **主题系统扩展**: 为所有4种主题添加RGB格式的accent颜色变量，支持CSS中的rgba()动态计算
- **CSS动画系统**: 添加流光效果(gradient-flow)和脉冲光晕(pulse-glow)动画，支持prefers-reduced-motion媒体查询
- **Welcome.tsx**: Logo升级为渐变+彩色光晕效果
- **App.tsx**: 主容器背景添加边缘晕染效果，QuickPrompt按钮添加悬停光泽
- **ThemeToggle.tsx**: 开关轨道和主题选择器添加渐变层次
- **SettingsPanel.tsx**: 搜索引擎Tab、Toggle开关、保存按钮等添加渐变效果

## Impact
- 影响文件: `src/sidepanel/styles/theme.ts`, `src/sidepanel/index.css`, `src/sidepanel/components/Welcome.tsx`, `src/sidepanel/App.tsx`, `src/sidepanel/components/common/ThemeToggle.tsx`, `src/sidepanel/components/SettingsPanel.tsx`
- 视觉风格: 从纯色块升级为动态渐变风格
- 性能影响: 仅CTA按钮使用流光动画，其他为静态渐变

## ADDED Requirements

### Requirement: RGB颜色变量支持
The system SHALL 为每种主题提供RGB格式的accent颜色变量，用于CSS rgba()动态透明度计算。

#### Scenario: 主题颜色定义
- **GIVEN** 主题系统包含light/dark/cyber/neon四种主题
- **WHEN** 应用初始化时
- **THEN** 每个主题应提供accentPrimaryRgb和accentSecondaryRgb字符串值(如"59, 130, 246")

### Requirement: CSS动画系统
The system SHALL 提供流光和脉冲光晕动画效果，并尊重用户的减少动画偏好。

#### Scenario: 流光动画
- **WHEN** 元素应用gradient-flow类
- **THEN** 背景渐变应产生流动的动画效果
- **AND** 动画周期为3秒，ease缓动

#### Scenario: 减少动画支持
- **GIVEN** 用户系统开启"减少动画"偏好
- **WHEN** 应用gradient-flow或pulse-glow类
- **THEN** 动画应停止，回退到静态渐变

### Requirement: Welcome页Logo光晕
The system SHALL 为欢迎页Logo添加渐变背景和彩色光晕效果。

#### Scenario: Logo视觉效果
- **WHEN** 渲染Welcome组件的Logo
- **THEN** Logo应使用从accent-primary到accent-secondary的渐变
- **AND** 添加基于accent-primary-rgb的彩色阴影(box-shadow)
- **AND** 悬停时阴影增强并轻微放大

### Requirement: 主界面背景晕染
The system SHALL 为主容器添加极淡的顶部/底部渐变背景。

#### Scenario: 背景视觉效果
- **WHEN** 渲染主容器
- **THEN** 背景应为从bg-secondary/10到bg-primary的渐变
- **AND** 使用via-transparent避免视觉干扰

### Requirement: QuickPrompt悬停效果
The system SHALL 为QuickPrompt按钮添加悬停时的光泽流动效果。

#### Scenario: 悬停交互
- **WHEN** 用户悬停在QuickPrompt按钮上
- **THEN** 边框颜色变为accent-primary/40
- **AND** 背景产生从bg-secondary到accent-primary/10的渐变
- **AND** 文字颜色变为accent-primary

### Requirement: ThemeToggle渐变
The system SHALL 为主题切换组件添加渐变层次效果。

#### Scenario: 开关轨道
- **WHEN** 开关处于选中状态
- **THEN** 轨道使用从accent-primary到accent-secondary的渐变
- **AND** 添加彩色光晕阴影
- **WHEN** 开关未选中
- **THEN** 轨道使用从bg-tertiary到bg-secondary的微渐变

#### Scenario: 主题选择器
- **WHEN** 主题项被选中
- **THEN** 使用渐变背景并添加内阴影增加立体感

### Requirement: SettingsPanel渐变
The system SHALL 为设置面板的核心交互元素添加渐变效果。

#### Scenario: 搜索引擎Tab
- **WHEN** Tab处于选中状态
- **THEN** 使用从accent-primary到accent-secondary的渐变
- **AND** 添加阴影效果

#### Scenario: 保存按钮(CTA)
- **WHEN** 渲染保存按钮
- **THEN** 使用渐变背景
- **AND** 添加gradient-flow类实现流光动画

#### Scenario: Toggle开关
- **WHEN** Toggle处于选中状态
- **THEN** 轨道使用渐变+彩色光晕
- **WHEN** Toggle未选中
- **THEN** 轨道使用微渐变保持层次

## MODIFIED Requirements
无

## REMOVED Requirements
无
