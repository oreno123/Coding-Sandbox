/**
 * @file dom/serializer/paint_order.js
 * @description Paint order based occlusion detection
 * Corresponds to browser-use/dom/serializer/paint_order.py
 */

/**
 * Rect - Represents a rectangle for occlusion calculation
 */
class Rect {
  constructor(x1, y1, x2, y2) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  area() {
    return (this.x2 - this.x1) * (this.y2 - this.y1);
  }

  intersects(other) {
    return !(
      this.x2 <= other.x1 || 
      other.x2 <= this.x1 || 
      this.y2 <= other.y1 || 
      other.y2 <= this.y1
    );
  }

  contains(other) {
    return (
      this.x1 <= other.x1 && 
      this.y1 <= other.y1 && 
      this.x2 >= other.x2 && 
      this.y2 >= other.y2
    );
  }
}

/**
 * RectUnion - Maintains a union of non-overlapping rectangles
 * Used to track which areas are already covered by opaque elements
 */
class RectUnion {
  constructor() {
    this._rects = [];
  }

  /**
   * Split rectangle 'a' by subtracting rectangle 'b'
   * Returns the remaining pieces of 'a' that don't overlap with 'b'
   */
  _splitDiff(a, b) {
    const parts = [];

    // Bottom slice (part of 'a' below 'b')
    if (a.y1 < b.y1) {
      parts.push(new Rect(a.x1, a.y1, a.x2, b.y1));
    }
    
    // Top slice (part of 'a' above 'b')
    if (b.y2 < a.y2) {
      parts.push(new Rect(a.x1, b.y2, a.x2, a.y2));
    }

    // Middle section Y bounds
    const yLo = Math.max(a.y1, b.y1);
    const yHi = Math.min(a.y2, b.y2);

    // Left slice
    if (a.x1 < b.x1) {
      parts.push(new Rect(a.x1, yLo, b.x1, yHi));
    }
    
    // Right slice
    if (b.x2 < a.x2) {
      parts.push(new Rect(b.x2, yLo, a.x2, yHi));
    }

    return parts;
  }

  /**
   * Check if rectangle 'r' is completely covered by the union
   */
  contains(r) {
    if (this._rects.length === 0) {
      return false;
    }

    // Try to "subtract" all existing rectangles from r
    // If nothing remains, r is fully covered
    let stack = [r];
    
    for (const s of this._rects) {
      const newStack = [];
      
      for (const piece of stack) {
        if (s.contains(piece)) {
          // This piece is fully covered, don't add to stack
          continue;
        }
        
        if (piece.intersects(s)) {
          // Split the piece and add remaining parts
          newStack.push(...this._splitDiff(piece, s));
        } else {
          // No overlap, keep the piece
          newStack.push(piece);
        }
      }
      
      if (newStack.length === 0) {
        // All pieces are covered
        return true;
      }
      
      stack = newStack;
    }
    
    return false;
  }

  /**
   * Add rectangle 'r' to the union
   * Returns true if 'r' added new area, false if fully covered
   */
  add(r) {
    if (this.contains(r)) {
      return false;
    }

    // Split r by existing rectangles to avoid overlap
    let pending = [r];
    
    for (const s of this._rects) {
      const newPending = [];
      
      for (const piece of pending) {
        if (piece.intersects(s)) {
          newPending.push(...this._splitDiff(piece, s));
        } else {
          newPending.push(piece);
        }
      }
      
      pending = newPending;
    }

    // Add all non-overlapping pieces
    this._rects.push(...pending);
    return true;
  }
}

/**
 * PaintOrderRemover - Removes elements that are fully occluded
 */
export class PaintOrderRemover {
  constructor(root) {
    this.root = root;
  }

  /**
   * Calculate paint order and mark occluded elements
   */
  calculate() {
    // Step 1: Collect all nodes with paint order
    const nodesWithPaintOrder = [];
    this._collectNodes(this.root, nodesWithPaintOrder);

    if (nodesWithPaintOrder.length === 0) {
      return;
    }

    // Step 2: Group by paint order
    const groupedByPaintOrder = new Map();
    for (const node of nodesWithPaintOrder) {
      const paintOrder = node.original_node.snapshot_node.paint_order;
      if (!groupedByPaintOrder.has(paintOrder)) {
        groupedByPaintOrder.set(paintOrder, []);
      }
      groupedByPaintOrder.get(paintOrder).push(node);
    }

    // Step 3: Process in descending paint order (front to back)
    const rectUnion = new RectUnion();
    const sortedPaintOrders = Array.from(groupedByPaintOrder.keys()).sort((a, b) => b - a);

    for (const paintOrder of sortedPaintOrders) {
      const nodes = groupedByPaintOrder.get(paintOrder);
      const rectsToAdd = [];

      for (const node of nodes) {
        const bounds = node.original_node.snapshot_node.bounds;
        const rect = new Rect(
          bounds.x,
          bounds.y,
          bounds.x + bounds.width,
          bounds.y + bounds.height
        );

        // Check if this element is fully covered
        if (rectUnion.contains(rect)) {
          node.ignored_by_paint_order = true;
          continue;
        }

        // Check if element is opaque (can occlude elements behind it)
        const isOpaque = this._isOpaqueElement(node);
        
        if (isOpaque) {
          rectsToAdd.push(rect);
        }
      }

      // Add opaque rectangles to union after processing the layer
      for (const rect of rectsToAdd) {
        rectUnion.add(rect);
      }
    }
  }

  /**
   * Collect all nodes with paint order information
   */
  _collectNodes(node, result) {
    if (node.original_node.snapshot_node &&
        node.original_node.snapshot_node.paint_order !== null &&
        node.original_node.snapshot_node.paint_order !== undefined &&
        node.original_node.snapshot_node.bounds !== null) {
      result.push(node);
    }

    for (const child of node.children) {
      this._collectNodes(child, result);
    }
  }

  /**
   * Check if element is opaque (can block elements behind it)
   */
  _isOpaqueElement(node) {
    const styles = node.original_node.snapshot_node?.computed_styles || {};
    
    // Check opacity
    const opacity = parseFloat(styles.opacity || '1');
    if (opacity < 0.8) {
      return false;
    }

    // Check background color
    const bgColor = styles['background-color'] || 'rgba(0, 0, 0, 0)';
    if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
      return false;
    }

    // Parse rgba to check alpha
    const rgbaMatch = bgColor.match(/rgba?\([\d.]+,\s*[\d.]+,\s*[\d.]+(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch && rgbaMatch[1] !== undefined) {
      const alpha = parseFloat(rgbaMatch[1]);
      if (alpha < 0.8) {
        return false;
      }
    }

    return true;
  }
}
