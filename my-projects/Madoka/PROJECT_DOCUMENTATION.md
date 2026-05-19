# Madoka - 智能搜索助手 项目功能文档

> 版本：2.0.0 | 最后更新：2025-03-18

## 一、项目概述

**Madoka** 是一款基于 Chrome Manifest V3 的浏览器扩展，定位为「联网搜索增强 LLM 对话插件」。它结合 Jina Reader、通义千问 API、MCP 协议等能力，提供侧边栏 AI 对话、网页阅读、划词翻译、记忆管理、Obsidian 同步等一体化体验。

### 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript + Vite 7 |
| 构建 | @crxjs/vite-plugin（Chrome 扩展） |
| 样式 | Tailwind CSS + Framer Motion |
| 核心依赖 | @modelcontextprotocol/sdk、@mozilla/readability、pdfjs-dist、marked、zod |

### 架构概览

```
Madoka/
├── src/
│   ├── background/     # Service Worker：搜索、API、记忆、Obsidian 同步
│   ├── sidepanel/      # React 侧边栏 UI
│   ├── content/        # 注入脚本：页面读取、划词翻译、Action Space
│   └── shared/         # 共享类型、常量、工具
```

---

## 二、核心功能模块

### 1. AI 对话（Chat）

- **侧边栏对话**：在 Chrome 侧边栏中进行多轮对话，支持流式输出
- **通义千问 API**：默认使用阿里云 DashScope 兼容接口（`qwen-plus`）
- **多模态输入**：支持文本 + 截图（区域截图），视觉模型为 `qwen-vl-plus`
- **停止生成**：可随时中断 AI 回复
- **对话管理**：支持多对话切换、新建对话

### 2. 联网搜索（Web Search）

- **搜索引擎**：支持 Bing、Google（可配置）
- **多轮搜索**：1–3 轮可配置，首轮搜索后由 LLM 生成变体 query 再搜
- **真实搜索管线**：通过打开搜索引擎首页、模拟输入并触发搜索，获取完整搜索结果
- **Jina Reader**：抓取搜索结果页内容，提取正文
- **LLM 生成 query**：可选启用，由模型生成更精准的搜索词

### 3. GitHub 搜索（GitHub Search）

- **独立模式**：与联网搜索互斥，专门用于「找项目」
- **长连接**：通过 `chrome.runtime.onConnect` 建立 Port，避免超时
- **GitHub API**：支持配置 GitHub Token 提高限流
- **结果展示**：以卡片形式展示仓库（full_name、stars、language 等）

### 4. 上下文引用（@ Context）

- **@ 触发**：输入 `@` 唤起上下文选择器
- **支持类型**：
  - **当前页面**：当前标签页内容
  - **标签页**：所有打开的 Tab，支持搜索
  - **书签**：书签树，支持搜索
  - **历史记录**：浏览历史，支持搜索
- **统一解析**：通过 `resolveContextContent` 拉取网页内容（Jina Reader）
- **多轮引用**：最近 2 轮带引用的用户消息会保留引用内容，单条最大 10000 字符

### 5. 网页划线引用

- **实时同步**：用户在网页选中文本后，通过 `selectionchange` 同步到 `chrome.storage.session`
- **自动附加**：发送消息时，若存在 `currentSelection`，自动作为 `resource_infos` 附加
- **展示**：`WebpageHighlightRefsBar` 显示当前划线内容

### 6. 区域截图

- **流程**：点击截图按钮 → 在页面拖拽选择区域 → 裁剪并附加为 base64 图片
- **PDF 支持**：PDF 查看器页面会注入 `screenshot-handler.js` 再显示区域选择器
- **多图**：支持附加多张截图，可移除

### 7. 划词翻译

- **触发方式**：
  - **常态模式**：选中文本后显示翻译按钮，点击翻译
  - **专注模式**：选中文本后直接翻译（Alt+T 切换）
  - **禁用模式**：不触发翻译
- **翻译服务**：MyMemory API（`api.mymemory.translated.net`），支持中英互译
- **弹窗**：翻译结果以悬浮弹窗展示
- **PDF**：PDF 查看器页面同样支持划词翻译

### 8. 链接总结（Link Summary）

