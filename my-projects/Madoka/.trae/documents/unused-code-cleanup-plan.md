# 未启用功能代码清理计划

## 检查总结

通过全面检查，发现项目中存在多处未启用的功能代码，包括被注释的弃用代码、未使用的导入、未调用的函数和组件等。

## 发现的问题

### 一、被注释掉的大段代码块（建议删除）

#### 1. `src/background/search.ts` - 3处弃用函数
- `performSearch()` - 旧搜索实现，已被 `performSearchInRealTab` 替代
- `fetchPage()` - 旧页面获取，已被 `fetchPageInRealTab` 替代
- `parseSearchInContentScript()` - 旧搜索结果解析

**建议**：删除这些已弃用的函数，减少代码体积

### 二、未使用的导入（建议删除）

#### 1. `src/background/index.ts`
- `UserProfile` 类型导入未使用

#### 2. `src/background/api.ts`
- `FOLLOW_UP_INDICATORS`, `CONDENSE_MAX_HISTORY_TURNS`, `CONDENSE_FOLLOW_UP_MAX_LEN` 常量重复定义

### 三、未调用的函数（需要决策）

#### 1. `src/background/memoryUsageDetector.ts` - 整个文件未使用
**功能**：检测 LLM 是否使用了记忆，动态调整权重
**状态**：已实现但未集成
**建议**：
- 方案A：在 `handleSmartChatRequest` 中集成，启用记忆反馈优化
- 方案B：如不需要此功能，删除整个文件

#### 2. `src/background/memoryContentAnalyzer.ts` - 整个文件未使用
**功能**：基于内容特征自动判定是否值得记忆
**状态**：已实现但未集成
**建议**：
- 方案A：在 `memoryAddEpisode` 中集成，过滤低质量记忆
- 方案B：如不需要此功能，删除整个文件

#### 3. `src/background/index.ts` - `sendToContentScriptWithRetry()`
**功能**：带重试机制的消息发送
**状态**：已实现但未使用
**建议**：如不需要增强稳定性，可删除

### 四、未使用的组件（建议删除）

#### 1. `src/sidepanel/components/InputArea.tsx`
**状态**：整个组件未被使用，功能已被 `Composer.tsx` 替代
**建议**：删除文件

#### 2. `src/sidepanel/components/Header.tsx`
**状态**：旧版头部组件，功能已集成到 `App.tsx`
**建议**：删除文件

#### 3. `src/sidepanel/components/Welcome.tsx`
**状态**：组件未被引用
**建议**：检查是否需要在 `App.tsx` 中使用，如不需要可删除

#### 4. `src/sidepanel/components/layout/ModeSwitch.tsx`
**状态**：组件未被引用，`App.tsx` 中直接内联实现
**建议**：可删除或保留作为未来复用

### 五、遗留兼容代码（建议检查）

#### 1. `src/background/index.ts` - `handleChatRequest()`
**功能**：旧版聊天请求处理，现在直接调用 `handleSmartChatRequest`
**建议**：检查是否还有 `action: 'chat'` 的调用，如没有可删除

### 六、TODO 项（建议实现）

#### 1. `src/sidepanel/components/composer/Composer.tsx`
**内容**：QuickPrompt 应该设置输入框内容而不是直接发送
**建议**：实现设置输入框功能，提升用户体验

## 清理优先级

| 优先级 | 项目 | 操作 | 预计收益 |
|--------|------|------|----------|
| 🔴 高 | search.ts 注释代码 | 删除 | 减少代码体积，提高可读性 |
| 🔴 高 | InputArea.tsx | 删除 | 删除冗余文件 |
| 🔴 高 | Header.tsx | 删除 | 删除冗余文件 |
| 🟡 中 | memoryUsageDetector.ts | 决策 | 启用功能或删除文件 |
| 🟡 中 | memoryContentAnalyzer.ts | 决策 | 启用功能或删除文件 |
| 🟡 中 | 未使用导入 | 删除 | 清理代码 |
| 🟢 低 | Welcome.tsx | 检查 | 确认是否使用 |
| 🟢 低 | ModeSwitch.tsx | 决策 | 删除或保留 |

## 建议实施方案

### 方案1：保守清理（推荐）
只删除明确无用的代码，保留可能未来使用的功能
1. 删除 search.ts 中的注释代码
2. 删除 InputArea.tsx、Header.tsx
3. 删除未使用的导入
4. 保留 memoryUsageDetector.ts 和 memoryContentAnalyzer.ts（未来可能启用）

### 方案2：激进清理
删除所有未使用的代码和功能
1. 删除所有注释代码
2. 删除所有未使用组件
3. 删除所有未调用函数（包括两个完整的分析器文件）
4. 清理所有未使用导入

### 方案3：启用未使用功能
将未使用的分析器和检测器集成到主流程中
1. 集成 memoryContentAnalyzer 到记忆保存流程
2. 集成 memoryUsageDetector 到对话流程
3. 删除其他无用代码

## 下一步行动

请用户选择：
1. **采用方案1（保守清理）** - 安全地删除明确无用的代码
2. **采用方案2（激进清理）** - 彻底清理所有未使用代码
3. **采用方案3（启用功能）** - 集成未使用的分析功能
4. **自定义方案** - 指定要处理的具体项目
