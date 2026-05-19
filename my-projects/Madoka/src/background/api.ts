/**
 * Tongyi API Module
 * Includes AI-based smart search and keyword extraction
 */

import type { SearchContext, ResourceInfo, OpenAITool } from '../shared/types'
import {
  SYSTEM_PROMPT,
  MCP_TOOL_RULES,
  CONDENSE_QUESTION_PROMPT,
  FOLLOW_UP_INDICATORS,
  CONDENSE_MAX_HISTORY_TURNS,
  CONDENSE_FOLLOW_UP_MAX_LEN,
} from '../shared/constants'
import { DEFAULT_OPTIMIZER_SYSTEM_CONTENT } from '../shared/prompt-templates'
import { getConfig } from './config'

/** 多模态消息 content 部分（OpenAI 兼容格式） */
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

/**
 * Build structured user message with context
 */
export function buildStructuredMessage(
  question: string,
  options: {
    pageContent?: string
    searchContext?: SearchContext
  } = {}
): string {
  const { pageContent, searchContext } = options

  if (!pageContent && !searchContext) {
    return question
  }

  const messageObj: Record<string, unknown> = {
    question,
  }

  if (pageContent) {
    messageObj.page_content = pageContent
  }

  if (searchContext && searchContext.results && searchContext.results.length > 0) {
    const maxPerResult = 4000
    const maxTotal = 20000
    let totalLength = 0

    const processedResults: {
      position: number
      title: string
      url: string
      content: string
      from_query?: string
    }[] = []

    for (const r of searchContext.results) {
      const content = r.fullContent || r.snippet || ''
      const availableLength = Math.min(maxPerResult, maxTotal - totalLength)

      if (availableLength <= 0) break

      const truncatedContent = content.slice(0, availableLength)
      totalLength += truncatedContent.length

      const item: (typeof processedResults)[number] = {
        position: processedResults.length + 1,
        title: r.title,
        url: r.link,
        content: truncatedContent,
      }
      if (r.fromQuery) item.from_query = r.fromQuery
      processedResults.push(item)
    }

    messageObj.search_results = {
      query: searchContext.query,
      engine: searchContext.engine,
      results: processedResults,
    }

    console.log(`[Madoka BG] Search results length: ${totalLength} chars, ${processedResults.length} results`)
  }

  return JSON.stringify(messageObj, null, 2)
}

/** 历史消息格式（支持多模态与上下文引用） */
export type HistoryMessage = {
  role: string
  content: string
  images?: string[]
  /** 用户消息引用的上下文，用于多轮对话时保持引用 */
  resource_infos?: ResourceInfo[]
}

/**
 * Handle chat request, build message array
 * @param images - base64 data URLs (data:image/png;base64,...)，用于多模态输入与展示
 */
