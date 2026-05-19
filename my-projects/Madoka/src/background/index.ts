/**
 * Madoka Background Service Worker
 * Handles search, content reading, API calls, and Action Space operations
 */

import type { SearchEngine, SearchContext, MessageItem, OpenAITool } from "../shared/types";
import type {
  ActionParams,
  ActionSpace,
  ActionResult,
} from "../shared/action-types";
import type { AnyContextRef } from "../shared/context-types";
import type {
  UserProfile,
  ProfileColumn,
  ProfileTag,
  AutoExportRule,
  CleanupConfig,
  ProfileTagsFromLLM,
} from "../shared/memory-types";
import * as profileV2Db from "./profileDb";
import { getCleanupConfig, saveCleanupConfig } from "./cleanupConfigDb";
import * as autoExportRulesDb from "./autoExportDb";
import { manualTriggerExport } from "./autoExport";
import { previewCleanup, confirmManualCleanup } from "./memoryCleanup";
import {
  processProfileUpdate,
  getProfileSummary,
  addManualTags,
  unlockTag,
  lockTag,
  resolveConflict,
} from "./profileWorker";
import { findOverlappingTagGroups } from "./profileConflictDetector";
import { getConfig, saveConfig } from "./config";
import { searchAndRead, searchAndReadMultiRound } from "./search";
import {
  handleChat,
  callTongyiAPI,
  callTongyiAPIWithTools,
  condenseQuestion,
  type HistoryMessage,
} from "./api";
import { DEFAULT_OPTIMIZER_SYSTEM_CONTENT } from "../shared/prompt-templates";
import {
  getAllTabs,
  searchTabs,
  searchBookmarks,
  getHistory,
  getCurrentPage,
  resolveContextContent,
  searchAllContexts,
} from "./context";
import { handleGitHubSearch } from "./githubSearch";
import {
  memoryAddEpisode,
  memoryQuery,
  memoryGetAll,
  memoryGetBlockList,
  memoryUpdate,
  memoryUpdateEpisodeSyncStatus,
  memoryDelete,
  memoryGetEpisodesByConversation,
  memoryDeleteByConversationId,
  memoryGetSettings,
  memorySaveSettings,
  memoryRunCleanup,
  memoryGetCleanupLogs,
  memoryCheckQuotaAndCleanup,
  memoryGetUserProfile,
  memorySaveUserProfile,
  memoryGetObsidianSettings,
  memorySaveObsidianSettings,
  memoryDeleteByMainBlock,
  memoryExportEpisodes,
  memoryImportEpisodes,
} from "./memoryWorker";
import {
  detectMemoryUsage,
  calculateWeightAdjustment,
} from "./memoryUsageDetector";
import { analyzeContentForMemory } from "./memoryContentAnalyzer";

/**
 * Get the current active tab
 */
async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

/**
 * 区域截图：存储侧边栏的 sendResponse，等待 content 返回裁剪结果
 */
let pendingRegionCaptureResolve: ((response: unknown) => void) | null = null;

/**
 * Send message to Content Script
 */
async function sendToContentScript<T>(
  tabId: number,
  message: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}

/**
 * 从 LLM 输出中提取提示词优化内容，去除 ```markdown 代码块包装
 * 支持流式输出中未闭合的代码块（仅去除开头前缀）
 */
