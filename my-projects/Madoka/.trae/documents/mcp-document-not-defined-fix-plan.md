# Madoka MCP 远程URL测试报错修复计划

## 问题描述

测试Madoka的MCP功能时使用远程URL，出现 `document is not defined` 报错。

## 问题分析

### 根本原因

1. **问题位置**: `@modelcontextprotocol/sdk` 包使用了 `eventsource-parser` 库
2. **具体代码**: `eventsource-parser/dist/stream.js` 中使用了 `TransformStream` 类
3. **Chrome扩展环境**: 
   - `TransformStream` 是 Web Streams API 的一部分
   - 在 Chrome Extension 的 Service Worker (background script) 环境中，**默认没有 `TransformStream`**
   - `TransformStream` 通常在浏览器主线程（有 DOM 的环境）中可用，但 Service Worker 是独立的 JavaScript 执行环境

### 代码链路

```
src/background/mcpClient.ts
  ↓ 导入
@modelcontextprotocol/sdk/client/streamableHttp.js
  ↓ 使用
EventSourceParserStream (from eventsource-parser/stream)
  ↓ 继承
TransformStream ← 在 Service Worker 中未定义！
```

### 错误触发场景

当用户在 MCPSettings 组件中点击"测试连接"按钮时：
1. `MCPSettings.tsx` 调用 `sendToBackground({ action: "mcpTestConnection", ... })`
2. `background/index.ts` 处理消息，动态导入 `mcpClient.ts`
3. `mcpClient.ts` 导入 `@modelcontextprotocol/sdk/client/streamableHttp.js`
4. SDK 内部使用 `EventSourceParserStream`，其继承自 `TransformStream`
5. Service Worker 环境中没有 `TransformStream` → 抛出 `document is not defined` 或 `TransformStream is not defined`

---

## 什么是 Offscreen API？

### 概念说明

**Offscreen API** 是 Chrome Extension Manifest V3 提供的一个 API，允许扩展创建一个**离屏文档（Offscreen Document）**。

### 核心特点

| 特性 | 说明 |
|------|------|
| **DOM 环境** | Offscreen 页面拥有完整的 DOM 环境，可以访问 `document`、`window` 等对象 |
| **独立页面** | 它是一个隐藏的 HTML 页面，用户看不到，但代码在其中运行 |
| **与 Service Worker 通信** | 通过 `chrome.runtime.sendMessage` 与 Background Service Worker 通信 |
| **生命周期管理** | 需要显式创建和关闭，不会自动销毁 |
| **权限要求** | 需要在 manifest.json 中声明 `offscreen` 权限 |

### 为什么能解决当前问题？

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome Extension 架构                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────────────┐│
│  │  Service Worker      │      │  Offscreen Document          ││
│  │  (Background)        │      │  (隐藏的 HTML 页面)           ││
│  │                      │      │                              ││
│  │  ❌ 无 DOM 环境       │◄────►│  ✅ 有完整 DOM 环境           ││
│  │  ❌ 无 document       │ 消息  │  ✅ 有 document              ││
│  │  ❌ 无 TransformStream│ 通信  │  ✅ 有 TransformStream       ││
│  │                      │      │  ✅ 可以运行 MCP SDK         ││
│  └──────────────────────┘      └──────────────────────────────┘│
│           ▲                              ▲                     │
│           │                              │                     │
│           └──────────────┬───────────────┘                     │
│                          │                                     │
│                   chrome.runtime.sendMessage                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 类比理解

可以把 Offscreen Document 想象成：
- 一个**隐藏的标签页**，用户看不到它
- 但它拥有和普通网页一样的能力（DOM、Web Streams API 等）
- Background Service Worker 通过"发消息"让它帮忙做事情
- 做完后，Offscreen 再通过"发消息"把结果返回给 Background

---

## 修复方案（采用 Offscreen API 方案）

### 方案概述

使用 Chrome Extension 的 **Offscreen API** 创建一个离屏页面，该页面拥有完整的 DOM 环境，可以正常使用 Web Streams API。所有 MCP 相关逻辑都在 Offscreen 页面中执行，Background Service Worker 通过消息传递与 Offscreen 页面通信。

