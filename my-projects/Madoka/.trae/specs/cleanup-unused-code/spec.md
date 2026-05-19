# 清理未启用代码 Spec

## Why

项目中存在多种类型的未启用代码，需要根据代码的性质和价值采取不同的处理方式：
- 已弃用的旧实现 → 删除
- 未使用的组件 → 删除
- 已实现但未集成的功能 → 评估后决定启用或删除
- 未使用的导入 → 删除

## What Changes

针对不同代码采取不同策略：
- **删除**：已弃用、被替代、明确无用的代码
- **启用**：有价值且实现完整的功能
- **保留**：可能未来有用的基础设施

## Impact

- 减少代码体积
- 提高代码可读性
- 启用有价值的未使用功能
- 清理技术债务

## ADDED Requirements

### Requirement: 删除已弃用代码

删除 `src/background/search.ts` 中被注释的3个弃用函数：
- `performSearch()` - 已被 `performSearchInRealTab` 替代
- `fetchPage()` - 已被 `fetchPageInRealTab` 替代
- `parseSearchInContentScript()` - 已不再使用

### Requirement: 删除未使用组件

删除以下未使用的组件文件：
- `src/sidepanel/components/InputArea.tsx` - 已被 Composer 替代
- `src/sidepanel/components/Header.tsx` - 功能已集成到 App.tsx

### Requirement: 启用智能记忆判定功能

启用 `src/background/memoryContentAnalyzer.ts`：
- 在 `memoryAddEpisode` 中集成内容分析
- 基于规则自动判定是否值得记忆
- 过滤低质量记忆（寒暄、无意义内容）

### Requirement: 启用记忆使用检测功能

启用 `src/background/memoryUsageDetector.ts`：
- 在对话流程中检测 LLM 是否使用了记忆
- 根据使用情况动态调整记忆权重
- 优化记忆质量

### Requirement: 清理未使用导入

清理以下文件中的未使用导入：
- `src/background/index.ts` - 删除 `UserProfile` 类型导入
- `src/background/api.ts` - 删除重复的常量导入

### Requirement: 保留潜在有用代码

保留以下代码供未来使用：
- `src/sidepanel/components/Welcome.tsx` - 欢迎页面可能未来使用
- `src/sidepanel/components/layout/ModeSwitch.tsx` - 模式切换组件可能复用
- `src/background/index.ts` - `sendToContentScriptWithRetry()` 可能用于增强稳定性

## REMOVED Requirements

### Requirement: 删除所有未使用代码
**Reason**: 不同代码应采取不同策略，不应一刀切删除
**Migration**: 采用分类处理策略
