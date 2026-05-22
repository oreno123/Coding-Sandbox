/**
 * @file background.js
 * @description Chrome Extension Background Script - Browser-Use DOM Serialization
 * 
 * This is a refactored, modular implementation that fixes the node inflation issues.
 * 
 * ARCHITECTURE:
 * - Uses inline module pattern for Chrome extension compatibility
 * - Strictly follows browser-use's serialization pipeline
 * - Each stage is clearly separated and independently testable
 */

// ==================== CONSTANTS (from dom/views.js) ====================

const NodeType = {
  ELEMENT_NODE: 1,
  ATTRIBUTE_NODE: 2,
  TEXT_NODE: 3,
  CDATA_SECTION_NODE: 4,
  ENTITY_REFERENCE_NODE: 5,
  ENTITY_NODE: 6,
  PROCESSING_INSTRUCTION_NODE: 7,
  COMMENT_NODE: 8,
  DOCUMENT_NODE: 9,
  DOCUMENT_TYPE_NODE: 10,
  DOCUMENT_FRAGMENT_NODE: 11,
  NOTATION_NODE: 12
};

// Configuration constants (matching browser-use defaults)
const CDP_TIMEOUT_MS = 10000;
const CDP_RETRY_TIMEOUT_MS = 2000;
const DEFAULT_MAX_IFRAMES = 100;
const DEFAULT_MAX_IFRAME_DEPTH = 5;
const VISIBILITY_BUFFER_PX = 1000;

const REQUIRED_COMPUTED_STYLES = [
  'display', 'visibility', 'opacity', 'overflow', 'overflow-x',
  'overflow-y', 'cursor', 'pointer-events', 'position', 'background-color'
];

const DISABLED_ELEMENTS = new Set([
  'style', 'script', 'head', 'meta', 'link', 'title', 'noscript'
]);

const SVG_ELEMENTS = new Set([
  'path', 'rect', 'g', 'circle', 'ellipse', 'line', 'polyline',
  'polygon', 'use', 'defs', 'clipPath', 'mask', 'pattern',
  'image', 'text', 'tspan', 'linearGradient', 'radialGradient', 'stop'
]);

// Extended PROPAGATING_ELEMENTS with Compound Components support
const PROPAGATING_ELEMENTS = [
  { tag: 'a', role: null },
  { tag: 'button', role: null },
  { tag: 'div', role: 'button' },
  { tag: 'div', role: 'combobox' },
  { tag: 'span', role: 'button' },
  { tag: 'span', role: 'combobox' },
  { tag: 'input', role: 'combobox' },
  { tag: 'div', role: 'menuitem' },
  { tag: 'div', role: 'menuitemcheckbox' },
  { tag: 'div', role: 'menuitemradio' },
  { tag: 'li', role: 'menuitem' },
  { tag: 'li', role: 'option' },
  { tag: 'div', role: 'option' },
  { tag: 'div', role: 'listitem' },
  { tag: 'button', role: 'tab' },
  { tag: 'div', role: 'tab' },
  { tag: 'div', role: 'treeitem' },
  { tag: 'li', role: 'treeitem' },
  { tag: 'div', role: 'gridcell' },
  { tag: 'td', role: 'gridcell' },
  { tag: 'div', role: 'link' },
  { tag: 'span', role: 'link' }
];

const INTERACTIVE_TAGS = new Set([
  'button', 'input', 'select', 'textarea', 'a',
  'details', 'summary', 'option', 'optgroup'
]);

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'menuitem', 'option', 'radio', 'checkbox',
  'tab', 'textbox', 'combobox', 'slider', 'spinbutton',
  'search', 'searchbox', 'listbox', 'menu', 'menubar', 'switch', 'treeitem'
]);

const FORM_ELEMENTS = new Set([
  'input', 'select', 'textarea', 'label', 'button'
]);

// Extended attributes list matching browser-use
const DEFAULT_INCLUDE_ATTRIBUTES = [
  'title', 'type', 'checked', 'id', 'name', 'role', 'value', 'placeholder',
  'alt', 'href', 'aria-label', 'aria-expanded', 'aria-checked',
  'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-placeholder',
  'data-date-format', 'data-state', 'data-mask', 'data-inputmask', 'data-datepicker',
  'pattern', 'min', 'max', 'minlength', 'maxlength', 'step', 'accept',
  'multiple', 'inputmode', 'autocomplete', 'contenteditable',
  'format', 'expected_format', 'pseudo',
  'selected', 'expanded', 'pressed', 'disabled', 'invalid',
  'valuemin', 'valuemax', 'valuenow', 'keyshortcuts', 'haspopup',
  'multiselectable', 'required', 'valuetext', 'level', 'busy', 'live', 'ax_name'
];

// Static attributes for hashing
const STATIC_ATTRIBUTES = new Set([
  'class', 'id', 'name', 'type', 'placeholder', 'aria-label', 'title', 'role',
  'data-testid', 'data-test', 'data-cy', 'data-selenium', 'for',
  'required', 'disabled', 'readonly', 'checked', 'selected', 'multiple',
  'accept', 'href', 'target', 'rel', 'aria-describedby', 'aria-labelledby',
  'aria-controls', 'aria-owns', 'aria-live', 'aria-atomic', 'aria-busy',
  'aria-disabled', 'aria-hidden', 'aria-pressed', 'aria-checked', 'aria-selected',
  'tabindex', 'alt', 'src', 'lang', 'itemscope', 'itemtype', 'itemprop', 'pseudo',
  'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-placeholder'
]);

// Dynamic class patterns to filter for stable hashing
const DYNAMIC_CLASS_PATTERNS = new Set([
  'focus', 'hover', 'active', 'selected', 'disabled', 'animation',
  'transition', 'loading', 'open', 'closed', 'expanded', 'collapsed',
  'visible', 'hidden', 'pressed', 'checked', 'highlighted', 'current',
  'entering', 'leaving'
]);

// ==================== UTILITIES (from dom/utils.js) ====================

