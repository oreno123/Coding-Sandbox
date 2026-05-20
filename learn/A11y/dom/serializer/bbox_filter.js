/**
 * @file dom/serializer/bbox_filter.js
 * @description Bounding box based child filtering
 * Corresponds to browser-use/dom/serializer/serializer.py _apply_bounding_box_filtering
 */

import { 
  NodeType, 
  PROPAGATING_ELEMENTS, 
  FORM_ELEMENTS,
  INTERACTIVE_ROLES,
  PropagatingBounds 
} from '../views.js';
import { isContainedWithinBounds } from '../utils.js';

/**
 * BoundingBoxFilter - Filters children that are contained within parent clickable areas
 * 
 * Purpose: When a clickable element (like <a> or <button>) fully contains its children,
 * clicking anywhere in the container triggers the same action. We can exclude the 
 * children to reduce noise.
 */
export class BoundingBoxFilter {
  constructor(options = {}) {
    this.containmentThreshold = options.threshold || 0.99;
  }

  /**
   * Apply bounding box filtering to tree
   * @param {SimplifiedNode} root - Root of simplified tree
   */
  apply(root) {
    if (!root) return;
    
    this._filterRecursive(root, null, 0);

    // Log statistics
    const excludedCount = this._countExcluded(root);
    if (excludedCount > 0) {
      console.log(`[BBoxFilter] Excluded ${excludedCount} nodes`);
    }
  }

  /**
   * Recursively filter tree with bounds propagation
   */
  _filterRecursive(node, activeBounds, depth) {
    // Check if this node should be excluded by parent bounds
    if (activeBounds && this._shouldExcludeChild(node, activeBounds)) {
      node.excluded_by_parent = true;
    }

    // Check if this node starts new bounds propagation
    let newBounds = null;
    const tagName = (node.original_node.node_name || node.original_node.tag_name || '').toLowerCase();
    const attrs = node.original_node.attributes || {};
    const role = attrs.role || null;

    if (this._isPropagatingElement(tagName, role)) {
      const bounds = node.original_node.snapshot_node?.bounds;
      if (bounds) {
        newBounds = new PropagatingBounds(tagName, bounds, node.original_node.node_id, depth);
      }
    }

    // Propagate bounds to children
    const propagateBounds = newBounds || activeBounds;
    
    for (const child of node.children) {
      this._filterRecursive(child, propagateBounds, depth + 1);
    }
  }

  /**
   * Check if element is a propagating element (clickable container)
   */
  _isPropagatingElement(tagName, role) {
    for (const pattern of PROPAGATING_ELEMENTS) {
      const tagMatch = pattern.tag === null || pattern.tag === tagName;
      const roleMatch = pattern.role === null || pattern.role === role;
      if (tagMatch && roleMatch) {
        return true;
      }
    }
    return false;
  }

  /**
   * Determine if child should be excluded based on parent bounds
   */
  _shouldExcludeChild(node, activeBounds) {
    // RULE 1: Never exclude text nodes
    if (node.original_node.node_type === NodeType.TEXT_NODE) {
      return false;
    }

    // RULE 2: Need bounds to determine containment
    const childBounds = node.original_node.snapshot_node?.bounds;
    if (!childBounds) {
      return false;
    }

    // RULE 3: Check containment threshold
    if (!isContainedWithinBounds(childBounds, activeBounds.bounds, this.containmentThreshold)) {
      return false;
    }

    const tagName = (node.original_node.node_name || node.original_node.tag_name || '').toLowerCase();
    const attrs = node.original_node.attributes || {};
    const role = attrs.role || null;

    // EXCEPTION 1: Never exclude form elements
    if (FORM_ELEMENTS.has(tagName)) {
      return false;
    }

    // EXCEPTION 2: Never exclude nested propagating elements (button in button)
    if (this._isPropagatingElement(tagName, role)) {
      return false;
    }

    // EXCEPTION 3: Keep elements with explicit onclick
    if (attrs.onclick) {
      return false;
    }

    // EXCEPTION 4: Keep elements with aria-label (implies independent interactivity)
    if (attrs['aria-label']?.trim()) {
      return false;
    }

    // EXCEPTION 5: Keep elements with interactive roles
    if (role && INTERACTIVE_ROLES.has(role)) {
      return false;
    }

    // EXCEPTION 6: Keep elements with tabindex (explicitly focusable)
    if ('tabindex' in attrs) {
      return false;
    }

    // EXCEPTION 7: Keep SVG elements (they're often icons)
    if (tagName === 'svg') {
      return false;
    }

    // Default: exclude this child
    return true;
  }

  /**
   * Count excluded nodes for debugging
   */
  _countExcluded(node, count = 0) {
    if (node.excluded_by_parent) {
      count++;
    }
    for (const child of node.children) {
      count = this._countExcluded(child, count);
    }
    return count;
  }
}