export async function handleChat(
  message: string,
  history: HistoryMessage[] = [],
  options: {
    pageContent?: string
    searchContext?: SearchContext
    requestMemoryTags?: boolean
    memoryContext?: string
    systemContext?: string
    mcpToolsPrompt?: string
    images?: string[]
  } = {}
): Promise<ChatMessage[]> {
  let systemContent = SYSTEM_PROMPT
  if (options.requestMemoryTags) {
    systemContent = systemContent + MEMORY_TAGS_INSTRUCTION
  }
  // Add memory context if provided
  if (options.memoryContext) {
    systemContent = systemContent + '\n\n[相关背景]\n' + options.memoryContext
  }
  // Add system context (from context references) if provided
  if (options.systemContext) {
    systemContent = systemContent + '\n\n' + options.systemContext
  }
  // Add MCP tools description if provided
  if (options.mcpToolsPrompt) {
    systemContent = systemContent + '\n\n[MCP 可用工具]\n' + options.mcpToolsPrompt
    systemContent = systemContent + '\n\n' + MCP_TOOL_RULES
  }
  const messages: ChatMessage[] = [{ role: 'system', content: systemContent }]

  // Add history messages（含图片时使用多模态格式）
  history.forEach((msg) => {
    if (msg.role === 'user' && msg.images && msg.images.length > 0) {
      const contentParts: ContentPart[] = [
        { type: 'text', text: msg.content },
        ...msg.images.map((url) => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ]
      messages.push({ role: 'user', content: contentParts })
    } else {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
    }
  })

  // Build structured user message
  const userContent = buildStructuredMessage(message, options)

  // 多模态：有截图时使用 content 数组格式
  if (options.images && options.images.length > 0) {
    const contentParts: ContentPart[] = [
      { type: 'text', text: userContent },
      ...options.images.map((url) => ({
        type: 'image_url' as const,
        image_url: { url },
      })),
    ]
    messages.push({ role: 'user', content: contentParts })
  } else {
    messages.push({ role: 'user', content: userContent })
  }

  return messages
}

const MEMORY_TAGS_INSTRUCTION = `

【记忆与人物画像】请在回复正文结束后，在最后一行添加一个 HTML 注释格式的记忆标签（用户看不到这个注释）。格式如下：
<!--MEMORY:{"summary": "本段对话一句话摘要", "topics": ["关键词"], "block": "记忆板块名", "subBlock": "子模块名（可选）", "shortTitle": "短标题20字以内", "profile": {"基本信息": {...}, "正在学什么": {...}, "正在做什么": {...}, "喜欢什么": {...}, "不喜欢什么": {...}, "喜欢的风格": {...}, "需求与偏好": {...}}}-->

规则：
- 必须使用 <!--MEMORY:...--> 格式，放在回复的最后一行
- summary: 一句话概括本段对话核心内容
- topics: 关键词数组，2-5个
- block: 记忆板块名（必填，如：学习板块、工作板块、生活板块、职业发展板块等；若已有板块则用已有名，否则新建；全库板块总数不得超过 10 个）
- subBlock: 子模块名（可选，如：数学、英语、编程）
- shortTitle: 用于文件名的短标题，20字以内，必填
- profile: 只填本段对话能推断出的用户信息，没有的不填
- 禁止使用「未分类」「其他」「通用」等泛化分类
- 这个注释对用户不可见，只用于系统记录`

/**
 * Call Tongyi API (streaming)
 * @param useVisionModel - 是否使用视觉模型（多模态截图时），默认根据 messages 中是否有 image 自动判断
 */
export async function callTongyiAPI(
  messages: ChatMessage[],
  onChunk?: (chunk: string, content: string) => void,
  useVisionModel = false
): Promise<string> {
  const config = await getConfig()

  if (!config.apiKey) {
    throw new Error('请先配置 API Key，在设置中填写您的通义千问 API Key')
  }

  const hasImages = messages.some(
    (m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'image_url')
  )
  // 有图片时必须使用视觉模型，避免回退到纯文本模型导致 API 失败
  const visionModel = config.visionModel?.trim() || 'qwen-vl-plus'
  const model =
    hasImages || useVisionModel ? visionModel : config.model

  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed: ${response.status} - ${errorText}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta
            if (onChunk) {
              onChunk(delta, fullContent)
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  return fullContent
}

/** 工具调用消息格式（OpenAI 兼容） */
type ToolCallMessage = {
  role: 'assistant'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
}
type ToolResultMessage = {
  role: 'tool'
  tool_call_id: string
  content: string
}

/** 用于 API 的扩展消息类型 */
export type ChatMessageWithTools = ChatMessage | ToolCallMessage | ToolResultMessage

/**
 * 执行带 MCP 工具调用的通义 API（支持 tool_calls 循环）
 */
export async function callTongyiAPIWithTools(
  messages: ChatMessage[],
  tools: OpenAITool[],
  onChunk: (chunk: string, content: string) => void,
  mcpCallTool: (name: string, args: Record<string, unknown>) => Promise<string>
): Promise<string> {
  const config = await getConfig()
  if (!config.apiKey) {
    throw new Error('请先配置 API Key，在设置中填写您的通义千问 API Key')
  }

  const hasImages = messages.some(
    (m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'image_url')
  )
  const visionModel = config.visionModel?.trim() || 'qwen-vl-plus'
  const model = hasImages ? visionModel : config.model

  let currentMessages: ChatMessageWithTools[] = [...messages]
  let fullContent = ''

  const doOneRound = async (): Promise<{
    content: string
    toolCalls: Array<{ id: string; name: string; arguments: string }> | null
  }> => {
    const body: Record<string, unknown> = {
      model,
      messages: currentMessages,
      stream: true,
      tools,
    }

    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed: ${response.status} - ${errorText}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    const toolCallsAcc: Record<
      number,
      { id: string; name: string; arguments: string }
    > = {}

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta
          if (!delta) continue

          if (delta.content) {
            content += delta.content
            fullContent += delta.content
            onChunk(delta.content, fullContent)
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index
              if (!(idx in toolCallsAcc)) {
                toolCallsAcc[idx] = {
                  id: tc.id || `call_${idx}`,
                  name: '',
                  arguments: '',
                }
              }
              if (tc.function?.name) toolCallsAcc[idx].name += tc.function.name
              if (tc.function?.arguments)
                toolCallsAcc[idx].arguments += tc.function.arguments
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    const toolCallsList = Object.keys(toolCallsAcc).length
      ? (Object.values(toolCallsAcc) as Array<{
          id: string
          name: string
          arguments: string
        }>)
      : null

    return { content, toolCalls: toolCallsList }
  }

  let round = 0
  const maxRounds = 10
  while (round < maxRounds) {
    const result = await doOneRound()
    if (!result.toolCalls || result.toolCalls.length === 0) {
      return fullContent
    }

    const assistantMsg: ToolCallMessage = {
      role: 'assistant',
      content: result.content || null,
      tool_calls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    }
    currentMessages.push(assistantMsg)

    for (const tc of result.toolCalls) {
      let args: Record<string, unknown> = {}
      try {
        if (tc.arguments.trim()) {
          args = JSON.parse(tc.arguments) as Record<string, unknown>
        }
      } catch {
        // ignore parse error
      }
      const toolResult = await mcpCallTool(tc.name, args)
      currentMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: toolResult,
      } as ToolResultMessage)
    }
    round++
  }

  return fullContent
}

/**
 * Call Tongyi API (non-streaming) for analysis tasks
 */
async function callTongyiAPISync(messages: ChatMessage[]): Promise<string> {
  const config = await getConfig()

  if (!config.apiKey) {
    throw new Error('请先配置 API Key，在设置中填写您的通义千问 API Key')
  }

  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: 'qwen-turbo', // Use faster model for analysis
      messages,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  const json = await response.json()
  return json.choices?.[0]?.message?.content || ''
}

// ============ Smart Search Logic ============

/**
 * Result from AI search analysis
 */
export interface SmartSearchResult {
  needsSearch: boolean
  searchQuery: string | null
  reason: string
  confidence: number
}

/**
 * Prompt for AI to analyze if search is needed
 */
const SEARCH_ANALYSIS_PROMPT = `You are a search decision assistant. Analyze the user's question and determine if a web search would help answer it better.

Respond in JSON format only:
{
  "needsSearch": true/false,
  "searchQuery": "optimized search query" or null,
  "reason": "brief explanation",
  "confidence": 0.0-1.0
}

Criteria for needing search:
1. Questions about current events, news, or time-sensitive information
2. Technical/professional topics that require specific, accurate information
3. Niche subjects where general knowledge might be insufficient
4. Questions asking for specific facts, statistics, or data
5. Questions about recent developments in any field

Criteria for NOT needing search:
1. Simple conversational questions
2. Requests for general explanations of well-known concepts
3. Creative writing or brainstorming requests
4. Personal opinions or preferences
5. Programming help for common patterns
6. Math calculations or logical reasoning

If search is needed, create an optimized search query by:
- Extracting key concepts and terms
- Combining with relevant technical terms
- Adding context keywords if helpful
- Format: "keyword1 + keyword2 + context"

Examples:
- "What is React?" → No search needed (well-known concept)
- "What are the latest features in React 19?" → Search needed, query: "React 19 new features 2025"
- "How to implement OAuth in Next.js" → May need search for latest best practices
- "What is the weather today?" → Search needed, query: "current weather"
- "Write me a poem about cats" → No search needed`

/**
 * Use AI to determine if search is needed (Smart Search)
 */
export async function analyzeSearchNeed(message: string): Promise<SmartSearchResult> {
  // Quick check for explicit search commands
  if (message.startsWith('/search ') || message.startsWith('/搜索 ')) {
    const query = message.replace(/^\/(search|搜索)\s+/, '').trim()
    return {
      needsSearch: true,
      searchQuery: query,
      reason: 'User explicitly requested search',
      confidence: 1.0,
    }
  }

  // Quick heuristic check for obvious cases (save API calls)
  const noSearchPatterns = [
    /^(hi|hello|hey|你好|嗨)/i,
    /^(thanks|thank you|谢谢)/i,
    /^(yes|no|ok|okay|好的|是的|不是)/i,
  ]
  
  if (noSearchPatterns.some(p => p.test(message.trim()))) {
    return {
      needsSearch: false,
      searchQuery: null,
      reason: 'Simple conversational message',
      confidence: 0.95,
    }
  }

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: SEARCH_ANALYSIS_PROMPT },
      { role: 'user', content: message },
    ]

    const response = await callTongyiAPISync(messages)
    
    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      return {
        needsSearch: Boolean(result.needsSearch),
        searchQuery: result.searchQuery || null,
        reason: result.reason || 'AI analysis',
        confidence: typeof result.confidence === 'number' ? result.confidence : 0.7,
      }
    }
  } catch (e) {
    console.warn('[Madoka BG] Smart search analysis failed:', e)
  }

  // Fallback to keyword-based detection
  return shouldSearchFallback(message)
}

