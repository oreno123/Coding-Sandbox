/**
 * 从 LLM 回复末尾解析记忆 JSON + 人物画像更新，并剥离
 */

import type { MemoryTagsFromLLM, ProfileUpdatesFromLLM } from './memory-types'

// 匹配末尾的 ```json ... ``` 整块（取最后一个，避免正文里含代码块）
function extractLastJsonBlock(content: string): { jsonStr: string; index: number } | null {
  const marker = '```json'
  const close = '```'
  let lastStart = -1
  let i = 0
  while (true) {
    const pos = content.indexOf(marker, i)
    if (pos === -1) break
    lastStart = pos
    i = pos + 1
  }
  if (lastStart === -1) return null
  const from = lastStart + marker.length
  const end = content.indexOf(close, from)
  if (end === -1) return null
  const jsonStr = content.slice(from, end).trim()
  return { jsonStr, index: lastStart }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function sanitizeProfile(obj: unknown): ProfileUpdatesFromLLM | null {
  if (!isPlainObject(obj)) return null
  const out: ProfileUpdatesFromLLM = {}
  const keys = [
    '基本信息',
    '正在学什么',
    '正在做什么',
    '喜欢什么',
    '不喜欢什么',
    '喜欢的风格',
    '需求与偏好',
  ] as const
  for (const key of keys) {
    if (isPlainObject(obj[key])) {
      const sub: Record<string, string> = {}
      for (const [k, v] of Object.entries(obj[key] as Record<string, unknown>)) {
        if (typeof v === 'string' && v.trim()) sub[k] = v.trim()
      }
      if (Object.keys(sub).length) out[key] = sub as never
    }
  }
  return Object.keys(out).length ? out : null
}

export interface ParseResult {
  contentWithoutMemory: string
  memory: MemoryTagsFromLLM | null
  profileUpdates: ProfileUpdatesFromLLM | null
}

export function parseMemoryBlockFromContent(content: string): ParseResult {
  const extracted = extractLastJsonBlock(content)
  if (!extracted) {
    return { contentWithoutMemory: content, memory: null, profileUpdates: null }
  }
  const { jsonStr, index } = extracted
  let memory: MemoryTagsFromLLM | null = null
  let profileUpdates: ProfileUpdatesFromLLM | null = null
  try {
    const obj = JSON.parse(jsonStr) as Record<string, unknown>
    if (obj && isPlainObject(obj.memory)) {
      const m = obj.memory as Record<string, unknown>
      memory = {
        shouldPersist: Boolean(m.shouldPersist),
        summary: typeof m.summary === 'string' ? m.summary : undefined,
        topics: Array.isArray(m.topics) ? m.topics : undefined,
        memoryType: m.memoryType === 'long' ? 'long' : 'short',
        personaSignals: Array.isArray(m.personaSignals) ? m.personaSignals : undefined,
        block: typeof m.block === 'string' ? m.block.trim() || undefined : undefined,
        subBlock: typeof m.subBlock === 'string' ? m.subBlock.trim() || undefined : undefined,
        shortTitle: typeof m.shortTitle === 'string' ? m.shortTitle.trim().slice(0, 20) || undefined : undefined,
      }
    }
    if (obj && (obj.profile !== undefined || obj.用户画像 !== undefined)) {
      const raw = obj.profile ?? obj.用户画像
      profileUpdates = sanitizeProfile(raw)
    }
  } catch {
    /* ignore parse error */
  }
  const contentWithoutMemory = content.slice(0, index).trimEnd()
  return { contentWithoutMemory, memory, profileUpdates }
}
