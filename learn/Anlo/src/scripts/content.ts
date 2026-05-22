/**
 * Content Script - 主要业务逻辑
 * 在页面上下文中执行，可以访问和操作 DOM
 */

import type { InputInfo, SavedConfig, ExtractResult, ElementType } from '@/types';
import { selectorGenerator } from '@/utils/selectorGenerator';
import { Messenger } from '@/utils/messaging';
import { overlayManager } from '@/utils/overlay-manager';

class AnloContentScript {
  private scannedInputs: InputInfo[] = [];
  private config: SavedConfig[] = [];

  constructor() {
    this.initializeListeners();
    overlayManager.init();
    console.log('🎯 Anlo 内容脚本已加载');
  }

  /**
   * 初始化消息监听
   */
  private initializeListeners(): void {
    Messenger.onMessage(async (message, sender, sendResponse) => {
      const { type, payload } = message;

      try {
        let response;

        switch (type) {
          case 'SCAN_ALL':
            response = this.scanAll();
            break;

          case 'SAVE_BY_INDEXES':
            response = this.saveByIndexes(payload?.indexes || []);
            break;

          case 'EXTRACT_BY_CONFIG':
            response = this.extractByConfig(payload?.config || []);
            break;

          case 'GENERATE_REPLICA_DATA':
            response = this.generateReplicaData(payload?.config || []);
            break;

          case 'HIGHLIGHT_BY_INDEX':
            response = this.highlightByIndex(payload?.index || 0);
            break;

          case 'HIGHLIGHT_BY_CONFIG_INDEX':
            response = this.highlightByConfigIndex(payload);
            break;

          case 'CLEAR_HIGHLIGHT':
            response = this.clearHighlight();
            break;

          default:
            response = { error: `Unknown message type: ${type}` };
        }

        sendResponse(response);
      } catch (error) {
        console.error('❌ Content script error:', error);
        sendResponse({ error: (error as Error).message });
      }
    });
  }

  /**
   * 判断 <a> 标签是否为按钮
   */
  private isButtonLink(element: HTMLElement): boolean {
    return (
      (element.hasAttribute('role') && element.getAttribute('role') === 'button') ||
      element.hasAttribute('data-action') ||
      element.className.includes('btn') ||
      element.className.includes('button')
    );
  }

  /**
   * 判断元素类型
   */
  private getElementType(element: HTMLElement): ElementType {
    const tagName = element.tagName.toLowerCase();
    
    // 按钮元素（包括 <button>、<input type="button/submit/reset"> 和按钮样式的 <a>）
    if (tagName === 'button' || 
        (tagName === 'input' && ['button', 'submit', 'reset'].includes((element as HTMLInputElement).type)) ||
        (tagName === 'a' && this.isButtonLink(element))) {
      return 'button';
    }
    
    // input 和 textarea 都是可编辑输入元素
    if (tagName === 'input' || tagName === 'textarea') {
      return 'input';
    }
    
    // 判断是否为 select-display（可选择的显示元素）
    if (element.getAttribute('xtype') === 'select' || 
        (element.hasAttribute('data-name') && element.classList.contains('bh-form-static'))) {
      return 'select-display';
    }
    
    // 其他带 data-name 的显示元素
    if (element.hasAttribute('data-name')) {
      return 'text-display';
    }
    
    return 'text-display';
  }

