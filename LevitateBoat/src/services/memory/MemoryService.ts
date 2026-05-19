import { MemoryRepo } from './MemoryRepo'
import type { MemoryItem } from '@/types'
import { generateId } from '@/utils/id'

const memoryRepo = new MemoryRepo()

export class MemoryService {
  async createMemory(params: {
    content: string
    title?: string
    summary?: string
    tags?: string[]
    type?: MemoryItem['type']
    url?: string
    domain?: string
    source?: MemoryItem['source']
    conversationId?: string
  }): Promise<MemoryItem> {
    return memoryRepo.create({
      content: params.content,
      title: params.title,
      summary: params.summary,
      tags: params.tags ?? [],
      type: params.type ?? 'fact',
      url: params.url ?? '',
      domain: params.domain ?? '',
      conversationId: params.conversationId ?? '',
      memoryStrength: 1,
      forgettingParams: {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
        lastReviewAt: Date.now()
      },
      source: params.source ?? 'manual'
    })
  }

  async getMemory(id: string): Promise<MemoryItem | undefined> {
    const m = await memoryRepo.getById(id)
    if (m) await memoryRepo.recordAccess(id)
    return m
  }

  async updateMemory(id: string, updates: Partial<MemoryItem>): Promise<void> {
    return memoryRepo.update(id, updates)
  }

  async deleteMemory(id: string): Promise<void> {
    return memoryRepo.delete(id)
  }

  async listMemories(limit = 50): Promise<MemoryItem[]> {
    return memoryRepo.list({ limit })
  }

  async searchMemories(
    query: string,
    options?: { tags?: string[]; limit?: number; conversationId?: string }
  ): Promise<MemoryItem[]> {
    const { extractKeywords } = await import('@/utils/text')
    const keywords = extractKeywords(query, 15)
    const limit = options?.limit ?? 20
    const cid = options?.conversationId
    let results: MemoryItem[] = []
    if (options?.tags?.length) {
      results = await memoryRepo.getByTags(options.tags, limit, cid)
    }
    if (keywords.length > 0) {
      const byKw = await memoryRepo.searchByKeywords(keywords, limit, cid)
      const seen = new Set(results.map((r) => r.id))
      for (const m of byKw) {
        if (!seen.has(m.id)) {
          seen.add(m.id)
          results.push(m)
        }
      }
    }
    if (results.length === 0 && keywords.length === 0 && !options?.tags?.length) {
      results = await memoryRepo.list({ limit, conversationId: cid })
    }
    return results.slice(0, limit)
  }

  async deleteMemoriesByConversationId(conversationId: string): Promise<void> {
    return memoryRepo.deleteByConversationId(conversationId)
  }

  async archiveLowStrength(): Promise<number> {
    return memoryRepo.archiveLowStrength()
  }
}
