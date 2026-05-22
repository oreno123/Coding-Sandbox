/**
 * 用户画像冲突检测器
 */

import type { ProfileTag } from '../shared/memory-types'

export type ConflictType = 'duplicate' | 'contradiction'

export interface Conflict {
  type: ConflictType
  existingTag: ProfileTag
  incomingTag: ProfileTag
  reason: string
}

interface ConflictRule {
  type: ConflictType
  check: (existing: ProfileTag, incoming: ProfileTag) => boolean
  getReason: (existing: ProfileTag, incoming: ProfileTag) => string
}

const conflictRules: ConflictRule[] = [
  {
    type: 'duplicate',
    check: (e, i) => e.columnId === i.columnId && e.value === i.value,
    getReason: () => '标签值重复',
  },
  {
    type: 'contradiction',
    check: (e, i) => {
      if (e.columnId !== 'basicInfo' || i.columnId !== 'basicInfo') return false
      const agePattern = /^(\d+)岁?$/
      const eMatch = e.value.match(agePattern)
      const iMatch = i.value.match(agePattern)
      return !!(eMatch && iMatch && eMatch[1] !== iMatch[1])
    },
    getReason: (e, i) => `年龄冲突：${e.value} vs ${i.value}`,
  },
  {
    type: 'contradiction',
    check: (e, i) => {
      const likeCols = ['likes', 'dislikes']
      if (!likeCols.includes(e.columnId) || !likeCols.includes(i.columnId)) return false
      if (e.columnId === i.columnId) return false
      return e.value === i.value
    },
    getReason: (e) =>
      `${e.columnId === 'likes' ? '喜欢' : '不喜欢'}：${e.value}`,
  },
]

export function detectConflicts(
  existingTags: ProfileTag[],
  incomingTag: ProfileTag,
): Conflict[] {
  const conflicts: Conflict[] = []
  for (const existing of existingTags) {
    for (const rule of conflictRules) {
      if (rule.check(existing, incomingTag)) {
        conflicts.push({
          type: rule.type,
          existingTag: existing,
          incomingTag: incomingTag,
          reason: rule.getReason(existing, incomingTag),
        })
      }
    }
  }
  return conflicts
}

export function detectAllConflicts(
  existingTags: ProfileTag[],
  incomingTags: ProfileTag[],
): Conflict[] {
  const allConflicts: Conflict[] = []
  for (const incoming of incomingTags) {
    allConflicts.push(...detectConflicts(existingTags, incoming))
  }
  return allConflicts
}

export function isDuplicate(existing: ProfileTag, incoming: ProfileTag): boolean {
  return existing.columnId === incoming.columnId && existing.value === incoming.value
}

export function isContradiction(existing: ProfileTag, incoming: ProfileTag): boolean {
  const rule = conflictRules.find(
    (r) => r.type === 'contradiction' && r.check(existing, incoming),
  )
  return !!rule
}

function isSubsequence(short: string, long: string): boolean {
  if (short.length > long.length) return false
  let j = 0
  for (let i = 0; i < short.length; i++) {
    const idx = long.indexOf(short[i], j)
    if (idx === -1) return false
    j = idx + 1
  }
  return true
}

export function valuesOverlap(a: string, b: string): boolean {
  const va = a.trim()
  const vb = b.trim()
  if (!va || !vb) return false
  if (va === vb) return true
  if (va.includes(vb) || vb.includes(va)) return true
  return isSubsequence(va, vb) || isSubsequence(vb, va)
}

export function getMoreSpecific(a: string, b: string): 'a' | 'b' | null {
  const va = a.trim()
  const vb = b.trim()
  if (!va || !vb || va === vb) return null
  if (va.includes(vb) && !vb.includes(va)) return 'a'
  if (vb.includes(va) && !va.includes(vb)) return 'b'
  if (isSubsequence(va, vb) && va.length < vb.length) return 'b'
  if (isSubsequence(vb, va) && vb.length < va.length) return 'a'
  return null
}

export function hasOverlappingInColumn(
  tags: ProfileTag[],
  columnId: string,
  value: string,
): ProfileTag | null {
  const v = value.trim()
  if (!v) return null
  return tags.find((t) => t.columnId === columnId && valuesOverlap(t.value, v)) ?? null
}

export function findOverlappingTagGroups(
  tags: ProfileTag[],
): { tags: ProfileTag[] }[] {
  const byColumn = new Map<string, ProfileTag[]>()
  for (const t of tags) {
    if (!byColumn.has(t.columnId)) byColumn.set(t.columnId, [])
    byColumn.get(t.columnId)!.push(t)
  }
  const groups: ProfileTag[][] = []
  for (const colTags of byColumn.values()) {
    const used = new Set<string>()
    for (const tag of colTags) {
      if (used.has(tag.id)) continue
      const group: ProfileTag[] = [tag]
      used.add(tag.id)
      let changed = true
      while (changed) {
        changed = false
        for (const other of colTags) {
          if (used.has(other.id)) continue
          for (const g of group) {
            if (valuesOverlap(g.value, other.value)) {
              group.push(other)
              used.add(other.id)
              changed = true
              break
            }
          }
        }
      }
      if (group.length > 1) groups.push(group)
    }
  }
  return groups.map((g) => ({ tags: g }))
}
