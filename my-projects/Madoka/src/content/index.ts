/**
 * Madoka Content Script
 * 处理页面读取、搜索结果解析、Action Space 操作和 PDF 划词翻译
 */

import { MadokaReader } from './reader'
import { MadokaSearchParser } from './parser'
import { MadokaActionParser } from './action-parser'
import { MadokaActionExecutor } from './action-executor'
import { getLinkSummaryPopup } from './link-summary-popup'
import { getTranslationPopup } from './translation-popup'
import { getTranslateButton } from './translate-button'
import { findElementBySelectors, findElementByText } from './selector-generator'
import { scrollToAndHighlight, clearAllHighlights } from './highlighter'
import { initPdfHandler, isPdfViewerPage } from './pdf-handler'
import { showRegionSelector, cropScreenshot } from './region-selector'
import { showImageViewer, closeImageViewer } from './image-viewer'
import type { SearchEngine } from '../shared/types'
import type { ActionParams, ActionStatus } from '../shared/action-types'

// 防止在 iframe 中运行
if (window.top !== window.self) {
  console.log('[Madoka Content] 跳过 iframe')
} else if ((window as unknown as { MadokaContentInitialized?: boolean }).MadokaContentInitialized) {
  console.log('[Madoka Content] 已初始化，跳过')
} else {
  ;(window as unknown as { MadokaContentInitialized: boolean }).MadokaContentInitialized = true

  console.log('[Madoka Content] 已加载:', location.href)

  // 监听消息
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('[Madoka Content] 收到消息:', request.action)

    if (request.action === 'readPage') {
      ;(async () => {
        try {
          const result = await MadokaReader.readCurrentPage()
          sendResponse({
            title: result.meta.title,
            url: result.meta.url,
            content: result.content,
            length: result.content.length,
          })
        } catch (e) {
          console.error('[Madoka Content] 读取页面失败:', e)
          sendResponse({
            error: (e as Error).message,
            title: document.title,
            url: location.href,
            content: '',
            length: 0,
          })
        }
      })()

      return true
    }

    if (request.action === 'parseSearch') {
      try {
        const results = MadokaSearchParser.parseFromHTML(
          request.html as string,
          request.engine as SearchEngine
        )
        sendResponse({ success: true, results })
      } catch (e) {
        console.error('[Madoka Content] 解析搜索结果失败:', e)
        sendResponse({ success: false, error: (e as Error).message, results: [] })
      }
      return true
    }

    if (request.action === 'readHTML') {
      ;(async () => {
        try {
          const result = await MadokaReader.readFromHTML(
            request.html as string,
            request.url as string
          )
          sendResponse({
            success: true,
            title: result.meta.title,
            url: request.url,
            content: result.content,
            markdown: result.markdown,
            length: result.content.length,
          })
        } catch (e) {
          console.error('[Madoka Content] 读取 HTML 失败:', e)
          sendResponse({
            success: false,
            error: (e as Error).message,
            content: '',
            markdown: '',
          })
        }
      })()

      return true
    }

    // ============ Action Space 相关消息 ============

    if (request.action === 'extractActionSpace') {
      ;(async () => {
        try {
          const actionSpace = await MadokaActionParser.extractCurrentPage()
          sendResponse({
            success: true,
            actionSpace,
          })
        } catch (e) {
          console.error('[Madoka Content] 提取 Action Space 失败:', e)
          sendResponse({
            success: false,
            error: (e as Error).message,
          })
        }
      })()

      return true
    }

    if (request.action === 'executeAction') {
      ;(async () => {
        try {
          const actionId = request.actionId as string
          const params = (request.params || {}) as ActionParams

          const result = await MadokaActionExecutor.execute(actionId, params)
          sendResponse({
            success: true,
            result,
          })
        } catch (e) {
          console.error('[Madoka Content] 执行 Action 失败:', e)
          sendResponse({
            success: false,
            error: (e as Error).message,
          })
        }
      })()

      return true
    }

    if (request.action === 'highlightAction') {
      try {
        const actionId = request.actionId as string
        const highlight = request.highlight as boolean
        const status = (request.status || 'pending') as ActionStatus

        if (highlight) {
          MadokaActionExecutor.highlight(actionId, status)
        } else {
          MadokaActionExecutor.unhighlight(actionId)
        }
        sendResponse({ success: true })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    if (request.action === 'clearHighlights') {
      try {
        MadokaActionExecutor.clearAllHighlights()
        sendResponse({ success: true })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    if (request.action === 'validateAction') {
      try {
        const actionId = request.actionId as string

        const result = MadokaActionParser.validateActionId(actionId)
        sendResponse({
          success: true,
          valid: result.valid,
          reason: result.reason,
        })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    if (request.action === 'clearActionIds') {
      try {
        MadokaActionParser.clearActionIds()
        sendResponse({ success: true })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    // ============ 链接总结弹窗 ============

    if (request.action === 'showLinkSummary') {
      try {
        const popup = getLinkSummaryPopup()
        popup.show({
          linkUrl: request.linkUrl as string,
          linkText: request.linkText as string,
        })
        sendResponse({ success: true })
      } catch (e) {
        console.error('[Madoka Content] 显示链接总结弹窗失败:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    // ============ Ping 响应 ============

    if (request.action === 'ping') {
      sendResponse({ success: true, initialized: true })
      return true
    }

    // ============ 高亮和跳转 ============

    if (request.action === 'highlightAndScroll') {
      try {
        const { selectors, text, contextBefore, contextAfter } = request as {
          selectors?: string[]
          text?: string
          contextBefore?: string
          contextAfter?: string
        }

        let element: Element | null = null

        // 策略 1: 使用选择器查找
        if (selectors && selectors.length > 0) {
          element = findElementBySelectors(selectors)
        }

        // 策略 2: 使用文本查找（回退）
        if (!element && text) {
          element = findElementByText(text, contextBefore, contextAfter)
        }

        if (element) {
          // 生成唯一的高亮 ID
          const highlightId = `highlight-${Date.now()}`
          
          // 滚动并高亮
          scrollToAndHighlight(element, highlightId, 'smooth')
          
          sendResponse({ success: true, highlightId })
        } else {
          sendResponse({ success: false, error: '无法找到目标元素' })
        }
      } catch (e) {
        console.error('[Madoka Content] 高亮失败:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    if (request.action === 'clearHighlights') {
      try {
        clearAllHighlights()
        sendResponse({ success: true })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    // ============ 区域截图 ============

    if (request.action === 'showRegionSelector') {
      showRegionSelector()
        .then((rect) => {
          chrome.runtime.sendMessage({ action: 'regionSelected', rect })
        })
        .catch((e: Error) => {
          chrome.runtime.sendMessage({
            action: 'regionSelectorCancelled',
            error: e.message,
          })
        })
      sendResponse({ success: true })
      return true
    }

    if (request.action === 'cropScreenshot') {
      ;(async () => {
        try {
          const dataUrl = request.dataUrl as string
          const rect = request.rect as { left: number; top: number; width: number; height: number }
          const cropped = await cropScreenshot(dataUrl, rect)
          chrome.runtime.sendMessage({ action: 'croppedScreenshot', dataUrl: cropped })
          sendResponse({ success: true })
        } catch (e) {
          chrome.runtime.sendMessage({
            action: 'croppedScreenshotError',
            error: (e as Error).message,
          })
          sendResponse({ success: false, error: (e as Error).message })
        }
      })()
      return true
    }

    // 显示图片查看器
    if (request.action === 'showImageViewer') {
      ;(async () => {
        try {
          const imageUrl = request.imageUrl as string
          showImageViewer(imageUrl)
          sendResponse({ success: true })
        } catch (e) {
          sendResponse({ success: false, error: (e as Error).message })
        }
      })()
      return true
    }

    // 关闭图片查看器
    if (request.action === 'closeImageViewer') {
      closeImageViewer()
      sendResponse({ success: true })
      return true
    }

    return false
  })

  // ============ 划词翻译 ============

  const MAX_TRANSLATE_LENGTH = 500
  const TRANSLATE_DEBOUNCE_MS = 150

  // 翻译模式类型
  type TranslationMode = 'normal' | 'focus' | 'disabled'

  // 当前翻译模式（默认普通模式）
  let currentTranslationMode: TranslationMode = 'normal'

  // 存储键名
  const TRANSLATION_MODE_KEY = 'translationMode'

  // 显示状态提示
  function showTranslationStatus(message: string): void {
    const toast = document.createElement('div')
    toast.textContent = message
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 999999;
      font-size: 14px;
      font-weight: 500;
      font-family: system-ui, -apple-system, sans-serif;
      transition: opacity 0.3s ease;
      pointer-events: none;
      box-shadow: 0 4px 15px rgba(250, 112, 154, 0.4);
    `
    document.body.appendChild(toast)

    setTimeout(() => {
      toast.style.opacity = '0'
      setTimeout(() => toast.remove(), 300)
    }, 2000)
  }

  // 加载翻译模式
  async function loadTranslationMode(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(TRANSLATION_MODE_KEY)
      if (result.translationMode === 'normal' || result.translationMode === 'focus' || result.translationMode === 'disabled') {
        currentTranslationMode = result.translationMode
        console.log('[Madoka Content] 加载翻译模式:', currentTranslationMode)
      }
    } catch (e) {
      console.log('[Madoka Content] 加载翻译模式失败:', e)
    }
  }

  // 监听快捷键 Alt+T 切换模式
  function setupTranslationShortcut(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Alt+T 切换翻译模式
      if (e.altKey && e.key === 't') {
        e.preventDefault() // 阻止默认行为

        // 三种模式循环切换：normal -> focus -> disabled -> normal
        if (currentTranslationMode === 'normal') {
          currentTranslationMode = 'focus'
        } else if (currentTranslationMode === 'focus') {
          currentTranslationMode = 'disabled'
        } else {
          currentTranslationMode = 'normal'
        }

        // 保存状态
        chrome.storage.local.set({ [TRANSLATION_MODE_KEY]: currentTranslationMode }).catch((err) => {
          console.log('[Madoka Content] 保存翻译模式失败:', err)
        })

        // 显示状态提示
        let modeText: string
        if (currentTranslationMode === 'normal') {
          modeText = '常态模式：点击翻译'
        } else if (currentTranslationMode === 'focus') {
          modeText = '专注模式：直接翻译'
        } else {
          modeText = '翻译已禁用'
        }
        showTranslationStatus(modeText)

        console.log('[Madoka Content] 划词翻译模式:', currentTranslationMode)
      }
    })
  }

  /**
   * 检查扩展上下文是否有效
   */
  function isExtensionContextValid(): boolean {
    try {
      return !!chrome.runtime.id
    } catch {
      return false
    }
  }

  // 存储待翻译的文本和位置（用于常态模式）
  let pendingSelection: { text: string; rect: DOMRect } | null = null

  /**
   * 执行翻译
   * @param text - 要翻译的文本
   * @param rect - 选中文本的位置信息
   */
  function performTranslation(text: string, rect?: DOMRect): void {
    // 清除文本选择，防止重复触发翻译
    window.getSelection()?.removeAllRanges()

    const textToTranslate = text.length > MAX_TRANSLATE_LENGTH
      ? text.substring(0, MAX_TRANSLATE_LENGTH)
      : text

    const popup = getTranslationPopup()
    popup.show({
      originalText: textToTranslate,
      isLoading: true,
      rect,
    })

    // 检查扩展上下文是否有效
    if (!isExtensionContextValid()) {
      popup.updateContent({
        originalText: textToTranslate,
        error: '扩展已更新，请刷新页面后重试',
      })
      return
    }

    const langpair = /[\u4e00-\u9fff]/.test(textToTranslate) ? 'zh|en' : 'en|zh'

    // 添加超时处理
    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timeoutId = null
      popup.updateContent({
        originalText: textToTranslate,
        error: '翻译请求超时，请重试',
      })
    }, 15000) // 15秒超时

    // 使用 try-catch 包装 sendMessage，捕获同步错误（如 Extension context invalidated）
    try {
      chrome.runtime.sendMessage(
        { action: 'translate', text: textToTranslate, langpair },
        (response: { success?: boolean; translatedText?: string; error?: string } | undefined) => {
          // 清除超时定时器
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }

          // 检查扩展上下文是否失效
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message || ''
            if (errorMsg.includes('Extension context invalidated') || errorMsg.includes('context invalidated')) {
              popup.updateContent({
                originalText: textToTranslate,
                error: '扩展已更新，请刷新页面后重试',
              })
            } else {
              popup.updateContent({
                originalText: textToTranslate,
                error: errorMsg || '翻译请求失败',
              })
            }
            return
          }
          if (response?.success && response.translatedText) {
            popup.updateContent({
              originalText: textToTranslate,
              translatedText: response.translatedText,
            })
          } else {
            popup.updateContent({
              originalText: textToTranslate,
              error: response?.error || '翻译失败',
            })
          }
        }
      )
    } catch (e) {
      // 捕获同步错误（如 Extension context invalidated）
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      const errorMsg = (e as Error).message || ''
      if (errorMsg.includes('Extension context invalidated') || errorMsg.includes('context invalidated')) {
        popup.updateContent({
          originalText: textToTranslate,
          error: '扩展已更新，请刷新页面后重试',
        })
      } else {
        popup.updateContent({
          originalText: textToTranslate,
          error: '翻译请求失败: ' + errorMsg,
        })
      }
    }
  }

  /** 同步网页划线到 storage，侧边栏实时显示；取消划线即清除 */
  function setupSelectionSync(): void {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const DEBOUNCE_MS = 80

    document.addEventListener('selectionchange', () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        const selection = window.getSelection()
        const text = selection?.toString()?.trim()
        // 排除在翻译弹窗、Madoka UI 内的选区
        const node = selection?.anchorNode || selection?.focusNode
        const parent = !node ? null : node.nodeType === Node.ELEMENT_NODE ? (node as Element) : (node as Node).parentElement
        if (parent?.closest('#madoka-translation-popup, #madoka-translation-overlay, .madoka-translate-button')) return
        if (text) {
          chrome.runtime.sendMessage({
            action: 'setCurrentSelection',
            currentSelection: {
              text,
              url: location.href,
              title: document.title || location.href,
            },
          }).catch(() => {})
        } else {
          chrome.runtime.sendMessage({
            action: 'setCurrentSelection',
            currentSelection: null,
          }).catch(() => {})
        }
      }, DEBOUNCE_MS)
    })
  }

  function setupSelectionTranslate(): void {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    document.addEventListener('mouseup', (e: MouseEvent) => {
      // 只处理左键点击
      if (e.button !== 0) return

      const target = e.target as Element
      if (target?.closest?.('#madoka-translation-popup') || target?.closest?.('#madoka-translation-overlay')) {
        return
      }

      // 检查是否刚刚结束拖动，如果是则不触发翻译
      const popup = getTranslationPopup()
      if (popup.justFinishedDragging) {
        return
      }

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        const selection = window.getSelection()
        const text = selection?.toString()?.trim()
        if (!text || text.length === 0) return

        // 获取选中文本的位置
        let rect: DOMRect | undefined
        if (selection?.rangeCount) {
          rect = selection.getRangeAt(0).getBoundingClientRect()
        }

        if (currentTranslationMode === 'disabled') {
          // 禁用模式：不执行任何操作
          return
        } else if (currentTranslationMode === 'normal') {
          // 常态模式：显示翻译按钮
          pendingSelection = { text, rect: rect || new DOMRect(e.clientX, e.clientY, 0, 0) }
          const translateBtn = getTranslateButton()
          translateBtn.show({
            x: e.clientX,
            y: e.clientY,
            onClick: () => {
              // 点击按钮后执行翻译
              if (pendingSelection) {
                performTranslation(pendingSelection.text, pendingSelection.rect)
                pendingSelection = null
              }
            },
            onDismiss: () => {
              pendingSelection = null
            }
          })
        } else {
          // 专注模式：直接翻译
          performTranslation(text, rect)
        }
      }, TRANSLATE_DEBOUNCE_MS)
    })
  }

  // 初始化
  async function init() {
    // 首先初始化 PDF 处理（显示弹窗提示）
    initPdfHandler()

    // 加载翻译模式
    await loadTranslationMode()

    // 设置快捷键监听
    setupTranslationShortcut()

    // 同步划线到侧边栏（用户一划线即显示，取消即消失）
    setupSelectionSync()
    // 设置划词翻译（在普通页面和 PDF 查看器页面都启用）
    setupSelectionTranslate()

    if (isPdfViewerPage()) {
      console.log('[Madoka Content] PDF 查看器划词翻译已启用，当前模式:', currentTranslationMode, '按 Alt+T 可切换')
    } else {
      console.log('[Madoka Content] 划词翻译已启用，当前模式:', currentTranslationMode, '按 Alt+T 可切换')
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
}
