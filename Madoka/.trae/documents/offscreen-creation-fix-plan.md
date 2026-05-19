# Offscreen 页面创建时机修复计划

## 问题描述

当前代码在测试 MCP 连接时，offscreen 页面可能没有被正确创建，导致 `document is not defined` 错误。

## 问题分析

查看 `src/background/offscreen.ts` 中的代码：

```typescript
export async function sendToOffscreen<T>(msg: Record<string, unknown>): Promise<T> {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({ ...msg, target: "mcp-offscreen" }) as Promise<T>;
}
```

`sendToOffscreen` 函数会先调用 `ensureOffscreenDocument()` 来确保 offscreen 页面存在，然后再发送消息。但是 `ensureOffscreenDocument` 函数使用 `chrome.runtime.getContexts` 来检查 offscreen 页面是否存在，这个 API 可能在一些 Chrome 版本中不可用或者行为不一致。

## 修复方案

### 方案：增强 ensureOffscreenDocument 的健壮性

1. **添加错误处理和重试机制** - 当 `getContexts` 失败时，尝试直接创建 offscreen 页面
2. **添加超时处理** - 防止 offscreen 创建过程挂起
3. **更好的错误信息** - 帮助用户理解问题所在

## 实施步骤

### 步骤1: 修改 src/background/offscreen.ts

增强 `ensureOffscreenDocument` 函数，添加更好的错误处理和日志：

```typescript
/**
 * Offscreen Document 管理 - 用于在有 DOM 的环境中运行 MCP 客户端
 */

const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/index.html";
const OFFSCREEN_JUSTIFICATION = "运行 MCP 客户端需要 DOM 环境，避免 document is not defined";

// 添加创建状态跟踪，防止并发创建
let creatingOffscreenPromise: Promise<void> | null = null;

/**
 * 检查 offscreen document 是否已存在
 */
async function hasOffscreenDocument(): Promise<boolean> {
  console.log('[Madoka Offscreen] [1/5] 检查 offscreen document 是否存在...');
  try {
    // @ts-ignore - Chrome 109+ API
    if (typeof chrome.runtime.getContexts === 'function') {
      console.log('[Madoka Offscreen] [2/5] getContexts API 可用，开始查询...');
      // @ts-ignore
      const contexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
      });
      const exists = contexts.length > 0;
      console.log(`[Madoka Offscreen] [3/5] 查询完成，offscreen ${exists ? '已存在' : '不存在'}`);
      return exists;
    } else {
      console.warn('[Madoka Offscreen] [2/5] getContexts API 不可用，跳过检查');
    }
  } catch (e) {
    console.warn('[Madoka Offscreen] [3/5] getContexts 调用失败:', e);
  }
  return false;
}

/**
 * 创建 offscreen document
 */
async function createOffscreenDocument(): Promise<void> {
  console.log('[Madoka Offscreen] [4/5] 开始创建 offscreen document...');
  console.log('[Madoka Offscreen] 创建参数:', {
    url: OFFSCREEN_DOCUMENT_PATH,
    fullUrl: chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
    justification: OFFSCREEN_JUSTIFICATION,
  });
  
  try {
    // @ts-ignore - Chrome 109+ API
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      // @ts-ignore
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
      justification: OFFSCREEN_JUSTIFICATION,
    });
    console.log('[Madoka Offscreen] [5/5] ✓ Document created successfully');
  } catch (e) {
    // 如果已经存在，忽略错误
    if ((e as Error).message?.includes('Only a single offscreen')) {
      console.log('[Madoka Offscreen] [5/5] ✓ Document already exists (创建时发现已存在)');
      return;
    }
    console.error('[Madoka Offscreen] [5/5] ✗ 创建失败:', e);
    throw e;
  }
}

/**
 * 确保 offscreen document 已创建（带并发控制）
 */
export async function ensureOffscreenDocument(): Promise<void> {
  console.log('[Madoka Offscreen] ========== ensureOffscreenDocument 开始 ==========');
  
  // 如果已经在创建中，等待其完成
  if (creatingOffscreenPromise) {
    console.log('[Madoka Offscreen] 检测到正在创建中，等待...');
    return creatingOffscreenPromise;
  }

  // 创建新的创建任务
  creatingOffscreenPromise = (async () => {
    const startTime = Date.now();
    try {
      // 先检查是否已存在
      if (await hasOffscreenDocument()) {
        console.log('[Madoka Offscreen] 已存在，无需创建');
        return;
      }

      // 不存在则创建
      await createOffscreenDocument();
      
      // 等待一小段时间确保页面加载完成
      console.log('[Madoka Offscreen] 等待页面加载完成 (100ms)...');
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('[Madoka Offscreen] 页面加载等待完成');
    } catch (e) {
      console.error('[Madoka Offscreen] 创建过程出错:', e);
      throw e;
    } finally {
      const duration = Date.now() - startTime;
      console.log(`[Madoka Offscreen] 创建流程结束，耗时: ${duration}ms`);
      creatingOffscreenPromise = null;
    }
  })();

  return creatingOffscreenPromise;
}

/**
 * 向 offscreen 发送 MCP 相关消息
 */
export async function sendToOffscreen<T>(msg: Record<string, unknown>): Promise<T> {
  console.log('[Madoka Offscreen] ========== sendToOffscreen 开始 ==========');
  console.log('[Madoka Offscreen] 消息 action:', msg.action);
  
  const startTime = Date.now();
  
  try {
    await ensureOffscreenDocument();
    console.log('[Madoka Offscreen] offscreen 确保完成，准备发送消息...');
  } catch (e) {
    console.error('[Madoka Offscreen] 确保 offscreen 失败:', e);
    throw e;
  }
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error('[Madoka Offscreen] 消息发送超时 (30s)');
      reject(new Error('Offscreen 通信超时，请检查扩展是否正常运行'));
    }, 30000);

    console.log('[Madoka Offscreen] 发送消息到 offscreen...');
    chrome.runtime.sendMessage({ ...msg, target: "mcp-offscreen" }, (response) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      
      if (chrome.runtime.lastError) {
        console.error('[Madoka Offscreen] 消息发送失败:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        console.log(`[Madoka Offscreen] 消息发送成功，耗时: ${duration}ms`);
        console.log('[Madoka Offscreen] 响应:', response);
        resolve(response as T);
      }
    });
  });
}
```

### 步骤2: 更新 manifest.json（如果需要）

确保 `web_accessible_resources` 中包含 offscreen 页面：

```json
{
  "web_accessible_resources": [
    {
      "resources": [
        "public/icons/*",
        "public/pdfjs/*",
        "src/offscreen/index.html"
      ],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 步骤3: 验证 vite.config.ts 包含 offscreen 页面

确保 vite 配置中包含 offscreen 页面的入口：

```typescript
build: {
  rollupOptions: {
    input: {
      sidepanel: 'src/sidepanel/index.html',
      offscreen: 'src/offscreen/index.html',
    },
  },
}
```

## 文件变更清单

### 修改文件
1. `src/background/offscreen.ts` - 增强 offscreen 管理逻辑

### 可选修改
2. `src/manifest.json` - 确保 web_accessible_resources 包含 offscreen 页面

## 预期结果

- 修复后，MCP 远程 URL 测试功能可以正常工作
- 不再出现 `document is not defined` 或 `TransformStream is not defined` 错误
- 更好的错误处理和日志输出，便于排查问题
