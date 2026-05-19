import { db } from '@/db/database'
import type { MemoryItem, TagItem } from '@/types'
import { generateId } from '@/utils/id'
import { extractKeywords } from '@/utils/text'
import { STORES, MEMORY_STRENGTH_THRESHOLD } from '@/constants/config'

const now = () => Date.now()

function safeDb() {
  try {
    return db?.memories ? db : undefined
  } catch {
    return undefined
  }
}

export class MemoryRepo {
  async create(item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt' | 'accessedAt' | 'accessCount'>): Promise<MemoryItem> {
    const memory: MemoryItem = {
      ...item,
      id: generateId(),
      conversationId: item.conversationId ?? '',
      createdAt: now(),
      updatedAt: now(),
      accessedAt: now(),
      accessCount: 0
    }
    await db.memories.add(memory)
    await this.updateSearchIndex(memory)
    await this.upsertTags(memory.tags)
    for (const tag of memory.tags) {
      const t = tag.trim()
      if (t) await db.memoryTag.add({ memoryId: memory.id, tagId: t })
    }
    return memory
  }

  async getById(id: string): Promise<MemoryItem | undefined> {
    const d = safeDb()
    if (!d?.memories) return undefined
    try {
      return await d.memories.get(id)
    } catch {
      return undefined
    }
  }

  async update(id: string, updates: Partial<MemoryItem>): Promise<void> {
    const existing = await db.memories.get(id)
    if (!existing) return
    const updated: MemoryItem = {
      ...existing,
      ...updates,
      id,
      updatedAt: now()
    }
    await db.memories.put(updated)
    if (updates.content !== undefined) {
      await this.updateSearchIndex(updated)
    }
    if (updates.tags) {
      await this.upsertTags(updates.tags)
      await db.memoryTag.where('memoryId').equals(id).delete()
      for (const tag of updates.tags) {
        const t = tag.trim()
        if (t) await db.memoryTag.add({ memoryId: id, tagId: t })
      }
    }
  }

  async delete(id: string): Promise<void> {
    await db.memories.delete(id)
    await db.memoryTag.where('memoryId').equals(id).delete()
  }

  /** 删除某对话下的全部记忆（删除对话时调用，用户画像不删） */
  async deleteByConversationId(conversationId: string): Promise<void> {
    const d = safeDb()
    if (!d?.memories) return
    try {
      let toDelete: MemoryItem[]
      try {
        toDelete = await d.memories.where('conversationId').equals(conversationId).toArray()
      } catch {
        toDelete = (await d.memories.toArray()).filter((m) => (m.conversationId ?? '') === conversationId)
      }
      for (const m of toDelete) await this.delete(m.id)
    } catch {
      /* ignore */
    }
  }

  async list(options?: { limit?: number; offset?: number; conversationId?: string }): Promise<MemoryItem[]> {
    const d = safeDb()
    if (!d?.memories) return []
    try {
      const limit = options?.limit ?? 100
      const offset = options?.offset ?? 0
      let list: MemoryItem[]
      if (options?.conversationId !== undefined && options.conversationId !== '') {
        try {
          list = await d.memories
            .where('conversationId')
            .equals(options.conversationId)
            .orderBy('createdAt')
            .reverse()
            .offset(offset)
            .limit(limit)
            .toArray()
        } catch {
          list = (await d.memories.toArray())
            .filter((m) => (m.conversationId ?? '') === options.conversationId)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(offset, offset + limit)
        }
      } else {
        list = await d.memories.orderBy('createdAt').reverse().offset(offset).limit(limit).toArray()
      }
      return list
    } catch {
      return []
    }
  }

  async searchByKeywords(keywords: string[], limit = 20, conversationId?: string): Promise<MemoryItem[]> {
    const d = safeDb()
    if (!d?.memories) return []
    if (keywords.length === 0) return this.list({ limit, conversationId })
    const memoryIdScores = new Map<string, number>()
    try {
      for (const kw of keywords) {
        const entry = d.searchIndex ? await d.searchIndex.get(kw.toLowerCase()) : undefined
        if (entry) {
          for (const mid of entry.memoryIds) {
            memoryIdScores.set(mid, (memoryIdScores.get(mid) ?? 0) + 1)
          }
        }
      }
      const sorted = [...memoryIdScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit * 2)
      const results: MemoryItem[] = []
      for (const [id] of sorted) {
        const m = await d.memories.get(id)
        if (!m) continue
        if (conversationId !== undefined && (m.conversationId ?? '') !== conversationId) continue
        results.push(m)
        if (results.length >= limit) break
      }
      return results
    } catch {
      return []
    }
  }

  async searchByVector(queryEmbedding: number[], topK = 10): Promise<MemoryItem[]> {
    const all = await db.memories.toArray()
    const withEmbedding = all.filter((m) => m.embedding && m.embedding.length > 0) as (MemoryItem & { embedding: number[] })[]
    if (withEmbedding.length === 0) return []
    const scored = withEmbedding.map((m) => ({
      memory: m,
      score: cosineSimilarity(queryEmbedding, m.embedding)
    }))
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK).map((s) => s.memory)
  }

  async getByTags(tags: string[], limit = 20, conversationId?: string): Promise<MemoryItem[]> {
    if (tags.length === 0) return this.list({ limit, conversationId })
    const ids = new Set<string>()
    for (const tagId of tags) {
      const relations = await db.memoryTag.where('tagId').equals(tagId).toArray()
      for (const r of relations) ids.add(r.memoryId)
    }
    const results: MemoryItem[] = []
    for (const id of ids) {
      if (results.length >= limit) break
      const m = await db.memories.get(id)
      if (!m) continue
      if (conversationId !== undefined && (m.conversationId ?? '') !== conversationId) continue
      results.push(m)
    }
    return results
  }

  async archiveLowStrength(): Promise<number> {
    const low = await db.memories.where('memoryStrength').below(MEMORY_STRENGTH_THRESHOLD).toArray()
    for (const m of low) {
      await db.archivedMemories.add(m)
      await this.delete(m.id)
    }
    return low.length
  }

  async recordAccess(id: string): Promise<void> {
    const m = await db.memories.get(id)
    if (!m) return
    await this.update(id, {
      accessedAt: now(),
      accessCount: m.accessCount + 1
    })
  }

  private async updateSearchIndex(memory: MemoryItem): Promise<void> {
    const keywords = extractKeywords(memory.content + ' ' + (memory.title ?? ''), 50)
    for (const word of keywords) {
      const w = word.toLowerCase()
      const entry = await db.searchIndex.get(w)
      const ids = new Set(entry?.memoryIds ?? [])
      ids.add(memory.id)
      await db.searchIndex.put({ word: w, memoryIds: [...ids] })
    }
  }

  private async upsertTags(tags: string[]): Promise<void> {
    const ts = now()
    for (const tag of tags) {
      const t = tag.trim()
      if (!t) continue
      const existing = await db.tags.get(t)
      if (existing) {
        await db.tags.update(t, { count: existing.count + 1, lastUsed: ts })
      } else {
        await db.tags.add({ id: t, count: 1, lastUsed: ts })
      }
    }
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
