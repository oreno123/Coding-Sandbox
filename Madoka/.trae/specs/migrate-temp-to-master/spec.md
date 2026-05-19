# 迁移 temp-test 分支代码到 master Spec

## Why

当前在 `temp-test` 分支上完成了 GitHub 远程更改的合并和构建错误的修复，需要将这些更改迁移到本地的 `master` 分支，以保持主分支的代码最新。

## What Changes

将 `temp-test` 分支的以下更改迁移到 `master` 分支：
- GitHub 找项目功能（/github、/find、/找项目 命令）
- GitHub Token 配置支持
- 翻译功能、链接摘要、新内容脚本
- 修复 GitHub 搜索端口关闭问题（使用 Port 进行长连接）
- 构建错误修复（导入语句、类型注解）

## Impact

- 本地 `master` 分支将被更新，包含所有最新功能
- `temp-test` 分支可以保留作为备份或在迁移完成后删除

## ADDED Requirements

### Requirement: 安全迁移分支代码
The system SHALL migrate code from temp-test to master without losing any changes.

#### Scenario: 迁移流程
- **GIVEN** temp-test 分支包含最新代码
- **WHEN** 执行迁移操作
- **THEN** master 分支包含所有 temp-test 的更改
- **AND** 代码可以成功构建
- **AND** 所有功能正常工作

## MODIFIED Requirements

无

## REMOVED Requirements

无
