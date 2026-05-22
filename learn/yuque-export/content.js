/**
 * Content Script for Yuque Enhanced Export
 * Automates Yuque's export workflow and fixes video links
 */

// State
let buttonsInjected = false;
let vaultHandle = null;
let exportInProgress = false;
const STORAGE_KEY = 'yuque_vault_handle';
const DB_NAME = 'YuqueExportDB';
const DB_VERSION = 1;
const STORE_NAME = 'handles';

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Also observe for DOM changes (Yuque is a SPA)
const observer = new MutationObserver(() => {
  if (!buttonsInjected) {
    injectButtons();
  }
});

async function init() {
  console.log('Yuque Enhanced Export: Content script loaded');

  // Try to inject buttons immediately
  injectButtons();

  // Initialize IndexedDB and load vault handle
  try {
    await initDB();
    await loadVaultHandle();
  } catch (error) {
    console.error('Failed to initialize DB:', error);
  }

  // Start observing for DOM changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Initialize IndexedDB for storing file handles
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Load vault handle from IndexedDB
 */
async function loadVaultHandle() {
  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    const handle = await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(STORAGE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    if (handle) {
      // Verify handle is still valid
      try {
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          vaultHandle = handle;
          console.log('Vault handle loaded and valid');
          updateVaultButtonState(true);
        } else {
          // Permission expired, need to re-request
          console.log('Vault handle exists but permission expired');
          updateVaultButtonState(false);
        }
      } catch (error) {
        // Handle is invalid, clear it
        console.log('Vault handle is invalid:', error);
        await clearVaultHandle();
      }
    }

    db.close();
  } catch (error) {
    console.error('Failed to load vault handle:', error);
  }
}

/**
 * Save vault handle to IndexedDB
 */
async function saveVaultHandle(handle) {
  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(handle, STORAGE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    vaultHandle = handle;
    updateVaultButtonState(true);
    showStatus('Obsidian仓库已设置', false);

    db.close();
  } catch (error) {
    console.error('Failed to save vault handle:', error);
    showStatus('保存仓库信息失败: ' + error.message, true);
  }
}

/**
 * Clear vault handle from IndexedDB
 */
async function clearVaultHandle() {
  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(STORAGE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    vaultHandle = null;
    updateVaultButtonState(false);

    db.close();
  } catch (error) {
    console.error('Failed to clear vault handle:', error);
  }
}

/**
 * Open directory picker to select Obsidian vault
 */
async function selectVaultDirectory() {
  try {
    const handle = await window.showDirectoryPicker();

    // Request write permission
    const permission = await handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      showStatus('未获得写入权限', true);
      return;
    }

    await saveVaultHandle(handle);
    console.log('Vault directory selected:', handle);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('User cancelled directory selection');
    } else {
      console.error('Failed to select directory:', error);
      showStatus('选择仓库失败: ' + error.message, true);
    }
  }
}

/**
 * Validate vault handle and re-request permission if needed
 */
async function validateVaultHandle() {
  if (!vaultHandle) {
    throw new Error('Vault not configured');
  }

  // Check if handle has the required methods
  if (typeof vaultHandle.getFileHandle !== 'function' ||
      typeof vaultHandle.getDirectoryHandle !== 'function') {
    console.error('Invalid vault handle type:', vaultHandle);
    await clearVaultHandle();
    throw new Error('仓库句柄无效，请重新设置');
  }

  // Check and request permission
  try {
    const permission = await vaultHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      const newPermission = await vaultHandle.requestPermission({ mode: 'readwrite' });
      if (newPermission !== 'granted') {
        throw new Error('未获得仓库写入权限');
      }
    }
  } catch (error) {
    if (error.name === 'NotFoundError') {
      await clearVaultHandle();
      throw new Error('仓库不存在，请重新设置');
    }
    throw error;
  }

  return vaultHandle;
}

/**
 * Collect all video cards from the page
 * @returns {Array} Array of video objects { id, url }
 */
function collectVideoCards() {
  console.log('[Video] 开始收集视频卡片...');
  const videos = [];

  const videoCards = document.querySelectorAll('ne-card[data-card-name="video"]');
  console.log(`[Video] 找到 ${videoCards.length} 个视频卡片`);

  videoCards.forEach((card, index) => {
    const id = card.id;
    const video = card.querySelector('video source');

    if (video && video.src) {
      const url = video.src;
      videos.push({ id, url });
      console.log(`[Video] #${index + 1} - ID: ${id}, URL: ${url.substring(0, 80)}...`);
    } else {
      console.warn(`[Video] #${index + 1} - 卡片 ${id} 没有找到有效的视频源`);
    }
  });

  console.log(`[Video] ✓ 收集完成，共 ${videos.length} 个有效视频`);
  return videos;
}

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<Element>} The found element
 */