- **入口**：右键链接 →「📝 Madoka: 总结此链接」
- **流程**：打开侧边栏 → 通过 Jina Reader 抓取链接内容 → LLM 生成总结 + 关键要点
- **跳转原文**：每个要点可「查看原文」，在目标页高亮对应段落并滚动到视图
- **View Source**：通过 `chrome.scripting.executeScript` 注入高亮逻辑，支持选择器 + 文本双重定位

### 9. 记忆系统（Memory）

- **本地存储**：IndexedDB（`memoryDb`）存储 Episode
- **Episode 结构**：content、summary、topics、block、subBlock、shortTitle、weight、syncStatus 等
- **自动记忆**：对话结束后，若 LLM 返回 `<!--MEMORY:...-->` 格式标签，经内容分析后自动入库
- **内容分析**：`memoryContentAnalyzer` 对 user/assistant 内容打分，决定是否值得记忆
- **权重调整**：`memoryUsageDetector` 检测回复中是否引用记忆，动态调整 weight
- **用户画像**：支持 `UserProfile` 多维度标签，LLM 可更新画像
- **板块选择**：`BlockSelector` 支持按 block 筛选记忆（UI 当前隐藏）

### 10. Obsidian 同步

- **目录选择**：通过 File System Access API 选择 Obsidian 库根目录
- **路径结构**：`MadokaMemory / 板块 / [子模块] / 可读标题.md`
- **Frontmatter**：支持 YAML / JSON 格式
- **同步状态**：success / failed / retrying / pending
- **增量写入**：仅同步 `syncToObsidian=true` 的 Episode

### 11. 记忆清理（Cleanup）

- **定时任务**：`chrome.alarms` 每日触发 `memoryRunCleanup`
- **规则**：按 `retainCreatedDays`、`retainAccessedDays`、`retainWeightMin` 等保留，按 `cleanupCreatedDays`、`cleanupWeightMax` 等清理
- **压力清理**：`memoryCheckQuotaAndCleanup` 在配额超限时触发压力清理
- **日志**：`memoryGetCleanupLogs` 可查看清理记录

### 12. MCP 集成（Model Context Protocol）

- **多 Server**：支持配置多个 MCP Server（语雀、GitHub、自定义）
- **Token 管理**：每个 Server 可配置 Bearer Token，单独存储
- **连接测试**：侧边栏直接调用 `mcpClient.testMCPServerConnection`
- **Tools 调用**：对话时若有 `mcpTools`，走 `callTongyiAPIWithTools`，通过 `mcpCallTool` 转发

### 13. 提示词模板

- **模板管理**：`PromptTemplateManager` 支持增删改查、复制、设默认
- **优化提示词**：点击 ✨ 按钮，将当前输入发送给 LLM 优化，流式回填到输入框
- **系统提示**：优化时使用当前激活模板的 `content` 作为 system prompt

### 14. Action Space（Browser Agent）

- **提取**：`MadokaActionParser.extractCurrentPage` 解析页面可操作元素
- **类型**：click、input、select、toggle、navigate、submit、generic
- **执行**：`MadokaActionExecutor.execute` 根据 actionId 执行 DOM 操作
- **高亮**：支持对 Action 高亮（pending/executing/success/failed）
- **危险等级**：safe / warning / danger，含关键词检测

### 15. PDF 相关

- **PDF 查看器**：使用 `pdfjs-dist`，通过 `public/pdfjs/web/viewer.html` 打开
- **划词翻译**：PDF 页面支持划词翻译
- **区域截图**：PDF 页面支持区域截图（需注入脚本）
- **PDF 翻译**：`PdfTranslator` 组件支持分段翻译，当前在 Composer 中隐藏

### 16. 设置面板

- **API 配置**：API Key、Endpoint、模型、视觉模型、搜索引擎、搜索轮数等
- **字体**：系统默认 / 无衬线 / 衬线 / 等宽，字号小/中/大
- **主题**：亮色 / 暗色 / 跟随系统
- **记忆设置**：启用、Obsidian 同步、用户画像、保留/清理规则、配额等
- **Obsidian**：选择根目录、子目录、Frontmatter 格式
- **MCP**：Server 列表、Token、连接测试

### 17. 右键菜单

- **总结此链接**：右键链接时显示，点击后打开侧边栏并展示链接总结

### 18. 其他能力

- **Ask AI**：划词翻译弹窗中的「问 AI」将原文存入 `pendingQuestion`，打开侧边栏后自动填入输入框
- **DeepLX 翻译**：`translateWithDeepLX` 支持多服务 fallback，用于 PDF 等场景
- **Condense Question**：多轮对话时，将追问压缩为独立 query 用于搜索

