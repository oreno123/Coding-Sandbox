/**
 * Chrome Messaging API 封装
 */

import type {
  AppConfig,
  ChatRequest,
  BackgroundMessage,
  SearchEngine,
} from './types'

/**
 * 发送消息到 Background Service Worker
 */
export async function sendToBackground<T = unknown>(
  message: Record<string, unknown>,
  timeoutMs = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Message timeout'))
    }, timeoutMs)
    
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer)
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(response as T)
      }
    })
  })
}

/**
 * 找项目：通过长连接 Port 调用，避免长时间请求导致 message port closed
 */
export function sendGitHubSearch(userQuery: string): Promise<{
  success: boolean
  query?: string
  items?: Array<{
    full_name: string
    html_url: string
    description: string
    stargazers_count: number
    language: string
    updated_at: string
  }>
  error?: string
}> {
  return new Promise((resolve, reject) => {
    let settled = false
    try {
      const port = chrome.runtime.connect({ name: 'madoka-github-search' })
      const onMessage = (msg: unknown) => {
        if (settled) return
        settled = true
        port.onMessage.removeListener(onMessage)
        port.disconnect()
        resolve(msg as Parameters<typeof resolve>[0])
      }
      port.onMessage.addListener(onMessage)
      port.onDisconnect.addListener(() => {
        if (settled) return
        if (chrome.runtime.lastError) {
          settled = true
          reject(new Error(chrome.runtime.lastError.message))
        }
      })
      port.postMessage({ type: 'githubSearch', userQuery })
    } catch (e) {
      if (!settled) {
        settled = true
        reject(e)
      }
    }
  })
}

/**
 * 发送消息到 Content Script
 */
export async function sendToContentScript<T = unknown>(
  tabId: number,
  message: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(response as T)
      }
    })
  })
}

/**
 * 获取当前活动标签页
 */
export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab || null
}

/**
 * 获取配置
 */
export async function getConfig(): Promise<AppConfig> {
  return sendToBackground<AppConfig>({ action: 'getConfig' })
}

/**
 * 保存配置
 */
export async function saveConfig(
  config: Partial<AppConfig>
): Promise<{ success: boolean }> {
  return sendToBackground<{ success: boolean }>({
    action: 'saveConfig',
    config,
  })
}

/**
 * 发送聊天请求
 */
export function sendChatRequest(
  message: string,
  options: {
    history: { role: string; content: string }[]
    forceSearch: boolean
    engine: SearchEngine
    pageContent?: string
    tabId?: number
  }
): void {
  const request: ChatRequest = {
    action: 'chat',
    message,
    history: options.history,
    forceSearch: options.forceSearch,
    engine: options.engine,
    pageContent: options.pageContent,
    tabId: options.tabId,
  }

  chrome.runtime.sendMessage(request)
}

/**
 * 监听来自 Background 的消息
 */
export function onBackgroundMessage(
  callback: (message: BackgroundMessage) => void
): () => void {
  const listener = (message: BackgroundMessage) => {
    callback(message)
  }

  chrome.runtime.onMessage.addListener(listener)

  return () => {
    chrome.runtime.onMessage.removeListener(listener)
  }
}

/**
 * 读取当前页面内容
 */
export async function readCurrentPage(tabId: number): Promise<{
  title: string
  url: string
  content: string
  length: number
} | null> {
  try {
    const response = await sendToContentScript<{
      title: string
      url: string
      content: string
      length: number
      error?: string
    }>(tabId, { action: 'readPage' })

    if (response.error) {
      console.error('[Messaging] 读取页面失败:', response.error)
      return null
    }

    return response
  } catch (e) {
    console.error('[Messaging] 读取页面失败:', e)
    return null
  }
}