### 为什么选择 Offscreen API？

| 特性 | Polyfill 方案 | Offscreen API 方案 |
|------|--------------|-------------------|
| 代码复杂度 | 低 | 中等 |
| 额外依赖 | 需要 `web-streams-polyfill` | **无额外依赖** |
| 浏览器支持 | 依赖 polyfill 兼容性 | Chrome 109+ 原生支持 |
| 架构清晰度 | 直接在 SW 中执行 | **职责分离，MCP 逻辑独立** |
| 可维护性 | 一般 | **好** |
| 性能 | 在 SW 中执行 | 额外进程通信开销（可接受） |

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Madoka Extension                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐      sendMessage       ┌──────────────────┐  │
│  │   SidePanel  │ ──────────────────────>│  Background SW   │  │
│  │  (MCPSettings)│                       │                  │  │
│  └──────────────┘                        │  • 消息路由       │  │
│       │                                  │  • 管理offscreen  │  │
│       │                                  │    生命周期       │  │
│       │                                  └────────┬─────────┘  │
│       │                                           │            │
│       │                                           │ sendMessage │
│       │                                           ▼            │
│       │                                  ┌──────────────────┐  │
│       │                                  │  Offscreen Page  │  │
│       └─────────────────────────────────>│                  │  │
│         (监听响应)                        │  • MCP Client    │  │
│                                          │  • SDK 初始化     │  │
│                                          │  • 工具调用       │  │
│                                          └──────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 实施计划

### 步骤1: 更新 manifest.json

添加 `offscreen` 权限和 offscreen 页面配置。

**修改内容：**

```json
{
  "manifest_version": 3,
  "name": "Madoka - 智能搜索助手",
  "description": "联网搜索增强 LLM 对话插件，基于 Jina Reader 技术",
  "version": "2.0.0",
  "icons": {
    "16": "public/icons/icon16.png",
    "48": "public/icons/icon48.png",
    "128": "public/icons/icon128.png"
  },
  "permissions": [
    "storage",
    "scripting",
    "sidePanel",
    "tabs",
    "bookmarks",
    "history",
    "contextMenus",
    "notifications",
    "offscreen"
  ],
  "host_permissions": [
    "https://www.google.com/*",
    "https://www.google.com.hk/*",
    "https://www.bing.com/*",
    "https://cn.bing.com/*",
    "https://dashscope.aliyuncs.com/*",
    "<all_urls>"
  ],
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.ts"],
      "run_at": "document_end"
    }
  ],
  "action": {
    "default_icon": {
      "16": "public/icons/icon16.png",
      "48": "public/icons/icon48.png"
    },
    "default_title": "打开 Madoka 助手"
  },
  "web_accessible_resources": [
    {
      "resources": [
        "public/icons/*",
        "public/pdfjs/*",
        "public/pdfjs/web/*",
        "public/pdfjs/web/*/*",
        "public/pdfjs/build/*",
        "node_modules/pdfjs-dist/build/*",
        "node_modules/pdfjs-dist/web/*",
        "node_modules/pdfjs-dist/cmaps/*",
        "src/offscreen/offscreen.html"
      ],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 步骤2: 创建 Offscreen 页面

**文件结构：**
```
src/
├── offscreen/
│   ├── offscreen.html    # Offscreen 页面 HTML
│   └── offscreen.ts      # Offscreen 页面脚本（MCP 逻辑）
```

**src/offscreen/offscreen.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Madoka MCP Offscreen</title>
</head>
<body>
  <script type="module" src="./offscreen.ts"></script>
</body>
</html>
```

