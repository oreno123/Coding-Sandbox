# 修复构建错误 Spec

## Why

运行 `npm run build` 时出现 3 个 TypeScript 错误，需要修复以确保代码可以成功编译。

## What Changes

- 修复 `src/background/index.ts:417` - 导入 `handleGitHubSearch` 函数
- 修复 `src/background/index.ts:418` - 添加 `result` 参数的类型注解
- 修复 `src/sidepanel/hooks/useChat.ts:8` - 移除未使用的 `sendToBackground` 导入

## Impact

- 影响文件：
  - src/background/index.ts
  - src/sidepanel/hooks/useChat.ts

## ADDED Requirements

无

## MODIFIED Requirements

### Requirement: 代码可编译性
The system SHALL successfully compile without TypeScript errors.

#### Scenario: 构建成功
- **WHEN** 运行 `npm run build`
- **THEN** 不应该出现任何 TypeScript 错误

## REMOVED Requirements

无