function stripOptimizeOutputCodeBlock(content: string): string {
  const trimmed = content.trim();
  // 完整代码块：提取内部内容
  const fullMatch = trimmed.match(/^```(?:markdown)?\s*\n?([\s\S]*?)```\s*$/);
  if (fullMatch) {
    return fullMatch[1].trim();
  }
  // 流式输出中：去除开头的 ```markdown 或 ```
  const prefixMatch = trimmed.match(/^```(?:markdown)?\s*\n?/);
  if (prefixMatch) {
    return trimmed.slice(prefixMatch[0].length).trim();
  }
  return trimmed;
}

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Madoka BG] Received message:", request.action);

  if (request.action === "chat") {
    handleChatRequest(request, sender);
    return true;
  }

  if (request.action === "sendMessages") {
    handleSendMessagesRequest(request, sender);
    return true;
  }

  // ============ 网页划线引用 ============
  // 由 background 写入 storage，避免 content script 在某些页面无法访问 storage
  if (request.action === "setCurrentSelection") {
    const data = request.currentSelection as
      | { text: string; url: string; title: string }
      | null;
    if (data?.text?.trim()) {
      chrome.storage.session.set({ currentSelection: data });
    } else {
      chrome.storage.session.remove("currentSelection");
    }
    sendResponse({ ok: true });
    return true;
  }

  // ============ 区域截图 ============

  if (request.action === "startRegionCapture") {
    pendingRegionCaptureResolve = sendResponse;
    (async () => {
      const resolveWithError = (err: string) => {
        if (pendingRegionCaptureResolve) {
          pendingRegionCaptureResolve({ success: false, error: err });
          pendingRegionCaptureResolve = null;
        }
      };
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        if (!tab?.id) {
          resolveWithError("无法获取当前标签页");
          return;
        }
        const isPdfViewer = tab.url?.includes("/public/pdfjs/web/viewer.html");

        const trySendShowRegionSelector = async () => {
          await chrome.tabs.sendMessage(tab.id!, { action: "showRegionSelector" });
        };

        try {
          await trySendShowRegionSelector();
        } catch (e) {
          if (isPdfViewer && (e as Error).message?.includes("Receiving end does not exist")) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id! },
                files: ["public/pdfjs/web/screenshot-handler.js"],
              });
              await trySendShowRegionSelector();
            } catch (injectErr) {
              resolveWithError((injectErr as Error).message || "截图失败");
            }
          } else {
            resolveWithError((e as Error).message || "截图失败");
          }
        }
      } catch (e) {
        resolveWithError((e as Error).message || "截图失败");
      }
    })();
    return true;
  }

  if (request.action === "regionSelected") {
    const rect = request.rect as {
      left: number;
      top: number;
      width: number;
      height: number;
    };
    const tabId = sender.tab?.id;
    if (!tabId || !sender.tab?.windowId) {
      if (pendingRegionCaptureResolve) {
        pendingRegionCaptureResolve({
          success: false,
          error: "无法获取标签页信息",
        });
        pendingRegionCaptureResolve = null;
      }
      return false;
    }
    (async () => {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(
          sender.tab!.windowId!,
          { format: "png" }
        );
        await chrome.tabs.sendMessage(tabId, {
          action: "cropScreenshot",
          dataUrl,
          rect,
        });
      } catch (e) {
        if (pendingRegionCaptureResolve) {
          pendingRegionCaptureResolve({
            success: false,
            error: (e as Error).message || "截图失败",
          });
          pendingRegionCaptureResolve = null;
        }
      }
    })();
    return false;
  }

  if (request.action === "croppedScreenshot") {
    if (pendingRegionCaptureResolve) {
      pendingRegionCaptureResolve({
        success: true,
        dataUrl: request.dataUrl,
      });
      pendingRegionCaptureResolve = null;
    }
    return false;
  }

  if (
    request.action === "regionSelectorCancelled" ||
    request.action === "croppedScreenshotError"
  ) {
    if (pendingRegionCaptureResolve) {
      pendingRegionCaptureResolve({
        success: false,
        error: request.error || "用户取消",
      });
      pendingRegionCaptureResolve = null;
    }
    return false;
  }

  if (request.action === "smartChat") {
    handleSmartChatRequest(request, sender);
    return true;
  }

  if (request.action === "search") {
    searchAndRead(request.query, request.options)
      .then((results) => sendResponse({ success: true, data: results }))
      .catch((e: Error) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (request.action === "getConfig") {
    getConfig().then((config) => sendResponse(config));
    return true;
  }

  if (request.action === "saveConfig") {
    saveConfig(request.config).then((success) => sendResponse({ success }));
    return true;
  }

  if (request.action === "mcpGetConfig") {
    (async () => {
      try {
        const { getMCPConfig } = await import("./config");
        const { servers, tokens, hasTokens } = await getMCPConfig();
        sendResponse({ success: true, servers, tokens, hasTokens });
      } catch (e) {
        sendResponse({ success: false, servers: [], error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "mcpSaveConfig") {
    (async () => {
      try {
        const { saveMCPConfig } = await import("./config");
        const success = await saveMCPConfig(
          request.servers || [],
          request.tokens
        );
        sendResponse({ success });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  // MCP Test Connection 现在由 SidePanel 直接处理，不再需要 Background 转发

  if (request.action === "readPage") {
    handleReadPageRequest(request, sendResponse);
    return true;
  }

  // ============ 划词翻译 ============

  if (request.action === "translate") {
    (async () => {
      try {
        const text = request.text as string;
        const langpair = (request.langpair as string) || "en|zh";
        if (!text || !text.trim()) {
          sendResponse({ success: false, error: "待翻译文本为空" });
          return;
        }
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;

        // 添加超时处理
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        const json = (await res.json()) as {
          responseData?: { translatedText?: string };
          responseStatus?: number;
        };
        const translatedText = json.responseData?.translatedText?.trim() ?? "";
        if (translatedText) {
          sendResponse({ success: true, translatedText });
        } else {
          sendResponse({
            success: false,
            error:
              json.responseStatus === 200
                ? "翻译结果为空"
                : `API 错误: ${json.responseStatus ?? res.status}`,
          });
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          console.error("[Madoka BG] Translate timeout");
          sendResponse({
            success: false,
            error: "翻译请求超时，请检查网络连接",
          });
        } else {
          console.error("[Madoka BG] Translate failed:", e);
          sendResponse({ success: false, error: (e as Error).message });
        }
      }
    })();
    return true;
  }

  // ============ Ask AI - 发送原文到侧边栏 ============
  // 注意：sidePanel.open() 必须在用户手势的同步调用链中执行，通过 sendMessage 异步调用会丢失手势上下文。
  // 因此只存储问题，由用户点击扩展图标打开侧边栏后自动填入。

  if (request.action === "askAI") {
    const text = (request.text as string)?.trim();
    if (!text) {
      sendResponse({ success: false, error: "原文为空" });
      return true;
    }

    (async () => {
      try {
        await chrome.storage.session.set({ pendingQuestion: text });
        sendResponse({ success: true });
      } catch (e) {
        console.error("[Madoka BG] Ask AI failed:", e);
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  // ============ 网页划线引用 ============

  if (request.action === "addHighlightRef") {
    const text = (request.text as string)?.trim();
    const url = request.url as string;
    const title = (request.title as string) || url;
    if (!text) {
      sendResponse({ success: false, error: "文本为空" });
      return true;
    }
    (async () => {
      try {
        const { webpageHighlightRefs = [] } = await chrome.storage.session.get(
          "webpageHighlightRefs"
        );
        const refs = Array.isArray(webpageHighlightRefs) ? webpageHighlightRefs : [];
        refs.push({
          id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          text,
          url,
          title,
          timestamp: Date.now(),
        });
        await chrome.storage.session.set({ webpageHighlightRefs: refs });
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "getHighlightRefs") {
    (async () => {
      try {
        const { webpageHighlightRefs = [] } = await chrome.storage.session.get(
          "webpageHighlightRefs"
        );
        sendResponse({
          success: true,
          refs: Array.isArray(webpageHighlightRefs) ? webpageHighlightRefs : [],
        });
      } catch (e) {
        sendResponse({ success: false, refs: [], error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "removeHighlightRef") {
    const id = request.id as string;
    if (!id) {
      sendResponse({ success: false });
      return true;
    }
    (async () => {
      try {
        const { webpageHighlightRefs = [] } = await chrome.storage.session.get(
          "webpageHighlightRefs"
        );
        const refs = Array.isArray(webpageHighlightRefs) ? webpageHighlightRefs : [];
        const filtered = refs.filter((r: { id: string }) => r.id !== id);
        await chrome.storage.session.set({ webpageHighlightRefs: filtered });
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "clearHighlightRefs") {
    (async () => {
      try {
        await chrome.storage.session.remove("webpageHighlightRefs");
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  // ============ Action Space Messages ============

  if (request.action === "extractActionSpace") {
    (async () => {
      try {
        const tabId = request.tabId || (await getActiveTab())?.id;
        if (!tabId) {
          sendResponse({ success: false, error: "No active tab found" });
          return;
        }

        const response = await sendToContentScript<{
          success: boolean;
          actionSpace?: ActionSpace;
          error?: string;
        }>(tabId, { action: "extractActionSpace" });

        sendResponse(response);
      } catch (e) {
        console.error("[Madoka BG] Failed to extract Action Space:", e);
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "executeAction") {
    (async () => {
      try {
        const tabId = request.tabId || (await getActiveTab())?.id;
        if (!tabId) {
          sendResponse({ success: false, error: "No active tab found" });
          return;
        }

        const response = await sendToContentScript<{
          success: boolean;
          result?: ActionResult;
          error?: string;
        }>(tabId, {
          action: "executeAction",
          actionId: request.actionId,
          params: request.params as ActionParams,
        });

        sendResponse(response);
      } catch (e) {
        console.error("[Madoka BG] Failed to execute Action:", e);
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "highlightAction") {
    (async () => {
      try {
        const tabId = request.tabId || (await getActiveTab())?.id;
        if (!tabId) {
          sendResponse({ success: false, error: "No active tab found" });
          return;
        }

        const response = await sendToContentScript<{
          success: boolean;
          error?: string;
        }>(tabId, {
          action: "highlightAction",
          actionId: request.actionId,
          highlight: request.highlight,
          status: request.status,
        });

        sendResponse(response);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "clearHighlights") {
    (async () => {
      try {
        const tabId = request.tabId || (await getActiveTab())?.id;
        if (!tabId) {
          sendResponse({ success: false, error: "No active tab found" });
          return;
        }

        const response = await sendToContentScript<{
          success: boolean;
          error?: string;
        }>(tabId, {
          action: "clearHighlights",
        });

        sendResponse(response);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "validateAction") {
    (async () => {
      try {
        const tabId = request.tabId || (await getActiveTab())?.id;
        if (!tabId) {
          sendResponse({ success: false, error: "No active tab found" });
          return;
        }

        const response = await sendToContentScript<{
          success: boolean;
          valid?: boolean;
          reason?: string;
          error?: string;
        }>(tabId, {
          action: "validateAction",
          actionId: request.actionId,
        });

        sendResponse(response);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "clearActionIds") {
    (async () => {
      try {
        const tabId = request.tabId || (await getActiveTab())?.id;
        if (!tabId) {
          sendResponse({ success: false, error: "No active tab found" });
          return;
        }

        const response = await sendToContentScript<{
          success: boolean;
          error?: string;
        }>(tabId, {
          action: "clearActionIds",
        });

        sendResponse(response);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  // ============ Context Reference Messages ============

  if (request.action === "getTabs") {
    (async () => {
      try {
        const query = request.query || "";
        const tabs = query ? await searchTabs(query) : await getAllTabs();
        sendResponse({ success: true, data: tabs });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "getBookmarks") {
    (async () => {
      try {
        const bookmarks = await searchBookmarks(request.query || "");
        sendResponse({ success: true, data: bookmarks });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "getHistory") {
    (async () => {
      try {
        const history = await getHistory(
          request.query || "",
          request.maxResults || 20,
        );
        sendResponse({ success: true, data: history });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "getCurrentPage") {
    (async () => {
      try {
        const page = await getCurrentPage();
        sendResponse({ success: true, data: page });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "searchAllContexts") {
    (async () => {
      try {
        const results = await searchAllContexts(request.query || "");
        sendResponse({ success: true, data: results });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "resolveContext") {
    (async () => {
      try {
        const ref = request.ref as AnyContextRef;
        const content = await resolveContextContent(ref);
        sendResponse({ success: true, data: content });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  // ============ Prompt Optimization (streaming) ============

  if (request.action === "optimizePrompt") {
    const userInput = request.input as string;
    const systemPrompt = request.systemPrompt as string | undefined;

    if (!userInput || !userInput.trim()) {
      sendResponse({ success: false, error: "Input is empty" });
      return true;
    }

    const sendToUI = (message: Record<string, unknown>) => {
      chrome.runtime.sendMessage(message).catch(() => {});
    };

    (async () => {
      try {
        const messages = [
          {
            role: "system" as const,
            content: systemPrompt || DEFAULT_OPTIMIZER_SYSTEM_CONTENT,
          },
          { role: "user" as const, content: userInput.trim() },
        ];

        const fullContent = await callTongyiAPI(messages, (_chunk, content) => {
          const displayContent = stripOptimizeOutputCodeBlock(content);
          sendToUI({ action: "optimizePromptChunk", content: displayContent });
        });

        const finalContent = stripOptimizeOutputCodeBlock(fullContent);

        sendToUI({ action: "optimizePromptEnd", content: finalContent });
      } catch (e) {
        console.error("[Madoka BG] Failed to optimize prompt:", e);
        sendToUI({
          action: "optimizePromptEnd",
          content: "",
          error: (e as Error).message,
        });
      }
    })();
    return true;
  }

  // ============ Memory (local only) ============

  if (request.action === "memoryAddEpisode") {
    (async () => {
      try {
        const result = await memoryAddEpisode(request.payload);
        sendResponse({
          success: true,
          uid: result.uid,
          episode: result.episode,
        });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryQuery") {
    (async () => {
      try {
        const result = await memoryQuery(request);
        sendResponse({ success: true, ...result });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryGetAll") {
    (async () => {
      try {
        const result = await memoryGetAll();
        sendResponse({ success: true, ...result });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryGetBlockList") {
    (async () => {
      try {
        const result = await memoryGetBlockList();
        sendResponse({ success: true, ...result });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryUpdate") {
    (async () => {
      try {
        const result = await memoryUpdate(request.uid, request.updates || {});
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryUpdateEpisodeSyncStatus") {
    (async () => {
      try {
        const result = await memoryUpdateEpisodeSyncStatus(
          request.uid,
          request.syncStatus as
            | "success"
            | "failed"
            | "retrying"
            | "pending"
            | "",
          request.markdownPath as string | undefined,
        );
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryDelete") {
    (async () => {
      try {
        const result = await memoryDelete(request.uid);
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryGetEpisodesByConversation") {
    (async () => {
      try {
        const result = await memoryGetEpisodesByConversation(
          request.conversationId as string,
        );
        sendResponse({ success: true, ...result });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryDeleteByConversationId") {
    (async () => {
      try {
        const result = await memoryDeleteByConversationId(
          request.conversationId as string,
        );
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryGetSettings") {
    (async () => {
      try {
        const settings = await memoryGetSettings();
        sendResponse({ success: true, settings });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memorySaveSettings") {
    (async () => {
      try {
        const result = await memorySaveSettings(request.settings || {});
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryRunCleanup") {
    (async () => {
      try {
        const result = await memoryRunCleanup();
        sendResponse({ success: true, ...result });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryGetCleanupLogs") {
    (async () => {
      try {
        const result = await memoryGetCleanupLogs(request.limit ?? 50);
        sendResponse({ success: true, ...result });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryCheckQuotaAndCleanup") {
    (async () => {
      try {
        const result = await memoryCheckQuotaAndCleanup();
        sendResponse({ success: true, ...result });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryGetUserProfile") {
    (async () => {
      try {
        const result = await memoryGetUserProfile();
        sendResponse({ success: true, ...result });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memorySaveUserProfile") {
    (async () => {
      try {
        const result = await memorySaveUserProfile(
          request.profile as UserProfile,
        );
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryGetObsidianSettings") {
    (async () => {
      try {
        const settings = await memoryGetObsidianSettings();
        sendResponse({ success: true, settings });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memorySaveObsidianSettings") {
    (async () => {
      try {
        const result = await memorySaveObsidianSettings(request.settings || {});
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  // ========== 111/Madoka 记忆扩展：画像 V2、清理配置、自动导出 ==========

  if (request.action === "memoryGetUserProfileV2") {
    (async () => {
      try {
        const profile = await profileV2Db.getUserProfileV2();
        sendResponse({ success: true, profile });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryAddColumn") {
    (async () => {
      try {
        await profileV2Db.addColumn(request.column as ProfileColumn);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryDeleteColumn") {
    (async () => {
      try {
        await profileV2Db.deleteColumn(request.columnId as string);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryAddTag") {
    (async () => {
      try {
        await profileV2Db.addTag(request.tag as ProfileTag);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryUpdateTag") {
    (async () => {
      try {
        await profileV2Db.updateTag(
          request.tagId as string,
          (request.updates || {}) as Partial<ProfileTag>,
        );
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryDeleteTag") {
    (async () => {
      try {
        await profileV2Db.deleteTag(request.tagId as string);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryClearColumnTags") {
    (async () => {
      try {
        await profileV2Db.clearColumnTags(request.columnId as string);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryExportUserProfile") {
    (async () => {
      try {
        const data = await profileV2Db.exportUserProfile();
        sendResponse({ success: true, data });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryImportUserProfile") {
    (async () => {
      try {
        const result = await profileV2Db.importUserProfile(
          request.data as string,
        );
        sendResponse({ success: true, result });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryResetUserProfile") {
    (async () => {
      try {
        await profileV2Db.resetUserProfile();
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryFindDuplicateTags") {
    (async () => {
      try {
        const tags = await profileV2Db.getAllTags();
        const groups = findOverlappingTagGroups(tags);
        sendResponse({ success: true, groups });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryProcessProfileUpdate") {
    (async () => {
      try {
        const r = await processProfileUpdate(
          request.payload as ProfileTagsFromLLM,
        );
        sendResponse({ success: true, ...r });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryGetProfileSummary") {
    (async () => {
      try {
        const summary = await getProfileSummary();
        sendResponse({ success: true, summary });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryAddManualTags") {
    (async () => {
      try {
        const r = await addManualTags(
          request.tags as { value: string; columnId: string }[],
        );
        sendResponse({ success: true, ...r });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryUnlockTag") {
    (async () => {
      try {
        await unlockTag(request.tagId as string);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryLockTag") {
    (async () => {
      try {
        await lockTag(request.tagId as string);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryResolveProfileConflict") {
    (async () => {
      try {
        await resolveConflict(request.tagId as string);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryGetCleanupConfig") {
    (async () => {
      try {
        const config = await getCleanupConfig();
        sendResponse({ success: true, config });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memorySaveCleanupConfig") {
    (async () => {
      try {
        await saveCleanupConfig(request.config as CleanupConfig);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryPreviewCleanup") {
    (async () => {
      try {
        const pct =
          typeof request.percentage === "number"
            ? request.percentage
            : (await getCleanupConfig()).cleanupPercentage;
        const preview = await previewCleanup(pct);
        sendResponse({ success: true, preview });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryExecuteCleanup") {
    (async () => {
      try {
        const ids = request.episodeIds as string[];
        const result = await confirmManualCleanup(ids);
        sendResponse({ success: true, result });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryGetAutoExportRules") {
    (async () => {
      try {
        const rules = await autoExportRulesDb.getAllAutoExportRules();
        sendResponse({ success: true, rules });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryAddAutoExportRule") {
    (async () => {
      try {
        await autoExportRulesDb.addAutoExportRule(
          request.rule as AutoExportRule,
        );
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryDeleteAutoExportRule") {
    (async () => {
      try {
        await autoExportRulesDb.deleteAutoExportRule(
          request.ruleId as string,
        );
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryManualTriggerExport") {
    (async () => {
      try {
        const result = await manualTriggerExport(request.ruleId as string);
        sendResponse({ success: true, result });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryDeleteByMainBlock") {
    (async () => {
      try {
        const result = await memoryDeleteByMainBlock(
          request.mainBlock as string,
        );
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryExportEpisodes") {
    (async () => {
      try {
        const result = await memoryExportEpisodes(
          request.episodes as string[],
        );
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  if (request.action === "memoryImportEpisodes") {
    (async () => {
      try {
        const result = await memoryImportEpisodes(request.data as string);
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  return false;
});

// 找项目使用长连接 Port，避免长时间请求导致 message port closed
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "madoka-github-search") return;
  port.onMessage.addListener((msg: { type?: string; userQuery?: string }) => {
    if (msg.type !== "githubSearch") return;
    const userQuery = (msg.userQuery as string) || "";
    handleGitHubSearch(userQuery)
      .then(
        (result: {
          success: boolean;
          query?: string;
          items?: unknown[];
          error?: string;
        }) => {
          try {
            port.postMessage(result);
          } catch (_) {}
        },
      )
      .catch((e: Error) => {
        try {
          port.postMessage({ success: false, error: e.message });
        } catch (_) {}
      });
  });
});

/**
 * Handle read page request
 */
async function handleReadPageRequest(
  request: { tabId?: number },
  sendResponse: (response: unknown) => void,
) {
  try {
    const tabId = request.tabId || (await getActiveTab())?.id;
    if (!tabId) {
      sendResponse({ success: false, error: "No active tab found" });
      return;
    }

    const response = await sendToContentScript<{
      success: boolean;
      content?: string;
      title?: string;
      url?: string;
      length?: number;
      error?: string;
    }>(tabId, { action: "readPage" });

    sendResponse(response);
  } catch (e) {
    sendResponse({ success: false, error: (e as Error).message });
  }
}

/**
 * Handle smart chat request - simplified search logic
 */
async function handleSmartChatRequest(
  request: {
    message: string;
    images?: string[];
    history?: HistoryMessage[];
    forceSearch?: boolean;
    engine?: SearchEngine;
    pageContent?: string;
    tabId?: number;
    autoReadPage?: boolean;
    selectedBlocks?: string[];
    mcpTools?: OpenAITool[];
    mcpToolsPrompt?: string;
    mcpToolToServer?: Record<string, string>;
  },
  sender: chrome.runtime.MessageSender,
) {
  const tabId = sender.tab?.id || request.tabId;
  const isFromSidePanel = !sender.tab;

  const sendToUI = (message: Record<string, unknown>) => {
    if (isFromSidePanel) {
      chrome.runtime.sendMessage(message).catch(() => {});
    } else if (tabId) {
      chrome.tabs.sendMessage(tabId, message).catch(() => {});
    }
  };

  try {
    let pageContent = request.pageContent || null;
    let searchContext: SearchContext | null = null;

    // Get config and memory settings
    const config = await getConfig();
    const memorySettings = await memoryGetSettings();
    const shouldRequestMemoryTags = memorySettings.enabled;

    console.log("[Madoka BG] Smart chat request:", {
      message: request.message,
      hasPageContent: !!pageContent,
      autoReadPage: request.autoReadPage,
      memoryEnabled: shouldRequestMemoryTags,
      defaultSearchRounds: config.defaultSearchRounds,
    });

    // Auto-read page if requested and no content provided
    if (request.autoReadPage && !pageContent && tabId) {
      sendToUI({ action: "status", message: "📖 Reading page context..." });

      try {
        const readResult = await sendToContentScript<{
          success: boolean;
          content?: string;
          title?: string;
          url?: string;
          length?: number;
        }>(tabId, { action: "readPage" });

        if (readResult.success && readResult.content) {
          pageContent = readResult.content;
          console.log(
            "[Madoka BG] Page read successfully:",
            readResult.length,
            "chars",
          );
        }
      } catch (e) {
        console.warn("[Madoka BG] Failed to read page:", e);
      }
    }

    const forceSearch = request.forceSearch === true;

    if (forceSearch) {
      sendToUI({ action: "status", message: "🔍 Preparing search..." });

      let searchQuery = request.message.trim();

      // Condense follow-up question to standalone
      searchQuery = await condenseQuestion(searchQuery, request.history || []);

      console.log("[Madoka BG] Search query:", searchQuery);

      try {
        searchContext = await searchAndReadMultiRound(searchQuery, {
          engine: request.engine,
          tabId,
          maxRounds: config.defaultSearchRounds,
          onProgress: (progress) => {
            // 首次显示搜索的 query 列表，之后显示已处理结果进度
            let progressMessage: string;
            if (progress.resultsProcessed === 0 && progress.searchingQueries) {
              const queriesPreview = progress.searchingQueries
                .slice(0, 2)
                .map((q) => (q.length > 20 ? q.slice(0, 20) + "..." : q))
                .join(", ");
              const moreCount = Math.max(
                0,
                progress.searchingQueries.length - 2,
              );
              const moreSuffix = moreCount > 0 ? ` +${moreCount} more` : "";
              progressMessage = `🔍 Searching: ${queriesPreview}${moreSuffix}...`;
            } else {
              progressMessage = `🔍 Reading: ${progress.resultsProcessed}/${progress.resultsExpected} results`;
            }
            sendToUI({
              action: "status",
              message: progressMessage,
              progress,
            });
          },
        });

        if (searchContext.results && searchContext.results.length > 0) {
          sendToUI({
            action: "searchResults",
            results: searchContext.results.map((r) => ({
              title: r.title,
              link: r.link,
              snippet: r.snippet,
            })),
          });
          sendToUI({
            action: "status",
            message: `✅ Found ${searchContext.results.length} results`,
          });
        } else {
          sendToUI({ action: "status", message: "⚠️ No search results found" });
        }
      } catch (e) {
        console.error("[Madoka BG] Search failed:", e);
        sendToUI({
          action: "status",
          message: "⚠️ Search failed, answering directly...",
        });
      }
    }

    // Build memory context
    let memoryContext = "";
    try {
      // Always get user profile first (most important)
      const profileRes = await memoryGetUserProfile();
      if (profileRes.profile) {
        const profileItems: string[] = [];
        Object.entries(profileRes.profile).forEach(([key, value]) => {
          if (key === "updatedAt") return;
          if (typeof value === "object" && value !== null) {
            Object.entries(value as Record<string, unknown>).forEach(
              ([k, v]) => {
                if (v && String(v).trim()) {
                  profileItems.push(`${k}: ${v}`);
                }
              },
            );
          }
        });
        if (profileItems.length > 0) {
          memoryContext = "- 用户画像: " + profileItems.slice(0, 5).join("；");
        }
      }

      // If blocks are selected, query memories for those blocks
      if (request.selectedBlocks && request.selectedBlocks.length > 0) {
        const memoryRes = await memoryQuery({
          blocks: request.selectedBlocks,
          limit: 10,
        });
        if (memoryRes.episodes && memoryRes.episodes.length > 0) {
          const episodesStr = memoryRes.episodes
            .map(
              (ep) =>
                `- ${ep.summary || ep.content.slice(0, 150)}${ep.block ? ` [${ep.block}]` : ""}`,
            )
            .join("\n");
          memoryContext += (memoryContext ? "\n" : "") + episodesStr;
        }
      } else {
        // No blocks selected, carry recent 3 memories by default
        const recentRes = await memoryQuery({
          limit: 3,
        });
        if (recentRes.episodes && recentRes.episodes.length > 0) {
          const episodesStr = recentRes.episodes
            .map(
              (ep) =>
                `- ${ep.summary || ep.content.slice(0, 150)}${ep.block ? ` [${ep.block}]` : ""}`,
            )
            .join("\n");
          memoryContext += (memoryContext ? "\n" : "") + episodesStr;
        }
      }
    } catch (e) {
      console.warn("[Madoka BG] Failed to load memory context:", e);
    }

    // Build messages with context（含截图时走多模态）
    const messages = await handleChat(request.message, request.history || [], {
      pageContent: pageContent || undefined,
      searchContext: searchContext || undefined,
      memoryContext: memoryContext || undefined,
      requestMemoryTags: shouldRequestMemoryTags,
      images: request.images,
      mcpToolsPrompt: request.mcpToolsPrompt,
    });

    // Call API with streaming（有 MCP 工具时走 tools 流程）
    sendToUI({ action: "status", message: null }); // Clear status

    let fullResponse = "";
    const onChunk = (chunk: string, content: string) => {
      fullResponse = content;
      sendToUI({ action: "streamChunk", chunk, content });
    };

    if (request.mcpTools?.length && request.mcpToolToServer) {
      const mcpCallTool = (name: string, args: Record<string, unknown>) =>
        new Promise<string>((resolve) => {
          chrome.runtime.sendMessage(
            { action: "mcpCallTool", name, args },
            (response: { success?: boolean; result?: string; error?: string }) => {
              if (chrome.runtime.lastError) {
                resolve(`[TOOL_FAILED] ${chrome.runtime.lastError.message}`);
              } else if (response?.success && response.result !== undefined) {
                resolve(response.result);
              } else {
                const err = response?.error || "Unknown error";
                resolve(`[TOOL_FAILED] ${err}`);
              }
            }
          );
        });
      await callTongyiAPIWithTools(messages, request.mcpTools, onChunk, mcpCallTool);
    } else {
      await callTongyiAPI(messages, onChunk);
    }

    // Send completion message
    sendToUI({
      action: "streamEnd",
      content: fullResponse,
      searchContext: searchContext
        ? {
            query: searchContext.query,
            engine: searchContext.engine,
            count: searchContext.results.length,
          }
        : null,
    });

    // Auto-save memory after conversation ends
    if (shouldRequestMemoryTags) {
      try {
        // Extract XML comment format memory tag from fullResponse
        const memoryMatch = fullResponse.match(/<!--MEMORY:([\s\S]*?)-->/);
        if (memoryMatch) {
          const memoryData = JSON.parse(memoryMatch[1]);
          const { summary, topics, block, subBlock, shortTitle, profile } =
            memoryData;

          // Generate conversation ID
          const conversationId =
            sender.tab?.id?.toString() || "sidepanel-" + Date.now();

          // Extract user content from request
          const userContent = request.message || "";
          // Extract assistant content (remove memory tag for clean content)
          const assistantContent = fullResponse
            .replace(/<!--MEMORY:[\s\S]*?-->/, "")
            .trim();

          // Check if content is worth remembering before saving
          const contentAnalysis = analyzeContentForMemory(
            userContent,
            assistantContent,
          );

          // Output detailed scoring information
          console.log(
            "[Madoka BG] ========== Memory Content Analysis ==========",
          );
          console.log("[Madoka BG] Total Score:", contentAnalysis.totalScore);
          console.log("[Madoka BG] Threshold:", contentAnalysis.threshold);
          console.log(
            "[Madoka BG] Is Worth Remembering:",
            contentAnalysis.isWorthRemembering,
          );
          console.log("[Madoka BG] Scoring Breakdown:");
          contentAnalysis.breakdown.forEach((dim) => {
            if (dim.score > 0) {
              console.log(
                `  - ${dim.name}: ${dim.score} × ${dim.weight} = ${dim.weightedScore}`,
              );
              dim.reasons.forEach((reason) => console.log(`    * ${reason}`));
            }
          });
          console.log("[Madoka BG] ==========================================");

          // Save episode only when content is worth remembering and has required fields
          if (
            contentAnalysis.isWorthRemembering &&
            summary &&
            block &&
            shortTitle
          ) {
            await memoryAddEpisode({
              conversationId,
              userContent,
              assistantContent,
              sourceUrl: sender.tab?.url,
              pageTitle: sender.tab?.title,
              tags: {
                shouldPersist: true,
                summary,
                topics: topics || [],
                memoryType: "long",
                block,
                subBlock,
                shortTitle,
              },
              profileUpdates: profile,
            });

            console.log(
              "[Madoka BG] ✅ Memory saved for conversation:",
              conversationId,
            );
          } else if (!contentAnalysis.isWorthRemembering) {
            console.log(
              "[Madoka BG] ❌ Memory save skipped: content not worth remembering (score:",
              contentAnalysis.totalScore,
              "<",
              contentAnalysis.threshold,
              ")",
            );
          } else {
            console.log(
              "[Madoka BG] ❌ Memory save skipped: missing required fields (summary/block/shortTitle)",
            );
          }
        }
      } catch (e) {
        // Silently handle JSON parse errors or other memory-related errors
        console.log(
          "[Madoka BG] Memory auto-save skipped:",
          (e as Error).message,
        );
      }
    }

    // Detect memory usage and adjust weights
    if (
      shouldRequestMemoryTags &&
      request.selectedBlocks &&
      request.selectedBlocks.length > 0
    ) {
      try {
        // Get memories that were carried in this conversation
        const carriedMemoriesRes = await memoryQuery({
          blocks: request.selectedBlocks,
          limit: 10,
        });

        if (
          carriedMemoriesRes.episodes &&
          carriedMemoriesRes.episodes.length > 0
        ) {
          // Detect which memories were used in the response
          const usageResult = detectMemoryUsage(
            fullResponse,
            carriedMemoriesRes.episodes,
          );
          console.log("[Madoka BG] Memory usage detection:", {
            total: carriedMemoriesRes.episodes.length,
            used: usageResult.usedMemories.length,
            usageRate: usageResult.usageRate,
          });

          // Update weights based on usage
          for (const episode of carriedMemoriesRes.episodes) {
            const wasUsed = usageResult.usedMemories.includes(episode.uid);
            const weightAdjustment = calculateWeightAdjustment(
              episode,
              wasUsed,
            );

            if (weightAdjustment !== 0) {
              const newWeight = Math.max(
                0.1,
                Math.min(1.0, episode.weight + weightAdjustment),
              );
              await memoryUpdate(episode.uid, { weight: newWeight });
              console.log(
                `[Madoka BG] Updated weight for ${episode.uid.slice(0, 8)}: ${episode.weight.toFixed(2)} -> ${newWeight.toFixed(2)} (${wasUsed ? "used" : "unused"})`,
              );
            }
          }
        }
      } catch (e) {
        console.warn(
          "[Madoka BG] Memory usage detection failed:",
          (e as Error).message,
        );
      }
    }
  } catch (e) {
    console.error("[Madoka BG] Smart chat failed:", e);
    sendToUI({
      action: "error",
      message: (e as Error).message,
    });
  }
}

/**
 * Handle legacy chat request (backward compatibility)
 */
async function handleChatRequest(
  request: {
    message: string;
    images?: string[];
    history?: HistoryMessage[];
    forceSearch?: boolean;
    engine?: SearchEngine;
    pageContent?: string;
    tabId?: number;
  },
  sender: chrome.runtime.MessageSender,
) {
  // Use smart chat for all requests now
  await handleSmartChatRequest(
    {
      ...request,
      autoReadPage: false, // Preserve original behavior for legacy calls
    },
    sender,
  );
}

/**
 * Handle send messages request with context references
 * Supports MessageItem array with mime_type separation
 */
async function handleSendMessagesRequest(
  request: {
    messages: MessageItem[];
    images?: string[];
    history?: HistoryMessage[];
    forceSearch?: boolean;
    engine?: SearchEngine;
    pageContent?: string;
    tabId?: number;
    autoReadPage?: boolean;
    selectedBlocks?: string[];
    mcpTools?: OpenAITool[];
    mcpToolsPrompt?: string;
    mcpToolToServer?: Record<string, string>;
  },
  sender: chrome.runtime.MessageSender,
) {
  const tabId = sender.tab?.id || request.tabId;
  const isFromSidePanel = !sender.tab;

  const sendToUI = (message: Record<string, unknown>) => {
    if (isFromSidePanel) {
      chrome.runtime.sendMessage(message).catch(() => {});
    } else if (tabId) {
      chrome.tabs.sendMessage(tabId, message).catch(() => {});
    }
  };

  try {
    // Extract context references and user message from messages array
    const contextRefs = request.messages.filter(
      (m) => m.mime_type === "context/reference"
    );
    const userMessage = request.messages.find(
      (m) => m.mime_type === "text/plain"
    );

    const userContent = userMessage?.content || "";

    console.log("[Madoka BG] Send messages request:", {
      contextRefsCount: contextRefs.length,
      userContent: userContent.slice(0, 100),
      hasImages: !!request.images?.length,
    });

    // Build system context from context references (current request + recent history for multi-turn)
    // 优化：仅保留最近 N 轮引用 + 单条内容截断，降低 token 消耗
    const MAX_CONTEXT_REF_TURNS = 2; // 仅从最近 2 条带引用的用户消息中取
    const MAX_CONTEXT_REF_CONTENT_LEN = 10000; // 单条引用内容最大字符数

    const truncateContent = (s: string, maxLen: number) =>
      s.length <= maxLen ? s : s.slice(0, maxLen) + "\n\n...(内容已截断)";

    const allResourceInfos: Array<{ id: string; file_name: string; url: string; content: string }> = [];
    const seenIds = new Set<string>();

    const addInfo = (info: { id: string; file_name: string; url: string; content: string }) => {
      if (seenIds.has(info.id)) return;
      seenIds.add(info.id);
      allResourceInfos.push({
        ...info,
        content: truncateContent(info.content, MAX_CONTEXT_REF_CONTENT_LEN),
      });
    };

    // 1. From current request's context/reference messages
    for (const ref of contextRefs) {
      const infos = ref.meta_data?.resource_infos || [];
      for (const info of infos) {
        addInfo(info);
      }
    }

    // 2. From history: 仅最近 N 条带引用的用户消息（降低多轮对话 token 消耗）
    const history = request.history || [];
    const userMsgsWithRefs = history.filter(
      (m) => m.role === "user" && m.resource_infos?.length
    );
    const recentUserMsgsWithRefs = userMsgsWithRefs.slice(-MAX_CONTEXT_REF_TURNS);
    for (const msg of recentUserMsgsWithRefs) {
      for (const info of msg.resource_infos || []) {
        addInfo(info);
      }
    }

    let systemContext = "";
    if (allResourceInfos.length > 0) {
      const parts = ["You have access to the following context references:"];
      for (const info of allResourceInfos) {
        parts.push(`\n[${info.file_name}] (${info.url}):\n${info.content}`);
      }
      systemContext = parts.join("\n");
    }

    let pageContent = request.pageContent || null;
    let searchContext: SearchContext | null = null;

    // Get config and memory settings
    const config = await getConfig();
    const memorySettings = await memoryGetSettings();
    const shouldRequestMemoryTags = memorySettings.enabled;

    // Auto-read page if requested and no content provided
    if (request.autoReadPage && !pageContent && tabId) {
      sendToUI({ action: "status", message: "📖 Reading page context..." });

      try {
        const readResult = await sendToContentScript<{
          success: boolean;
          content?: string;
          title?: string;
          url?: string;
          length?: number;
        }>(tabId, { action: "readPage" });

        if (readResult.success && readResult.content) {
          pageContent = readResult.content;
          console.log(
            "[Madoka BG] Page read successfully:",
            readResult.length,
            "chars"
          );
        }
      } catch (e) {
        console.warn("[Madoka BG] Failed to read page:", e);
      }
    }

    const forceSearch = request.forceSearch === true;

    if (forceSearch) {
      sendToUI({ action: "status", message: "🔍 Preparing search..." });

      let searchQuery = userContent.trim();

      // Condense follow-up question to standalone
      searchQuery = await condenseQuestion(searchQuery, request.history || []);

      console.log("[Madoka BG] Search query:", searchQuery);

      try {
        searchContext = await searchAndReadMultiRound(searchQuery, {
          engine: request.engine,
          tabId,
          maxRounds: config.defaultSearchRounds,
          onProgress: (progress) => {
            let progressMessage: string;
            if (progress.resultsProcessed === 0 && progress.searchingQueries) {
              const queriesPreview = progress.searchingQueries
                .slice(0, 2)
                .map((q) => (q.length > 20 ? q.slice(0, 20) + "..." : q))
                .join(", ");
              const moreCount = Math.max(
                0,
                progress.searchingQueries.length - 2
              );
              const moreSuffix = moreCount > 0 ? ` +${moreCount} more` : "";
              progressMessage = `🔍 Searching: ${queriesPreview}${moreSuffix}...`;
            } else {
              progressMessage = `🔍 Reading: ${progress.resultsProcessed}/${progress.resultsExpected} results`;
            }
            sendToUI({
              action: "status",
              message: progressMessage,
              progress,
            });
          },
        });

        if (searchContext.results && searchContext.results.length > 0) {
          sendToUI({
            action: "searchResults",
            results: searchContext.results.map((r) => ({
              title: r.title,
              link: r.link,
              snippet: r.snippet,
            })),
          });
          sendToUI({
            action: "status",
            message: `✅ Found ${searchContext.results.length} results`,
          });
        } else {
          sendToUI({ action: "status", message: "⚠️ No search results found" });
        }
      } catch (e) {
        console.error("[Madoka BG] Search failed:", e);
        sendToUI({
          action: "status",
          message: "⚠️ Search failed, answering directly...",
        });
      }
    }

    // Build memory context
    let memoryContext = "";
    try {
      const profileRes = await memoryGetUserProfile();
      if (profileRes.profile) {
        const profileItems: string[] = [];
        Object.entries(profileRes.profile).forEach(([key, value]) => {
          if (key === "updatedAt") return;
          if (typeof value === "object" && value !== null) {
            Object.entries(value as Record<string, unknown>).forEach(
              ([k, v]) => {
                if (v && String(v).trim()) {
                  profileItems.push(`${k}: ${v}`);
                }
              }
            );
          }
        });
        if (profileItems.length > 0) {
          memoryContext = "- 用户画像: " + profileItems.slice(0, 5).join("；");
        }
      }

      if (request.selectedBlocks && request.selectedBlocks.length > 0) {
        const memoryRes = await memoryQuery({
          blocks: request.selectedBlocks,
          limit: 10,
        });
        if (memoryRes.episodes && memoryRes.episodes.length > 0) {
          const episodesStr = memoryRes.episodes
            .map(
              (ep) =>
                `- ${ep.summary || ep.content.slice(0, 150)}${ep.block ? ` [${ep.block}]` : ""}`
            )
            .join("\n");
          memoryContext += (memoryContext ? "\n" : "") + episodesStr;
        }
      } else {
        const recentRes = await memoryQuery({
          limit: 3,
        });
        if (recentRes.episodes && recentRes.episodes.length > 0) {
          const episodesStr = recentRes.episodes
            .map(
              (ep) =>
                `- ${ep.summary || ep.content.slice(0, 150)}${ep.block ? ` [${ep.block}]` : ""}`
            )
            .join("\n");
          memoryContext += (memoryContext ? "\n" : "") + episodesStr;
        }
      }
    } catch (e) {
      console.warn("[Madoka BG] Failed to load memory context:", e);
    }

    // Build messages with context
    const messages = await handleChat(userContent, request.history || [], {
      pageContent: pageContent || undefined,
      searchContext: searchContext || undefined,
      memoryContext: memoryContext || undefined,
      systemContext: systemContext || undefined,
      requestMemoryTags: shouldRequestMemoryTags,
      images: request.images,
      mcpToolsPrompt: request.mcpToolsPrompt,
    });

    // Call API with streaming（有 MCP 工具时走 tools 流程）
    sendToUI({ action: "status", message: null }); // Clear status

    let fullResponse = "";
    const onChunk = (chunk: string, content: string) => {
      fullResponse = content;
      sendToUI({ action: "streamChunk", chunk, content });
    };

    if (request.mcpTools?.length && request.mcpToolToServer) {
      const mcpCallTool = (name: string, args: Record<string, unknown>) =>
        new Promise<string>((resolve) => {
          chrome.runtime.sendMessage(
            { action: "mcpCallTool", name, args },
            (response: { success?: boolean; result?: string; error?: string }) => {
              if (chrome.runtime.lastError) {
                resolve(`[TOOL_FAILED] ${chrome.runtime.lastError.message}`);
              } else if (response?.success && response.result !== undefined) {
                resolve(response.result);
              } else {
                const err = response?.error || "Unknown error";
                resolve(`[TOOL_FAILED] ${err}`);
              }
            }
          );
        });
      await callTongyiAPIWithTools(messages, request.mcpTools, onChunk, mcpCallTool);
    } else {
      await callTongyiAPI(messages, onChunk);
    }

    // Send completion message
    sendToUI({
      action: "streamEnd",
      content: fullResponse,
      searchContext: searchContext
        ? {
            query: searchContext.query,
            engine: searchContext.engine,
            count: searchContext.results.length,
          }
        : null,
    });

    // Auto-save memory after conversation ends
    if (shouldRequestMemoryTags) {
      try {
        const memoryMatch = fullResponse.match(/<!--MEMORY:([\s\S]*?)-->/);
        if (memoryMatch) {
          const memoryData = JSON.parse(memoryMatch[1]);
          const { summary, topics, block, subBlock, shortTitle, profile } =
            memoryData;

          const conversationId =
            sender.tab?.id?.toString() || "sidepanel-" + Date.now();

          const assistantContent = fullResponse
            .replace(/<!--MEMORY:[\s\S]*?-->/, "")
            .trim();

          const contentAnalysis = analyzeContentForMemory(
            userContent,
            assistantContent
          );

          console.log(
            "[Madoka BG] ========== Memory Content Analysis =========="
          );
          console.log("[Madoka BG] Total Score:", contentAnalysis.totalScore);
          console.log("[Madoka BG] Threshold:", contentAnalysis.threshold);
          console.log(
            "[Madoka BG] Is Worth Remembering:",
            contentAnalysis.isWorthRemembering
          );

          if (
            contentAnalysis.isWorthRemembering &&
            summary &&
            block &&
            shortTitle
          ) {
            await memoryAddEpisode({
              conversationId,
              userContent,
              assistantContent,
              sourceUrl: sender.tab?.url,
              pageTitle: sender.tab?.title,
              tags: {
                shouldPersist: true,
                summary,
                topics: topics || [],
                memoryType: "long",
                block,
                subBlock,
                shortTitle,
              },
              profileUpdates: profile,
            });

            console.log(
              "[Madoka BG] ✅ Memory saved for conversation:",
              conversationId
            );
          }
        }
      } catch (e) {
        console.log(
          "[Madoka BG] Memory auto-save skipped:",
          (e as Error).message
        );
      }
    }

    // Detect memory usage and adjust weights
    if (
      shouldRequestMemoryTags &&
      request.selectedBlocks &&
      request.selectedBlocks.length > 0
    ) {
      try {
        const carriedMemoriesRes = await memoryQuery({
          blocks: request.selectedBlocks,
          limit: 10,
        });

        if (
          carriedMemoriesRes.episodes &&
          carriedMemoriesRes.episodes.length > 0
        ) {
          const usageResult = detectMemoryUsage(
            fullResponse,
            carriedMemoriesRes.episodes
          );

          for (const episode of carriedMemoriesRes.episodes) {
            const wasUsed = usageResult.usedMemories.includes(episode.uid);
            const weightAdjustment = calculateWeightAdjustment(
              episode,
              wasUsed
            );

            if (weightAdjustment !== 0) {
              const newWeight = Math.max(
                0.1,
                Math.min(1.0, episode.weight + weightAdjustment)
              );
              await memoryUpdate(episode.uid, { weight: newWeight });
            }
          }
        }
      } catch (e) {
        console.warn(
          "[Madoka BG] Memory usage detection failed:",
          (e as Error).message
        );
      }
    }
  } catch (e) {
    console.error("[Madoka BG] Send messages failed:", e);
    sendToUI({
      action: "error",
      message: (e as Error).message,
    });
  }
}

// Initialize on install/update
chrome.runtime.onInstalled.addListener(async () => {
  console.log("[Madoka] Extension installed/updated");

  const config = await getConfig();
  await saveConfig(config);

  // Create context menu for link summarization
  if (chrome.contextMenus) {
    chrome.contextMenus.create({
      id: "madoka-summarize-link",
      title: "📝 Madoka: 总结此链接",
      contexts: ["link"],
    });
  }
});

// Handle context menu clicks
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (
      info.menuItemId === "madoka-summarize-link" &&
      info.linkUrl &&
      tab?.id
    ) {
      console.log("[Madoka] Summarizing link:", info.linkUrl);

      try {
        // Open side panel
        await chrome.sidePanel.open({ windowId: tab.windowId });

        // Wait for side panel to open
        await delay(500);

        // Send message to side panel to show link summary
        await chrome.runtime.sendMessage({
          action: "showLinkSummaryInSidepanel",
          linkUrl: info.linkUrl,
          linkText: (info as { linkText?: string }).linkText || info.linkUrl,
        });
      } catch (e) {
        console.error("[Madoka] Failed to show link summary in sidepanel:", e);
        // Show error notification to user
        await showErrorNotification(
          "无法显示链接总结",
          "请刷新页面后重试，或检查扩展权限设置",
        );
      }
    }
  });
}

/**
 * Send message to content script with retry
 */
async function sendToContentScriptWithRetry(
  tabId: number,
  message: Record<string, unknown>,
  maxRetries = 3,
): Promise<void> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await sendToContentScript(tabId, message);
      console.log(`[Madoka] Message sent successfully on attempt ${i + 1}`);
      return;
    } catch (e) {
      lastError = e as Error;
      console.warn(`[Madoka] Attempt ${i + 1} failed:`, (e as Error).message);

      if (i < maxRetries - 1) {
        // Wait before retry (exponential backoff)
        await delay(200 * Math.pow(2, i));
      }
    }
  }

  throw lastError || new Error("Failed to send message after retries");
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Show error notification to user
 */
async function showErrorNotification(
  title: string,
  message: string,
): Promise<void> {
  try {
    // Use chrome.notifications if available
    if (chrome.notifications) {
      await chrome.notifications.create({
        type: "basic",
        iconUrl: "public/icons/icon128.png",
        title,
        message,
      });
    }
  } catch (e) {
    console.error("[Madoka] Failed to show notification:", e);
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Fetch link content
  if (request.action === "fetchLinkContent") {
    (async () => {
      try {
        const url = request.url as string;
        const content = await fetchLinkContent(url);
        sendResponse({ success: true, data: content });
      } catch (e) {
        console.error("[Madoka] Failed to fetch link content:", e);
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  // Summarize content
  if (request.action === "summarizeContent") {
    (async () => {
      try {
        const { title, url, content } = request;
        const summary = await summarizeContent(title, url, content);
        sendResponse({ success: true, summary });
      } catch (e) {
        console.error("[Madoka] Failed to summarize content:", e);
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  // Summarize content with points (for jump functionality)
  if (request.action === "summarizeContentWithPoints") {
    (async () => {
      try {
        const { title, url, content } = request as {
          title: string;
          url: string;
          content: string;
        };
        const result = await summarizeContentWithPoints(title, url, content);
        sendResponse({ success: true, result });
      } catch (e) {
        console.error("[Madoka] Failed to summarize content with points:", e);
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  // Jump to quote in target page
  if (request.action === "jumpToQuote") {
    (async () => {
      try {
        const { url, selectors, text, contextBefore, contextAfter } =
          request as {
            url: string;
            selectors: string[];
            text: string;
            contextBefore: string;
            contextAfter: string;
          };
        await jumpToQuote(url, selectors, text, contextBefore, contextAfter);
        sendResponse({ success: true });
      } catch (e) {
        console.error("[Madoka] Failed to jump to quote:", e);
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }

  // View source - 按照 sidepaneltest 的方式
  if (request.action === "viewSource") {
    (async () => {
      try {
        const { url, point } = request as {
          url: string;
          point: {
            summary: string;
            verbatimQuote: string;
            selectors?: string[];
            contextBefore?: string;
            contextAfter?: string;
          };
        };
        await viewSource(url, point);
        sendResponse({ success: true });
      } catch (e) {
        console.error("[Madoka] Failed to view source:", e);
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }
   // PDF 翻译 - 分段翻译
  if (request.action === 'translatePdfSegments') {
    ;(async () => {
      try {
        const { segments, targetLanguage } = request as {
          segments: { index: number; text: string }[]
          targetLanguage: string
        }

        // Import translateSegments from api.ts
        const { translateSegments } = await import('./api')

        const results = await translateSegments(
          segments,
          targetLanguage,
          (current, total) => {
            // Send progress update to sender
            if (sender.tab?.id) {
              chrome.tabs.sendMessage(sender.tab.id, {
                type: 'pdfTranslationProgress',
                current,
                total,
              })
            }
          }
        )

        sendResponse({ success: true, results })
      } catch (e) {
        console.error('[Madoka] PDF translation failed:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  // DeepLX 单段翻译（避免 CORS）
  if (request.action === 'translateWithDeepLX') {
    ;(async () => {
      try {
        const { text, targetLang } = request as {
          text: string
          targetLang: string
        }
        const result = await translateWithDeepLX(text, targetLang)
        sendResponse({ success: true, result })
      } catch (e) {
        console.error('[Madoka] DeepLX translation failed:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }
})

/**
 * Fetch content from a URL using Jina Reader
 */
async function fetchLinkContent(url: string): Promise<{
  title: string;
  url: string;
  content: string;
  length: number;
}> {
  // Use Jina Reader to fetch content
  const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;

  const response = await fetch(jinaUrl, {
    method: "GET",
    headers: {
      Accept: "text/plain",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch content: ${response.status}`);
  }

  const text = await response.text();

  // Parse the response (Jina Reader returns markdown format)
  const lines = text.split("\n");
  const title = lines[0]?.replace(/^#\s*/, "") || "Untitled";
  const content = text.slice(title.length + 1).trim();

  return {
    title,
    url,
    content: content.slice(0, 15000), // Limit content length
    length: content.length,
  };
}

