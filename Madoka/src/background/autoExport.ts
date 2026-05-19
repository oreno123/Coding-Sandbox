/**
 * 自动导出逻辑：定时 / 阈值 / 关闭侧栏时触发 Obsidian 写入
 */

import type { AutoExportRule, Episode } from '../shared/memory-types'
import * as db from './memoryDb'
import * as exportDb from './autoExportDb'
import { runObsidianExport } from './obsidianSync'

function shouldTrigger(rule: AutoExportRule, episodeCount: number): boolean {
  if (!rule.enabled) return false
  switch (rule.triggerType) {
    case 'scheduled': {
      if (!rule.triggerConfig?.time || !rule.lastExportedAt) return true
      const lastExport = new Date(rule.lastExportedAt)
      const nowDate = new Date()
      const [hours, minutes] = rule.triggerConfig.time.split(':').map(Number)
      const scheduledTime = new Date(
        nowDate.getFullYear(),
        nowDate.getMonth(),
        nowDate.getDate(),
        hours,
        minutes,
      )
      return nowDate >= scheduledTime && lastExport < scheduledTime
    }
    case 'threshold': {
      return episodeCount >= (rule.triggerConfig?.count || 100)
    }
    case 'onClose':
      return false
    default:
      return false
  }
}

async function getMatchingEpisodes(rule: AutoExportRule): Promise<Episode[]> {
  const episodes = await db.getAllEpisodes()
  return episodes.filter((ep) => {
    if (rule.mainBlock && ep.block !== rule.mainBlock) return false
    if (rule.subBlock && ep.subBlock !== rule.subBlock) return false
    return true
  })
}

async function executeExport(
  rule: AutoExportRule,
  episodes: Episode[],
): Promise<{
  success: boolean
  exportedCount: number
  path?: string
  error?: string
}> {
  try {
    const result = await runObsidianExport(episodes, rule.exportPath)
    await exportDb.updateAutoExportRule(rule.id, {
      lastExportedAt: Date.now(),
    })
    return {
      success: result.success,
      exportedCount: episodes.length,
      path: result.path,
      error: result.error,
    }
  } catch (e) {
    return {
      success: false,
      exportedCount: 0,
      error: (e as Error).message,
    }
  }
}

export async function checkAndTriggerAutoExport(): Promise<{
  triggered: AutoExportRule[]
  results: {
    rule: AutoExportRule
    result: { success: boolean; exportedCount: number; error?: string }
  }[]
}> {
  const rules = await exportDb.getAllAutoExportRules()
  const episodes = await db.getAllEpisodes()
  const triggered: AutoExportRule[] = []
  const results: {
    rule: AutoExportRule
    result: { success: boolean; exportedCount: number; error?: string }
  }[] = []
  for (const rule of rules) {
    if (shouldTrigger(rule, episodes.length)) {
      const matching = await getMatchingEpisodes(rule)
      if (matching.length > 0) {
        const result = await executeExport(rule, matching)
        triggered.push(rule)
        results.push({ rule, result })
      }
    }
  }
  return { triggered, results }
}

export async function onSidepanelClose(): Promise<{
  triggered: AutoExportRule[]
  results: {
    rule: AutoExportRule
    result: { success: boolean; exportedCount: number; error?: string }
  }[]
}> {
  const rules = await exportDb.getAllAutoExportRules()
  const onCloseRules = rules.filter((r) => r.enabled && r.triggerType === 'onClose')
  const results: {
    rule: AutoExportRule
    result: { success: boolean; exportedCount: number; error?: string }
  }[] = []
  for (const rule of onCloseRules) {
    const matching = await getMatchingEpisodes(rule)
    if (matching.length > 0) {
      const result = await executeExport(rule, matching)
      results.push({ rule, result })
    }
  }
  return { triggered: onCloseRules, results }
}

export async function manualTriggerExport(ruleId: string): Promise<{
  success: boolean
  exportedCount: number
  path?: string
  error?: string
}> {
  const rules = await exportDb.getAllAutoExportRules()
  const rule = rules.find((r) => r.id === ruleId)
  if (!rule) {
    return { success: false, exportedCount: 0, error: '规则不存在' }
  }
  const matching = await getMatchingEpisodes(rule)
  if (matching.length === 0) {
    return { success: false, exportedCount: 0, error: '没有匹配的记忆' }
  }
  return executeExport(rule, matching)
}
