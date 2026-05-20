/**
 * @file dom/tree_merger.js
 * @description Merges three CDP trees into EnhancedDOMTreeNode
 * Corresponds to browser-use/dom/enhanced_snapshot.py + service.py
 */

import { NodeType, REQUIRED_COMPUTED_STYLES, STATIC_ATTRIBUTES, DYNAMIC_CLASS_PATTERNS } from './views.js';
import { 
  getNodeTypeName, 
  parseComputedStyles, 
  calculateDevicePixelRatio,
  generateXPath,
  computeElementHash,
  computeStableHash
} from './utils.js';

// Configuration constants (matching browser-use defaults)
const DEFAULT_MAX_IFRAME_DEPTH = 5;
const VISIBILITY_BUFFER_PX = 1000; // browser-use uses 1000px buffer for visibility check

/**
 * TreeMerger - Combines DOM, AX, and Snapshot trees
 */
export class TreeMerger {
  constructor(snapshot, domTree, axTree, layoutMetrics, options = {}) {
    this.snapshot = snapshot;
    this.domTree = domTree;
    this.axTree = axTree;
    this.layoutMetrics = layoutMetrics;
    
    this.devicePixelRatio = calculateDevicePixelRatio(layoutMetrics);
    this.snapshotLookup = {};
    this.axTreeLookup = {};
    this.enhancedNodeLookup = {};
    
    // Configuration
    this.maxIframeDepth = options.maxIframeDepth || DEFAULT_MAX_IFRAME_DEPTH;
  }

  /**
   * Build all lookup maps and merge trees
   * @returns {Object} Enhanced DOM tree root
   */
  merge() {
    // Build lookup maps
    this._buildSnapshotLookup();
    this._buildAXTreeLookup();
    
    // Construct enhanced tree with iframe depth tracking
    const enhancedRoot = this._constructEnhancedNode(
      this.domTree.root,
      [],
      { x: 0, y: 0, width: 0, height: 0 },
      0 // iframeDepth starts at 0
    );
    
    // Post-process: compute hashes and xpaths for all nodes
    this._computeHashesAndXPaths();
    
    return {
      root: enhancedRoot,
      lookup: this.enhancedNodeLookup,
      stats: {
        snapshotEntries: Object.keys(this.snapshotLookup).length,
        axTreeEntries: Object.keys(this.axTreeLookup).length,
        totalNodes: Object.keys(this.enhancedNodeLookup).length,
        devicePixelRatio: this.devicePixelRatio,
        maxIframeDepth: this.maxIframeDepth
      }
    };
  }
  
  /**
   * Compute element_hash, stable_hash, and xpath for all nodes
   * This must be done after tree construction since xpath requires parent info
   */
  _computeHashesAndXPaths() {
    for (const [nodeId, node] of Object.entries(this.enhancedNodeLookup)) {
      if (node.node_type === NodeType.ELEMENT_NODE) {
        node.xpath = generateXPath(node, this.enhancedNodeLookup);
        node.element_hash = computeElementHash(node, this.enhancedNodeLookup, STATIC_ATTRIBUTES);
        node.stable_hash = computeStableHash(node, this.enhancedNodeLookup, STATIC_ATTRIBUTES, DYNAMIC_CLASS_PATTERNS);
      }
    }
  }

