# 阅读并合并分支任务列表

## 阶段1：阅读memory分支代码（当前kzc分支）
- [ ] 阅读记忆系统核心文件
  - [ ] `src/shared/memory-types.ts` - 理解Episode、UserProfile等数据模型
  - [ ] `src/shared/memory-parse.ts` - 理解LLM记忆标签解析
  - [ ] `src/background/memoryDb.ts` - 理解IndexedDB存储封装
  - [ ] `src/background/memoryWorker.ts` - 理解记忆业务逻辑
  - [ ] `src/background/memoryScoring.ts` - 理解权重计算算法
  - [ ] `src/background/cleanupEngine.ts` - 理解清理机制
  - [ ] `src/background/obsidianSync.ts` - 理解Obsidian同步
  - [ ] `src/sidepanel/components/MemoryOverview.tsx` - 理解记忆UI

## 阶段2：切换到master分支并阅读
- [ ] 切换到master分支
  - [ ] 运行 `git checkout master`
  - [ ] 确认工作目录干净
- [ ] 阅读master分支核心文件
  - [ ] `src/content/translation-popup.ts` - 理解翻译弹窗实现
  - [ ] `src/content/index.ts` - 理解划词翻译逻辑
  - [ ] `src/background/index.ts` - 理解翻译API和GitHub搜索
  - [ ] `src/background/githubSearch.ts` - 理解GitHub搜索功能
  - [ ] `src/content/link-summary-popup.ts` - 理解链接总结弹窗

## 阶段3：分析差异并准备合并
- [ ] 比较两个分支的差异
  - [ ] 运行 `git diff master..kzc --stat` 查看文件差异
  - [ ] 记录新增文件列表
  - [ ] 记录修改文件列表
- [ ] 制定合并策略
  - [ ] 确定冲突文件和解决方案
  - [ ] 准备合并命令

## 阶段4：执行合并
- [ ] 在master分支上合并kzc分支
  - [ ] 运行 `git checkout master`
  - [ ] 运行 `git merge kzc`
- [ ] 解决合并冲突（如有）
  - [ ] 解决 `src/background/index.ts` 冲突
  - [ ] 解决 `src/content/index.ts` 冲突
  - [ ] 解决 `src/manifest.json` 冲突
  - [ ] 解决其他文件冲突
- [ ] 完成合并提交
  - [ ] 运行 `git add .`
  - [ ] 运行 `git commit`

## 阶段5：验证合并结果
- [ ] 构建验证
  - [ ] 运行 `npm install`
  - [ ] 运行 `npm run build`
- [ ] 功能验证
  - [ ] 验证翻译功能正常
  - [ ] 验证记忆系统功能正常
  - [ ] 验证GitHub搜索功能正常
  - [ ] 验证链接总结功能正常

# 任务依赖
- 阶段2依赖阶段1完成
- 阶段3依赖阶段2完成
- 阶段4依赖阶段3完成
- 阶段5依赖阶段4完成