  /**
   * 扫描所有可提取元素（输入框、显示元素、按钮等）
   */
  private scanAll(): InputInfo[] {
    this.clearHighlight();

    // ✅ 扫描多种类型的可提取元素，排除 overlay
    const EXCLUDE = ':not([data-anlo-overlay])';
    const elements = document.querySelectorAll(`
      input:not([type="hidden"])${EXCLUDE},
      textarea${EXCLUDE},
      button${EXCLUDE},
      a[class*="btn"]${EXCLUDE},
      a[data-action]${EXCLUDE},
      a[role="button"]${EXCLUDE},
      p[xtype="select"]${EXCLUDE},
      p[data-name]${EXCLUDE},
      span[data-name]${EXCLUDE},
      div.bh-form-static[data-name]${EXCLUDE}
    `.trim());

    this.scannedInputs = [];

    elements.forEach((element, i) => {
      const htmlElement = element as HTMLElement;
      
      // ✅ 双重保险：检查是否为 overlay
      if (htmlElement.hasAttribute('data-anlo-overlay')) {
        console.warn('⚠️ 跳过 overlay 元素');
        return;
      }

      const elementType = this.getElementType(htmlElement);

      // ✅ 使用 overlay 高亮，不修改元素本身样式
      htmlElement.setAttribute('data-anlo-index', String(i));
      overlayManager.createOverlay(`scan-${i}`, htmlElement, {
        color: '#00bfff',
        label: `#${i}`
      });

      // 查找容器和标签
      const parent = htmlElement.parentElement;
      let container = parent?.closest('[data-name]') ||
        parent?.closest('[data-field]') ||
        parent?.closest('[data-caption]') ||
        htmlElement.closest('.bh-form-group') ||
        htmlElement.closest('div[class*="form"]') ||
        htmlElement.closest('div[class*="field"]') ||
        parent;

      const label = container?.querySelector('.bh-form-label, label, [class*="label"]');

      // 根据元素类型提取不同的属性
      let name: string | null = null;
      let id: string | null = null;
      let type: string = '';
      let placeholder: string | null = null;
      let buttonText: string | null = null;
      let disabled: boolean = false;

      if (elementType === 'input') {
        const inputElement = htmlElement as HTMLInputElement | HTMLTextAreaElement;
        name = inputElement.name || null;
        id = inputElement.id || null;
        // textarea 的 type 直接是 'textarea'，input 则使用其 type 属性
        type = htmlElement.tagName.toLowerCase() === 'textarea' 
          ? 'textarea' 
          : (inputElement as HTMLInputElement).type;
        placeholder = inputElement.placeholder || null;
      } else if (elementType === 'button') {
        // 对于按钮，提取按钮文本和状态
        const buttonElement = htmlElement as HTMLButtonElement | HTMLInputElement;
        name = buttonElement.name || null;
        id = buttonElement.id || null;
        type = htmlElement.tagName.toLowerCase() === 'button' 
          ? 'button' 
          : (buttonElement as HTMLInputElement).type;
        
        // 提取按钮文本
        const btnTagName = htmlElement.tagName.toLowerCase();
        if (btnTagName === 'button' || btnTagName === 'a') {
          buttonText = htmlElement.textContent?.trim() || null;
        } else {
          buttonText = (buttonElement as HTMLInputElement).value || null;
        }
        
        // 检查是否禁用（<a> 标签没有 disabled 属性，检查 aria-disabled 或 disabled class）
        if (btnTagName === 'a') {
          disabled = htmlElement.getAttribute('aria-disabled') === 'true' || 
                     htmlElement.classList.contains('disabled');
        } else {
          disabled = buttonElement.disabled || false;
        }
      } else {
        // 对于显示元素，使用 tagName 作为 type
        type = htmlElement.tagName.toLowerCase();
      }

      const info: InputInfo = {
        index: i,
        label: label ? label.textContent?.trim() || null : null,
        name: name,
        id: id,
        type: type,
        elementType: elementType,
        dataName: htmlElement.getAttribute('data-name'),
        xtype: htmlElement.getAttribute('xtype'),
        containerPath: container ? selectorGenerator.generateStableSelector(container) : '',
        placeholder: placeholder,
        buttonText: buttonText,
        disabled: disabled,
      };

      this.scannedInputs.push(info);
    });

    console.log(`🔍 扫描到 ${this.scannedInputs.length} 个可提取元素`);
    return this.scannedInputs;
  }

