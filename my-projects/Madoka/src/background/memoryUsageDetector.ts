/**
 * 记忆使用检测器
 * 检测 LLM 是否使用了携带的记忆上下文
 */

import type { Episode } from '../shared/memory-types'

export interface MemoryUsageResult {
  usedMemories: string[] // 被使用的记忆 UID 列表
  unusedMemories: string[] // 未被使用的记忆 UID 列表
  usageRate: number // 使用率 (0-1)
}

/**
 * 检测 LLM 回复中是否使用了记忆
 * @param response LLM 的回复内容
 * @param memories 携带的记忆列表
 * @returns 使用检测结果
 */
export function detectMemoryUsage(
  response: string,
  memories: Episode[]
): MemoryUsageResult {
  const usedMemories: string[] = []
  const unusedMemories: string[] = []

  // 提取关键词（从记忆的 summary 和 topics 中提取）
  for (const memory of memories) {
    const keywords: string[] = []
    
    // 从 summary 提取关键词（取前 10 个字符作为核心关键词）
    if (memory.summary) {
      const summaryKeywords = memory.summary
        .replace(/[，。！？、；：""''（）【】《》]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 2)
        .slice(0, 3)
      keywords.push(...summaryKeywords)
    }
    
    // 从 topics 提取关键词
    if (memory.topics && memory.topics.length > 0) {
      keywords.push(...memory.topics.slice(0, 2))
    }
    
    // 从 block 提取
    if (memory.block) {
      keywords.push(memory.block)
    }

    // 去重
    const uniqueKeywords = [...new Set(keywords)]
    
    // 检测是否有关键词出现在回复中
    let isUsed = false
    for (const keyword of uniqueKeywords) {
      if (keyword.length >= 2 && response.includes(keyword)) {
        isUsed = true
        break
      }
    }

    if (isUsed) {
      usedMemories.push(memory.uid)
    } else {
      unusedMemories.push(memory.uid)
    }
  }

  const usageRate = memories.length > 0 ? usedMemories.length / memories.length : 0

  return {
    usedMemories,
    unusedMemories,
    usageRate,
  }
}

/**
 * 根据使用情况调整记忆权重
 * @param memory 记忆对象
 * @param wasUsed 是否被使用
 * @returns 调整后的权重变化
 */
export function calculateWeightAdjustment(
  memory: Episode,
  wasUsed: boolean
): number {
  if (wasUsed) {
    // 被使用：增加权重（+0.1，最高不超过 1.0）
    return Math.min(0.1, 1.0 - memory.weight)
  } else {
    // 未被使用：轻微降低权重（-0.02，最低不低于 0.1）
    return Math.max(-0.02, 0.1 - memory.weight)
  }
}

/**
 * 分析记忆使用效果
 * @param usageHistory 使用历史记录
 * @returns 效果分析
 */
export function analyzeMemoryEffectiveness(
  usageHistory: { timestamp: number; wasUsed: boolean }[]
): {
  effectiveness: 'high' | 'medium' | 'low'
  recommendation: string
} {
  if (usageHistory.length === 0) {
    return {
      effectiveness: 'low',
      recommendation: '暂无使用数据，建议观察更多对话',
    }
  }

  const recentHistory = usageHistory.slice(-10) // 最近 10 次
  const usageCount = recentHistory.filter(h => h.wasUsed).length
  const usageRate = usageCount / recentHistory.length

  if (usageRate >= 0.7) {
    return {
      effectiveness: 'high',
      recommendation: '记忆效果很好，建议保持',
    }
  } else if (usageRate >= 0.3) {
    return {
      effectiveness: 'medium',
      recommendation: '记忆效果一般，可考虑优化记忆内容或板块选择',
    }
  } else {
    return {
      effectiveness: 'low',
      recommendation: '记忆很少被使用，建议检查记忆质量或降低权重',
    }
  }
}
