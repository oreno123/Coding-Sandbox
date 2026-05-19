/**
 * useChat Hook
 * Handles chat logic with smart search, auto page reading, and GitHub repo search
 */

import { useCallback } from "react";
import { useChatContext } from "../context/ChatContext";
import { getActiveTab, sendGitHubSearch, sendToBackground } from "../../shared/messaging";
import { MessageItem, ResourceInfo } from "../../shared/types";
import {
  getAllToolsFromServers,
  setMCPToolToServerForSession,
} from "../lib/mcpClient";
import { CONDENSE_MAX_HISTORY_TURNS } from "../../shared/constants";

const GITHUB_CMD_PREFIX = /^\/(github|find|找项目)\s+/i;
const MAX_HISTORY_MESSAGES = CONDENSE_MAX_HISTORY_TURNS * 2;

/** 获取 MCP 工具并设置会话映射，返回 tools / prompt / toolToServer 供 Background 使用 */
async function fetchMCPToolsForChat(): Promise<{
  mcpTools: Array<{ type: "function"; function: Record<string, unknown> }>;
  mcpToolsPrompt: string;
  mcpToolToServer: Record<string, string>;
} | null> {
  try {
    const res = await sendToBackground<{
      success: boolean;
      servers?: Array<{ id: string; name: string; url: string; enabled: boolean; authType?: string }>;
      tokens?: Record<string, string>;
    }>({ action: "mcpGetConfig" });
    if (!res.success || !res.servers?.length) return null;
    const { tools, toolsPrompt, toolToServer } = await getAllToolsFromServers(
      res.servers as Parameters<typeof getAllToolsFromServers>[0],
      res.tokens || {}
    );
    if (!tools.length) return null;
    setMCPToolToServerForSession(toolToServer);
    return {
      mcpTools: tools,
      mcpToolsPrompt: toolsPrompt,
      mcpToolToServer: Object.fromEntries(toolToServer),
    };
  } catch {
    return null;
  }
}