  /**
   * 根据索引保存配置
   */
  private saveByIndexes(indexes: number[]): SavedConfig[] {
    this.config = [];

    indexes.forEach(i => {
      const info = this.scannedInputs.find(inp => inp.index === i);
      if (!info) {
        console.warn(`⚠️ 序号 ${i} 不存在`);
        return;
      }

      // ✅ 更新 overlay 颜色为绿色（表示已保存）
      overlayManager.updateOverlayColor(`scan-${i}`, '#4caf50');

      this.config.push({
        index: i,
        label: info.label,
        name: info.name,
        containerSelector: info.containerPath,
        fallbackName: info.name,
        placeholder: info.placeholder,
        elementType: info.elementType,
        dataName: info.dataName,
        xtype: info.xtype,
        buttonText: info.buttonText,
      });
    });

    console.log('✅ 已保存配置:', this.config);
    return this.config;
  }

  /**
   * 根据元素类型提取值
   */
  private getElementValue(element: HTMLElement, elementType: ElementType): string {
    if (elementType === 'input') {
      return (element as HTMLInputElement).value;
    } else if (elementType === 'button') {
      // 对于按钮，返回按钮文本
      const tagName = element.tagName.toLowerCase();
      if (tagName === 'button' || tagName === 'a') {
        return element.textContent?.trim() || '';
      } else {
        return (element as HTMLInputElement).value || '';
      }
    } else {
      // 对于显示元素，提取文本内容
      return element.textContent?.trim() || '';
    }
  }

