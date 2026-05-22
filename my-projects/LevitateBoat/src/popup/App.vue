<template>
  <div class="popup">
    <aside :class="['sidebar', { collapsed: sidebarCollapsed }]">
      <div class="sidebar-header">
        <button class="sidebar-toggle" @click="toggleSidebar" title="展开/收起">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 v-if="!sidebarCollapsed" class="sidebar-title">对话历史</h2>
      </div>

      <div v-if="!sidebarCollapsed" class="sidebar-content themed-scrollbar">
        <div class="conversation-list">
          <div
            v-for="conv in conversations"
            :key="conv.id"
            :class="['conversation-item', { active: currentConversationId === conv.id }]"
            @click="switchConversation(conv.id)"
            @contextmenu.prevent="openConvContextMenu($event, conv)"
          >
            <div class="conversation-icon">💬</div>
            <div class="conversation-info">
              <div class="conversation-title">{{ conv.title }}</div>
              <div class="conversation-time">{{ conv.time }}</div>
            </div>
            <button
              class="conversation-delete-btn"
              title="删除对话（含关联记忆）"
              @click.stop="confirmDeleteConversation(conv.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div v-if="!sidebarCollapsed" class="sidebar-footer">
        <button class="new-conversation-btn" @click="showNewConvModal = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>新建对话</span>
        </button>
      </div>
    </aside>

    <!-- 对话项右键菜单：导出本对话记忆 -->
    <Teleport to="body">
      <div
        v-if="convContextMenu"
        class="conv-context-overlay"
        @click="convContextMenu = null"
      >
        <div
          class="conv-context-menu"
          :style="{ left: convContextMenuPos.x + 'px', top: convContextMenuPos.y + 'px' }"
          @click.stop
        >
          <button type="button" class="conv-context-item" @click="exportConversationMemory(convContextMenu)">
            导出本对话记忆
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 新建对话弹窗：话题作标题，风格作本对话偏好 -->
    <Teleport to="body">
      <div v-if="showNewConvModal" class="modal-overlay" @click.self="showNewConvModal = false">
        <div class="modal-card">
          <h3 class="modal-title">新建对话</h3>
          <p class="modal-hint">填写要谈论的话题和喜欢的回复风格，作为本对话的标题与偏好。</p>
          <div class="modal-form">
            <label>话题（作为标题）</label>
            <input v-model="newConvTopic" class="modal-input" placeholder="例如：学习 Vue 3、本周计划" />
            <label>回复风格</label>
            <select v-model="newConvStyle" class="modal-input">
              <option value="">与全局设置一致</option>
              <option value="简洁">简洁</option>
              <option value="适中">适中</option>
              <option value="详细">详细</option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-modal secondary" @click="showNewConvModal = false">取消</button>
            <button type="button" class="btn-modal primary" @click="submitNewConversation">创建</button>
          </div>
        </div>
      </div>
    </Teleport>

    <main class="main-content">
      <header class="popup-header">
        <h1>Levitate Boat</h1>
        <div class="header-actions">
          <button
            class="theme-toggle"
            :title="isDark ? '浅色模式' : '深色模式'"
            @click="toggleTheme"
          />
          <button class="btn-icon" @click="openOptions" title="设置">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <!-- 对话标签栏：便于在多个对话间切换、回看 -->
      <div v-if="visibleTabs.length > 0" class="conversation-tabs-wrap themed-scrollbar">
        <div class="conversation-tabs">
          <div
            v-for="conv in visibleTabs"
            :key="conv.id"
            :class="['tab-item', { active: currentConversationId === conv.id }]"
          >
            <button type="button" class="tab-item-label" :title="conv.title" @click="switchConversation(conv.id)">
              <span class="tab-title">{{ conv.title }}</span>
            </button>
            <button
              type="button"
              class="tab-close-btn"
              title="关闭标签（对话仍保留在左侧）"
              @click.stop="closeTab(conv.id)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div ref="chatAreaRef" class="chat-area themed-scrollbar">
        <div v-if="messages.length === 0" class="empty-state">
          <p>输入问题开始对话</p>
          <p class="hint">记忆将自动检索并辅助回答</p>
        </div>
        <div v-for="(m, i) in messages" :key="i" :class="['msg-row', m.role]">
          <span class="msg-role">{{ m.role === 'user' ? '你' : '助手' }}</span>
          <div :class="['message-bubble', m.role, { 'markdown-content': m.role === 'assistant' }]">
            <template v-if="m.role === 'assistant'">
              <div v-html="renderMarkdown(m.content)" class="markdown-body" />
            </template>
            <template v-else>{{ m.content }}</template>
          </div>
        </div>
        <div v-if="loading" class="msg-row assistant">
          <span class="msg-role">助手</span>
          <div class="message-bubble assistant markdown-content">
            <template v-if="streamingText">
              <div v-html="renderMarkdown(streamingText)" class="markdown-body" />
            </template>
            <span v-else class="loading-dots">...</span>
          </div>
        </div>
        <div ref="chatEndRef" class="chat-end-anchor" />
      </div>

      <div :class="['composer-card', isFocused ? 'focused' : '']">
        <div class="composer-input-wrapper">
          <textarea
            v-model="input"
            class="composer-textarea"
            placeholder="输入问题..."
            rows="1"
            :disabled="loading"
            @keydown.enter.exact.prevent="send"
            @focus="isFocused = true"
            @blur="isFocused = false"
            @input="autoResize"
          />
        </div>
        <div class="composer-toolbar">
          <div class="composer-toolbar-right">
            <button
              class="composer-send-btn"
              :disabled="loading || !input.trim()"
              @click="send"
              title="发送"
            >
              <span v-if="loading" class="spinner" />
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useTheme } from '@/hooks/useTheme'
import { marked } from 'marked'
import {
  ensureConversationsDb,
  listConversations,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation as deleteConversationService,
  type ConversationMessage
} from '@/services/conversation'