**src/offscreen/offscreen.ts:**
```typescript
/**
 * Offscreen Page - 在 DOM 环境中执行 MCP 相关逻辑
 * 拥有完整的 Web Streams API 支持
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { MCPServerConfig, OpenAITool } from '../shared/types'

const CONNECT_TIMEOUT_MS = 10000

// 存储已连接的客户端
const clients = new Map<string, Client>()

function ensureMcpUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (!trimmed.endsWith('/mcp') && !trimmed.endsWith('/mcp/')) {
    return trimmed.replace(/\/?$/, '/mcp')
  }
  return trimmed
}

function isValidUrl(url: string): boolean {
  if (!url || !url.trim()) return false
  return url.startsWith('https://') || url.startsWith('http://localhost')
}

/**
 * 连接 MCP Server
 */
async function connectMCPServer(
  config: MCPServerConfig,
  token?: string
): Promise<Client> {
  const urlStr = ensureMcpUrl(config.url)
  if (!isValidUrl(urlStr)) {
    throw new Error('MCP URL 必须为 https:// 或 http://localhost')
  }

  const requestInit: RequestInit = {}
  if (config.authType === 'bearer' && token?.trim()) {
    requestInit.headers = {
      Authorization: `Bearer ${token.trim()}`,
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS)

  const customFetch: typeof fetch = (input, init) => {
    return fetch(input, {
      ...init,
      signal: controller.signal,
    })
  }

  try {
    const transport = new StreamableHTTPClientTransport(new URL(urlStr), {
      requestInit,
      fetch: customFetch,
    })
    const client = new Client({
      name: 'madoka-mcp-client',
      version: '1.0.0',
    })
    await client.connect(transport)
    return client
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 获取 tools 列表
 */
async function listToolsFromServer(client: Client): Promise<
  Array<{
    name: string
    description?: string
    inputSchema?: { type: string; properties?: Record<string, unknown>; required?: string[] }
  }>
> {
  const result = await client.listTools()
  return (result.tools || []).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema as { type: string; properties?: Record<string, unknown>; required?: string[] } | undefined,
  }))
}

/**
 * 调用 MCP 工具
 */
async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const result = await client.callTool({ name, arguments: args })
  const content = result.content
  if (!Array.isArray(content)) return JSON.stringify(result)
  const textParts = content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
  return textParts.join('\n') || JSON.stringify(result)
}

/**
 * 将 MCP tools 转为 OpenAI 兼容格式
 */
function mcpToolsToOpenAIFormat(
  tools: Array<{
    name: string
    description?: string
    inputSchema?: { type: string; properties?: Record<string, unknown>; required?: string[] }
  }>
): OpenAITool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description || `Tool: ${t.name}`,
      parameters: {
        type: 'object' as const,
        properties: (t.inputSchema?.properties as Record<string, { type: string; description?: string }>) || {},
        required: t.inputSchema?.required || [],
      },
    },
  }))
}

/**
 * 处理来自 Background 的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 测试连接
  if (request.action === 'offscreenMcpTestConnection') {
    handleTestConnection(request.server, request.token)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }

  // 获取所有 tools
  if (request.action === 'offscreenMcpGetTools') {
    handleGetTools(request.servers, request.tokens)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }

  // 调用 tool
  if (request.action === 'offscreenMcpCallTool') {
    handleCallTool(request.serverId, request.toolName, request.args)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }

  // 关闭所有连接
  if (request.action === 'offscreenMcpCloseAll') {
    handleCloseAll()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }

  return false
})

/**
 * 处理测试连接
 */
async function handleTestConnection(
  server: MCPServerConfig,
  token?: string
): Promise<{ success: boolean; toolsCount?: number; error?: string }> {
  try {
    const client = await connectMCPServer(server, token)
    const tools = await listToolsFromServer(client)
    
    // 存储客户端供后续使用
    clients.set(server.id, client)
    
    return { success: true, toolsCount: tools.length }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * 处理获取 tools
 */
async function handleGetTools(
  servers: MCPServerConfig[],
  tokens: Record<string, string>
): Promise<{
  success: boolean
  tools?: OpenAITool[]
  toolsPrompt?: string
  toolToServer?: Array<[string, string]>
  error?: string
}> {
  try {
    const allTools: OpenAITool[] = []
    const toolToServer = new Map<string, string>()
    const enabled = servers.filter((s) => s.enabled && s.url?.trim())

    // 关闭旧的连接
    for (const [id, client] of clients) {
      try {
        await client.close()
      } catch {}
    }
    clients.clear()

    for (const server of enabled) {
      try {
        const token = server.authType === 'bearer' ? tokens[server.id] : undefined
        const client = await connectMCPServer(server, token)
        const mcpTools = await listToolsFromServer(client)
        const openaiTools = mcpToolsToOpenAIFormat(mcpTools)

        clients.set(server.id, client)
        for (const t of mcpTools) {
          toolToServer.set(t.name, server.id)
        }
        allTools.push(...openaiTools)
      } catch (e) {
        console.warn(`[Madoka MCP Offscreen] 连接 ${server.name} 失败:`, (e as Error).message)
      }
    }

    const toolsPrompt = allTools
      .map(
        (t) =>
          `- ${t.function.name}: ${t.function.description} (params: ${JSON.stringify(t.function.parameters)})`
      )
      .join('\n')

    return {
      success: true,
      tools: allTools,
      toolsPrompt: toolsPrompt || '',
      toolToServer: Array.from(toolToServer.entries()),
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * 处理调用 tool
 */
async function handleCallTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const client = clients.get(serverId)
  if (!client) {
    throw new Error(`未找到 server ${serverId} 的连接`)
  }
  return callTool(client, toolName, args)
}

/**
 * 处理关闭所有连接
 */
async function handleCloseAll(): Promise<void> {
  for (const [id, client] of clients) {
    try {
      await client.close()
    } catch {}
  }
  clients.clear()
}

console.log('[Madoka Offscreen] MCP offscreen page loaded')
```

