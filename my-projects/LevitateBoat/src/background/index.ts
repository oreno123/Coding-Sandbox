import { db } from '@/db/database'
import { ChatService } from '@/services/chat'
import { MemoryService } from '@/services/memory'
import { profileService } from '@/services/profile'
import { exportToJSON, exportConversationToJSON, importFromJSON } from '@/services/exportImport'
import { getLLMConfig, setLLMConfig } from '@/services/llm'

const chatService = new ChatService()
const memoryService = new MemoryService()

// 点击扩展图标时打开浏览器侧边栏（Side Panel）
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

chrome.runtime.onMessage.addListener(
  (
    msg: { type: string; payload?: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    handleMessage(msg).then(sendResponse).catch((e) => sendResponse({ error: String(e) }))
    return true
  }
)

async function handleMessage(msg: { type: string; payload?: unknown }): Promise<unknown> {
  const { type, payload } = msg

  switch (type) {
    case 'chat': {
      const p = payload as {
        input: string
        history: { role: string; content: string }[]
        conversationId?: string
        preferredStyle?: string
      }
      const result = await chatService.chat(p.input, p.history || [], {
        conversationId: p.conversationId,
        preferredStyle: p.preferredStyle
      })
      return result
    }
    case 'chatStream': {
      const p = payload as {
        input: string
        history: { role: string; content: string }[]
        conversationId?: string
        preferredStyle?: string
      }
      const { memoryIds } = await chatService.chatStream(p.input, p.history || [], (chunk) => {
        chrome.runtime.sendMessage({ type: 'chatChunk', chunk }).catch(() => {})
      }, { conversationId: p.conversationId, preferredStyle: p.preferredStyle })
      return { memoryIds }
    }
    case 'extractMemories': {
      const p = payload as { userInput: string; assistantReply: string; conversationId?: string }
      const items = await chatService.extractMemories(p.userInput, p.assistantReply)
      const saved = await chatService.saveExtractedMemories(items, 'conversation', p.conversationId)
      const allTags = saved.flatMap((m) => m.tags || [])
      if (allTags.length) profileService.recordTagUsage(allTags).catch(() => {})
      return { extracted: items.length, saved: saved.length }
    }
    case 'memory:deleteByConversationId': {
      const { conversationId } = payload as { conversationId: string }
      await memoryService.deleteMemoriesByConversationId(conversationId)
      return { ok: true }
    }
    case 'memory:getCount':
      return db.memories.count()
    case 'memory:create': {
      const p = payload as { content: string; title?: string; tags?: string[]; type?: string }
      return memoryService.createMemory({
        content: p.content,
        title: p.title,
        tags: p.tags,
        type: (p.type as 'fact' | 'preference' | 'event') || 'fact',
        url: '',
        domain: ''
      })
    }
    case 'memory:list': {
      return memoryService.listMemories()
    }
    case 'memory:search': {
      const { query, tags, limit } = payload as { query?: string; tags?: string[]; limit?: number }
      return memoryService.searchMemories(query || '', { tags, limit })
    }
    case 'memory:delete': {
      const { id } = payload as { id: string }
      await memoryService.deleteMemory(id)
      return { ok: true }
    }
    case 'export': {
      const json = await exportToJSON()
      return { json }
    }
    case 'export:byConversationId': {
      const { conversationId } = payload as { conversationId: string }
      if (!conversationId) return { error: 'Missing conversationId' }
      const { json, memoryCount } = await exportConversationToJSON(conversationId)
      return { json, memoryCount }
    }
    case 'import': {
      const { json } = payload as { json: string }
      return importFromJSON(json)
    }
    case 'llm:getConfig':
      return getLLMConfig()
    case 'llm:setConfig':
      await setLLMConfig((payload || {}) as Record<string, unknown>)
      return { ok: true }
    case 'profile:get':
      return profileService.getOrCreate()
    case 'profile:update': {
      const p = payload as { replyStyle?: string; customInstruction?: string; customTags?: string[] }
      await profileService.update(p)
      return { ok: true }
    }
    case 'profile:clearQueryPatterns':
      await profileService.clearQueryPatterns()
      return { ok: true }
    case 'profile:clearTagPreferences':
      await profileService.clearTagPreferences()
      return { ok: true }
    case 'profile:clearAutoStats':
      await profileService.clearAutoStats()
      return { ok: true }
    case 'profile:reset':
      await profileService.resetProfile()
      return { ok: true }
    case 'profile:syncTopTagsToCustom': {
      const max = (payload as { maxCount?: number })?.maxCount ?? 10
      return profileService.syncTopTagsToCustomTags(max)
    }
    default:
      return { error: `Unknown message type: ${type}` }
  }
}
