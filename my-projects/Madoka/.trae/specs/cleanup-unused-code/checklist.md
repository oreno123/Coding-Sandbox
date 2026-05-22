# Checklist

## 删除已弃用代码

- [ ] `performSearch()` 函数已删除
- [ ] `fetchPage()` 函数已删除
- [ ] `parseSearchInContentScript()` 函数已删除
- [ ] search.ts 文件大小减少

## 删除未使用组件

- [ ] InputArea.tsx 文件已删除
- [ ] Header.tsx 文件已删除
- [ ] 无其他文件引用这两个组件

## 启用智能记忆判定

- [ ] memoryContentAnalyzer.ts 已导入到 memoryWorker.ts
- [ ] memoryAddEpisode 调用 analyzeContentForMemory
- [ ] 低于阈值的记忆不被保存
- [ ] 分析结果记录到日志

## 启用记忆使用检测

- [ ] memoryUsageDetector.ts 已导入到 index.ts
- [ ] handleSmartChatRequest 调用 detectMemoryUsage
- [ ] 使用的记忆权重增加
- [ ] 未使用的记忆权重降低
- [ ] 使用情况记录到日志

## 清理未使用导入

- [ ] index.ts 中的 UserProfile 导入已删除
- [ ] api.ts 中的重复常量导入已删除

## 代码质量

- [ ] 无 TypeScript 编译错误
- [ ] 无 ESLint 错误
- [ ] 代码符合项目风格

## 功能验证

- [ ] 搜索功能正常工作
- [ ] 记忆保存正常工作
- [ ] 记忆判定功能生效
- [ ] 记忆使用检测生效
