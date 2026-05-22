/**
 * 板块名称归一：同义/重复名称映射到规范名，写入前查表替换，减少「本次导入」与 Obsidian 目录重复
 */

/** 同义 → 规范名（可随使用逐步扩充） */
export const BLOCK_CANONICAL_MAP: Record<string, string> = {
  '学业与职业发展板块': '职业发展板块',
  '学业板块': '学习板块',
}

/** 视为「未分类」的无效板块名，不得写入库；若 LLM 返回这些则需用上文板块兜底 */
export const BLOCK_FORBIDDEN_ALIASES = ['未分类', '其他', '通用', '其他分类'] as const

export function isForbiddenBlock(block: string): boolean {
  const t = block.trim()
  return !t || BLOCK_FORBIDDEN_ALIASES.some((alias) => t === alias)
}

/**
 * 将 LLM 返回的板块名归一为规范名；未在表中的返回原值（trim 后）
 */
export function normalizeBlock(block: string): string {
  const t = block.trim()
  if (!t) return t
  return BLOCK_CANONICAL_MAP[t] ?? t
}
