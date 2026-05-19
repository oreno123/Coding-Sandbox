/**
 * PDF.js Viewer Script - 简单单页渲染方式
 * 不使用 PDFViewer 类，直接渲染每一页
 */

// 使用 chrome.runtime.getURL 获取正确的资源路径
const pdfJsUrl = chrome.runtime.getURL('node_modules/pdfjs-dist/build/pdf.mjs');
const pdfWorkerUrl = chrome.runtime.getURL('node_modules/pdfjs-dist/build/pdf.worker.mjs');
const cMapUrl = chrome.runtime.getURL('node_modules/pdfjs-dist/cmaps/');

async function initPDFViewer() {
  try {
    // 动态导入 PDF.js
    const pdfjsLib = await import(pdfJsUrl);

    // 配置 worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

    // 从 URL 参数获取 PDF 地址
    const urlParams = new URLSearchParams(window.location.search);
    const pdfUrl = urlParams.get('file');

    if (!pdfUrl) {
      showError('未提供 PDF 文件地址');
      return;
    }

    // 加载并渲染 PDF
    await loadAndRenderPDF(pdfjsLib, pdfUrl);

  } catch (error) {
    console.error('PDF.js 初始化失败:', error);
    showError('PDF.js 初始化失败: ' + error.message);
  }
}

async function loadAndRenderPDF(pdfjsLib, pdfUrl) {
  try {
    // 加载 PDF 文档
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: cMapUrl,
      cMapPacked: true,
    });

    const pdf = await loadingTask.promise;
    hideLoading();

    const container = document.getElementById('pdf-container');
    
    if (!container) {
      showError('PDF 容器未找到');
      return;
    }

    console.log('[Madoka PDF] PDF 加载成功，共', pdf.numPages, '页');

    // 渲染每一页
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      await renderPage(pdfjsLib, pdf, container, pageNum);
    }

    console.log('[Madoka PDF] 所有页面渲染完成');
    window.postMessage({ type: 'PDF_LOADED' }, '*');

  } catch (error) {
    console.error('PDF 加载失败:', error);
    showError('PDF 加载失败: ' + error.message);
  }
}

async function renderPage(pdfjsLib, pdf, container, pageNum) {
  try {
    // 获取页面
    const page = await pdf.getPage(pageNum);
    
    // 创建页面容器
    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.dataset.pageNumber = pageNum;
    
    // 设置缩放比例
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    // 创建 canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = 'pdf-canvas';
    
    // 渲染页面到 canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
    
    pageDiv.appendChild(canvas);
    
    // 创建文本层
    await renderTextLayer(pdfjsLib, page, pageDiv, viewport);
    
    container.appendChild(pageDiv);
    
    console.log(`[Madoka PDF] 页面 ${pageNum} 渲染完成`);
    
  } catch (error) {
    console.error(`[Madoka PDF] 页面 ${pageNum} 渲染失败:`, error);
  }
}

async function renderTextLayer(pdfjsLib, page, pageDiv, viewport) {
  try {
    // 创建文本层容器
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    
    // 获取文本内容
    const textContent = await page.getTextContent();
    
    // 渲染每个文本片段
    textContent.items.forEach((item) => {
      const span = document.createElement('span');
      span.textContent = item.str;
      
      // 使用 PDF.js 的 Util.transform 转换坐标
      const tx = pdfjsLib.Util.transform(
        viewport.transform,
        item.transform
      );
      
      // 计算字体大小和位置
      const fontHeight = Math.hypot(tx[0], tx[1]);
      const fontWidth = Math.hypot(tx[2], tx[3]);
      
      // 设置样式
      span.style.fontSize = `${fontHeight}px`;
      span.style.fontFamily = item.fontName || 'sans-serif';
      span.style.left = `${tx[4]}px`;
      span.style.top = `${tx[5] - fontHeight}px`;
      
      // 应用水平缩放（如果需要）
      if (fontWidth > 0 && item.width > 0) {
        const scaleX = item.width / fontWidth;
        if (Math.abs(scaleX - 1) > 0.01) {
          span.style.transform = `scaleX(${scaleX})`;
          span.style.transformOrigin = '0 0';
        }
      }
      
      textLayerDiv.appendChild(span);
    });
    
    pageDiv.appendChild(textLayerDiv);
    
  } catch (error) {
    console.error('[Madoka PDF] 文本层渲染失败:', error);
  }
}

function hideLoading() {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
}

function showError(message) {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');

  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
  if (errorEl) {
    errorEl.style.display = 'block';
    errorEl.textContent = message;
  }
}

// 初始化
initPDFViewer();
