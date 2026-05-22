# A11y 项目深度分析报告

> 基于项目根目录及 `dom/`、`browser-use/`、`dist/` 等实际文件与目录的分析，无臆测内容。

---

## 一、整体架构梳理

### 1.1 目录层级与职责

| 路径 | 核心职责 | 所属模块 | 类型 | 创建方式 |
|------|----------|----------|------|----------|
| **根目录** |  |  |  |  |
| `manifest.json` | 【核心】Chrome MV3 扩展清单；声明 service worker、popup、权限 | 配置 | 配置 | 手动 |
| `package.json` | 【核心】npm 项目配置；构建/格式化脚本；devDependencies | 配置 | 配置 | 手动 |
| `background.js` | 【核心】Service Worker；CDP 调用、三树抓取、合并、序列化、下载；**内联 dom 逻辑** | 扩展 / 后端 | 源码 | 手动 |
| `popup.html` | 【核心】扩展 Popup UI；四类操作按钮、状态区、说明卡片 | 扩展 / 前端 | 源码 | 手动 |
| `popup.js` | Popup 交互；发 `chrome.runtime.sendMessage` 触发 capture 等；更新状态、按钮禁用 | 扩展 / 前端 | 源码 | 手动 |
| `package-lock.json` | 锁定依赖版本 | 配置 | 配置 | 自动 |
| **dom/** | **模块化 DOM 逻辑**（CDP 服务、树合并、序列化管道）；与 `background.js` 内联实现对齐 | 扩展 / 逻辑层 | 源码 | 手动 |
| `dom/views.js` | 常量、NodeType、元素集、数据类（SimplifiedNode、SerializedDOMState 等） | dom | 源码 | 手动 |
| `dom/utils.js` | 工具函数：`capTextLength`、`parseComputedStyles`、hash/xpath、几何计算等 | dom | 源码 | 手动 |
| `dom/service.js` | `CDPService`：attach/debugger、fetchAllTrees、DOM/AX/Snapshot/LayoutMetrics | dom | 源码 | 手动 |
| `dom/tree_merger.js` | `TreeMerger`：三树合并为 EnhancedDOMTreeNode；visibility、scrollability | dom | 源码 | 手动 |
| `dom/serializer/index.js` | `DOMTreeSerializer`：编排 simplified → paint order → optimize → bbox → indices → LLM 文本 | dom | 源码 | 手动 |
| `dom/serializer/simplified_tree.js` | `SimplifiedTreeBuilder`、`TreeOptimizer`；过滤不可见/disabled/SVG 等 | dom | 源码 | 手动 |
| `dom/serializer/paint_order.js` | `PaintOrderRemover`；遮挡检测、RectUnion | dom | 源码 | 手动 |
| `dom/serializer/bbox_filter.js` | `BoundingBoxFilter`；containment、PROPAGATING 规则 | dom | 源码 | 手动 |
| `dom/serializer/clickable_detector.js` | `ClickableElementDetector`；可点击/分页检测 | dom | 源码 | 手动 |
| **browser-use/** | **Python 参考实现**；与扩展 JS 逻辑对应，用于算法对齐 | 参考 / 文档 | 源码 | 手动 |
| `browser-use/dom/service.py` | DomService、CDP 封装、三树获取 | 参考 | 源码 | 手动 |
| `browser-use/dom/enhanced_snapshot.py` | Snapshot 解析、build_snapshot_lookup | 参考 | 源码 | 手动 |
| `browser-use/dom/views.py` | 数据模型、常量（对应 `dom/views.js`） | 参考 | 源码 | 手动 |
| `browser-use/dom/serializer/*.py` | serializer、paint_order、clickable_elements 等 | 参考 | 源码 | 手动 |
| `browser-use/dom/*.md` | tree_get / tree_merge / tree_optimize 说明 | 参考 | 文档 | 手动 |
| **dist/** | 构建产物；拷贝 manifest、background、popup、dom 后打包 | 构建 | 产物 | 自动 |
| **.dev/** | `npm run dev` 输出；同 dist 但不打包 zip | 构建 | 产物 | 自动 |
| **node_modules/** | 第三方依赖（cpy-cli、prettier、rimraf 等） | 依赖 | 第三方 | 自动 |
| **a11y-extension.zip** | 最终分发包（`dist/*` 压缩） | 构建 | 产物 | 自动 |

**依赖关系简要**：

- `background.js` 不 `import` 任何模块；其内联实现**对应** `dom/*` 与 `dom/serializer/*` 的逻辑（注释中标注 "from dom/..."）。
- `popup.js` 仅依赖 `chrome.runtime.sendMessage`，不依赖 `dom/`。
- `dom/service.js` 依赖 `dom/views.js`；`dom/tree_merger.js` 依赖 `views`、`utils`；`dom/serializer/*` 依赖 `views`、`utils`，且 `index.js` 编排各 serializer 子模块。
- 运行时：**仅有 `background.js`、`popup.html`、`popup.js` 被加载**；`dist/dom/` 虽被拷贝，但未被 manifest 或任何脚本引用。

---

### 1.2 源码 / 构建 / 配置 / 依赖 / 临时目录分类

| 分类 | 目录/文件 |
|------|------------|
| **源码** | `background.js`、`popup.html`、`popup.js`、`dom/**`、`browser-use/**` |
| **构建产物** | `dist/`、`.dev/`、`a11y-extension.zip` |
| **配置** | `manifest.json`、`package.json`、`package-lock.json` |
| **第三方依赖** | `node_modules/` |
| **临时/缓存** | 无独立目录（build 前 `rimraf` 清理 `dist`、`.dev`、zip） |

---

## 二、关键文件深度解析

### 2.1 入口与启动

| 文件 | 作用 | 启动逻辑 |
|------|------|----------|
| **manifest.json** | 【核心】扩展入口 | `background.service_worker` → 加载 `background.js`；`action.default_popup` → `popup.html`。权限：`debugger`、`activeTab`、`downloads`。 |
| **background.js** | 【核心】后台入口 | 扩展加载时执行；注册 `chrome.runtime.onMessage`，根据 `request.action` 分发到 `captureAllTrees` / `captureMergedTree` / `captureLLMRepresentation` / `captureHumanReadable`。 |
| **popup.html** | 【核心】Popup 入口 | 点击扩展图标打开；内联 CSS（Design System）、四张操作卡片、状态区、Features、Pipeline 说明；底部 `<script src="popup.js">`。 |

**流程概要**：用户点击 Popup 中按钮 → `popup.js` 发 `sendMessage` → `background.js` 收消息 → 取当前 tab → `CDPService.attach` → `fetchAllTrees`（及可选的 merge/serialize）→ 下载 JSON/MD → `sendResponse` → Popup 更新状态。

---

### 2.2 核心配置文件

#### package.json

| 配置项 | 含义 |
|--------|------|
| `name` | 项目名 `a11y-browser-extension` |
| `main` | 入口 `background.js`（扩展实际以 manifest 为准） |
| `type: "module"` | 项目 ES 模块；扩展拷贝的是原始 JS，manifest 未显式指定 type |
| **scripts** |  |
| `build` | `clean` → `mkdir dist` → `cpy` 拷贝 `manifest.json`、`background.js`、`popup.html`、`popup.js`、`dom/` 到 `dist/` → `Compress-Archive` 生成 `a11y-extension.zip` |
| `dev` | `rimraf .dev` → `mkdir .dev` → `cpy` 同样文件到 `.dev/`（便于加载未打包扩展） |
| `clean` | 删除 `dist`、`.dev`、`a11y-extension.zip` |
| `format` | `prettier --write "**/*.{js,html,json}"` |
| **devDependencies** | `cpy-cli`（拷贝）、`prettier`、`rimraf`、`zip-a-folder`（未用；build 用 PowerShell 打包） |

