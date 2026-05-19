/**
 * 翻译按钮组件
 * 用于常态模式下显示翻译选项按钮
 */

export interface TranslateButtonOptions {
  /** 按钮 X 坐标（鼠标位置） */
  x: number
  /** 按钮 Y 坐标（鼠标位置） */
  y: number
  /** 点击按钮时的回调 */
  onClick: () => void
  /** 按钮消失时的回调 */
  onDismiss?: () => void
}

/**
 * 翻译按钮类
 * 管理翻译按钮的显示、隐藏和交互
 */
export class TranslateButton {
  private element: HTMLElement | null = null
  private dismissTimer: ReturnType<typeof setTimeout> | null = null
  private dismissCallback: (() => void) | null = null

  /**
   * 显示翻译按钮
   * @param options - 按钮配置选项
   */
  show(options: TranslateButtonOptions): void {
    // 如果已有按钮，先销毁
    this.destroy()

    // 保存回调
    this.dismissCallback = options.onDismiss || null

    // 创建按钮元素
    const button = document.createElement('div')
    button.className = 'madoka-translate-button'
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <span>翻译</span>
    `

    // 设置样式 - 使用粉色渐变主题
    const styles: Record<string, string> = {
      position: 'fixed',
      left: `${options.x}px`,
      top: `${options.y + 12}px`,
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      color: 'white',
      borderRadius: '20px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      boxShadow: '0 4px 15px rgba(250, 112, 154, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2) inset',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      userSelect: 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      animation: 'madoka-translate-btn-in 0.2s ease-out'
    }

    Object.assign(button.style, styles)

    // 添加动画样式
    if (!document.getElementById('madoka-translate-btn-styles')) {
      const style = document.createElement('style')
      style.id = 'madoka-translate-btn-styles'
      style.textContent = `
        @keyframes madoka-translate-btn-in {
          from {
            opacity: 0;
            transform: translateY(-5px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes madoka-translate-btn-out {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.95);
          }
        }
        .madoka-translate-button.madoka-hiding {
          animation: madoka-translate-btn-out 0.15s ease-in forwards;
        }
      `
      document.head.appendChild(style)
    }

    // 悬停效果
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)'
      button.style.boxShadow = '0 6px 20px rgba(250, 112, 154, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.3) inset'
      // 悬停时暂停自动消失
      if (this.dismissTimer) {
        clearTimeout(this.dismissTimer)
        this.dismissTimer = null
      }
    })

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)'
      button.style.boxShadow = '0 4px 15px rgba(250, 112, 154, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2) inset'
      // 恢复自动消失计时
      this.startDismissTimer()
    })

    // 点击翻译
    button.addEventListener('click', (e) => {
      e.stopPropagation()
      e.preventDefault()
      options.onClick()
      this.destroy()
    })

    // 添加到页面
    document.body.appendChild(button)
    this.element = button

    // 启动自动消失计时器
    this.startDismissTimer()

    // 点击其他地方消失
    const dismissOnClick = (e: MouseEvent) => {
      if (!button.contains(e.target as Node)) {
        this.destroy()
        document.removeEventListener('mousedown', dismissOnClick)
      }
    }

    // 延迟绑定点击事件，避免立即触发
    setTimeout(() => {
      document.addEventListener('mousedown', dismissOnClick)
    }, 100)
  }

  /**
   * 启动自动消失计时器
   */
  private startDismissTimer(): void {
    // 清除现有计时器
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer)
    }

    // 3秒后自动消失
    this.dismissTimer = setTimeout(() => {
      this.destroyWithAnimation()
    }, 3000)
  }

  /**
   * 带动画的销毁
   */
  private destroyWithAnimation(): void {
    if (this.element) {
      this.element.classList.add('madoka-hiding')
      setTimeout(() => {
        this.destroy()
      }, 150)
    }
  }

  /**
   * 销毁按钮
   */
  destroy(): void {
    // 清除计时器
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer)
      this.dismissTimer = null
    }

    // 移除元素
    if (this.element) {
      this.element.remove()
      this.element = null
    }

    // 执行回调
    if (this.dismissCallback) {
      this.dismissCallback()
      this.dismissCallback = null
    }
  }

  /**
   * 检查按钮是否可见
   */
  isVisible(): boolean {
    return this.element !== null && this.element.isConnected
  }
}

// 单例实例
let translateButtonInstance: TranslateButton | null = null

/**
 * 获取翻译按钮实例（单例模式）
 */
export function getTranslateButton(): TranslateButton {
  if (!translateButtonInstance) {
    translateButtonInstance = new TranslateButton()
  }
  return translateButtonInstance
}
