# 与 `111/Madoka` 大项目的合并说明

## 差异结论（合并前）

| 维度 | 主版本（仓库根目录） | `111/Madoka` |
|------|---------------------|--------------|
| 依赖 | MCP、pdfjs、GitHub 搜索、完整 content 脚本等 | 精简依赖（无 MCP SDK 等） |
| 画像 | `UserProfile` 表格结构 + `memoryDb.userProfile` | 额外 **画像 V2**：独立库 `MadokaProfile`（栏 + 标签 + 冲突检测） |
| 清理 | `cleanupEngine` + `MemorySettings` 阈值 | 额外 **CleanupConfig**：按比例预览/手动执行、自动阈值 |
| Obsidian | `writeEpisodeToObsidian` / 批量写入 | 额外 **自动导出规则**（关侧栏 / 定时 / 数量阈值） |
| UI | 单页 `SettingsPanel` + MemoryOverview | 拆分为 `ConfigPanel` / `UserProfilePanel` / `MemoryLibraryPanel`（**侧栏里未接全 background**） |
| 调试代码 | 无 | `profileWorker` 曾含本机 ingest URL（已剔除） |

## 已并入主版本的内容

1. **`src/shared/memory-types.ts`**  
   增加：`ProfileTag`、`ProfileColumn`、`UserProfileV2`、`DEFAULT_PROFILE_COLUMNS`、`AutoExportRule`、`CleanupConfig`、`ProfileTagUpdateFromLLM`、`ProfileTagsFromLLM` 等。

2. **`src/shared/memory-db-constants.ts`**  
   `MEMORY_DB_VERSION` **1 → 2**；升级时在 **同一 `MadokaMemory` 库** 中创建：
   - `autoExportRules`
   - `cleanupConfig`

3. **`src/background/memoryDb.ts`**  
   使用常量中的版本号；上述两仓库在 `onupgradeneeded` 中创建；导出 **`openMemoryDatabase()`** 供子模块共用连接（**不再各自 `close` 主库**）。

4. **新增模块**  
   - `autoExportDb.ts` / `autoExport.ts`  
   - `cleanupConfigDb.ts` / `memoryCleanup.ts`  
   - `profileDb.ts`（库名 **`MadokaProfile`**）  
   - `profileConflictDetector.ts` / `profileWorker.ts`

5. **`src/background/obsidianSync.ts`**  
   新增 **`runObsidianExport`**，供自动导出调用（依赖已保存的 Obsidian 根目录句柄）。

6. **`src/background/index.ts`**  
   注册与 `MEMORY_REFACTOR_SUMMARY.md` 一致的消息 action（画像 V2 CRUD、清理配置、预览/执行清理、自动导出规则、画像摘要、`memoryProcessProfileUpdate` 等）。

## 主 UI 已接入（记忆模式）

设置页顶部增加四个分栏：**常规** | **记忆配置** | **用户画像** | **记忆库**。

- `src/sidepanel/components/memory/ConfigPanel.tsx`：记忆系统开关、Obsidian 目录与同步、清理配置、自动导出规则；主题与默认搜索在「常规」。
- `memory/UserProfilePanel.tsx`：画像 V2（栏/标签、导入导出、查重）。
- `memory/MemoryLibraryPanel.tsx`：按板块树、批量操作、导入导出、同步 Obsidian、按选中创建导出规则。

`111` 里未合入的仍是 **Cursor 式 Sidebar/Header** 等整体布局（与主版侧栏聊天结构无关）。

## 可选后续

- 在侧栏关闭时调用 `onSidepanelClose()`（`autoExport.ts`）以实现「关侧栏导出」规则（需选对生命周期 API，MV3 侧栏行为以实测为准）。  
- 定时触发 `checkAndTriggerAutoExport()`：可用 `chrome.alarms` 与现有记忆闹钟协调，避免重复唤醒。  
- 对话流中解析 `<!--PROFILE:...-->` 并调用 `memoryProcessProfileUpdate`（若与现有 `ProfileUpdatesFromLLM` 表格画像并存，需产品层统一策略）。

## 本地目录

原参考目录 **`111/`** 已从仓库删除（合并内容已在主工程 `src/` 中）。若仍需旧树，请从备份或 Git 历史恢复。
