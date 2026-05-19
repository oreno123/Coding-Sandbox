<template>
  <div class="options">
    <header class="options-header">
      <h1>Levitate Boat 设置</h1>
      <button class="theme-toggle" :title="isDark ? '浅色模式' : '深色模式'" @click="toggleTheme" />
    </header>

    <div class="options-content">
      <section class="form-section">
        <label>API 类型</label>
        <select v-model="config.provider" class="input-field">
          <option value="ollama">Ollama (本地)</option>
          <option value="openai">OpenAI</option>
          <option value="claude">Claude</option>
          <option value="custom">自定义</option>
        </select>
      </section>

      <section class="form-section">
        <label>API 地址</label>
        <input
          v-model="config.baseUrl"
          class="input-field"
          :placeholder="config.provider === 'custom' ? 'https://api.deepseek.com/v1' : 'http://localhost:11434'"
        />
        <p v-if="config.provider === 'custom'" class="field-hint">
          填接口基址，不要填密钥管理页。DeepSeek 填 <code>https://api.deepseek.com/v1</code>
        </p>
      </section>

      <section v-if="config.provider !== 'ollama'" class="form-section">
        <label>API Key</label>
        <input v-model="config.apiKey" type="password" class="input-field" placeholder="sk-..." />
      </section>

      <section class="form-section">
        <label>Chat 模型</label>
        <input v-model="config.chatModel" class="input-field" placeholder="llama3.2" />
      </section>

      <section class="form-section">
        <label>Embedding 模型 (可选)</label>
        <input v-model="config.embedModel" class="input-field" placeholder="nomic-embed-text" />
      </section>

      <hr class="section-divider" />

      <section class="form-section profile-section">
        <h2 class="profile-title">用户画像</h2>
        <p class="field-hint profile-desc">助手会据此调整回复风格，并参考你的常问与标签习惯。「近期常问」「常用标签」会随你对话与提取记忆<strong>自动记录</strong>；下方可手动清空或重置。</p>
        <div class="form-section">
          <label>回复风格</label>
          <select v-model="profile.replyStyle" class="input-field">
            <option value="concise">简洁</option>
            <option value="balanced">适中</option>
            <option value="detailed">详细</option>
          </select>
        </div>
        <div class="form-section">
          <label>自定义说明（可选）</label>
          <textarea
            v-model="profile.customInstruction"
            class="input-field textarea-field"
            placeholder="如：希望少用术语、不要推荐购物、偏好分点回答…"
            rows="3"
          />
        </div>
        <div class="form-section custom-tags-section">
          <label>自定义标签</label>
          <p class="field-hint">填写你常用的标签，提取记忆时会优先考虑使用；便于检索与画像统计。</p>
          <div class="custom-tags-input-row">
            <input
              v-model="customTagInput"
              class="input-field"
              placeholder="输入标签后回车或点击添加"
              maxlength="20"
              @keydown.enter.prevent="addCustomTag"
            />
            <button type="button" class="btn btn-secondary btn-small" @click="addCustomTag">添加</button>
          </div>
          <div v-if="profile.customTags.length" class="custom-tags-list">
            <span
              v-for="tag in profile.customTags"
              :key="tag"
              class="custom-tag-pill"
            >
              {{ tag }}
              <button type="button" class="custom-tag-remove" title="删除" @click="removeCustomTag(tag)">×</button>
            </span>
          </div>
          <p v-else class="custom-tags-empty-hint">暂无自定义标签，添加后保存画像即可生效。</p>
        </div>
        <div v-if="profileStats.updatedAt" class="profile-stats">
          <div v-if="profileStats.topQueries.length" class="stat-row">
            <span class="stat-label">近期常问：</span>
            <span class="stat-value">{{ profileStats.topQueries }}</span>
          </div>
          <div v-if="profileStats.topTags.length" class="stat-row">
            <span class="stat-label">常用标签：</span>
            <span class="stat-value">{{ profileStats.topTags }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">最后更新：</span>
            <span class="stat-value">{{ profileStats.updatedAt }}</span>
          </div>
        </div>

        <details class="profile-tags-collapse">
          <summary>用户画像标签（可折叠）</summary>
          <div class="profile-tags-cloud">
            <span
              v-for="(item, i) in profileTagsList"
              :key="item.tag"
              :class="['profile-tag-pill', `tag-color-${i % 8}`]"
              :style="{ fontSize: item.fontSize }"
            >{{ item.tag }}</span>
            <span v-if="profileTagsList.length === 0" class="profile-tags-empty">暂无标签</span>
          </div>
        </details>

        <div class="profile-actions-row">
          <button class="btn btn-secondary" @click="saveProfile">保存画像</button>
          <button
            v-if="hasAutoStats"
            type="button"
            class="btn btn-outline"
            title="清空近期常问与常用标签的自动统计，保留回复风格与自定义说明、自定义标签"
            @click="clearAutoStats"
          >清空自动统计</button>
          <button
            v-if="profileTagsList.length > 0"
            type="button"
            class="btn btn-outline"
            title="将常用标签中尚未在自定义标签里的，追加到自定义标签"
            @click="syncTopTagsToCustom"
          >常用标签同步到自定义</button>
          <button
            type="button"
            class="btn btn-outline btn-danger"
            title="恢复为默认画像（清空所有设置与统计）"
            @click="confirmResetProfile"
          >重置用户画像</button>
        </div>
      </section>

      <div class="actions">
        <button class="btn btn-primary" @click="save">保存配置</button>
        <button class="btn btn-secondary" @click="exportData">导出记忆</button>
        <button class="btn btn-secondary" @click="triggerImport">导入记忆</button>
        <input ref="fileInput" type="file" accept=".json" @change="onFileSelect" class="hidden" />
      </div>
      <p v-if="memoryCount !== null" class="memory-count-hint">当前共 {{ memoryCount }} 条记忆</p>

      <p v-if="status" :class="['status', statusType]">{{ status }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { LLMConfig } from '@/types'
import type { UserProfile, ReplyStyle } from '@/types/profile'
import { useTheme } from '@/hooks/useTheme'

const { theme, toggleTheme } = useTheme()
const isDark = computed(() => theme.value === 'dark')

const config = ref<LLMConfig>({
  provider: 'custom',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: 'sk-e2b35616e9604a60be3f073001cbd539',
  chatModel: 'deepseek-chat',
  embedModel: 'nomic-embed-text',
  timeout: 60000
})
const profile = ref<{ replyStyle: ReplyStyle; customInstruction: string; customTags: string[] }>({
  replyStyle: 'balanced',
  customInstruction: '',
  customTags: []
})
const customTagInput = ref('')
const profileStats = ref<{ topQueries: string; topTags: string; updatedAt: string }>({
  topQueries: '',
  topTags: '',
  updatedAt: ''
})
const profileTagsList = ref<{ tag: string; count: number; fontSize: string }[]>([])
const status = ref('')
const statusType = ref<'ok' | 'err'>('ok')
const fileInput = ref<HTMLInputElement | null>(null)
const memoryCount = ref<number | null>(null)

const hasAutoStats = computed(() => {
  return profileStats.value.topQueries !== '—' || profileStats.value.topTags !== '—'
})

const TAG_COLORS = 8
const TAG_FONT_MIN = 12
const TAG_FONT_MAX = 18

function formatProfileStats(p: UserProfile | undefined) {
  if (!p) return { topQueries: '', topTags: '', updatedAt: '' }
  const topQueries = (p.queryPatterns?.frequentQueries ?? []).slice(0, 5).map((x) => x.query).join('、') || '—'
  const topTags = Object.entries(p.tagPreferences ?? {})
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([tag]) => tag)
    .join('、') || '—'
  const updatedAt = p.updatedAt
    ? new Date(p.updatedAt).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
    : ''
  const entries = Object.entries(p.tagPreferences ?? {})
    .map(([tag, data]) => ({ tag, count: data.count }))
    .sort((a, b) => b.count - a.count)
  const maxCount = Math.max(...entries.map((e) => e.count), 1)
  profileTagsList.value = entries.map((e) => ({
    tag: e.tag,
    count: e.count,
    fontSize: `${TAG_FONT_MIN + ((e.count / maxCount) * (TAG_FONT_MAX - TAG_FONT_MIN)).toFixed(0)}px`
  }))
  return { topQueries, topTags, updatedAt }
}

async function loadProfile() {
  try {
    const p = await chrome.runtime.sendMessage({ type: 'profile:get' }) as UserProfile | undefined
    if (p) {
      profile.value = {
        replyStyle: p.replyStyle ?? 'balanced',
        customInstruction: p.customInstruction ?? '',
        customTags: Array.isArray(p.customTags) ? [...p.customTags] : []
      }
      profileStats.value = formatProfileStats(p)
    }
  } catch {
    /* ignore */
  }
}

async function refreshMemoryCount() {
  try {
    const n = await chrome.runtime.sendMessage({ type: 'memory:getCount' }) as number | undefined
    memoryCount.value = typeof n === 'number' ? n : null
  } catch {
    memoryCount.value = null
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    loadProfile()
    refreshMemoryCount()
  }
}

onMounted(async () => {
  try {
    const c = await chrome.runtime.sendMessage({ type: 'llm:getConfig' })
    if (c) config.value = { ...config.value, ...c }
  } catch {
    /* options may load before background */
  }
  await loadProfile()
  await refreshMemoryCount()
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

async function save() {
  try {
    await chrome.runtime.sendMessage({ type: 'llm:setConfig', payload: config.value })
    showStatus('保存成功', 'ok')
  } catch (e) {
    showStatus(`保存失败: ${(e as Error).message}`, 'err')
  }
}

async function addCustomTag() {
  const t = customTagInput.value.trim()
  if (!t) return
  if (profile.value.customTags.includes(t)) {
    customTagInput.value = ''
    return
  }
  profile.value.customTags = [...profile.value.customTags, t]
  customTagInput.value = ''
  await persistProfile()
}

function removeCustomTag(tag: string) {
  profile.value.customTags = profile.value.customTags.filter((x) => x !== tag)
  persistProfile()
}

async function persistProfile() {
  try {
    await chrome.runtime.sendMessage({
      type: 'profile:update',
      payload: {
        replyStyle: profile.value.replyStyle,
        customInstruction: profile.value.customInstruction,
        customTags: profile.value.customTags
      }
    })
  } catch {
    /* ignore */
  }
}

async function saveProfile() {
  try {
    await persistProfile()
    showStatus('画像已保存', 'ok')
    await loadProfile()
  } catch (e) {
    showStatus(`保存失败: ${(e as Error).message}`, 'err')
  }
}

async function clearAutoStats() {
  try {
    await chrome.runtime.sendMessage({ type: 'profile:clearAutoStats' })
    const p = await chrome.runtime.sendMessage({ type: 'profile:get' }) as UserProfile | undefined
    if (p) profileStats.value = formatProfileStats(p)
    showStatus('已清空自动统计（常问、常用标签）', 'ok')
  } catch (e) {
    showStatus(`清空失败: ${(e as Error).message}`, 'err')
  }
}

async function syncTopTagsToCustom() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'profile:syncTopTagsToCustom', payload: { maxCount: 10 } }) as { added?: string[] }
    const added = res?.added ?? []
    if (added.length > 0) {
      const p = await chrome.runtime.sendMessage({ type: 'profile:get' }) as UserProfile | undefined
      if (p) {
        profile.value.customTags = Array.isArray(p.customTags) ? [...p.customTags] : []
        profileStats.value = formatProfileStats(p)
      }
      showStatus(`已将 ${added.length} 个常用标签加入自定义标签`, 'ok')
    } else {
      showStatus('没有可同步的常用标签（可能已在自定义标签中）', 'ok')
    }
  } catch (e) {
    showStatus(`同步失败: ${(e as Error).message}`, 'err')
  }
}