function waitForElement(selector, timeout = 10000) {
  console.log(`[Wait] 等待元素出现: ${selector} (超时: ${timeout}ms)`);
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`[Wait] ✓ 元素立即找到 (0ms)`);
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        const waitTime = Date.now() - startTime;
        console.log(`[Wait] ✓ 元素已出现 (等待 ${waitTime}ms)`);
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      const waitTime = Date.now() - startTime;
      console.error(`[Wait] ✗ 等待超时 (${waitTime}ms): ${selector}`);
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}

/**
 * Debug helper: Log page structure for troubleshooting
 */
function debugPageStructure() {
  console.log('=== 页面结构调试信息 ===');
  
  // 检查目录树
  const catalogItems = document.querySelectorAll('[class*="catalogTreeItem"]');
  console.log(`目录项数量: ${catalogItems.length}`);
  
  if (catalogItems.length > 0) {
    const selectedItems = document.querySelectorAll('[class*="selected"], .active');
    console.log(`选中的项: ${selectedItems.length}`);
    selectedItems.forEach((item, i) => {
      console.log(`  选中项 ${i + 1}:`, item.className);
    });
  }
  
  // 检查菜单
  const menus = document.querySelectorAll('.ant-menu, [class*="menu"]');
  console.log(`菜单数量: ${menus.length}`);
  
  // 检查导出相关图标
  const exportIcons = document.querySelectorAll('.larkui-icon-action-export');
  console.log(`导出图标数量: ${exportIcons.length}`);
  
  const moreIcons = document.querySelectorAll('.larkui-icon-more');
  console.log(`更多图标数量: ${moreIcons.length}`);
  
  console.log('======================');
}

/**
 * Simulate mouse hover on an element
 * @param {Element} element - The element to hover
 */
function simulateHover(element) {
  if (!element) {
    console.error('[Hover] 无法悬停：元素为空');
    return;
  }
  
  const eventOptions = {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: 0,
    clientY: 0
  };
  
  // 触发鼠标悬停事件序列
  const events = ['mouseenter', 'mouseover', 'mousemove'];
  events.forEach(eventType => {
    element.dispatchEvent(new MouseEvent(eventType, eventOptions));
  });
}

/**
 * Simulate a click on an element
 * @param {Element} element - The element to click
 */
function simulateClick(element) {
  if (!element) {
    console.error('[Click] 无法点击：元素为空');
    return;
  }
  
  // 触发完整的点击事件序列，更接近真实用户操作
  const eventOptions = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: 0,
    clientY: 0
  };
  
  // 1. mousedown
  element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  
  // 2. mouseup
  element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  
  // 3. click
  element.dispatchEvent(new MouseEvent('click', eventOptions));
  
  // 4. 如果是链接或按钮，也尝试直接调用 click()
  if (element.tagName === 'A' || element.tagName === 'BUTTON' || element.onclick) {
    try {
      element.click();
    } catch (e) {
      // 忽略可能的错误
    }
  }
}

/**
 * Monitor for Yuque export download via background script
 * @returns {Promise<object>} Download item
 */
function monitorYuqueDownload() {
  return new Promise((resolve, reject) => {
    console.log('[Download] 通过background script监听下载...');
    
    // Set up message listener for download notifications
    const messageListener = (request, sender, sendResponse) => {
      if (request.action === 'downloadComplete') {
        console.log('[Download] ✓ 收到下载完成通知:', request.download.filename);
        chrome.runtime.onMessage.removeListener(messageListener);
        clearTimeout(timeout);
        resolve(request.download);
      } else if (request.action === 'downloadError') {
        console.error('[Download] ✗ 下载失败:', request.error);
        chrome.runtime.onMessage.removeListener(messageListener);
        clearTimeout(timeout);
        reject(new Error(request.error));
      }
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
    
    // Request background script to start monitoring
    chrome.runtime.sendMessage({ action: 'startDownloadMonitor' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Download] ✗ 启动监听失败:', chrome.runtime.lastError);
        chrome.runtime.onMessage.removeListener(messageListener);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      console.log('[Download] 监听器已启动');
    });
    
    // 60 second timeout
    const timeout = setTimeout(() => {
      console.error('[Download] ✗ 监听超时（60秒）');
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.runtime.sendMessage({ action: 'stopDownloadMonitor' });
      reject(new Error('下载监听超时（60秒未检测到下载）'));
    }, 60000);
  });
}