  /**
   * Build snapshot lookup map
   */
  _buildSnapshotLookup() {
    if (!this.snapshot.documents || this.snapshot.documents.length === 0) {
      return;
    }

    const strings = this.snapshot.strings || [];

    for (let docIdx = 0; docIdx < this.snapshot.documents.length; docIdx++) {
      const document = this.snapshot.documents[docIdx];
      const nodes = document.nodes || {};
      const layout = document.layout || {};

      // Build backendNodeId -> snapshotIndex map
      const backendNodeToSnapshotIndex = {};
      if (nodes.backendNodeId) {
        for (let i = 0; i < nodes.backendNodeId.length; i++) {
          backendNodeToSnapshotIndex[nodes.backendNodeId[i]] = i;
        }
      }

      // Build nodeIndex -> layoutIndex map
      const layoutIndexMap = {};
      if (layout.nodeIndex) {
        for (let layoutIdx = 0; layoutIdx < layout.nodeIndex.length; layoutIdx++) {
          const nodeIndex = layout.nodeIndex[layoutIdx];
          if (!(nodeIndex in layoutIndexMap)) {
            layoutIndexMap[nodeIndex] = layoutIdx;
          }
        }
      }

      // Build lookup entries
      for (const [backendNodeIdStr, snapshotIndex] of Object.entries(backendNodeToSnapshotIndex)) {
        const backendNodeId = parseInt(backendNodeIdStr);

        let isClickable = null;
        if (nodes.isClickable && nodes.isClickable.index) {
          isClickable = nodes.isClickable.index.includes(snapshotIndex);
        }

        let cursorStyle = null;
        let boundingBox = null;
        let computedStyles = {};
        let paintOrder = null;
        let clientRects = null;
        let scrollRects = null;

        if (snapshotIndex in layoutIndexMap) {
          const layoutIdx = layoutIndexMap[snapshotIndex];

          // Bounds
          if (layout.bounds && layoutIdx < layout.bounds.length) {
            const bounds = layout.bounds[layoutIdx];
            if (bounds && bounds.length >= 4) {
              boundingBox = {
                x: bounds[0] / this.devicePixelRatio,
                y: bounds[1] / this.devicePixelRatio,
                width: bounds[2] / this.devicePixelRatio,
                height: bounds[3] / this.devicePixelRatio
              };
            }
          }

          // Computed styles
          if (layout.styles && layoutIdx < layout.styles.length) {
            const styleIndices = layout.styles[layoutIdx];
            computedStyles = parseComputedStyles(strings, styleIndices, REQUIRED_COMPUTED_STYLES);
            cursorStyle = computedStyles.cursor || null;
          }

          // Paint order
          if (layout.paintOrders && layoutIdx < layout.paintOrders.length) {
            paintOrder = layout.paintOrders[layoutIdx];
          }

          // Client rects
          if (layout.clientRects && layoutIdx < layout.clientRects.length) {
            const clientRectData = layout.clientRects[layoutIdx];
            if (clientRectData && clientRectData.length >= 4) {
              clientRects = {
                x: clientRectData[0],
                y: clientRectData[1],
                width: clientRectData[2],
                height: clientRectData[3]
              };
            }
          }

          // Scroll rects
          if (layout.scrollRects && layoutIdx < layout.scrollRects.length) {
            const scrollRectData = layout.scrollRects[layoutIdx];
            if (scrollRectData && scrollRectData.length >= 4) {
              scrollRects = {
                x: scrollRectData[0],
                y: scrollRectData[1],
                width: scrollRectData[2],
                height: scrollRectData[3]
              };
            }
          }
        }

        this.snapshotLookup[backendNodeId] = {
          is_clickable: isClickable,
          cursor_style: cursorStyle,
          bounds: boundingBox,
          clientRects: clientRects,
          scrollRects: scrollRects,
          computed_styles: Object.keys(computedStyles).length > 0 ? computedStyles : null,
          paint_order: paintOrder
        };
      }
    }
  }

  /**
   * Build AX tree lookup map
   */
  _buildAXTreeLookup() {
    if (!this.axTree.nodes) return;

    for (const axNode of this.axTree.nodes) {
      if (axNode.backendDOMNodeId !== undefined) {
        this.axTreeLookup[axNode.backendDOMNodeId] = axNode;
      }
    }
  }