---

## 三、消息与通信

### Background ↔ Sidepanel

| action | 说明 |
|--------|------|
| chat | 发送对话请求（已统一到 smartChat） |
| sendMessages | 发送消息数组（含 context/reference） |
| smartChat | 智能对话（含搜索、记忆、MCP） |
| getConfig / saveConfig | 配置读写 |
| mcpGetConfig / mcpSaveConfig | MCP 配置 |
| memory* | 记忆 CRUD、设置、清理、Obsidian |
| optimizePrompt | 提示词优化（流式） |
| startRegionCapture / regionSelected / croppedScreenshot | 区域截图 |
| setCurrentSelection / getHighlightRefs / addHighlightRef 等 | 划线引用 |

### Background ↔ Content Script

| action | 说明 |
|--------|------|
| readPage | 读取当前页（Readability） |
| parseSearch | 解析搜索结果 HTML |
| readHTML | 从 HTML 字符串解析内容 |
| extractActionSpace / executeAction / highlightAction 等 | Action Space |
| showRegionSelector / cropScreenshot | 区域截图 |
| highlightAndScroll | 高亮并滚动到指定元素 |
| showLinkSummary | 显示链接总结弹窗 |

### Content Script 本地

- **划词翻译**：`translate`、`askAI`
- **翻译模式**：`translationMode` 存于 `chrome.storage.local`

---

## 四、权限说明

| 权限 | 用途 |
|------|------|
| storage | 配置、记忆、会话数据 |
| scripting | 注入脚本、执行代码 |
| sidePanel | 侧边栏 |
| tabs | 标签页管理、截图 |
| bookmarks | 书签引用 |
| history | 历史记录引用 |
| contextMenus | 右键「总结此链接」 |
| notifications | 错误提示 |
| host_permissions | Google/Bing/阿里云/全站 |

---

## 五、目录结构速览

```
src/
├── background/
│   ├── index.ts          # 主入口、消息分发
│   ├── api.ts            # 通义千问 API、流式、Tools
│   ├── search.ts         # 多轮搜索、Jina Reader
│   ├── context.ts        # Tabs/Bookmarks/History
│   ├── config.ts         # 配置、MCP 配置
│   ├── memoryWorker.ts   # 记忆 CRUD
│   ├── memoryDb.ts       # IndexedDB
│   ├── memoryContentAnalyzer.ts
│   ├── memoryUsageDetector.ts
│   ├── memoryScoring.ts
│   ├── cleanupEngine.ts
│   ├── obsidianSync.ts   # Obsidian 同步
│   ├── githubSearch.ts
│   └── mcpClient.ts
├── sidepanel/
│   ├── App.tsx
│   ├── context/          # ChatContext、ToastContext
│   ├── components/       # 各 UI 组件
│   ├── hooks/            # useChat、useSettings、usePageReader 等
│   ├── lib/              # mcpClient、saveObsidianHandle
│   └── styles/
├── content/
│   ├── index.ts          # 消息分发、划词翻译
│   ├── reader.ts         # Readability 读取
│   ├── parser.ts         # 搜索结果解析
│   ├── translation-popup.ts / translate-button.ts
│   ├── region-selector.ts
│   ├── highlighter.ts / selector-generator.ts
│   ├── action-parser.ts / action-executor.ts
│   ├── link-summary-popup.ts
│   ├── pdf-handler.ts
│   └── image-viewer.ts
└── shared/
    ├── types.ts
    ├── memory-types.ts
    ├── action-types.ts
    ├── context-types.ts
    ├── prompt-templates.ts
    ├── constants.ts
    └── messaging.ts
```

---

## 六、开发与构建

```bash
# 开发
npm run dev

# 构建
npm run build

# 预览
npm run preview
```

构建产物在 `dist/`，可通过 Chrome 扩展管理页加载 `dist` 目录进行调试。

---

## 七、已知限制与待完善

- PDF 翻译入口在 Composer 中已隐藏
- BlockSelector（记忆板块选择）UI 已隐藏
- MCP 的 `mcpCallTool` 需在 Background 中实现实际转发逻辑
- 部分功能依赖 Jina Reader、MyMemory 等外部服务可用性

---

*本文档基于代码静态分析生成，力求覆盖主要功能与数据流。*
