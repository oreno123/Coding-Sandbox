/**
 * 配置管理模块
 */

import type { AppConfig, MCPServerConfig } from '../shared/types'
import { DEFAULT_CONFIG } from '../shared/types'

const MCP_SERVERS_KEY = 'mcpServers'
const MCP_TOKENS_KEY = 'mcpTokens'

/**
 * 获取配置
 */
export async function getConfig(): Promise<AppConfig> {
  try {
    const result = await chrome.storage.local.get(['madokaConfig'])
    return { ...DEFAULT_CONFIG, ...result.madokaConfig }
  } catch (e) {
    console.error('[Madoka BG] 获取配置失败:', e)
    return DEFAULT_CONFIG
  }
}

/**
 * 保存配置
 */
export async function saveConfig(config: Partial<AppConfig>): Promise<boolean> {
  try {
    const current = await getConfig()
    const merged = { ...current, ...config }
    await chrome.storage.local.set({ madokaConfig: merged })
    return true
  } catch (e) {
    console.error('[Madoka BG] 保存配置失败:', e)
    return false
  }
}

/**
 * 获取 MCP 配置（servers + tokens 脱敏）
 */
export async function getMCPConfig(): Promise<{
  servers: MCPServerConfig[]
  tokens: Record<string, string>
  hasTokens: Record<string, boolean>
}> {
  try {
    const result = await chrome.storage.local.get([MCP_SERVERS_KEY, MCP_TOKENS_KEY])
    const servers = (result[MCP_SERVERS_KEY] as MCPServerConfig[]) || []
    const tokens = (result[MCP_TOKENS_KEY] as Record<string, string>) || {}
    const hasTokens: Record<string, boolean> = {}
    for (const s of servers) {
      hasTokens[s.id] = !!(tokens[s.id] && tokens[s.id].trim())
    }
    return { servers, tokens, hasTokens }
  } catch (e) {
    console.error('[Madoka BG] 获取 MCP 配置失败:', e)
    return { servers: [], tokens: {}, hasTokens: {} }
  }
}

/**
 * 保存 MCP 配置
 * tokens 为 Partial：仅更新提供的 key，空字符串表示清除
 */
export async function saveMCPConfig(
  servers: MCPServerConfig[],
  tokens?: Partial<Record<string, string>>
): Promise<boolean> {
  try {
    await chrome.storage.local.set({ [MCP_SERVERS_KEY]: servers })
    if (tokens !== undefined) {
      const current = await chrome.storage.local.get([MCP_TOKENS_KEY])
      const existing = (current[MCP_TOKENS_KEY] as Record<string, string>) || {}
      const merged: Record<string, string> = { ...existing }
      for (const [id, value] of Object.entries(tokens)) {
        if (value && value.trim()) {
          merged[id] = value.trim()
        } else {
          delete merged[id]
        }
      }
      await chrome.storage.local.set({ [MCP_TOKENS_KEY]: merged })
    }
    return true
  } catch (e) {
    console.error('[Madoka BG] 保存 MCP 配置失败:', e)
    return false
  }
}
