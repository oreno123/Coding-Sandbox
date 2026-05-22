# Tasks

## Task 1: 实现隐藏式记忆标签（使用 XML 注释格式）
- [ ] 修改 `src/background/api.ts` 中的 `MEMORY_TAGS_INSTRUCTION`
- [ ] 改为要求 LLM 在回复末尾添加 XML 注释格式的记忆标签
- [ ] 格式示例：`<!--MEMORY:{...}-->`
- [ ] 修改 `src/background/index.ts` 中的解析逻辑，提取 XML 注释
- [ ] 从 `fullResponse` 中移除 XML 注释后再发送给用户

**Dependencies**: None

## Task 2: 实现基于规则的记忆判定
- [ ] 创建 `src/background/memoryContentAnalyzer.ts` 新文件
- [ ] 实现 `analyzeContentForMemory` 函数，基于内容特征评分
- [ ] 评分维度：
  - 是否包含个人信息（年龄、职业、地点等）
  - 是否包含偏好（喜欢/不喜欢）
  - 是否包含重要事实（学习、工作、目标等）
  - 对话长度和深度
- [ ] 设定阈值，超过阈值自动保存
- [ ] 修改 `src/background/index.ts`，移除对 LLM shouldPersist 的依赖
- [ ] 使用内容分析结果决定是否保存

**Dependencies**: Task 1

## Task 3: 优化记忆上下文格式
- [ ] 修改 `src/background/api.ts` 中的 `handleChat` 函数
- [ ] 将记忆上下文格式改为更自然的列表形式
- [ ] 示例格式：
  ```
  [相关背景]
  - 用户是软件工程师，正在学习 TypeScript
  - 用户喜欢编程和技术文章
  ```
- [ ] 减少 token 消耗，提高可读性

**Dependencies**: None

## Task 4: 实现记忆使用检测
- [ ] 创建 `src/background/memoryUsageDetector.ts` 新文件
- [ ] 实现 `detectMemoryUsage` 函数
- [ ] 检测方式：
  - 关键词匹配（记忆内容中的关键词是否出现在回复中）
  - 语义相似度（使用简单算法或调用 embedding API）
- [ ] 在 `src/background/index.ts` 中调用检测函数
- [ ] 记录记忆使用情况到 IndexedDB
- [ ] 根据使用情况调整记忆权重

**Dependencies**: Task 1

## Task 5: 测试和验证
- [ ] 测试隐藏式标签是否正确解析和移除
- [ ] 测试内容分析是否准确判定记忆价值
- [ ] 测试记忆上下文格式是否更自然
- [ ] 测试记忆使用检测是否有效
- [ ] 运行 `npm run build` 确保无错误

**Dependencies**: Task 1, Task 2, Task 3, Task 4

# Task Dependencies

```
Task 2 depends on Task 1
Task 4 depends on Task 1
Task 5 depends on Task 1, Task 2, Task 3, Task 4
```

# Parallelizable Work

- Task 1 和 Task 3 可以并行
