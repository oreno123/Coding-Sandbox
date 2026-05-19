/**
 * 记忆模块共享类型
 * Episode、用户画像、记忆设置、清理规则
 */

/** 单条记忆单元 */
export interface Episode {
  uid: string
  content: string
  role: 'user' | 'assistant' | 'system'
  createdAt: number
  lastAccessed: number
  producerId: string
  producerRole: string
  weight: number
  metadata: {
    source?: string
    remark?: string
    conversationId?: string
    sourceUrl?: string
    pageTitle?: string
    contextRefs?: string
  }
  isLongTermCandidate: boolean
  isLongTerm: boolean
  pinned: boolean
  syncToObsidian: boolean
  syncStatus: 'success' | 'failed' | 'retrying' | 'pending' | ''
  markdownPath: string
  summary: string
  topics: string[]
  memoryType: string
  personaSignals: string[]
  /** 记忆板块（一级），用于 Obsidian 路径与按板块导入 */
  block?: string
  /** 子模块（二级），可选，用于 Obsidian 子目录 */
  subBlock?: string
  /** 用于 Obsidian 文件名的短标题，≤20 字 */
  shortTitle?: string
}

/** 人物画像每字段为多标签（字符串数组），注入时逗号拼接 */
export interface UserProfileTable {
  updatedAt: number
  /** 1. 基本信息 */
  基本信息?: { 年龄年级?: string[]; 身份?: string[]; 性别?: string[]; 性格标签?: string[] }
  /** 2. 正在学什么 */
  正在学什么?: { 主要学习方向?: string[]; 正在掌握的技能?: string[]; 最近在攻克的难点?: string[] }
  /** 3. 正在做什么 */
  正在做什么?: { 正在做的事项目?: string[]; 目标?: string[]; 日常状态?: string[] }
  /** 4. 喜欢什么 */
  喜欢什么?: { 喜欢的内容?: string[]; 喜欢的事物?: string[]; 喜欢的氛围感觉?: string[] }
  /** 5. 不喜欢什么 */
  不喜欢什么?: { 不喜欢的风格?: string[]; 不喜欢的沟通方式?: string[]; 讨厌的内容?: string[] }
  /** 6. 喜欢的风格 */
  喜欢的风格?: { 说话风格?: string[]; 内容风格?: string[]; 视觉审美?: string[] }
  /** 7. 需求与偏好 */
  需求与偏好?: { 想要得到什么帮助?: string[]; 喜欢的沟通节奏?: string[]; 偏好的表达方式?: string[] }
}

/** 用户画像（兼容旧字段，实际使用 UserProfileTable 结构） */
export type UserProfile = UserProfileTable

/** 记忆设置（可调阈值等） */
export interface MemorySettings {
  enabled: boolean
  obsidianSyncEnabled: boolean
  userProfileEnabled: boolean
  /** 保留：最近 N 天内创建 */
  retainCreatedDays: number
  /** 保留：最近 N 天内访问 */
  retainAccessedDays: number
  /** 保留权重 >= */
  retainWeightMin: number
  /** 清理：创建超过 N 天 */
  cleanupCreatedDays: number
  /** 清理：权重 < */
  cleanupWeightMax: number
  /** 容量压力时：创建超过 N 天且权重 < 的才清理 */
  pressureCreatedDays: number
  pressureWeightMax: number
  /** 记忆占用配额比例 0–1，如 0.8 */
  quotaRatio: number
  /** 记忆绝对上限 MB，0 表示不限制 */
  quotaMaxMb: number
  /** 每日清理时间（小时 0–23） */
  cleanupHour: number
  /** 召回时最多返回条数 */
  recallLimit: number
}

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  enabled: true,
  obsidianSyncEnabled: false,
  userProfileEnabled: true,
  retainCreatedDays: 30,
  retainAccessedDays: 30,
  retainWeightMin: 0.6,
  cleanupCreatedDays: 90,
  cleanupWeightMax: 0.4,
  pressureCreatedDays: 180,
  pressureWeightMax: 0.2,
  quotaRatio: 0.8,
  quotaMaxMb: 0,
  cleanupHour: 1,
  recallLimit: 10,
}