/**
 * Get downloaded file URL that can be accessed
 * @param {object} downloadItem - Chrome download item
 * @returns {Promise<string>} Accessible file URL
 */
async function getDownloadedFileUrl(downloadItem) {
  console.log('[Read] 获取可访问的文件URL...');
  
  // Chrome downloads API provides the original download URL
  if (downloadItem.url) {
    console.log('[Read] 使用下载源URL:', downloadItem.url);
    return downloadItem.url;
  }
  
  // If no URL available, we need user to manually provide the file
  throw new Error('无法获取下载文件URL，请手动处理');
}

/**
 * Automate Yuque's export workflow
 */
async function automateYuqueExport() {
  console.log('[Export] 开始自动导出流程');
  showStatus('正在打开导出菜单...');

  // Step 1: Find and click export menu button
  try {
    console.log('[Export] Step 1: 查找语雀导出菜单项...');
    
    // 先尝试直接找到导出菜单项（带有导出图标的）
    let exportTrigger = document.querySelector('.larkui-icon-action-export')?.closest('li, .ant-menu-item');
    
    // 如果没找到，需要从左侧目录触发
    if (!exportTrigger) {
      console.log('[Export] 导出菜单未展开，尝试从左侧目录触发...');
      
      // 找到左侧目录中当前选中的文档项
      const selectedDocItem = document.querySelector(
        '.catalogTreeItem-module_selected_uB-Um, ' +
        'a.catalogTreeItem-module_content_Tae8T.active, ' +
        '.catalog-tree a.active, ' +
        '[class*="catalogTreeItem"][class*="selected"]'
      );
      
      if (selectedDocItem) {
        console.log('[Export] ✓ 找到选中的文档项:', selectedDocItem.className);
        console.log('[Export] 触发鼠标悬停事件，让操作按钮显示...');
        
        // 使用辅助函数模拟悬停
        simulateHover(selectedDocItem);
        
        console.log('[Export] ✓ 已触发悬停事件，等待按钮显示...');
        await sleep(400);
        
        // 在文档项内或其父容器中查找"更多"按钮（三个点）
        let moreButton = selectedDocItem.querySelector('.larkui-icon-more')
          ?.closest('span, button');
        
        // 如果在当前项没找到，尝试在整个行容器中查找
        if (!moreButton) {
          const docRow = selectedDocItem.closest('div, li') || selectedDocItem.parentElement;
          moreButton = docRow?.querySelector('.larkui-icon-more')
            ?.closest('span, button');
        }
        
        if (moreButton) {
          console.log('[Export] ✓ 找到三个点按钮:', moreButton.outerHTML.substring(0, 150));
          
          // 检查按钮是否可见
          const isVisible = moreButton.offsetParent !== null;
          console.log('[Export] 按钮可见性:', isVisible);
          
          simulateClick(moreButton);
          console.log('[Export] ✓ 已点击三个点按钮，等待菜单展开...');
          await sleep(500);
          
          // 再次查找导出菜单项
          exportTrigger = document.querySelector('.larkui-icon-action-export')
            ?.closest('li, .ant-menu-item');
            
          if (exportTrigger) {
            console.log('[Export] ✓ 菜单展开后找到导出选项');
          }
        } else {
          console.error('[Export] ✗ 未找到三个点按钮');
          console.log('[Export] 尝试查找按钮的其他选择器...');
          
          // 尝试其他可能的选择器
          moreButton = document.querySelector(
            '.catalogTreeItem-module_btnItem_eG9iX .larkui-icon-more'
          )?.closest('span, button');
          
          if (moreButton) {
            console.log('[Export] ✓ 通过备用选择器找到三个点按钮');
            simulateClick(moreButton);
            await sleep(500);
            exportTrigger = document.querySelector('.larkui-icon-action-export')
              ?.closest('li, .ant-menu-item');
          }
        }
      } else {
        console.error('[Export] ✗ 未找到选中的文档项');
        console.log('[Export] 尝试查找页面顶部的导出按钮作为备用方案...');
        
        // 备用方案：在文档标题区域查找导出按钮
        // 先尝试通过图标查找
        let headerExportButton = null;
        const exportIconInHeader = document.querySelector(
          'header .larkui-icon-action-export, ' +
          '.doc-header .larkui-icon-action-export, ' +
          '[class*="header"] .larkui-icon-action-export'
        );
        
        if (exportIconInHeader) {
          headerExportButton = exportIconInHeader.closest('button');
        }
        
        // 如果没找到，通过属性查找
        if (!headerExportButton) {
          headerExportButton = document.querySelector(
            '[class*="header"] button[title*="导出"], ' +
            '[class*="header"] button[aria-label*="导出"]'
          );
        }
        
        if (headerExportButton && !headerExportButton.hasAttribute('data-yuque-export-plugin')) {
          console.log('[Export] ✓ 在页面顶部找到导出按钮（备用方案）');
          simulateClick(headerExportButton);
          await sleep(500);
          exportTrigger = document.querySelector('.larkui-icon-action-export')
            ?.closest('li, .ant-menu-item');
        } else {
          // 列出所有可能的目录项
          const allCatalogItems = document.querySelectorAll('[class*="catalogTreeItem"], .catalog-tree a');
          console.log(`[Export] 页面共有 ${allCatalogItems.length} 个目录项`);
          
          // 输出调试信息
          debugPageStructure();
        }
      }
    }
    
    // 如果还是没找到，尝试通过文本匹配
    if (!exportTrigger) {
      console.log('[Export] 尝试通过文本匹配查找导出选项...');
      const menuItems = Array.from(document.querySelectorAll('li, .ant-menu-item'));
      console.log(`[Export] 找到 ${menuItems.length} 个菜单项`);
      
      exportTrigger = menuItems.find(el => {
        const text = el.textContent.trim();
        return (text === '导出...' || text === '导出') && !el.hasAttribute('data-yuque-export-plugin');
      });
      
      if (exportTrigger) {
        console.log('[Export] ✓ 通过文本匹配找到导出选项:', exportTrigger.textContent.trim());
      }
    }

    if (!exportTrigger) {
      console.error('[Export] ✗ 未找到语雀的导出菜单按钮');
      console.error('[Export] 请确认：');
      console.error('[Export] 1. 是否在文档页面（而非列表页）');
      console.error('[Export] 2. 文档是否有导出权限');
      console.error('[Export] 3. 左侧目录是否可见');
      
      // 输出调试信息
      debugPageStructure();
      
      throw new Error('未找到语雀的导出菜单按钮');
    }

    console.log('[Export] ✓ 找到导出菜单项:', exportTrigger.outerHTML.substring(0, 150));
    simulateClick(exportTrigger);
    console.log('[Export] ✓ 已点击导出菜单项');

    showStatus('正在选择Markdown导出...');

    // Step 2: Wait for export dialog and click Markdown
    console.log('[Export] Step 2: 等待导出对话框并选择Markdown格式...');
    await sleep(800);

    // 使用更精确的选择器匹配Markdown选项
    const markdownOption = await waitForElement(
      '[data-testid="fileTypeSelectorItem-markdown"], ' +
      '[data-aspm-param*="file_type=markdown"]',
      10000
    );
    console.log('[Export] ✓ 找到Markdown选项:', markdownOption.outerHTML.substring(0, 150));
    simulateClick(markdownOption);
    console.log('[Export] ✓ 已选择Markdown格式');

    showStatus('正在生成导出文件...');

    // Step 3: Wait for export button in dialog and setup download monitor
    console.log('[Export] Step 3: 等待导出确认按钮...');
    await sleep(500);

    // 查找导出对话框中的"导出"按钮（使用唯一的类名）
    const exportButton = await waitForElement(
      '.DocExport-module_settingUpload_wmM28, ' +
      '.ant-modal-body .ant-btn-primary.DocExport-module_settingUpload_wmM28',
      10000
    );
    console.log('[Export] ✓ 找到导出确认按钮:', exportButton.textContent.trim());
    
    // 确保不是插件的按钮
    if (exportButton.id === 'yuque-export-button' || 
        exportButton.hasAttribute('data-yuque-export-plugin')) {
      console.error('[Export] ✗ 错误：匹配到了插件自己的按钮');
      throw new Error('匹配到了错误的导出按钮');
    }
    
    // 在点击前设置下载监听
    console.log('[Export] 设置下载监听器...');
    const downloadPromise = monitorYuqueDownload();
    
    // 短暂延迟确保监听器已就绪
    await sleep(200);
    
    // 点击导出按钮
    simulateClick(exportButton);
    console.log('[Export] ✓ 已点击导出确认按钮，等待浏览器下载...');
    showStatus('等待浏览器下载文件...', false);

    showStatus('等待文件下载...');

    // Step 4: Wait for browser download to complete
    console.log('[Export] Step 4: 等待浏览器下载完成...');
    const startTime = Date.now();
    
    let downloadItem;
    try {
      downloadItem = await downloadPromise;
      const waitTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Export] ✓ 下载完成（耗时 ${waitTime}s）:`, downloadItem.filename);
    } catch (error) {
      console.error('[Export] ✗ 下载失败:', error);
      throw new Error(`等待下载失败: ${error.message}`);
    }

    showStatus('正在读取下载的文件...');

    // Step 5: Read the downloaded file
    console.log('[Export] Step 5: 读取下载的文件...');
    console.log('[Export] 文件名:', downloadItem.filename);
    console.log('[Export] 下载URL:', downloadItem.url);
    
    let markdownContent;
    
    // 检查文件类型
    if (downloadItem.filename.toLowerCase().endsWith('.zip')) {
      console.log('[Export] 检测到ZIP文件，需要解压...');
      showStatus('文件已下载为ZIP，请手动解压后使用', true);
      throw new Error('语雀导出为ZIP格式，暂不支持自动解压。请手动解压后将markdown文件拖入页面。');
    } else if (downloadItem.filename.toLowerCase().endsWith('.md') || 
               downloadItem.filename.toLowerCase().endsWith('.markdown')) {
      console.log('[Export] 检测到Markdown文件');
      
      // 通过下载URL获取内容
      try {
        const fileUrl = await getDownloadedFileUrl(downloadItem);
        console.log('[Export] 从URL获取内容:', fileUrl);
        markdownContent = await fetchMarkdownContent(fileUrl);
      } catch (error) {
        console.error('[Export] 无法获取下载文件内容:', error);
        showStatus('无法读取下载的文件，请检查下载是否完成', true);
        throw new Error(`无法获取下载文件内容: ${error.message}`);
      }
    } else {
      throw new Error(`不支持的文件格式: ${downloadItem.filename}`);
    }

    if (!markdownContent) {
      throw new Error('下载Markdown失败');
    }

    console.log(`[Export] ✓ Markdown下载完成，长度: ${markdownContent.length} 字符, ${markdownContent.split('\n').length} 行`);
    console.log('[Export] Markdown前200字符预览:', markdownContent.substring(0, 200));
    
    // 验证内容不是错误页面或空白
    if (markdownContent.length < 50) {
      console.error('[Export] ✗ 下载内容过短，可能是无效内容');
      throw new Error('下载的内容过短，可能不是完整的Markdown');
    }
    
    // 检查是否是HTML错误页面
    if (markdownContent.trim().startsWith('<!DOCTYPE') || markdownContent.trim().startsWith('<html')) {
      console.error('[Export] ✗ 下载内容是HTML页面，不是Markdown');
      console.error('[Export] 内容预览:', markdownContent.substring(0, 500));
      throw new Error('下载的不是Markdown内容，而是HTML页面');
    }

    return markdownContent;

  } catch (error) {
    console.error('[Export] ✗ 自动导出失败:', error);
    throw error;
  }
}

/**
 * Fetch markdown content from URL
 * @param {string} url - Download URL
 * @returns {Promise<string>} Markdown content
 */
async function fetchMarkdownContent(url) {
  try {
    console.log('[Fetch] 开始下载:', url);
    const startTime = Date.now();
    
    const response = await fetch(url);
    const fetchTime = Date.now() - startTime;
    
    console.log(`[Fetch] 响应状态: ${response.status} ${response.statusText} (耗时 ${fetchTime}ms)`);
    console.log('[Fetch] Content-Type:', response.headers.get('content-type'));
    console.log('[Fetch] Content-Length:', response.headers.get('content-length') || 'unknown');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    
    const content = await response.text();
    console.log(`[Fetch] ✓ 内容下载完成: ${content.length} 字节`);
    
    return content;
  } catch (error) {
    console.error('[Fetch] ✗ 下载失败:', error);
    throw error;
  }
}

/**
 * Sleep helper
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Replace video placeholders with actual links
 * @param {string} markdown - Original markdown
 * @param {Array} videos - Array of { id, url }
 * @returns {string} Updated markdown
 */
function replaceVideoPlaceholders(markdown, videos) {
  console.log(`[Replace] 开始替换视频占位符，共 ${videos.length} 个视频`);
  let updated = markdown;
  let totalReplacements = 0;

  for (const video of videos) {
    // Replace Yuque's placeholder format
    const placeholder = `[此处为语雀卡片，点击链接查看](about:blank#${video.id})`;
    const replacement = `![video](videos/${video.id}.mp4)`;
    const regex = new RegExp(
      `\\[此处为语雀卡片，点击链接查看\\]\\(about:blank#${video.id}\\)`,
      'g'
    );
    
    const beforeLength = updated.length;
    updated = updated.replace(regex, replacement);
    const afterLength = updated.length;
    
    if (beforeLength !== afterLength) {
      totalReplacements++;
      console.log(`[Replace] ✓ 替换视频 ${video.id}: "${placeholder}" -> "${replacement}"`);
    } else {
      console.warn(`[Replace] ⚠ 未找到视频 ${video.id} 的占位符`);
    }
  }

  console.log(`[Replace] ✓ 替换完成，共替换 ${totalReplacements}/${videos.length} 个占位符`);
  return updated;
}

/**
 * Download video file to vault
 * Uses background script to bypass CORS restrictions
 * @param {string} url - Video URL
 * @param {string} filename - Target filename
 * @returns {Promise<Blob>}
 */
async function downloadVideoToVault(url, filename) {
  console.log(`[Download] 开始下载视频: ${filename}`);
  console.log(`[Download] URL: ${url.substring(0, 100)}...`);
  
  const startTime = Date.now();
  
  // Use Port connection for chunked transfer (bypasses CORS and message size limit)
  const blob = await new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: 'videoDownload' });
    
    let totalSize = 0;
    let totalChunks = 0;
    let mimeType = 'video/mp4';
    const chunks = [];
    
    port.onMessage.addListener((msg) => {
      if (msg.type === 'meta') {
        totalSize = msg.totalSize;
        totalChunks = msg.totalChunks;
        mimeType = msg.mimeType || 'video/mp4';
        console.log(`[Download] 接收元数据: ${(totalSize / 1024 / 1024).toFixed(2)}MB, ${totalChunks} 个分块`);
      
      } else if (msg.type === 'chunk') {
        // Decode Base64 chunk back to Uint8Array
        const binary = atob(msg.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        chunks[msg.index] = bytes;
        console.log(`[Download] 分块 ${msg.index + 1}/${totalChunks} 已接收 (${(bytes.length / 1024 / 1024).toFixed(2)}MB)`);
      
      } else if (msg.type === 'done') {
        port.disconnect();
        // Reassemble all chunks into a single Blob
        const allChunks = [];
        for (let i = 0; i < totalChunks; i++) {
          if (chunks[i]) {
            allChunks.push(chunks[i]);
          }
        }
        const resultBlob = new Blob(allChunks, { type: mimeType });
        console.log(`[Download] ✓ 所有分块接收完毕，总大小: ${(resultBlob.size / 1024 / 1024).toFixed(2)}MB`);
        resolve(resultBlob);
      
      } else if (msg.type === 'error') {
        port.disconnect();
        reject(new Error(msg.error));
      }
    });
    
    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      }
    });
    
    // Request download
    port.postMessage({ action: 'downloadVideo', url: url });
  });
  
  const downloadTime = Date.now() - startTime;
  const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
  
  console.log(`[Download] ✓ 下载完成: ${filename}, 大小: ${sizeMB}MB, 耗时: ${downloadTime}ms`);
  return blob;
}

