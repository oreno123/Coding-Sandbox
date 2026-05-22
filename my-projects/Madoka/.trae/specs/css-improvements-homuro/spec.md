# CSS 样式改进 Spec - 基于 Homuro (Obsidianite) 主题

## Why

当前 CSS 样式较为基础，缺乏视觉层次感和精致的细节处理。Homuro.css (Obsidianite 主题) 提供了许多优秀的设计模式，可以显著提升 UI 的视觉品质和用户体验。

## What Changes

### 1. 颜色系统增强
- 添加 `--text-accent` 和 `--text-sub-accent` 双强调色系统
- 添加半透明强调色变量 (`--bg-accent-55`, `--bg-accent-25`)
- 改进渐变色定义

### 2. 链接样式改进
- 添加渐变下划线动画效果
- hover 时下划线展开动画

### 3. 引用块样式
- 添加渐变边框
- 添加装饰性前缀图标
- 改进背景渐变

### 4. 代码块增强
- 添加语言标签显示
- 改进代码语法高亮配色 (Dracula 风格)

### 5. 标题样式
- 添加渐变下划线边框
- 改进标题层级视觉区分

### 6. 文本强调样式
- **粗体**: 渐变色文字效果
- *斜体*: 独立的颜色区分

### 7. 分隔线样式
- 添加居中装饰符号
- 渐变边框效果

### 8. 滚动条优化
- 更精致的滚动条样式
- hover 状态变化

### 9. 动画效果
- 添加 checkbox 弹跳动画
- 添加过渡动画优化

## Impact
- Affected specs: 无
- Affected code: `src/sidepanel/index.css`

## ADDED Requirements

### Requirement: 双强调色系统
系统应提供主次两个强调色，用于不同层级的视觉强调。

#### Scenario: 使用强调色
- **WHEN** 需要强调某个元素
- **THEN** 可选择使用 `--text-accent` (主) 或 `--text-sub-accent` (次)

### Requirement: 链接下划线动画
链接应具有渐变下划线，hover 时展开动画。

#### Scenario: 链接 hover 效果
- **WHEN** 用户 hover 链接
- **THEN** 下划线从细变粗，颜色渐变展开

### Requirement: 引用块装饰
引用块应具有渐变边框和装饰性前缀。

#### Scenario: 显示引用块
- **WHEN** 显示引用内容
- **THEN** 左侧有渐变边框，内容前有装饰图标

### Requirement: 渐变文字效果
粗体文字应显示渐变色效果。

#### Scenario: 显示粗体文字
- **WHEN** 渲染 **粗体** 文字
- **THEN** 文字显示从青色到绿色的渐变效果

## MODIFIED Requirements

### Requirement: 代码块显示
代码块应显示语言标签，并使用 Dracula 风格的语法高亮。

### Requirement: 标题样式
标题应具有渐变下划线边框，增强视觉层次。

## REMOVED Requirements

无移除的需求。
