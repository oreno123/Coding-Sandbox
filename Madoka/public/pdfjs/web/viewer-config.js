/**
 * Madoka PDF Viewer Configuration
 * 参考 PDFTranslate 的实现方式，确保在 viewer 完全初始化后再打开 PDF
 */

console.log('[Madoka PDF] viewer-config.js 开始加载');

// 解析 URL 参数获取 PDF URL
const urlParams = new URLSearchParams(window.location.search);
const fileParam = urlParams.get('file');

console.log('[Madoka PDF] URL 参数 file:', fileParam);

/**
 * 等待 PDFViewerApplication 初始化完成
 * 使用 initializedPromise 确保可靠性
 */
async function waitForPDFViewerApplication() {
  // 首先等待 PDFViewerApplication 对象存在
  let attempts = 0;
  const maxAttempts = 200; // 200 * 50ms = 10s

  while (!window.PDFViewerApplication && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 50));
    attempts++;
  }

  if (!window.PDFViewerApplication) {
    throw new Error('[Madoka PDF] 等待 PDFViewerApplication 超时');
  }

  console.log('[Madoka PDF] PDFViewerApplication 对象已存在');

  // 等待 initializedPromise 完成
  // 这确保 _initializeViewerComponents 已经完全执行
  await window.PDFViewerApplication.initializedPromise;

  console.log('[Madoka PDF] PDFViewerApplication 初始化完成');
  return window.PDFViewerApplication;
}

/**
 * 打开 PDF 文件
 */
async function openPdf() {
  if (!fileParam) {
    console.warn('[Madoka PDF] 未找到 file 参数');
    return;
  }

  const decodedUrl = decodeURIComponent(fileParam);
  console.log('[Madoka PDF] 解码后的 URL:', decodedUrl);

  try {
    // 等待 PDFViewerApplication 初始化完成
    const app = await waitForPDFViewerApplication();

    console.log('[Madoka PDF] 准备打开 PDF:', decodedUrl);

    // 配置选项
    const options = {
      url: decodedUrl,
      httpHeaders: {
        'Accept': 'application/pdf'
      }
    };

    // 使用 open 方法打开 PDF
    await app.open(options);
    console.log('[Madoka PDF] PDF 打开成功');

  } catch (error) {
    console.error('[Madoka PDF] 打开 PDF 失败:', error);
  }
}

// ==================== 划词翻译功能 ====================

/**
 * 创建翻译弹窗
 */
