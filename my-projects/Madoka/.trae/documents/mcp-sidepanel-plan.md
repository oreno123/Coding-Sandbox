# MCP 逻辑迁移到 SidePanel 计划

## 问题描述

当前使用 Offscreen API 来运行 MCP 客户端，但存在以下问题：
1. Offscreen 页面创建时机不确定
2. 需要在 Background 和 Offscreen 之间进行消息传递，增加复杂度
3. 需要额外的生命周期管理

## 解决方案

将 MCP 逻辑直接迁移到 SidePanel 中执行，因为 SidePanel 拥有完整的 DOM 环境，可以直接使用 Web Streams API。

## 架构对比

### 当前架构（Offscreen）
```
SidePanel -> Background -> Offscreen (MCP Client)
              ↑___________________|
```

### 新架构（SidePanel 直接处理）
```
SidePanel (MCP Client) -> MCP Server
```

## 实施步骤

### 步骤1: 创建 SidePanel MCP 模块

**新建文件: `src/sidepanel/lib/mcpClient.ts`**

将 `src/background/mcpClient.ts` 的内容复制并适配到 SidePanel：

```typescript
/**
 * MCP Client - 在 SidePanel 中直接运行
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { MCPServerConfig, OpenAITool } from '../../shared/types'

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
export async function connectMCPServer(
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
export async function listToolsFromServer(client: Client): Promise<
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
export async function callTool(
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
export function mcpToolsToOpenAIFormat(
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

export interface MCPToolsResult {
  tools: OpenAITool[]
  toolsPrompt: string
  clients: Map<string, Client>
  toolToServer: Map<string, string>
}

/**
 * 测试 MCP Server 连接
 */
export async function testMCPServerConnection(
  server: MCPServerConfig,
  token?: string
): Promise<{ success: boolean; toolsCount?: number; error?: string }> {
  try {
    const client = await connectMCPServer(server, token)
    const tools = await listToolsFromServer(client)
    await client.close()
    return { success: true, toolsCount: tools.length }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * 获取所有启用的 servers 的 tools
 */
export async function getAllToolsFromServers(
  servers: MCPServerConfig[],
  tokens: Record<string, string>
): Promise<MCPToolsResult> {
  // 关闭旧的连接
  for (const client of clients.values()) {
    try {
      await client.close()
    } catch {}
  }
  clients.clear()

  const allTools: OpenAITool[] = []
  const toolToServer = new Map<string, string>()
  const enabled = servers.filter((s) => s.enabled && s.url?.trim())

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
      console.warn(`[Madoka MCP] 连接 ${server.name} 失败:`, (e as Error).message)
    }
  }

  const toolsPrompt = allTools
    .map(
      (t) =>
        `- ${t.function.name}: ${t.function.description} (params: ${JSON.stringify(t.function.parameters)})`
    )
    .join('\n')

  return {
    tools: allTools,
    toolsPrompt: toolsPrompt || '',
    clients,
    toolToServer,
  }
}

/**
 * 调用指定 tool
 */
export async function callMCPTool(
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
 * 关闭所有连接
 */
export async function closeAllMCPConnections(): Promise<void> {
  for (const client of clients.values()) {
    try {
      await client.close()
    } catch {}
  }
  clients.clear()
}
```

### 步骤2: 修改 MCPSettings 组件

**修改文件: `src/sidepanel/components/MCPSettings.tsx`**

