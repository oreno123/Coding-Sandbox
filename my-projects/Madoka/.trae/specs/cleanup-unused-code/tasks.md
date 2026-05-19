# Tasks

## Task 1: 删除已弃用的搜索函数
- [ ] 删除 `src/background/search.ts` 中被注释的 `performSearch()` 函数
- [ ] 删除 `src/background/search.ts` 中被注释的 `fetchPage()` 函数
- [ ] 删除 `src/background/search.ts` 中被注释的 `parseSearchInContentScript()` 函数

**Dependencies**: None

## Task 2: 删除未使用的组件文件
- [ ] 删除 `src/sidepanel/components/InputArea.tsx` 文件
- [ ] 删除 `src/sidepanel/components/Header.tsx` 文件

**Dependencies**: None

## Task 3: 启用智能记忆判定功能
- [ ] 在 `src/background/memoryWorker.ts` 中导入 `analyzeContentForMemory`
- [ ] 在 `memoryAddEpisode` 函数开头调用内容分析
- [ ] 根据分析结果决定是否保存记忆（低于阈值不保存）
- [ ] 添加日志记录分析结果

**Dependencies**: None

## Task 4: 启用记忆使用检测功能
- [ ] 在 `src/background/index.ts` 中导入 `detectMemoryUsage`
- [ ] 在 `handleSmartChatRequest` 的对话结束后调用检测
- [ ] 获取使用的记忆列表并更新权重
- [ ] 添加日志记录使用情况

**Dependencies**: Task 3

## Task 5: 清理未使用的导入
- [ ] 删除 `src/background/index.ts` 中的 `UserProfile` 类型导入
- [ ] 删除 `src/background/api.ts` 中的重复常量导入

**Dependencies**: None

## Task 6: 构建和验证
- [ ] 运行 `npm run build` 确保无 TypeScript 错误
- [ ] 验证删除的组件不再被引用
- [ ] 验证启用的功能正常工作

**Dependencies**: Task 1, Task 2, Task 3, Task 4, Task 5

# Task Dependencies

```
Task 4 depends on Task 3
Task 6 depends on Task 1, Task 2, Task 3, Task 4, Task 5
```

# Parallelizable Work

- Task 1, Task 2, Task 3, Task 5 可以并行执行