/**
 * Save file to vault using File System Access API
 * @param {string} filename - Target filename
 * @param {Blob} content - File content
 * @returns {Promise<void>}
 */
async function saveFileToVault(filename, content) {
  console.log(`[Save] 开始保存文件: ${filename}`);
  const startTime = Date.now();
  
  // Validate handle and get permission
  const handle = await validateVaultHandle();

  // Get or create videos directory for video files
  const pathParts = filename.split('/');
  let currentHandle = handle;

  // Create directories
  for (let i = 0; i < pathParts.length - 1; i++) {
    const dirName = pathParts[i];
    try {
      currentHandle = await currentHandle.getDirectoryHandle(dirName, { create: true });
      console.log(`[Save] ✓ 目录已准备: ${dirName}`);
    } catch (error) {
      console.error(`[Save] ✗ 创建目录失败 ${dirName}:`, error);
      throw new Error(`Failed to create directory ${dirName}: ${error.message}`);
    }
  }

  // Create or overwrite file
  const fileName = pathParts[pathParts.length - 1];
  const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  
  const saveTime = Date.now() - startTime;
  const sizeMB = content instanceof Blob ? (content.size / 1024 / 1024).toFixed(2) : (content.length / 1024).toFixed(2);
  console.log(`[Save] ✓ 文件已保存: ${filename}, 大小: ${sizeMB}${content instanceof Blob ? 'MB' : 'KB'}, 耗时: ${saveTime}ms`);
}

