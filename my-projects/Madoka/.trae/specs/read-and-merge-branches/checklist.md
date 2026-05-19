# 阅读并合并分支检查清单

## 阶段1完成检查（memory分支阅读）
- [ ] 已阅读 `src/shared/memory-types.ts`
  - [ ] 理解Episode数据结构
  - [ ] 理解UserProfile数据结构
  - [ ] 理解MemorySettings配置
- [ ] 已阅读 `src/shared/memory-parse.ts`
  - [ ] 理解LLM记忆标签解析逻辑
- [ ] 已阅读 `src/background/memoryDb.ts`
  - [ ] 理解IndexedDB封装
  - [ ] 理解ObjectStore和索引设计
- [ ] 已阅读 `src/background/memoryWorker.ts`
  - [ ] 理解记忆添加流程
  - [ ] 理解记忆查询流程
  - [ ] 理解记忆更新/删除流程
- [ ] 已阅读 `src/background/memoryScoring.ts`
  - [ ] 理解权重计算算法
  - [ ] 理解召回评分机制
- [ ] 已阅读 `src/background/cleanupEngine.ts`
  - [ ] 理解保留规则
  - [ ] 理解清理规则
  - [ ] 理解压力清理机制
- [ ] 已阅读 `src/background/obsidianSync.ts`
  - [ ] 理解File System Access API使用
  - [ ] 理解Markdown文件生成
- [ ] 已阅读 `src/sidepanel/components/MemoryOverview.tsx`
  - [ ] 理解记忆UI组件

## 阶段2完成检查（master分支阅读）
- [ ] 已切换到master分支
- [ ] 已阅读 `src/content/translation-popup.ts`
  - [ ] 理解TranslationPopup类
  - [ ] 理解弹窗UI和交互
- [ ] 已阅读 `src/content/index.ts`
  - [ ] 理解划词翻译事件监听
  - [ ] 理解翻译调用流程
- [ ] 已阅读 `src/background/index.ts`
  - [ ] 理解翻译API处理
  - [ ] 理解GitHub搜索处理
- [ ] 已阅读 `src/background/githubSearch.ts`（如存在）
- [ ] 已阅读 `src/content/link-summary-popup.ts`
  - [ ] 理解链接总结弹窗

## 阶段3完成检查（差异分析）
- [ ] 已运行 `git diff master..kzc --stat`
- [ ] 已记录新增文件
- [ ] 已记录修改文件
- [ ] 已制定合并策略

## 阶段4完成检查（合并执行）
- [ ] 已在master分支
- [ ] 已执行 `git merge kzc`
- [ ] 所有冲突已解决
  - [ ] `src/background/index.ts` 冲突已解决
  - [ ] `src/content/index.ts` 冲突已解决
  - [ ] `src/manifest.json` 冲突已解决
  - [ ] 其他文件冲突已解决
- [ ] 已提交合并

## 阶段5完成检查（验证）
- [ ] 构建成功
  - [ ] `npm install` 成功
  - [ ] `npm run build` 无错误
- [ ] 功能正常
  - [ ] 划词翻译功能正常
  - [ ] 记忆系统功能正常
  - [ ] GitHub搜索功能正常
  - [ ] 链接总结功能正常
- [ ] 无运行时错误
