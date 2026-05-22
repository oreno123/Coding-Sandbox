import { MemoryService } from '@/services/memory'
import { profileService } from '@/services/profile'
import { createLLMClient } from '@/services/llm'
import type { ChatMessage, MemoryItem } from '@/types'
import { DEFAULT_TOP_K } from '@/constants/config'

const memoryService = new MemoryService()

const SYSTEM_PROMPT_BASE = `你是基于用户本地记忆的个人助手。你会收到一些相关记忆作为上下文。
请根据记忆和对话历史回答用户问题。如果记忆中没有相关信息，请基于常识回答。`

function formatMemories(memories: MemoryItem[]): string {
  if (memories.length === 0) return '（暂无相关记忆）'
  return memories
    .map((m, i) => `[记忆${i + 1}] ${m.title ? m.title + ': ' : ''}${m.content}`)
    .join('\n\n')
}

export interface ChatResult {
  reply: string
  memoryIds: string[]
}

function styleHint(preferredStyle?: string): string {
  if (!preferredStyle?.trim()) return ''
  const s = preferredStyle.trim().toLowerCase()
  if (s === '简洁' || s === 'concise') return '【本对话偏好】回复请尽量简洁、点到为止。\n'
  if (s === '详细' || s === 'detailed') return '【本对话偏好】回复请尽量详细、展开说明。\n'
  if (s === '适中' || s === 'balanced') return '【本对话偏好】回复风格适中。\n'
  return `【本对话偏好】${preferredStyle}\n`
}

export class ChatService {
  async chat(
    userInput: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    options?: { conversationId?: string; preferredStyle?: string }
  ): Promise<ChatResult> {
    const memories = await memoryService.searchMemories(userInput, {
      limit: DEFAULT_TOP_K,
      conversationId: options?.conversationId
    })
    const memoryIds = memories.map((m) => m.id)
    profileService.recordQuery(userInput, memories.length).catch(() => {})

    let profileSummary = ''
    try {
      profileSummary = await profileService.getSummaryForLLM()
    } catch {
      /* 画像未就绪时继续对话 */
    }
    const conversationStyle = styleHint(options?.preferredStyle)
    const context = formatMemories(memories)
    const systemContent = `${SYSTEM_PROMPT_BASE}\n\n${conversationStyle}${profileSummary ? profileSummary + '\n\n' : ''}【相关记忆】\n${context}`

    const messages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...history.slice(-6).map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: userInput }
    ]

    const llm = await createLLMClient()
    const reply = await llm.generate(messages)

    return { reply, memoryIds }
  }

  async chatStream(
    userInput: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    onChunk: (text: string) => void,
    options?: { conversationId?: string; preferredStyle?: string }
  ): Promise<{ memoryIds: string[] }> {
    const memories = await memoryService.searchMemories(userInput, {
      limit: DEFAULT_TOP_K,
      conversationId: options?.conversationId
    })
    const memoryIds = memories.map((m) => m.id)
    profileService.recordQuery(userInput, memories.length).catch(() => {})

    let profileSummary = ''
    try {
      profileSummary = await profileService.getSummaryForLLM()
    } catch {
      /* 画像未就绪时继续对话 */
    }
    const conversationStyle = styleHint(options?.preferredStyle)
    const context = formatMemories(memories)
    const systemContent = `${SYSTEM_PROMPT_BASE}\n\n${conversationStyle}${profileSummary ? profileSummary + '\n\n' : ''}【相关记忆】\n${context}`

    const messages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...history.slice(-6).map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: userInput }
    ]

    const llm = await createLLMClient()
    await llm.generateStream!(messages, onChunk)
    return { memoryIds }
  }

  async extractMemories(userInput: string, assistantReply: string): Promise<Array<{ content: string; type: string; tags: string[] }>> {
    const llm = await createLLMClient()
    let customTagsHint = ''
    try {
      const profile = await profileService.getOrCreate()
      const customTags = (profile.customTags ?? []).filter((t) => t?.trim())
      if (customTags.length > 0) {
        customTagsHint = `\n建议优先使用的标签（可从以下选择或自拟）：${customTags.join('、')}\n`
      }
    } catch {
      /* 画像未就绪时继续 */
    }
    const prompt = `从以下对话中提取值得长期记忆的信息。只提取事实、偏好、重要事件。每行一条，格式：内容|类型(fact/preference/event)|标签(逗号分隔)
若无可提取则回复：无
${customTagsHint}
用户: ${userInput}
助手: ${assistantReply}

提取结果：`

    const messages: ChatMessage[] = [{ role: 'user', content: prompt }]
    const result = await llm.generate(messages)
    if (!result || result.trim() === '无' || result.toLowerCase().includes('无')) return []

    const lines = result.split('\n').filter((l) => l.trim())
    const extracted: Array<{ content: string; type: string; tags: string[] }> = []
    for (const line of lines) {
      const parts = line.split('|').map((p) => p.trim())
      if (parts.length >= 2) {
        extracted.push({
          content: parts[0],
          type: ['fact', 'preference', 'event'].includes(parts[1]) ? parts[1] : 'fact',
          tags: parts[2] ? parts[2].split(',').map((t) => t.trim()).filter(Boolean) : []
        })
      }
    }
    return extracted
  }

  async saveExtractedMemories(
    items: Array<{ content: string; type: string; tags: string[] }>,
    source: MemoryItem['source'] = 'conversation',
    conversationId?: string
  ): Promise<MemoryItem[]> {
    const saved: MemoryItem[] = []
    for (const item of items) {
      const m = await memoryService.createMemory({
        content: item.content,
        tags: item.tags,
        type: item.type as MemoryItem['type'],
        url: '',
        domain: '',
        source,
        conversationId
      })
      saved.push(m)
    }
    return saved
  }
}
