/**
 * MCP Settings - 远程 MCP Server 配置
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { sendToBackground } from "../../shared/messaging";
import { testMCPServerConnection, type MCPToolInfo } from "../lib/mcpClient";
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
    tools?: MCPToolInfo[];
    error?: string;
  } | null>(null);
  /** 当前展开查看 tools 的 server id */
  const [toolsViewingId, setToolsViewingId] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await sendToBackground<{
        success: boolean;
        servers: MCPServerConfig[];
        tokens?: Record<string, string>;
        hasTokens?: Record<string, boolean>;
      }>({ action: "mcpGetConfig" });
      if (res.success && res.servers) {
        setServers(res.servers);
        setHasTokens(res.hasTokens || {});
        setTokens(res.tokens || {});
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
    setToolsViewingId(null);
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
        tools: res.tools,
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

          <div className="flex flex-col gap-1">
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
            {testResult?.id === server.id &&
              testResult.success &&
              (testResult.toolsCount ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setToolsViewingId((prev) =>
                      prev === server.id ? null : server.id
                    )
                  }
                  className="text-left text-xs text-[var(--accent-primary)] hover:underline"
                >
                  {toolsViewingId === server.id ? "收起工具列表" : "查看可用工具"}
                </button>
              )}
          </div>

          {toolsViewingId === server.id &&
            testResult?.id === server.id &&
            testResult.tools &&
            testResult.tools.length > 0 && (
              <div className="mt-2 p-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)] max-h-48 overflow-y-auto">
                <div className="text-xs font-medium text-[var(--text-muted)] mb-2">
                  可用工具 ({testResult.tools.length})
                </div>
                <ul className="space-y-2 text-xs">
                  {testResult.tools.map((t) => (
                    <li
                      key={t.name}
                      className="text-[var(--text-primary)] border-b border-[var(--border-primary)] pb-2 last:border-0 last:pb-0"
                    >
                      <span className="font-medium">{t.name}</span>
                      {t.description && (
                        <div className="text-[var(--text-muted)] mt-0.5">
                          {t.description}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
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
