/**
 * @file dom/serializer/clickable_detector.js
 * @description Detects interactive/clickable elements
 * Corresponds to browser-use/dom/serializer/clickable_elements.py
 */

import { 
  NodeType, 
  INTERACTIVE_TAGS, 
  INTERACTIVE_ROLES 
} from '../views.js';
import { containsAny } from '../utils.js';

// Search-related indicators
const SEARCH_INDICATORS = [
  'search', 'magnify', 'glass', 'lookup', 'find', 'query', 'searchbox'
];

// Pagination indicators (matches browser-use/dom/views.py PAGINATION_INDICATORS)
const PAGINATION_INDICATORS = [
  'pagination', 'pager', 'paginate', 'page-nav', 'pagenav',
  'page-numbers', 'page-links', 'page-controls'
];

// Next page button text patterns
const NEXT_PAGE_PATTERNS = [
  'next', 'siguiente', 'nächste', 'suivant', 'avanti', 'próximo',
  '»', '›', '→', '>', '>>'
];

// Previous page button text patterns  
const PREV_PAGE_PATTERNS = [
  'prev', 'previous', 'anterior', 'vorherige', 'précédent', 'indietro',
  '«', '‹', '←', '<', '<<'
];

// First/Last page patterns
const FIRST_PAGE_PATTERNS = ['first', 'primera', 'erste', 'première', '|<', '<<'];
const LAST_PAGE_PATTERNS = ['last', 'última', 'letzte', 'dernière', '>|', '>>'];

// Interactive attributes that indicate clickability
const INTERACTIVE_ATTRIBUTES = [
  'onclick', 'onmousedown', 'onmouseup', 'onkeydown', 'onkeyup', 
  'onkeypress', 'onfocus', 'onblur', 'tabindex'
];

// AX properties indicating interactivity
const INTERACTIVE_AX_PROPERTIES = new Set([
  'focusable', 'editable', 'settable'
]);

// AX properties indicating state (implies interactivity)
const STATE_AX_PROPERTIES = new Set([
  'checked', 'expanded', 'pressed', 'selected'
]);

/**
 * ClickableElementDetector - Determines if an element is interactive
 */
export class ClickableElementDetector {
  
