import { db } from '@/db/database'
import type { ExportData, MemoryItem, TagItem } from '@/types'

const VERSION = '1.0'

export async function exportToJSON(): Promise<string> {
  const memories = await db.memories.toArray()
  const tags = await db.tags.toArray()
  const data: ExportData = {
    version: VERSION,
    memories,
    tags,
    exportedAt: Date.now()
  }
  return JSON.stringify(data, null, 2)
}

/** 仅导出指定对话下的记忆及这些记忆用到的标签 */
export async function exportConversationToJSON(conversationId: string): Promise<{ json: string; memoryCount: number }> {
  let memories: MemoryItem[]
  try {
    memories = await db.memories.where('conversationId').equals(conversationId).toArray()
  } catch {
    memories = (await db.memories.toArray()).filter((m) => (m.conversationId ?? '') === conversationId)
  }
  const tagIds = new Set<string>()
  for (const m of memories) {
    for (const t of m.tags ?? []) {
      if (t?.trim()) tagIds.add(t.trim())
    }
  }
  let tags: TagItem[] = []
  if (tagIds.size > 0) {
    const allTags = await db.tags.toArray()
    tags = allTags.filter((t) => t?.id && tagIds.has(t.id))
  }
  const data: ExportData & { conversationId?: string } = {
    version: VERSION,
    memories,
    tags,
    conversationId,
    exportedAt: Date.now()
  }
  return { json: JSON.stringify(data, null, 2), memoryCount: memories.length }
}

export async function importFromJSON(jsonStr: string): Promise<{ memories: number; tags: number }> {
  const data = JSON.parse(jsonStr) as ExportData
  if (!data.memories || !Array.isArray(data.memories)) throw new Error('Invalid export format')

  let memCount = 0
  let tagCount = 0

  for (const m of data.memories) {
    if (m?.id && m?.content) {
      try {
        await db.memories.put(m)
        memCount++
      } catch {
        // skip duplicates or invalid
      }
    }
  }
  for (const t of data.tags || []) {
    if (t?.id) {
      try {
        await db.tags.put(t)
        tagCount++
      } catch {
        // skip
      }
    }
  }

  return { memories: memCount, tags: tagCount }
}

export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
