/**
 * @file dom/views.js
 * @description Data models and constants for DOM serialization
 * Corresponds to browser-use/dom/views.py
 */

// ==================== NodeType Enum ====================
export const NodeType = {
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

// ==================== Element Sets ====================

/** Elements to skip entirely (non-content elements) */
export const DISABLED_ELEMENTS = new Set([
  'style', 'script', 'head', 'meta', 'link', 'title', 'noscript'
]);

/** SVG child elements to skip (decorative only) */
export const SVG_ELEMENTS = new Set([
  'path', 'rect', 'g', 'circle', 'ellipse', 'line', 'polyline',
  'polygon', 'use', 'defs', 'clipPath', 'mask', 'pattern', 
  'image', 'text', 'tspan', 'linearGradient', 'radialGradient', 'stop'
]);

/** 
 * Elements that propagate bounds to their children (Compound Components)
 * Used for bbox filtering - if a parent is interactive, children within bounds are merged
 * Matches browser-use/dom/serializer/serializer.py PROPAGATING_ELEMENTS
 */
export const PROPAGATING_ELEMENTS = [
  // Links
  { tag: 'a', role: null },
  
  // Buttons (native and div-based)
  { tag: 'button', role: null },
  { tag: 'div', role: 'button' },
  { tag: 'span', role: 'button' },
  
  // Dropdowns and comboboxes
  { tag: 'div', role: 'combobox' },
  { tag: 'span', role: 'combobox' },
  { tag: 'input', role: 'combobox' },
  
  // Menu items
  { tag: 'div', role: 'menuitem' },
  { tag: 'div', role: 'menuitemcheckbox' },
  { tag: 'div', role: 'menuitemradio' },
  { tag: 'li', role: 'menuitem' },
  { tag: 'li', role: 'option' },
  
  // List items
  { tag: 'div', role: 'option' },
  { tag: 'div', role: 'listitem' },
  
  // Tab items
  { tag: 'button', role: 'tab' },
  { tag: 'div', role: 'tab' },
  
  // Tree items
  { tag: 'div', role: 'treeitem' },
  { tag: 'li', role: 'treeitem' },
  
  // Grid cells (clickable cells in tables)
  { tag: 'div', role: 'gridcell' },
  { tag: 'td', role: 'gridcell' },
  
  // Links using role
  { tag: 'div', role: 'link' },
  { tag: 'span', role: 'link' },
];

/** Interactive HTML tags */
export const INTERACTIVE_TAGS = new Set([
  'button', 'input', 'select', 'textarea', 'a', 
  'details', 'summary', 'option', 'optgroup'
]);

/** Interactive ARIA roles */
export const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'menuitem', 'option', 'radio', 'checkbox',
  'tab', 'textbox', 'combobox', 'slider', 'spinbutton', 
  'search', 'searchbox', 'listbox', 'menu', 'menubar',
  'switch', 'treeitem'
]);

/** Form elements that should never be excluded by bbox filtering */
export const FORM_ELEMENTS = new Set([
  'input', 'select', 'textarea', 'label', 'button'
]);

// ==================== Computed Styles ====================

export const REQUIRED_COMPUTED_STYLES = [
  'display',
  'visibility', 
  'opacity',
  'overflow',
  'overflow-x',
  'overflow-y',
  'cursor',
  'pointer-events',
  'position',
  'background-color'
];

// ==================== Include Attributes ====================

/**
 * Attributes to include in LLM representation
 * Matches browser-use/dom/views.py DEFAULT_INCLUDE_ATTRIBUTES
 */
export const DEFAULT_INCLUDE_ATTRIBUTES = [
  // Basic HTML attributes
  'title',
  'type',
  'checked',
  'id',
  'name',
  'role',
  'value',
  'placeholder',
  'alt',
  'href',
  
  // ARIA attributes
  'aria-label',
  'aria-expanded',
  'aria-checked',
  'aria-valuemin',
  'aria-valuemax',
  'aria-valuenow',
  'aria-placeholder',
  
  // Data attributes for date/input handling
  'data-date-format',
  'data-state',
  'data-mask',
  'data-inputmask',
  'data-datepicker',
  
  // Input validation attributes
  'pattern',
  'min',
  'max',
  'minlength',
  'maxlength',
  'step',
  'accept',
  'multiple',
  'inputmode',
  'autocomplete',
  'contenteditable',
  
  // Format hints (synthetic attributes)
  'format',
  'expected_format',
  
  // Webkit shadow DOM
  'pseudo',
  
  // Accessibility properties from ax_node (ordered by importance)
  'checked',
  'selected',
  'expanded',
  'pressed',
  'disabled',
  'invalid',
  'valuemin',
  'valuemax',
  'valuenow',
  'keyshortcuts',
  'haspopup',
  'multiselectable',
  'required',
  'valuetext',
  'level',
  'busy',
  'live',
  
  // Accessibility name
  'ax_name',
];

/**
 * Static attributes used for element hashing
 * Matches browser-use/dom/views.py STATIC_ATTRIBUTES
 */
export const STATIC_ATTRIBUTES = new Set([
  'class',
  'id',
  'name',
  'type',
  'placeholder',
  'aria-label',
  'title',
  'role',
  'data-testid',
  'data-test',
  'data-cy',
  'data-selenium',
  'for',
  'required',
  'disabled',
  'readonly',
  'checked',
  'selected',
  'multiple',
  'accept',
  'href',
  'target',
  'rel',
  'aria-describedby',
  'aria-labelledby',
  'aria-controls',
  'aria-owns',
  'aria-live',
  'aria-atomic',
  'aria-busy',
  'aria-disabled',
  'aria-hidden',
  'aria-pressed',
  'aria-checked',
  'aria-selected',
  'tabindex',
  'alt',
  'src',
  'lang',
  'itemscope',
  'itemtype',
  'itemprop',
  'pseudo',
  'aria-valuemin',
  'aria-valuemax',
  'aria-valuenow',
  'aria-placeholder',
]);

/**
 * Dynamic class patterns to filter for stable hashing
 * Matches browser-use/dom/views.py DYNAMIC_CLASS_PATTERNS
 */
export const DYNAMIC_CLASS_PATTERNS = new Set([
  'focus',
  'hover',
  'active',
  'selected',
  'disabled',
  'animation',
  'transition',
  'loading',
  'open',
  'closed',
  'expanded',
  'collapsed',
  'visible',
  'hidden',
  'pressed',
  'checked',
  'highlighted',
  'current',
  'entering',
  'leaving',
]);

// ==================== Data Classes ====================

/**
 * Represents a bounding box rectangle
 */
export class DOMRect {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}

/**
 * Simplified node for serialization
 * Corresponds to SimplifiedNode in browser-use
 */
export class SimplifiedNode {
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
 * Propagating bounds for bbox filtering
 */
export class PropagatingBounds {
  constructor(tag, bounds, nodeId, depth) {
    this.tag = tag;
    this.bounds = bounds;
    this.node_id = nodeId;
    this.depth = depth;
  }
}

/**
 * Serialized DOM state result
 */
export class SerializedDOMState {
  constructor(root, selectorMap) {
    this._root = root;
    this.selector_map = selectorMap;
  }
}
