/**
 * 自动导出规则存储（MadokaMemory DB，与 memoryDb 共用连接）
 */

import type { AutoExportRule } from '../shared/memory-types'
import { openMemoryDatabase } from './memoryDb'

const STORE_RULES = 'autoExportRules'

export async function getAllAutoExportRules(): Promise<AutoExportRule[]> {
  const db = await openMemoryDatabase()
  const tx = db.transaction(STORE_RULES, 'readonly')
  const store = tx.objectStore(STORE_RULES)
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result ?? [])
    req.onerror = () => reject(req.error)
  })
}

export async function getAutoExportRulesByBlock(
  mainBlock?: string,
  subBlock?: string,
): Promise<AutoExportRule[]> {
  const rules = await getAllAutoExportRules()
  return rules.filter((r) => r.mainBlock === mainBlock && r.subBlock === subBlock)
}

export async function addAutoExportRule(rule: AutoExportRule): Promise<void> {
  const db = await openMemoryDatabase()
  const tx = db.transaction(STORE_RULES, 'readwrite')
  const store = tx.objectStore(STORE_RULES)
  return new Promise((resolve, reject) => {
    const req = store.put(rule)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function updateAutoExportRule(
  ruleId: string,
  updates: Partial<AutoExportRule>,
): Promise<void> {
  const rules = await getAllAutoExportRules()
  const rule = rules.find((r) => r.id === ruleId)
  if (!rule) {
    throw new Error('规则不存在')
  }
  await addAutoExportRule({ ...rule, ...updates })
}

export async function deleteAutoExportRule(ruleId: string): Promise<void> {
  const db = await openMemoryDatabase()
  const tx = db.transaction(STORE_RULES, 'readwrite')
  const store = tx.objectStore(STORE_RULES)
  return new Promise((resolve, reject) => {
    const req = store.delete(ruleId)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function hasEnabledAutoExportRules(): Promise<boolean> {
  const rules = await getAllAutoExportRules()
  return rules.some((r) => r.enabled)
}