function capTextLength(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function getNodeTypeName(nodeType) {
  const names = {
    1: 'ELEMENT_NODE', 3: 'TEXT_NODE', 8: 'COMMENT_NODE',
    9: 'DOCUMENT_NODE', 10: 'DOCUMENT_TYPE_NODE', 11: 'DOCUMENT_FRAGMENT_NODE'
  };
  return names[nodeType] || 'UNKNOWN';
}

function parseComputedStyles(strings, styleIndices) {
  const styles = {};
  if (!styleIndices) return styles;
  for (let i = 0; i < styleIndices.length && i < REQUIRED_COMPUTED_STYLES.length; i++) {
    const styleIndex = styleIndices[i];
    if (styleIndex >= 0 && styleIndex < strings.length) {
      styles[REQUIRED_COMPUTED_STYLES[i]] = strings[styleIndex];
    }
  }
  return styles;
}

function calculateDevicePixelRatio(layoutMetrics) {
  const visualViewport = layoutMetrics.visualViewport || {};
  const cssVisualViewport = layoutMetrics.cssVisualViewport || {};
  const cssLayoutViewport = layoutMetrics.cssLayoutViewport || {};
  const width = cssVisualViewport.clientWidth || cssLayoutViewport.clientWidth || 1920.0;
  const deviceWidth = visualViewport.clientWidth || width;
  const cssWidth = cssVisualViewport.clientWidth || width;
  return cssWidth > 0 ? deviceWidth / cssWidth : 1.0;
}

function isContainedWithinBounds(child, parent, threshold = 0.99) {
  const xOverlap = Math.max(0, Math.min(child.x + child.width, parent.x + parent.width) - Math.max(child.x, parent.x));
  const yOverlap = Math.max(0, Math.min(child.y + child.height, parent.y + parent.height) - Math.max(child.y, parent.y));
  const intersectionArea = xOverlap * yOverlap;
  const childArea = child.width * child.height;
  if (childArea === 0) return false;
  return (intersectionArea / childArea) >= threshold;
}

function containsAny(str, patterns) {
  if (!str) return false;
  const lowerStr = str.toLowerCase();
  return patterns.some(p => lowerStr.includes(p.toLowerCase()));
}

// ==================== CDP SERVICE (from dom/service.js) ====================

class CDPService {
  constructor(tabId, options = {}) {
    this.tabId = tabId;
    this.attached = false;
    this.maxIframes = options.maxIframes || DEFAULT_MAX_IFRAMES;
    this.maxIframeDepth = options.maxIframeDepth || DEFAULT_MAX_IFRAME_DEPTH;
  }

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

  _withTimeout(promise, timeoutMs, name) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  async attach() {
    if (this.attached) return;
    return new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId: this.tabId }, '1.3', () => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to attach: ${chrome.runtime.lastError.message}`));
        } else {
          this.attached = true;
          resolve();
        }
      });
    });
  }

  async detach() {
    if (!this.attached) return;
    return new Promise((resolve) => {
      chrome.debugger.detach({ tabId: this.tabId }, () => {
        this.attached = false;
        resolve();
      });
    });
  }

  async enableDomains() {
    const domains = ['DOM', 'DOMSnapshot', 'Accessibility', 'Page', 'Runtime'];
    for (const domain of domains) {
      await this.sendCommand(`${domain}.enable`, {});
    }
  }

  async captureSnapshot() {
    return await this.sendCommand('DOMSnapshot.captureSnapshot', {
      computedStyles: REQUIRED_COMPUTED_STYLES,
      includePaintOrder: true,
      includeDOMRects: true,
      includeBlendedBackgroundColors: false,
      includeTextColorOpacities: false
    });
  }

  async getDOMDocument() {
    return await this.sendCommand('DOM.getDocument', { depth: -1, pierce: true });
  }

  async getFullAXTree() {
    const frameTree = await this.sendCommand('Page.getFrameTree', {});
    const frameIds = this._collectFrameIds(frameTree.frameTree);
    
    const axTrees = await Promise.all(
      frameIds.map(frameId =>
        this.sendCommand('Accessibility.getFullAXTree', { frameId })
          .catch(() => ({ nodes: [] }))
      )
    );
    
    const mergedNodes = [];
    for (const axTree of axTrees) {
      if (axTree.nodes) mergedNodes.push(...axTree.nodes);
    }
    return { nodes: mergedNodes };
  }

  async getLayoutMetrics() {
    return await this.sendCommand('Page.getLayoutMetrics', {});
  }

  async fetchAllTrees() {
    const startTime = Date.now();
    const timing = {};

    const taskCreators = {
      snapshot: () => this.captureSnapshot(),
      domTree: () => this.getDOMDocument(),
      axTree: () => this.getFullAXTree(),
      layoutMetrics: () => this.getLayoutMetrics()
    };

    const results = {};
    let failed = [];

    // First attempt with timeout
    console.log('[CDPService] Fetching all trees (first attempt)...');
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
    timing.firstAttemptMs = Date.now() - startTime;

    for (const { key, result, success } of firstResults) {
      if (success) results[key] = result;
      else failed.push(key);
    }

    // Retry failed tasks
    if (failed.length > 0) {
      console.log(`[CDPService] Retrying ${failed.length} failed tasks: ${failed.join(', ')}`);
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
      timing.retryMs = Date.now() - timing.firstAttemptMs - startTime;

      failed = [];
      for (const { key, result, success } of retryResults) {
        if (success) results[key] = result;
        else failed.push(key);
      }
    }

    if (failed.length > 0) {
      throw new Error(`CDP requests failed or timed out: ${failed.join(', ')}`);
    }

    // Apply iframe limit
    if (results.snapshot && results.snapshot.documents) {
      const originalDocCount = results.snapshot.documents.length;
      if (originalDocCount > this.maxIframes) {
        console.warn(`[CDPService] Limiting ${originalDocCount} iframes to first ${this.maxIframes}`);
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

// ==================== TREE MERGER (from dom/tree_merger.js) ====================

class TreeMerger {
  constructor(snapshot, domTree, axTree, layoutMetrics, options = {}) {
    this.snapshot = snapshot;
    this.domTree = domTree;
    this.axTree = axTree;
    this.devicePixelRatio = calculateDevicePixelRatio(layoutMetrics);
    this.snapshotLookup = {};
    this.axTreeLookup = {};
    this.enhancedNodeLookup = {};
    this.maxIframeDepth = options.maxIframeDepth || DEFAULT_MAX_IFRAME_DEPTH;
  }

  merge() {
    this._buildSnapshotLookup();
    this._buildAXTreeLookup();
    
    const enhancedRoot = this._constructEnhancedNode(
      this.domTree.root, [], { x: 0, y: 0, width: 0, height: 0 }, 0
    );
    
    // Post-process: compute hashes and xpaths
    this._computeHashesAndXPaths();
    
    return {
      root: enhancedRoot,
      lookup: this.enhancedNodeLookup,
      stats: {
        snapshotEntries: Object.keys(this.snapshotLookup).length,
        axTreeEntries: Object.keys(this.axTreeLookup).length,
        totalNodes: Object.keys(this.enhancedNodeLookup).length,
        maxIframeDepth: this.maxIframeDepth
      }
    };
  }
  
  _computeHashesAndXPaths() {
    for (const [nodeId, node] of Object.entries(this.enhancedNodeLookup)) {
      if (node.node_type === NodeType.ELEMENT_NODE) {
        node.xpath = this._generateXPath(node);
        node.element_hash = this._computeElementHash(node);
        node.stable_hash = this._computeStableHash(node);
      }
    }
  }
  
  _generateXPath(node) {
    const segments = [];
    let current = node;
    
    while (current && (current.node_type === 1 || current.node_type === 11)) {
      if (current.node_type === 11) {
        if (current.parent_node_id && this.enhancedNodeLookup[current.parent_node_id]) {
          current = this.enhancedNodeLookup[current.parent_node_id];
        } else break;
        continue;
      }
      
      if (current.parent_node_id) {
        const parent = this.enhancedNodeLookup[current.parent_node_id];
        if (parent && parent.node_name.toLowerCase() === 'iframe') break;
      }
      
      const tagName = current.node_name.toLowerCase();
      const position = this._getElementPosition(current);
      const xpathIndex = position > 0 ? `[${position}]` : '';
      segments.unshift(`${tagName}${xpathIndex}`);
      
      if (current.parent_node_id && this.enhancedNodeLookup[current.parent_node_id]) {
        current = this.enhancedNodeLookup[current.parent_node_id];
      } else break;
    }
    
    return segments.join('/');
  }
  
  _getElementPosition(element) {
    if (!element.parent_node_id || !this.enhancedNodeLookup[element.parent_node_id]) return 0;
    const parent = this.enhancedNodeLookup[element.parent_node_id];
    const children = parent.children_nodes || [];
    const sameTagSiblings = children.filter(c => 
      c.node_type === 1 && c.node_name.toLowerCase() === element.node_name.toLowerCase()
    );
    if (sameTagSiblings.length <= 1) return 0;
    const index = sameTagSiblings.findIndex(s => s.node_id === element.node_id);
    return index >= 0 ? index + 1 : 0;
  }
  
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    let fullHash = Math.abs(hash).toString(16).padStart(8, '0');
    for (let i = 0; i < 3; i++) {
      let partHash = 0;
      for (let j = 0; j < str.length; j++) {
        const char = str.charCodeAt(j);
        partHash = ((partHash << (5 + i)) - partHash) + char + (i * 31);
        partHash = partHash & partHash;
      }
      fullHash += Math.abs(partHash).toString(16).padStart(8, '0');
    }
    return fullHash.slice(0, 16);
  }
  
  _getParentBranchPath(node) {
    const parents = [];
    let current = node;
    while (current) {
      if (current.node_type === 1) parents.push(current);
      if (current.parent_node_id && this.enhancedNodeLookup[current.parent_node_id]) {
        current = this.enhancedNodeLookup[current.parent_node_id];
      } else break;
    }
    parents.reverse();
    return parents.map(p => p.node_name.toLowerCase());
  }
  
  _computeElementHash(node) {
    const parentPath = this._getParentBranchPath(node).join('/');
    const attrs = node.attributes || {};
    const sortedAttrs = Object.entries(attrs)
      .filter(([k]) => STATIC_ATTRIBUTES.has(k))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`).join('');
    let axName = '';
    if (node.ax_node && node.ax_node.name) axName = `|ax_name=${node.ax_node.name}`;
    return this._simpleHash(`${parentPath}|${sortedAttrs}${axName}`);
  }
  
  _computeStableHash(node) {
    const parentPath = this._getParentBranchPath(node).join('/');
    const attrs = node.attributes || {};
    const filteredAttrs = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (!STATIC_ATTRIBUTES.has(k)) continue;
      if (k === 'class') {
        const classes = v.split(/\s+/).filter(Boolean)
          .filter(c => !Array.from(DYNAMIC_CLASS_PATTERNS).some(p => c.toLowerCase().includes(p)));
        if (classes.length) filteredAttrs[k] = classes.sort().join(' ');
      } else {
        filteredAttrs[k] = v;
      }
    }
    const sortedAttrs = Object.entries(filteredAttrs)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`).join('');
    let axName = '';
    if (node.ax_node && node.ax_node.name) axName = `|ax_name=${node.ax_node.name}`;
    return this._simpleHash(`${parentPath}|${sortedAttrs}${axName}`);
  }

  _buildSnapshotLookup() {
    if (!this.snapshot.documents?.length) return;
    const strings = this.snapshot.strings || [];

    for (const document of this.snapshot.documents) {
      const nodes = document.nodes || {};
      const layout = document.layout || {};

      const backendNodeToIdx = {};
      if (nodes.backendNodeId) {
        for (let i = 0; i < nodes.backendNodeId.length; i++) {
          backendNodeToIdx[nodes.backendNodeId[i]] = i;
        }
      }

      const layoutIndexMap = {};
      if (layout.nodeIndex) {
        for (let layoutIdx = 0; layoutIdx < layout.nodeIndex.length; layoutIdx++) {
          const nodeIndex = layout.nodeIndex[layoutIdx];
          if (!(nodeIndex in layoutIndexMap)) {
            layoutIndexMap[nodeIndex] = layoutIdx;
          }
        }
      }

      for (const [backendNodeIdStr, snapshotIndex] of Object.entries(backendNodeToIdx)) {
        const backendNodeId = parseInt(backendNodeIdStr);
        
        let isClickable = null;
        if (nodes.isClickable?.index) {
          isClickable = nodes.isClickable.index.includes(snapshotIndex);
        }

        let cursorStyle = null, boundingBox = null, computedStyles = {};
        let paintOrder = null, clientRects = null, scrollRects = null;

        if (snapshotIndex in layoutIndexMap) {
          const layoutIdx = layoutIndexMap[snapshotIndex];

          if (layout.bounds?.[layoutIdx]?.length >= 4) {
            const bounds = layout.bounds[layoutIdx];
            boundingBox = {
              x: bounds[0] / this.devicePixelRatio,
              y: bounds[1] / this.devicePixelRatio,
              width: bounds[2] / this.devicePixelRatio,
              height: bounds[3] / this.devicePixelRatio
            };
          }

          if (layout.styles?.[layoutIdx]) {
            computedStyles = parseComputedStyles(strings, layout.styles[layoutIdx]);
            cursorStyle = computedStyles.cursor || null;
          }

          if (layout.paintOrders) paintOrder = layout.paintOrders[layoutIdx] ?? null;
          
          if (layout.clientRects?.[layoutIdx]?.length >= 4) {
            const cr = layout.clientRects[layoutIdx];
            clientRects = { x: cr[0], y: cr[1], width: cr[2], height: cr[3] };
          }
          
          if (layout.scrollRects?.[layoutIdx]?.length >= 4) {
            const sr = layout.scrollRects[layoutIdx];
            scrollRects = { x: sr[0], y: sr[1], width: sr[2], height: sr[3] };
          }
        }

        this.snapshotLookup[backendNodeId] = {
          is_clickable: isClickable,
          cursor_style: cursorStyle,
          bounds: boundingBox,
          clientRects, scrollRects,
          computed_styles: Object.keys(computedStyles).length > 0 ? computedStyles : null,
          paint_order: paintOrder
        };
      }
    }
  }

  _buildAXTreeLookup() {
    if (!this.axTree.nodes) return;
    for (const axNode of this.axTree.nodes) {
      if (axNode.backendDOMNodeId !== undefined) {
        this.axTreeLookup[axNode.backendDOMNodeId] = axNode;
      }
    }
  }

  _constructEnhancedNode(node, htmlFrames, totalFrameOffset, iframeDepth = 0) {
    if (!node) return null;
    if (this.enhancedNodeLookup[node.nodeId]) {
      return this.enhancedNodeLookup[node.nodeId];
    }

    const currentOffset = { ...totalFrameOffset };
    const axNode = this.axTreeLookup[node.backendNodeId] || null;
    const snapshotData = this.snapshotLookup[node.backendNodeId] || null;

    let absolutePosition = null;
    if (snapshotData?.bounds) {
      absolutePosition = {
        x: snapshotData.bounds.x + currentOffset.x,
        y: snapshotData.bounds.y + currentOffset.y,
        width: snapshotData.bounds.width,
        height: snapshotData.bounds.height
      };
    }

    const attributes = {};
    if (node.attributes) {
      for (let i = 0; i < node.attributes.length; i += 2) {
        attributes[node.attributes[i]] = node.attributes[i + 1];
      }
    }

    const enhancedAxNode = axNode ? {
      ax_node_id: axNode.nodeId,
      ignored: axNode.ignored || false,
      role: axNode.role?.value ?? null,
      name: axNode.name?.value ?? null,
      description: axNode.description?.value ?? null,
      properties: axNode.properties?.map(p => ({ name: p.name, value: p.value?.value ?? null })) || null,
      child_ids: axNode.childIds || null
    } : null;

    const domTreeNode = {
      node_id: node.nodeId,
      backend_node_id: node.backendNodeId,
      node_type: node.nodeType,
      node_type_name: getNodeTypeName(node.nodeType),
      node_name: node.nodeName,
      tag_name: node.nodeName,
      node_value: node.nodeValue || null,
      attributes,
      is_scrollable: node.isScrollable || null,
      frame_id: node.frameId || null,
      shadow_root_type: node.shadowRootType || null,
      ax_node: enhancedAxNode,
      snapshot_node: snapshotData,
      absolute_position: absolutePosition,
      is_visible: null,
      content_document: null,
      shadow_roots: [],
      children_nodes: [],
      parent_node_id: null,
      is_actually_scrollable: false
    };

    this.enhancedNodeLookup[node.nodeId] = domTreeNode;

    let updatedHtmlFrames = [...htmlFrames];

    if (node.nodeType === NodeType.ELEMENT_NODE && node.nodeName === 'HTML' && node.frameId) {
      updatedHtmlFrames.push(domTreeNode);
      if (snapshotData?.scrollRects) {
        currentOffset.x -= snapshotData.scrollRects.x;
        currentOffset.y -= snapshotData.scrollRects.y;
      }
    }

    if ((node.nodeName.toUpperCase() === 'IFRAME' || node.nodeName.toUpperCase() === 'FRAME') && snapshotData?.bounds) {
      updatedHtmlFrames.push(domTreeNode);
      currentOffset.x += snapshotData.bounds.x;
      currentOffset.y += snapshotData.bounds.y;
    }

    if (node.contentDocument) {
      if (iframeDepth >= this.maxIframeDepth) {
        console.warn(`[TreeMerger] Skipping iframe at depth ${iframeDepth} (max: ${this.maxIframeDepth})`);
      } else {
        domTreeNode.content_document = this._constructEnhancedNode(node.contentDocument, updatedHtmlFrames, currentOffset, iframeDepth + 1);
        if (domTreeNode.content_document) domTreeNode.content_document.parent_node_id = node.nodeId;
      }
    }

    const shadowRootNodeIds = new Set((node.shadowRoots || []).map(sr => sr.nodeId));

    if (node.shadowRoots?.length) {
      for (const shadowRoot of node.shadowRoots) {
        const shadowRootNode = this._constructEnhancedNode(shadowRoot, updatedHtmlFrames, currentOffset, iframeDepth);
        if (shadowRootNode) {
          shadowRootNode.parent_node_id = node.nodeId;
          domTreeNode.shadow_roots.push(shadowRootNode);
        }
      }
    }

    if (node.children?.length) {
      for (const child of node.children) {
        if (shadowRootNodeIds.has(child.nodeId)) continue;
        const childNode = this._constructEnhancedNode(child, updatedHtmlFrames, currentOffset, iframeDepth);
        if (childNode) {
          childNode.parent_node_id = node.nodeId;
          domTreeNode.children_nodes.push(childNode);
        }
      }
    }

    domTreeNode.is_visible = this._isElementVisible(domTreeNode, updatedHtmlFrames);
    domTreeNode.is_actually_scrollable = this._isActuallyScrollable(domTreeNode);

    return domTreeNode;
  }

  _isElementVisible(node, htmlFrames) {
    if (!node.snapshot_node) return false;

    const styles = node.snapshot_node.computed_styles || {};
    const display = (styles.display || '').toLowerCase();
    const visibility = (styles.visibility || '').toLowerCase();
    const opacity = styles.opacity || '1';

    if (display === 'none' || visibility === 'hidden') return false;
    try { if (parseFloat(opacity) <= 0) return false; } catch (e) {}

    const bounds = node.snapshot_node.bounds;
    if (!bounds) return false;

    const boundsToCheck = { ...bounds };

    for (let i = htmlFrames.length - 1; i >= 0; i--) {
      const frame = htmlFrames[i];

      if (frame.node_type === NodeType.ELEMENT_NODE &&
          (frame.node_name.toUpperCase() === 'IFRAME' || frame.node_name.toUpperCase() === 'FRAME') &&
          frame.snapshot_node?.bounds) {
        boundsToCheck.x += frame.snapshot_node.bounds.x;
        boundsToCheck.y += frame.snapshot_node.bounds.y;
      }

      if (frame.node_type === NodeType.ELEMENT_NODE &&
          frame.node_name === 'HTML' &&
          frame.snapshot_node?.scrollRects &&
          frame.snapshot_node?.clientRects) {
        
        const viewportRight = frame.snapshot_node.clientRects.width;
        const viewportBottom = frame.snapshot_node.clientRects.height;
        const adjustedX = boundsToCheck.x - frame.snapshot_node.scrollRects.x;
        const adjustedY = boundsToCheck.y - frame.snapshot_node.scrollRects.y;

        const inView = (
          adjustedX < viewportRight &&
          adjustedX + boundsToCheck.width > 0 &&
          adjustedY < viewportBottom + VISIBILITY_BUFFER_PX &&
          adjustedY + boundsToCheck.height > -VISIBILITY_BUFFER_PX
        );

        if (!inView) return false;

        boundsToCheck.x -= frame.snapshot_node.scrollRects.x;
        boundsToCheck.y -= frame.snapshot_node.scrollRects.y;
      }
    }

    return true;
  }

  _isActuallyScrollable(node) {
    if (node.is_scrollable) return true;
    if (!node.snapshot_node) return false;

    const scrollRects = node.snapshot_node.scrollRects;
    const clientRects = node.snapshot_node.clientRects;

    if (scrollRects && clientRects) {
      const hasVertical = scrollRects.height > clientRects.height + 1;
      const hasHorizontal = scrollRects.width > clientRects.width + 1;

      if (hasVertical || hasHorizontal) {
        const styles = node.snapshot_node.computed_styles || {};
        const overflow = (styles.overflow || 'visible').toLowerCase();
        const overflowX = (styles['overflow-x'] || overflow).toLowerCase();
        const overflowY = (styles['overflow-y'] || overflow).toLowerCase();
        const scrollValues = ['auto', 'scroll', 'overlay'];
        return scrollValues.includes(overflow) || scrollValues.includes(overflowX) || scrollValues.includes(overflowY);
      }
    }

    return false;
  }
}

// ==================== CLICKABLE DETECTOR (from dom/serializer/clickable_detector.js) ====================

const SEARCH_INDICATORS = ['search', 'magnify', 'glass', 'lookup', 'find', 'query', 'searchbox'];
const INTERACTIVE_ATTRIBUTES = ['onclick', 'onmousedown', 'onmouseup', 'onkeydown', 'onkeyup', 'onkeypress', 'onfocus', 'onblur', 'tabindex'];
const INTERACTIVE_AX_PROPS = new Set(['focusable', 'editable', 'settable']);
const STATE_AX_PROPS = new Set(['checked', 'expanded', 'pressed', 'selected']);

class ClickableElementDetector {
  static isInteractive(node) {
    if (node.node_type !== NodeType.ELEMENT_NODE) return false;

    const tagName = (node.node_name || node.tag_name || '').toLowerCase();
    const attrs = node.attributes || {};

    if (tagName === 'html' || tagName === 'body') return false;

    if (tagName === 'iframe' || tagName === 'frame') {
      if (node.snapshot_node?.bounds) {
        const { width, height } = node.snapshot_node.bounds;
        if (width > 100 && height > 100) return true;
      }
    }

    const classList = (attrs.class || '').toLowerCase();
    const elementId = (attrs.id || '').toLowerCase();
    if (containsAny(classList, SEARCH_INDICATORS) || containsAny(elementId, SEARCH_INDICATORS)) return true;

    if (node.ax_node?.properties) {
      for (const prop of node.ax_node.properties) {
        if (prop.name === 'disabled' && prop.value) return false;
        if (prop.name === 'hidden' && prop.value) return false;
        if (INTERACTIVE_AX_PROPS.has(prop.name) && prop.value) return true;
        if (STATE_AX_PROPS.has(prop.name)) return true;
        if ((prop.name === 'required' || prop.name === 'autocomplete') && prop.value) return true;
        if (prop.name === 'keyshortcuts' && prop.value) return true;
      }
    }

    if (INTERACTIVE_TAGS.has(tagName)) return true;
    if (INTERACTIVE_ATTRIBUTES.some(attr => attr in attrs)) return true;
    if (attrs.role && INTERACTIVE_ROLES.has(attrs.role)) return true;
    if (node.ax_node?.role && INTERACTIVE_ROLES.has(node.ax_node.role)) return true;
    if (attrs.contenteditable === 'true' || attrs.contenteditable === '') return true;

    if (node.snapshot_node?.bounds) {
      const { width, height } = node.snapshot_node.bounds;
      if (width >= 10 && width <= 50 && height >= 10 && height <= 50) {
        if (['class', 'role', 'onclick', 'data-action', 'aria-label'].some(attr => attr in attrs && attrs[attr])) {
          return true;
        }
      }
    }

    if (node.snapshot_node?.cursor_style === 'pointer') return true;
    if (node.snapshot_node?.is_clickable === true) return true;

    return false;
  }
}

// ==================== PAINT ORDER (from dom/serializer/paint_order.js) ====================

class Rect {
  constructor(x1, y1, x2, y2) { this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2; }
  intersects(o) { return !(this.x2 <= o.x1 || o.x2 <= this.x1 || this.y2 <= o.y1 || o.y2 <= this.y1); }
  contains(o) { return this.x1 <= o.x1 && this.y1 <= o.y1 && this.x2 >= o.x2 && this.y2 >= o.y2; }
}

class RectUnion {
  constructor() { this._rects = []; }

  _splitDiff(a, b) {
    const parts = [];
    if (a.y1 < b.y1) parts.push(new Rect(a.x1, a.y1, a.x2, b.y1));
    if (b.y2 < a.y2) parts.push(new Rect(a.x1, b.y2, a.x2, a.y2));
    const yLo = Math.max(a.y1, b.y1), yHi = Math.min(a.y2, b.y2);
    if (a.x1 < b.x1) parts.push(new Rect(a.x1, yLo, b.x1, yHi));
    if (b.x2 < a.x2) parts.push(new Rect(b.x2, yLo, a.x2, yHi));
    return parts;
  }

  contains(r) {
    if (!this._rects.length) return false;
    let stack = [r];
    for (const s of this._rects) {
      const newStack = [];
      for (const piece of stack) {
        if (s.contains(piece)) continue;
        if (piece.intersects(s)) newStack.push(...this._splitDiff(piece, s));
        else newStack.push(piece);
      }
      if (!newStack.length) return true;
      stack = newStack;
    }
    return false;
  }

  add(r) {
    if (this.contains(r)) return false;
    let pending = [r];
    for (const s of this._rects) {
      const newPending = [];
      for (const piece of pending) {
        if (piece.intersects(s)) newPending.push(...this._splitDiff(piece, s));
        else newPending.push(piece);
      }
      pending = newPending;
    }
    this._rects.push(...pending);
    return true;
  }
}

class PaintOrderRemover {
  constructor(root) { this.root = root; }

  calculate() {
    const nodes = [];
    this._collect(this.root, nodes);
    if (!nodes.length) return;

    const grouped = new Map();
    for (const node of nodes) {
      const po = node.original_node.snapshot_node.paint_order;
      if (!grouped.has(po)) grouped.set(po, []);
      grouped.get(po).push(node);
    }

    const rectUnion = new RectUnion();
    const sorted = Array.from(grouped.keys()).sort((a, b) => b - a);

    for (const po of sorted) {
      const grpNodes = grouped.get(po);
      const rectsToAdd = [];

      for (const node of grpNodes) {
        const bounds = node.original_node.snapshot_node.bounds;
        const rect = new Rect(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height);

        if (rectUnion.contains(rect)) {
          node.ignored_by_paint_order = true;
          continue;
        }

        const styles = node.original_node.snapshot_node?.computed_styles || {};
        const opacity = parseFloat(styles.opacity || '1');
        const bgColor = styles['background-color'] || 'rgba(0, 0, 0, 0)';

        if (opacity >= 0.8 && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
          const rgbaMatch = bgColor.match(/rgba?\([\d.]+,\s*[\d.]+,\s*[\d.]+(?:,\s*([\d.]+))?\)/);
          if (!rgbaMatch || rgbaMatch[1] === undefined || parseFloat(rgbaMatch[1]) >= 0.8) {
            rectsToAdd.push(rect);
          }
        }
      }

      for (const rect of rectsToAdd) rectUnion.add(rect);
    }
  }

  _collect(node, result) {
    if (node.original_node.snapshot_node?.paint_order !== null &&
        node.original_node.snapshot_node?.paint_order !== undefined &&
        node.original_node.snapshot_node?.bounds) {
      result.push(node);
    }
    for (const child of node.children) this._collect(child, result);
  }
}

// ==================== SIMPLIFIED TREE (from dom/serializer/simplified_tree.js) ====================

/**
 * SimplifiedNode - Lightweight wrapper for serialization
 */
class SimplifiedNode {
  constructor(originalNode) {
    this.original_node = originalNode;
    this.children = [];
    this.should_display = true;
    this.is_interactive = false;
    this.ignored_by_paint_order = false;
    this.excluded_by_parent = false;
    this.is_shadow_host = false;
    this.is_new = false;
  }
}

/**
 * SimplifiedTreeBuilder - Core filtering logic
 * KEY FIXES:
 * 1. Shadow DOM only included if has visible children
 * 2. Parent inclusion based on children visibility
 * 3. Proper recursive filtering
 */
class SimplifiedTreeBuilder {
  constructor(options = {}) {
    this.sessionId = options.sessionId || null;
  }

  build(node, depth = 0) {
    if (!node) return null;

    // DOCUMENT_NODE
    if (node.node_type === NodeType.DOCUMENT_NODE) {
      for (const child of this._getChildren(node)) {
        const simplified = this.build(child, depth + 1);
        if (simplified) return simplified;
      }
      return null;
    }

    // DOCUMENT_FRAGMENT_NODE (Shadow DOM)
    if (node.node_type === NodeType.DOCUMENT_FRAGMENT_NODE) {
      const simplified = new SimplifiedNode(node);
      for (const child of this._getChildren(node)) {
        const childSimp = this.build(child, depth + 1);
        if (childSimp) simplified.children.push(childSimp);
      }
      // KEY FIX #1: Only return shadow DOM if it has meaningful children
      return simplified.children.length > 0 ? simplified : null;
    }

    // ELEMENT_NODE
    if (node.node_type === NodeType.ELEMENT_NODE) {
      const tagName = (node.node_name || node.tag_name || '').toLowerCase();

      if (DISABLED_ELEMENTS.has(tagName)) return null;
      if (SVG_ELEMENTS.has(tagName)) return null;

      const attrs = node.attributes || {};
      if (attrs['data-browser-use-exclude'] === 'true') return null;

      // IFRAME/FRAME handling
      if (tagName === 'iframe' || tagName === 'frame') {
        if (node.content_document) {
          const simplified = new SimplifiedNode(node);
          for (const child of (node.content_document.children_nodes || [])) {
            const childSimp = this.build(child, depth + 1);
            if (childSimp) simplified.children.push(childSimp);
          }
          return simplified;
        }
        return node.is_visible ? new SimplifiedNode(node) : null;
      }

      const isVisible = node.is_visible;
      const isScrollable = node.is_actually_scrollable;
      const allChildren = this._getChildren(node);
      const isShadowHost = allChildren.some(c => c.node_type === NodeType.DOCUMENT_FRAGMENT_NODE);
      const isFileInput = tagName === 'input' && attrs.type === 'file';
      const effectiveVisible = isVisible || isFileInput;

      // KEY FIX #2: Build children first to check if this node matters
      const simplifiedChildren = [];
      for (const child of allChildren) {
        const childSimp = this.build(child, depth + 1);
        if (childSimp) simplifiedChildren.push(childSimp);
      }

      const hasVisibleChildren = simplifiedChildren.length > 0;

      if (effectiveVisible || isScrollable || (isShadowHost && hasVisibleChildren) || hasVisibleChildren) {
        const simplified = new SimplifiedNode(node);
        simplified.children = simplifiedChildren;
        simplified.is_shadow_host = isShadowHost;
        return simplified;
      }

      // KEY FIX #3: Wrap orphan children in non-displaying node
      if (hasVisibleChildren) {
        const simplified = new SimplifiedNode(node);
        simplified.children = simplifiedChildren;
        simplified.should_display = false;
        return simplified;
      }

      return null;
    }

    // TEXT_NODE
    if (node.node_type === NodeType.TEXT_NODE) {
      const isVisible = node.snapshot_node && node.is_visible;
      const text = (node.node_value || '').trim();
      if (isVisible && text && text.length > 1) {
        return new SimplifiedNode(node);
      }
      return null;
    }

    return null;
  }

  _getChildren(node) {
    const result = [];
    if (node.children_nodes?.length) result.push(...node.children_nodes);
    if (node.shadow_roots?.length) result.push(...node.shadow_roots);
    return result;
  }
}

class TreeOptimizer {
  optimize(node) {
    if (!node) return null;

    const optimizedChildren = [];
    for (const child of node.children) {
      const opt = this.optimize(child);
      if (opt) optimizedChildren.push(opt);
    }
    node.children = optimizedChildren;

    const isVisible = node.original_node.snapshot_node && node.original_node.is_visible;
    const isScrollable = node.original_node.is_actually_scrollable;
    const isText = node.original_node.node_type === NodeType.TEXT_NODE;
    const hasChildren = node.children.length > 0;
    const tagName = (node.original_node.node_name || node.original_node.tag_name || '').toLowerCase();
    const attrs = node.original_node.attributes || {};
    const isFileInput = tagName === 'input' && attrs.type === 'file';

    if (isVisible || isScrollable || isText || hasChildren || isFileInput) return node;
    return null;
  }
}

// ==================== BBOX FILTER (from dom/serializer/bbox_filter.js) ====================

class BoundingBoxFilter {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.99;
  }

  apply(root) {
    if (!root) return;
    this._filter(root, null, 0);
  }

  _filter(node, activeBounds, depth) {
    if (activeBounds && this._shouldExclude(node, activeBounds)) {
      node.excluded_by_parent = true;
    }

    let newBounds = null;
    const tagName = (node.original_node.node_name || node.original_node.tag_name || '').toLowerCase();
    const role = node.original_node.attributes?.role || null;

    if (this._isPropagating(tagName, role)) {
      const bounds = node.original_node.snapshot_node?.bounds;
      if (bounds) newBounds = { tag: tagName, bounds, depth };
    }

    const propagate = newBounds || activeBounds;
    for (const child of node.children) {
      this._filter(child, propagate, depth + 1);
    }
  }

  _isPropagating(tag, role) {
    return PROPAGATING_ELEMENTS.some(p =>
      (p.tag === null || p.tag === tag) && (p.role === null || p.role === role)
    );
  }

  _shouldExclude(node, activeBounds) {
    if (node.original_node.node_type === NodeType.TEXT_NODE) return false;
    const childBounds = node.original_node.snapshot_node?.bounds;
    if (!childBounds) return false;
    if (!isContainedWithinBounds(childBounds, activeBounds.bounds, this.threshold)) return false;

    const tagName = (node.original_node.node_name || node.original_node.tag_name || '').toLowerCase();
    const attrs = node.original_node.attributes || {};
    const role = attrs.role || null;

    if (FORM_ELEMENTS.has(tagName)) return false;
    if (this._isPropagating(tagName, role)) return false;
    if (attrs.onclick) return false;
    if (attrs['aria-label']?.trim()) return false;
    if (role && INTERACTIVE_ROLES.has(role)) return false;
    if ('tabindex' in attrs) return false;
    if (tagName === 'svg') return false;

    return true;
  }
}

// ==================== MAIN SERIALIZER (from dom/serializer/index.js) ====================

class DOMTreeSerializer {
  constructor(rootNode, options = {}) {
    this.rootNode = rootNode;
    this.sessionId = options.sessionId || null;
    this.enableBbox = options.enableBboxFiltering !== false;
    this.enablePaintOrder = options.enablePaintOrderFiltering !== false;
    this.includeAttributes = options.includeAttributes || DEFAULT_INCLUDE_ATTRIBUTES;
    this._selectorMap = {};
    this._clickableCache = new Map();
    this.timing = {};
  }

  serialize() {
    const totalStart = Date.now();
    this._selectorMap = {};
    this._clickableCache.clear();

    // Step 1: Create simplified tree
    let stepStart = Date.now();
    const builder = new SimplifiedTreeBuilder({ sessionId: this.sessionId });
    let tree = builder.build(this.rootNode);
    this.timing.simplified_tree = Date.now() - stepStart;

    if (!tree) {
      console.log('[Serializer] No visible content');
      return { tree: null, selectorMap: {}, timing: this.timing };
    }

    // Step 2: Paint order filtering
    if (this.enablePaintOrder) {
      stepStart = Date.now();
      new PaintOrderRemover(tree).calculate();
      this.timing.paint_order = Date.now() - stepStart;
    }

    // Step 3: Tree optimization
    stepStart = Date.now();
    tree = new TreeOptimizer().optimize(tree);
    this.timing.optimize = Date.now() - stepStart;

    if (!tree) {
      console.log('[Serializer] Empty after optimization');
      return { tree: null, selectorMap: {}, timing: this.timing };
    }

    // Step 4: BBox filtering
    if (this.enableBbox) {
      stepStart = Date.now();
      new BoundingBoxFilter().apply(tree);
      this.timing.bbox = Date.now() - stepStart;
    }

    // Step 5: Assign interactive indices
    stepStart = Date.now();
    this._assignIndices(tree);
    this.timing.indices = Date.now() - stepStart;

    this.timing.total = Date.now() - totalStart;

    console.log(`[Serializer] Done: ${Object.keys(this._selectorMap).length} interactive elements`);

    return { tree, selectorMap: this._selectorMap, timing: this.timing };
  }

  _assignIndices(node) {
    if (!node) return;

    if (!node.excluded_by_parent && !node.ignored_by_paint_order) {
      const isInteractive = this._isInteractiveCached(node.original_node);
      const isVisible = node.original_node.snapshot_node && node.original_node.is_visible;
      const isScrollable = node.original_node.is_actually_scrollable;
      const tagName = (node.original_node.node_name || node.original_node.tag_name || '').toLowerCase();
      const attrs = node.original_node.attributes || {};
      const isFileInput = tagName === 'input' && attrs.type === 'file';

      let shouldMake = false;
      if (isScrollable) {
        if (!this._hasInteractiveDesc(node)) shouldMake = true;
      } else if (isInteractive && (isVisible || isFileInput)) {
        shouldMake = true;
      }

      if (shouldMake) {
        node.is_interactive = true;
        this._selectorMap[node.original_node.backend_node_id] = node.original_node;
      }
    }

    for (const child of node.children) this._assignIndices(child);
  }

  _isInteractiveCached(node) {
    const id = node.node_id;
    if (!this._clickableCache.has(id)) {
      this._clickableCache.set(id, ClickableElementDetector.isInteractive(node));
    }
    return this._clickableCache.get(id);
  }

  _hasInteractiveDesc(node) {
    for (const child of node.children) {
      if (this._isInteractiveCached(child.original_node)) return true;
      if (this._hasInteractiveDesc(child)) return true;
    }
    return false;
  }

  serializeToString(tree) {
    if (!tree) return '';
    return this._serializeNode(tree, 0);
  }

  _serializeNode(node, depth) {
    if (!node) return '';

    // Skip excluded/occluded
    if (node.excluded_by_parent || node.ignored_by_paint_order) {
      return node.children.map(c => this._serializeNode(c, depth)).filter(Boolean).join('\n');
    }

    const lines = [];
    const indent = '\t'.repeat(depth);
    let nextDepth = depth;

    if (node.original_node.node_type === NodeType.ELEMENT_NODE) {
      if (!node.should_display) {
        return node.children.map(c => this._serializeNode(c, depth)).filter(Boolean).join('\n');
      }

      const tagName = (node.original_node.node_name || node.original_node.tag_name || '').toLowerCase();

      // SVG
      if (tagName === 'svg') {
        let line = indent;
        if (node.is_interactive) {
          line += `${node.is_new ? '*' : ''}[${node.original_node.backend_node_id}]`;
        }
        line += `<svg${this._buildAttrs(node.original_node)} />`;
        lines.push(line);
        return lines.join('\n');
      }

      const isScrollable = node.original_node.is_actually_scrollable;
      const isIframe = tagName === 'iframe' || tagName === 'frame';

      if (node.is_interactive || isScrollable || isIframe) {
        nextDepth++;
        const attrsStr = this._buildAttrs(node.original_node);
        const shadowPfx = node.is_shadow_host ? '|SHADOW|' : '';

        let line;
        if (isScrollable && !node.is_interactive) {
          line = `${indent}${shadowPfx}|scroll|<${tagName}`;
        } else if (node.is_interactive) {
          const newPfx = node.is_new ? '*' : '';
          const scrollPfx = isScrollable ? '|scroll[' : '[';
          line = `${indent}${shadowPfx}${newPfx}${scrollPfx}${node.original_node.backend_node_id}]<${tagName}`;
        } else if (isIframe) {
          line = `${indent}${shadowPfx}|IFRAME|<${tagName}`;
        } else {
          line = `${indent}${shadowPfx}<${tagName}`;
        }

        if (attrsStr) line += ` ${attrsStr}`;
        line += ' />';

        if (isScrollable) {
          const info = this._scrollInfo(node.original_node);
          if (info) line += ` (${info})`;
        }

        lines.push(line);
      }
    } else if (node.original_node.node_type === NodeType.DOCUMENT_FRAGMENT_NODE) {
      const type = node.original_node.shadow_root_type;
      const closed = type && type.toLowerCase() === 'closed';
      lines.push(`${indent}${closed ? 'Closed' : 'Open'} Shadow`);
      nextDepth++;

      for (const child of node.children) {
        const t = this._serializeNode(child, nextDepth);
        if (t) lines.push(t);
      }

      if (node.children.length) lines.push(`${indent}Shadow End`);
    } else if (node.original_node.node_type === NodeType.TEXT_NODE) {
      const vis = node.original_node.snapshot_node && node.original_node.is_visible;
      const text = (node.original_node.node_value || '').trim();
      if (vis && text.length > 1) {
        lines.push(`${indent}${capTextLength(text, 200)}`);
      }
    }

    if (node.original_node.node_type !== NodeType.DOCUMENT_FRAGMENT_NODE) {
      for (const child of node.children) {
        const t = this._serializeNode(child, nextDepth);
        if (t) lines.push(t);
      }
    }

    return lines.join('\n');
  }

  _buildAttrs(node) {
    const attrs = {};
    const html = node.attributes || {};

    for (const key of this.includeAttributes) {
      if (key in html && html[key] !== null && String(html[key]).trim()) {
        attrs[key] = String(html[key]).trim();
      }
    }

    const tagName = (node.node_name || node.tag_name || '').toLowerCase();
    if (tagName === 'input') {
      const type = (html.type || '').toLowerCase();
      const formats = { date: 'YYYY-MM-DD', time: 'HH:MM', 'datetime-local': 'YYYY-MM-DDTHH:MM', month: 'YYYY-MM', week: 'YYYY-W##' };
      if (formats[type]) attrs.format = formats[type];
    }

    if (node.ax_node?.properties) {
      for (const p of node.ax_node.properties) {
        if (this.includeAttributes.includes(p.name) && p.value !== null) {
          attrs[p.name] = typeof p.value === 'boolean' ? (p.value ? 'true' : 'false') : String(p.value).trim();
        }
      }
    }

    if (node.ax_node?.name && this.includeAttributes.includes('ax_name')) {
      attrs.ax_name = node.ax_node.name;
    }

    if (!Object.keys(attrs).length) return '';

    // Dedup
    const seen = new Map();
    const protect = new Set(['format', 'placeholder', 'value', 'aria-label', 'title']);
    const remove = new Set();
    for (const [k, v] of Object.entries(attrs)) {
      if (v.length > 5) {
        if (seen.has(v) && !protect.has(k)) remove.add(k);
        else seen.set(v, k);
      }
    }
    for (const k of remove) delete attrs[k];

    return this.includeAttributes
      .filter(k => k in attrs)
      .map(k => `${k}=${capTextLength(attrs[k], 100) || "''"}`)
      .join(' ');
  }

  _scrollInfo(node) {
    if (!node.is_actually_scrollable || !node.snapshot_node) return '';
    const sr = node.snapshot_node.scrollRects;
    const cr = node.snapshot_node.clientRects;
    if (!sr || !cr) return '';

    const parts = [];

    // Vertical scroll info
    if (sr.height > cr.height + 1) {
      const scrollTop = sr.y;
      const visH = cr.height;
      const scrollH = sr.height;
      const above = Math.max(0, scrollTop);
      const below = Math.max(0, scrollH - visH - scrollTop);
      const pAbove = visH > 0 ? above / visH : 0;
      const pBelow = visH > 0 ? below / visH : 0;
      const maxScrollTop = scrollH - visH;
      const scrollProgress = maxScrollTop > 0 ? Math.round((scrollTop / maxScrollTop) * 100) : 0;
      parts.push(`${pAbove.toFixed(1)}↑ ${pBelow.toFixed(1)}↓ ${scrollProgress}%`);
    }

    // Horizontal scroll info
    if (sr.width > cr.width + 1) {
      const scrollLeft = sr.x;
      const visW = cr.width;
      const scrollW = sr.width;
      const left = Math.max(0, scrollLeft);
      const right = Math.max(0, scrollW - visW - scrollLeft);
      const pLeft = visW > 0 ? left / visW : 0;
      const pRight = visW > 0 ? right / visW : 0;
      parts.push(`${pLeft.toFixed(1)}← ${pRight.toFixed(1)}→`);
    }

    return parts.join(' | ');
  }
}

// ==================== MESSAGE HANDLERS ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureAllTrees') {
    captureAllTrees().then(r => sendResponse({ success: true, data: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (request.action === 'captureMergedTree') {
    captureMergedTree().then(r => sendResponse({ success: true, data: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (request.action === 'captureLLMRepresentation') {
    captureLLMRepresentation().then(r => sendResponse({ success: true, data: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (request.action === 'captureHumanReadable') {
    captureHumanReadable().then(r => sendResponse({ success: true, data: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});

// ==================== MAIN FUNCTIONS ====================

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');
  return tab;
}

async function captureAllTrees() {
  const tab = await getActiveTab();
  const cdp = new CDPService(tab.id);

  await cdp.attach();
  try {
    await cdp.enableDomains();
    const { snapshot, domTree, axTree, layoutMetrics } = await cdp.fetchAllTrees();
    const dpr = calculateDevicePixelRatio(layoutMetrics);

    const result = {
      snapshot, dom_tree: domTree, ax_tree: axTree,
      layout_metrics: layoutMetrics, device_pixel_ratio: dpr,
      metadata: { url: tab.url, title: tab.title, timestamp: new Date().toISOString() }
    };

    await downloadJSON(result, `trees-${Date.now()}.json`);
    return result;
  } finally {
    await cdp.detach();
  }
}

async function captureMergedTree() {
  const tab = await getActiveTab();
  const cdp = new CDPService(tab.id);

  await cdp.attach();
  try {
    await cdp.enableDomains();
    const { snapshot, domTree, axTree, layoutMetrics } = await cdp.fetchAllTrees();

    const merger = new TreeMerger(snapshot, domTree, axTree, layoutMetrics);
    const { root, stats } = merger.merge();

    const result = {
      enhanced_dom_tree: root,
      metadata: { url: tab.url, title: tab.title, timestamp: new Date().toISOString(), stats }
    };

    await downloadJSON(result, `merged-${Date.now()}.json`);
    return result;
  } finally {
    await cdp.detach();
  }
}

async function captureLLMRepresentation() {
  const tab = await getActiveTab();
  const cdp = new CDPService(tab.id);

  await cdp.attach();
  try {
    await cdp.enableDomains();
    
    console.log('[Main] Fetching trees...');
    const fetchStart = Date.now();
    const { snapshot, domTree, axTree, layoutMetrics } = await cdp.fetchAllTrees();
    const fetchTime = Date.now() - fetchStart;

    console.log('[Main] Merging trees...');
    const mergeStart = Date.now();
    const merger = new TreeMerger(snapshot, domTree, axTree, layoutMetrics);
    const { root, stats } = merger.merge();
    const mergeTime = Date.now() - mergeStart;

    console.log('[Main] Serializing...');
    const serializer = new DOMTreeSerializer(root);
    const { tree, selectorMap, timing } = serializer.serialize();

    const llmText = serializer.serializeToString(tree);

    const result = {
      llm_representation: llmText,
      selector_map: selectorMap,
      metadata: {
        url: tab.url,
        title: tab.title,
        timestamp: new Date().toISOString(),
        stats: {
          ...stats,
          interactive_elements: Object.keys(selectorMap).length,
          llm_text_length: llmText.length,
          llm_text_lines: llmText.split('\n').filter(l => l.trim()).length
        },
        timing: {
          fetch_trees: fetchTime,
          merge_trees: mergeTime,
          ...timing
        }
      }
    };

    console.log(`[Main] Complete: ${result.metadata.stats.llm_text_lines} lines, ${result.metadata.stats.interactive_elements} interactive`);

    await downloadJSON(result, `llm-repr-${Date.now()}.json`);
    return result;
  } finally {
    await cdp.detach();
  }
}

async function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  await chrome.downloads.download({ url: dataUrl, filename, saveAs: true });
  console.log(`[Download] ${filename}`);
}

async function downloadMarkdown(content, filename) {
  const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(content);
  await chrome.downloads.download({ url: dataUrl, filename, saveAs: true });
  console.log(`[Download] ${filename}`);
}

// ==================== HUMAN READABLE FORMAT ====================

async function captureHumanReadable() {
  const tab = await getActiveTab();
  const cdp = new CDPService(tab.id);

  await cdp.attach();
  try {
    await cdp.enableDomains();
    
    console.log('[Main] Fetching trees for human readable...');
    const { snapshot, domTree, axTree, layoutMetrics } = await cdp.fetchAllTrees();

    console.log('[Main] Merging trees...');
    const merger = new TreeMerger(snapshot, domTree, axTree, layoutMetrics);
    const { root, stats } = merger.merge();

    console.log('[Main] Serializing...');
    const serializer = new DOMTreeSerializer(root);
    const { tree, selectorMap } = serializer.serialize();

    // Generate human-readable Markdown format
    const markdown = generateHumanReadableMarkdown(tree, selectorMap, tab);

    const result = {
      markdown_representation: markdown,
      selector_map: selectorMap,
      metadata: {
        url: tab.url,
        title: tab.title,
        timestamp: new Date().toISOString(),
        stats: {
          ...stats,
          interactive_elements: Object.keys(selectorMap).length,
          markdown_length: markdown.length,
          markdown_lines: markdown.split('\n').filter(l => l.trim()).length
        }
      }
    };

    console.log(`[Main] Human readable complete: ${result.metadata.stats.markdown_lines} lines`);

    await downloadMarkdown(markdown, `page-readable-${Date.now()}.md`);
    return result;
  } finally {
    await cdp.detach();
  }
}

function generateHumanReadableMarkdown(tree, selectorMap, tab) {
  const lines = [];
  
  // Header
  lines.push(`# 📄 Page Structure Analysis`);
  lines.push(``);
  lines.push(`**URL:** ${tab.url}`);
  lines.push(`**Title:** ${tab.title}`);
  lines.push(`**Captured:** ${new Date().toLocaleString()}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  
  // Summary table
  const interactiveCount = Object.keys(selectorMap).length;
  lines.push(`## 📊 Summary`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Interactive Elements | ${interactiveCount} |`);
  lines.push(``);
  
  // Interactive elements list
  lines.push(`## 🎯 Interactive Elements`);
  lines.push(``);
  lines.push(`| Index | Tag | Name/Label | Type/Role | Details |`);
  lines.push(`|-------|-----|------------|-----------|---------|`);
  
  // Sort by backend_node_id
  const sortedElements = Object.entries(selectorMap)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  
  for (const [id, node] of sortedElements) {
    const tag = (node.node_name || node.tag_name || '').toLowerCase();
    const attrs = node.attributes || {};
    
    // Get name/label
    let name = node.ax_node?.name || attrs['aria-label'] || attrs.title || attrs.placeholder || '';
    if (!name && attrs.alt) name = attrs.alt;
    if (!name && attrs.value) name = attrs.value;
    name = capTextLength(name, 40);
    
    // Get type/role
    let typeRole = attrs.role || node.ax_node?.role || '';
    if (attrs.type) typeRole = typeRole ? `${typeRole} (${attrs.type})` : attrs.type;
    
    // Get details
    const details = [];
    if (attrs.href) details.push(`→ ${capTextLength(attrs.href, 30)}`);
    if (attrs.id) details.push(`#${attrs.id}`);
    if (node.is_actually_scrollable) details.push('📜 scrollable');
    
    lines.push(`| [${id}] | \`<${tag}>\` | ${name || '-'} | ${typeRole || '-'} | ${details.join(', ') || '-'} |`);
  }
  
  lines.push(``);
  
  // Tree structure
  lines.push(`## 🌳 Page Structure (Tree View)`);
  lines.push(``);
  lines.push('```');
  lines.push(generateAsciiTree(tree, '', true));
  lines.push('```');
  lines.push(``);
  
  // Interactive elements by category
  lines.push(`## 📁 Elements by Category`);
  lines.push(``);
  
  const categories = categorizeElements(selectorMap);
  
  for (const [category, elements] of Object.entries(categories)) {
    if (elements.length === 0) continue;
    
    lines.push(`### ${category}`);
    lines.push(``);
    for (const el of elements) {
      const name = el.node.ax_node?.name || el.node.attributes?.['aria-label'] || el.node.attributes?.title || '';
      const href = el.node.attributes?.href || '';
      const desc = name ? `"${capTextLength(name, 50)}"` : (href ? `→ ${capTextLength(href, 50)}` : '(unnamed)');
      lines.push(`- **[${el.id}]** \`<${el.tag}>\` ${desc}`);
    }
    lines.push(``);
  }
  
  return lines.join('\n');
}

