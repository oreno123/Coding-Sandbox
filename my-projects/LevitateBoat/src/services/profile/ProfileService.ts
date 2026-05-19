import { db } from '@/db/database'
import type { UserProfile } from '@/types/profile'
import { DEFAULT_PROFILE } from '@/types/profile'

const PROFILE_ID = 'default'
const MAX_FREQUENT_QUERIES = 30
const MAX_QUERY_LEN = 50

function safeProfileTable() {
  try {
    return db?.userProfile
  } catch {
    return undefined
  }
}

function normalizeQuery(q: string): string {
  const s = q.trim().slice(0, MAX_QUERY_LEN)
  return s || '（空）'
}

export class ProfileService {
  async getOrCreate(): Promise<UserProfile> {
    const table = safeProfileTable()
    if (!table) {
      const now = Date.now()
      return { ...DEFAULT_PROFILE, updatedAt: now }
    }
    try {
      const existing = await table.get(PROFILE_ID)
      if (existing) {
        return { ...DEFAULT_PROFILE, ...existing, id: PROFILE_ID, updatedAt: existing.updatedAt }
      }
    } catch {
      /* DB 未就绪时退回默认 */
    }
    const now = Date.now()
    const profile: UserProfile = {
      ...DEFAULT_PROFILE,
      updatedAt: now
    }
    try {
      await table.add(profile)
    } catch {
      /* ignore */
    }
    return profile
  }

  async get(): Promise<UserProfile | undefined> {
    const table = safeProfileTable()
    if (!table) return undefined
    try {
      return await table.get(PROFILE_ID)
    } catch {
      return undefined
    }
  }

  async update(updates: Partial<Pick<UserProfile, 'replyStyle' | 'customInstruction' | 'customTags'>>): Promise<void> {
    const profile = await this.getOrCreate()
    const table = safeProfileTable()
    if (!table) return
    try {
      const updated: UserProfile = {
        ...profile,
        ...updates,
        id: PROFILE_ID,
        updatedAt: Date.now()
      }
      await table.put(updated)
    } catch {
      /* ignore */
    }
  }

  /** 记录一次用户提问（用于统计查询模式、时间分布） */
  async recordQuery(userInput: string, resultCount: number): Promise<void> {
    const profile = await this.getOrCreate()
    const query = normalizeQuery(userInput)
    const hour = new Date().getHours()
    const qp = profile.queryPatterns ?? DEFAULT_PROFILE.queryPatterns
    let list = [...(qp.frequentQueries ?? [])]
    const idx = list.findIndex((x) => x.query === query)
    if (idx >= 0) {
      list = [...list]
      list[idx] = { query, count: list[idx].count + 1 }
    } else {
      list = [{ query, count: 1 }, ...list]
    }
    list.sort((a, b) => b.count - a.count)
    list = list.slice(0, MAX_FREQUENT_QUERIES)
    const qtd = qp.queryTimeDistribution ?? {}
    const queryTimeDistribution = { ...qtd, [hour]: (qtd[hour] ?? 0) + 1 }
    const totalQueries = list.reduce((s, x) => s + x.count, 0)
    const avgResultCount = totalQueries <= 1 ? resultCount : ((qp.avgResultCount ?? 0) * (totalQueries - 1) + resultCount) / totalQueries
    const updated: UserProfile = {
      ...profile,
      queryPatterns: {
        frequentQueries: list,
        queryTimeDistribution,
        avgResultCount: Math.round(avgResultCount * 10) / 10
      },
      updatedAt: Date.now()
    }
    const table = safeProfileTable()
    if (table) {
      try {
        await table.put(updated)
      } catch {
        /* ignore */
      }
    }
  }

  /** 记录标签使用（提取记忆时保存的标签） */
  async recordTagUsage(tags: string[]): Promise<void> {
    if (tags.length === 0) return
    const profile = await this.getOrCreate()
    const table = safeProfileTable()
    if (!table) return
    const now = Date.now()
    const prefs = { ...(profile.tagPreferences ?? {}) }
    for (const tag of tags) {
      const t = tag.trim()
      if (!t) continue
      const cur = prefs[t] ?? { count: 0, lastUsed: 0, avgAccessCount: 0 }
      prefs[t] = {
        count: cur.count + 1,
        lastUsed: now,
        avgAccessCount: cur.avgAccessCount
      }
    }
    try {
      await table.put({
        ...profile,
        tagPreferences: prefs,
        updatedAt: now
      })
    } catch {
      /* ignore */
    }
  }