/**
 * Handle export to Obsidian
 */
async function handleExportToObsidian() {
  console.log('========================================');
  console.log('[Main] 开始导出到Obsidian流程');
  console.log('========================================');
  
  if (exportInProgress) {
    console.log('[Main] ⚠ 导出正在进行中，跳过本次请求');
    showStatus('导出进行中，请稍候...', false);
    return;
  }

  const overallStartTime = Date.now();

  try {
    // Validate vault handle before proceeding
    console.log('[Main] 验证Obsidian仓库权限...');
    await validateVaultHandle();
    console.log('[Main] ✓ 仓库权限验证通过');
  } catch (error) {
    console.error('[Main] ✗ 仓库验证失败:', error);
    showStatus(error.message, true);
    return;
  }

  exportInProgress = true;

  try {
    // Step 1: Automate Yuque's export workflow
    console.log('[Main] === Step 1: 自动触发语雀导出 ===');
    const markdownContent = await automateYuqueExport();

    // Step 2: Collect video cards from page
    console.log('[Main] === Step 2: 收集视频卡片 ===');
    showStatus('正在收集视频卡片...');
    const videos = collectVideoCards();
    console.log('[Main] 视频收集结果:', videos);

    if (videos.length > 0) {
      showStatus(`找到 ${videos.length} 个视频`);
    } else {
      console.log('[Main] ℹ 未找到视频，将仅导出Markdown');
    }

    // Step 3: Replace video placeholders
    console.log('[Main] === Step 3: 替换视频占位符 ===');
    showStatus('正在更新视频链接...');
    const updatedMarkdown = replaceVideoPlaceholders(markdownContent, videos);

    // Step 4: Extract title from markdown (parse frontmatter or first heading)
    console.log('[Main] === Step 4: 提取文档标题 ===');
    const titleMatch = updatedMarkdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'untitled';
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
    console.log(`[Main] 原始标题: "${title}"`);
    console.log(`[Main] 安全文件名: "${safeTitle}"`);

    // Step 5: Save markdown to vault
    console.log('[Main] === Step 5: 保存Markdown文件 ===');
    const mdFilename = `${safeTitle}.md`;
    showStatus('正在保存Markdown...');
    const mdBlob = new Blob([updatedMarkdown], { type: 'text/markdown' });
    await saveFileToVault(mdFilename, mdBlob);
    console.log(`[Main] ✓ Markdown saved: ${mdFilename}`);

    // Step 6: Download and save videos (with error tolerance)
    const videoResults = [];
    if (videos.length > 0) {
      console.log(`[Main] === Step 6: 下载并保存 ${videos.length} 个视频 ===`);
      showStatus(`正在下载 ${videos.length} 个视频...`);

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        console.log(`[Main] 处理视频 ${i + 1}/${videos.length}: ${video.id}`);
        showStatus(`正在下载视频 ${i + 1}/${videos.length}...`);

        try {
          const blob = await downloadVideoToVault(video.url, `${video.id}.mp4`);
          await saveFileToVault(`videos/${video.id}.mp4`, blob);
          console.log(`[Main] ✓ Video ${i + 1}/${videos.length} saved: videos/${video.id}.mp4`);
          videoResults.push({ id: video.id, success: true });
        } catch (error) {
          console.error(`[Main] ✗ 视频 ${i + 1}/${videos.length} 下载失败 (${video.id}):`, error.message);
          videoResults.push({ id: video.id, success: false, error: error.message });
          // 继续下载下一个视频，不中断整个导出流程
        }
      }
    }

    const failedVideos = videoResults.filter(r => !r.success);
    const succeededVideos = videoResults.filter(r => r.success);
    const totalTime = ((Date.now() - overallStartTime) / 1000).toFixed(1);
    console.log('========================================');
    console.log(`[Main] ✓✓✓ 导出完成！总耗时: ${totalTime}秒`);
    console.log(`[Main] 文件位置: ${mdFilename}`);
    console.log(`[Main] 视频: ${succeededVideos.length}/${videos.length} 成功`);
    if (failedVideos.length > 0) {
      console.warn(`[Main] ✗ ${failedVideos.length} 个视频下载失败:`, failedVideos.map(v => v.id).join(', '));
    }
    console.log('========================================');
    
    if (failedVideos.length > 0) {
      showStatus(`导出完成！已保存: ${mdFilename}（${failedVideos.length}个视频下载失败）`, false);
    } else {
      showStatus(`导出完成！已保存到Obsidian仓库: ${mdFilename}`, false);
    }

  } catch (error) {
    console.error('========================================');
    console.error('[Main] ✗✗✗ 导出失败:', error);
    console.error('[Main] 错误堆栈:', error.stack);
    console.error('========================================');
    showStatus(`导出失败: ${error.message}`, true);
  } finally {
    setTimeout(() => {
      exportInProgress = false;
      console.log('[Main] 导出状态重置');
    }, 3000);
  }
}

