/**
 * 选择器生成工具
 * 用于生成稳定的 CSS 选择器
 */

export class SelectorGenerator {
  /**
   * 检查 ID 是否稳定
   */
  private isStableId(id: string): boolean {
    if (!id) return false;
    // 排除动态生成的 ID
    return !id.match(/jqx|random|dynamic|\d{6,}/i);
  }

  /**
   * 提取稳定的 class
   */
  private getStableClasses(element: Element): string[] {
    if (!element.className || typeof element.className !== 'string') {
      return [];
    }

    return element.className
      .split(' ')
      .filter(c => c && !c.match(/jqx|random|dynamic|\d{5,}/i))
      .slice(0, 2);
  }

  /**
   * 检查是否有相同的兄弟元素
   */
  private hasSimilarSiblings(element: Element, selector: string): boolean {
    const parent = element.parentElement;
    if (!parent) return false;

    try {
      const matches = parent.querySelectorAll(`:scope > ${selector}`);
      return matches.length > 1;
    } catch {
      return true; // 保守起见，如果选择器有问题，也添加序号
    }
  }

  /**
   * 获取元素在父元素中的 nth-child 索引
   */
  private getNthChildIndex(element: Element): number {
    if (!element.parentElement) return 1;
    const children = Array.from(element.parentElement.children);
    return children.indexOf(element) + 1;
  }

  /**
   * 生成稳定的容器选择器
   */
  generateStableSelector(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;
    let depth = 0;

    while (current && current !== document.body && depth < 5) {
      const parent: Element | null = current.parentElement;
      if (!parent) break;

      let selector = current.tagName.toLowerCase();

      // 1. 检查是否有稳定的 id
      if (current.id && this.isStableId(current.id)) {
        selector += `#${current.id}`;
        parts.unshift(selector);
        break; // id 唯一，停止
      }

      // 2. 添加稳定的 class
      const stableClasses = this.getStableClasses(current);
      if (stableClasses.length > 0) {
        selector += '.' + stableClasses.join('.');
      }

      // 3. 检查唯一属性
      const uniqueAttrs = ['data-name', 'data-field', 'data-caption', 'emap-role', 'data-role', 'xtype'];
      let foundUniqueAttr = false;

      for (const attr of uniqueAttrs) {
        if (current.hasAttribute(attr)) {
          const value = current.getAttribute(attr);
          if (value) {
            selector += `[${attr}="${value}"]`;
            foundUniqueAttr = true;
            break;
          }
        }
      }

      // 4. 如果没有唯一标识，检查是否需要添加 nth-child
      if (!foundUniqueAttr && parent) {
        const baseSelector = selector;
        if (this.hasSimilarSiblings(current, baseSelector)) {
          const index = this.getNthChildIndex(current);
          selector += `:nth-child(${index})`;
        }
      }

      parts.unshift(selector);
      current = parent;
      depth++;
    }

    return parts.join(' > ');
  }

  /**
   * 根据配置查找元素（通用版本，支持多种元素类型）
   */
  findElementBySelector(selector: string): HTMLElement | null {
    try {
      const element = document.querySelector(selector);
      if (element) {
        return element as HTMLElement;
      }
    } catch (e) {
      console.warn(`❌ 选择器失效: ${selector}`, e);
    }

    return null;
  }

  /**
   * 根据配置查找输入框（向后兼容，支持 input 和 textarea）
   */
  findInputBySelector(selector: string): HTMLInputElement | HTMLTextAreaElement | null {
    try {
      const elements = document.querySelectorAll(selector);

      for (const element of elements) {
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea') {
          return element as HTMLInputElement | HTMLTextAreaElement;
        }

        const input = element.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea');
        if (input) {
          return input as HTMLInputElement | HTMLTextAreaElement;
        }
      }
    } catch (e) {
      console.warn(`❌ 选择器失效: ${selector}`, e);
    }

    return null;
  }
}

export const selectorGenerator = new SelectorGenerator();

