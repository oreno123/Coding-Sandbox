/**
 * PDF Handler - PDF 查看器弹窗处理
 * 当用户访问 PDF 文件时，显示弹窗提示使用 Madoka 查看
 */

// 弹窗样式配置
const POPUP_STYLES = {
  container: `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 280px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
    overflow: hidden;
    animation: madoka-pdf-popup-slide-in 0.3s ease-out;
  `,
  header: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.15);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  `,
  title: `
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
    font-size: 14px;
    font-weight: 600;
  `,
  closeBtn: `
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  `,
  content: `
    padding: 16px;
    color: white;
  `,
  message: `
    font-size: 13px;
    line-height: 1.5;
    margin-bottom: 12px;
    opacity: 0.95;
  `,
  button: `
    width: 100%;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.95);
    border: none;
    border-radius: 8px;
    color: #667eea;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  `,
  buttonHover: `
    background: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  `,
}

// 添加动画样式
function addPopupAnimation(): void {
  if (document.getElementById('madoka-pdf-popup-styles')) return

  const style = document.createElement('style')
  style.id = 'madoka-pdf-popup-styles'
  style.textContent = `
    @keyframes madoka-pdf-popup-slide-in {
      from {
        opacity: 0;
        transform: translateX(100px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @keyframes madoka-pdf-popup-slide-out {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100px);
      }
    }
    .madoka-pdf-popup-closing {
      animation: madoka-pdf-popup-slide-out 0.3s ease-in forwards !important;
    }
  `
  document.head.appendChild(style)
}

/**
 * 检测 URL 是否为 PDF 文件
 */
export function isPdfUrl(url: string): boolean {
  if (!url) return false

  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.toLowerCase()

    // 检查文件扩展名
    if (pathname.endsWith('.pdf')) return true

    // 检查 URL 参数中是否包含 .pdf
    if (pathname.includes('.pdf?') || pathname.includes('.pdf#')) return true

    return false
  } catch {
    return false
  }
}

/**
 * 获取 PDF.js 查看器 URL
 * 直接重定向到官方 viewer
 */
export function getPdfViewerUrl(pdfUrl: string): string {
  const viewerUrl = chrome.runtime.getURL('public/pdfjs/web/viewer.html')
  return `${viewerUrl}?file=${encodeURIComponent(pdfUrl)}`
}

/**
 * 检查当前页面是否为 PDF.js 查看器
 */
export function isPdfViewerPage(): boolean {
  return window.location.href.includes('/public/pdfjs/web/viewer.html')
}

/**
 * 显示 PDF 查看器弹窗
 */
export function showPdfViewerPopup(pdfUrl: string): void {
  // 检查是否已经显示过弹窗（避免重复显示）
  if (document.getElementById('madoka-pdf-popup')) return

  // 添加动画样式
  addPopupAnimation()

  // 创建弹窗容器
  const popup = document.createElement('div')
  popup.id = 'madoka-pdf-popup'
  popup.style.cssText = POPUP_STYLES.container

  // 创建头部
  const header = document.createElement('div')
  header.style.cssText = POPUP_STYLES.header

  const title = document.createElement('div')
  title.style.cssText = POPUP_STYLES.title
  title.innerHTML = '🌸 <span>Madoka PDF 查看器</span>'

  const closeBtn = document.createElement('button')
  closeBtn.style.cssText = POPUP_STYLES.closeBtn
  closeBtn.innerHTML = '×'
  closeBtn.title = '关闭'
  closeBtn.addEventListener('click', () => closePopup(popup))
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.3)'
  })
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.2)'
  })

  header.appendChild(title)
  header.appendChild(closeBtn)

  // 创建内容区域
  const content = document.createElement('div')
  content.style.cssText = POPUP_STYLES.content

  const message = document.createElement('div')
  message.style.cssText = POPUP_STYLES.message
  message.textContent = '检测到 PDF 文件，使用 Madoka 查看器获得更好的阅读体验，支持划词翻译。'

  const button = document.createElement('button')
  button.style.cssText = POPUP_STYLES.button
  button.innerHTML = '📖 使用 Madoka 查看'

  button.addEventListener('click', () => {
    window.location.href = getPdfViewerUrl(pdfUrl)
  })

  button.addEventListener('mouseenter', () => {
    button.style.cssText = POPUP_STYLES.button + POPUP_STYLES.buttonHover
  })

  button.addEventListener('mouseleave', () => {
    button.style.cssText = POPUP_STYLES.button
  })

  content.appendChild(message)
  content.appendChild(button)

  popup.appendChild(header)
  popup.appendChild(content)

  document.body.appendChild(popup)

  console.log('[Madoka PDF] 显示查看器弹窗:', pdfUrl)

  // 5秒后自动关闭弹窗
  setTimeout(() => {
    if (document.body.contains(popup)) {
      closePopup(popup)
    }
  }, 8000)
}

/**
 * 关闭弹窗
 */
function closePopup(popup: HTMLElement): void {
  popup.classList.add('madoka-pdf-popup-closing')
  setTimeout(() => {
    if (document.body.contains(popup)) {
      popup.remove()
    }
  }, 300)
}

/**
 * 在 PDF 查看器页面初始化划词翻译
 */
function initPdfTranslation(): void {
  // 等待 PDF 加载完成
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'PDF_LOADED') {
      console.log('[Madoka PDF] PDF 已加载，划词翻译已就绪')
    }
  })

  // 如果 PDF 已经加载（页面刷新等情况）
  if (document.querySelector('.pdf-page')) {
    console.log('[Madoka PDF] PDF 页面已存在，划词翻译已就绪')
  }
}

/**
 * 初始化 PDF 处理
 * 在 content script 中调用
 */
export function initPdfHandler(): void {
  // 如果当前是 PDF 文件，显示弹窗提示
  if (isPdfUrl(window.location.href) && !isPdfViewerPage()) {
    console.log('[Madoka PDF] 检测到 PDF 文件，显示查看器弹窗:', window.location.href)

    // 等待页面加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        showPdfViewerPopup(window.location.href)
      })
    } else {
      showPdfViewerPopup(window.location.href)
    }
    return
  }

  // 如果当前是 PDF 查看器页面，初始化划词翻译
  if (isPdfViewerPage()) {
    console.log('[Madoka PDF] PDF 查看器页面，初始化划词翻译')
    initPdfTranslation()
  }
}
