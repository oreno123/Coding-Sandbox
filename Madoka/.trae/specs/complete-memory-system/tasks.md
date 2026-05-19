# Tasks

## Task 1: SettingsPanel 添加 Obsidian 库目录选择按钮
- [x] 在记忆系统设置区块添加「选择 Obsidian 库目录」按钮
- [x] 实现点击按钮调用 `showDirectoryPicker` 选择目录
- [x] 保存目录句柄到 IndexedDB（调用 memorySaveObsidianSettings）
- [x] 显示当前已选目录路径（如果有）
- [x] 处理权限被拒绝的情况，显示错误提示

**Dependencies**: None

## Task 2: SettingsPanel 添加手动同步到 Obsidian 按钮
- [x] 在记忆系统设置区块添加「立即同步到 Obsidian」按钮
- [x] 实现点击后调用 `memoryGetAll` 获取所有记忆
- [x] 筛选出 syncStatus 不为 'success' 的记忆
- [x] 调用 `writeEpisodesToObsidianWithHandle` 进行同步
- [x] 更新同步状态到 IndexedDB
- [x] 显示同步结果（成功/失败数量）
- [x] 未选择目录时提示用户先选择目录

**Dependencies**: Task 1

## Task 3: 对话后自动保存记忆
- [x] 在 `handleSmartChatRequest` 中，streamEnd 后添加记忆保存逻辑
- [x] 检查记忆功能是否启用（memoryGetSettings）
- [x] 解析助手回复中的 JSON 代码块
- [x] 提取 memory 数据（shouldPersist, summary, topics, block, subBlock, shortTitle, memoryType）
- [x] 提取 profile 数据
- [x] 调用 `memoryAddEpisode` 保存记忆
- [x] 调用 `memorySaveUserProfile` 更新用户画像
- [x] JSON 解析失败时静默处理，不影响对话流程

**Dependencies**: None

## Task 4: 创建板块选择组件（BlockSelector）
- [x] 新建组件 `src/sidepanel/components/BlockSelector.tsx`
- [x] 组件加载时调用 `memoryGetBlockList` 获取板块列表
- [x] 显示所有板块为可点击标签
- [x] 支持多选，选中的板块高亮显示
- [x] 提供「清除选择」按钮
- [x] 将选中状态通过 props 或 context 暴露给父组件

**Dependencies**: None

## Task 5: 在聊天界面集成板块选择器
- [x] 在输入框上方添加 BlockSelector 组件
- [x] 将选中板块状态保存到 ChatContext
- [x] 确保切换对话时板块选择状态保持

**Dependencies**: Task 4

## Task 6: 发送消息时携带记忆上下文
- [x] 修改 `handleSmartChatRequest`，在构建 messages 前获取选中板块
- [x] 调用 `memoryQuery` 获取选中板块的记忆
- [x] 调用 `memoryGetUserProfile` 获取用户画像
- [x] 将记忆和画像内容格式化为字符串
- [x] 拼接到 system prompt 中
- [x] 未选中板块时不添加额外上下文

**Dependencies**: Task 5

## Task 7: 添加必要的消息处理器
- [x] 在 `background/index.ts` 添加 `memorySaveObsidianSettings` handler
- [x] 在 `background/index.ts` 添加 `memoryQuery` handler（如果还没有）
- [x] 确保所有记忆相关的消息处理器都正确返回数据

**Dependencies**: None

## Task 8: 构建和验证
- [x] 运行 `npm run build` 确保无 TypeScript 错误
- [x] 测试 Obsidian 目录选择功能
- [x] 测试手动同步功能
- [x] 测试对话后自动保存记忆
- [x] 测试板块选择和记忆上下文携带

**Dependencies**: Task 1, Task 2, Task 3, Task 6

# Task Dependencies

```
Task 2 depends on Task 1
Task 5 depends on Task 4
Task 6 depends on Task 5
Task 8 depends on Task 1, Task 2, Task 3, Task 6
```

# Parallelizable Work

- Task 1 和 Task 3 可以并行
- Task 4 和 Task 7 可以并行