/**
 * Summarize content using LLM
 */
async function summarizeContent(
  title: string,
  url: string,
  content: string,
): Promise<string> {
  const { getConfig } = await import("./config");
  const config = await getConfig();

  const summaryPrompt = `请对以下网页内容进行总结，要求：
1. 提取核心观点和关键信息
2. 总结内容简洁明了，不超过300字
3. 使用中文回答
4. 如果内容包含技术信息，请保留关键的技术细节

网页标题：${title}
网页URL：${url}

网页内容：
${content.slice(0, 8000)}

请提供总结：`;

  const response = await fetch(config.apiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: "你是一个专业的内容总结助手，擅长提取网页的核心内容。",
        },
        { role: "user", content: summaryPrompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || "无法生成总结";
}

/**
 * Summarize content with key points for jump functionality
 */
async function summarizeContentWithPoints(
  title: string,
  url: string,
  content: string,
): Promise<{
  summary: string;
  points: Array<{
    summary: string;
    verbatimQuote: string;
    selectors: string[];
    contextBefore: string;
    contextAfter: string;
  }>;
}> {
  const { getConfig } = await import("./config");
  const config = await getConfig();

  const summaryPrompt = `你是一位专业的内容分析助手。请对以下网页内容进行深度分析，提取核心要点。

【任务要求】
1. 总体总结：用简洁的语言概括页面核心内容（100-200字）
2. 关键要点：提取3-5个最具代表性的要点，每个要点必须包含：
   - summary: 一句话概括该要点
   - verbatimQuote: 从原文完整摘录的关键段落（至少包含完整的一句话，不要截断）
   - contextBefore: quote前30-50个字符的上下文
   - contextAfter: quote后30-50个字符的上下文

【重要规则】
- verbatimQuote必须是原文的完整摘录，不能修改、省略或概括
- 选择最具信息量的段落，避免选择标题、导航等无关内容
- 确保contextBefore和contextAfter能帮助唯一定位原文位置

【输出格式】
必须只返回纯JSON，不要包含markdown代码块、解释文字或任何其他内容。

JSON格式：
{
  "summary": "总体总结",
  "points": [
    {
      "summary": "要点概括",
      "verbatimQuote": "原文完整摘录",
      "contextBefore": "前文上下文",
      "contextAfter": "后文上下文"
    }
  ]
}

【页面信息】
标题：${title}
URL：${url}

【页面内容】
${content.slice(0, 8000)}

请返回JSON格式的分析结果：`;

  const response = await fetch(config.apiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "你是一个专业的内容总结助手，擅长提取网页的核心内容并以JSON格式返回。",
        },
        { role: "user", content: summaryPrompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  const json = await response.json();
  let content_text = json.choices?.[0]?.message?.content || "";

  console.log("[Madoka] Raw LLM response:", content_text.substring(0, 500));

  // Parse JSON response with multiple fallback strategies
  let result: { summary: string; points: any[] } | null = null;

  // Strategy 1: Try to extract JSON from markdown code block
  const codeBlockMatch = content_text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      result = JSON.parse(codeBlockMatch[1]);
      console.log("[Madoka] Parsed JSON from code block");
    } catch (e) {
      console.log("[Madoka] Failed to parse code block as JSON");
    }
  }

  // Strategy 2: Try to find JSON object directly
  if (!result) {
    const jsonObjectMatch = content_text.match(
      /\{[\s\S]*"summary"[\s\S]*"points"[\s\S]*\}/,
    );
    if (jsonObjectMatch) {
      try {
        result = JSON.parse(jsonObjectMatch[0]);
        console.log("[Madoka] Parsed JSON object directly");
      } catch (e) {
        console.log("[Madoka] Failed to parse JSON object directly");
      }
    }
  }

  // Strategy 3: Try entire content
  if (!result) {
    try {
      result = JSON.parse(content_text);
      console.log("[Madoka] Parsed entire content as JSON");
    } catch (e) {
      console.log("[Madoka] Failed to parse entire content as JSON");
    }
  }

  // Strategy 4: Try to clean and parse
  if (!result) {
    try {
      // Remove common prefixes/suffixes that might break JSON
      const cleaned = content_text
        .replace(/^[^{]*/, "") // Remove everything before first {
        .replace(/[^}]*$/, ""); // Remove everything after last }
      result = JSON.parse(cleaned);
      console.log("[Madoka] Parsed cleaned content as JSON");
    } catch (e) {
      console.log("[Madoka] Failed to parse cleaned content");
    }
  }

  if (result) {
    // Ensure points have correct format
    if (result.points && Array.isArray(result.points)) {
      result.points = result.points.map(
        (point: {
          summary?: string;
          verbatimQuote?: string;
          text?: string;
          contextBefore?: string;
          contextAfter?: string;
        }) => ({
          summary: point.summary || point.text || "",
          verbatimQuote: point.verbatimQuote || point.text || "",
          selectors: [], // Will be generated on the target page
          contextBefore: point.contextBefore || "",
          contextAfter: point.contextAfter || "",
        }),
      );
    }

    console.log("[Madoka] Successfully parsed result:", {
      summary: result.summary?.substring(0, 50),
      pointsCount: result.points?.length,
    });
    return result;
  }

  // Fallback: return plain summary without points
  console.warn("[Madoka] All JSON parsing strategies failed, using plain text");
  console.warn("[Madoka] Raw content:", content_text.substring(0, 200));
  return {
    summary: content_text.substring(0, 500) || "无法生成总结",
    points: [],
  };
}