  /**
   * 根据配置提取元素
   */
  private extractByConfig(config: SavedConfig[]): ExtractResult[] {
    if (!config || config.length === 0) {
      console.error('❌ 没有配置');
      return [];
    }

    this.clearHighlight();
    const result: ExtractResult[] = [];

    config.forEach((item, idx) => {
      let element: HTMLElement | null = null;
      let foundMethod = '';

      // 尝试1：通过容器选择器查找
      if (item.containerSelector) {
        try {
          const containers = document.querySelectorAll(item.containerSelector);

          for (const container of containers) {
            let foundElement: HTMLElement | null = null;

          // 根据元素类型查找
          if (item.elementType === 'input') {
            const containerTag = container.tagName.toLowerCase();
            if (containerTag === 'input' || containerTag === 'textarea') {
              foundElement = container as HTMLElement;
            } else {
              foundElement = container.querySelector(
                'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea'
              ) as HTMLElement;
            }
          } else if (item.elementType === 'button') {
            // ✅ 新增：查找按钮（包括 <a> 标签）
            const containerTag = container.tagName.toLowerCase();
            if (containerTag === 'button' || 
                (containerTag === 'input' && ['button', 'submit', 'reset'].includes((container as HTMLInputElement).type)) ||
                (containerTag === 'a' && this.isButtonLink(container as HTMLElement))) {
              foundElement = container as HTMLElement;
            } else {
              foundElement = container.querySelector('button, input[type="button"], input[type="submit"], input[type="reset"], a[class*="btn"], a[data-action], a[role="button"]') as HTMLElement;
            }
            
            // 如果配置了 buttonText，验证按钮文本
            if (foundElement && item.buttonText) {
              const btnTag = foundElement.tagName.toLowerCase();
              const elementText = (btnTag === 'button' || btnTag === 'a')
                ? foundElement.textContent?.trim()
                : (foundElement as HTMLInputElement).value;
              
              if (elementText !== item.buttonText) {
                foundElement = null;  // 文本不匹配，继续查找
              }
            }
          } else {
              // 对于显示元素，优先通过 data-name 查找
              if (item.dataName) {
                foundElement = container.querySelector(`[data-name="${item.dataName}"]`) as HTMLElement;
              }
              
              // 如果没找到，尝试通过 xtype 查找
              if (!foundElement && item.xtype) {
                foundElement = container.querySelector(`[xtype="${item.xtype}"]`) as HTMLElement;
              }
              
              // 如果还是没找到，查找任何带 data-name 的元素
              if (!foundElement) {
                foundElement = container.querySelector('[data-name]') as HTMLElement;
              }
            }

            if (foundElement) {
              if (item.label) {
                const parentContainer = foundElement.closest('.bh-form-group, [class*="form"]');
                const labelEl = parentContainer?.querySelector('.bh-form-label, label, [class*="label"]');

                if (labelEl && labelEl.textContent?.trim() === item.label) {
                  element = foundElement;
                  foundMethod = '容器选择器 + label 匹配';
                  break;
                } else if (!labelEl) {
                  element = foundElement;
                  foundMethod = '容器选择器（无 label 验证）';
                  break;
                }
              } else {
                element = foundElement;
                foundMethod = '容器选择器';
                break;
              }
            }
          }
        } catch (e) {
          console.warn(`⚠️ 容器选择器失效: ${item.containerSelector}`, e);
      }
    }

    // 尝试2：通过 buttonText 查找（针对按钮，包括 <a> 标签）
    if (!element && item.buttonText && item.elementType === 'button') {
      const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"], a[class*="btn"], a[data-action], a[role="button"]') as NodeListOf<HTMLElement>;
      
      for (const btn of buttons) {
        const btnTag = btn.tagName.toLowerCase();
        const btnText = (btnTag === 'button' || btnTag === 'a')
          ? btn.textContent?.trim()
          : (btn as HTMLInputElement).value;
        
        if (btnText === item.buttonText) {
          if (item.label) {
            const container = btn.closest('.bh-form-group, [class*="form"]');
            const labelEl = container?.querySelector('.bh-form-label, label, [class*="label"]');
            
            if (labelEl && labelEl.textContent?.trim() === item.label) {
              element = btn;
              foundMethod = '按钮文本 + label 匹配';
              break;
            }
          } else {
            element = btn;
            foundMethod = '按钮文本';
            break;
          }
        }
      }
    }

    // 尝试3：通过 data-name 属性（针对显示元素）
    if (!element && item.dataName && item.elementType !== 'input' && item.elementType !== 'button') {
        const candidates = document.querySelectorAll(
          `[data-name="${item.dataName}"]`
        ) as NodeListOf<HTMLElement>;

        if (candidates.length === 1) {
          element = candidates[0];
          foundMethod = 'data-name 属性';
        } else if (candidates.length > 1) {
          if (item.label) {
            for (const candidate of candidates) {
              const container = candidate.closest('.bh-form-group, [class*="form"]');
              const labelEl = container?.querySelector('.bh-form-label, label, [class*="label"]');

              if (labelEl && labelEl.textContent?.trim() === item.label) {
                element = candidate;
                foundMethod = 'data-name 属性 + label 匹配';
                break;
              }
            }
          }

          if (!element) {
            element = candidates[0];
            foundMethod = 'data-name 属性（第 1 个）';
          }
        }
      }

    // 尝试4：通过 name 属性（针对 input 和 button 元素）
    if (!element && item.fallbackName && (item.elementType === 'input' || item.elementType === 'button')) {
      let selector = '';
      if (item.elementType === 'input') {
        selector = `input[name="${item.fallbackName}"]:not([type="hidden"]), textarea[name="${item.fallbackName}"]`;
      } else {
        selector = `button[name="${item.fallbackName}"], input[type="button"][name="${item.fallbackName}"], input[type="submit"][name="${item.fallbackName}"], a[name="${item.fallbackName}"]`;
      }
      
      const candidates = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;

        if (candidates.length === 1) {
          element = candidates[0];
          foundMethod = 'name 属性';
        } else if (candidates.length > 1) {
          if (item.label) {
            for (const candidate of candidates) {
              const container = candidate.closest('.bh-form-group, [class*="form"]');
              const labelEl = container?.querySelector('.bh-form-label, label, [class*="label"]');

              if (labelEl && labelEl.textContent?.trim() === item.label) {
                element = candidate;
                foundMethod = 'name 属性 + label 匹配';
                break;
              }
            }
          }

          if (!element) {
            element = candidates[0];
            foundMethod = 'name 属性（第 1 个）';
          }
        }
      }

    // 尝试5：通过 placeholder（针对 input 元素）
    if (!element && item.placeholder && item.elementType === 'input') {
        element = document.querySelector(
          `input[placeholder="${item.placeholder}"]:not([type="hidden"]), textarea[placeholder="${item.placeholder}"]`
        ) as HTMLElement;

        if (element) {
          foundMethod = 'placeholder';
        }
      }

      // 处理结果
      if (element) {
        const value = this.getElementValue(element, item.elementType);
        
        result.push({
          configIndex: idx,
          label: item.label,
          element: element,
          value: value,
          foundBy: foundMethod,
        });

        // ✅ 使用 overlay 高亮提取到的元素
        overlayManager.createOverlay(`extract-${idx}`, element, {
          color: '#ff9800',
          label: `✓${idx}`
        });

        if (idx === 0) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        console.log(`✅ [${idx}] 找到: ${item.label || item.fallbackName || item.name} (via ${foundMethod})`);
      } else {
        console.error(`❌ [${idx}] 未找到: ${item.label || item.fallbackName || item.name}`);
      }
    });

    console.log(`📊 成功提取 ${result.length}/${config.length} 个元素`);
    return result;
  }

