/**
 * 共享类型定义
 */

// GitHub 找项目卡片项（callpeek 风格）
export interface GitHubRepoItem {
  full_name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
  language: string;
  updated_at: string;
}

// 消息类型
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  searchResults?: SearchResult[];
  /** GitHub 找项目模式返回的仓库列表 */
  githubItems?: GitHubRepoItem[];
  isStreaming?: boolean;
  /** 用户消息附带的截图（base64 data URL，用于多模态输入与展示） */
  images?: string[];
  /** 用户消息引用的上下文（用于展示与多轮对话） */
  resource_infos?: ResourceInfo[];
}

// 搜索结果
export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  fullContent?: string;
  /** 多轮搜索时标记来自哪条 query */
  fromQuery?: string;
}

// 搜索上下文
export interface SearchContext {
  query: string;
  engine: SearchEngine;
  results: SearchResult[];
}

// 搜索引擎
export type SearchEngine = "bing" | "google";

// MCP Server 配置（token 单独存储，不在此）
export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  authType: "none" | "bearer";
  enabled: boolean;
}

// 通义千问 OpenAI 兼容的 tool 格式
export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties?: Record<string, { type: string; description?: string }>;
      required?: string[];
    };
  };
}

// 应用配置
export interface AppConfig {
  apiKey: string;
  apiEndpoint: string;
  model: string;
  /** 多模态（截图）时使用的视觉模型，如 qwen-vl-plus */
  visionModel?: string;
  searchEngine: SearchEngine;
  maxResults: number;
  maxContentLength: number;
  /** 多轮搜索轮数（1-3 轮） */
  defaultSearchRounds: number;
  /** 可选：GitHub Token，提高 API 限流上限 */
  githubToken?: string;
  /** 是否启用 LLM 智能生成搜索 query */
  enableLLMQueryGeneration: boolean;
}

// 默认配置
export const DEFAULT_CONFIG: AppConfig = {
  apiKey: "",
  apiEndpoint:
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  model: "qwen-plus",
  visionModel: "qwen-vl-plus",
  searchEngine: "bing",
  maxResults: 5,
  maxContentLength: 400000,
  defaultSearchRounds: 3,
  githubToken: "",
  enableLLMQueryGeneration: true,
};

// 视图状态
export type ViewState = "chat" | "settings";

// 聊天状态
export type ChatStatus = "idle" | "searching" | "responding";

// 聊天上下文状态
export interface ChatState {
  messages: Message[];
  status: ChatStatus;
  isResponding: boolean;
  view: ViewState;
  currentEngine: SearchEngine;
  pageContent: PageContent | null;
  searchStatus: string | null;
}

// 页面内容
export interface PageContent {
  title: string;
  url: string;
  markdown: string;
  length: number;
}

// 聊天动作
export type ChatAction =
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "UPDATE_MESSAGE"; payload: { id: string; content: string } }
  | { type: "SET_STATUS"; payload: ChatStatus }
  | { type: "SET_VIEW"; payload: ViewState }
  | { type: "SET_ENGINE"; payload: SearchEngine }
  | { type: "SET_PAGE_CONTENT"; payload: PageContent | null }
  | { type: "SET_SEARCH_STATUS"; payload: string | null }
  | { type: "CLEAR_MESSAGES" }
  | { type: "FINISH_RESPONSE"; payload: string };

// Chrome 消息类型
export interface ChromeMessage {
  action: string;
  [key: string]: unknown;
}

// Chat 请求
export interface ChatRequest {
  action: "chat";
  message: string;
  history: { role: string; content: string }[];
  forceSearch: boolean;
  engine: SearchEngine;
  pageContent?: string;
  tabId?: number;
}

// 流式响应
export interface StreamChunkMessage {
  action: "streamChunk";
  chunk: string;
  content: string;
}

export interface StreamEndMessage {
  action: "streamEnd";
  content: string;
  searchContext?: {
    query: string;
    engine: SearchEngine;
    count: number;
  };
}

export interface SearchResultsMessage {
  action: "searchResults";
  results: SearchResult[];
}

export interface StatusMessage {
  action: "status";
  message: string;
  progress?: {
    resultsProcessed: number;
    resultsExpected: number;
    searchingQueries?: string[];
  };
}

export interface ErrorMessage {
  action: "error";
  message: string;
}

export interface ShowLinkSummaryInSidepanelMessage {
  action: "showLinkSummaryInSidepanel";
  linkUrl: string;
  linkText?: string;
}

// 提示词优化流式消息
export interface OptimizePromptChunkMessage {
  action: "optimizePromptChunk";
  content: string;
}

export interface OptimizePromptEndMessage {
  action: "optimizePromptEnd";
  content: string;
  error?: string;
}

// 资源信息（用于上下文引用）
export interface ResourceInfo {
  file_name: string;
  file_format: string;
  url: string;
  id: string;
  content: string;
  type: string;
  /** Favicon URL，用于展示 */
  favicon?: string;
}

// 消息项（支持 mime_type 和 meta_data）
export interface MessageItem {
  role: "user" | "assistant" | "system";
  content?: string;
  mime_type: "text/plain" | "context/reference" | "image/base64";
  meta_data?: {
    resource_infos?: ResourceInfo[];
    ori_query?: string;
  };
}

export interface MCPGetConfigMessage {
  action: "mcpGetConfig";
}

export interface MCPGetConfigResponse {
  success: boolean;
  servers: MCPServerConfig[];
  /** 是否有 token（不返回明文） */
  hasTokens?: Record<string, boolean>;
}

export interface MCPSaveConfigMessage {
  action: "mcpSaveConfig";
  servers: MCPServerConfig[];
  tokens?: Record<string, string>;
}

export interface MCPTestConnectionMessage {
  action: "mcpTestConnection";
  server: MCPServerConfig;
  token?: string;
}

export interface MCPTestConnectionResponse {
  success: boolean;
  toolsCount?: number;
  error?: string;
}

export type BackgroundMessage =
  | StreamChunkMessage
  | StreamEndMessage
  | SearchResultsMessage
  | StatusMessage
  | ErrorMessage
  | ShowLinkSummaryInSidepanelMessage
  | OptimizePromptChunkMessage
  | OptimizePromptEndMessage;