/**
 * Jump to quote in target page
 */
async function jumpToQuote(
  url: string,
  selectors: string[],
  text: string,
  contextBefore: string,
  contextAfter: string,
): Promise<void> {
  // Open or focus the target tab
  const tabs = await chrome.tabs.query({ url: url + "*" });
  let targetTab: chrome.tabs.Tab;

  if (tabs.length > 0 && tabs[0].id) {
    // Focus existing tab
    targetTab = tabs[0];
    await chrome.tabs.update(targetTab.id!, { active: true });
    await chrome.windows.update(targetTab.windowId, { focused: true });
  } else {
    // Create new tab
    targetTab = await chrome.tabs.create({ url, active: true });
  }

  if (!targetTab.id) {
    throw new Error("无法创建或定位标签页");
  }

  // Wait for tab to load
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Send message to content script to highlight and scroll
  try {
    await sendToContentScriptWithRetry(
      targetTab.id,
      {
        action: "highlightAndScroll",
        selectors,
        text,
        contextBefore,
        contextAfter,
      },
      3,
    );
  } catch (e) {
    console.error("[Madoka] Failed to highlight in target page:", e);
    throw new Error("无法在目标页面中高亮文本，请确保页面已完全加载");
  }
}




/**
 * Translate text using DeepLX API (called from background to avoid CORS)
 * Using multiple fallback services for reliability
 */
