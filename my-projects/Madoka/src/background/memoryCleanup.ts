/**
 * 基于 CleanupConfig 的手动预览/执行清理（与 cleanupEngine 规则清理互补）
 */

import type { Episode } from '../shared/memory-types'
import * as db from './memoryDb'
import { getCleanupConfig } from './cleanupConfigDb'

function calculateWeight(ep: Episode): number {
  const now = Date.now()
  const ageDays = (now - ep.createdAt) / (1000 * 60 * 60 * 24)
  const unaccessedDays = (now - ep.lastAccessed) / (1000 * 60 * 60 * 24)
  let weight =
    0.5 +
    0.5 * Math.exp(-0.02 * ageDays) * Math.exp(-0.05 * unaccessedDays)
  if (ep.pinned) weight = Math.max(weight, 0.9)
  if (ep.isLongTerm) weight = Math.max(weight, 0.65)
  return weight
}

export async function previewCleanup(percentage: number): Promise<{
  toDelete: Episode[]
  totalCount: number
  estimatedSize: number
}> {
  const episodes = await db.getAllEpisodes()
  const sorted = episodes
    .map((ep) => ({ ...ep, effectiveWeight: calculateWeight(ep) }))
    .sort((a, b) => a.effectiveWeight - b.effectiveWeight)
  const toDeleteCount = Math.floor(sorted.length * percentage)
  const toDelete = sorted.slice(0, toDeleteCount)
  const estimatedSize = toDelete.reduce((sum, ep) => sum + ep.content.length * 2, 0)
  return {
    toDelete,
    totalCount: episodes.length,
    estimatedSize,
  }
}

export async function executeCleanup(episodeIds: string[]): Promise<{
  deletedCount: number
  failed: string[]
}> {
  const result = {
    deletedCount: 0,
    failed: [] as string[],
  }
  for (const uid of episodeIds) {
    try {
      await db.deleteEpisode(uid)
      result.deletedCount++
    } catch {
      result.failed.push(uid)
    }
  }
  return result
}

export async function manualCleanup(percentage?: number): Promise<{
  preview: { toDelete: Episode[]; totalCount: number; estimatedSize: number }
  result?: { deletedCount: number; failed: string[] }
}> {
  const config = await getCleanupConfig()
  const effectivePercentage = percentage ?? config.cleanupPercentage
  const preview = await previewCleanup(effectivePercentage)
  return { preview }
}

export async function confirmManualCleanup(episodeIds: string[]): Promise<{
  deletedCount: number
  failed: string[]
}> {
  return executeCleanup(episodeIds)
}

export async function shouldAutoCleanup(): Promise<boolean> {
  const config = await getCleanupConfig()
  if (!config.enabled || !config.autoCleanup) return false
  const episodes = await db.getAllEpisodes()
  return episodes.length >= config.autoCleanupThreshold
}

export async function autoCleanup(): Promise<{
  triggered: boolean
  deletedCount: number
  remainingCount: number
}> {
  const shouldTrigger = await shouldAutoCleanup()
  if (!shouldTrigger) {
    return { triggered: false, deletedCount: 0, remainingCount: 0 }
  }
  const config = await getCleanupConfig()
  const { toDelete } = await previewCleanup(config.cleanupPercentage)
  const result = await executeCleanup(toDelete.map((ep) => ep.uid))
  const remaining = await db.getAllEpisodes()
  return {
    triggered: true,
    deletedCount: result.deletedCount,
    remainingCount: remaining.length,
  }
}