  /**
   * Construct enhanced DOM tree node recursively
   * @param {Object} node - DOM node
   * @param {Object[]} htmlFrames - HTML frame chain for visibility calculation
   * @param {Object} totalFrameOffset - Accumulated coordinate offset
   * @param {number} iframeDepth - Current iframe nesting depth
   */
  _constructEnhancedNode(node, htmlFrames, totalFrameOffset, iframeDepth = 0) {
    if (!node) return null;

    // Prevent duplicate processing
    if (this.enhancedNodeLookup[node.nodeId]) {
      return this.enhancedNodeLookup[node.nodeId];
    }

    const currentOffset = { ...totalFrameOffset };

    // Get AX node data
    const axNode = this.axTreeLookup[node.backendNodeId] || null;
    const enhancedAxNode = axNode ? this._buildEnhancedAXNode(axNode) : null;

    // Get snapshot data
    const snapshotData = this.snapshotLookup[node.backendNodeId] || null;

    // Calculate absolute position
    let absolutePosition = null;
    if (snapshotData && snapshotData.bounds) {
      absolutePosition = {
        x: snapshotData.bounds.x + currentOffset.x,
        y: snapshotData.bounds.y + currentOffset.y,
        width: snapshotData.bounds.width,
        height: snapshotData.bounds.height
      };
    }

    // Parse attributes
    const attributes = {};
    if (node.attributes) {
      for (let i = 0; i < node.attributes.length; i += 2) {
        attributes[node.attributes[i]] = node.attributes[i + 1];
      }
    }

    // Create enhanced node
    const domTreeNode = {
      node_id: node.nodeId,
      backend_node_id: node.backendNodeId,
      node_type: node.nodeType,
      node_type_name: getNodeTypeName(node.nodeType),
      node_name: node.nodeName,
      tag_name: node.nodeName, // Alias for convenience
      node_value: node.nodeValue || null,
      attributes: attributes,
      is_scrollable: node.isScrollable || null,
      frame_id: node.frameId || null,
      shadow_root_type: node.shadowRootType || null,
      ax_node: enhancedAxNode,
      snapshot_node: snapshotData,
      absolute_position: absolutePosition,
      is_visible: null, // Set after processing
      content_document: null,
      shadow_roots: [],
      children_nodes: [],
      parent_node_id: null,
      // Computed properties
      is_actually_scrollable: false
    };

    this.enhancedNodeLookup[node.nodeId] = domTreeNode;

    let updatedHtmlFrames = [...htmlFrames];

    // Handle HTML element (frame root)
    if (node.nodeType === NodeType.ELEMENT_NODE && 
        node.nodeName === 'HTML' && 
        node.frameId) {
      updatedHtmlFrames.push(domTreeNode);

      if (snapshotData && snapshotData.scrollRects) {
        currentOffset.x -= snapshotData.scrollRects.x;
        currentOffset.y -= snapshotData.scrollRects.y;
      }
    }

    // Handle IFRAME/FRAME
    if ((node.nodeName.toUpperCase() === 'IFRAME' || node.nodeName.toUpperCase() === 'FRAME') &&
        snapshotData && snapshotData.bounds) {
      updatedHtmlFrames.push(domTreeNode);
      currentOffset.x += snapshotData.bounds.x;
      currentOffset.y += snapshotData.bounds.y;
    }

    // Process content document (for iframes) with depth limiting
    if (node.contentDocument) {
      // Check iframe depth limit to prevent infinite recursion
      if (iframeDepth >= this.maxIframeDepth) {
        console.warn(
          `[TreeMerger] Skipping iframe at depth ${iframeDepth} (max: ${this.maxIframeDepth})`
        );
      } else {
        domTreeNode.content_document = this._constructEnhancedNode(
          node.contentDocument,
          updatedHtmlFrames,
          currentOffset,
          iframeDepth + 1 // Increment iframe depth
        );
        if (domTreeNode.content_document) {
          domTreeNode.content_document.parent_node_id = node.nodeId;
        }
      }
    }

    // Process shadow roots
    if (node.shadowRoots && node.shadowRoots.length > 0) {
      const shadowRootNodeIds = new Set(node.shadowRoots.map(sr => sr.nodeId));
      
      for (const shadowRoot of node.shadowRoots) {
        const shadowRootNode = this._constructEnhancedNode(
          shadowRoot,
          updatedHtmlFrames,
          currentOffset,
          iframeDepth // Shadow roots don't increase depth
        );
        if (shadowRootNode) {
          shadowRootNode.parent_node_id = node.nodeId;
          domTreeNode.shadow_roots.push(shadowRootNode);
        }
      }
    }

    // Process children (excluding shadow roots to prevent duplication)
    if (node.children && node.children.length > 0) {
      const shadowRootNodeIds = new Set(
        (node.shadowRoots || []).map(sr => sr.nodeId)
      );

      for (const child of node.children) {
        if (shadowRootNodeIds.has(child.nodeId)) {
          continue; // Skip shadow roots, already processed above
        }
        
        const childNode = this._constructEnhancedNode(
          child,
          updatedHtmlFrames,
          currentOffset,
          iframeDepth // Regular children don't increase depth
        );
        if (childNode) {
          childNode.parent_node_id = node.nodeId;
          domTreeNode.children_nodes.push(childNode);
        }
      }
    }

    // Calculate visibility
    domTreeNode.is_visible = this._isElementVisible(domTreeNode, updatedHtmlFrames);
    
    // Calculate scrollability
    domTreeNode.is_actually_scrollable = this._isActuallyScrollable(domTreeNode);

    return domTreeNode;
  }