- 无专门打包工具（webpack/vite/rollup）；构建 = 拷贝 + zip。
- 无 test、lint、类型检查脚本。

#### manifest.json

- `manifest_version: 3`；`background.service_worker`；`action.default_popup`；权限见上。

---

### 2.3 业务核心逻辑

#### background.js：CDP 与管道

- **常量 / 工具**：内联 `dom/views`、`dom/utils` 的常量与工具（NodeType、REQUIRED_COMPUTED_STYLES、`capTextLength`、`parseComputedStyles`、`calculateDevicePixelRatio`、`isContainedWithinBounds` 等）。
- **CDPService**： attach → `enableDomains`（DOM、DOMSnapshot、Accessibility、Page、Runtime）→ `fetchAllTrees`（`captureSnapshot`、`getDOMDocument`、`getFullAXTree`、`getLayoutMetrics` 并行，超时与重试）→ 限制 iframe 数量 → 返回 snapshot、domTree、axTree、layoutMetrics。
- **TreeMerger**：`_buildSnapshotLookup`、`_buildAXTreeLookup` → `_constructEnhancedNode` 递归建树（含 iframe 深度限制、shadow）→ `_computeHashesAndXPaths` → 计算 `is_visible`、`is_actually_scrollable`。
- **序列化管道**（与 `dom/serializer/index.js` 对齐）：  
  **SimplifiedTreeBuilder** → **PaintOrderRemover** → **TreeOptimizer** → **BoundingBoxFilter** → **assign interactive indices** → **serialize to LLM**。