async function translateWithDeepLX(text: string, targetLang: string): Promise<string> {
  // Multiple DeepLX services for fallback
  const services = [
    'https://dplx.xi-xu.me/deepl',
    'https://api.deeplx.org/translate',
    'https://deeplx.mingming.dev/translate',
  ]

  let lastError: Error | undefined

  for (const url of services) {
    const controller = new AbortController()
    // 10 second timeout per service
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          source_lang: 'auto',
          target_lang: targetLang,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }

      const json = await res.json() as {
        data?: string
        alternatives?: string[]
        code?: number
        message?: string
      }

      const translatedText = json.data?.trim() ?? ''

      if (translatedText) {
        return translatedText
      } else if (json.code !== 200) {
        throw new Error(json.message || `API error: ${json.code}`)
      } else {
        throw new Error('翻译结果为空')
      }
    } catch (e) {
      clearTimeout(timeoutId)
      if ((e as Error).name === 'AbortError') {
        lastError = new Error('翻译请求超时')
      } else {
        lastError = e as Error
      }
      console.warn(`[Madoka] Service ${url} failed:`, (e as Error).message)
      // Continue to next service
    }
  }

  // All services failed
  throw lastError || new Error('All translation services failed')
}

/**
 * View source - 按照 sidepaneltest 的方式使用 executeScript 注入高亮
 */
