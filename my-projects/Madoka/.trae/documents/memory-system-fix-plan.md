# 记忆系统问题修复计划

## 问题分析

从日志中发现了**矛盾现象**：

```
[memoryWorker] Content analysis: {score: 10, isWorthRemembering: false, reasons: Array(1)}
[memoryWorker] Content not worth remembering, skipping save
[Madoka BG] Memory saved for conversation: sidepanel-1772551255036
```

**问题 1**: 内容分析显示 `isWorthRemembering: false`，但后面却显示 `Memory saved`

**根本原因**: 
1. `memoryContentAnalyzer.ts` 的评分阈值是 **60分**，但 "记住我的名字是archer" 只得了 **10分**
2. 用户说"调用记忆库，我的名字是什么" 也只得了 **13分**
3. 这些包含个人信息的内容应该被记住，但评分机制过于严格

**问题 2**: 虽然显示 "Memory saved"，但用户反馈记忆没有成功

**根本原因**:
查看 `memoryWorker.ts` 第 37-40 行：
```typescript
if (!analysis.isWorthRemembering) {
  console.log('[memoryWorker] Content not worth remembering, skipping save')
  return { uid: '' }
}
```

如果 `isWorthRemembering` 为 false，应该直接返回空 uid，但日志显示后面又打印了 "Memory saved"，这说明：
- 可能有两条并行的对话流程
- 或者记忆保存逻辑有问题

## 修复方案

### 修复 1: 降低内容分析阈值（高优先级）

文件: `src/background/memoryContentAnalyzer.ts`

**问题**: 当前阈值 60 分过高，简单的个人信息分享无法达到

**修复**: 将阈值从 60 降低到 **30**，并增强个人信息检测

```typescript
// 第 134 行
const isWorthRemembering = score >= 30  // 从 60 改为 30
```

同时增强 "记住" 指令的检测：
```typescript
// 在 IMPORTANT_FACT_PATTERNS 中添加
/记住/, /请记住/, /保存/, /记下来/
```

### 修复 2: 修复记忆保存逻辑矛盾（高优先级）

文件: `src/background/memoryWorker.ts`

**问题**: 即使 `isWorthRemembering` 为 false，记忆仍然被保存

**检查**: 需要确认是否有其他代码路径调用了 `memoryAddEpisode`

查看 `src/background/index.ts` 第 916 行，发现记忆保存是在 API 回复处理中直接调用的，**没有经过内容分析**！

**修复**: 在 `index.ts` 中添加内容分析检查

### 修复 3: 增强个人信息检测（中优先级）

文件: `src/background/memoryContentAnalyzer.ts`

添加更多个人信息模式：
```typescript
const PERSONAL_INFO_PATTERNS = [
  // 现有模式...
  /记住.*名字是/, /我的名字是/, /叫我/, /我是/,
  /我(今)?年(大)?/, /我的年龄/,
  /我在.*工作/, /我是.*(工程师|设计师|老师|学生)/,
]
```

### 修复 4: 添加调试日志（低优先级）

在关键位置添加更详细的日志，帮助用户理解记忆系统工作状态。

## 实施步骤

1. **修改 `memoryContentAnalyzer.ts`**:
   - 降低阈值到 30
   - 增强个人信息检测模式
   - 添加 "记住" 指令检测

2. **检查并修复 `index.ts`**:
   - 确认记忆保存流程
   - 确保内容分析结果被正确使用

3. **验证修复**:
   - 测试 "记住我的名字是archer"
   - 检查记忆是否正确保存
   - 检查人物画像是否更新

## 预期结果

修复后：
1. "记住我的名字是archer" 应该得分 >= 30 并被保存
2. 记忆总览中应该显示这条记忆
3. 人物画像的"基本信息"应该更新
4. 再次询问"我的名字是什么"时应该能正确回答