### 步骤3: 创建 Offscreen 管理模块

**src/background/offscreenManager.ts:**
```typescript
/**
 * Offscreen Manager - 管理 Offscreen 页面的生命周期
 */

let offscreenDocumentPath: string | null = null

/**
 * 检查 offscreen 页面是否已存在
 */
async function hasOffscreenDocument(): Promise<boolean> {
  // @ts-ignore - Chrome 109+ API
  if (!chrome.offscreen) {
    throw new Error('当前浏览器版本不支持 Offscreen API，请升级 Chrome 到 109+')
  }
  
  // @ts-ignore
  const existingContexts = await chrome.offscreen.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('src/offscreen/offscreen.html')]
  })
  
  return existingContexts.length > 0
}

/**
 * 创建 offscreen 页面
 */
async function createOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    return
  }

  // @ts-ignore
  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: ['WORKERS'],
    justification: '需要 DOM 环境来运行 MCP SDK，使用 Web Streams API',
  })
  
  console.log('[Madoka Offscreen] Document created')
}

/**
 * 关闭 offscreen 页面
 */
async function closeOffscreenDocument(): Promise<void> {
  // @ts-ignore
  await chrome.offscreen.closeDocument()
  console.log('[Madoka Offscreen] Document closed')
}

/**
 * 确保 offscreen 页面存在
 */
export async function ensureOffscreen(): Promise<void> {
  await createOffscreenDocument()
}

/**
 * 发送消息到 offscreen 页面
 */
export async function sendToOffscreen<T>(message: Record<string, unknown>): Promise<T> {
  await ensureOffscreen()
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Offscreen 通信超时'))
    }, 30000)
    
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timeout)
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(response as T)
      }
    })
  })
}

/**
 * 关闭所有 MCP 连接并清理 offscreen
 */
export async function cleanupOffscreen(): Promise<void> {
  try {
    await sendToOffscreen({ action: 'offscreenMcpCloseAll' })
  } catch {}
  
  if (await hasOffscreenDocument()) {
    await closeOffscreenDocument()
  }
}
```

### 步骤4: 修改 Background 中的 MCP 处理逻辑

**修改 src/background/index.ts:**

将原有的 `mcpTestConnection` 处理逻辑改为通过 offscreen 页面执行：

