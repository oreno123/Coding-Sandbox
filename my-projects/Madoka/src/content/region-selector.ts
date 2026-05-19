/**
 * 区域截图选择器
 * 在页面上显示全屏覆盖层，用户拖拽选择矩形区域
 */

export interface SelectionRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * 创建区域选择覆盖层，用户拖拽选择后 resolve，取消时 reject
 */
export function showRegionSelector(): Promise<SelectionRect> {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div')
    overlay.id = 'madoka-region-selector-overlay'
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      cursor: crosshair;
      background: rgba(0,0,0,0.35);
      user-select: none;
    `

    const hint = document.createElement('div')
    hint.textContent = '拖拽选择截图区域，左键松开后右键确认 / Esc 取消'
    hint.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: #fff;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 2147483648;
      pointer-events: none;
    `

    const selectionBox = document.createElement('div')
    selectionBox.style.cssText = `
      position: fixed;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.15);
      pointer-events: none;
      z-index: 2147483647;
      display: none;
    `

    overlay.appendChild(hint)
    overlay.appendChild(selectionBox)
    document.body.appendChild(overlay)

    let startX = 0
    let startY = 0
    let isSelecting = false

    function finish() {
      overlay.remove()
      document.removeEventListener('keydown', onKeyDown)
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        finish()
        reject(new Error('用户取消'))
      }
    }

    function tryConfirm() {
      const rect = selectionBox.getBoundingClientRect()
      if (rect.width > 2 && rect.height > 2) {
        finish()
        resolve({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    overlay.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return
      isSelecting = true
      startX = e.clientX
      startY = e.clientY
      selectionBox.style.left = `${startX}px`
      selectionBox.style.top = `${startY}px`
      selectionBox.style.width = '0px'
      selectionBox.style.height = '0px'
      selectionBox.style.display = 'block'
    })

    overlay.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isSelecting) return
      const x = Math.min(startX, e.clientX)
      const y = Math.min(startY, e.clientY)
      const w = Math.abs(e.clientX - startX)
      const h = Math.abs(e.clientY - startY)
      selectionBox.style.left = `${x}px`
      selectionBox.style.top = `${y}px`
      selectionBox.style.width = `${w}px`
      selectionBox.style.height = `${h}px`
    })

    let selectionDone = false

    overlay.addEventListener('mouseup', () => {
      if (!isSelecting) return
      isSelecting = false
      const rect = selectionBox.getBoundingClientRect()
      if (rect.width > 2 && rect.height > 2) {
        selectionDone = true
        hint.textContent = '右键确认 / Esc 取消'
      }
    })

    overlay.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault()
      if (selectionDone) tryConfirm()
    })

    document.addEventListener('keydown', onKeyDown)
  })
}

/**
 * 使用 Canvas 裁剪截图
 * @param dataUrl - 完整截图的 Data URL
 * @param rect - 视口坐标下的选区
 */
export function cropScreenshot(
  dataUrl: string,
  rect: SelectionRect
): Promise<string> {
  return new Promise((resolve, reject) => {
    const scale = window.devicePixelRatio || 1
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = rect.width * scale
      canvas.height = rect.height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 Canvas 上下文'))
        return
      }
      ctx.drawImage(
        img,
        rect.left * scale,
        rect.top * scale,
        rect.width * scale,
        rect.height * scale,
        0,
        0,
        rect.width * scale,
        rect.height * scale
      )
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = dataUrl
  })
}