/**
 * Extract and optimize search keywords from user message
 */
export async function extractSearchKeywords(message: string): Promise<string> {
  const prompt = `Extract the key search terms from this message and create an optimized search query.

Message: "${message}"

Rules:
1. Focus on the main topic and specific terms
2. Remove filler words and conversational elements
3. Add relevant context terms if helpful
4. Keep it concise (3-6 key terms)
5. Return ONLY the search query, nothing else

Example:
Message: "I want to know about the latest developments in AI self-learning systems"
Query: AI self-learning systems latest developments 2025`

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: message },
    ]

    const response = await callTongyiAPISync(messages)
    return response.trim() || message
  } catch (e) {
    console.warn('[Madoka BG] Keyword extraction failed:', e)
    return message
  }
}

/**
 * Fallback keyword-based search detection
 */
function shouldSearchFallback(message: string): SmartSearchResult {
  // Keywords that suggest search is needed
  const searchKeywords = [
    // Time-sensitive
    '最新', '今天', '现在', '当前', '新闻', '消息', 'latest', 'current', 'today', 'recent', 'news',
    // Questions about facts
    '怎么样', '多少钱', '价格', '天气', '股票', 'how much', 'price', 'weather', 'stock',
    // Learning/research
    '什么是', '如何', '教程', '方法', 'what is', 'how to', 'tutorial', 'guide',
    // Specific/technical
    '官方', '文档', 'documentation', 'official', 'spec', 'specification',
  ]

  const lowerMessage = message.toLowerCase()
  const matchedKeyword = searchKeywords.find(kw => lowerMessage.includes(kw.toLowerCase()))

  if (matchedKeyword) {
    return {
      needsSearch: true,
      searchQuery: message,
      reason: `Contains search indicator: "${matchedKeyword}"`,
      confidence: 0.6,
    }
  }

  return {
    needsSearch: false,
    searchQuery: null,
    reason: 'No search indicators found',
    confidence: 0.5,
  }
}

