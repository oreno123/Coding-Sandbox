/**
 * 记忆模块消息处理
 * 纯本地，无网络
 */

import type { Episode, MemorySettings, MemoryTagsFromLLM, CleanupLogEntry, ProfileUpdatesFromLLM, UserProfile, ObsidianSettings } from '../shared/memory-types'
import { normalizeBlock, isForbiddenBlock } from '../shared/block-canonical'
import * as db from './memoryDb'
import { computeWeight } from './memoryScoring'
import { runCleanup, runPressureCleanup } from './cleanupEngine'
import { runObsidianDeleteForEpisodes } from './obsidianSync'
import { analyzeContentForMemory } from './memoryContentAnalyzer'

function genUid(): string {
  return `ep-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export interface AddEpisodePayload {
  conversationId: string
  userContent: string
  assistantContent: string
  sourceUrl?: string
  pageTitle?: string
  tags?: MemoryTagsFromLLM
  /** 本段对话推断出的人物画像更新，将合并到本地画像表格 */
  profileUpdates?: ProfileUpdatesFromLLM
}

export async function memoryAddEpisode(payload: AddEpisodePayload): Promise<{ uid: string; episode?: Episode }> {
  const settings = await db.getMemorySettings()
  if (!settings.enabled) return { uid: '' }

  // Analyze content to determine if it's worth remembering
  const analysis = analyzeContentForMemory(payload.userContent, payload.assistantContent)
  console.log('[memoryWorker] Content analysis:', { score: analysis.score, isWorthRemembering: analysis.isWorthRemembering, reasons: analysis.reasons })
  
  if (!analysis.isWorthRemembering) {
    console.log('[memoryWorker] Content not worth remembering, skipping save')
    return { uid: '' }
  }

  const tags: MemoryTagsFromLLM = payload.tags || { shouldPersist: false }
  const uid = genUid()
  const now = Date.now()
  const content = `用户: ${payload.userContent}\n\n助手: ${payload.assistantContent}`
  const isLong = tags.memoryType === 'long' && tags.shouldPersist

  const ep: Episode = {
    uid,
    content,
    role: 'assistant',
    createdAt: now,
    lastAccessed: now,
    producerId: 'local',
    producerRole: 'assistant',
    weight: 0.6,
    metadata: {
      conversationId: payload.conversationId,
      sourceUrl: payload.sourceUrl,
      pageTitle: payload.pageTitle,
    },
    isLongTermCandidate: tags.shouldPersist ?? false,
    isLongTerm: isLong,
    pinned: false,
    syncToObsidian: settings.obsidianSyncEnabled,
    syncStatus: '',
    markdownPath: '',
    summary: tags.summary || '',
    topics: tags.topics || [],
    memoryType: tags.memoryType || 'short',
    personaSignals: tags.personaSignals || [],
    block: tags.block?.trim() ? (normalizeBlock(tags.block.trim()) || undefined) : undefined,
    subBlock: tags.subBlock?.trim() || undefined,
    shortTitle: tags.shortTitle?.trim().slice(0, 20) || undefined,
  }
  // 若 LLM 未判或返回「未分类/其他」，用同会话最近一条记忆的板块兜底
  if (!ep.block || isForbiddenBlock(ep.block)) {
    const sameConv = await db.getEpisodesByConversation(payload.conversationId)
    const withBlock = sameConv
      .filter((e) => e.block?.trim() && !isForbiddenBlock(e.block))
      .sort((a, b) => b.createdAt - a.createdAt)
    if (withBlock.length > 0) ep.block = withBlock[0].block
    else ep.block = undefined
  }
  ep.weight = computeWeight(ep)

  // 无可用标题（空或 uid 形）且无可用板块时：与同会话上一条合并为同一文档，避免产生乱码标题文件
  const noProperTitle =
    !ep.shortTitle?.trim() || (ep.shortTitle ? /^ep-\d+-[a-z0-9]+$/.test(ep.shortTitle.trim()) : true)
  const noProperBlock = !ep.block || isForbiddenBlock(ep.block)
  if (noProperTitle && noProperBlock) {
    const sameConv = await db.getEpisodesByConversation(payload.conversationId)
    const sorted = [...sameConv].sort((a, b) => b.createdAt - a.createdAt)
    if (sorted.length > 0) {
      const last = sorted[0]
      const mergedContent = last.content + '\n\n' + content
      const mergedSummary = last.summary + (tags.summary ? '；' + tags.summary : '')
      await db.updateEpisode(last.uid, { content: mergedContent, summary: mergedSummary, lastAccessed: now })
      if (settings.userProfileEnabled && payload.profileUpdates && Object.keys(payload.profileUpdates).length > 0) {
        await db.mergeUserProfile(payload.profileUpdates)
      }
      const updated = await db.getEpisode(last.uid)
      if (updated && ep.syncToObsidian) {
        return { uid: last.uid, episode: updated }
      }
      return { uid: last.uid }
    }
  }

  await db.addEpisode(ep)

  if (settings.userProfileEnabled && payload.profileUpdates && Object.keys(payload.profileUpdates).length > 0) {
    await db.mergeUserProfile(payload.profileUpdates)
  }

  // Obsidian 写入改由侧栏执行（句柄在侧栏有效），这里只标记待同步并返回 episode
  if (ep.syncToObsidian) {
    ep.markdownPath = `${uid}.md`
    ep.syncStatus = 'pending'
    await db.updateEpisode(uid, { syncStatus: ep.syncStatus, markdownPath: ep.markdownPath })
    return { uid, episode: ep }
  }

  return { uid }
}

export async function memoryQuery(opts: {
  conversationId?: string
  sourceUrl?: string
  limit?: number
  blocks?: string[]
}): Promise<{ episodes: Episode[] }> {
  const settings = await db.getMemorySettings()
  if (!settings.enabled) return { episodes: [] }

  const limit = opts.limit ?? settings.recallLimit
  const blocks = opts.blocks?.filter(Boolean)

  const list = await db.getEpisodesForRecall({
    sourceUrl: opts.sourceUrl,
    limit: Math.max(limit * 3, 200),
  })
  const currentConvId = opts.conversationId
  const currentConv = currentConvId ? list.filter((e) => e.metadata.conversationId === currentConvId) : []
  const others = currentConvId ? list.filter((e) => e.metadata.conversationId !== currentConvId) : list
  
  // If blocks are specified, filter by blocks; otherwise return recent memories
  const othersFiltered =
    blocks && blocks.length > 0
      ? others.filter((e) => e.block && blocks.includes(e.block))
      : others
  
  const combined = [...currentConv, ...othersFiltered]
  const scored = combined.map((ep) => ({ ...ep, score: ep.weight }))
  scored.sort((a, b) => b.lastAccessed - a.lastAccessed)
  return { episodes: scored.slice(0, limit) }
}

export async function memoryGetAll(): Promise<{ episodes: Episode[] }> {
  const list = await db.getAllEpisodes()
  list.sort((a, b) => b.createdAt - a.createdAt)
  return { episodes: list }
}

export async function memoryGetBlockList(): Promise<{ blocks: string[] }> {
  const list = await db.getAllEpisodes()
  const set = new Set<string>()
  for (const ep of list) {
    const raw = ep.block?.trim()
    if (raw) set.add(normalizeBlock(raw))
  }
  return { blocks: [...set].sort() }
}

export async function memoryUpdate(uid: string, updates: Partial<Episode>): Promise<{ success: boolean; episode?: Episode }> {
  const existing = await db.getEpisode(uid)
  if (!existing) return { success: false }
  const next = { ...existing, ...updates }
  next.weight = computeWeight(next)
  next.lastAccessed = Date.now()
  await db.updateEpisode(uid, next)

  // Obsidian 写入改由侧栏执行，这里只返回更新后的 episode 供侧栏写
  const settings = await db.getMemorySettings()
  if (settings.obsidianSyncEnabled && existing.syncToObsidian) {
    return { success: true, episode: next }
  }
  return { success: true }
}

export async function memoryUpdateEpisodeSyncStatus(
  uid: string,
  syncStatus: 'success' | 'failed' | 'retrying' | 'pending' | '',
  markdownPath?: string
): Promise<{ success: boolean }> {
  const existing = await db.getEpisode(uid)
  if (!existing) return { success: false }
  const updates: Partial<Episode> = { syncStatus: syncStatus as Episode['syncStatus'] }
  if (markdownPath !== undefined) updates.markdownPath = markdownPath
  await db.updateEpisode(uid, updates)
  return { success: true }
}

export async function memoryDelete(uid: string): Promise<{ success: boolean }> {
  const ep = await db.getEpisode(uid)
  if (!ep) return { success: false }
  await db.deleteEpisode(uid)
  try {
    await runObsidianDeleteForEpisodes([ep])
  } catch {
    /* ignore */
  }
  return { success: true }
}

export async function memoryGetEpisodesByConversation(conversationId: string): Promise<{ episodes: Episode[] }> {
  const episodes = await db.getEpisodesByConversation(conversationId)
  return { episodes }
}

export async function memoryDeleteByConversationId(conversationId: string): Promise<{ success: boolean; deleted: number }> {
  const episodes = await db.getEpisodesByConversation(conversationId)
  for (const ep of episodes) {
    await db.deleteEpisode(ep.uid)
  }
  return { success: true, deleted: episodes.length }
}

export async function memoryGetSettings(): Promise<MemorySettings> {
  return db.getMemorySettings()
}

export async function memorySaveSettings(settings: Partial<MemorySettings>): Promise<{ success: boolean }> {
  const current = await db.getMemorySettings()
  await db.saveMemorySettings({ ...current, ...settings })
  return { success: true }
}

export async function memoryRunCleanup(): Promise<{ deleted: number; uids: string[] }> {
  return runCleanup('manual')
}

export async function memoryGetCleanupLogs(limit: number): Promise<{ logs: CleanupLogEntry[] }> {
  const logs = await db.getCleanupLogs(limit)
  return { logs }
}

export async function memoryGetUserProfile(): Promise<{ profile: UserProfile | null }> {
  const profile = await db.getUserProfile()
  return { profile }
}

export async function memorySaveUserProfile(profile: UserProfile): Promise<{ success: boolean }> {
  await db.saveUserProfile({ ...profile, updatedAt: Date.now() })
  return { success: true }
}

export async function memoryCheckQuotaAndCleanup(): Promise<{ overQuota: boolean; deleted: number }> {
  const settings = await db.getMemorySettings()
  if (!settings.enabled) return { overQuota: false, deleted: 0 }

  let quotaBytes: number
  try {
    const est = await navigator.storage.estimate()
    const total = est.quota ?? 0
    const ratio = settings.quotaRatio
    quotaBytes = Math.floor(total * ratio)
    if (settings.quotaMaxMb > 0) {
      quotaBytes = Math.min(quotaBytes, settings.quotaMaxMb * 1024 * 1024)
    }
  } catch {
    return { overQuota: false, deleted: 0 }
  }

  const usage = await db.estimateEpisodesSize()
  if (usage <= quotaBytes) return { overQuota: false, deleted: 0 }

  const { deleted } = await runPressureCleanup()
  return { overQuota: deleted === 0, deleted }
}

export async function memoryGetObsidianSettings(): Promise<ObsidianSettings> {
  return db.getObsidianSettings()
}

export async function memorySaveObsidianSettings(settings: Partial<ObsidianSettings>): Promise<{ success: boolean }> {
  await db.saveObsidianSettings(settings)
  return { success: true }
}

/** 与记忆库 UI 一致：按大类展示名删除（含「未分类」） */
function episodeDisplayMainBlock(ep: Episode): string {
  return ep.block?.trim() || '未分类'
}

export async function memoryDeleteByMainBlock(
  mainBlock: string,
): Promise<{ success: boolean; deleted: number }> {
  const all = await db.getAllEpisodes()
  const toDelete = all.filter((e) => episodeDisplayMainBlock(e) === mainBlock)
  try {
    await runObsidianDeleteForEpisodes(toDelete)
  } catch {
    /* ignore */
  }
  for (const ep of toDelete) {
    await db.deleteEpisode(ep.uid)
  }
  return { success: true, deleted: toDelete.length }
}

export async function memoryExportEpisodes(
  uids: string[],
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const all = await db.getAllEpisodes()
    const set = new Set(uids)
    const selected = all.filter((e) => set.has(e.uid))
    const payload = {
      version: 1 as const,
      type: 'madoka_memory_export' as const,
      exportedAt: new Date().toISOString(),
      episodes: selected,
    }
    return { success: true, data: JSON.stringify(payload, null, 2) }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

function coerceImportedEpisode(raw: Record<string, unknown>): Episode | null {
  const uid = typeof raw.uid === 'string' ? raw.uid : ''
  if (!uid || typeof raw.content !== 'string') return null
  const now = Date.now()
  const md = raw.metadata && typeof raw.metadata === 'object' ? (raw.metadata as Episode['metadata']) : {}
  return {
    uid,
    content: raw.content,
    role: raw.role === 'user' || raw.role === 'assistant' || raw.role === 'system' ? raw.role : 'assistant',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    lastAccessed: typeof raw.lastAccessed === 'number' ? raw.lastAccessed : now,
    producerId: typeof raw.producerId === 'string' ? raw.producerId : 'import',
    producerRole: typeof raw.producerRole === 'string' ? raw.producerRole : 'assistant',
    weight: typeof raw.weight === 'number' ? raw.weight : 0.7,
    metadata: md,
    isLongTermCandidate: !!raw.isLongTermCandidate,
    isLongTerm: !!raw.isLongTerm,
    pinned: !!raw.pinned,
    syncToObsidian: !!raw.syncToObsidian,
    syncStatus:
      raw.syncStatus === 'success' ||
      raw.syncStatus === 'failed' ||
      raw.syncStatus === 'retrying' ||
      raw.syncStatus === 'pending'
        ? raw.syncStatus
        : '',
    markdownPath: typeof raw.markdownPath === 'string' ? raw.markdownPath : '',
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    topics: Array.isArray(raw.topics) ? (raw.topics as string[]) : [],
    memoryType: typeof raw.memoryType === 'string' ? raw.memoryType : 'short',
    personaSignals: Array.isArray(raw.personaSignals) ? (raw.personaSignals as string[]) : [],
    block: typeof raw.block === 'string' ? raw.block : undefined,
    subBlock: typeof raw.subBlock === 'string' ? raw.subBlock : undefined,
    shortTitle: typeof raw.shortTitle === 'string' ? raw.shortTitle : undefined,
  }
}

export async function memoryImportEpisodes(
  jsonStr: string,
): Promise<{ success: boolean; added?: number; skipped?: number; error?: string }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return { success: false, error: '无效 JSON' }
  }
  const data = parsed as { episodes?: unknown[] }
  if (!Array.isArray(data.episodes)) {
    return { success: false, error: '缺少 episodes 数组' }
  }
  const existing = await db.getAllEpisodes()
  const existingUids = new Set(existing.map((e) => e.uid))
  let added = 0
  let skipped = 0
  for (const item of data.episodes) {
    if (!item || typeof item !== 'object') {
      skipped++
      continue
    }
    const ep = coerceImportedEpisode(item as Record<string, unknown>)
    if (!ep || existingUids.has(ep.uid)) {
      skipped++
      continue
    }
    ep.weight = computeWeight(ep)
    await db.addEpisode(ep)
    existingUids.add(ep.uid)
    added++
  }
  return { success: true, added, skipped }
}
