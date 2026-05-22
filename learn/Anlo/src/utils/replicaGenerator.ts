/**
 * 复刻页面生成器
 * 根据扫描结果和配置生成预览数据
 */

import type { SavedConfig, ExtractResult, ReplicaElementData } from '@/types';

export class ReplicaGenerator {
  /**
   * 从提取结果生成复刻元素数据
   */
  generateFromExtractResults(results: ExtractResult[]): ReplicaElementData[] {
    const replicaData: ReplicaElementData[] = [];

    // 获取页面尺寸
    const pageWidth = document.documentElement.scrollWidth;
    const pageHeight = document.documentElement.scrollHeight;

    results.forEach((result) => {
      const { element, configIndex, label, value } = result;

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

      // 从对应的 SavedConfig 获取 elementType
      const config = result as ExtractResult & { element: HTMLElement };
      const elementType = this.getElementType(config.element);

      replicaData.push({
        configIndex,
        label,
        elementType,
        value,
        x,
        y,
        width,
        height,
      });
    });

    return replicaData;
  }

  /**
   * 判断元素类型（简化版本，与 content.ts 保持一致）
   */
  private getElementType(element: HTMLElement): 'input' | 'select-display' | 'text-display' | 'button' {
    const tagName = element.tagName.toLowerCase();

    // 按钮元素
    if (tagName === 'button' || 
        (tagName === 'input' && ['button', 'submit', 'reset'].includes((element as HTMLInputElement).type)) ||
        (tagName === 'a' && this.isButtonLink(element))) {
      return 'button';
    }

    // 输入元素
    if (tagName === 'input' || tagName === 'textarea') {
      return 'input';
    }

    // 选择显示元素
    if (element.getAttribute('xtype') === 'select' || 
        (element.hasAttribute('data-name') && element.classList.contains('bh-form-static'))) {
      return 'select-display';
    }

    return 'text-display';
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
}

export const replicaGenerator = new ReplicaGenerator();

