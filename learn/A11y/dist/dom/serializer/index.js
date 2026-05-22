/**
 * @file dom/serializer/index.js
 * @description Main serializer that orchestrates the pipeline
 * Corresponds to browser-use/dom/serializer/serializer.py DOMTreeSerializer
 */

import { 
  NodeType, 
  DEFAULT_INCLUDE_ATTRIBUTES,
  SerializedDOMState 
} from '../views.js';
import { capTextLength } from '../utils.js';
import { ClickableElementDetector } from './clickable_detector.js';
import { PaintOrderRemover } from './paint_order.js';
import { SimplifiedTreeBuilder, TreeOptimizer } from './simplified_tree.js';
import { BoundingBoxFilter } from './bbox_filter.js';

/**
 * DOMTreeSerializer - Main serialization pipeline
 * 
 * Pipeline stages:
 * 1. Create simplified tree (filter invisible/disabled elements)
 * 2. Apply paint order filtering (remove occluded elements)
 * 3. Optimize tree (remove unnecessary wrappers)
 * 4. Apply bbox filtering (merge contained children)
 * 5. Assign interactive indices and mark new nodes
 * 6. Serialize to LLM-readable text
 */
export class DOMTreeSerializer {
  constructor(rootNode, options = {}) {
    this.rootNode = rootNode;
    this.sessionId = options.sessionId || null;
    this.enableBboxFiltering = options.enableBboxFiltering !== false;
    this.enablePaintOrderFiltering = options.enablePaintOrderFiltering !== false;
    this.containmentThreshold = options.containmentThreshold || 0.99;
    this.includeAttributes = options.includeAttributes || DEFAULT_INCLUDE_ATTRIBUTES;
    
    // Previous state for new node detection (matches browser-use behavior)
    this.previousCachedState = options.previousCachedState || null;
    this._previousStableHashes = this._collectPreviousHashes();
    
    // State
    this._selectorMap = {};
    this._clickableCache = new Map();
    this.timing = {};
  }
  
  /**
   * Collect stable hashes from previous cached state
   * Used to identify new elements between page states
   */
  _collectPreviousHashes() {
    const hashes = new Set();
    if (this.previousCachedState && this.previousCachedState.selector_map) {
      for (const node of Object.values(this.previousCachedState.selector_map)) {
        if (node.stable_hash) {
          hashes.add(node.stable_hash);
        }
      }
    }
    return hashes;
  }

  /**
   * Run full serialization pipeline
   * @returns {Object} SerializedDOMState and timing info
   */
  serialize() {
    const totalStart = Date.now();
    this._selectorMap = {};
    this._clickableCache.clear();

    // Step 1: Create simplified tree
    let stepStart = Date.now();
    const treeBuilder = new SimplifiedTreeBuilder({ sessionId: this.sessionId });
    let tree = treeBuilder.build(this.rootNode);
    this.timing.create_simplified_tree = Date.now() - stepStart;
    
    console.log(`[Serializer] Step 1 - Simplified tree created`);

    if (!tree) {
      console.warn('[Serializer] No visible content found');
      return {
        state: new SerializedDOMState(null, {}),
        timing: this.timing
      };
    }

    // Step 2: Paint order filtering
    if (this.enablePaintOrderFiltering) {
      stepStart = Date.now();
      const paintOrderRemover = new PaintOrderRemover(tree);
      paintOrderRemover.calculate();
      this.timing.paint_order_filtering = Date.now() - stepStart;
      console.log(`[Serializer] Step 2 - Paint order filtering applied`);
    }

    // Step 3: Optimize tree
    stepStart = Date.now();
    const optimizer = new TreeOptimizer();
    tree = optimizer.optimize(tree);
    this.timing.optimize_tree = Date.now() - stepStart;
    console.log(`[Serializer] Step 3 - Tree optimized`);

    if (!tree) {
      console.warn('[Serializer] Tree empty after optimization');
      return {
        state: new SerializedDOMState(null, {}),
        timing: this.timing
      };
    }

    // Step 4: Bounding box filtering
    if (this.enableBboxFiltering) {
      stepStart = Date.now();
      const bboxFilter = new BoundingBoxFilter({ threshold: this.containmentThreshold });
      bboxFilter.apply(tree);
      this.timing.bbox_filtering = Date.now() - stepStart;
      console.log(`[Serializer] Step 4 - BBox filtering applied`);
    }

    // Step 5: Assign interactive indices
    stepStart = Date.now();
    this._assignInteractiveIndices(tree);
    this.timing.assign_indices = Date.now() - stepStart;
    console.log(`[Serializer] Step 5 - Interactive indices assigned: ${Object.keys(this._selectorMap).length} elements`);

    this.timing.total = Date.now() - totalStart;

    return {
      state: new SerializedDOMState(tree, this._selectorMap),
      timing: this.timing
    };
  }