  /** 清空自动统计的「近期常问」 */
  async clearQueryPatterns(): Promise<void> {
    const profile = await this.getOrCreate()
    const table = safeProfileTable()
    if (!table) return
    try {
      await table.put({
        ...profile,
        queryPatterns: { ...DEFAULT_PROFILE.queryPatterns },
        updatedAt: Date.now()
      })
    } catch {
      /* ignore */
    }
  }

  /** 清空自动统计的「常用标签」 */
  async clearTagPreferences(): Promise<void> {
    const profile = await this.getOrCreate()
    const table = safeProfileTable()
    if (!table) return
    try {
      await table.put({
        ...profile,
        tagPreferences: {},
        updatedAt: Date.now()
      })
    } catch {
      /* ignore */
    }
  }

  /** 清空所有自动统计（常问 + 常用标签），保留回复风格、自定义说明、自定义标签 */
  async clearAutoStats(): Promise<void> {
    const profile = await this.getOrCreate()
    const table = safeProfileTable()
    if (!table) return
    try {
      await table.put({
        ...profile,
        queryPatterns: { ...DEFAULT_PROFILE.queryPatterns },
        tagPreferences: {},
        updatedAt: Date.now()
      })
    } catch {
      /* ignore */
    }
  }

  /** 重置整个用户画像为默认（含回复风格、自定义说明、自定义标签与所有统计） */
  async resetProfile(): Promise<void> {
    const table = safeProfileTable()
    if (!table) return
    try {
      const now = Date.now()
      await table.put({
        ...DEFAULT_PROFILE,
        id: PROFILE_ID,
        updatedAt: now
      })
    } catch {
      /* ignore */
    }
  }

  /** 将常用标签中前 N 个未在自定义标签里的，追加到自定义标签（供设置页「同步到自定义标签」使用） */
  async syncTopTagsToCustomTags(maxCount: number = 10): Promise<{ added: string[] }> {
    const profile = await this.getOrCreate()
    const custom = new Set((profile.customTags ?? []).filter((t) => t?.trim()))
    const top = Object.entries(profile.tagPreferences ?? {})
      .sort((a, b) => b[1].count - a[1].count)
      .map(([tag]) => tag.trim())
      .filter((t) => t && !custom.has(t))
      .slice(0, maxCount)
    if (top.length === 0) return { added: [] }
    const newCustomTags = [...(profile.customTags ?? []), ...top]
    await this.update({ customTags: newCustomTags })
    return { added: top }
  }

  /** 生成给 LLM 的用户画像摘要（风格 + 自定义说明 + 简要统计） */
  async getSummaryForLLM(): Promise<string> {
    try {
      const profile = await this.getOrCreate()
      const parts: string[] = []
      const styleDesc =
        profile.replyStyle === 'concise'
          ? '回复请尽量简洁、点到为止。'
          : profile.replyStyle === 'detailed'
            ? '回复请尽量详细、展开说明。'
            : '回复风格适中，该简则简、该详则详。'
      parts.push(`【用户偏好】${styleDesc}`)
      if (profile.customInstruction?.trim()) {
        parts.push(`【用户补充说明】${profile.customInstruction.trim()}`)
      }
      const topQueries = (profile.queryPatterns?.frequentQueries ?? []).slice(0, 5)
      if (topQueries.length > 0) {
        parts.push(
          `【近期常问】${topQueries.map((x) => x.query).join('；')}`
        )
      }
      const customTags = (profile.customTags ?? []).filter((t) => t?.trim())
      if (customTags.length > 0) {
        parts.push(`【用户常用标签】${customTags.join('、')}（回答与提取记忆时可参考）`)
      }
      return parts.join('\n')
    } catch {
      return ''
    }
  }
}

export const profileService = new ProfileService()