function generateAsciiTree(node, prefix = '', isLast = true) {
  if (!node) return '';
  
  const lines = [];
  const original = node.original_node;
  
  // Skip excluded nodes
  if (node.excluded_by_parent || node.ignored_by_paint_order) {
    for (const child of node.children) {
      lines.push(generateAsciiTree(child, prefix, true));
    }
    return lines.filter(Boolean).join('\n');
  }
  
  const connector = isLast ? '└── ' : '├── ';
  const tag = (original.node_name || original.tag_name || '').toLowerCase();
  
  // Skip document nodes
  if (original.node_type === NodeType.DOCUMENT_NODE) {
    for (const child of node.children) {
      lines.push(generateAsciiTree(child, prefix, true));
    }
    return lines.filter(Boolean).join('\n');
  }
  
  // Handle text nodes
  if (original.node_type === NodeType.TEXT_NODE) {
    const text = (original.node_value || '').trim();
    if (text && text.length > 1 && original.is_visible) {
      lines.push(`${prefix}${connector}📝 "${capTextLength(text, 50)}"`);
    }
    return lines.join('\n');
  }
  
  // Handle shadow DOM
  if (original.node_type === NodeType.DOCUMENT_FRAGMENT_NODE) {
    const shadowType = original.shadow_root_type;
    const isClosed = shadowType && shadowType.toLowerCase() === 'closed';
    lines.push(`${prefix}${connector}🔮 ${isClosed ? 'Closed' : 'Open'} Shadow DOM`);
    
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    const children = node.children.filter(c => !c.excluded_by_parent && !c.ignored_by_paint_order);
    children.forEach((child, i) => {
      lines.push(generateAsciiTree(child, newPrefix, i === children.length - 1));
    });
    
    return lines.filter(Boolean).join('\n');
  }
  
  // Build element representation
  let elemStr = '';
  const interactiveMarker = node.is_interactive ? `[${original.backend_node_id}]` : '';
  const name = original.ax_node?.name || original.attributes?.['aria-label'] || '';
  const scrollMarker = original.is_actually_scrollable ? ' 📜' : '';
  
  if (name) {
    elemStr = `${interactiveMarker}<${tag}> "${capTextLength(name, 30)}"${scrollMarker}`;
  } else {
    elemStr = `${interactiveMarker}<${tag}>${scrollMarker}`;
  }
  
  const icon = getElementIcon(tag, original.attributes?.role);
  lines.push(`${prefix}${connector}${icon} ${elemStr}`);
  
  // Process children
  const newPrefix = prefix + (isLast ? '    ' : '│   ');
  const children = node.children.filter(c => !c.excluded_by_parent && !c.ignored_by_paint_order);
  
  // Limit depth for readability
  if (prefix.length > 80) {
    if (children.length > 0) {
      lines.push(`${newPrefix}└── ... (${children.length} more children)`);
    }
    return lines.filter(Boolean).join('\n');
  }
  
  children.forEach((child, i) => {
    lines.push(generateAsciiTree(child, newPrefix, i === children.length - 1));
  });
  
  return lines.filter(Boolean).join('\n');
}

