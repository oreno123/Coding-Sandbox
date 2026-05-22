# 阅读并合并两个分支规格文档

## 目标
1. 仔细阅读当前分支（kzc/memoryUpdates）的代码，理解记忆系统实现
2. 切换到master分支，阅读代码，理解翻译和其他功能
3. 合并两个分支的代码

## 当前状态
- 当前分支：kzc（对应 origin/memoryUpdates）
- 目标分支：master
- 工作目录：干净（无未提交更改）

## 阅读计划

### 阶段1：阅读memory分支（当前）
重点理解记忆系统架构：
- `src/shared/memory-types.ts` - 数据模型
- `src/background/memoryDb.ts` - 存储层
- `src/background/memoryWorker.ts` - 业务逻辑
- `src/background/memoryScoring.ts` - 权重计算
- `src/background/cleanupEngine.ts` - 清理机制
- `src/background/obsidianSync.ts` - Obsidian同步
- `src/sidepanel/components/MemoryOverview.tsx` - UI组件

### 阶段2：切换到master分支并阅读
重点理解现有功能：
- `src/content/translation-popup.ts` - 翻译弹窗
- `src/content/index.ts` - 划词翻译逻辑
- `src/background/index.ts` - 翻译API处理
- `src/background/githubSearch.ts` - GitHub搜索
- `src/content/link-summary-popup.ts` - 链接总结

### 阶段3：合并策略
1. 从master创建新分支或直接在master上合并
2. 将memory分支的更改合并到master
3. 解决可能出现的冲突

## 注意事项
- 确保理解两个分支的关键功能后再进行合并
- 记录两个分支的功能差异
- 准备冲突解决方案