const { theme, toggleTheme } = useTheme()
const isDark = computed(() => theme.value === 'dark')

const input = ref('')
const messages = ref<{ role: 'user' | 'assistant'; content: string }[]>([])
const loading = ref(false)
const streamingText = ref('')
const isFocused = ref(false)
const sidebarCollapsed = ref(false)
const conversations = ref<{ id: string; title: string; time: string }[]>([])
const currentConversationId = ref<string | null>(null)
/** 当前对话的回复风格（用于发消息时传给 background） */
const currentConversationPreferredStyle = ref<string>('')
/** 右侧已关闭的标签（仅隐藏标签，不删对话），从左侧再点开会重新出现 */
const closedTabIds = ref<string[]>([])
const chatAreaRef = ref<HTMLElement | null>(null)
const chatEndRef = ref<HTMLElement | null>(null)
const showNewConvModal = ref(false)
const newConvTopic = ref('')
const newConvStyle = ref('')
/** 右键对话时的上下文菜单：当前选中的对话 */
const convContextMenu = ref<{ id: string; title: string } | null>(null)
const convContextMenuPos = ref({ x: 0, y: 0 })

const visibleTabs = computed(() =>
  conversations.value.filter((c) => !closedTabIds.value.includes(c.id))
)

marked.setOptions({ gfm: true, breaks: true })