```typescript
// 在文件顶部添加导入
import { sendToOffscreen, cleanupOffscreen } from './offscreenManager'

// 修改 mcpTestConnection 处理
if (request.action === "mcpTestConnection") {
  (async () => {
    try {
      const { getMCPConfig } = await import("./config");
      const server = request.server as {
        id: string;
        name: string;
        url: string;
        authType: string;
        enabled: boolean;
      };
      let token = request.token as string | undefined;
      if (!token?.trim() && server.authType === "bearer") {
        const { tokens } = await getMCPConfig();
        token = tokens[server.id];
      }
      
      // 通过 offscreen 执行连接测试
      const res = await sendToOffscreen<{
        success: boolean;
        toolsCount?: number;
        error?: string;
      }>({
        action: 'offscreenMcpTestConnection',
        server: { ...server, authType: server.authType as "none" | "bearer" },
        token,
      });
      
      sendResponse(res);
    } catch (e) {
      sendResponse({
        success: false,
        error: (e as Error).message,
      });
    }
  })();
  return true;
}
```

**修改 src/background/mcpClient.ts:**

将原有的直接执行逻辑改为通过 offscreen 页面：

```typescript
/**
 * MCP Client - 通过 Offscreen 页面连接远程 MCP Server
 */

import { sendToOffscreen } from './offscreenManager'
import type { MCPServerConfig, OpenAITool } from '../shared/types'

export interface MCPToolsResult {
  tools: OpenAITool[]
  toolsPrompt: string
  toolToServer: Map<string, string>
}

/**
 * 从配置的 servers 聚合所有 tools（通过 offscreen 页面）
 */
export async function getAllToolsFromConfig(
  servers: MCPServerConfig[],
  tokens: Record<string, string>
): Promise<MCPToolsResult> {
  const res = await sendToOffscreen<{
    success: boolean
    tools?: OpenAITool[]
    toolsPrompt?: string
    toolToServer?: Array<[string, string]>
    error?: string
  }>({
    action: 'offscreenMcpGetTools',
    servers,
    tokens,
  });

  if (!res.success) {
    throw new Error(res.error || '获取 MCP tools 失败')
  }

  return {
    tools: res.tools || [],
    toolsPrompt: res.toolsPrompt || '',
    toolToServer: new Map(res.toolToServer || []),
  }
}

/**
 * 调用 MCP 工具（通过 offscreen 页面）
 */
export async function callTool(
  serverId: string,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const res = await sendToOffscreen<{
    success: boolean
    result?: string
    error?: string
  }>({
    action: 'offscreenMcpCallTool',
    serverId,
    toolName: name,
    args,
  });

  if (!res.success) {
    throw new Error(res.error || '调用 MCP tool 失败')
  }

  return res.result || ''
}
```

### 步骤5: 更新 vite.config.ts

确保 offscreen 页面被正确打包：

```typescript
/// <reference types="node" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.json'
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'

// 递归复制目录的辅助函数
function copyDirSync(src: string, dest: string) {
  if (!existsSync(src)) return
  
  mkdirSync(dest, { recursive: true })
  const entries = readdirSync(src)
  
  for (const entry of entries) {
    const srcPath = join(src, entry)
    const destPath = join(dest, entry)
    const stat = statSync(srcPath)
    
    if (stat.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    {
      name: 'copy-viewer-config',
      closeBundle() {
        // 确保 viewer-config.js 被复制到 dist
        const src = resolve(__dirname, 'public/pdfjs/web/viewer-config.js')
        const dest = resolve(__dirname, 'dist/public/pdfjs/web/viewer-config.js')
        try {
          mkdirSync(resolve(__dirname, 'dist/public/pdfjs/web'), { recursive: true })
          copyFileSync(src, dest)
          console.log('✓ viewer-config.js copied to dist')
        } catch (e) {
          console.error('Failed to copy viewer-config.js:', e)
        }

        // 复制 locale 语言目录到正确的位置
        const localeSrc = resolve(__dirname, 'dist/pdfjs/web/locale')
        const localeDest = resolve(__dirname, 'dist/public/pdfjs/web/locale')
        try {
          if (existsSync(localeSrc)) {
            copyDirSync(localeSrc, localeDest)
            console.log('✓ locale directories copied to dist/public/pdfjs/web/locale')
          }
        } catch (e) {
          console.error('Failed to copy locale directories:', e)
        }
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
        offscreen: 'src/offscreen/offscreen.html',  // 添加 offscreen 页面
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
})
```

