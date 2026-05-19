# 优化提示词模板选择器 UI - 计划文档

## 任务概述
将 Composer 中的提示词模板选择器从文字按钮改为图标按钮，减少空间占用。

## 当前状态
- 文件: `src/sidepanel/components/composer/Composer.tsx`
- 当前实现: 第606-614行是一个带有文字和下拉箭头的按钮
- 显示内容: 模板名称 + ChevronIcon

## 目标
将模板选择器改为图标按钮形式，类似其他工具栏按钮（截图、@、搜索等）。

## 实施步骤

### 步骤1: 修改模板选择器触发按钮
- 将第606-614行的 `template-selector-btn` 改为图标按钮
- 使用 `composer-tool-btn` 类保持样式一致
- 使用一个合适的图标（如文档/模板图标）代替文字

### 步骤2: 添加模板图标组件
- 在文件底部的 Icon Components 区域添加一个新的 TemplateIcon 组件
- 图标风格与其他图标保持一致（w-4 h-4, strokeWidth: 1.5）

### 步骤3: 调整下拉菜单样式（如需要）
- 确保下拉菜单在图标按钮下正确显示
- 保持现有功能不变（模板列表、Manage按钮等）

## 具体修改位置

### Composer.tsx 修改点:

1. **替换模板选择器按钮** (第606-614行):
```tsx
// 当前代码:
<button
  className="template-selector-btn"
  onClick={() => setTemplateSelectorOpen(!templateSelectorOpen)}
  title={`当前模板: ${activeTemplate.name}`}
  type="button"
>
  <span>{activeTemplate.name}</span>
  <ChevronIcon isOpen={templateSelectorOpen} />
</button>

// 改为:
<button
  className={`composer-tool-btn ${templateSelectorOpen ? "active" : ""}`}
  onClick={() => setTemplateSelectorOpen(!templateSelectorOpen)}
  title={`当前模板: ${activeTemplate.name}`}
  type="button"
>
  <TemplateIcon />
</button>
```

2. **添加 TemplateIcon 组件** (在文件底部 Icon Components 区域):
```tsx
function TemplateIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
```

## 测试要点
1. 模板选择器图标正确显示
2. 点击图标弹出下拉菜单
3. 下拉菜单功能正常（选择模板、Manage按钮）
4. 鼠标悬停显示当前模板名称tooltip
5. 与其他工具栏按钮样式一致

## 优势
1. 减少工具栏空间占用
2. 与其他功能按钮风格统一
3. 保持原有功能完整