- **Human Readable**：`generateHumanReadableMarkdown`（分类、ASCII 树、图标等）→ `downloadMarkdown`。

**四个 capture 的调用关系**：

1. **captureAllTrees**：`getActiveTab` → `CDPService` attach → `fetchAllTrees` → `downloadJSON`（原始三树 + layoutMetrics）→ detach。
2. **captureMergedTree**：同上取三树 → `TreeMerger.merge` → `downloadJSON`（enhanced 根 + metadata.stats）→ detach。
3. **captureLLMRepresentation**：取三树 → merge → `DOMTreeSerializer` serialize → `serializeToString` → `downloadJSON`（llm_representation、selector_map、metadata.timing/stats）→ detach。
4. **captureHumanReadable**：取三树 → merge → serialize → `generateHumanReadableMarkdown` → `downloadMarkdown` → detach。

#### dom/serializer 管道（与 background 内联逻辑一致）

1. **SimplifiedTreeBuilder**：过滤 DOCUMENT_NODE、DISABLED_ELEMENTS、SVG、data-browser-use-exclude、不可见等；Shadow/iframe 特殊处理；`should_display` 标记。
2. **PaintOrderRemover**：按 paint order 分层，RectUnion 做遮挡，标记 `ignored_by_paint_order`。
3. **TreeOptimizer**：去掉无意义包装节点。
4. **BoundingBoxFilter**：PROPAGATING 元素传播 bbox，子节点 contained 且非例外则 `excluded_by_parent`。
5. **ClickableElementDetector**：用于 `_assignInteractiveIndices`；tag/role/ AX/attributes/cursor 等判断可点击。
6. **DOMTreeSerializer**：组装上述步骤，输出 `[backend_node_id]<tag ... />` 形式 LLM 文本。

---

## 三、技术栈与开发规范

### 3.1 技术栈

| 类别 | 技术 |
|------|------|
| **语言** | JavaScript（ES6+）；Python 3（仅 browser-use 参考） |
| **运行环境** | Chrome 扩展 MV3（Service Worker + Popup） |
| **前端** | 原生 HTML/CSS/JS；无框架 |
| **后端/逻辑** | 无独立后端；扩展 background 即“后端” |
| **构建** | npm scripts + cpy + PowerShell Compress-Archive；无 webpack/vite |
| **代码风格** | Prettier（`**/*.{js,html,json}`） |
| **协议/API** | Chrome DevTools Protocol (CDP)；Chrome Extension APIs（debugger、tabs、runtime、downloads） |

### 3.2 开发规范（可从现有代码推断）

- **命名**：文件名小写+下划线（`tree_merger.js`、`clickable_detector.js`）；类名大驼峰；常量大写下划线；函数小驼峰。
- **模块**：`dom/` 使用 ES modules（`import`/`export`）；`background.js` 为单文件、无 import。
- **注释**：`@file`、`@description`、`@param`/`@returns` 等 JSDoc；段落注释如 `// ========== CDP SERVICE ==========`。
- **错误处理**：Promise `.catch` → `sendResponse({ success: false, error: e.message })`；CDP 超时重试；用户端 `updateStatus('error', ...)`。
- **日志**：`console.log` / `console.warn` 带 `[CDPService]`、`[TreeMerger]`、`[Serializer]` 等前缀。

### 3.3 环境区分

- 无 `.env` 或环境变量配置。
- **开发**：`npm run dev` → 输出 `.dev/`，在 Chrome 加载未打包扩展。
- **生产**：`npm run build` → `dist/` + `a11y-extension.zip`，用于上架或分发。

---

## 四、潜在问题与优化建议

### 4.1 结构层面问题

| 问题 | 说明 |
|------|------|
| **双份实现** | `background.js` 内联整套 dom 逻辑，`dom/` 为独立模块；修改需同步两处，易漂移。 |
| **dom 在 dist 未使用** | 构建拷贝 `dom/` 到 `dist/`，但 manifest 与所有脚本均不引用；运行时仅用 `background.js`。 |
| **Popup 与 Background 元数据不一致** | Popup 使用 `meta.snapshot_entries`、`meta.ax_tree_entries`、`meta.tree_fetch_time_ms`、`meta.merge_time_ms`、`meta.capture_time_ms` 等；各 capture 返回的 `metadata`/`stats` 命名与结构不全一致（如 camelCase vs snake_case、缺少 timing），导致部分状态展示为 `undefined`。 |
| **配置与魔术数字分散** | CDP 超时、iframe 上限、visibility buffer、containment 阈值等分散在 `background.js`、`dom/service`、`dom/tree_merger`、`dom/serializer`；无统一配置入口。 |
| **缺少统一工具层** | 工具函数在 `dom/utils.js` 与 `background.js` 内联中各有一份；hash、几何等略有三处实现。 |

