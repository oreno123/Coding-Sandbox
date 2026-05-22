import { db } from '@/db/database'
import { generateId } from '@/utils/id'

/** 确保 DB 已打开并完成升级（侧栏/弹窗首次加载时调用） */
export async function ensureConversationsDb(): Promise<void> {
  try {
    await db.conversations.count()
  } catch {
    // 触发 DB 打开与升级，忽略错误
  }
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ConversationRecord {
  id: string
  messages: ConversationMessage[]
  memoryIds: string[]
  /** 用户新建时填的话题，作为标题 */
  title?: string
  /** 该对话偏好的回复风格 */
  preferredStyle?: string
  createdAt: number
  updatedAt: number
}

const TRIVIAL_FIRST_PHRASES = new Set([
  '你好', '在吗', '在', 'hi', 'hello', '？', '?', '哈', '喂', '嗯', '啊',
  '在不在', '有人吗', '请问', '帮忙', '帮个忙', '谢谢', '感谢'
])

const MAX_TITLE_LEN = 18

function isTrivial(s: string): boolean {
  const t = s.trim()
  if (t.length < 2) return true
  if (t.length <= 4 && TRIVIAL_FIRST_PHRASES.has(t.toLowerCase())) return true
  if (/^[?？。!！,，、\s]+$/.test(t)) return true
  return false
}

function toTitleCandidate(content: string, fromAssistant: boolean): string {
  let s = content.trim().replace(/\s+/g, ' ')
  if (fromAssistant) {
    s = s.replace(/^#+\s*/, '').replace(/\n.*/s, '').trim()
  }
  s = s.replace(/^[?？。!！,，、：:]\s*|\s*[?？。!！,，、]+$/g, '').trim()
  return s.slice(0, MAX_TITLE_LEN)
}

/** 对话标题：优先用首条「有内容」的用户句，否则用助手首句或截断首句 */
function getTitleFromMessages(messages: ConversationMessage[]): string {
  const userMessages = messages.filter((m) => m.role === 'user')
  const assistantMessages = messages.filter((m) => m.role === 'assistant')
  for (const m of userMessages) {
    const candidate = toTitleCandidate(m.content, false)
    if (candidate && !isTrivial(candidate)) {
      const truncated = m.content.trim().length > MAX_TITLE_LEN
      return candidate + (truncated ? '…' : '')
    }
  }
  const firstAssistant = assistantMessages[0]
  if (firstAssistant?.content) {
    const candidate = toTitleCandidate(firstAssistant.content, true)
    if (candidate) {
      const truncated = firstAssistant.content.trim().length > MAX_TITLE_LEN
      return candidate + (truncated ? '…' : '')
    }
  }
  const fallback = userMessages[0]?.content.trim().slice(0, MAX_TITLE_LEN)
  return fallback || '新对话'
}

function formatTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`
  if (diff < 86400_000 * 2) return '昨天'
  return new Date(ts).toLocaleDateString()
}

export async function listConversations(): Promise<
  { id: string; title: string; time: string; updatedAt: number }[]
> {
  try {
    if (!db?.conversations) return []
    let list: ConversationRecord[]
    try {
      list = await db.conversations.orderBy('updatedAt').reverse().toArray()
    } catch {
      // 若 orderBy('updatedAt') 不可用（如旧 DB 版本），则全表取回后按 updatedAt 排序
      const all = await db.conversations.toArray()
      list = all.slice().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    }
    return list.map((c) => ({
      id: c.id,
      title: (c as ConversationRecord & { title?: string }).title?.trim() || getTitleFromMessages(c.messages),
      time: formatTime(c.updatedAt),
      updatedAt: c.updatedAt
    }))
  } catch {
    return []
  }
}

export async function getConversation(id: string): Promise<ConversationRecord | undefined> {
  try {
    if (!db?.conversations) return undefined
    return await db.conversations.get(id)
  } catch {
    return undefined
  }
}

export async function createConversation(options?: { title?: string; preferredStyle?: string }): Promise<ConversationRecord> {
  const id = generateId()
  const now = Date.now()
  const record: ConversationRecord = {
    id,
    messages: [],
    memoryIds: [],
    title: options?.title?.trim() || undefined,
    preferredStyle: options?.preferredStyle?.trim() || undefined,
    createdAt: now,
    updatedAt: now
  }
  await db.conversations.add(record)
  return record
}

export async function updateConversation(
  id: string,
  updates: { messages?: ConversationMessage[]; memoryIds?: string[]; title?: string; preferredStyle?: string }
): Promise<void> {
  try {
    const existing = await db.conversations.get(id)
    if (!existing) return
    const updated: ConversationRecord = {
      ...existing,
      ...updates,
      id,
      updatedAt: Date.now()
    }
    await db.conversations.put(updated)
  } catch {
    // ignore
  }
}

export async function deleteConversation(
  id: string,
  onDeleteMemory?: (memoryId: string) => Promise<void>,
  onDeleteMemoriesByConversationId?: (conversationId: string) => Promise<void>
): Promise<void> {
  try {
    const conv = await db.conversations.get(id)
    if (!conv) return
    await db.conversations.delete(id)
    if (onDeleteMemoriesByConversationId) {
      await onDeleteMemoriesByConversationId(id).catch(() => {})
    }
    if (onDeleteMemory && conv.memoryIds?.length) {
      for (const mid of conv.memoryIds) {
        await onDeleteMemory(mid).catch(() => {})
      }
    }
  } catch {
    // ignore
  }
}
