/**
 * MCP Client - 连接远程 MCP Server，获取 tools 并执行 call
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { MCPServerConfig, OpenAITool } from '../shared/types'

const CONNECT_TIMEOUT_MS = 10000

function normalizeMcpUrl(url: string): string {
  return url.trim()
}

function isValidUrl(url: string): boolean {
  if (!url || !url.trim()) return false
  if (url.startsWith('https://')) return true
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) return true
  // 允许内网及自建服务器 HTTP
  if (url.startsWith('http://192.168.') || url.startsWith('http://10.')) return true
  if (url.startsWith('http://172.16.') || url.startsWith('http://172.17.') || url.startsWith('http://172.18.') || url.startsWith('http://172.19.') || url.startsWith('http://172.2') || url.startsWith('http://172.30.') || url.startsWith('http://172.31.')) return true
  if (url.startsWith('http://47.100.102.51')) return true
  return false
}

/**
 * 连接远程 MCP Server
 */
export async function connectMCPServer(
  config: MCPServerConfig,
  token?: string
): Promise<Client> {
  const urlStr = normalizeMcpUrl(config.url)
  if (!isValidUrl(urlStr)) {
    throw new Error('MCP URL 必须为 https://，或 http://localhost/内网/自建服务器')
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
 * 从已连接的 client 获取 tools 列表
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
 * 将 MCP tools 转为 OpenAI/通义千问兼容格式
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
  /** serverId -> client，供后续 callTool 使用 */
  clients: Map<string, Client>
  /** tool name -> serverId */
  toolToServer: Map<string, string>
}

/**
 * 从配置的 servers 聚合所有 tools
 */
export async function getAllToolsFromConfig(
  servers: MCPServerConfig[],
  tokens: Record<string, string>
): Promise<MCPToolsResult> {
  const allTools: OpenAITool[] = []
  const clients = new Map<string, Client>()
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