```typescript
/**
 * MCP Settings - 远程 MCP Server 配置
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { sendToBackground } from "../../shared/messaging";
import { testMCPServerConnection } from "../lib/mcpClient";
import type { MCPServerConfig } from "../../shared/types";

const MCP_PRESETS = [
  {
    id: "yuque",
    name: "语雀",
    urlPlaceholder: "https://your-yuque-mcp.example.com/mcp",
    helpUrl: "https://www.yuque.com/yuque/developer/api#personal-access-token",
  },
  {
    id: "github",
    name: "GitHub",
    urlPlaceholder: "https://your-github-mcp.example.com/mcp",
    helpUrl: "https://github.com/settings/tokens",
  },
  {
    id: "custom",
    name: "自定义",
    urlPlaceholder: "https://xxx.com/mcp",
    helpUrl: undefined,
  },
] as const;

function genId(): string {
  return `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function MCPSettings() {
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [hasTokens, setHasTokens] = useState<Record<string, boolean>>({});
  /** 用户是否编辑过该 server 的 token（用于保存时决定是否覆盖） */
  const [tokenTouched, setTokenTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    toolsCount?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await sendToBackground<{
        success: boolean;
        servers: MCPServerConfig[];
        hasTokens?: Record<string, boolean>;
      }>({ action: "mcpGetConfig" });
      if (res.success && res.servers) {
        setServers(res.servers);
        setHasTokens(res.hasTokens || {});
      }
    } catch (e) {
      console.error("[MCP Settings] 加载失败:", e);
    } finally {
      setLoading(false);
    }
  }

  function addServer(presetId: (typeof MCP_PRESETS)[number]["id"]) {
    const preset = MCP_PRESETS.find((p) => p.id === presetId);
    const newServer: MCPServerConfig = {
      id: genId(),
      name: preset?.name || "自定义",
      url: "",
      authType: presetId === "custom" ? "none" : "bearer",
      enabled: true,
    };
    setServers((prev) => [...prev, newServer]);
  }

  function updateServer(id: string, updates: Partial<MCPServerConfig>) {
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }

  function updateToken(id: string, value: string) {
    setTokenTouched((prev) => ({ ...prev, [id]: true }));
    setTokens((prev) => ({ ...prev, [id]: value }));
  }

  function removeServer(id: string) {
    setServers((prev) => prev.filter((s) => s.id !== id));
    setTokens((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTokenTouched((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function testConnection(server: MCPServerConfig) {
    setTestingId(server.id);
    setTestResult(null);
    const token =
      server.authType === "bearer"
        ? tokens[server.id]?.trim() || undefined
        : undefined;
    try {
      // 直接在 SidePanel 中测试连接
      const res = await testMCPServerConnection(server, token);
      setTestResult({
        id: server.id,
        success: res.success,
        toolsCount: res.toolsCount,
        error: res.error,
      });
    } catch (e) {
      setTestResult({
        id: server.id,
        success: false,
        error: (e as Error).message,
      });
    } finally {
      setTestingId(null);
    }
  }

  async function save() {
    try {
      const tokensToSend: Record<string, string> = {};
      for (const [id, touched] of Object.entries(tokenTouched)) {
        if (touched) {
          tokensToSend[id] = tokens[id] ?? "";
        }
      }
      await sendToBackground({
        action: "mcpSaveConfig",
        servers,
        tokens: tokensToSend,
      });
      setTokenTouched({});
      await loadConfig();
    } catch (e) {
      console.error("[MCP Settings] 保存失败:", e);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-[var(--text-muted)] mb-2">
        配置远程 MCP 服务 URL，AI 将自动获取可用工具并在对话中调用。支持语雀、GitHub 等。
      </div>

      {servers.map((server) => (
        <motion.div
          key={server.id}
          className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] space-y-3"
          layout
        >
          <div className="flex items-center justify-between">
            <input
              type="text"
              placeholder="名称"
              value={server.name}
              onChange={(e) => updateServer(server.id, { name: e.target.value })}
              className="flex-1 mr-2 px-2 py-1.5 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)]"
            />
            <button
              type="button"
              onClick={() => removeServer(server.id)}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-danger)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
              title="删除"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </button>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">URL (必填)</label>
            <input
              type="url"
              placeholder={
                MCP_PRESETS.find((p) => p.name === server.name)?.urlPlaceholder ||
                "https://xxx.com/mcp"
              }
              value={server.url}
              onChange={(e) => updateServer(server.id, { url: e.target.value })}
              className="w-full px-2 py-1.5 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-muted)]">认证</label>
            <select
              value={server.authType}
              onChange={(e) =>
                updateServer(server.id, {
                  authType: e.target.value as "none" | "bearer",
                })
              }
              className="px-2 py-1 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg"
            >
              <option value="none">无</option>
              <option value="bearer">Bearer Token</option>
            </select>
          </div>

          {server.authType === "bearer" && (
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Token</label>
              <input
                type="password"
                placeholder={hasTokens[server.id] ? "•••••••• (已配置)" : "输入 Token"}
                value={tokens[server.id] ?? ""}
                onChange={(e) => updateToken(server.id, e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg outline-none focus:border-[var(--border-focus)]"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <span>启用</span>
              <button
                type="button"
                onClick={() =>
                  updateServer(server.id, { enabled: !server.enabled })
                }
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  server.enabled
                    ? "bg-[var(--accent-primary)]"
                    : "bg-[var(--bg-tertiary)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    server.enabled ? "translate-x-4" : ""
                  }`}
                />
              </button>
            </label>
            <motion.button
              type="button"
              onClick={() => testConnection(server)}
              disabled={testingId === server.id || !server.url?.trim()}
              className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg hover:bg-[var(--bg-hover)] disabled:opacity-50"
            >
              {testingId === server.id ? "连接中..." : "测试连接"}
            </motion.button>
          </div>

          {testResult?.id === server.id && (
            <div
              className={`text-xs ${
                testResult.success
                  ? "text-[var(--accent-success)]"
                  : "text-[var(--accent-danger)]"
              }`}
            >
              {testResult.success
                ? `已连接，共 ${testResult.toolsCount ?? 0} 个工具`
                : testResult.error}
            </div>
          )}
        </motion.div>
      ))}

      <div className="flex flex-wrap gap-2">
        {MCP_PRESETS.map((p) => (
          <motion.button
            key={p.id}
            type="button"
            onClick={() => addServer(p.id)}
            className="px-3 py-1.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg hover:bg-[var(--bg-hover)]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            + {p.name}
          </motion.button>
        ))}
      </div>

      <motion.button
        type="button"
        onClick={save}
        className="w-full py-2 text-sm font-medium bg-[var(--accent-primary)] text-white rounded-lg hover:opacity-90"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        保存 MCP 配置
      </motion.button>
    </div>
  );
}
```

### 步骤3: 修改 Background 中的 MCP 处理逻辑

**修改文件: `src/background/index.ts`**

删除 `mcpTestConnection` 的处理逻辑（现在由 SidePanel 直接处理）：

```typescript
// 删除以下代码块（约 308-347 行）
if (request.action === "mcpTestConnection") {
  // ... 整个处理逻辑删除
}
```

同时修改 `smartChat` 和 `sendMessages` 中的 MCP 调用逻辑，改为从 SidePanel 获取 tools：

由于现在 MCP 客户端在 SidePanel 中运行，需要调整消息传递方式。可以考虑：
1. 在 SidePanel 加载时就获取 tools 并缓存
2. 通过消息传递将 tools 信息传给 Background

或者更简单的方式：让 SidePanel 直接处理 MCP 调用，Background 只负责传递消息。

### 步骤4: 修改 ChatContext 或相关 Hook

**修改文件: `src/sidepanel/hooks/useChat.ts` 或 `src/sidepanel/context/ChatContext.tsx`**

在 SidePanel 中直接管理 MCP tools：

```typescript
// 在 ChatContext 中添加 MCP 相关状态
const [mcpTools, setMcpTools] = useState<OpenAITool[]>([]);
const [mcpToolToServer, setMcpToolToServer] = useState<Map<string, string>>(new Map());

// 加载 MCP tools
async function loadMCPTools() {
  const { getAllToolsFromServers } = await import("../lib/mcpClient");
  const { servers, tokens } = await getMCPConfigFromBackground();
  const result = await getAllToolsFromServers(servers, tokens);
  setMcpTools(result.tools);
  setMcpToolToServer(result.toolToServer);
}

// 调用 MCP tool
async function callMCPTool(name: string, args: Record<string, unknown>) {
  const { callMCPTool } = await import("../lib/mcpClient");
  const serverId = mcpToolToServer.get(name);
  if (!serverId) throw new Error(`Tool ${name} not found`);
  return callMCPTool(serverId, name, args);
}
```

### 步骤5: 删除 Offscreen 相关文件

**删除文件:**
- `src/background/offscreen.ts`
- `src/offscreen/index.html`
- `src/offscreen/mcp.ts`

**修改文件: `src/manifest.json`**

删除 `offscreen` 权限：

```json
{
  "permissions": [
    "storage",
    "scripting",
    "sidePanel",
    "tabs",
    "bookmarks",
    "history",
    "contextMenus",
    "notifications"
    // 删除: "offscreen"
  ]
}
```

**修改文件: `vite.config.ts`**

删除 offscreen 入口：

```typescript
build: {
  rollupOptions: {
    input: {
      sidepanel: 'src/sidepanel/index.html',
      // 删除: offscreen: 'src/offscreen/index.html'
    },
  },
}
```

## 文件变更清单

### 新增文件
1. `src/sidepanel/lib/mcpClient.ts` - SidePanel MCP 客户端

### 修改文件
1. `src/sidepanel/components/MCPSettings.tsx` - 使用本地 MCP 客户端测试连接
2. `src/background/index.ts` - 删除 `mcpTestConnection` 处理
3. `src/sidepanel/context/ChatContext.tsx` 或 `src/sidepanel/hooks/useChat.ts` - 添加 MCP 管理

### 删除文件
1. `src/background/offscreen.ts`
2. `src/offscreen/index.html`
3. `src/offscreen/mcp.ts`

### 配置修改
1. `src/manifest.json` - 删除 `offscreen` 权限
2. `vite.config.ts` - 删除 offscreen 入口

## 优点

1. **简化架构** - 无需 Offscreen 页面和复杂的消息传递
2. **更好的错误处理** - 直接在 SidePanel 中捕获和处理错误
3. **更容易调试** - 可以在 SidePanel DevTools 中直接调试 MCP 逻辑
4. **更可靠** - 避免了 Offscreen 页面生命周期管理的问题

## 注意事项

1. SidePanel 关闭后 MCP 连接会断开，需要在 SidePanel 打开时重新连接
2. 如果需要在后台保持 MCP 连接，可能需要考虑其他方案（如保持 SidePanel 打开或使用 Service Worker polyfill）
