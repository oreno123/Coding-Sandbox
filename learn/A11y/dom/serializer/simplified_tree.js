/**
 * @file dom/serializer/simplified_tree.js
 * @description Creates simplified tree for serialization (core filtering logic)
 * Corresponds to browser-use/dom/serializer/serializer.py _create_simplified_tree
 * 
 * KEY FIX: This module correctly handles the filtering that was broken in the original code.
 */

import { 
  NodeType, 
  DISABLED_ELEMENTS, 
  SVG_ELEMENTS,
  SimplifiedNode 
} from '../views.js';

/**
 * SimplifiedTreeBuilder - Creates filtered simplified tree from EnhancedDOMTreeNode
 * 
 * This is the critical module that fixes the node inflation issue.
 * Key fixes:
 * 1. Shadow DOM nodes are only included if they have visible children
 * 2. "hasShadowContent" no longer blindly includes all nodes with children
 * 3. Proper recursive filtering ensures only meaningful nodes are kept
 */
export class SimplifiedTreeBuilder {
  constructor(options = {}) {
    this.sessionId = options.sessionId || null;
  }

  /**
   * Create simplified tree from enhanced DOM tree
   * @param {Object} node - Enhanced DOM tree node
   * @param {number} depth - Current depth (for debugging)
   * @returns {SimplifiedNode|null} Simplified node or null if filtered
   */
  build(node, depth = 0) {
    if (!node) return null;

    // Handle DOCUMENT_NODE - find the actual content
    if (node.node_type === NodeType.DOCUMENT_NODE) {
      const allChildren = this._getChildrenAndShadowRoots(node);
      for (const child of allChildren) {
        const simplified = this.build(child, depth + 1);
        if (simplified) {
          return simplified;
        }
      }
      return null;
    }

    // Handle DOCUMENT_FRAGMENT_NODE (Shadow DOM)
    if (node.node_type === NodeType.DOCUMENT_FRAGMENT_NODE) {
      const simplified = new SimplifiedNode(node);
      
      const allChildren = this._getChildrenAndShadowRoots(node);
      for (const child of allChildren) {
        const simplifiedChild = this.build(child, depth + 1);
        if (simplifiedChild) {
          simplified.children.push(simplifiedChild);
        }
      }

      // KEY FIX #1: Only return shadow DOM if it has meaningful children
      // The original code returned empty shadow DOM nodes unconditionally
      if (simplified.children.length > 0) {
        return simplified;
      }
      return null;
    }

    // Handle ELEMENT_NODE
    if (node.node_type === NodeType.ELEMENT_NODE) {
      const tagName = (node.node_name || node.tag_name || '').toLowerCase();

      // Filter 1: Skip non-content elements
      if (DISABLED_ELEMENTS.has(tagName)) {
        return null;
      }

      // Filter 2: Skip SVG child elements (decorative)
      if (SVG_ELEMENTS.has(tagName)) {
        return null;
      }

      const attrs = node.attributes || {};

      // Filter 3: Check exclusion attribute
      if (this.sessionId) {
        const sessionAttr = attrs[`data-browser-use-exclude-${this.sessionId}`];
        if (sessionAttr === 'true') {
          return null;
        }
      }
      if (attrs['data-browser-use-exclude'] === 'true') {
        return null;
      }

      // Handle IFRAME/FRAME
      if (tagName === 'iframe' || tagName === 'frame') {
        if (node.content_document) {
          const simplified = new SimplifiedNode(node);
          
          const iframeChildren = node.content_document.children_nodes || [];
          for (const child of iframeChildren) {
            const simplifiedChild = this.build(child, depth + 1);
            if (simplifiedChild) {
              simplified.children.push(simplifiedChild);
            }
          }
          
          return simplified;
        }
        // Iframe without content document - keep if visible
        if (node.is_visible) {
          return new SimplifiedNode(node);
        }
        return null;
      }

      // Determine inclusion criteria
      const isVisible = node.is_visible;
      const isScrollable = node.is_actually_scrollable;
      
      // KEY FIX #2: Check if has VISIBLE shadow content, not just any children
      // The original "hasShadowContent = allChildren.length > 0" was wrong
      const allChildren = this._getChildrenAndShadowRoots(node);
      const isShadowHost = allChildren.some(
        child => child.node_type === NodeType.DOCUMENT_FRAGMENT_NODE
      );

      // Exception: File inputs are often hidden but functional
      const isFileInput = tagName === 'input' && attrs.type === 'file';
      const effectiveVisible = isVisible || isFileInput;

      // KEY FIX #3: Build children first to determine if this node is meaningful
      // Only include parent if it has visible children OR is itself visible/interactive
      const simplifiedChildren = [];
      for (const child of allChildren) {
        const simplifiedChild = this.build(child, depth + 1);
        if (simplifiedChild) {
          simplifiedChildren.push(simplifiedChild);
        }
      }

      const hasVisibleChildren = simplifiedChildren.length > 0;

      // Include if: visible, scrollable, shadow host with content, or has visible children
      if (effectiveVisible || isScrollable || (isShadowHost && hasVisibleChildren) || hasVisibleChildren) {
        const simplified = new SimplifiedNode(node);
        simplified.children = simplifiedChildren;
        simplified.is_shadow_host = isShadowHost;
        return simplified;
      }

      // KEY FIX #4: If we have children but parent isn't visible,
      // still return the children by wrapping in a non-display node
      // This prevents orphan children while maintaining structure
      if (hasVisibleChildren) {
        const simplified = new SimplifiedNode(node);
        simplified.children = simplifiedChildren;
        simplified.should_display = false; // Mark as non-displaying wrapper
        return simplified;
      }

      return null;
    }

    // Handle TEXT_NODE
    if (node.node_type === NodeType.TEXT_NODE) {
      const isVisible = node.snapshot_node && node.is_visible;
      const text = (node.node_value || '').trim();

      // Only include visible text with meaningful content
      if (isVisible && text && text.length > 1) {
        return new SimplifiedNode(node);
      }
      return null;
    }

    return null;
  }

