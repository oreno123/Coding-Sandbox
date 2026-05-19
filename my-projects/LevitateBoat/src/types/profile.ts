export type ReplyStyle = 'concise' | 'detailed' | 'balanced'

export interface UserProfile {
  id: string
  /** 用户可编辑：希望助手回复的风格 */
  replyStyle: ReplyStyle
  /** 用户可编辑：自定义说明，如偏好、禁忌等 */
  customInstruction: string
  /** 用户可编辑：自定义标签列表，提取记忆时优先考虑使用这些标签 */
  customTags: string[]
  tagPreferences: Record<string, { count: number; lastUsed: number; avgAccessCount: number }>
  queryPatterns: {
    frequentQueries: Array<{ query: string; count: number }>
    queryTimeDistribution: Record<number, number>
    avgResultCount: number
  }
  memoryPreferences: {
    preferredDomains: Record<string, number>
    avgMemoryLength: number
    tagUsagePattern: 'single' | 'multiple' | 'none'
  }
  timePatterns: {
    activeHours: number[]
    creationPattern: Record<number, number>
  }
  updatedAt: number
}

export const DEFAULT_PROFILE: Omit<UserProfile, 'updatedAt'> = {
  id: 'default',
  replyStyle: 'balanced',
  customInstruction: '',
  customTags: [],
  tagPreferences: {},
  queryPatterns: {
    frequentQueries: [],
    queryTimeDistribution: {},
    avgResultCount: 0
  },
  memoryPreferences: {
    preferredDomains: {},
    avgMemoryLength: 0,
    tagUsagePattern: 'none'
  },
  timePatterns: {
    activeHours: [],
    creationPattern: {}
  }
}
