/**
 * 记忆权重计算（本地）
 * 用于召回排序与清理判断
 */

import type { Episode } from '../shared/memory-types'

const NOW = () => Date.now()
const MS_DAY = 86400000

/** 基础权重：时间衰减 + 访问衰减 */
export function computeWeight(ep: Episode): number {
  const createdAgo = (NOW() - ep.createdAt) / MS_DAY
  const accessedAgo = (NOW() - ep.lastAccessed) / MS_DAY
  const decay = Math.exp(-0.02 * createdAgo) * Math.exp(-0.05 * accessedAgo)
  let w = 0.5 + 0.5 * decay
  if (ep.pinned) w = Math.max(w, 0.9)
  if (ep.isLongTerm) w = Math.max(w, 0.65)
  return Math.min(1, Math.max(0, w))
}

/** 召回时的综合分：权重 + 会话/URL 匹配加分 */
export function recallScore(
  ep: Episode,
  opts: { conversationId?: string; sourceUrl?: string }
): number {
  let s = ep.weight
  if (opts.conversationId && ep.metadata.conversationId === opts.conversationId) s += 0.2
  if (opts.sourceUrl && ep.metadata.sourceUrl === opts.sourceUrl) s += 0.15
  return Math.min(1, s)
}
