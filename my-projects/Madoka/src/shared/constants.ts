/**
 * 常量配置
 */

// 系统提示词
export const SYSTEM_PROMPT = `你是 Madoka，一个智能搜索助手。

用户消息可能包含以下 JSON 结构的上下文信息：
{
  "question": "用户的问题",
  "page_content": "当前页面的 Markdown 内容（可选）",
  "search_results": "搜索结果（可选）"
}

规则：
1. 优先基于 page_content 或 search_results 中的信息回答问题
2. 在回答中适当引用来源
3. 如果上下文信息不足以回答问题，请明确说明
4. 使用 Markdown 格式组织回答
5. 保持回答简洁、准确、有帮助
6. 如果没有上下文信息，可以正常对话`;

/** MCP 工具调用规则：禁止编造，必须真实调用 */
export const MCP_TOOL_RULES = `
【MCP 工具调用强制规则 - 必须严格遵守】
1. 当用户请求涉及外部系统（语雀、GitHub、网页等）的数据或操作时，必须调用相应 MCP 工具，禁止凭记忆或猜测回答。
2. 禁止编造工具执行结果。未调用工具前，不得声称已查询、已创建、已修改等。
3. 工具返回失败或错误时，必须如实告知用户「操作失败」并转述具体错误信息，禁止假装成功。
4. 若工具返回内容包含 "error"、"failed"、"失败"、"错误" 或 "[TOOL_FAILED]" 前缀，一律视为失败并明确说明。
5. 不确定的数据必须通过工具获取，不得虚构 ID、名称、数量等。
6. 严禁调用任何删除类工具（名称含 delete、remove、del、删除、移除 等）。若用户请求删除数据，必须明确拒绝并说明「Madoka 不支持删除操作，请手动处理」。不得编造已删除或假装执行删除。`;

/** 禁止调用的工具名称模式（含 delete/remove 等） */
export const FORBIDDEN_TOOL_PATTERNS = /delete|remove|del|删除|移除/i;

// 搜索关键词
export const SEARCH_KEYWORDS = [
  "最新",
  "今天",
  "现在",
  "当前",
  "新闻",
  "消息",
  "怎么样",
  "多少钱",
  "价格",
  "天气",
  "股票",
  "什么是",
  "如何",
  "教程",
  "方法",
];

// 搜索命令前缀
export const SEARCH_PREFIXES = ["/search ", "/搜索 "];

// 特殊命令
export const COMMANDS = {
  CLEAR: ["/clear", "/清空"],
  HELP: ["/help", "/帮助"],
  READ: ["/read", "/阅读"],
} as const;

// 模型选项
export const MODEL_OPTIONS = [
  { value: "qwen-plus", label: "qwen-plus (推荐)" },
  { value: "qwen-turbo", label: "qwen-turbo (快速)" },
  { value: "qwen-max", label: "qwen-max (强大)" },
] as const;

// 搜索结果数量选项

// 多轮关联搜索：每轮取几条、总结果上限
export const RESULTS_PER_ROUND = 2;
export const MULTI_SEARCH_MAX_TOTAL = 8;

// Condense Question：将追问重写为独立可搜索问题（LangChain ConversationalRetrieval 思路）
export const CONDENSE_QUESTION_PROMPT = `根据以下对话历史和用户的追问，将追问重写为一个独立的、可单独理解的问题。使用原文语言，仅输出重写后的问题，不要解释。

对话历史：
{chat_history}

追问：{question}

独立问题：`;

// 追问特征：以代词/指代开头或过短片段（需结合历史理解）
export const FOLLOW_UP_INDICATORS =
  /^(它|那个|这个|他|她|他的|她的|它的|怎么样|呢|还有吗|然后呢?|多少钱)$|^(它|那个|这个|他|她)(呢|的)?/;
export const CONDENSE_MAX_HISTORY_TURNS = 5;
export const CONDENSE_FOLLOW_UP_MAX_LEN = 15;

// GitHub 找项目（类 Copilot）：LLM 生成搜索串 + GitHub Search API
export const GITHUB_SEARCH_QUERY_PROMPT = `你是 GitHub 仓库搜索助手。根据用户的自然语言需求，输出一条可直接用于 GitHub search/repositories 的搜索串。

规则：
1. 仅输出搜索串，不要解释、不要换行。搜索串可包含关键词和 qualifiers。
2. 支持的 qualifiers 示例：language:python、stars:>100、pushed:>2024-01-01、topic:llm、fork:false。用空格连接。
3. 关键词用英文或保留用户原文；若用户说中文，可保留核心词或译为英文以扩大结果。
4. 长度控制在 80 字符内。

示例：
用户：想找 Python 的异步 Web 框架 → python async web framework
用户：最近很火的 LLM 推理项目 → llm reasoning stars:>500
用户：Chrome 扩展 智能补全 → chrome extension autocomplete
用户：本地部署大模型 API → local llm api server`;
export const GITHUB_SEARCH_MAX_REPOS = 10;
export const GITHUB_API_PER_PAGE = 15;

// Web Search Query Generation Prompt
export const WEB_SEARCH_QUERY_PROMPT = `You are a web search query generator. Given a user's question, generate multiple optimized search queries to find comprehensive information.

Rules:
1. Generate 2-3 distinct search queries
2. Each query should explore a different aspect of the topic
3. Keep queries concise (3-8 keywords each)
4. Use English for queries, keep technical terms
5. Format as a JSON array: ["query1", "query2", "query3"]

Query generation strategies:
- Primary: Main topic with key terms
- Secondary: Specific aspect or related concept
- Tertiary: Tutorial/how-to focused if applicable

Examples:
User: "What are the latest features in React 19?"
Queries: ["React 19 new features 2025", "React 19 release notes changes", "React 19 migration guide"]

User: "How to implement OAuth in Next.js"
Queries: ["Next.js OAuth implementation tutorial", "Next.js authentication providers", "Next.js OAuth 2.0 guide"]

Output ONLY as JSON array, nothing else.`;

// LLM Query Generation Settings
export const LLM_QUERY_GENERATION_TIMEOUT = 10000; // 10 seconds
export const LLM_QUERY_GENERATION_MAX_TOKENS = 150;