function getElementIcon(tag, role) {
  const iconMap = {
    'button': '🔘',
    'a': '🔗',
    'input': '📝',
    'textarea': '📄',
    'select': '📋',
    'img': '🖼️',
    'svg': '🎨',
    'video': '🎬',
    'audio': '🔊',
    'iframe': '📺',
    'form': '📑',
    'nav': '🧭',
    'header': '📌',
    'footer': '📎',
    'main': '📦',
    'aside': '📐',
    'article': '📰',
    'section': '📁',
    'ul': '📋',
    'ol': '🔢',
    'li': '•',
    'table': '📊',
    'h1': '📢',
    'h2': '📣',
    'h3': '📣',
    'h4': '📣',
    'h5': '📣',
    'h6': '📣',
  };
  
  if (role === 'button') return '🔘';
  if (role === 'link') return '🔗';
  if (role === 'textbox') return '📝';
  if (role === 'navigation') return '🧭';
  if (role === 'menu' || role === 'menubar') return '📋';
  if (role === 'tab' || role === 'tablist') return '📑';
  
  return iconMap[tag] || '📦';
}

function categorizeElements(selectorMap) {
  const categories = {
    '🔘 Buttons': [],
    '🔗 Links': [],
    '📝 Form Inputs': [],
    '📋 Menus & Tabs': [],
    '📜 Scrollable': [],
    '📦 Other Interactive': []
  };
  
  for (const [id, node] of Object.entries(selectorMap)) {
    const tag = (node.node_name || node.tag_name || '').toLowerCase();
    const role = node.attributes?.role || node.ax_node?.role || '';
    
    const item = { id, tag, node };
    
    if (tag === 'button' || role === 'button') {
      categories['🔘 Buttons'].push(item);
    } else if (tag === 'a' || role === 'link') {
      categories['🔗 Links'].push(item);
    } else if (['input', 'textarea', 'select'].includes(tag) || ['textbox', 'combobox', 'searchbox'].includes(role)) {
      categories['📝 Form Inputs'].push(item);
    } else if (['menuitem', 'menu', 'tab', 'tablist', 'option'].includes(role)) {
      categories['📋 Menus & Tabs'].push(item);
    } else if (node.is_actually_scrollable) {
      categories['📜 Scrollable'].push(item);
    } else {
      categories['📦 Other Interactive'].push(item);
    }
  }
  
  return categories;
}

chrome.debugger.onDetach.addListener((source, reason) => {
  console.log('[CDP] Debugger detached:', reason);
});