function renderMarkdown(text: string): string {
  if (!text?.trim()) return ''
  try {
    return marked.parse(text.trim()) as string
  } catch {
    return text
  }
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

async function loadConversationList() {
  const list = await listConversations()
  const mapped = list.map((c) => ({ id: c.id, title: c.title, time: c.time }))
  // 只有拿到非空列表或当前列表为空时才覆盖，避免 listConversations 失败时清空已有列表
  if (mapped.length > 0 || conversations.value.length === 0) {
    conversations.value = mapped
  }
}

async function switchConversation(id: string) {
  closedTabIds.value = closedTabIds.value.filter((x) => x !== id)
  currentConversationId.value = id
  const conv = await getConversation(id)
  if (conv) {
    messages.value = conv.messages.map((m) => ({ role: m.role, content: m.content }))
    currentConversationPreferredStyle.value = (conv as { preferredStyle?: string }).preferredStyle ?? ''
  } else {
    messages.value = []
    currentConversationPreferredStyle.value = ''
  }
}

function closeTab(id: string) {
  closedTabIds.value = [...closedTabIds.value, id]
  if (currentConversationId.value === id) {
    const rest = conversations.value.filter((c) => c.id !== id && !closedTabIds.value.includes(c.id))
    const next = rest[0] ?? conversations.value.find((c) => c.id !== id)
    if (next) switchConversation(next.id)
    else {
      currentConversationId.value = null
      messages.value = []
    }
  }
}

function submitNewConversation() {
  const topic = newConvTopic.value.trim() || '新对话'
  const style = newConvStyle.value.trim()
  showNewConvModal.value = false
  newConvTopic.value = ''
  newConvStyle.value = ''
  doCreateConversation({ title: topic, preferredStyle: style || undefined })
}

async function doCreateConversation(options?: { title?: string; preferredStyle?: string }) {
  try {
    const conv = await createConversation(options)
    const title = options?.title?.trim() || '新对话'
    const newEntry = { id: conv.id, title, time: '刚刚' }
    if (!conversations.value.some((c) => c.id === conv.id)) {
      conversations.value = [newEntry, ...conversations.value]
    }
    currentConversationId.value = conv.id
    currentConversationPreferredStyle.value = options?.preferredStyle ?? ''
    messages.value = []
    await loadConversationList()
  } catch (e) {
    console.error('新建对话失败', e)
  }
}

async function newConversation() {
  showNewConvModal.value = true
}

async function ensureCurrentConversation(): Promise<string> {
  let id = currentConversationId.value
  if (id) {
    const exists = await getConversation(id)
    if (exists) return id
  }
  await doCreateConversation({ title: '新对话' })
  return currentConversationId.value!
}

function openConvContextMenu(e: MouseEvent, conv: { id: string; title: string }) {
  convContextMenu.value = { id: conv.id, title: conv.title }
  convContextMenuPos.value = { x: e.clientX, y: e.clientY }
}

function exportConversationMemory(conv: { id: string; title: string } | null) {
  if (!conv) return
  const convId = conv.id
  const title = conv.title.replace(/[<>:"/\\|?*]/g, '_').slice(0, 50) || '对话'
  convContextMenu.value = null
  chrome.runtime.sendMessage({ type: 'export:byConversationId', payload: { conversationId: convId } }).then((res: { json?: string; memoryCount?: number; error?: string }) => {
    if (res?.error || !res?.json) {
      console.error('导出失败', res?.error)
      return
    }
    const blob = new Blob([res.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `levitate-boat-${title}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }).catch((e) => console.error('导出本对话记忆失败', e))
}

function confirmDeleteConversation(id: string) {
  if (!confirm('确定删除该对话？关联的本轮记忆也会被删除。')) return
  doDeleteConversation(id)
}

async function doDeleteConversation(id: string) {
  const deleteMemory = async (memoryId: string) => {
    await chrome.runtime.sendMessage({ type: 'memory:delete', payload: { id: memoryId } })
  }
  const deleteByConversationId = async (convId: string) => {
    await chrome.runtime.sendMessage({ type: 'memory:deleteByConversationId', payload: { conversationId: convId } })
  }
  await deleteConversationService(id, deleteMemory, deleteByConversationId)
  await loadConversationList()
  if (currentConversationId.value === id) {
    const first = conversations.value[0]
    if (first) {
      await switchConversation(first.id)
    } else {
      currentConversationId.value = null
      messages.value = []
    }
  }
}

function autoResize(e: Event) {
  const ta = e.target as HTMLTextAreaElement
  ta.style.height = 'auto'
  ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
}

function scrollToBottom() {
  nextTick(() => {
    chatEndRef.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

watch([messages, streamingText], () => scrollToBottom(), { deep: true })

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return
  input.value = ''
  let convId: string
  try {
    convId = await ensureCurrentConversation()
  } catch (e) {
    console.error('确保当前对话失败', e)
    return
  }
  const userMsg = { role: 'user' as const, content: text }
  messages.value.push(userMsg)
  scrollToBottom()

  loading.value = true
  streamingText.value = ''

  try {
    const history = messages.value.slice(0, -1)
    streamingText.value = ''
    const res = await chrome.runtime.sendMessage({
      type: 'chatStream',
      payload: {
        input: text,
        history,
        conversationId: convId,
        preferredStyle: currentConversationPreferredStyle.value || undefined
      }
    })
    if (res?.error) throw new Error(res.error)
    const assistantContent = streamingText.value.trim() || ''
    messages.value.push({ role: 'assistant', content: assistantContent })

    const conv = await getConversation(convId)
    if (conv) {
      const now = Date.now()
      const newMessages: ConversationMessage[] = [
        ...conv.messages,
        { role: 'user', content: text, timestamp: now },
        { role: 'assistant', content: assistantContent, timestamp: now }
      ]
      const memoryIds = [...(conv.memoryIds || []), ...(res.memoryIds || [])]
      await updateConversation(convId, { messages: newMessages, memoryIds })
    }

    chrome.runtime.sendMessage({
      type: 'extractMemories',
      payload: { userInput: text, assistantReply: assistantContent, conversationId: convId }
    }).catch(() => {})
  } catch (e) {
    const errMsg = `错误: ${(e as Error).message}`
    messages.value.push({ role: 'assistant', content: errMsg })
    const conv = await getConversation(convId)
    if (conv) {
      const now = Date.now()
      const newMessages: ConversationMessage[] = [
        ...conv.messages,
        { role: 'user', content: text, timestamp: now },
        { role: 'assistant', content: errMsg, timestamp: now }
      ]
      await updateConversation(convId, { messages: newMessages })
    }
  } finally {
    loading.value = false
    streamingText.value = ''
    await loadConversationList()
    scrollToBottom()
  }
}

function openOptions() {
  chrome.runtime.openOptionsPage()
}

function onChatChunk(msg: { type?: string; chunk?: string }) {
  if (msg?.type === 'chatChunk' && loading.value && typeof msg.chunk === 'string') {
    streamingText.value += msg.chunk
  }
}

onMounted(async () => {
  chrome.runtime.onMessage.addListener(onChatChunk)
  try {
    await ensureConversationsDb()
    await loadConversationList()
    if (conversations.value.length === 0) {
      await newConversation()
    } else {
      const id = currentConversationId.value ?? conversations.value[0].id
      await switchConversation(id)
    }
  } catch (e) {
    console.error('初始化对话列表失败', e)
    await newConversation()
  }
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(onChatChunk)
})
</script>

<style scoped>
.popup {
  width: 100%;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  background: var(--bg-primary);
}

.sidebar {
  width: 260px;
  height: 100%;
  min-height: 0;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: 50px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--border-primary);
}

.sidebar-toggle {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  white-space: nowrap;
}

.sidebar-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}

.sidebar-footer {
  flex-shrink: 0;
  padding: 8px;
  border-top: 1px solid var(--border-primary);
}

.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
  position: relative;
}

.conversation-delete-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.conversation-delete-btn:hover {
  opacity: 1;
  color: var(--accent-danger, #c53030);
  background: rgba(197, 48, 48, 0.1);
}

.conversation-item:hover {
  background: var(--bg-hover);
}

.conversation-item.active {
  background: var(--bg-active);
  border-left: 3px solid var(--accent-gold);
}

.conversation-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

.conversation-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.new-conversation-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  background: var(--accent-gold);
  color: var(--text-inverse);
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.new-conversation-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.main-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
}

.popup-header h1 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.conversation-tabs-wrap {
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-primary);
  overflow-x: auto;
  overflow-y: hidden;
}

.conversation-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 12px 0;
  min-height: 36px;
}

.tab-item {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 160px;
  padding: 0;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  transition: background 0.2s, color 0.2s;
}

.tab-item-label {
  flex: 1;
  min-width: 0;
  padding: 6px 4px 6px 12px;
  border: none;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s;
}

.tab-item-label:hover {
  background: var(--bg-hover);
}

.tab-item:hover {
  color: var(--text-primary);
}

.tab-item.active {
  background: var(--bg-active);
  color: var(--text-primary);
  font-weight: 500;
}

.tab-item.active .tab-item-label:hover {
  background: transparent;
}

.tab-close-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  margin-right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s, background 0.2s, color 0.2s;
}

.tab-close-btn:hover {
  opacity: 1;
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-item.active .tab-close-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

.tab-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conv-context-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}
.conv-context-menu {
  position: fixed;
  min-width: 140px;
  padding: 4px 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  box-shadow: var(--shadow-md);
}
.conv-context-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
  color: var(--text-primary);
  background: none;
  border: none;
  cursor: pointer;
}
.conv-context-item:hover {
  background: var(--bg-hover);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-card {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 20px;
  min-width: 280px;
  max-width: 90vw;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-primary);
}
.modal-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--text-primary);
}
.modal-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0 0 16px;
  line-height: 1.4;
}
.modal-form label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
  margin-top: 10px;
}
.modal-form label:first-of-type {
  margin-top: 0;
}
.modal-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
}
.modal-input:focus {
  outline: none;
  border-color: var(--accent-gold, #d4af37);
}
.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
}
.btn-modal {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}
.btn-modal.secondary {
  background: var(--bg-hover);
  color: var(--text-secondary);
}
.btn-modal.primary {
  background: var(--accent-gold);
  color: var(--text-inverse);
}
.btn-modal.primary:hover {
  opacity: 0.9;
}

.chat-area {
  padding: 12px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-muted);
}

.empty-state .hint {
  font-size: 12px;
  margin-top: 8px;
}

.msg-row {
  margin-bottom: 14px;
}

.msg-row .msg-role {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.msg-row .message-bubble {
  display: inline-block;
}

.message-bubble.markdown-content :deep(.markdown-body) {
  line-height: 1.6;
  word-break: break-word;
}

.message-bubble.markdown-content :deep(.markdown-body h1),
.message-bubble.markdown-content :deep(.markdown-body h2),
.message-bubble.markdown-content :deep(.markdown-body h3),
.message-bubble.markdown-content :deep(.markdown-body h4) {
  font-size: 1em;
  font-weight: 600;
  margin: 0.75em 0 0.35em;
  line-height: 1.3;
}

.message-bubble.markdown-content :deep(.markdown-body h1) { font-size: 1.15em; }
.message-bubble.markdown-content :deep(.markdown-body h2) { font-size: 1.08em; }
.message-bubble.markdown-content :deep(.markdown-body h3),
.message-bubble.markdown-content :deep(.markdown-body h4) { font-size: 1em; }

.message-bubble.markdown-content :deep(.markdown-body p) {
  margin: 0.5em 0;
}

.message-bubble.markdown-content :deep(.markdown-body p:first-child) { margin-top: 0; }
.message-bubble.markdown-content :deep(.markdown-body p:last-child) { margin-bottom: 0; }

.message-bubble.markdown-content :deep(.markdown-body code) {
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
  background: var(--bg-hover);
}

.message-bubble.markdown-content :deep(.markdown-body pre) {
  margin: 0.5em 0;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  background: var(--bg-hover);
}

.message-bubble.markdown-content :deep(.markdown-body pre code) {
  padding: 0;
  background: none;
}

.message-bubble.markdown-content :deep(.markdown-body ul),
.message-bubble.markdown-content :deep(.markdown-body ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.message-bubble.markdown-content :deep(.markdown-body li) {
  margin: 0.25em 0;
}

.message-bubble.markdown-content :deep(.markdown-body strong) { font-weight: 600; }
.message-bubble.markdown-content :deep(.markdown-body a) {
  color: var(--accent-gold);
  text-decoration: underline;
}

.chat-end-anchor {
  height: 1px;
  visibility: hidden;
  pointer-events: none;
}

.loading-dots {
  opacity: 0.7;
}

.composer-card {
  flex-shrink: 0;
  margin: 0 12px 12px;
}

[data-theme="dark"] .sidebar {
  background: linear-gradient(180deg, rgba(212, 175, 55, 0.03) 0%, #000000 30%);
  border-right: 1px solid rgba(212, 175, 55, 0.2);
}

[data-theme="dark"] .sidebar-header {
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
}

[data-theme="dark"] .sidebar-footer {
  border-top: 1px solid rgba(212, 175, 55, 0.2);
}

[data-theme="dark"] .sidebar-toggle:hover {
  background: rgba(212, 175, 55, 0.1);
  color: var(--accent-gold);
}

[data-theme="dark"] .conversation-item:hover {
  background: rgba(212, 175, 55, 0.08);
}

[data-theme="dark"] .conversation-item.active {
  background: rgba(212, 175, 55, 0.15);
  border-left: 3px solid var(--accent-gold);
}

[data-theme="dark"] .conversation-title {
  color: var(--text-primary);
}

[data-theme="dark"] .popup-header {
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
  background: linear-gradient(90deg, rgba(212, 175, 55, 0.02) 0%, transparent 100%);
}

[data-theme="dark"] .conversation-tabs-wrap {
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
}

[data-theme="dark"] .tab-item:hover {
  background: rgba(212, 175, 55, 0.08);
  color: var(--text-primary);
}

[data-theme="dark"] .tab-item.active {
  background: rgba(212, 175, 55, 0.15);
  color: var(--accent-gold);
}

[data-theme="dark"] .tab-close-btn:hover {
  background: rgba(212, 175, 55, 0.12);
  color: var(--accent-gold);
}

[data-theme="dark"] .tab-item.active .tab-close-btn:hover {
  background: rgba(212, 175, 55, 0.2);
}

[data-theme="dark"] .popup-header h1 {
  background: linear-gradient(135deg, #f4d03f 0%, #d4af37 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

[data-theme="dark"] .empty-state {
  color: var(--text-secondary);
}

[data-theme="dark"] .composer-card {
  background: rgba(26, 26, 26, 0.8);
  border: 1px solid rgba(212, 175, 55, 0.2);
}

[data-theme="dark"] .composer-card.focused {
  border-color: var(--accent-gold);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.15);
}
</style>