  /**
   * Get all children including shadow roots
   * @param {Object} node - Enhanced DOM node
   * @returns {Object[]} Array of child nodes
   */
  _getChildrenAndShadowRoots(node) {
    const result = [];
    
    if (node.children_nodes && node.children_nodes.length > 0) {
      result.push(...node.children_nodes);
    }
    
    if (node.shadow_roots && node.shadow_roots.length > 0) {
      result.push(...node.shadow_roots);
    }
    
    return result;
  }
}

/**
 * TreeOptimizer - Removes unnecessary wrapper nodes
 */
export class TreeOptimizer {
  /**
   * Optimize tree by removing unnecessary nodes
   * @param {SimplifiedNode} node - Simplified node
   * @returns {SimplifiedNode|null} Optimized node
   */
  optimize(node) {
    if (!node) return null;

    // Recursively optimize children first
    const optimizedChildren = [];
    for (const child of node.children) {
      const optimized = this.optimize(child);
      if (optimized) {
        optimizedChildren.push(optimized);
      }
    }
    node.children = optimizedChildren;

    // Determine if this node is meaningful
    const isVisible = node.original_node.snapshot_node && node.original_node.is_visible;
    const isScrollable = node.original_node.is_actually_scrollable;
    const isText = node.original_node.node_type === NodeType.TEXT_NODE;
    const hasChildren = node.children.length > 0;

    // File input exception
    const tagName = (node.original_node.node_name || node.original_node.tag_name || '').toLowerCase();
    const attrs = node.original_node.attributes || {};
    const isFileInput = tagName === 'input' && attrs.type === 'file';

    // Keep if: visible, scrollable, text, has children, or file input
    if (isVisible || isScrollable || isText || hasChildren || isFileInput) {
      return node;
    }

    return null;
  }
}
