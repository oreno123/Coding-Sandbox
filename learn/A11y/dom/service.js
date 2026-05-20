/**
 * @file dom/service.js
 * @description CDP communication layer for fetching DOM trees
 * Corresponds to browser-use/dom/service.py
 */

import { REQUIRED_COMPUTED_STYLES } from './views.js';

// Configuration constants (matching browser-use defaults)
const CDP_TIMEOUT_MS = 10000;       // First attempt timeout
const CDP_RETRY_TIMEOUT_MS = 2000;  // Retry timeout
const DEFAULT_MAX_IFRAMES = 100;    // Maximum iframe documents to process
const DEFAULT_MAX_IFRAME_DEPTH = 5; // Maximum iframe nesting depth

/**
 * CDPService - Handles all Chrome DevTools Protocol communication
 */
export class CDPService {
  constructor(tabId, options = {}) {
    this.tabId = tabId;
    this.attached = false;
    this.maxIframes = options.maxIframes || DEFAULT_MAX_IFRAMES;
    this.maxIframeDepth = options.maxIframeDepth || DEFAULT_MAX_IFRAME_DEPTH;
  }

  /**
   * Send a CDP command
   * @param {string} method - CDP method name
   * @param {Object} params - Method parameters
   * @returns {Promise<any>} Command result
   */
  sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      chrome.debugger.sendCommand({ tabId: this.tabId }, method, params, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`CDP ${method} failed: ${chrome.runtime.lastError.message}`));
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Attach debugger to tab
   */
  async attach() {
    if (this.attached) return;
    
    return new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId: this.tabId }, '1.3', () => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to attach debugger: ${chrome.runtime.lastError.message}`));
        } else {
          this.attached = true;
          console.log('[CDPService] Debugger attached');
          resolve();
        }
      });
    });
  }

  /**
   * Detach debugger from tab
   */
  async detach() {
    if (!this.attached) return;
    
    return new Promise((resolve) => {
      chrome.debugger.detach({ tabId: this.tabId }, () => {
        this.attached = false;
        console.log('[CDPService] Debugger detached');
        resolve();
      });
    });
  }

  /**
   * Enable required CDP domains
   */
  async enableDomains() {
    const domains = ['DOM', 'DOMSnapshot', 'Accessibility', 'Page', 'Runtime'];
    
    for (const domain of domains) {
      await this.sendCommand(`${domain}.enable`, {});
    }
    
    console.log('[CDPService] CDP domains enabled');
  }

  /**
   * Capture DOM snapshot with layout information
   * @returns {Promise<Object>} Snapshot result
   */
  async captureSnapshot() {
    console.log('[CDPService] Capturing DOMSnapshot...');
    
    const result = await this.sendCommand('DOMSnapshot.captureSnapshot', {
      computedStyles: REQUIRED_COMPUTED_STYLES,
      includePaintOrder: true,
      includeDOMRects: true,
      includeBlendedBackgroundColors: false,
      includeTextColorOpacities: false
    });

    console.log(`[CDPService] Snapshot captured: ${result.documents?.length || 0} documents`);
    return result;
  }

  /**
   * Get full DOM document tree
   * @returns {Promise<Object>} DOM tree result
   */
  async getDOMDocument() {
    console.log('[CDPService] Getting DOM document...');
    
    const result = await this.sendCommand('DOM.getDocument', {
      depth: -1,
      pierce: true
    });

    console.log('[CDPService] DOM tree fetched');
    return result;
  }

  /**
   * Get full accessibility tree for all frames
   * @returns {Promise<Object>} Merged AX tree
   */
  async getFullAXTree() {
    console.log('[CDPService] Getting Accessibility tree...');
    
    // Get all frame IDs
    const frameTree = await this.sendCommand('Page.getFrameTree', {});
    const frameIds = this._collectFrameIds(frameTree.frameTree);
    console.log(`[CDPService] Found ${frameIds.length} frames`);
    
    // Fetch AX tree for each frame in parallel
    const axTreePromises = frameIds.map(frameId => 
      this.sendCommand('Accessibility.getFullAXTree', { frameId })
        .catch(err => {
          console.warn(`[CDPService] Failed to get AX tree for frame ${frameId}:`, err.message);
          return { nodes: [] };
        })
    );
    
    const axTrees = await Promise.all(axTreePromises);
    
    // Merge all nodes
    const mergedNodes = [];
    for (const axTree of axTrees) {
      if (axTree.nodes) {
        mergedNodes.push(...axTree.nodes);
      }
    }
    
    console.log(`[CDPService] AX tree fetched: ${mergedNodes.length} total nodes`);
    return { nodes: mergedNodes };
  }

  /**
   * Get layout metrics for the page
   * @returns {Promise<Object>} Layout metrics
   */
  async getLayoutMetrics() {
    console.log('[CDPService] Getting layout metrics...');
    const result = await this.sendCommand('Page.getLayoutMetrics', {});
    console.log('[CDPService] Layout metrics fetched');
    return result;
  }

  /**
   * Execute promise with timeout
   * @param {Promise} promise - Promise to execute
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} name - Name for error message
   * @returns {Promise} Promise with timeout
   */
  _withTimeout(promise, timeoutMs, name) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Fetch all three trees in parallel with timeout and retry
   * Matches browser-use/dom/service.py _get_all_trees behavior
   * @returns {Promise<Object>} All tree data
   */
  async fetchAllTrees() {
    const startTime = Date.now();
    const timing = {};

    // Define task creators for retry support
    const taskCreators = {
      snapshot: () => this.captureSnapshot(),
      domTree: () => this.getDOMDocument(),
      axTree: () => this.getFullAXTree(),
      layoutMetrics: () => this.getLayoutMetrics()
    };

    const results = {};
    let failed = [];

    // First attempt with CDP_TIMEOUT_MS timeout
    console.log('[CDPService] Fetching all trees (first attempt)...');
    const firstAttemptStart = Date.now();
    
    const firstAttemptPromises = Object.entries(taskCreators).map(async ([key, creator]) => {
      try {
        const result = await this._withTimeout(creator(), CDP_TIMEOUT_MS, key);
        return { key, result, success: true };
      } catch (error) {
        console.warn(`[CDPService] ${key} failed: ${error.message}`);
        return { key, error, success: false };
      }
    });

    const firstResults = await Promise.all(firstAttemptPromises);
    timing.firstAttemptMs = Date.now() - firstAttemptStart;

    for (const { key, result, success } of firstResults) {
      if (success) {
        results[key] = result;
      } else {
        failed.push(key);
      }
    }

    // Retry failed tasks with shorter timeout
    if (failed.length > 0) {
      console.log(`[CDPService] Retrying ${failed.length} failed tasks: ${failed.join(', ')}`);
      const retryStart = Date.now();

      const retryPromises = failed.map(async (key) => {
        try {
          const result = await this._withTimeout(taskCreators[key](), CDP_RETRY_TIMEOUT_MS, key);
          return { key, result, success: true };
        } catch (error) {
          console.error(`[CDPService] ${key} retry failed: ${error.message}`);
          return { key, error, success: false };
        }
      });

      const retryResults = await Promise.all(retryPromises);
      timing.retryMs = Date.now() - retryStart;

      failed = [];
      for (const { key, result, success } of retryResults) {
        if (success) {
          results[key] = result;
        } else {
          failed.push(key);
        }
      }
    }

    // Check if all required tasks succeeded
    if (failed.length > 0) {
      throw new Error(`CDP requests failed or timed out: ${failed.join(', ')}`);
    }

    // Apply iframe limit to snapshot documents (prevent memory explosion)
    if (results.snapshot && results.snapshot.documents) {
      const originalDocCount = results.snapshot.documents.length;
      if (originalDocCount > this.maxIframes) {
        console.warn(
          `[CDPService] ⚠️ Limiting ${originalDocCount} iframes to first ${this.maxIframes} to prevent crashes`
        );
        results.snapshot.documents = results.snapshot.documents.slice(0, this.maxIframes);
      }
    }

    const fetchTime = Date.now() - startTime;
    console.log(`[CDPService] All trees fetched in ${fetchTime}ms`);

    return {
      snapshot: results.snapshot,
      domTree: results.domTree,
      axTree: results.axTree,
      layoutMetrics: results.layoutMetrics,
      fetchTime,
      timing
    };
  }

  /**
   * Collect all frame IDs recursively
   * @param {Object} frameTreeNode - Frame tree node
   * @returns {string[]} Array of frame IDs
   */
  _collectFrameIds(frameTreeNode) {
    const frameIds = [frameTreeNode.frame.id];
    
    if (frameTreeNode.childFrames) {
      for (const childFrame of frameTreeNode.childFrames) {
        frameIds.push(...this._collectFrameIds(childFrame));
      }
    }
    
    return frameIds;
  }
}

/**
 * Download data as JSON file
 * @param {Object} data - Data to download
 * @param {string} filename - Filename for download
 */
export async function downloadAsJSON(data, filename) {
  const jsonStr = JSON.stringify(data, null, 2);
  const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr);
  
  await chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true
  });
  
  console.log(`[CDPService] Downloaded: ${filename}`);
}
