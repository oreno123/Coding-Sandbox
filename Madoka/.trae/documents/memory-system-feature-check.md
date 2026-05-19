# 记忆系统功能完整性检查报告

## 需求功能清单 vs 实际实现

### 3.1 首次使用流程

| 功能需求 | 实现状态 | 说明 |
|---------|---------|------|
| Settings勾选「启用本地记忆」 | ✅ 已实现 | SettingsPanel.tsx 中有「启用记忆」开关 |
| 「Obsidian 自动同步」开关 | ✅ 已实现 | SettingsPanel.tsx 中有「Obsidian 同步」开关 |
| 「选择 Obsidian 库目录」按钮 | ❌ **缺失** | 设置页面没有提供选择目录的UI |
| 保存记忆设置 | ✅ 已实现 | 有「保存记忆设置」按钮，已修复读取/保存逻辑 |
| 自动保存对话记忆 | ⚠️ **部分实现** | 见下方详细分析 |
| 按板块带上下文提问 | ❌ **缺失** | 没有「本次导入」板块选择功能 |

#### 自动保存对话记忆分析

**当前实现：**
- [api.ts:119-147](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/api.ts#L119-L147) 有 `MEMORY_TAGS_INSTRUCTION`，会在每次对话时要求LLM输出记忆标签JSON
- [memoryWorker.ts:28-115](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/memoryWorker.ts#L28-L115) 有 `memoryAddEpisode` 函数用于添加记忆

**问题：**
- [background/index.ts:681-818](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/index.ts#L681-L818) 的 `handleSmartChatRequest` 中没有调用 `memoryAddEpisode`
- 对话结束后没有解析LLM返回的JSON并保存记忆
- 没有自动触发记忆保存的逻辑

**需要添加：**
1. 在 `handleSmartChatRequest` 中，对话结束后解析 `fullResponse` 中的JSON
2. 提取 memory 和 profile 数据
3. 调用 `memoryAddEpisode` 保存记忆
4. 调用 `memorySaveUserProfile` 更新用户画像

---

### 3.2 Obsidian 相关功能

| 功能需求 | 实现状态 | 说明 |
|---------|---------|------|
| 自动同步到 Obsidian | ⚠️ **部分实现** | 代码存在但未在对话流程中调用 |
| sync_status: failed 标记 | ✅ 已实现 | [memoryWorker.ts:107-111](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/memoryWorker.ts#L107-L111) 有实现 |
| 手动同步按钮 | ❌ **缺失** | 设置页面没有「立即选目录并同步到 Obsidian」按钮 |
| 只同步未同步的记忆 | ✅ 已实现 | [obsidianSync.ts:279-323](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/obsidianSync.ts#L279-L323) `writeEpisodesToObsidianWithHandle` 会跳过已同步的 |
| 删除旧uid文件再写新文件 | ✅ 已实现 | [obsidianSync.ts:292-306](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/obsidianSync.ts#L292-L306) 有实现 |
| 删除记忆时同步删除Obsidian文件 | ✅ 已实现 | [MemoryOverview.tsx:119-135](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/sidepanel/components/MemoryOverview.tsx#L119-L135) 有实现 |
| 自底向上清理空目录 | ✅ 已实现 | [obsidianSync.ts:249-272](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/obsidianSync.ts#L249-L272) `removeEmptyParentDirs` |

---

### 3.3 减少「乱码」与重复

| 功能需求 | 实现状态 | 说明 |
|---------|---------|------|
| LLM必填 block 与 shortTitle | ✅ 已实现 | [api.ts:129-132](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/api.ts#L129-L132) prompt中有约束 |
| 用上文板块兜底 | ✅ 已实现 | [memoryWorker.ts:66-74](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/memoryWorker.ts#L66-L74) 有实现 |
| 与上一条合并 | ✅ 已实现 | [memoryWorker.ts:77-98](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/memoryWorker.ts#L77-L98) 无可用标题时合并到上一条 |
| 从对话内容抽可读片段 | ✅ 已实现 | [obsidianSync.ts:166-175](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/obsidianSync.ts#L166-L175) `contentToBaseName` |
| 人物画像合并去重 | ✅ 已实现 | [memoryDb.ts:176-212](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/background/memoryDb.ts#L176-L212) `mergeUserProfile` 有拆分与去重逻辑 |

---

### 3.4 UI 入口

| 功能需求 | 实现状态 | 说明 |
|---------|---------|------|
| 侧边栏「记忆管理」按钮 | ✅ 已实现 | [Sidebar.tsx:67-78](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/sidepanel/components/layout/Sidebar.tsx#L67-L78) 已添加 |
| 记忆总览页面 | ✅ 已实现 | [MemoryOverview.tsx](file:///c:/Users/19516/Desktop/浏览器插件/Madoka/src/sidepanel/components/MemoryOverview.tsx) 有记忆列表和人物画像 |
| 记忆列表 | ✅ 已实现 | 显示所有记忆，支持固定/删除 |
| 人物画像 | ✅ 已实现 | 显示画像表格，支持删除标签 |
| 执行清理按钮 | ✅ 已实现 | 有「执行清理」按钮 |

---

## 缺失功能清单

### 高优先级（核心功能）

1. **对话后自动保存记忆**
   - 文件：`src/background/index.ts`
   - 位置：`handleSmartChatRequest` 函数末尾
   - 需求：解析LLM返回的JSON，调用 `memoryAddEpisode` 和 `memorySaveUserProfile`

2. **选择 Obsidian 库目录按钮**
   - 文件：`src/sidepanel/components/SettingsPanel.tsx`
   - 需求：添加按钮调用 `showDirectoryPicker` 选择目录并保存句柄

3. **手动同步到 Obsidian 按钮**
   - 文件：`src/sidepanel/components/SettingsPanel.tsx`
   - 需求：添加按钮触发未同步记忆的同步

### 中优先级（增强功能）

4. **「本次导入」板块选择**
   - 文件：需要新增组件
   - 需求：在输入框上方显示板块列表，支持多选
   - 发送时调用 `memoryQuery` 拉取选中板块的记忆

5. **发送时自动携带记忆上下文**
   - 文件：`src/background/index.ts`
   - 位置：`handleSmartChatRequest` 中构建messages时
   - 需求：根据选中的板块查询记忆，拼接到system prompt或user message中

---

## 建议修复顺序

1. 先实现「选择 Obsidian 库目录」功能（设置页面）
2. 实现对话后自动保存记忆（核心功能）
3. 实现手动同步按钮
4. 实现板块选择和记忆上下文携带

---

## 当前可用功能

✅ **已经可以使用的功能：**
- 启用/禁用记忆系统
- 启用/禁用用户画像
- 启用/禁用 Obsidian 同步
- 查看记忆列表
- 查看人物画像
- 手动固定/删除记忆
- 执行智能清理
- 删除记忆时同步删除 Obsidian 文件

❌ **暂时不可用的功能：**
- 自动保存对话记忆（代码存在但未集成到对话流程）
- 选择 Obsidian 库目录（UI缺失）
- 手动同步到 Obsidian（UI缺失）
- 按板块带上下文提问（UI和逻辑都缺失）
