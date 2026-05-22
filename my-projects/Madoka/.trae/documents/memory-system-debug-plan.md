# 记忆系统 Debug 计划

## 问题描述
用户反馈记忆系统无法正常工作，尝试几次都未能成功记忆。

## 记忆系统工作流程分析

### 1. 记忆保存流程
```
用户发送消息 → handleSmartChatRequest → 调用 API → 获取回复
→ 检查回复中是否包含 <!--MEMORY:...--> 标签
→ 解析标签内容 → 调用 memoryAddEpisode → 保存到 IndexedDB
```

### 2. 关键代码位置
- **API 调用**: `src/background/api.ts` - `handleChat()` 函数添加记忆标签指令
- **记忆提取**: `src/background/index.ts` - `handleSmartChatRequest()` 第 901 行
- **记忆保存**: `src/background/memoryWorker.ts` - `memoryAddEpisode()` 函数
- **内容分析**: `src/background/memoryContentAnalyzer.ts` - 判断内容是否值得记忆

### 3. 记忆保存条件
根据代码分析，记忆保存需要满足以下条件：

1. **记忆功能必须启用** (`memorySettings.enabled = true`)
2. **API 回复必须包含记忆标签** (`<!--MEMORY:...-->`)
3. **记忆标签必须包含必填字段**: `summary`, `block`, `shortTitle`
4. **内容分析得分 >= 60 分** (在 `memoryContentAnalyzer.ts` 中)

## 可能的问题原因

### 问题 1: API 没有返回记忆标签
**原因**: 
- 模型可能没有正确理解记忆标签指令
- 模型返回的记忆标签格式不正确

**验证方法**:
查看浏览器扩展的背景页控制台，检查是否有 `[Madoka BG] Memory auto-save skipped` 或相关日志

### 问题 2: 记忆标签格式解析失败
**原因**:
- JSON 格式错误
- 缺少必填字段

**验证方法**:
查看日志中的 `Memory auto-save skipped` 错误信息

### 问题 3: 内容分析过滤
**原因**:
- `memoryContentAnalyzer.ts` 中的评分机制可能过于严格
- 用户测试的对话内容得分低于 60 分

**验证方法**:
查看日志中的 `[memoryWorker] Content analysis` 输出

### 问题 4: 记忆功能被禁用
**原因**:
- 设置中记忆功能被关闭

**验证方法**:
检查 `memoryGetSettings()` 返回的 `enabled` 字段

## Debug 实施步骤

### 步骤 1: 增强日志输出
在关键位置添加更详细的日志，帮助定位问题：

1. **api.ts**: 记录是否添加了记忆标签指令
2. **index.ts**: 记录 API 回复是否包含记忆标签、解析结果
3. **memoryWorker.ts**: 记录内容分析得分和过滤原因

### 步骤 2: 修复潜在问题

根据发现的问题进行修复：

1. **如果 API 不返回记忆标签**:
   - 检查 `MEMORY_TAGS_INSTRUCTION` 是否正确添加到 system prompt
   - 考虑增强指令的清晰度

2. **如果内容分析过于严格**:
   - 降低评分阈值 (目前 60 分)
   - 或者为测试环境添加绕过选项

3. **如果记忆标签解析失败**:
   - 增强错误处理
   - 添加更宽松的解析逻辑

### 步骤 3: 添加测试功能
在 MemoryOverview 组件中添加手动测试功能：
- 手动触发记忆保存
- 查看记忆系统状态
- 显示最近的错误日志

## 具体修复方案

### 修复 1: 降低内容分析阈值
文件: `src/background/memoryContentAnalyzer.ts`
```typescript
// 将阈值从 60 降低到 40，让更多内容可以被记忆
const isWorthRemembering = score >= 40
```

### 修复 2: 增强记忆标签检测
文件: `src/background/index.ts`
- 添加更宽松的标签匹配正则
- 添加记忆标签缺失时的警告日志

### 修复 3: 添加记忆保存状态反馈
文件: `src/background/index.ts`
- 在记忆保存成功/失败时发送状态消息到 UI
- 让用户知道记忆是否被保存

### 修复 4: 检查记忆设置初始化
文件: `src/background/memoryDb.ts`
- 确保默认设置正确初始化
- 添加设置缺失时的自动修复

## 验证测试

修复后，按以下步骤验证：

1. 打开扩展的背景页控制台
2. 进行一次对话
3. 观察日志输出：
   - 是否显示 "Content analysis" 日志
   - 是否显示 "Memory saved" 或 "Memory auto-save skipped"
4. 打开记忆总览查看是否有新记忆
5. 检查人物画像是否更新

## 预期结果

修复后，正常对话应该能够：
1. 自动分析内容并保存记忆
2. 在记忆总览中显示保存的记忆
3. 更新人物画像
4. 在控制台显示清晰的日志