export function useChat() {
  const {
    state,
    addMessage,
    startResponse,
    finishResponse,
    dispatch,
    mode,
    pageContent,
    activeConversation,
  } = useChatContext();
  const selectedBlocks = activeConversation?.selectedBlocks || [];

  const sendMessage = useCallback(
    async (content: string, images?: string[]) => {
      if ((!content.trim() && !images?.length) || state.isResponding) return;

      const trimmed = content.trim();
      const githubMatch = trimmed.match(GITHUB_CMD_PREFIX);
      // 通过 state.forceGitHubSearch 或命令前缀判断是否执行 GitHub 搜索
      const isGitHubSearch = state.forceGitHubSearch || !!githubMatch;
      const userQuery = isGitHubSearch
        ? (githubMatch ? trimmed.replace(GITHUB_CMD_PREFIX, "").trim() : trimmed)
        : "";

      // GitHub 找项目：仅调用 handleGitHubSearch，不产生对话流式回复（不支持截图）
      if (isGitHubSearch) {
        // 显示纯净内容（不含前缀）
        const displayContent = githubMatch 
          ? trimmed.replace(GITHUB_CMD_PREFIX, "").trim()
          : trimmed;
        addMessage({ role: "user", content: displayContent, images });
        dispatch({ type: "SET_STATUS", payload: "responding" });
        startResponse();
        if (!userQuery) {
          finishResponse("请输入要搜索的项目描述，例如：Python 异步 Web 框架");
          return;
        }
        try {
          const res = await sendGitHubSearch(userQuery);
          if (res.success && res.items?.length) {
            finishResponse(`找到以下项目（搜索串: ${res.query}）：`, res.items);
          } else {
            finishResponse(
              res.error ? `搜索失败: ${res.error}` : "未找到相关项目",
            );
          }
        } catch (e) {
          finishResponse(`请求失败：${(e as Error).message}`);
        }
        // 搜索完成后重置标志
        dispatch({ type: "SET_FORCE_GITHUB_SEARCH", payload: false });
        return;
      }

      const forceSearch = state.forceSearch;

      addMessage({ role: "user", content, images });
      dispatch({ type: "SET_STATUS", payload: "responding" });
      startResponse();

      const tab = await getActiveTab();
      const rawHistory =
        state.conversations
          .find((c) => c.id === state.activeConversationId)
          ?.messages.filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.role === "user" && m.images?.length ? { images: m.images } : {}),
          })) || [];
      const history =
        MAX_HISTORY_MESSAGES > 0
          ? rawHistory.slice(-MAX_HISTORY_MESSAGES)
          : rawHistory;

      const useSmartChat = mode === "chat";
      const mcpToolsPayload = await fetchMCPToolsForChat();

      chrome.runtime.sendMessage({
        action: useSmartChat ? "smartChat" : "chat",
        message: content,
        images,
        history,
        forceSearch,
        engine: state.currentEngine,
        pageContent: pageContent?.markdown,
        tabId: tab?.id,
        autoReadPage: useSmartChat && !pageContent,
        selectedBlocks,
        ...(mcpToolsPayload && {
          mcpTools: mcpToolsPayload.mcpTools,
          mcpToolsPrompt: mcpToolsPayload.mcpToolsPrompt,
          mcpToolToServer: mcpToolsPayload.mcpToolToServer,
        }),
      });

      if (forceSearch) {
        dispatch({ type: "SET_FORCE_SEARCH", payload: false });
      }

      if (pageContent) {
        dispatch({ type: "SET_PAGE_CONTENT", payload: null });
      }
    },
    [
      state,
      addMessage,
      startResponse,
      finishResponse,
      dispatch,
      mode,
      pageContent,
    ],
  );

  const sendMessages = useCallback(
    async (messages: MessageItem[], images?: string[], resourceInfos?: ResourceInfo[]) => {
      if ((!messages.length && !images?.length) || state.isResponding) return;

      // 提取用户输入消息（mime_type: "text/plain"）
      const userMessage = messages.find(m => m.mime_type === "text/plain");
      const userContent = userMessage?.content || "";

      // ===== GitHub 搜索处理 =====
      if (state.forceGitHubSearch) {
        const trimmed = userContent.trim();
        const githubMatch = trimmed.match(GITHUB_CMD_PREFIX);
        const isGitHubSearch = state.forceGitHubSearch || !!githubMatch;

        if (isGitHubSearch) {
          const userQuery = githubMatch
            ? trimmed.replace(GITHUB_CMD_PREFIX, "").trim()
            : trimmed;

          // 显示纯净内容（不含前缀）
          const displayContent = githubMatch
            ? trimmed.replace(GITHUB_CMD_PREFIX, "").trim()
            : trimmed;

          addMessage({ role: "user", content: displayContent, images });
          dispatch({ type: "SET_STATUS", payload: "responding" });
          startResponse();

          if (!userQuery) {
            finishResponse("请输入要搜索的项目描述，例如：Python 异步 Web 框架");
            dispatch({ type: "SET_FORCE_GITHUB_SEARCH", payload: false });
            return;
          }

          try {
            const res = await sendGitHubSearch(userQuery);
            if (res.success && res.items?.length) {
              finishResponse(`找到以下项目（搜索串: ${res.query}）：`, res.items);
            } else {
              finishResponse(
                res.error ? `搜索失败: ${res.error}` : "未找到相关项目",
              );
            }
          } catch (e) {
            finishResponse(`请求失败：${(e as Error).message}`);
          }

          // 搜索完成后重置标志
          dispatch({ type: "SET_FORCE_GITHUB_SEARCH", payload: false });
          return; // 提前返回，不走普通聊天流程
        }
      }
      // ===== GitHub 搜索处理结束 =====

      const forceSearch = state.forceSearch;

      // 添加用户消息到对话历史（含 resource_infos 用于展示与多轮对话）
      addMessage({ role: "user", content: userContent, images, resource_infos: resourceInfos });

      dispatch({ type: "SET_STATUS", payload: "responding" });
      startResponse();

      const tab = await getActiveTab();
      const rawHistory =
        state.conversations
          .find((c) => c.id === state.activeConversationId)
          ?.messages.filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.role === "user" && m.images?.length ? { images: m.images } : {}),
            ...(m.role === "user" && m.resource_infos?.length ? { resource_infos: m.resource_infos } : {}),
          })) || [];
      const history =
        MAX_HISTORY_MESSAGES > 0
          ? rawHistory.slice(-MAX_HISTORY_MESSAGES)
          : rawHistory;

      const useSmartChat = mode === "chat";
      const mcpToolsPayload = await fetchMCPToolsForChat();

      chrome.runtime.sendMessage({
        action: "sendMessages",
        messages,
        images,
        history,
        forceSearch,
        engine: state.currentEngine,
        pageContent: pageContent?.markdown,
        tabId: tab?.id,
        autoReadPage: useSmartChat && !pageContent,
        selectedBlocks,
        ...(mcpToolsPayload && {
          mcpTools: mcpToolsPayload.mcpTools,
          mcpToolsPrompt: mcpToolsPayload.mcpToolsPrompt,
          mcpToolToServer: mcpToolsPayload.mcpToolToServer,
        }),
      });

      if (forceSearch) {
        dispatch({ type: "SET_FORCE_SEARCH", payload: false });
      }

      if (pageContent) {
        dispatch({ type: "SET_PAGE_CONTENT", payload: null });
      }
    },
    [
      state,
      addMessage,
      startResponse,
      finishResponse,
      dispatch,
      mode,
      pageContent,
    ],
  );

  return {
    sendMessage,
    sendMessages,
    isResponding: state.isResponding,
    status: state.status,
    searchStatus: state.searchStatus,
  };
}
