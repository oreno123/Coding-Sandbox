/**
 * @file dom/utils.js
 * @description Utility functions for DOM processing
 * Corresponds to browser-use/dom/utils.py
 */

/**
 * Cap text length for LLM output
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function capTextLength(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Get node type name from numeric type
 * @param {number} nodeType - Node type number
 * @returns {string} Node type name
 */
export function getNodeTypeName(nodeType) {
  const names = {
    1: 'ELEMENT_NODE',
    2: 'ATTRIBUTE_NODE',
    3: 'TEXT_NODE',
    4: 'CDATA_SECTION_NODE',
    7: 'PROCESSING_INSTRUCTION_NODE',
    8: 'COMMENT_NODE',
    9: 'DOCUMENT_NODE',
    10: 'DOCUMENT_TYPE_NODE',
    11: 'DOCUMENT_FRAGMENT_NODE'
  };
  return names[nodeType] || 'UNKNOWN';
}

/**
 * Parse computed styles from snapshot string indices
 * @param {string[]} strings - String table from snapshot
 * @param {number[]} styleIndices - Style indices
 * @param {string[]} styleNames - Style property names
 * @returns {Object} Parsed styles
 */
export function parseComputedStyles(strings, styleIndices, styleNames) {
  const styles = {};
  if (!styleIndices || !styleNames) return styles;

  for (let i = 0; i < styleIndices.length && i < styleNames.length; i++) {
    const styleIndex = styleIndices[i];
    if (styleIndex >= 0 && styleIndex < strings.length) {
      styles[styleNames[i]] = strings[styleIndex];
    }
  }
  return styles;
}

/**
 * Calculate device pixel ratio from layout metrics
 * @param {Object} layoutMetrics - Layout metrics from CDP
 * @returns {number} Device pixel ratio
 */
export function calculateDevicePixelRatio(layoutMetrics) {
  const visualViewport = layoutMetrics.visualViewport || {};
  const cssVisualViewport = layoutMetrics.cssVisualViewport || {};
  const cssLayoutViewport = layoutMetrics.cssLayoutViewport || {};
  
  const width = cssVisualViewport.clientWidth || cssLayoutViewport.clientWidth || 1920.0;
  const deviceWidth = visualViewport.clientWidth || width;
  const cssWidth = cssVisualViewport.clientWidth || width;
  const devicePixelRatio = cssWidth > 0 ? deviceWidth / cssWidth : 1.0;
  
  return devicePixelRatio;
}

/**
 * Check if two rectangles intersect
 * @param {Object} a - First rectangle {x, y, width, height}
 * @param {Object} b - Second rectangle {x, y, width, height}
 * @returns {boolean} True if rectangles intersect
 */
