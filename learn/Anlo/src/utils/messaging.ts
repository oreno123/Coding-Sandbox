/**
 * 消息通信工具
 * 用于 content script 和 background script 的通信
 */

import type { Message, SavedConfig, ExtractResult, InputInfo } from '@/types';

export class Messenger {
  /**
   * 从 sidepanel 发送消息到 content script
   */
  static async sendToContent(type: string, payload?: any): Promise<any> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) throw new Error('No active tab');

    return chrome.tabs.sendMessage(tab.id, {
      type,
      payload,
    } as Message);
  }

  /**
   * 从 content script 发送消息到 background
   */
  static sendToBackground(type: string, payload?: any): void {
    chrome.runtime.sendMessage({
      type,
      payload,
    } as Message);
  }

  /**
   * 在 content script 中监听消息
   */
  static onMessage(
    listener: (message: Message, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void | Promise<any>
  ): void {
    chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
      const result = listener(message, sender, sendResponse);

      // 如果返回 Promise，自动处理异步响应
      if (result instanceof Promise) {
        result
          .then(response => sendResponse(response))
          .catch(error => sendResponse({ error: error.message }));
        return true; // 保持连接打开
      }

      return false;
    });
  }

  /**
   * 获取当前标签页信息
   */
  static async getCurrentTab(): Promise<chrome.tabs.Tab> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');
    return tab;
  }

  /**
   * 在 content script 中执行函数
   */
  static async executeInContent(func: Function, args?: any[]): Promise<any> {
    const tab = await this.getCurrentTab();
    if (!tab.id) throw new Error('No tab id');

    return chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: func as any,
      args: args || [],
    }).then(results => results[0]?.result);
  }
}

