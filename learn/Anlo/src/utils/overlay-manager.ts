/**
 * Overlay Manager - 管理高亮覆盖层
 * 使用固定定位的覆盖层来高亮元素，不修改原始 DOM 结构
 */

interface OverlayOptions {
  color: string;
  label?: string;
}

interface OverlayData {
  overlay: HTMLDivElement;
  element: HTMLElement;
  options: OverlayOptions;
}

export class OverlayManager {
  private overlays: Map<string, OverlayData> = new Map();
  private animations: Map<string, number> = new Map();
  private scrollHandler?: () => void;
  private resizeHandler?: () => void;

  /**
   * 初始化管理器，设置事件监听
   */
  init(): void {
    // 监听滚动事件（捕获阶段，确保捕获所有滚动容器）
    this.scrollHandler = () => this.updateAllPositions();
    window.addEventListener('scroll', this.scrollHandler, true);

    // 监听窗口调整事件
    this.resizeHandler = () => this.updateAllPositions();
    window.addEventListener('resize', this.resizeHandler);

    console.log('✅ Overlay Manager 已初始化');
  }

  /**
   * 检查元素是否可见
   */
  private isElementVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);

    // 检查 display、visibility、opacity
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;

    // 检查元素尺寸
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    return true;
  }

  /**
   * 查找关联的可见元素（针对隐藏的 input/textarea）
   */
  private findVisibleRelatedElement(hiddenElement: HTMLElement): HTMLElement | null {
    const parent = hiddenElement.parentElement;
    if (!parent) return null;

    // 查找同级或父级的 contenteditable 元素（如 ProseMirror）
    const contentEditable = parent.querySelector('[contenteditable="true"]') as HTMLElement;
    if (contentEditable && this.isElementVisible(contentEditable)) {
      console.log(`🔄 找到关联的可见元素:`, contentEditable);
      return contentEditable;
    }

    // 查找其他可见的同级元素
    const siblings = Array.from(parent.children) as HTMLElement[];
    for (const sibling of siblings) {
      if (sibling !== hiddenElement && this.isElementVisible(sibling)) {
        // 检查是否是输入相关的元素
        if (sibling.classList.contains('ProseMirror') || 
            sibling.classList.contains('editor') ||
            sibling.getAttribute('role') === 'textbox') {
          console.log(`🔄 找到关联的编辑器元素:`, sibling);
          return sibling;
        }
      }
    }

    return null;
  }

  /**
   * 获取元素的位置矩形（处理隐藏元素）
   */
  private getElementRect(element: HTMLElement): DOMRect | null {
    let rect = element.getBoundingClientRect();

    // 如果元素不可见（宽高为0），尝试找关联元素
    if (rect.width === 0 && rect.height === 0) {
      console.warn(`⚠️ 元素不可见:`, element);
      
      const visibleElement = this.findVisibleRelatedElement(element);
      if (visibleElement) {
        rect = visibleElement.getBoundingClientRect();
        console.log(`✅ 使用关联元素的位置进行高亮`);
      } else {
        console.log(`❌ 未找到可见元素，无法高亮`);
        return null;
      }
    }

    return rect;
  }

  /**
   * 更新覆盖层位置
   */
  private updateOverlayPosition(overlay: HTMLDivElement, element: HTMLElement): boolean {
    const rect = this.getElementRect(element);
    if (!rect) {
      overlay.style.display = 'none';
      return false;
    }

    overlay.style.display = 'block';
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    return true;
  }

  /**
   * 创建序号标签
   */
  private createLabel(text: string, color: string): HTMLSpanElement {
    const label = document.createElement('span');
    label.className = 'anlo-overlay-label';
    // ✅ 添加标识属性
    label.setAttribute('data-anlo-overlay', 'true');
    
    label.textContent = text;
    label.style.cssText = `
      position: absolute;
      top: -8px;
      left: -8px;
      background: ${color};
      color: white;
      font-size: 12px;
      font-weight: bold;
      padding: 3px 6px;
      border-radius: 3px;
      z-index: 1;
      pointer-events: none;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    return label;
  }

  /**
   * Hex 颜色转 RGBA（支持 #rgb 和 #rrggbb 格式）
   */
  private hexToRgba(hex: string, alpha: number): string {
    // 移除 # 号
    hex = hex.replace('#', '');
    
    // 处理 #rgb 格式（转换为 #rrggbb）
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // 转换为 RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * 启动脉冲动画
   */
  private startPulseAnimation(id: string, overlay: HTMLDivElement, color: string): void {
    const startTime = performance.now();
    const duration = 2000; // 2秒一个周期

    const animate = (currentTime: number) => {
      // 检查 overlay 是否还存在
      if (!this.overlays.has(id)) {
        return; // 停止动画
      }

      const elapsed = (currentTime - startTime) % duration;
      const progress = elapsed / duration;

      // 正弦波计算脉冲强度
      const intensity = Math.sin(progress * Math.PI * 2);
      const blur = 10 + 10 * Math.abs(intensity);      // 10-20px（适中范围）
      const alpha = 0.5 + 0.3 * Math.abs(intensity);   // 0.5-0.8（适中透明度）

      // 转换颜色为 RGBA
      const rgbaColor = this.hexToRgba(color, alpha);
      overlay.style.boxShadow = `0 0 ${blur}px ${rgbaColor}`;

      // 继续动画
      const animationId = requestAnimationFrame(animate);
      this.animations.set(id, animationId);
    };

    requestAnimationFrame(animate);
  }

  /**
   * 停止脉冲动画
   */
  private stopPulseAnimation(id: string): void {
    const animationId = this.animations.get(id);
    if (animationId) {
      cancelAnimationFrame(animationId);
      this.animations.delete(id);
    }
  }

  /**
   * 创建高亮覆盖层
   */
  createOverlay(id: string, element: HTMLElement, options: OverlayOptions): HTMLDivElement | null {
    // 如果已存在，先移除
    this.removeOverlay(id);

    const rect = this.getElementRect(element);
    if (!rect) {
      console.warn(`❌ 无法为元素创建 overlay（不可见）:`, element);
      return null;
    }

    const overlay = document.createElement('div');
    overlay.className = 'anlo-overlay';
    
    // ✅ 关键：添加特殊标识属性，用于隔离
    overlay.setAttribute('data-anlo-overlay', 'true');
    overlay.setAttribute('data-anlo-id', id);
    
    // ⚠️ 绝对不添加业务相关属性（data-name, data-field 等）

    overlay.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 3px solid ${options.color};
      box-shadow: 0 0 10px ${options.color};
      background-color: ${options.color}15;
      pointer-events: none;
      user-select: none;
      z-index: 2147483647;
      border-radius: 4px;
    `;

    // 添加标签
    if (options.label) {
      const label = this.createLabel(options.label, options.color);
      overlay.appendChild(label);
    }

    // ✅ 直接挂在 body 下，不干扰原始 DOM 结构
    document.body.appendChild(overlay);

    // 保存数据
    this.overlays.set(id, { overlay, element, options });

    // ✨ 智能动画策略：根据 overlay 数量决定是否启用动画
    const overlayCount = this.getCount();
    if (overlayCount <= 20) {
      // 少量元素时启用呼吸灯动画
      this.startPulseAnimation(id, overlay, options.color);
      console.log(`✅ 创建 overlay（带动画）: ${id} [${overlayCount}/20]`);
    } else {
      // 大量元素时使用静态加强阴影（避免性能问题）
      overlay.style.boxShadow = `0 0 20px ${options.color}`;
      console.log(`✅ 创建 overlay（静态）: ${id} [${overlayCount}个，已禁用动画]`);
    }

    return overlay;
  }

  /**
   * 移除指定的覆盖层
   */
  removeOverlay(id: string): void {
    // ✅ 先停止动画
    this.stopPulseAnimation(id);
    
    const data = this.overlays.get(id);
    if (data) {
      data.overlay.remove();
      this.overlays.delete(id);
      console.log(`🗑️ 移除 overlay: ${id}`);
    }
  }

  /**
   * 更新所有覆盖层的位置
   */
  private updateAllPositions(): void {
    this.overlays.forEach((data, id) => {
      const success = this.updateOverlayPosition(data.overlay, data.element);
      if (!success) {
        console.warn(`⚠️ Overlay ${id} 位置更新失败（元素可能不可见）`);
      }
    });
  }

  /**
   * 更新特定覆盖层的颜色
   */
  updateOverlayColor(id: string, color: string): void {
    const data = this.overlays.get(id);
    if (data) {
      data.overlay.style.borderColor = color;
      data.overlay.style.backgroundColor = `${color}15`;
      data.options.color = color;

      // 更新标签颜色
      const label = data.overlay.querySelector('.anlo-overlay-label') as HTMLElement;
      if (label) {
        label.style.background = color;
      }

      // ✨ 重启动画以使用新颜色
      this.stopPulseAnimation(id);
      const overlayCount = this.getCount();
      if (overlayCount <= 20) {
        this.startPulseAnimation(id, data.overlay, color);
      } else {
        data.overlay.style.boxShadow = `0 0 20px ${color}`;
      }
    }
  }

  /**
   * 清除所有覆盖层
   */
  clearAll(): void {
    // ✅ 停止所有动画
    this.animations.forEach((animationId) => {
      cancelAnimationFrame(animationId);
    });
    this.animations.clear();

    // 清除所有 overlay
    this.overlays.forEach((data) => {
      data.overlay.remove();
    });
    this.overlays.clear();
    
    console.log('🧹 已清除所有 overlay 和动画');
  }

  /**
   * 销毁管理器，清理资源
   */
  destroy(): void {
    this.clearAll();  // 会停止所有动画

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler, true);
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }

    console.log('🗑️ Overlay Manager 已销毁');
  }

  /**
   * 获取当前 overlay 数量
   */
  getCount(): number {
    return this.overlays.size;
  }
}

// 导出单例
export const overlayManager = new OverlayManager();

