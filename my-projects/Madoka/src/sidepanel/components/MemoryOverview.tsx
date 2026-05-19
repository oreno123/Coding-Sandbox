/**
 * 记忆总览视图
 * 浏览、固定、删除 Episode；人物画像表格（每次对话自动更新）
 */

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useChatContext } from '../context/ChatContext'
import { sendToBackground } from '../../shared/messaging'
import type { Episode, UserProfile } from '../../shared/memory-types'
import { writeEpisodeToObsidian, runObsidianDeleteForEpisodes } from '../../background/obsidianSync'
import { PROFILE_SECTIONS, hasAnyProfileData } from '../../shared/memory-profile-format'

function profileFieldToTags(v: string | string[] | undefined): string[] {
  if (v == null) return []
  if (Array.isArray(v)) return v.filter((s) => s && String(s).trim())
  return String(v).trim() ? [String(v).trim()] : []
}

export function MemoryOverview() {
  const { setView } = useChatContext()
  const [tab, setTab] = useState<'memory' | 'profile'>('memory')
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await sendToBackground<{ success: boolean; episodes?: Episode[] }>({ action: 'memoryGetAll' })
      if (res.success && res.episodes) setEpisodes(res.episodes)
      else setEpisodes([])
    } catch (e) {
      setError((e as Error).message)
      setEpisodes([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProfile = useCallback(async () => {
    setProfileLoading(true)
    try {
      const res = await sendToBackground<{ success: boolean; profile?: UserProfile | null }>({ action: 'memoryGetUserProfile' })
      setProfile(res.success && res.profile ? res.profile : null)
    } catch {
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const removeProfileTag = useCallback(
    async (sectionKey: keyof Omit<UserProfile, 'updatedAt'>, fieldKey: string, tagToRemove: string) => {
      if (!profile) return
      const section = profile[sectionKey] as Record<string, string | string[]> | undefined
      if (!section) return
      const cur = profileFieldToTags(section[fieldKey])
      const next = cur.filter((t) => t !== tagToRemove)
      const updated: UserProfile = {
        ...profile,
        updatedAt: Date.now(),
        [sectionKey]: {
          ...section,
          [fieldKey]: next.length ? next : undefined,
        },
      }
      try {
        const res = await sendToBackground<{ success: boolean }>({
          action: 'memorySaveUserProfile',
          profile: updated,
        })
        if (res?.success) setProfile(updated)
      } catch {
        setError('保存画像失败')
      }
    },
    [profile]
  )

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleTogglePinned = async (uid: string, pinned: boolean) => {
    try {
      const res = await sendToBackground<{ success: boolean; episode?: Episode }>({
        action: 'memoryUpdate',
        uid,
        updates: { pinned },
      })
      setEpisodes((prev) => prev.map((e) => (e.uid === uid ? { ...e, pinned } : e)))
      if (res?.success && res.episode) {
        writeEpisodeToObsidian(res.episode)
          .then(({ markdownPath }) =>
            sendToBackground({
              action: 'memoryUpdateEpisodeSyncStatus',
              uid,
              syncStatus: 'success',
              markdownPath,
            })
          )
          .catch((err) => {
            console.error('[Madoka] Obsidian 同步写入失败:', err)
            sendToBackground({ action: 'memoryUpdateEpisodeSyncStatus', uid, syncStatus: 'failed' })
          })
      }
    } catch {
      setError('更新失败')
    }
  }

  const handleDelete = async (uid: string) => {
    if (!confirm('确定删除这条记忆？')) return
    const ep = episodes.find((e) => e.uid === uid)
    try {
      if (ep) {
        try {
          await runObsidianDeleteForEpisodes([ep])
        } catch {
          /* 侧栏删文件失败也继续删 DB */
        }
      }
      await sendToBackground({ action: 'memoryDelete', uid })
      setEpisodes((prev) => prev.filter((e) => e.uid !== uid))
    } catch {
      setError('删除失败')
    }
  }

  const handleRunCleanup = async () => {
    if (!confirm('确定执行智能清理？将删除符合清理规则的记忆。')) return
    try {
      const res = await sendToBackground<{ deleted: number }>({ action: 'memoryRunCleanup' })
      if (res.deleted > 0) await load()
    } catch {
      setError('清理失败')
    }
  }

  return (
    <motion.div
      className="h-full bg-[var(--bg-primary)] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <button
          type="button"
          className="p-2 -ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          onClick={() => setView('chat')}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <span className="font-semibold text-[var(--text-primary)]">记忆总览</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={`text-xs px-2 py-1 rounded ${tab === 'memory' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            onClick={() => setTab('memory')}
          >
            记忆列表
          </button>
          <button
            type="button"
            className={`text-xs px-2 py-1 rounded ${tab === 'profile' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            onClick={() => setTab('profile')}
          >
            人物画像
          </button>
          {tab === 'memory' && (
            <button
              type="button"
              className="text-xs px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              onClick={handleRunCleanup}
            >
              执行清理
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-3 text-sm text-[var(--accent-danger)]">
            {error}
          </div>
        )}

        {tab === 'profile' && (
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-muted)]">
              以下表格根据每次对话自动更新（由模型从对话中推断并合并），仅存于本地。
            </p>
            {profileLoading ? (
              <div className="flex justify-center py-6">
                <span className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !profile || !hasAnyProfileData(profile) ? (
              <p className="text-sm text-[var(--text-muted)]">暂无画像数据，多聊几句后会随对话自动生成。</p>
            ) : (
              <div className="space-y-4">
                {PROFILE_SECTIONS.map((section) => {
                  const data = profile[section.key] as Record<string, string | string[]> | undefined
                  if (!data || Object.values(data).every((v) => !profileFieldToTags(v).length)) return null
                  return (
                    <div key={section.key} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
                      <div className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-tertiary)]">
                        {section.label}
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          {section.fields.map((f) => {
                            const tags = profileFieldToTags(data[f.key])
                            if (tags.length === 0) return null
                            return (
                              <tr key={f.key} className="border-t border-[var(--border-primary)]">
                                <td className="px-3 py-1.5 text-[var(--text-muted)] w-32 align-top">{f.label}</td>
                                <td className="px-3 py-1.5 text-[var(--text-primary)]">
                                  <span className="flex flex-wrap gap-1.5">
                                    {tags.map((tag) => (
                                      <span
                                        key={tag}
                                        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                                      >
                                        {tag}
                                        <button
                                          type="button"
                                          className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent-primary)]"
                                          title="删除该标签"
                                          onClick={() => removeProfileTag(section.key, f.key, tag)}
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </span>
                                    ))}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
                {profile.updatedAt && (
                  <p className="text-xs text-[var(--text-muted)]">
                    最后更新：{new Date(profile.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'memory' && (loading ? (
          <div className="flex justify-center py-8">
            <span className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : episodes.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-8">暂无记忆</p>
        ) : (
          <ul className="space-y-3 list-none">
            {episodes.map((ep) => (
              <li
                key={ep.uid}
                className="p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text-primary)] line-clamp-2">
                      {ep.summary || ep.content.slice(0, 120)}
                      {(ep.summary || ep.content).length > 120 ? '...' : ''}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {new Date(ep.createdAt).toLocaleString()} · 权重 {ep.weight.toFixed(2)}
                      {ep.pinned && ' · 已固定'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-hover)]"
                      title={ep.pinned ? '取消固定' : '固定'}
                      onClick={() => handleTogglePinned(ep.uid, !ep.pinned)}
                    >
                      <svg
                        className="w-4 h-4"
                        fill={ep.pinned ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.364 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.98 10.101c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.518-4.674z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--accent-danger)] hover:bg-[var(--bg-hover)]"
                      title="删除"
                      onClick={() => handleDelete(ep.uid)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </motion.div>
  )
}