### 4.2 可落地优化建议

1. **单一数据源，消除重复实现**  
   - 用打包工具（如 rollup/esbuild）以 `dom/` 为源，生成单一 `background.bundle.js`，manifest 引用该 bundle；删除 `background.js` 内联的 dom 逻辑。  
   - 或：保持无打包，让 background 通过 `import` 使用 `dom/`（需 manifest 指定 `type: "module"` 等，并确认 MV3 支持）。

2. **构建要么不拷贝 `dom/`，要么真正使用**  
   - 若采用上述 bundle 方案，构建时不再把 `dom/` 拷贝到 `dist/`。  
   - 若坚持多文件，则让 background 以 ES 模块加载 `dom/`，并确保构建产物与 manifest 配置匹配。

3. **统一 Popup 与 Background 的 metadata 约定**  
   - 在 background 各 capture 的返回里统一增加：`metadata.capture_time_ms`、`tree_fetch_time_ms`、`merge_time_ms`，以及 `snapshot_entries`、`ax_tree_entries`（或统一 camelCase 并予文档约定）。  
   - Popup 仅使用约定字段，避免访问不存在的属性。

4. **抽离配置模块**  
   - 新增 `dom/config.js`（或 `config.js`），集中 CDP 超时、iframe 限制、visibility buffer、containment 阈值、REQUIRED_COMPUTED_STYLES 等；`dom/service`、`tree_merger`、`serializer` 仅从该模块读取。

5. **工具函数只保留一处**  
   - 以 `dom/utils.js` 为唯一来源；`background`（或 bundle）只从 `dom/utils` 引用，删除内联复制。

6. **可选：`src/types` 或 JSDoc 集中化**  
   - 若有共享数据结构（如 Enhanced 节点、SerializedDOMState），可考虑 `src/types` 仅做 JSDoc `@typedef` 集中描述，供 IDE 与文档使用。

### 4.3 性能、可维护性、扩展性

- **性能**：  
  - 大页面时 `fetchAllTrees`、merge、序列化均在 main 线程；可考虑 Worker 中做 merge/serialize，减少 popup 卡顿（需评估 Chrome 扩展 Worker 限制）。  
  - iframe 数量与深度已有上限，可保持并确保配置化。

- **可维护性**：  
  - 单一实现 + 配置模块 + 明确 metadata 约定，便于后续改 CDP 或 pipeline。  
  - 为 `capture*`、`TreeMerger`、`DOMTreeSerializer` 等加轻量单元测试，防止重构回归。

- **扩展性**：  
  - 若以后支持更多导出格式（如 HTML、CSV），建议将“序列化器”抽象为可插拔（例如不同 serializer 实现同一接口），由配置或 UI 选择，而非在 background 里堆叠 `if/else`。

---

## 五、模块间交互方式

```
┌─────────────────────────────────────────────────────────────────┐
│ Popup (popup.html + popup.js)                                    │
│   - 用户点击四类按钮                                               │
│   - chrome.runtime.sendMessage({ action: 'captureAllTrees'|... }) │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Background (background.js)                                        │
│   - chrome.runtime.onMessage                                      │
│   - getActiveTab → CDPService → fetchAllTrees                     │
│   - TreeMerger.merge → (可选) DOMTreeSerializer → 下载             │
│   - sendResponse({ success, data|error })                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Chrome APIs                                                       │
│   - chrome.tabs.query (activeTab)                                 │
│   - chrome.debugger.attach/detach, sendCommand (CDP)              │
│   - chrome.downloads.download                                     │
└─────────────────────────────────────────────────────────────────┘
```

- **Popup ↔ Background**：仅通过 `sendMessage` / `sendResponse`；无共享 DOM、无直接引用。  
- **Background ↔ CDP**：通过 `chrome.debugger` 绑定当前 tab 后发送 CDP 命令。  
- **browser-use**：独立 Python 项目，与扩展无运行时交互；仅作算法与数据结构的参考对照。

---

*分析依据：项目根目录、`dom/`、`browser-use/`、`dist/`、`package.json`、`manifest.json` 及上述各核心文件的实地阅读。*
