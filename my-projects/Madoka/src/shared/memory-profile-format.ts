/**
 * 人物画像表格结构及格式化（记忆总览、使用记忆注入共用）
 */

import type { UserProfile } from './memory-types'

export const PROFILE_SECTIONS: {
  key: keyof Omit<UserProfile, 'updatedAt'>
  label: string
  fields: { key: string; label: string }[]
}[] = [
  { key: '基本信息', label: '基本信息', fields: [{ key: '年龄年级', label: '年龄/年级' }, { key: '身份', label: '身份' }, { key: '性别', label: '性别' }, { key: '性格标签', label: '性格标签' }] },
  { key: '正在学什么', label: '正在学什么', fields: [{ key: '主要学习方向', label: '主要学习方向' }, { key: '正在掌握的技能', label: '正在掌握的技能' }, { key: '最近在攻克的难点', label: '最近在攻克的难点' }] },
  { key: '正在做什么', label: '正在做什么', fields: [{ key: '正在做的事项目', label: '正在做的事/项目' }, { key: '目标', label: '目标' }, { key: '日常状态', label: '日常状态' }] },
  { key: '喜欢什么', label: '喜欢什么', fields: [{ key: '喜欢的内容', label: '喜欢的内容' }, { key: '喜欢的事物', label: '喜欢的事物' }, { key: '喜欢的氛围感觉', label: '喜欢的氛围/感觉' }] },
  { key: '不喜欢什么', label: '不喜欢什么', fields: [{ key: '不喜欢的风格', label: '不喜欢的风格' }, { key: '不喜欢的沟通方式', label: '不喜欢的沟通方式' }, { key: '讨厌的内容', label: '讨厌的内容' }] },
  { key: '喜欢的风格', label: '喜欢的风格', fields: [{ key: '说话风格', label: '说话风格' }, { key: '内容风格', label: '内容风格' }, { key: '视觉审美', label: '视觉/审美' }] },
  { key: '需求与偏好', label: '需求与偏好', fields: [{ key: '想要得到什么帮助', label: '想要得到什么帮助' }, { key: '喜欢的沟通节奏', label: '喜欢的沟通节奏' }, { key: '偏好的表达方式', label: '偏好的表达方式' }] },
]

function hasValue(v: string | string[] | undefined): boolean {
  if (v == null) return false
  if (Array.isArray(v)) return v.some((s) => s && String(s).trim())
  return !!String(v).trim()
}

export function hasAnyProfileData(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false
  return PROFILE_SECTIONS.some((s) => {
    const d = profile[s.key] as Record<string, string | string[]> | undefined
    return !!d && Object.values(d).some(hasValue)
  })
}

/** 多标签用逗号拼接为一句 */
function formatFieldValue(v: string | string[] | undefined): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.filter((s) => s && String(s).trim()).join('，')
  return String(v).trim()
}

/** 将人物画像格式化为「使用记忆」注入时的纯文本 */
export function formatProfileForInject(profile: UserProfile | null | undefined): string {
  if (!profile || !hasAnyProfileData(profile)) return ''
  const lines: string[] = ['--- 用户画像（仅供参考） ---']
  for (const section of PROFILE_SECTIONS) {
    const d = profile[section.key] as Record<string, string | string[]> | undefined
    if (!d) continue
    for (const f of section.fields) {
      const text = formatFieldValue(d[f.key])
      if (text) lines.push(`${f.label}: ${text}`)
    }
  }
  return lines.join('\n')
}
