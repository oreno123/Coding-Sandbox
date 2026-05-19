# 将提示词模板管理移到设置面板 Spec

## Why
当前提示词模板管理功能位于 Composer 工具栏中，占用空间且与设置功能分散。用户希望将其整合到设置面板中，使界面更简洁，功能组织更合理。

## What Changes
- **新增**: 在 SettingsPanel 中添加提示词模板管理入口
- **修改**: PromptTemplateManager 组件样式，使其与设置面板风格一致并支持多主题
- **移除**: Composer 工具栏中的模板选择器图标按钮
- **新增**: SettingsPanel 底部的提示词模板管理区域

## Impact
- Affected specs: 无
- Affected code:
  - `src/sidepanel/components/SettingsPanel.tsx`
  - `src/sidepanel/components/composer/PromptTemplateManager.tsx`
  - `src/sidepanel/components/composer/Composer.tsx`

## ADDED Requirements

### Requirement: 设置面板中的提示词模板管理入口
The system SHALL provide a way to access prompt template management from the settings panel.

#### Scenario: 用户打开设置面板
- **WHEN** 用户打开设置面板
- **THEN** 在设置面板最下方显示"提示词模板"区域
- **AND** 显示当前激活的模板名称
- **AND** 提供"管理模板"按钮

#### Scenario: 用户点击管理模板
- **WHEN** 用户点击"管理模板"按钮
- **THEN** 打开 PromptTemplateManager 面板
- **AND** 面板样式与设置面板一致

### Requirement: PromptTemplateManager 多主题支持
The system SHALL support all existing themes in the prompt template manager.

#### Scenario: 不同主题下的显示
- **WHEN** 用户切换主题
- **THEN** PromptTemplateManager 的背景色、文字色、边框色等跟随主题变化
- **AND** 使用 CSS 变量：`--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-muted`, `--border-primary`, `--accent-primary`

### Requirement: Composer 移除模板选择器
The system SHALL remove the template selector from Composer toolbar.

#### Scenario: Composer 工具栏显示
- **WHEN** 用户查看 Composer 工具栏
- **THEN** 不再显示模板选择图标按钮
- **AND** 其他功能按钮保持正常

## MODIFIED Requirements
无

## REMOVED Requirements
无