function createTranslationPopup() {
  // 移除已存在的弹窗
  const existingPopup = document.getElementById('madoka-pdf-translation-popup');
  if (existingPopup) {
    existingPopup.remove();
  }

  const popup = document.createElement('div');
  popup.id = 'madoka-pdf-translation-popup';
  popup.style.cssText = `
    position: fixed;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 2px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 999999;
    min-width: 280px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: none;
    animation: madoka-popup-appear 0.2s ease-out;
  `;

  popup.innerHTML = `
    <div style="
      background: #fff;
      border-radius: 10px;
      overflow: hidden;
    ">
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <span style="color: #fff; font-weight: 600; font-size: 14px;">🌸 Madoka 翻译</span>
        <button id="madoka-pdf-popup-close" style="
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        ">×</button>
      </div>
      <div id="madoka-pdf-popup-content" style="padding: 16px;">
        <div id="madoka-pdf-original-text" style="
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
          font-size: 13px;
          color: #4b5563;
          line-height: 1.5;
          max-height: 120px;
          overflow-y: auto;
        "></div>
        <div id="madoka-pdf-translated-text" style="
          background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
          border: 1px solid #c4b5fd;
          border-radius: 8px;
          padding: 12px;
          font-size: 13px;
          color: #1a1a1a;
          line-height: 1.5;
          min-height: 40px;
        ">
          <div style="display: flex; align-items: center; gap: 8px; color: #7c3aed;">
            <div class="madoka-spinner" style="
              width: 16px;
              height: 16px;
              border: 2px solid #c4b5fd;
              border-top-color: #7c3aed;
              border-radius: 50%;
              animation: madoka-spin 0.8s linear infinite;
            "></div>
            <span>翻译中...</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // 添加动画样式
  if (!document.getElementById('madoka-pdf-popup-styles')) {
    const style = document.createElement('style');
    style.id = 'madoka-pdf-popup-styles';
    style.textContent = `
      @keyframes madoka-popup-appear {
        from { opacity: 0; transform: translateY(-10px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes madoka-spin {
        to { transform: rotate(360deg); }
      }
      #madoka-pdf-popup-close:hover {
        background: rgba(255,255,255,0.2) !important;
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(popup);

  // 关闭按钮事件
  document.getElementById('madoka-pdf-popup-close').addEventListener('click', () => {
    popup.style.display = 'none';
  });

  return popup;
}

/**
 * 显示翻译弹窗
 */
function showTranslationPopup(text, rect) {
  let popup = document.getElementById('madoka-pdf-translation-popup');
  if (!popup) {
    popup = createTranslationPopup();
  }

  // 更新原文
  const originalTextEl = document.getElementById('madoka-pdf-original-text');
  const translatedTextEl = document.getElementById('madoka-pdf-translated-text');

  originalTextEl.textContent = text;
  translatedTextEl.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; color: #7c3aed;">
      <div class="madoka-spinner" style="
        width: 16px;
        height: 16px;
        border: 2px solid #c4b5fd;
        border-top-color: #7c3aed;
        border-radius: 50%;
        animation: madoka-spin 0.8s linear infinite;
      "></div>
      <span>翻译中...</span>
    </div>
  `;

  // 计算位置
  const popupWidth = 320;
  const popupHeight = 200;
  let left = rect.left + rect.width / 2 - popupWidth / 2;
  let top = rect.bottom + 10;

  // 边界检查
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (left < 10) left = 10;
  if (left + popupWidth > viewportWidth - 10) {
    left = viewportWidth - popupWidth - 10;
  }
  if (top + popupHeight > viewportHeight - 10) {
    top = rect.top - popupHeight - 10;
  }

  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.style.display = 'block';

  return { popup, translatedTextEl };
}

/**
 * 初始化划词翻译
 */
function initSelectionTranslate() {
  console.log('[Madoka PDF] 初始化划词翻译');

  let debounceTimer = null;
  let currentPopup = null;

  document.addEventListener('mouseup', (e) => {
    // 忽略右键点击
    if (e.button !== 0) return;

    // 忽略弹窗内部的点击
    const target = e.target;
    if (target?.closest?.('#madoka-pdf-translation-popup')) {
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      debounceTimer = null;

      const selection = window.getSelection();
      const text = selection?.toString()?.trim();

      if (!text || text.length === 0) {
        // 隐藏弹窗
        const popup = document.getElementById('madoka-pdf-translation-popup');
        if (popup) popup.style.display = 'none';
        return;
      }

      // 限制文本长度
      const textToTranslate = text.length > 5000
        ? text.substring(0, 5000)
        : text;

      // 获取选区位置
      let rect;
      if (selection?.rangeCount > 0) {
        rect = selection.getRangeAt(0).getBoundingClientRect();
      } else {
        rect = { left: e.clientX, top: e.clientY, width: 0, height: 0, bottom: e.clientY };
      }

      // 显示弹窗
      const { translatedTextEl } = showTranslationPopup(textToTranslate, rect);

      // 发送翻译请求
      const langpair = /[\u4e00-\u9fff]/.test(textToTranslate) ? 'zh|en' : 'en|zh';

      try {
        chrome.runtime.sendMessage(
          { action: 'translate', text: textToTranslate, langpair },
          (response) => {
            if (chrome.runtime.lastError) {
              translatedTextEl.innerHTML = `
                <div style="color: #dc2626; font-size: 13px;">
                  翻译失败: ${chrome.runtime.lastError.message || '请刷新页面后重试'}
                </div>
              `;
              return;
            }

            if (response?.success && response.translatedText) {
              translatedTextEl.textContent = response.translatedText;
            } else {
              translatedTextEl.innerHTML = `
                <div style="color: #dc2626; font-size: 13px;">
                  翻译失败: ${response?.error || '未知错误'}
                </div>
              `;
            }
          }
        );
      } catch (error) {
        translatedTextEl.innerHTML = `
          <div style="color: #dc2626; font-size: 13px;">
            翻译失败: ${error.message || '扩展通信错误'}
          </div>
        `;
      }
    }, 200);
  });

  // 点击页面其他地方隐藏弹窗
  document.addEventListener('mousedown', (e) => {
    const target = e.target;
    const popup = document.getElementById('madoka-pdf-translation-popup');
    if (popup && !target?.closest?.('#madoka-pdf-translation-popup')) {
      popup.style.display = 'none';
    }
  });

  console.log('[Madoka PDF] 划词翻译已启用');
}

// ==================== 启动 ====================

// 启动 PDF 打开流程
if (fileParam) {
  // 延迟执行，确保 PDF.js 模块已加载
  if (document.readyState === 'complete') {
    // 页面已完全加载，稍微延迟以确保模块执行
    setTimeout(openPdf, 100);
  } else {
    // 等待页面完全加载
    window.addEventListener('load', () => {
      setTimeout(openPdf, 100);
    }, { once: true });
  }
}

// 初始化划词翻译
if (document.readyState === 'complete') {
  initSelectionTranslate();
} else {
  window.addEventListener('load', initSelectionTranslate, { once: true });
}

console.log('[Madoka PDF] viewer-config.js 加载完成');