/**
 * Legacy function for backward compatibility
 */
export function shouldSearch(message: string): boolean {
  if (message.startsWith('/search ') || message.startsWith('/搜索 ')) {
    return true
  }

  const searchKeywords = [
    '最新', '今天', '现在', '当前', '新闻', '消息',
    '怎么样', '多少钱', '价格', '天气', '股票',
    '什么是', '如何', '教程', '方法',
  ]

  return searchKeywords.some((kw) => message.includes(kw))
}

// ============ Condense Question ============

function formatChatHistory(history: HistoryMessage[]): string {
  if (!Array.isArray(history) || history.length === 0) return ''
  const recent = history.slice(-CONDENSE_MAX_HISTORY_TURNS * 2)
  return recent
    .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${(m.content || '').slice(0, 150)}`)
    .join('\n')
}

function isFollowUp(question: string, history: HistoryMessage[]): boolean {
  if (!history?.length) return false
  const q = (question || '').trim()
  if (q.length > CONDENSE_FOLLOW_UP_MAX_LEN) return false
  return FOLLOW_UP_INDICATORS.test(q) || q.length <= 8
}

/**
 * 将追问转为独立可搜索问题（结合对话历史）
 * 若非追问或调用失败，返回原 question
 */
export async function condenseQuestion(
  question: string,
  history: HistoryMessage[] = []
): Promise<string> {
  if (!isFollowUp(question, history)) {
    return question
  }
  const chatHistoryStr = formatChatHistory(history)
  const prompt = CONDENSE_QUESTION_PROMPT.replace('{chat_history}', chatHistoryStr).replace(
    '{question}',
    question
  )
  try {
    const response = await callTongyiAPISync([{ role: 'user', content: prompt }])
    const standalone = (response || '').trim()
    return standalone || question
  } catch (e) {
    console.warn('[Madoka BG] Condense question failed:', (e as Error).message)
    return question
  }
}

// ============ Prompt Optimization ============

/**
 * Call Tongyi API for prompt optimization (non-streaming)
 * @param userInput - The user's input to optimize
 * @param systemPrompt - Optional custom system prompt (uses default if not provided)
 */
export async function callTongyiAPIForOptimize(userInput: string, systemPrompt?: string): Promise<string> {
  const config = await getConfig()

  if (!config.apiKey) {
    throw new Error('请先配置 API Key，在设置中填写您的通义千问 API Key')
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt || DEFAULT_OPTIMIZER_SYSTEM_CONTENT },
    { role: 'user', content: userInput },
  ]

  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed: ${response.status} - ${errorText}`)
  }

  const json = await response.json()

  // 检查 API 返回的错误
  if (json.error) {
    const errMsg = typeof json.error === 'string' ? json.error : json.error?.message || JSON.stringify(json.error)
    throw new Error(errMsg)
  }

  const content = json.choices?.[0]?.message?.content ?? ''
  if (!content || typeof content !== 'string') {
    throw new Error('API 返回内容为空或格式异常')
  }

  // 提取 markdown 代码块内容（支持 ```markdown 或 ``` 包裹）
  const codeBlockMatch = content.match(/```(?:markdown)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch) {
    const extracted = codeBlockMatch[1].trim()
    return extracted || content.trim()
  }

  return content.trim()
}

/**
 * Translate text segment using DeepLX API
 * Using multiple DeepLX services with fallback
 * Features: Free, no API key, no rate limits
 */
export async function translateTextSegment(
  text: string,
  targetLanguage: string = '中文'
): Promise<string> {
  // Language mapping for DeepLX
  const langMap: Record<string, string> = {
    '中文': 'ZH',
    '英语': 'EN',
    '英文': 'EN',
    '日语': 'JA',
    '韩语': 'KO',
    '法语': 'FR',
    '德语': 'DE',
    '西班牙语': 'ES',
    '俄语': 'RU',
  }

  const targetLang = langMap[targetLanguage] || 'ZH'

  // Multiple DeepLX services for fallback
  // Note: dplx.xi-xu.me removed - returns URL instead of translation
  const services = [
    'https://api.deeplx.org/translate',
    'https://deeplx.mingming.dev/translate',
  ]

  let lastError: Error | undefined

  for (const url of services) {
    const controller = new AbortController()
    // 8 second timeout per service
    const timeoutId = setTimeout(() => controller.abort(), 8000)

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

      // Validate response - check if it's a URL instead of translation
      const translatedText = json.data?.trim() ?? ''
      if (translatedText.startsWith('http://') || translatedText.startsWith('https://')) {
        throw new Error('Invalid response: received URL instead of translation')
      }

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
 * Translate multiple text segments with progress callback
 */
export async function translateSegments(
  segments: { index: number; text: string }[],
  targetLanguage: string = '中文',
  onProgress?: (current: number, total: number) => void
): Promise<{ index: number; original: string; translated: string }[]> {
  const results: { index: number; original: string; translated: string }[] = []
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    
    try {
      const translated = await translateTextSegment(segment.text, targetLanguage)
      results.push({
        index: segment.index,
        original: segment.text,
        translated,
      })
    } catch (e) {
      results.push({
        index: segment.index,
        original: segment.text,
        translated: `[Translation failed: ${(e as Error).message}]`,
      })
    }
    
    if (onProgress) {
      onProgress(i + 1, segments.length)
    }
    
    // Small delay between requests to avoid rate limiting
    if (i < segments.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  return results
}