async function viewSource(
  url: string,
  point: {
    summary: string;
    verbatimQuote: string;
    selectors?: string[];
    contextBefore?: string;
    contextAfter?: string;
  },
): Promise<void> {
  console.log("[Madoka] ========== View Source Start ==========");
  console.log("[Madoka] URL:", url);
  console.log("[Madoka] Point:", {
    summary: point.summary,
    verbatimQuote: point.verbatimQuote,
    selectors: point.selectors,
    contextBefore: point.contextBefore,
    contextAfter: point.contextAfter,
  });

  // Open or focus the target tab
  const tabs = await chrome.tabs.query({ url: url + "*" });
  console.log(
    "[Madoka] Found tabs:",
    tabs.length,
    tabs.map((t) => ({ id: t.id, url: t.url })),
  );

  let targetTab: chrome.tabs.Tab;

  if (tabs.length > 0 && tabs[0].id) {
    // Focus existing tab
    targetTab = tabs[0];
    console.log("[Madoka] Focusing existing tab:", targetTab.id);
    await chrome.tabs.update(targetTab.id!, { active: true });
    await chrome.windows.update(targetTab.windowId, { focused: true });
  } else {
    // Create new tab
    console.log("[Madoka] Creating new tab for URL:", url);
    targetTab = await chrome.tabs.create({ url, active: true });
  }

  if (!targetTab.id) {
    throw new Error("无法创建或定位标签页");
  }

  console.log("[Madoka] Target tab ID:", targetTab.id);

  // Wait for tab to load
  console.log("[Madoka] Waiting for tab to load...");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  console.log("[Madoka] Wait complete, injecting script...");

  // Use executeScript to inject highlight code directly - 按照 sidepaneltest 的方式
  try {
    const injectionResult = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: (
        quote: string,
        selectors: string[],
        contextBefore: string,
        contextAfter: string,
      ) => {
        console.log("[Content] ========== Injected Script Start ==========");
        console.log("[Content] Quote:", quote);
        console.log("[Content] Selectors:", selectors);
        console.log("[Content] ContextBefore:", contextBefore);
        console.log("[Content] ContextAfter:", contextAfter);

        // 查找元素的函数
        function findElementBySelectors(selectors: string[]): Element | null {
          console.log("[Content] Trying selectors:", selectors);
          for (let i = 0; i < selectors.length; i++) {
            const selector = selectors[i];
            try {
              console.log(
                `[Content] Trying selector ${i + 1}/${selectors.length}: "${selector}"`,
              );
              const element = document.querySelector(selector);
              if (element) {
                console.log(
                  `[Content] ✓ Found element with selector "${selector}":`,
                  element,
                );
                return element;
              } else {
                console.log(`[Content] ✗ Selector "${selector}" returned null`);
              }
            } catch (e) {
              console.error(`[Content] ✗ Invalid selector "${selector}":`, e);
              continue;
            }
          }
          console.log("[Content] All selectors failed");
          return null;
        }

        // 基于文本查找元素 - 放宽匹配条件
        function findElementByText(
          text: string,
          contextBefore?: string,
          contextAfter?: string,
        ): Element | null {
          console.log("[Content] Searching by text:", text);
          console.log("[Content] ContextBefore:", contextBefore);
          console.log("[Content] ContextAfter:", contextAfter);

          if (!text || text.trim().length === 0) {
            console.log("[Content] ✗ Empty text provided");
            return null;
          }

          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
          );
          let node: Text | null;
          let matchCount = 0;
          const candidates: Array<{
            element: Element;
            score: number;
            text: string;
          }> = [];

          while ((node = walker.nextNode() as Text)) {
            if (node.textContent) {
              const nodeText = node.textContent.trim();
              // 使用模糊匹配：文本包含关系或相似度
              if (nodeText.includes(text) || text.includes(nodeText)) {
                matchCount++;
                const parent = node.parentElement;
                if (parent) {
                  const parentText = parent.textContent || "";
                  console.log(
                    `[Content] Found text match #${matchCount}, parent text:`,
                    parentText.substring(0, 100),
                  );

                  // 计算匹配分数
                  let score = 0;

                  // 文本完全匹配得高分
                  if (nodeText === text) score += 100;
                  else if (nodeText.includes(text)) score += 80;
                  else if (text.includes(nodeText)) score += 60;

                  // 上下文匹配（放宽条件：如果上下文为空，不扣分）
                  if (contextBefore && parentText.includes(contextBefore)) {
                    score += 10;
                    console.log(`[Content] ✓ ContextBefore matched (+10)`);
                  } else if (contextBefore) {
                    score -= 5;
                    console.log(`[Content] ~ ContextBefore not matched (-5)`);
                  }

                  if (contextAfter && parentText.includes(contextAfter)) {
                    score += 10;
                    console.log(`[Content] ✓ ContextAfter matched (+10)`);
                  } else if (contextAfter) {
                    score -= 5;
                    console.log(`[Content] ~ ContextAfter not matched (-5)`);
                  }

                  // 优先选择文本长度接近的元素（更精确）
                  const lengthDiff = Math.abs(parentText.length - text.length);
                  score -= lengthDiff * 0.1;

                  candidates.push({ element: parent, score, text: parentText });
                  console.log(`[Content] Candidate score: ${score.toFixed(1)}`);
                }
              }
            }
          }

          if (candidates.length === 0) {
            console.log(
              `[Content] Text search complete. No matches found for: "${text}"`,
            );
            return null;
          }

          // 按分数排序，返回最高分的元素
          candidates.sort((a, b) => b.score - a.score);
          console.log(`[Content] Total candidates: ${candidates.length}`);
          console.log(
            `[Content] Best match (score: ${candidates[0].score.toFixed(1)}):`,
            candidates[0].text.substring(0, 100),
          );

          return candidates[0].element;
        }

        // 创建高亮覆盖层 - 使用绝对定位跟随滚动
        function createHighlightOverlay(element: Element): void {
          console.log(
            "[Content] Creating highlight overlay for element:",
            element,
          );

          // 移除已有的高亮
          const existing = document.getElementById(
            "summary-highlight-container",
          );
          if (existing) {
            console.log("[Content] Removing existing highlight");
            existing.remove();
          }

          // 创建容器 - 使用绝对定位覆盖整个文档
          const container = document.createElement("div");
          container.id = "summary-highlight-container";
          Object.assign(container.style, {
            position: "absolute",
            top: "0",
            left: "0",
            width: `${document.documentElement.scrollWidth}px`,
            height: `${document.documentElement.scrollHeight}px`,
            pointerEvents: "none",
            zIndex: "2147483647",
            overflow: "hidden",
          });

          // 创建覆盖层
          const overlay = document.createElement("div");
          overlay.className = "summary-highlight-overlay";

          // 计算元素相对于文档的位置（考虑滚动）
          const rect = element.getBoundingClientRect();
          const scrollTop =
            window.pageYOffset || document.documentElement.scrollTop;
          const scrollLeft =
            window.pageXOffset || document.documentElement.scrollLeft;
          const absoluteTop = rect.top + scrollTop;
          const absoluteLeft = rect.left + scrollLeft;
          const padding = 12;

          console.log("[Content] Element position:", {
            rectTop: rect.top,
            rectLeft: rect.left,
            scrollTop: scrollTop,
            scrollLeft: scrollLeft,
            absoluteTop: absoluteTop,
            absoluteLeft: absoluteLeft,
            width: rect.width,
            height: rect.height,
          });

          Object.assign(overlay.style, {
            position: "absolute",
            top: `${absoluteTop - padding}px`,
            left: `${absoluteLeft - padding}px`,
            width: `${rect.width + padding * 2}px`,
            height: `${rect.height + padding * 2}px`,
            borderRadius: "8px",
            background: "rgba(255, 235, 59, 0.25)",
            border: "3px solid rgba(255, 193, 7, 0.9)",
            boxShadow:
              "0 0 15px rgba(255, 193, 7, 0.6), 0 0 30px rgba(255, 193, 7, 0.3)",
            animation: "summary-highlight-breathe 2s ease-in-out infinite",
            pointerEvents: "none",
            transition: "top 0.1s ease-out, left 0.1s ease-out",
          });

          // 添加呼吸灯动画样式
          const style = document.createElement("style");
          style.textContent = `
            @keyframes summary-highlight-breathe {
              0%, 100% { 
                box-shadow: 0 0 15px rgba(255, 193, 7, 0.6), 0 0 30px rgba(255, 193, 7, 0.3);
                border-color: rgba(255, 193, 7, 0.9);
                background: rgba(255, 235, 59, 0.25);
              }
              50% { 
                box-shadow: 0 0 25px rgba(255, 193, 7, 0.9), 0 0 50px rgba(255, 193, 7, 0.5), 0 0 75px rgba(255, 193, 7, 0.3);
                border-color: rgba(255, 215, 0, 1);
                background: rgba(255, 235, 59, 0.4);
              }
            }
          `;
          container.appendChild(style);
          container.appendChild(overlay);
          document.body.appendChild(container);
          console.log(
            "[Content] Highlight overlay created and appended to body",
          );

          // 滚动到元素
          console.log("[Content] Scrolling to element...");
          element.scrollIntoView({ behavior: "smooth", block: "center" });

          // 添加滚动和resize监听，更新高亮位置
          let scrollTimeout: number | null = null;
          const updateHighlightPosition = () => {
            if (scrollTimeout) {
              clearTimeout(scrollTimeout);
            }
            scrollTimeout = window.setTimeout(() => {
              const newRect = element.getBoundingClientRect();
              const newScrollTop =
                window.pageYOffset || document.documentElement.scrollTop;
              const newScrollLeft =
                window.pageXOffset || document.documentElement.scrollLeft;
              const newAbsoluteTop = newRect.top + newScrollTop;
              const newAbsoluteLeft = newRect.left + newScrollLeft;

              overlay.style.top = `${newAbsoluteTop - padding}px`;
              overlay.style.left = `${newAbsoluteLeft - padding}px`;

              console.log("[Content] Updated highlight position:", {
                top: newAbsoluteTop - padding,
                left: newAbsoluteLeft - padding,
              });
            }, 10);
          };

          window.addEventListener("scroll", updateHighlightPosition, {
            passive: true,
          });
          window.addEventListener("resize", updateHighlightPosition, {
            passive: true,
          });

          // 3秒后移除高亮和监听器
          setTimeout(() => {
            console.log("[Content] Removing highlight after 3 seconds");
            window.removeEventListener("scroll", updateHighlightPosition);
            window.removeEventListener("resize", updateHighlightPosition);
            container.remove();
          }, 3000);
        }

        // 主逻辑
        console.log("[Content] ========== Starting Search ==========");

        // 策略 1: 使用选择器查找
        let element: Element | null = null;
        if (selectors && selectors.length > 0) {
          console.log("[Content] Strategy 1: Using CSS selectors");
          element = findElementBySelectors(selectors);
        } else {
          console.log("[Content] Strategy 1: Skipped (no selectors provided)");
        }

        // 策略 2: 使用文本查找
        if (!element && quote) {
          console.log("[Content] Strategy 2: Using text search");
          element = findElementByText(quote, contextBefore, contextAfter);
        } else if (!element) {
          console.log("[Content] Strategy 2: Skipped (no quote provided)");
        }

        if (element) {
          console.log(
            "[Content] ✓✓✓ SUCCESS: Found element, creating highlight",
          );

          // 生成选择器
          const generatedSelectors = generateSelectorsForElement(element);
          console.log("[Content] Generated selectors:", generatedSelectors);

          createHighlightOverlay(element);
          console.log("[Content] ========== Complete ==========");
        } else {
          console.error(
            "[Content] ✗✗✗ FAILED: Could not find element for quote:",
            quote,
          );
          console.error("[Content] Selectors tried:", selectors);
          console.error("[Content] Quote:", quote);
          console.error("[Content] ContextBefore:", contextBefore);
          console.error("[Content] ContextAfter:", contextAfter);
          alert(
            "无法在页面中找到对应的文本位置\n\nQuote: " +
              quote.substring(0, 50) +
              "...",
          );
        }

        // 生成选择器的函数
        function generateSelectorsForElement(element: Element): string[] {
          const selectors: string[] = [];

          // 1. ID 选择器
          if (element.id) {
            selectors.push(`#${element.id}`);
          }

          // 2. Class 选择器
          if (element.classList.length > 0) {
            const classSelector = "." + Array.from(element.classList).join(".");
            selectors.push(classSelector);
          }

          // 3. 属性选择器
          const attrNames = [
            "data-article-id",
            "data-post-id",
            "data-content-id",
            "data-block-id",
            "data-section-id",
          ];
          for (const attr of attrNames) {
            const value = element.getAttribute(attr);
            if (value) {
              selectors.push(`[${attr}="${value}"]`);
            }
          }

          // 4. 完整路径选择器
          const path: string[] = [];
          let current: Element | null = element;
          while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
              selector = `#${current.id}`;
              path.unshift(selector);
              break;
            }
            if (current.classList.length > 0) {
              selector +=
                "." + Array.from(current.classList).slice(0, 2).join(".");
            }
            // 添加 nth-child
            const parent = current.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children).filter(
                (child) => child.tagName === current!.tagName,
              );
              if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += `:nth-of-type(${index})`;
              }
            }
            path.unshift(selector);
            current = current.parentElement;
          }
          selectors.push(path.join(" > "));

          return [...new Set(selectors)];
        }
      },
      args: [
        point.verbatimQuote,
        point.selectors || [],
        point.contextBefore || "",
        point.contextAfter || "",
      ],
    });

    console.log("[Madoka] Script injection result:", injectionResult);
    console.log("[Madoka] ✓ Highlight injected successfully");
    console.log("[Madoka] ========== View Source End ==========");
  } catch (e) {
    console.error("[Madoka] ✗ Failed to inject highlight:", e);
    console.error("[Madoka] ========== View Source Failed ==========");
    throw new Error("无法在目标页面中注入高亮代码: " + (e as Error).message);
  }
}

// Initialize extension when installed or started
function initializeExtension() {
  console.log("[Madoka] Initializing extension...");

  // Open Side Panel on extension icon click (Manifest V3)
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .then(() => console.log("[Madoka] Side panel behavior set"))
    .catch((error) =>
      console.error("[Madoka] Failed to set panel behavior:", error),
    );
}

// Register initialization on install and startup
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Madoka] Extension installed");
  initializeExtension();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[Madoka] Extension started");
  initializeExtension();
});

// Memory cleanup alarm (daily)
if (chrome.alarms) {
  chrome.alarms.create("memoryCleanup", { periodInMinutes: 24 * 60 });
}

if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "memoryCleanup") {
      memoryRunCleanup().catch((e) =>
        console.warn("[Madoka] Memory cleanup alarm failed:", e),
      );
    }
  });
}

// Startup: delay 5s then check quota and optionally pressure-cleanup
setTimeout(() => {
  memoryCheckQuotaAndCleanup().catch(() => {});
}, 5000);

// Also initialize immediately for development reload
initializeExtension();

console.log('[Madoka] Background Service Worker started')