/** Obsidian 同步设置 */
export interface ObsidianSettings {
  rootDirHandle?: FileSystemDirectoryHandle
  subDir: string
  frontmatterFormat: 'yaml' | 'json'
  lastSyncAt: number
}

export const DEFAULT_OBSIDIAN_SETTINGS: ObsidianSettings = {
  subDir: 'MadokaMemory',
  frontmatterFormat: 'yaml',
  lastSyncAt: 0,
}

/** 清理日志条目 */
export interface CleanupLogEntry {
  id: string
  at: number
  deletedCount: number
  uids: string[]
  reason: string
}

/** LLM 返回的记忆标签（从回复末尾 JSON 解析） */
export interface MemoryTagsFromLLM {
  shouldPersist: boolean
  summary?: string
  topics?: string[]
  memoryType?: 'short' | 'long'
  personaSignals?: string[]
  /** 记忆板块（一级），必填；用于 Obsidian 路径与按板块导入 */
  block?: string
  /** 子模块（二级），可选 */
  subBlock?: string
  /** 用于 Obsidian 文件名的短标题，≤20 字 */
  shortTitle?: string
}

/** LLM 返回的人物画像更新，每字段可为 string（单条）或 string[]（多条），合并时转为多标签追加 */
export type ProfileUpdatesFromLLM = Partial<{
  [K in keyof Omit<UserProfileTable, 'updatedAt'>]: Record<string, string | string[]>
}>

// ========== 以下自 111/Madoka 记忆重构合并：画像 V2、清理配置、自动导出 ==========

/** 用户画像标签项（IndexedDB MadokaProfile） */
export interface ProfileTag {
  id: string
  value: string
  columnId: string
  source: 'manual' | 'llm'
  locked: boolean
  createdAt: number
  updatedAt: number
  conflictWith?: string[]
}

/** 用户画像栏定义 */
export interface ProfileColumn {
  id: string
  name: string
  maxTags: number
  order: number
  isDefault: boolean
}

/** 用户画像完整结构（V2） */
export interface UserProfileV2 {
  columns: ProfileColumn[]
  tags: ProfileTag[]
  version: number
  updatedAt: number
}

export const DEFAULT_PROFILE_COLUMNS: ProfileColumn[] = [
  { id: 'basicInfo', name: '基本信息', maxTags: 25, order: 1, isDefault: true },
  { id: 'learning', name: '正在学什么', maxTags: 25, order: 2, isDefault: true },
  { id: 'doing', name: '正在做什么', maxTags: 25, order: 3, isDefault: true },
  { id: 'likes', name: '喜欢什么', maxTags: 25, order: 4, isDefault: true },
  { id: 'dislikes', name: '不喜欢什么', maxTags: 25, order: 5, isDefault: true },
  { id: 'style', name: '喜欢的风格', maxTags: 25, order: 6, isDefault: true },
  { id: 'preferences', name: '需求与偏好', maxTags: 25, order: 7, isDefault: true },
]

/** 自动导出规则（Obsidian） */
export interface AutoExportRule {
  id: string
  mainBlock?: string
  subBlock?: string
  enabled: boolean
  triggerType: 'onClose' | 'scheduled' | 'threshold'
  triggerConfig?: {
    time?: string
    count?: number
  }
  exportPath?: string
  lastExportedAt?: number
}

/** 手动清理配置（与 cleanupEngine 定时清理并存） */
export interface CleanupConfig {
  enabled: boolean
  manualTrigger: boolean
  cleanupPercentage: number
  autoCleanup: boolean
  autoCleanupThreshold: number
}

export const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  enabled: true,
  manualTrigger: true,
  cleanupPercentage: 0.1,
  autoCleanup: false,
  autoCleanupThreshold: 1000,
}

/** LLM 返回的单条画像标签更新（V2） */
export interface ProfileTagUpdateFromLLM {
  columnId: string
  value: string
  action: 'add' | 'remove' | 'update'
}

/** LLM 返回的用户画像更新集合（V2） */
export interface ProfileTagsFromLLM {
  tags?: ProfileTagUpdateFromLLM[]
  conflicts?: {
    tagId: string
    reason: string
  }[]
}
