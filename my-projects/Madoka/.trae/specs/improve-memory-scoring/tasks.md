# Tasks

## Task 1: 重构评分维度系统
- [x] 修改 `src/background/memoryContentAnalyzer.ts`
- [x] 定义评分维度接口 `ScoringDimension`
- [x] 实现以下评分维度：
  - [x] 个人信息维度（权重 1.5x）：姓名、年龄、职业、地点
  - [x] 偏好维度（权重 1.2x）：喜欢、不喜欢、偏好
  - [x] 重要事实维度（权重 1.0x）：目标、计划、学习、工作
  - [x] 指令维度（权重 1.3x）："记住"、"保存"等明确指令
  - [x] 内容质量维度（权重 0.8x）：长度、深度、结构化程度
- [x] 每个维度返回分数和原因

**Dependencies**: None

## Task 2: 实现动态阈值系统
- [x] 修改 `src/background/memoryContentAnalyzer.ts`
- [x] 创建 `calculateThreshold` 函数
- [x] 根据内容特征动态计算阈值：
  - [x] 检测到"记住"指令：阈值 = 25
  - [x] 检测到个人信息：阈值 = 30
  - [x] 一般内容：阈值 = 40
  - [x] 疑似寒暄：阈值 = 50
- [x] 修改 `isWorthRemembering` 判断逻辑

**Dependencies**: Task 1

## Task 3: 增强评分算法
- [x] 修改 `src/background/memoryContentAnalyzer.ts`
- [x] 实现加权总分计算：
  ```typescript
  totalScore = Σ(dimension.score × dimension.weight)
  ```
- [x] 实现评分详情输出：
  ```typescript
  {
    totalScore: number,
    threshold: number,
    isWorthRemembering: boolean,
    breakdown: DimensionScore[]
  }
  ```
- [x] 添加更多匹配模式：
  - [x] 职业相关：工程师、设计师、老师、医生等
  - [x] 学习相关：正在学、备考、复习、课程
  - [x] 生活相关：住在、来自、家乡

**Dependencies**: Task 1, Task 2

## Task 4: 优化日志输出
- [x] 修改 `src/background/memoryContentAnalyzer.ts`
- [x] 添加详细的评分日志：
  - [x] 每个维度的得分
  - [x] 权重应用情况
  - [x] 最终阈值
  - [x] 是否保存的决定
- [x] 修改 `src/background/index.ts`
- [x] 在记忆保存前输出完整的评分分析

**Dependencies**: Task 3

## Task 5: 测试和验证
- [x] 测试各种内容类型的评分：
  - [x] "记住我的名字是archer" → 应该 >= 30分
  - [x] "我喜欢吃苹果" → 应该 >= 30分
  - [x] "我正在学习TypeScript" → 应该 >= 30分
  - [x] "你好" → 应该 < 30分
  - [x] "谢谢" → 应该 < 30分
- [x] 验证阈值动态调整是否正确
- [x] 验证评分详情输出是否清晰
- [x] 运行 `npm run build` 确保无错误

**Dependencies**: Task 1, Task 2, Task 3, Task 4

# Task Dependencies

```
Task 2 depends on Task 1
Task 3 depends on Task 1, Task 2
Task 4 depends on Task 3
Task 5 depends on Task 1, Task 2, Task 3, Task 4
```

# Parallelizable Work

- Task 1 可以独立完成