  /**
   * Check if a node is interactive
   * @param {Object} node - Enhanced DOM tree node
   * @returns {boolean} True if interactive
   */
  static isInteractive(node) {
    // Skip non-element nodes
    if (node.node_type !== NodeType.ELEMENT_NODE) {
      return false;
    }

    const tagName = (node.node_name || node.tag_name || '').toLowerCase();
    const attrs = node.attributes || {};

    // Rule 1: Exclude html and body
    if (tagName === 'html' || tagName === 'body') {
      return false;
    }

    // Rule 2: Large iframes are interactive (may have content to scroll)
    if (tagName === 'iframe' || tagName === 'frame') {
      if (node.snapshot_node?.bounds) {
        const { width, height } = node.snapshot_node.bounds;
        if (width > 100 && height > 100) {
          return true;
        }
      }
    }

    // Rule 3: Check for search indicators (class, id, data-*)
    const classList = (attrs.class || '').toLowerCase();
    const elementId = (attrs.id || '').toLowerCase();
    
    if (containsAny(classList, SEARCH_INDICATORS) || 
        containsAny(elementId, SEARCH_INDICATORS)) {
      return true;
    }

    // Check data-* attributes for search indicators
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('data-') && typeof value === 'string') {
        if (containsAny(value, SEARCH_INDICATORS)) {
          return true;
        }
      }
    }

    // Rule 4: Check AX node properties
    if (node.ax_node?.properties) {
      for (const prop of node.ax_node.properties) {
        // Disabled or hidden = not interactive
        if (prop.name === 'disabled' && prop.value) return false;
        if (prop.name === 'hidden' && prop.value) return false;
        
        // Interactive properties
        if (INTERACTIVE_AX_PROPERTIES.has(prop.name) && prop.value) {
          return true;
        }
        
        // State properties imply interactivity
        if (STATE_AX_PROPERTIES.has(prop.name)) {
          return true;
        }
        
        // Required/autocomplete fields are interactive
        if ((prop.name === 'required' || prop.name === 'autocomplete') && prop.value) {
          return true;
        }
        
        // Has keyboard shortcuts
        if (prop.name === 'keyshortcuts' && prop.value) {
          return true;
        }
      }
    }

    // Rule 5: Interactive HTML tags
    if (INTERACTIVE_TAGS.has(tagName)) {
      return true;
    }

    // Rule 6: Interactive attributes (onclick, tabindex, etc.)
    if (INTERACTIVE_ATTRIBUTES.some(attr => attr in attrs)) {
      return true;
    }

    // Rule 7: ARIA role indicates interactivity
    if (attrs.role && INTERACTIVE_ROLES.has(attrs.role)) {
      return true;
    }

    // Rule 8: AX role indicates interactivity
    if (node.ax_node?.role && INTERACTIVE_ROLES.has(node.ax_node.role)) {
      return true;
    }

    // Rule 9: Contenteditable elements
    if (attrs.contenteditable === 'true' || attrs.contenteditable === '') {
      return true;
    }

    // Rule 10: Icon-sized elements with certain attributes
    if (node.snapshot_node?.bounds) {
      const { width, height } = node.snapshot_node.bounds;
      if (width >= 10 && width <= 50 && height >= 10 && height <= 50) {
        const iconAttrs = ['class', 'role', 'onclick', 'data-action', 'aria-label'];
        if (iconAttrs.some(attr => attr in attrs && attrs[attr])) {
          // Has icon-like size and interactive attributes
          return true;
        }
      }
    }

    // Rule 11: Cursor style indicates clickability
    if (node.snapshot_node?.cursor_style === 'pointer') {
      return true;
    }

    // Rule 12: Is marked clickable by browser
    if (node.snapshot_node?.is_clickable === true) {
      return true;
    }

    return false;
  }

  /**
   * Detect if an element is a pagination container
   * @param {Object} node - Enhanced DOM tree node
   * @returns {boolean} True if pagination container
   */
  static isPaginationContainer(node) {
    if (node.node_type !== NodeType.ELEMENT_NODE) {
      return false;
    }

    const attrs = node.attributes || {};
    const classList = (attrs.class || '').toLowerCase();
    const elementId = (attrs.id || '').toLowerCase();
    const role = (attrs.role || '').toLowerCase();
    const ariaLabel = (attrs['aria-label'] || '').toLowerCase();

    // Check class/id for pagination indicators
    if (containsAny(classList, PAGINATION_INDICATORS) || 
        containsAny(elementId, PAGINATION_INDICATORS)) {
      return true;
    }

    // Check role="navigation" with pagination in label
    if (role === 'navigation' && containsAny(ariaLabel, ['page', 'pagination'])) {
      return true;
    }

    return false;
  }

  /**
   * Detect pagination button type
   * @param {Object} node - Enhanced DOM tree node
   * @returns {Object|null} { type: 'next'|'prev'|'first'|'last'|'number', page?: number }
   */
  static detectPaginationButton(node) {
    if (node.node_type !== NodeType.ELEMENT_NODE) {
      return null;
    }

    // Get accessible name (prefer AX name, then aria-label, then text content)
    let text = '';
    if (node.ax_node?.name) {
      text = node.ax_node.name.toLowerCase();
    }
    
    const attrs = node.attributes || {};
    if (!text && attrs['aria-label']) {
      text = attrs['aria-label'].toLowerCase();
    }
    
    if (!text && attrs.title) {
      text = attrs.title.toLowerCase();
    }

    if (!text) {
      return null;
    }

    // Check for navigation patterns
    if (NEXT_PAGE_PATTERNS.some(p => text.includes(p.toLowerCase()))) {
      return { type: 'next' };
    }
    
    if (PREV_PAGE_PATTERNS.some(p => text.includes(p.toLowerCase()))) {
      return { type: 'prev' };
    }
    
    if (FIRST_PAGE_PATTERNS.some(p => text.includes(p.toLowerCase()))) {
      return { type: 'first' };
    }
    
    if (LAST_PAGE_PATTERNS.some(p => text.includes(p.toLowerCase()))) {
      return { type: 'last' };
    }

    // Check for page numbers
    const pageNum = parseInt(text.trim(), 10);
    if (!isNaN(pageNum) && pageNum > 0 && pageNum < 10000) {
      return { type: 'number', page: pageNum };
    }

    return null;
  }

  /**
   * Find pagination info in a tree
   * @param {Object} root - Root node of simplified or enhanced tree
   * @returns {Object} Pagination info { container, nextButton, prevButton, currentPage, totalPages }
   */
  static findPaginationInfo(root) {
    const result = {
      container: null,
      nextButton: null,
      prevButton: null,
      currentPage: null,
      pages: []
    };

    const collectPaginationInfo = (node) => {
      if (!node) return;

      const original = node.original_node || node;

      // Check if this is a pagination container
      if (ClickableElementDetector.isPaginationContainer(original)) {
        result.container = original;
      }

      // Check if this is a pagination button
      const buttonType = ClickableElementDetector.detectPaginationButton(original);
      if (buttonType) {
        if (buttonType.type === 'next') {
          result.nextButton = original;
        } else if (buttonType.type === 'prev') {
          result.prevButton = original;
        } else if (buttonType.type === 'number') {
          result.pages.push({ node: original, page: buttonType.page });
          
          // Check if this is current page (has aria-current or selected state)
          const attrs = original.attributes || {};
          if (attrs['aria-current'] === 'page' || 
              attrs['aria-selected'] === 'true' ||
              (original.ax_node?.properties || []).some(p => p.name === 'selected' && p.value)) {
            result.currentPage = buttonType.page;
          }
        }
      }

      // Recurse into children
      const children = node.children || node.children_nodes || [];
      for (const child of children) {
        collectPaginationInfo(child);
      }
    };

    collectPaginationInfo(root);
    return result;
  }
}
