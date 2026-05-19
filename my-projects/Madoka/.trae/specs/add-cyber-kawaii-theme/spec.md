# 赛博甜酷 (Cyber-Kawaii) 配色主题 Spec

## Why
当前插件只有 Light/Dark 两种主题，缺乏年轻化、游戏化的视觉风格。赛博甜酷风格结合了深色模式的沉浸感与高饱和度霓虹色，非常适合打造独特的视觉体验，吸引年轻用户群体。

## What Changes
- **新增 Cyber 主题**：添加赛博甜酷风格作为第三种主题选项
- **CSS 变量扩展**：添加霓虹发光效果、毛玻璃效果相关变量
- **Tailwind 配置更新**：添加 cyber 色系和霓虹阴影
- **主题切换功能**：支持 Light / Dark / Cyber 三种主题切换

## Impact
- Affected specs: 主题系统、UI 组件
- Affected code:
  - `src/sidepanel/index.css` - 添加 Cyber 主题 CSS 变量
  - `tailwind.config.js` - 添加 cyber 色系配置
  - `src/sidepanel/components/SettingsPanel.tsx` - 主题切换选项
  - `src/sidepanel/App.tsx` - 主题状态管理

## ADDED Requirements

### Requirement: Cyber 主题配色系统

The system SHALL provide a Cyber-Kawaii theme with the following color palette:

#### Scenario: Cyber theme activated
- **GIVEN** 用户选择 Cyber 主题
- **WHEN** 主题应用
- **THEN** 使用以下配色：
  - 背景基底: `#1A0B2E` (深渊紫)
  - 次要背景: `#2D1B4E` (灰调薰衣草)
  - 主强调色: `#FF4D8D` (霓虹洋红)
  - 辅助强调色: `#00F0FF` (电光青)
  - 主要文字: `#F0F0FF` (幽灵白)
  - 装饰点缀: `#FFD93D` (像素金)

### Requirement: 霓虹发光效果

The system SHALL provide neon glow effects for Cyber theme:

#### Scenario: Button hover effect
- **GIVEN** Cyber 主题下的按钮
- **WHEN** 用户悬停在按钮上
- **THEN** 显示霓虹发光阴影效果
- **AND** 颜色根据按钮类型显示粉色或青色发光

### Requirement: 毛玻璃面板效果

The system SHALL provide glassmorphism panel effects for Cyber theme:

#### Scenario: Glass panel rendering
- **GIVEN** Cyber 主题下的面板组件
- **WHEN** 面板渲染
- **THEN** 显示半透明背景
- **AND** 显示背景模糊效果 (backdrop-filter: blur)
- **AND** 显示微弱白色边框高光

### Requirement: 主题切换功能

The system SHALL allow users to switch between three themes:

#### Scenario: Theme switching
- **GIVEN** 用户在设置面板
- **WHEN** 用户选择主题 (Light / Dark / Cyber)
- **THEN** 立即应用对应主题
- **AND** 保存主题偏好到本地存储
- **AND** 下次启动时恢复用户选择的主题

## MODIFIED Requirements

### Requirement: Theme System
**Current**: 支持 Light / Dark 两种主题
**Modified**: 支持 Light / Dark / Cyber 三种主题

## REMOVED Requirements

None - 这是一个纯增量功能，不删除任何现有功能。