export function rectsIntersect(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/**
 * Calculate intersection area of two rectangles
 * @param {Object} a - First rectangle
 * @param {Object} b - Second rectangle
 * @returns {number} Intersection area
 */
export function getIntersectionArea(a, b) {
  const xOverlap = Math.max(0, 
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  );
  const yOverlap = Math.max(0, 
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  );
  return xOverlap * yOverlap;
}

/**
 * Check if child is contained within parent bounds
 * @param {Object} child - Child bounds {x, y, width, height}
 * @param {Object} parent - Parent bounds {x, y, width, height}
 * @param {number} threshold - Containment threshold (0.0-1.0)
 * @returns {boolean} True if child is sufficiently contained
 */
export function isContainedWithinBounds(child, parent, threshold = 0.99) {
  const intersectionArea = getIntersectionArea(child, parent);
  const childArea = child.width * child.height;
  
  if (childArea === 0) return false;
  
  return (intersectionArea / childArea) >= threshold;
}

/**
 * Clean and normalize text content
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
export function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Check if string contains any of the given patterns
 * @param {string} str - String to check
 * @param {string[]} patterns - Patterns to match
 * @returns {boolean} True if any pattern matches
 */
export function containsAny(str, patterns) {
  if (!str) return false;
  const lowerStr = str.toLowerCase();
  return patterns.some(p => lowerStr.includes(p.toLowerCase()));
}

// ==================== Hashing Utilities ====================

/**
 * Simple hash function (simulates Python's hashlib.sha256)
 * @param {string} str - String to hash
 * @returns {string} 16-character hex hash
 */
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to positive hex string
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  // Create a longer hash by hashing parts
  let fullHash = hex;
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

/**
 * Filter dynamic classes from class string for stable hashing
 * Matches browser-use/dom/views.py filter_dynamic_classes
 * @param {string} classStr - Class attribute value
 * @param {Set} dynamicPatterns - Patterns to filter
 * @returns {string} Filtered and sorted classes
 */
export function filterDynamicClasses(classStr, dynamicPatterns) {
  if (!classStr) return '';
  const classes = classStr.split(/\s+/).filter(Boolean);
  const stable = classes.filter(c => 
    !Array.from(dynamicPatterns).some(pattern => c.toLowerCase().includes(pattern))
  );
  return stable.sort().join(' ');
}

// ==================== XPath Utilities ====================

/**
 * Generate XPath for an enhanced DOM node
 * Stops at shadow boundaries or iframes
 * Matches browser-use/dom/views.py EnhancedDOMTreeNode.xpath
 * @param {Object} node - Enhanced DOM tree node
 * @param {Object} lookup - Node lookup map (node_id -> node)
 * @returns {string} XPath string
 */
export function generateXPath(node, lookup = {}) {
  const segments = [];
  let current = node;
  
  while (current && (current.node_type === 1 || current.node_type === 11)) {
    // DOCUMENT_FRAGMENT_NODE - pass through shadow roots
    if (current.node_type === 11) {
      if (current.parent_node_id && lookup[current.parent_node_id]) {
        current = lookup[current.parent_node_id];
      } else {
        break;
      }
      continue;
    }
    
    // Stop at iframe boundary
    if (current.parent_node_id) {
      const parent = lookup[current.parent_node_id];
      if (parent && parent.node_name.toLowerCase() === 'iframe') {
        break;
      }
    }
    
    const position = getElementPosition(current, lookup);
    const tagName = current.node_name.toLowerCase();
    const xpathIndex = position > 0 ? `[${position}]` : '';
    segments.unshift(`${tagName}${xpathIndex}`);
    
    if (current.parent_node_id && lookup[current.parent_node_id]) {
      current = lookup[current.parent_node_id];
    } else {
      break;
    }
  }
  
  return segments.join('/');
}

/**
 * Get element position among siblings with same tag
 * @param {Object} element - Enhanced DOM node
 * @param {Object} lookup - Node lookup map
 * @returns {number} 1-based position, 0 if only element of type
 */
function getElementPosition(element, lookup) {
  if (!element.parent_node_id || !lookup[element.parent_node_id]) {
    return 0;
  }
  
  const parent = lookup[element.parent_node_id];
  const children = parent.children_nodes || [];
  
  const sameTagSiblings = children.filter(
    child => child.node_type === 1 && 
             child.node_name.toLowerCase() === element.node_name.toLowerCase()
  );
  
  if (sameTagSiblings.length <= 1) {
    return 0;
  }
  
  const index = sameTagSiblings.findIndex(s => s.node_id === element.node_id);
  return index >= 0 ? index + 1 : 0;
}

/**
 * Get parent branch path as array of tag names
 * Matches browser-use/dom/views.py _get_parent_branch_path
 * @param {Object} node - Enhanced DOM node
 * @param {Object} lookup - Node lookup map
 * @returns {string[]} Array of tag names from root to node
 */
export function getParentBranchPath(node, lookup = {}) {
  const parents = [];
  let current = node;
  
  while (current) {
    if (current.node_type === 1) { // ELEMENT_NODE
      parents.push(current);
    }
    
    if (current.parent_node_id && lookup[current.parent_node_id]) {
      current = lookup[current.parent_node_id];
    } else {
      break;
    }
  }
  
  parents.reverse();
  return parents.map(p => p.node_name.toLowerCase());
}

/**
 * Compute element hash
 * Matches browser-use/dom/views.py EnhancedDOMTreeNode.__hash__
 * @param {Object} node - Enhanced DOM node
 * @param {Object} lookup - Node lookup map
 * @param {Set} staticAttributes - Static attributes to include
 * @returns {string} Hash string
 */
export function computeElementHash(node, lookup = {}, staticAttributes = new Set()) {
  const parentPath = getParentBranchPath(node, lookup);
  const parentPathString = parentPath.join('/');
  
  // Build attributes string from static attributes
  const attrs = node.attributes || {};
  const sortedAttrs = Object.entries(attrs)
    .filter(([k]) => staticAttributes.has(k))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join('');
  
  // Include ax_name if available
  let axName = '';
  if (node.ax_node && node.ax_node.name) {
    axName = `|ax_name=${node.ax_node.name}`;
  }
  
  const combined = `${parentPathString}|${sortedAttrs}${axName}`;
  return simpleHash(combined);
}

/**
 * Compute stable hash (with dynamic classes filtered)
 * Matches browser-use/dom/views.py compute_stable_hash
 * @param {Object} node - Enhanced DOM node
 * @param {Object} lookup - Node lookup map
 * @param {Set} staticAttributes - Static attributes to include
 * @param {Set} dynamicPatterns - Dynamic class patterns to filter
 * @returns {string} Stable hash string
 */
export function computeStableHash(node, lookup = {}, staticAttributes = new Set(), dynamicPatterns = new Set()) {
  const parentPath = getParentBranchPath(node, lookup);
  const parentPathString = parentPath.join('/');
  
  // Build attributes string with filtered classes
  const attrs = node.attributes || {};
  const filteredAttrs = {};
  
  for (const [k, v] of Object.entries(attrs)) {
    if (!staticAttributes.has(k)) continue;
    if (k === 'class') {
      const filtered = filterDynamicClasses(v, dynamicPatterns);
      if (filtered) {
        filteredAttrs[k] = filtered;
      }
    } else {
      filteredAttrs[k] = v;
    }
  }
  
  const sortedAttrs = Object.entries(filteredAttrs)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join('');
  
  // Include ax_name if available
  let axName = '';
  if (node.ax_node && node.ax_node.name) {
    axName = `|ax_name=${node.ax_node.name}`;
  }
  
  const combined = `${parentPathString}|${sortedAttrs}${axName}`;
  return simpleHash(combined);
}