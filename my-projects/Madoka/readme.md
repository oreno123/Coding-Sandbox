# Madoka — 智能搜索助手

**Chrome side panel extension:** web search, Tongyi (DashScope) chat, page context, memory & optional Obsidian sync.

**版本 2.0.0** · Chrome 扩展（Manifest V3）· 侧边栏原生体验

---

## 目录

- [产品定位](#产品定位)
- [界面预览](#界面预览)
- [环境要求](#环境要求)
- [核心能力一览](#核心能力一览)
- [快速开始](#快速开始)
- [常见问题](#常见问题)
- [技术栈](#技术栈)
- [权限与隐私（摘要）](#权限与隐私摘要)
- [仓库结构（精简）](#仓库结构精简)
- [参与贡献](#参与贡献)
- [许可证与声明](#许可证与声明)

---

## 产品定位

Madoka 是一款面向 **日常浏览与深度检索** 的浏览器 AI 助手。它将 **大模型对话**、**真实网页搜索**、**网页正文抽取（Readability / Jina Reader 管线）** 和 **浏览器内上下文（标签页、书签、历史、当前页、划选与截图）** 放在同一套侧边栏工作流里，减少在搜索页、笔记应用和聊天窗口之间来回切换的成本。

**适合谁用**

- 需要「先搜再答」、且希望答案能对照真实检索结果的用户  
- 希望在当前网页上完成翻译、总结、划选引用与轻量自动化操作的用户  
- 希望把对话中有价值的片段沉淀为 **本地记忆**，并可选同步到 **Obsidian** 的用户  

**不替代什么**

- 不是独立笔记应用或云盘；记忆与同步依赖本机存储与您授权的目录  
- 不是通用 RPA；Action Space 面向页面内可解释的可操作元素，以安全提示与人工确认为主  

---

## 界面预览

<p align="center">
  <img src="public/icons/icon128.png" alt="Madoka 扩展图标" width="96" height="96" />
</p>

> **截图（可选）：** 将侧栏对话、@ 上下文、设置页等截图放入 [`docs/images/`](docs/images/)，并在本段下方用 Markdown 引用，例如 `![侧栏](docs/images/sidepanel.png)`（注意为 API Key 打码）。

---

## 环境要求

| 项 | 说明 |
|----|------|
| **Node.js** | **20.19+** 或 **22.12+**（与 Vite 7 要求一致） |
| **包管理** | npm（随 Node 安装） |
| **Chrome** | **114+**（Manifest V3 与侧栏 API） |

---

## 核心能力一览

### 对话与检索

| 能力 | 说明 |
|------|------|
| **智能对话** | 侧边栏多轮对话，支持流式输出与停止生成；默认对接阿里云 **通义千问**（DashScope 兼容接口） |
| **联网搜索** | 在 **Google / Bing** 上完成真实检索，结合正文抽取与 LLM 归纳；支持多轮搜索与 query 变体 |
| **GitHub 搜索** | 独立模式，用于检索仓库；可配置 Token 提升限额，结果以卡片展示 |
| **追问压缩** | 多轮对话中对追问做 **Condense Question**，便于独立检索与回答 |

### 阅读、翻译与总结

| 能力 | 说明 |
|------|------|
| **@ 上下文** | 输入 `@` 引用 **当前页、标签页、书签、历史**；统一拉取正文供模型使用 |
| **网页划选引用** | 选中文本可同步为上下文，发送时自动附加并在侧栏展示 |
| **区域截图** | 拖拽框选截图，支持多图；可与视觉模型（如 `qwen-vl-plus`）配合 |
| **划词翻译** | 选词翻译（默认 **MyMemory**）；支持常态 / 专注（**Alt+T**）/ 关闭；PDF 内同样可用 |
| **链接总结** | 右键链接 → **「Madoka: 总结此链接」**，侧栏生成摘要与要点，可 **跳转原文高亮** |
| **PDF** | 基于 **pdfjs** 的查看与翻译/截图等能力（与内容脚本协同） |

### 记忆与同步

| 能力 | 说明 |
|------|------|
| **本地记忆** | **IndexedDB** 存储 Episode；支持摘要、主题、板块、权重等；可结合内容分析自动入库 |
| **画像与权重** | 用户画像维度、引用检测与权重调整，用于长期记忆质量 |
| **清理策略** | 按保留天数、访问、权重等规则定时清理，并支持配额压力清理 |
| **Obsidian** | 通过 **File System Access API** 选择库目录，按约定路径写入 Markdown（含 Frontmatter 配置） |

### 自动化与扩展

| 能力 | 说明 |
|------|------|
| **Action Space** | 解析页面可操作元素（点击、输入、选择等），生成计划并由执行器操作 DOM，带安全等级提示 |
| **MCP** | 支持配置多个 **Model Context Protocol** 服务（如语雀、GitHub、自定义），对话中可调用 Tools |
| **提示词模板** | 模板管理、默认模板、一键优化当前输入（✨） |

### 其他

- **Ask AI**：翻译弹窗内可将问题带入侧栏输入框（`pendingQuestion`）  
- **主题与字体**：亮色 / 暗色 / 跟随系统；字体与字号可调  

---

## 快速开始

### 1. 安装依赖并构建

```bash
npm install
npm run build
```

### 2. 加载扩展

1. 打开 Chrome，访问 `chrome://extensions/`  
2. 开启「开发者模式」  
3. 「加载已解压的扩展程序」→ 选择项目下的 **`dist`** 目录（不是仓库根目录）  

### 3. 首次配置

在侧栏 **设置** 中配置 **通义 API Key**（及可选 Endpoint、主模型、视觉模型、搜索引擎与搜索轮数等）。  
划词翻译使用 MyMemory 公共接口时 **无需** 额外 Key。  
GitHub 搜索、MCP、Obsidian 等按需在设置中单独配置。  

### 4. 开发调试

```bash
npm run dev
```

（具体热更新与 CRX 调试方式以当前 Vite + CRXJS 配置为准。）

---

## 常见问题

| 现象 | 建议排查 |
|------|----------|
| 构建报错或 Vite 无法启动 | 确认 Node 版本满足上文 **环境要求**；删除 `node_modules` 后重新 `npm install` |
| 扩展加载后无侧栏 / 无反应 | 确认加载的是 **`dist`** 目录；未执行 `npm run build` 时 `dist` 可能不存在或过期 |
| 对话报错 / 无回复 | 在设置中检查 **通义 API Key**、Endpoint 与模型名；确认网络可访问 DashScope |
| 搜索无结果或异常 | 检查设置中的搜索引擎与轮数；部分网络环境需可访问 Google/Bing |
| 权限与数据去向 | 见下文 **权限与隐私** 与 **`PROJECT_DOCUMENTATION.md`** 中的权限表 |

---

## 技术栈

- **UI**：React 18、TypeScript、Tailwind CSS、Framer Motion  
- **构建**：Vite 7、`@crxjs/vite-plugin`  
- **协议与数据**：MCP SDK、Zod、Marked  
- **网页与 PDF**：Mozilla Readability、Turndown、pdfjs-dist  

---

## 权限与隐私（摘要）

扩展申请 **storage、scripting、sidePanel、tabs、bookmarks、history、contextMenus、notifications** 等权限，用于配置与记忆存储、侧栏、标签页与上下文读取、右键菜单等。  
**host_permissions** 包含搜索引擎、阿里云 DashScope 以及 **`<all_urls>`**，用于抓取与 API 调用；若上架 Chrome 网上应用店，请在商店说明或隐私政策中向最终用户写明数据流向与本地/云端范围。  

详细权限表见仓库内 **`PROJECT_DOCUMENTATION.md`**。  

---

## 仓库结构（精简）

```
src/
├── background/     # Service Worker：对话、搜索、记忆、MCP、Obsidian、截图与消息路由
├── content/        # 内容脚本：阅读、翻译、链接总结弹窗、Action、区域选择等
├── sidepanel/      # 侧栏 React 应用（对话、设置、记忆 UI 等）
├── shared/         # 类型、常量、消息封装等
└── manifest.json   # 扩展清单
```

更完整的模块说明与消息协议见 **`PROJECT_DOCUMENTATION.md`** 与 **`docs/`**。  

---

## 参与贡献

欢迎通过 Issue 反馈问题、通过 Pull Request 提交改进。提交前请本地执行 `npm run build` 确保可通过构建。

---

## 许可证与声明

本项目以 **MIT License** 授权，详见根目录 [`LICENSE`](LICENSE)。  
第三方 API（通义、MyMemory、Jina 相关服务、MCP Server 等）的使用须遵守各自服务条款与配额限制。  

---

**Madoka** — 把搜索、阅读、对话和记忆留在同一侧栏。