  /**
   * 高亮指定索引的元素
   */
  private highlightByIndex(index: number): void {
    const element = document.querySelector(
      `[data-anlo-index="${index}"]`
    ) as HTMLElement;

    if (!element) return;

    // ✅ 使用 overlay 临时高亮
    overlayManager.createOverlay(`highlight-temp`, element, {
      color: '#4caf50',
      label: `#${index}`
    });

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 1秒后移除临时高亮
    setTimeout(() => {
      overlayManager.removeOverlay(`highlight-temp`);
    }, 1000);
  }

  /**
   * 根据配置索引高亮元素（用于预览页面交互）
   * @param payload - 包含配置索引和配置数据，不依赖实例状态，页面刷新后仍可用
   */
  private highlightByConfigIndex(payload: { configIndex: number; config: SavedConfig }): void {
    const { configIndex, config: item } = payload;
    
    // 验证配置数据
    if (!item) {
      console.error(`❌ 配置索引 ${configIndex} 未提供配置数据`);
      return;
    }
    
    // 使用 extractByConfig 的逻辑找到元素
    let element: HTMLElement | null = null;

    // 尝试1：通过容器选择器查找
    if (item.containerSelector) {
      try {
        const containers = document.querySelectorAll(item.containerSelector);

        for (const container of containers) {
          let foundElement: HTMLElement | null = null;

          // 根据元素类型查找
          if (item.elementType === 'input') {
            const containerTag = container.tagName.toLowerCase();
            if (containerTag === 'input' || containerTag === 'textarea') {
              foundElement = container as HTMLElement;
            } else {
              foundElement = container.querySelector(
                'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea'
              ) as HTMLElement;
            }
          } else if (item.elementType === 'button') {
            const containerTag = container.tagName.toLowerCase();
            if (containerTag === 'button' || 
                (containerTag === 'input' && ['button', 'submit', 'reset'].includes((container as HTMLInputElement).type)) ||
                (containerTag === 'a' && this.isButtonLink(container as HTMLElement))) {
              foundElement = container as HTMLElement;
            } else {
              // ✅ 使用 querySelectorAll 查找容器内所有按钮
              const buttons = container.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"], a[class*="btn"], a[data-action], a[role="button"]') as NodeListOf<HTMLElement>;
              
              // ✅ 如果配置了 buttonText，遍历所有按钮找到匹配的
              if (item.buttonText && buttons.length > 0) {
                for (const btn of buttons) {
                  const btnTag = btn.tagName.toLowerCase();
                  const elementText = (btnTag === 'button' || btnTag === 'a')
                    ? btn.textContent?.trim()
                    : (btn as HTMLInputElement).value;
                  
                  if (elementText === item.buttonText) {
                    foundElement = btn;
                    break;
                  }
                }
              } else {
                // 如果没有 buttonText，取第一个按钮
                foundElement = buttons[0] || null;
              }
            }
          } else {
            if (item.dataName) {
              foundElement = container.querySelector(`[data-name="${item.dataName}"]`) as HTMLElement;
            }
            if (!foundElement && item.xtype) {
              foundElement = container.querySelector(`[xtype="${item.xtype}"]`) as HTMLElement;
            }
            if (!foundElement) {
              foundElement = container.querySelector('[data-name]') as HTMLElement;
            }
          }

          if (foundElement) {
            if (item.label) {
              const parentContainer = foundElement.closest('.bh-form-group, [class*="form"]');
              const labelEl = parentContainer?.querySelector('.bh-form-label, label, [class*="label"]');

              if (labelEl && labelEl.textContent?.trim() === item.label) {
                element = foundElement;
                break;
              } else if (!labelEl) {
                element = foundElement;
                break;
              }
            } else {
              element = foundElement;
              break;
            }
          }
        }
      } catch (e) {
        console.warn(`⚠️ 容器选择器失效: ${item.containerSelector}`, e);
      }
    }

    // 找到元素后高亮
    if (element) {
      // 清除之前的临时高亮
      overlayManager.removeOverlay(`highlight-temp`);

      // 使用 overlay 高亮（红色表示用户点击的元素）
      overlayManager.createOverlay(`highlight-temp`, element, {
        color: '#f44336',
        label: `✓${configIndex}`
      });

      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // 2秒后移除高亮
      setTimeout(() => {
        overlayManager.removeOverlay(`highlight-temp`);
      }, 2000);

      console.log(`✅ 已高亮配置 [${configIndex}]: ${item.label || item.name}`);
    } else {
      console.error(`❌ 未找到配置 [${configIndex}]: ${item.label || item.name}`);
    }
  }