  /**
   * Assign interactive indices to elements and mark new nodes
   * Matches browser-use _assign_interactive_indices_and_mark_new_nodes
   */
  _assignInteractiveIndices(node) {
    if (!node) return;

    // Skip excluded/occluded nodes
    if (!node.excluded_by_parent && !node.ignored_by_paint_order) {
      const isInteractive = this._isInteractiveCached(node.original_node);
      const isVisible = node.original_node.snapshot_node && node.original_node.is_visible;
      const isScrollable = node.original_node.is_actually_scrollable;

      // Exception: File inputs
      const tagName = (node.original_node.node_name || node.original_node.tag_name || '').toLowerCase();
      const attrs = node.original_node.attributes || {};
      const isFileInput = tagName === 'input' && attrs.type === 'file';

      let shouldMakeInteractive = false;

      if (isScrollable) {
        // Scrollable containers: only make interactive if no interactive descendants
        const hasInteractiveDesc = this._hasInteractiveDescendants(node);
        if (!hasInteractiveDesc) {
          shouldMakeInteractive = true;
        }
      } else if (isInteractive && (isVisible || isFileInput)) {
        shouldMakeInteractive = true;
      }

      if (shouldMakeInteractive) {
        node.is_interactive = true;
        this._selectorMap[node.original_node.backend_node_id] = node.original_node;
        
        // Mark as new if stable_hash not in previous state
        if (this._previousStableHashes.size > 0) {
          const stableHash = node.original_node.stable_hash;
          if (stableHash && !this._previousStableHashes.has(stableHash)) {
            node.is_new = true;
          }
        }
      }
    }

    // Process children
    for (const child of node.children) {
      this._assignInteractiveIndices(child);
    }
  }

  /**
   * Cached interactive check
   */
  _isInteractiveCached(node) {
    const nodeId = node.node_id;
    if (!this._clickableCache.has(nodeId)) {
      this._clickableCache.set(nodeId, ClickableElementDetector.isInteractive(node));
    }
    return this._clickableCache.get(nodeId);
  }