---

## 如何验证 Offscreen 是否起作用？

### 验证方法1: 查看控制台日志

1. **打开扩展的 Service Worker 控制台**
   - 进入 `chrome://extensions/`
   - 找到 Madoka 扩展，点击"Service Worker"链接
   - 查看是否有 `[Madoka Offscreen] Document created` 日志

2. **查看 Offscreen 页面控制台**
   - 在 Service Worker 控制台中，点击右上角的下拉菜单
   - 选择 `"Madoka MCP Offscreen"` 
   - 查看是否有 `[Madoka Offscreen] MCP offscreen page loaded` 日志

### 验证方法2: 测试 MCP 连接

1. 打开 Madoka 侧边栏
2. 进入设置 → MCP 配置
3. 添加一个远程 MCP Server URL
4. 点击"测试连接"按钮
5. **预期结果**:
   - ✅ 显示"已连接，共 X 个工具" → Offscreen 工作正常
   - ❌ 仍然报错 `document is not defined` → Offscreen 未生效，需检查配置

### 验证方法3: 检查 Offscreen 页面是否存在

在 Service Worker 控制台执行：

```javascript
// 检查 offscreen 页面是否存在
chrome.offscreen.getContexts({
  contextTypes: ['OFFSCREEN_DOCUMENT']
}).then(contexts => {
  console.log('Offscreen contexts:', contexts);
  if (contexts.length > 0) {
    console.log('✅ Offscreen 页面已创建');
    console.log('URL:', contexts[0].documentUrl);
  } else {
    console.log('❌ Offscreen 页面不存在');
  }
});
```

### 验证方法4: 网络请求检查

1. 打开 Chrome DevTools 的 Network 面板
2. 在 Madoka 中测试 MCP 连接
3. 检查是否有发往 MCP Server URL 的请求
4. **预期**: 应该能看到 HTTP 请求（由 Offscreen 页面发起）

### 常见问题排查

| 问题 | 可能原因 | 解决方法 |
|------|---------|---------|
| `chrome.offscreen is undefined` | 浏览器版本过低 | 升级 Chrome 到 109+ |
| `Failed to create offscreen document` | 权限未声明 | 检查 manifest.json 是否有 `offscreen` 权限 |
| Offscreen 页面加载但 MCP 仍报错 | 消息通信失败 | 检查 action 名称是否匹配 |
| `TransformStream is not defined` | Offscreen 页面未正确加载 | 检查 vite.config.ts 是否包含 offscreen 页面 |

---

## 文件变更清单

### 修改文件
1. `src/manifest.json` - 添加 `offscreen` 权限和 web_accessible_resources
2. `src/background/index.ts` - 修改 MCP 消息处理逻辑
3. `src/background/mcpClient.ts` - 改为通过 offscreen 执行
4. `vite.config.ts` - 添加 offscreen 页面到构建配置

### 新增文件
1. `src/offscreen/offscreen.html` - Offscreen 页面 HTML
2. `src/offscreen/offscreen.ts` - Offscreen 页面脚本（MCP 逻辑）
3. `src/background/offscreenManager.ts` - Offscreen 页面管理模块

---

## 预期结果

- 修复后，MCP 远程 URL 测试功能可以正常工作
- 不再出现 `document is not defined` 或 `TransformStream is not defined` 错误
- 所有 MCP 相关逻辑都在拥有完整 DOM 环境的 Offscreen 页面中执行
- Background Service Worker 只负责消息路由和生命周期管理

---

## 备选方案

如果 Offscreen API 方案遇到问题，可以考虑：
1. **Polyfill 方案**：在 Service Worker 中注入 `web-streams-polyfill`
2. **Content Script 方案**：将 MCP 逻辑移到 Content Script 中执行
3. **Side Panel 方案**：将 MCP 逻辑移到 Side Panel 中执行（但这样无法在后台静默运行）