  /**
   * 生成复刻页面预览数据（在 content script 中执行，可以访问 DOM）
   */
  private generateReplicaData(config: SavedConfig[]): import('@/types').ReplicaElementData[] {
    const replicaData: import('@/types').ReplicaElementData[] = [];

    // 首先提取元素
    const extractResults = this.extractByConfig(config);

    // 获取页面尺寸
    const pageWidth = document.documentElement.scrollWidth;
    const pageHeight = document.documentElement.scrollHeight;

    extractResults.forEach((result) => {
      const { element, configIndex, label, value } = result;

      try {
        // 获取元素位置和尺寸
        const rect = element.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        // 计算绝对位置（包含滚动）
        const absoluteLeft = rect.left + scrollX;
        const absoluteTop = rect.top + scrollY;

        // 转换为百分比（0-1）
        const x = absoluteLeft / pageWidth;
        const y = absoluteTop / pageHeight;
        const width = rect.width / pageWidth;
        const height = rect.height / pageHeight;

        // 从配置中获取 elementType
        const elementType = config[configIndex]?.elementType || 'text-display';

        replicaData.push({
          configIndex,
          label,
          elementType,
          value,
          x: Math.max(0, Math.min(1, x)),      // 确保在 0-1 范围内
          y: Math.max(0, Math.min(1, y)),
          width: Math.max(0, Math.min(1, width)),
          height: Math.max(0, Math.min(1, height)),
        });
      } catch (error) {
        console.warn(`⚠️ 无法获取元素 [${configIndex}] 的位置信息:`, error);
      }
    });

    console.log(`📊 已生成 ${replicaData.length} 个预览元素数据`);
    return replicaData;
  }

  /**
   * 清除所有高亮
   */
  private clearHighlight(): void {
    // ✅ 清除所有 overlay
    overlayManager.clearAll();

    // 清除元素上的 data-anlo-index 标记
    document.querySelectorAll('[data-anlo-index]:not([data-anlo-overlay])').forEach(element => {
      element.removeAttribute('data-anlo-index');
    });

    console.log('✅ 已清除高亮');
  }

}

// 初始化
const anloContent = new AnloContentScript();

export {};