  /**
   * Check if node has interactive descendants
   */
  _hasInteractiveDescendants(node) {
    for (const child of node.children) {
      if (this._isInteractiveCached(child.original_node)) {
        return true;
      }
      if (this._hasInteractiveDescendants(child)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Serialize tree to LLM-readable string
   * @param {SimplifiedNode} root - Root node (or use internal root)
   * @returns {string} LLM representation
   */
  serializeToString(root = null) {
    const tree = root || (this.serialize().state._root);
    if (!tree) return '';
    
    return this._serializeNode(tree, 0);
  }

  /**
   * Recursively serialize node to string
   */
  _serializeNode(node, depth) {
    if (!node) return '';

    // Skip excluded/occluded nodes but process children
    if (node.excluded_by_parent || node.ignored_by_paint_order) {
      const childTexts = [];
      for (const child of node.children) {
        const text = this._serializeNode(child, depth);
        if (text) childTexts.push(text);
      }
      return childTexts.join('\n');
    }

    const lines = [];
    const indent = '\t'.repeat(depth);
    let nextDepth = depth;

    if (node.original_node.node_type === NodeType.ELEMENT_NODE) {
      // Skip non-displaying wrappers
      if (!node.should_display) {
        for (const child of node.children) {
          const text = this._serializeNode(child, depth);
          if (text) lines.push(text);
        }
        return lines.join('\n');
      }

      const tagName = (node.original_node.node_name || node.original_node.tag_name || '').toLowerCase();

      // SVG special handling
      if (tagName === 'svg') {
        let line = indent;
        if (node.is_interactive) {
          const newPrefix = node.is_new ? '*' : '';
          line += `${newPrefix}[${node.original_node.backend_node_id}]`;
        }
        line += '<svg';
        const attrsStr = this._buildAttributesString(node.original_node);
        if (attrsStr) line += ` ${attrsStr}`;
        line += ' /> <!-- SVG -->';
        lines.push(line);
        return lines.join('\n');
      }

      // Interactive/scrollable elements
      const isScrollable = node.original_node.is_actually_scrollable;
      const isIframe = tagName === 'iframe' || tagName === 'frame';

      if (node.is_interactive || isScrollable || isIframe) {
        nextDepth += 1;

        const attrsStr = this._buildAttributesString(node.original_node);

        // Build shadow prefix
        let shadowPrefix = '';
        if (node.is_shadow_host) {
          shadowPrefix = '|SHADOW|';
        }

        let line;
        if (isScrollable && !node.is_interactive) {
          line = `${indent}${shadowPrefix}|scroll|<${tagName}`;
        } else if (node.is_interactive) {
          const newPrefix = node.is_new ? '*' : '';
          const scrollPrefix = isScrollable ? '|scroll[' : '[';
          line = `${indent}${shadowPrefix}${newPrefix}${scrollPrefix}${node.original_node.backend_node_id}]<${tagName}`;
        } else if (isIframe) {
          line = `${indent}${shadowPrefix}|IFRAME|<${tagName}`;
        } else {
          line = `${indent}${shadowPrefix}<${tagName}`;
        }

        if (attrsStr) line += ` ${attrsStr}`;
        line += ' />';

        // Add scroll info
        if (isScrollable) {
          const scrollInfo = this._getScrollInfo(node.original_node);
          if (scrollInfo) line += ` (${scrollInfo})`;
        }

        lines.push(line);
      }
    } else if (node.original_node.node_type === NodeType.DOCUMENT_FRAGMENT_NODE) {
      // Shadow DOM
      const shadowType = node.original_node.shadow_root_type;
      const isClosed = shadowType && shadowType.toLowerCase() === 'closed';
      lines.push(`${indent}${isClosed ? 'Closed' : 'Open'} Shadow`);
      nextDepth += 1;

      for (const child of node.children) {
        const text = this._serializeNode(child, nextDepth);
        if (text) lines.push(text);
      }

      if (node.children.length > 0) {
        lines.push(`${indent}Shadow End`);
      }
    } else if (node.original_node.node_type === NodeType.TEXT_NODE) {
      const isVisible = node.original_node.snapshot_node && node.original_node.is_visible;
      const text = (node.original_node.node_value || '').trim();

      if (isVisible && text && text.length > 1) {
        lines.push(`${indent}${capTextLength(text, 200)}`);
      }
    }

    // Process children (for non-shadow elements)
    if (node.original_node.node_type !== NodeType.DOCUMENT_FRAGMENT_NODE) {
      for (const child of node.children) {
        const text = this._serializeNode(child, nextDepth);
        if (text) lines.push(text);
      }
    }

    return lines.join('\n');
  }

  /**
   * Build attributes string for element
   */
  _buildAttributesString(node) {
    const attrs = {};
    const htmlAttrs = node.attributes || {};

    // Include HTML attributes
    for (const key of this.includeAttributes) {
      if (key in htmlAttrs && htmlAttrs[key] !== null && String(htmlAttrs[key]).trim()) {
        attrs[key] = String(htmlAttrs[key]).trim();
      }
    }

    // Add format hints for date inputs
    const tagName = (node.node_name || node.tag_name || '').toLowerCase();
    if (tagName === 'input') {
      const inputType = (htmlAttrs.type || '').toLowerCase();
      const formatMap = {
        'date': 'YYYY-MM-DD',
        'time': 'HH:MM',
        'datetime-local': 'YYYY-MM-DDTHH:MM',
        'month': 'YYYY-MM',
        'week': 'YYYY-W##'
      };
      if (formatMap[inputType]) {
        attrs['format'] = formatMap[inputType];
      }
    }

    // Include AX properties
    if (node.ax_node?.properties) {
      for (const prop of node.ax_node.properties) {
        if (this.includeAttributes.includes(prop.name) && prop.value !== null) {
          if (typeof prop.value === 'boolean') {
            attrs[prop.name] = prop.value ? 'true' : 'false';
          } else if (String(prop.value).trim()) {
            attrs[prop.name] = String(prop.value).trim();
          }
        }
      }
    }

    // Include AX name
    if (node.ax_node?.name && this.includeAttributes.includes('ax_name')) {
      attrs['ax_name'] = node.ax_node.name;
    }

    if (Object.keys(attrs).length === 0) {
      return '';
    }

    // Remove duplicates (same value in multiple attributes)
    const seenValues = new Map();
    const protectedAttrs = new Set(['format', 'placeholder', 'value', 'aria-label', 'title']);
    const keysToRemove = new Set();

    for (const [key, value] of Object.entries(attrs)) {
      if (value.length > 5) {
        if (seenValues.has(value) && !protectedAttrs.has(key)) {
          keysToRemove.add(key);
        } else {
          seenValues.set(value, key);
        }
      }
    }

    for (const key of keysToRemove) {
      delete attrs[key];
    }

    // Format output
    const parts = [];
    for (const key of this.includeAttributes) {
      if (key in attrs) {
        const value = capTextLength(attrs[key], 100);
        parts.push(value ? `${key}=${value}` : `${key}=''`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Get scroll info text
   * Matches browser-use format: "0.0↑ 2.3↓ 15%"
   */
  _getScrollInfo(node) {
    if (!node.is_actually_scrollable || !node.snapshot_node) {
      return '';
    }

    const scrollRects = node.snapshot_node.scrollRects;
    const clientRects = node.snapshot_node.clientRects;

    if (!scrollRects || !clientRects) {
      return '';
    }

    const parts = [];

    // Vertical scroll info
    if (scrollRects.height > clientRects.height + 1) {
      const scrollTop = scrollRects.y;
      const visibleHeight = clientRects.height;
      const scrollableHeight = scrollRects.height;
      
      const contentAbove = Math.max(0, scrollTop);
      const contentBelow = Math.max(0, scrollableHeight - visibleHeight - scrollTop);
      
      const pagesAbove = visibleHeight > 0 ? contentAbove / visibleHeight : 0;
      const pagesBelow = visibleHeight > 0 ? contentBelow / visibleHeight : 0;
      
      // Calculate scroll progress percentage
      const maxScrollTop = scrollableHeight - visibleHeight;
      const scrollProgress = maxScrollTop > 0 ? Math.round((scrollTop / maxScrollTop) * 100) : 0;

      parts.push(`${pagesAbove.toFixed(1)}↑ ${pagesBelow.toFixed(1)}↓ ${scrollProgress}%`);
    }

    // Horizontal scroll info
    if (scrollRects.width > clientRects.width + 1) {
      const scrollLeft = scrollRects.x;
      const visibleWidth = clientRects.width;
      const scrollableWidth = scrollRects.width;
      
      const contentLeft = Math.max(0, scrollLeft);
      const contentRight = Math.max(0, scrollableWidth - visibleWidth - scrollLeft);
      
      const pagesLeft = visibleWidth > 0 ? contentLeft / visibleWidth : 0;
      const pagesRight = visibleWidth > 0 ? contentRight / visibleWidth : 0;

      parts.push(`${pagesLeft.toFixed(1)}← ${pagesRight.toFixed(1)}→`);
    }

    return parts.join(' | ');
  }
}

// Re-export components
export { ClickableElementDetector } from './clickable_detector.js';
export { PaintOrderRemover } from './paint_order.js';
export { SimplifiedTreeBuilder, TreeOptimizer } from './simplified_tree.js';
export { BoundingBoxFilter } from './bbox_filter.js';
