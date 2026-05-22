/**
 * 智能过期记忆清理
 * 保留规则优先，满足任一保留则不删；清理规则全部满足才删
 */

import type { Episode, CleanupLogEntry } from '../shared/memory-types'
import * as db from './memoryDb'
import { computeWeight } from './memoryScoring'
import { runObsidianDeleteForEpisodes } from './obsidianSync'

const CLEANUP_TIMEOUT_MS = 30000
const MAX_RETRIES = 3

export async function runCleanup(reason: string): Promise<{ deleted: number; uids: string[] }> {
  const settings = await db.getMemorySettings()
  if (!settings.enabled) return { deleted: 0, uids: [] }

  const deadline = Date.now() + CLEANUP_TIMEOUT_MS
  const all = await db.getAllEpisodes()
  const now = Date.now()
  const retainCreatedMs = settings.retainCreatedDays * 86400000
  const retainAccessedMs = settings.retainAccessedDays * 86400000
  const cleanupCreatedMs = settings.cleanupCreatedDays * 86400000

  const toDelete: Episode[] = []
  for (const ep of all) {
    if (Date.now() > deadline) break
    if (ep.pinned) continue
    const createdAgo = now - ep.createdAt
    const accessedAgo = now - ep.lastAccessed
    const weight = computeWeight(ep)

    const retain =
      createdAgo < retainCreatedMs ||
      weight >= settings.retainWeightMin ||
      accessedAgo < retainAccessedMs
    if (retain) continue

    const cleanup =
      createdAgo > cleanupCreatedMs &&
      weight < settings.cleanupWeightMax &&
      accessedAgo >= retainAccessedMs
    if (cleanup) toDelete.push(ep)
  }

  const uids: string[] = []
  for (const ep of toDelete) {
    if (Date.now() > deadline) break
    uids.push(ep.uid)
    await db.deleteEpisode(ep.uid)
    let retries = MAX_RETRIES
    while (retries > 0) {
      try {
        await runObsidianDeleteForEpisodes([ep])
        break
      } catch {
        retries--
      }
    }
  }

  if (uids.length > 0) {
    const log: CleanupLogEntry = {
      id: `log-${Date.now()}`,
      at: now,
      deletedCount: uids.length,
      uids,
      reason,
    }
    await db.addCleanupLog(log)
  }

  return { deleted: uids.length, uids }
}

/** 容量压力下的激进清理 */
export async function runPressureCleanup(): Promise<{ deleted: number; uids: string[] }> {
  const settings = await db.getMemorySettings()
  const all = await db.getAllEpisodes()
  const now = Date.now()
  const pressureCreatedMs = settings.pressureCreatedDays * 86400000

  const toDelete: Episode[] = []
  for (const ep of all) {
    if (ep.pinned) continue
    const createdAgo = now - ep.createdAt
    const weight = computeWeight(ep)
    if (createdAgo > pressureCreatedMs && weight < settings.pressureWeightMax) toDelete.push(ep)
  }

  const uids: string[] = []
  for (const ep of toDelete) {
    uids.push(ep.uid)
    await db.deleteEpisode(ep.uid)
    try {
      await runObsidianDeleteForEpisodes([ep])
    } catch {
      /* ignore */
    }
  }

  if (uids.length > 0) {
    await db.addCleanupLog({
      id: `log-${Date.now()}`,
      at: now,
      deletedCount: uids.length,
      uids,
      reason: 'quota_pressure',
    })
  }

  return { deleted: uids.length, uids }
}