/**
 * Show export status indicator
 * @param {string} message - Status message
 * @param {boolean} isError - Whether this is an error message
 */
function showStatus(message, isError = false) {
  // Remove existing status
  const existingStatus = document.getElementById('yuque-export-status');
  if (existingStatus) existingStatus.remove();

  const status = document.createElement('div');
  status.id = 'yuque-export-status';
  status.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    background: ${isError ? '#ff4d4f' : '#52c41a'};
    color: white;
    border-radius: 4px;
    z-index: 99999;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
    max-width: 300px;
  `;
  status.textContent = message;
  document.body.appendChild(status);

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (status.parentElement) {
      status.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => status.remove(), 300);
    }
  }, 5000);
}

/**
 * Update vault button state
 * @param {boolean} isConfigured - Whether vault is configured
 */
function updateVaultButtonState(isConfigured) {
  const vaultButton = document.getElementById('yuque-vault-button');
  if (vaultButton) {
    if (isConfigured) {
      vaultButton.textContent = '重置Obsidian仓库';
      vaultButton.style.background = '#52c41a';
    } else {
      vaultButton.textContent = '设置Obsidian仓库';
      vaultButton.style.background = '#fa8c16';
    }
  }
}

/**
 * Handle vault button click
 */
async function handleVaultButtonClick() {
  if (vaultHandle) {
    // Vault is configured, ask if they want to reset
    const confirmed = confirm('已配置Obsidian仓库，是否要重新设置？');
    if (confirmed) {
      await clearVaultHandle();
      await selectVaultDirectory();
    }
  } else {
    // No vault configured, select one
    await selectVaultDirectory();
  }
}

/**
 * Inject buttons next to title
 */
function injectButtons() {
  // Check if we're on a Yuque document page
  if (!window.location.hostname.includes('yuque.com')) {
    return;
  }

  // Check if buttons already exist
  if (document.getElementById('yuque-export-button')) {
    buttonsInjected = true;
    return;
  }

  // Find title container - try multiple selectors
  const titleElement = document.querySelector('h1')
                      || document.querySelector('[class*="title"]')
                      || document.querySelector('[class*="Title"]');

  if (!titleElement) {
    console.log('Yuque Export: Title element not found yet');
    return;
  }

  // Don't inject if already injected
  if (titleElement.querySelector('#yuque-export-button')) {
    buttonsInjected = true;
    return;
  }

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'yuque-export-plugin-container';
  buttonContainer.setAttribute('data-yuque-export-plugin', 'true');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: 12px;
  `;

  // Create vault button
  const vaultButton = document.createElement('button');
  vaultButton.id = 'yuque-vault-button';
  vaultButton.setAttribute('data-yuque-export-plugin', 'true');
  vaultButton.setAttribute('type', 'button');
  vaultButton.textContent = vaultHandle ? '重置Obsidian仓库' : '设置Obsidian仓库';
  vaultButton.style.cssText = `
    padding: 6px 12px;
    background: ${vaultHandle ? '#52c41a' : '#fa8c16'};
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background 0.2s;
  `;

  vaultButton.addEventListener('mouseenter', () => {
    vaultButton.style.background = vaultHandle ? '#73d13d' : '#ffa940';
  });
  vaultButton.addEventListener('mouseleave', () => {
    vaultButton.style.background = vaultHandle ? '#52c41a' : '#fa8c16';
  });

  vaultButton.onclick = handleVaultButtonClick;

  // Create export button
  const exportButton = document.createElement('button');
  exportButton.id = 'yuque-export-button';
  exportButton.setAttribute('data-yuque-export-plugin', 'true');
  exportButton.setAttribute('type', 'button');
  exportButton.textContent = '一键导出到Obsidian';
  exportButton.style.cssText = `
    padding: 6px 12px;
    background: #1890ff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background 0.2s;
  `;

  exportButton.addEventListener('mouseenter', () => {
    exportButton.style.background = '#40a9ff';
  });
  exportButton.addEventListener('mouseleave', () => {
    exportButton.style.background = '#1890ff';
  });

  exportButton.onclick = handleExportToObsidian;

  // Add buttons to container
  buttonContainer.appendChild(vaultButton);
  buttonContainer.appendChild(exportButton);

  // Append to title element's parent
  const titleParent = titleElement.parentElement;
  if (titleParent) {
    titleParent.appendChild(buttonContainer);
    buttonsInjected = true;
    console.log('Yuque Export: Buttons injected successfully');
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVideoUrls') {
    const videos = collectVideoCards();
    sendResponse({ success: true, videos });
    return true;
  }
});
