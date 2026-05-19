/**
 * 图片查看器 - Content Script 版本
 * 在网页上创建全屏覆盖层显示图片
 */

interface ImageViewerState {
  imageUrl: string | null
  viewerElement: HTMLDivElement | null
}

const state: ImageViewerState = {
  imageUrl: null,
  viewerElement: null
}

/**
 * 创建图片查看器覆盖层
 */
function createImageViewer(imageUrl: string): HTMLDivElement {
  // 创建覆盖层
  const overlay = document.createElement('div')
  overlay.id = 'madoka-image-viewer-overlay'
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    backdrop-filter: blur(4px);
  `

  // 创建图片容器
  const imageContainer = document.createElement('div')
  imageContainer.style.cssText = `
    position: relative;
    max-width: 95vw;
    max-height: 95vh;
  `

  // 创建图片
  const img = document.createElement('img')
  img.src = imageUrl
  img.alt = 'Preview'
  img.style.cssText = `
    max-width: 100%;
    max-height: 95vh;
    border-radius: 8px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    border: 2px solid rgba(255, 255, 255, 0.1);
    object-fit: contain;
  `
  
  // 阻止点击图片时关闭
  img.addEventListener('click', (e) => {
    e.stopPropagation()
  })

  // 创建关闭按钮
  const closeBtn = document.createElement('button')
  closeBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 18L18 6M6 6l12 12"/>
    </svg>
  `
  closeBtn.style.cssText = `
    position: absolute;
    top: -48px;
    right: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    backdrop-filter: blur(8px);
  `
  closeBtn.addEventListener('mouseover', () => {
    closeBtn.style.background = 'rgba(0, 0, 0, 0.8)'
  })
  closeBtn.addEventListener('mouseout', () => {
    closeBtn.style.background = 'rgba(0, 0, 0, 0.6)'
  })

  imageContainer.appendChild(img)
  imageContainer.appendChild(closeBtn)
  overlay.appendChild(imageContainer)

  // 点击关闭
  const closeViewer = () => {
    overlay.style.opacity = '0'
    overlay.style.transition = 'opacity 0.2s'
    setTimeout(() => {
      overlay.remove()
      state.viewerElement = null
      state.imageUrl = null
    }, 200)
  }

  overlay.addEventListener('click', closeViewer)
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    closeViewer()
  })

  // Esc 键关闭
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeViewer()
      document.removeEventListener('keydown', handleEsc)
    }
  }
  document.addEventListener('keydown', handleEsc)

  // 淡入动画
  overlay.style.opacity = '0'
  overlay.style.transition = 'opacity 0.2s'
  setTimeout(() => {
    overlay.style.opacity = '1'
  }, 10)

  return overlay
}

/**
 * 显示图片查看器
 */
export function showImageViewer(imageUrl: string) {
  // 如果已有查看器，先关闭
  if (state.viewerElement) {
    state.viewerElement.remove()
  }

  const viewer = createImageViewer(imageUrl)
  document.body.appendChild(viewer)
  state.viewerElement = viewer
  state.imageUrl = imageUrl
}

/**
 * 关闭图片查看器
 */
export function closeImageViewer() {
  if (state.viewerElement) {
    state.viewerElement.remove()
    state.viewerElement = null
    state.imageUrl = null
  }
}