  /**
   * Build enhanced AX node from raw AX node
   */
  _buildEnhancedAXNode(axNode) {
    const properties = [];
    
    if (axNode.properties) {
      for (const prop of axNode.properties) {
        try {
          properties.push({
            name: prop.name,
            value: prop.value?.value ?? null
          });
        } catch (e) {
          // Ignore invalid properties
        }
      }
    }

    return {
      ax_node_id: axNode.nodeId,
      ignored: axNode.ignored || false,
      role: axNode.role?.value ?? null,
      name: axNode.name?.value ?? null,
      description: axNode.description?.value ?? null,
      properties: properties.length > 0 ? properties : null,
      child_ids: axNode.childIds || null
    };
  }

  /**
   * Check if element is visible according to all parent frames
   */
  _isElementVisible(node, htmlFrames) {
    if (!node.snapshot_node) {
      return false;
    }

    const computedStyles = node.snapshot_node.computed_styles || {};
    
    const display = (computedStyles.display || '').toLowerCase();
    const visibility = (computedStyles.visibility || '').toLowerCase();
    const opacity = computedStyles.opacity || '1';

    // Check CSS visibility
    if (display === 'none' || visibility === 'hidden') {
      return false;
    }

    try {
      if (parseFloat(opacity) <= 0) {
        return false;
      }
    } catch (e) {}

    const currentBounds = node.snapshot_node.bounds;
    if (!currentBounds) {
      return false;
    }

    // Check against frame hierarchy
    const boundsToCheck = { ...currentBounds };

    for (let i = htmlFrames.length - 1; i >= 0; i--) {
      const frame = htmlFrames[i];

      // Adjust for iframe offset
      if (frame.node_type === NodeType.ELEMENT_NODE &&
          (frame.node_name.toUpperCase() === 'IFRAME' || frame.node_name.toUpperCase() === 'FRAME') &&
          frame.snapshot_node?.bounds) {
        boundsToCheck.x += frame.snapshot_node.bounds.x;
        boundsToCheck.y += frame.snapshot_node.bounds.y;
      }

      // Check viewport intersection
      if (frame.node_type === NodeType.ELEMENT_NODE &&
          frame.node_name === 'HTML' &&
          frame.snapshot_node?.scrollRects &&
          frame.snapshot_node?.clientRects) {
        
        const viewportRight = frame.snapshot_node.clientRects.width;
        const viewportBottom = frame.snapshot_node.clientRects.height;

        const adjustedX = boundsToCheck.x - frame.snapshot_node.scrollRects.x;
        const adjustedY = boundsToCheck.y - frame.snapshot_node.scrollRects.y;

        // Allow buffer for off-screen elements (browser-use uses 1000px)
        const frameIntersects = (
          adjustedX < viewportRight &&
          adjustedX + boundsToCheck.width > 0 &&
          adjustedY < viewportBottom + VISIBILITY_BUFFER_PX && // Allow 1000px below viewport
          adjustedY + boundsToCheck.height > -VISIBILITY_BUFFER_PX // Allow 1000px above viewport
        );

        if (!frameIntersects) {
          return false;
        }

        boundsToCheck.x -= frame.snapshot_node.scrollRects.x;
        boundsToCheck.y -= frame.snapshot_node.scrollRects.y;
      }
    }

    return true;
  }

  /**
   * Check if element is actually scrollable
   */
  _isActuallyScrollable(node) {
    if (node.is_scrollable) {
      return true;
    }

    if (!node.snapshot_node) {
      return false;
    }

    const scrollRects = node.snapshot_node.scrollRects;
    const clientRects = node.snapshot_node.clientRects;

    if (scrollRects && clientRects) {
      const hasVerticalScroll = scrollRects.height > clientRects.height + 1;
      const hasHorizontalScroll = scrollRects.width > clientRects.width + 1;

      if (hasVerticalScroll || hasHorizontalScroll) {
        const styles = node.snapshot_node.computed_styles || {};
        const overflow = (styles.overflow || 'visible').toLowerCase();
        const overflowX = (styles['overflow-x'] || overflow).toLowerCase();
        const overflowY = (styles['overflow-y'] || overflow).toLowerCase();

        const scrollValues = ['auto', 'scroll', 'overlay'];
        return scrollValues.includes(overflow) || 
               scrollValues.includes(overflowX) || 
               scrollValues.includes(overflowY);
      }
    }

    return false;
  }
}