async function confirmResetProfile() {
  if (!confirm('确定要重置用户画像吗？将恢复默认回复风格、清空自定义说明与自定义标签，以及所有自动统计。')) return
  try {
    await chrome.runtime.sendMessage({ type: 'profile:reset' })
    const p = await chrome.runtime.sendMessage({ type: 'profile:get' }) as UserProfile | undefined
    if (p) {
      profile.value = {
        replyStyle: p.replyStyle ?? 'balanced',
        customInstruction: p.customInstruction ?? '',
        customTags: Array.isArray(p.customTags) ? [...p.customTags] : []
      }
      profileStats.value = formatProfileStats(p)
      profileTagsList.value = []
    }
    showStatus('用户画像已重置为默认', 'ok')
  } catch (e) {
    showStatus(`重置失败: ${(e as Error).message}`, 'err')
  }
}

async function exportData() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'export' })
    if (res?.error) throw new Error(res.error)
    const blob = new Blob([res.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `levitate-boat-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showStatus('导出成功', 'ok')
  } catch (e) {
    showStatus(`导出失败: ${(e as Error).message}`, 'err')
  }
}

function triggerImport() {
  fileInput.value?.click()
}

async function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  target.value = ''
  try {
    const json = await file.text()
    const res = await chrome.runtime.sendMessage({ type: 'import', payload: { json } }) as { memories?: number; tags?: number; error?: string }
    if (res?.error) throw new Error(res.error)
    const mem = res.memories ?? 0
    const tag = res.tags ?? 0
    showStatus(`导入成功：已导入 ${mem} 条记忆、${tag} 个标签，可在主界面对话中检索使用`, 'ok', 5000)
    await refreshMemoryCount()
  } catch (err) {
    showStatus(`导入失败: ${(err as Error).message}`, 'err', 5000)
  }
}

function showStatus(msg: string, type: 'ok' | 'err', ms = 2000) {
  status.value = msg
  statusType.value = type
  setTimeout(() => { status.value = '' }, ms)
}
</script>

<style scoped>
.options {
  min-height: 100vh;
  background: var(--bg-primary);
}
.options-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-primary);
}
.options-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}
.options-content {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
}
.form-section {
  margin-bottom: 20px;
}
.form-section label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}
.field-hint code {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-hover);
  font-size: 11px;
}
.section-divider {
  border: none;
  border-top: 1px solid var(--border-primary);
  margin: 24px 0 16px;
}
.profile-section {
  margin-bottom: 24px;
}
.profile-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--text-primary);
}
.profile-desc {
  margin-bottom: 12px;
}
.textarea-field {
  resize: vertical;
  min-height: 64px;
}
.profile-stats {
  margin: 12px 0;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-size: 13px;
}
.stat-row {
  margin-bottom: 4px;
}
.stat-row:last-child {
  margin-bottom: 0;
}
.stat-label {
  color: var(--text-secondary);
  margin-right: 6px;
}
.stat-value {
  color: var(--text-primary);
  word-break: break-all;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 24px;
}
.memory-count-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}
.hidden {
  display: none;
}
.status {
  margin-top: 16px;
  font-size: 13px;
}
.status.ok { color: var(--accent-success); }
.status.err { color: var(--accent-danger); }

[data-theme="dark"] .options {
  background: radial-gradient(ellipse at top, rgba(212, 175, 55, 0.05) 0%, #0a0a0a 50%);
}
[data-theme="dark"] .options-header {
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
  background: linear-gradient(90deg, rgba(212, 175, 55, 0.02) 0%, transparent 100%);
}
[data-theme="dark"] .options-header h1 {
  background: linear-gradient(135deg, #f4d03f 0%, #d4af37 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
[data-theme="dark"] .form-section label {
  color: var(--text-secondary);
}
[data-theme="dark"] .input-field,
[data-theme="dark"] select.input-field {
  background: rgba(26, 26, 26, 0.8);
  border: 1px solid rgba(212, 175, 55, 0.2);
  color: var(--text-primary);
}
[data-theme="dark"] .input-field:focus,
[data-theme="dark"] select.input-field:focus {
  border-color: var(--accent-gold);
  box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
}
[data-theme="dark"] .btn-primary {
  background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%);
  color: #0a0a0a;
  box-shadow: 0 2px 8px rgba(212, 175, 55, 0.3);
}
[data-theme="dark"] .btn-primary:hover {
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);
  transform: translateY(-1px);
}
[data-theme="dark"] .btn-secondary {
  background: rgba(212, 175, 55, 0.1);
  color: var(--accent-gold);
  border: 1px solid rgba(212, 175, 55, 0.3);
}
[data-theme="dark"] .btn-secondary:hover {
  background: rgba(212, 175, 55, 0.15);
  border-color: var(--accent-gold);
}
[data-theme="dark"] .status.ok {
  color: var(--accent-gold);
}
[data-theme="dark"] .section-divider {
  border-top-color: rgba(212, 175, 55, 0.2);
}
[data-theme="dark"] .profile-title {
  color: var(--text-primary);
}
[data-theme="dark"] .profile-stats {
  background: rgba(212, 175, 55, 0.06);
  border: 1px solid rgba(212, 175, 55, 0.15);
}
[data-theme="dark"] textarea.input-field,
[data-theme="dark"] .textarea-field {
  background: rgba(26, 26, 26, 0.8);
  border: 1px solid rgba(212, 175, 55, 0.2);
  color: var(--text-primary);
}

.profile-tags-collapse {
  margin: 12px 0;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-primary);
}
.profile-tags-collapse summary {
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  user-select: none;
}
.profile-tags-cloud {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.profile-tag-pill {
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
  font-weight: 500;
  transition: transform 0.15s;
}
.profile-tag-pill:hover {
  transform: scale(1.05);
}
.tag-color-0 { background: #e0f2fe; color: #0369a1; }
.tag-color-1 { background: #fce7f3; color: #9d174d; }
.tag-color-2 { background: #d1fae5; color: #047857; }
.tag-color-3 { background: #fef3c7; color: #b45309; }
.tag-color-4 { background: #e9d5ff; color: #6b21a8; }
.tag-color-5 { background: #fed7aa; color: #c2410c; }
.tag-color-6 { background: #bfdbfe; color: #1d4ed8; }
.tag-color-7 { background: #d6d3d1; color: #44403c; }
.profile-tags-empty {
  font-size: 13px;
  color: var(--text-muted);
}

.custom-tags-section {
  margin-top: 16px;
}
.custom-tags-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}
.custom-tags-input-row .input-field {
  flex: 1;
}
.btn-small {
  padding: 6px 12px;
  font-size: 13px;
}
.custom-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.custom-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 4px 10px;
  border-radius: 999px;
  background: var(--bg-hover);
  font-size: 13px;
  color: var(--text-primary);
}
.custom-tag-remove {
  padding: 0;
  margin: 0;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.custom-tag-remove:hover {
  background: var(--accent-danger);
  color: #fff;
}
.custom-tags-empty-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0 0 8px;
}

[data-theme="dark"] .profile-tags-collapse {
  background: rgba(212, 175, 55, 0.06);
  border-color: rgba(212, 175, 55, 0.2);
}
[data-theme="dark"] .tag-color-0 { background: rgba(56, 189, 248, 0.2); color: #7dd3fc; }
[data-theme="dark"] .tag-color-1 { background: rgba(244, 114, 182, 0.2); color: #f9a8d4; }
[data-theme="dark"] .tag-color-2 { background: rgba(52, 211, 153, 0.2); color: #6ee7b7; }
[data-theme="dark"] .tag-color-3 { background: rgba(251, 191, 36, 0.2); color: #fcd34d; }
[data-theme="dark"] .tag-color-4 { background: rgba(192, 132, 252, 0.2); color: #e9d5ff; }
[data-theme="dark"] .tag-color-5 { background: rgba(251, 146, 60, 0.2); color: #fdba74; }
[data-theme="dark"] .tag-color-6 { background: rgba(96, 165, 250, 0.2); color: #93c5fd; }
[data-theme="dark"] .tag-color-7 { background: rgba(212, 175, 55, 0.15); color: var(--accent-gold); }
[data-theme="dark"] .custom-tag-pill {
  background: rgba(212, 175, 55, 0.12);
  color: var(--text-primary);
}
[data-theme="dark"] .custom-tag-remove:hover {
  background: var(--accent-danger);
  color: #fff;
}
</style>
