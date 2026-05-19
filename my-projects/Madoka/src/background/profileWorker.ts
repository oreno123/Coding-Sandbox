/**
 * 用户画像 V2 业务逻辑（MadokaProfile DB）
 */

import type { ProfileTagsFromLLM, ProfileTag } from '../shared/memory-types'
import { DEFAULT_PROFILE_COLUMNS } from '../shared/memory-types'
import * as db from './profileDb'
import {
  detectConflicts,
  isDuplicate,
  hasOverlappingInColumn,
  getMoreSpecific,
} from './profileConflictDetector'

const COLUMN_NAME_TO_ID: Record<string, string> = {}
DEFAULT_PROFILE_COLUMNS.forEach((c) => {
  COLUMN_NAME_TO_ID[c.name] = c.id
  COLUMN_NAME_TO_ID[c.id] = c.id
})

function resolveColumnId(
  columns: { id: string; name: string }[],
  raw: unknown,
): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const s = raw.trim()
  const byId = columns.find((c) => c.id === s)
  if (byId) return byId.id
  const byName = columns.find((c) => c.name === s)
  if (byName) return byName.id
  return COLUMN_NAME_TO_ID[s] || null
}

export async function processProfileUpdate(
  llmResponse: ProfileTagsFromLLM | Record<string, unknown>,
): Promise<{
  added: ProfileTag[]
  updated: ProfileTag[]
  conflicts: { tag: ProfileTag; reason: string }[]
  skipped: { value: string; reason: string }[]
}> {
  const result = {
    added: [] as ProfileTag[],
    updated: [] as ProfileTag[],
    conflicts: [] as { tag: ProfileTag; reason: string }[],
    skipped: [] as { value: string; reason: string }[],
  }
  const rawTags = Array.isArray(llmResponse.tags) ? llmResponse.tags : []
  const existingTags = await db.getAllTags()
  const columns = await db.getAllColumns()
  for (const raw of rawTags) {
    const update = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const value = typeof update.value === 'string' ? update.value.trim() : ''
    if (!value) continue
    const columnId = resolveColumnId(
      columns,
      update.columnId ?? update.column ?? update.columnName,
    )
    if (!columnId) {
      result.skipped.push({ value, reason: '栏不存在或未识别' })
      continue
    }
    const column = columns.find((c) => c.id === columnId)
    if (!column) {
      result.skipped.push({ value, reason: '栏不存在' })
      continue
    }
    const newTag: ProfileTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      value,
      columnId,
      source: 'llm',
      locked: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const conflicts = detectConflicts(existingTags, newTag)
    const lockedConflict = conflicts.find(
      (c) => c.type === 'duplicate' && c.existingTag.locked,
    )
    if (lockedConflict) {
      result.skipped.push({ value, reason: '与锁定标签冲突' })
      continue
    }
    const duplicate = existingTags.find((t) => isDuplicate(t, newTag))
    if (duplicate) {
      if (!duplicate.locked) {
        await db.updateTag(duplicate.id, { updatedAt: Date.now() })
        result.updated.push({ ...duplicate, updatedAt: Date.now() })
      }
    } else {
      const overlap = hasOverlappingInColumn(existingTags, columnId, value)
      if (overlap && overlap.value !== value) {
        const more = getMoreSpecific(overlap.value, value)
        if (more === 'a') {
          result.skipped.push({ value, reason: '与已有更具体标签重叠，已跳过' })
        } else if (more === 'b' && !overlap.locked) {
          await db.deleteTag(overlap.id)
          existingTags.splice(existingTags.indexOf(overlap), 1)
          try {
            await db.addTag(newTag)
            result.added.push(newTag)
            existingTags.push(newTag)
            for (const c of detectConflicts(existingTags, newTag)) {
              if (c.type === 'contradiction') {
                await db.updateTag(c.existingTag.id, {
                  conflictWith: [...(c.existingTag.conflictWith || []), newTag.id],
                })
                result.conflicts.push({ tag: newTag, reason: c.reason })
              }
            }
          } catch (e) {
            result.skipped.push({ value, reason: (e as Error).message })
          }
        } else {
          result.skipped.push({ value, reason: '与已有标签重叠，已跳过' })
        }
        continue
      }
      try {
        await db.addTag(newTag)
        result.added.push(newTag)
        existingTags.push(newTag)
      } catch (e) {
        result.skipped.push({ value, reason: (e as Error).message })
      }
    }
    for (const conflict of conflicts) {
      if (conflict.type === 'contradiction') {
        await db.updateTag(conflict.existingTag.id, {
          conflictWith: [...(conflict.existingTag.conflictWith || []), newTag.id],
        })
        result.conflicts.push({ tag: newTag, reason: conflict.reason })
      }
    }
  }
  return result
}

export async function addManualTags(
  tags: { value: string; columnId: string }[],
): Promise<{
  added: ProfileTag[]
  failed: { value: string; reason: string }[]
}> {
  const result = {
    added: [] as ProfileTag[],
    failed: [] as { value: string; reason: string }[],
  }
  for (const tag of tags) {
    const newTag: ProfileTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      value: tag.value,
      columnId: tag.columnId,
      source: 'manual',
      locked: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    try {
      await db.addTag(newTag)
      result.added.push(newTag)
    } catch (e) {
      result.failed.push({ value: tag.value, reason: (e as Error).message })
    }
  }
  return result
}

export async function getProfileSummary(): Promise<string> {
  const profile = await db.getUserProfileV2()
  const lines: string[] = []
  for (const column of profile.columns) {
    const tags = profile.tags.filter((t) => t.columnId === column.id)
    if (tags.length > 0) {
      const tagValues = tags.map((t) => t.value).join('、')
      lines.push(`${column.name}：${tagValues}`)
    }
  }
  return lines.join('\n')
}

export async function unlockTag(tagId: string): Promise<void> {
  await db.updateTag(tagId, { locked: false })
}

export async function lockTag(tagId: string): Promise<void> {
  await db.updateTag(tagId, { locked: true })
}

export async function resolveConflict(tagId: string): Promise<void> {
  const tags = await db.getAllTags()
  const tag = tags.find((t) => t.id === tagId)
  if (!tag) return
  await db.updateTag(tagId, { conflictWith: [] })
}
