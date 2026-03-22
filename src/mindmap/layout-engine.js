import { buildForest, findTreeForNode, getDescendants } from "./tree-model";
import { updateAllEdgeSides } from "../canvas/edge-updater";
const DEFAULT_CONFIG = {
    horizontalGap: 80,
    verticalGap: 20,
    nodeWidth: 300,
    nodeHeight: 60,
    animate: true,
};
/**
 * Contour-based tree layout engine.
 * Packs sibling subtrees as tightly as possible: a node only needs
 * to clear siblings at the same depth column, not their descendants
 * in deeper columns. This eliminates wasted vertical space.
 */
export class LayoutEngine {
    constructor(config) {
        this.config = Object.assign(Object.assign({}, DEFAULT_CONFIG), config);
    }
    /**
     * Recalculate and apply layout to all trees in the canvas.
     * Each root's children are partitioned into left/right groups and
     * laid out independently, centered around their own root.
     */
    layout(canvas) {
        const forest = buildForest(canvas);
        if (forest.length === 0)
            return;
        const positions = new Map();
        for (const root of forest) {
            const rootX = root.canvasNode.x;
            const rootY = root.canvasNode.y;
            positions.set(root.canvasNode.id, { x: rootX, y: rootY });
            // Partition root's children into left/right groups
            const rightChildren = root.children.filter(c => c.direction === "right");
            const leftChildren = root.children.filter(c => c.direction === "left");
            // Layout each side independently
            this.layoutGroup(root, rightChildren, "right", rootX, rootY, positions);
            this.layoutGroup(root, leftChildren, "left", rootX, rootY, positions);
        }
        this.applyPositions(canvas, positions);
        updateAllEdgeSides(canvas);
    }
    /**
     * Partially re-layout only the children of a specific parent node
     * (and their subtrees). The parent stays in place; everything
     * outside this parent's subtree is untouched.
     */
    layoutChildren(canvas, parentNodeId) {
        const forest = buildForest(canvas);
        if (forest.length === 0)
            return;
        const parentTreeNode = findTreeForNode(forest, parentNodeId);
        if (!parentTreeNode || parentTreeNode.children.length === 0)
            return;
        const positions = new Map();
        if (!parentTreeNode.parent) {
            // Root: re-layout each side independently, centered around root
            const rightChildren = parentTreeNode.children.filter(c => c.direction === "right");
            const leftChildren = parentTreeNode.children.filter(c => c.direction === "left");
            const rootX = parentTreeNode.canvasNode.x;
            const rootY = parentTreeNode.canvasNode.y;
            this.layoutGroup(parentTreeNode, rightChildren, "right", rootX, rootY, positions);
            this.layoutGroup(parentTreeNode, leftChildren, "left", rootX, rootY, positions);
        }
        else {
            // Non-root: partition children into left/right based on actual positions
            const parentCx = parentTreeNode.canvasNode.x + parentTreeNode.canvasNode.width / 2;
            const rightChildren = parentTreeNode.children.filter(c => {
                const childCx = c.canvasNode.x + c.canvasNode.width / 2;
                return childCx >= parentCx;
            });
            const leftChildren = parentTreeNode.children.filter(c => {
                const childCx = c.canvasNode.x + c.canvasNode.width / 2;
                return childCx < parentCx;
            });
            const px = parentTreeNode.canvasNode.x;
            const py = parentTreeNode.canvasNode.y;
            this.layoutGroup(parentTreeNode, rightChildren, "right", px, py, positions);
            this.layoutGroup(parentTreeNode, leftChildren, "left", px, py, positions);
        }
        this.applyPositions(canvas, positions);
        updateAllEdgeSides(canvas);
    }
    /**
     * Restack the parent's direct children vertically on each side.
     * Each child's subtree moves as a block (preserving internal arrangement).
     * Does NOT recursively rearrange descendant positions.
     */
    restackSiblings(canvas, parentNodeId) {
        const forest = buildForest(canvas);
        const parentTreeNode = findTreeForNode(forest, parentNodeId);
        if (!parentTreeNode || parentTreeNode.children.length === 0)
            return;
        const parentCx = parentTreeNode.canvasNode.x + parentTreeNode.canvasNode.width / 2;
        const parentCy = parentTreeNode.canvasNode.y + parentTreeNode.canvasNode.height / 2;
        // Partition children by side
        const rightChildren = parentTreeNode.children.filter(c => {
            const cx = c.canvasNode.x + c.canvasNode.width / 2;
            return cx >= parentCx;
        });
        const leftChildren = parentTreeNode.children.filter(c => {
            const cx = c.canvasNode.x + c.canvasNode.width / 2;
            return cx < parentCx;
        });
        this.restackGroup(canvas, rightChildren, parentCy);
        this.restackGroup(canvas, leftChildren, parentCy);
        updateAllEdgeSides(canvas);
        canvas.requestSave();
        canvas.requestFrame();
    }
    /**
     * Restack a group of siblings vertically, centered on parentCy.
     * Each sibling's subtree is block-moved (internal structure preserved).
     */
    restackGroup(canvas, children, parentCy) {
        if (children.length === 0)
            return;
        // Sort by current Y position
        const sorted = [...children].sort((a, b) => a.canvasNode.y - b.canvasNode.y);
        // Compute subtree bounding box for each child
        const bboxes = sorted.map(child => {
            const descendants = getDescendants(child);
            const allNodes = [child, ...descendants];
            let minY = Infinity;
            let maxY = -Infinity;
            for (const n of allNodes) {
                const top = n.canvasNode.y;
                const bottom = top + n.canvasNode.height;
                if (top < minY)
                    minY = top;
                if (bottom > maxY)
                    maxY = bottom;
            }
            return { child, descendants, minY, maxY, height: maxY - minY };
        });
        // Total height with gaps
        const totalHeight = bboxes.reduce((sum, b) => sum + b.height, 0)
            + (bboxes.length - 1) * this.config.verticalGap;
        // Starting Y to center the block around parentCy
        let currentY = parentCy - totalHeight / 2;
        // Apply positions
        for (const bbox of bboxes) {
            const deltaY = currentY - bbox.minY;
            if (deltaY !== 0) {
                bbox.child.canvasNode.moveTo({
                    x: bbox.child.canvasNode.x,
                    y: bbox.child.canvasNode.y + deltaY,
                });
                for (const desc of bbox.descendants) {
                    desc.canvasNode.moveTo({
                        x: desc.canvasNode.x,
                        y: desc.canvasNode.y + deltaY,
                    });
                }
            }
            currentY += bbox.height + this.config.verticalGap;
        }
    }
    /**
     * Layout a group of same-side children, vertically centered around root.
     * Uses contour-based packing for compact spacing.
     */
    layoutGroup(root, children, direction, rootX, rootY, positions) {
        if (children.length === 0)
            return;
        const rootH = root.canvasNode.height || this.config.nodeHeight;
        const rootW = root.canvasNode.width || this.config.nodeWidth;
        const rootCenterY = rootY + rootH / 2;
        // Layout each child subtree independently at y=0
        const subtrees = [];
        for (const child of children) {
            const childW = child.canvasNode.width || this.config.nodeWidth;
            const childX = direction === "right"
                ? rootX + rootW + this.config.horizontalGap
                : rootX - childW - this.config.horizontalGap;
            const tempPositions = new Map();
            const contour = this.layoutSubtree(child, childX, 0, 0, direction, tempPositions);
            subtrees.push({ positions: tempPositions, contour });
        }
        // Pack subtrees tightly using contour comparison
        const { yOffsets } = this.packSubtrees(subtrees);
        // Center the direct-children block around root's vertical center
        const lastIdx = children.length - 1;
        const lastChildH = children[lastIdx].canvasNode.height || this.config.nodeHeight;
        const blockTop = yOffsets[0];
        const blockBottom = yOffsets[lastIdx] + lastChildH;
        const globalShift = rootCenterY - (blockTop + blockBottom) / 2;
        // Apply shift and merge into final positions
        for (let i = 0; i < subtrees.length; i++) {
            const yShift = yOffsets[i] + globalShift;
            for (const [id, pos] of subtrees[i].positions) {
                positions.set(id, { x: pos.x, y: pos.y + yShift });
            }
        }
    }
    /**
     * Recursively lay out a node and all its descendants.
     * Returns the contour (vertical extent per depth column).
     */
    layoutSubtree(node, nodeX, nodeY, depth, direction, positions) {
        const nodeH = node.canvasNode.height || this.config.nodeHeight;
        const nodeW = node.canvasNode.width || this.config.nodeWidth;
        positions.set(node.canvasNode.id, { x: nodeX, y: nodeY });
        const contour = new Map();
        contour.set(depth, { top: nodeY, bottom: nodeY + nodeH });
        if (node.children.length === 0)
            return contour;
        // Layout each child subtree independently at y=0
        const childSubtrees = [];
        for (const child of node.children) {
            const childW = child.canvasNode.width || this.config.nodeWidth;
            const childX = direction === "right"
                ? nodeX + nodeW + this.config.horizontalGap
                : nodeX - childW - this.config.horizontalGap;
            const tempPositions = new Map();
            const childContour = this.layoutSubtree(child, childX, 0, depth + 1, direction, tempPositions);
            childSubtrees.push({ positions: tempPositions, contour: childContour });
        }
        // Pack child subtrees tightly
        const { yOffsets, combinedContour } = this.packSubtrees(childSubtrees);
        // Center children block around this node's vertical center
        const lastIdx = node.children.length - 1;
        const lastChildH = node.children[lastIdx].canvasNode.height || this.config.nodeHeight;
        const blockTop = yOffsets[0];
        const blockBottom = yOffsets[lastIdx] + lastChildH;
        const centerShift = (nodeY + nodeH / 2) - (blockTop + blockBottom) / 2;
        // Apply offsets and merge child positions
        for (let i = 0; i < childSubtrees.length; i++) {
            const yShift = yOffsets[i] + centerShift;
            for (const [id, pos] of childSubtrees[i].positions) {
                positions.set(id, { x: pos.x, y: pos.y + yShift });
            }
        }
        // Merge shifted children contour into this node's contour
        for (const [d, ext] of combinedContour) {
            const shifted = { top: ext.top + centerShift, bottom: ext.bottom + centerShift };
            const existing = contour.get(d);
            if (existing) {
                if (shifted.top < existing.top)
                    existing.top = shifted.top;
                if (shifted.bottom > existing.bottom)
                    existing.bottom = shifted.bottom;
            }
            else {
                contour.set(d, Object.assign({}, shifted));
            }
        }
        return contour;
    }
    /**
     * Pack an array of subtrees vertically using contour comparison.
     * First subtree stays at y=0; each subsequent one is shifted down
     * just enough to clear the combined contour at all shared depths.
     */
    packSubtrees(subtrees) {
        if (subtrees.length === 0) {
            return { yOffsets: [], combinedContour: new Map() };
        }
        const yOffsets = [0];
        // Clone first subtree's contour as the combined baseline
        const combinedContour = new Map();
        for (const [d, ext] of subtrees[0].contour) {
            combinedContour.set(d, { top: ext.top, bottom: ext.bottom });
        }
        for (let i = 1; i < subtrees.length; i++) {
            const sub = subtrees[i];
            // Find minimum Y-shift so this subtree clears combined at all shared depths
            let shift = 0;
            for (const [d, ext] of sub.contour) {
                const prev = combinedContour.get(d);
                if (prev !== undefined) {
                    const needed = prev.bottom + this.config.verticalGap - ext.top;
                    if (needed > shift)
                        shift = needed;
                }
            }
            yOffsets.push(shift);
            // Merge shifted contour into combined
            for (const [d, ext] of sub.contour) {
                const shifted = { top: ext.top + shift, bottom: ext.bottom + shift };
                const existing = combinedContour.get(d);
                if (existing) {
                    if (shifted.top < existing.top)
                        existing.top = shifted.top;
                    if (shifted.bottom > existing.bottom)
                        existing.bottom = shifted.bottom;
                }
                else {
                    combinedContour.set(d, Object.assign({}, shifted));
                }
            }
        }
        return { yOffsets, combinedContour };
    }
    /**
     * Apply calculated positions to canvas nodes.
     */
    applyPositions(canvas, positions) {
        var _a;
        for (const [nodeId, pos] of positions) {
            const node = canvas.nodes.get(nodeId);
            if (!node)
                continue;
            if (this.config.animate) {
                (_a = node.nodeEl) === null || _a === void 0 ? void 0 : _a.addClass("mindmap-animating");
            }
            node.moveTo({ x: pos.x, y: pos.y });
        }
        canvas.requestSave();
        canvas.requestFrame();
        // Remove animation class after transition completes
        if (this.config.animate) {
            setTimeout(() => {
                var _a;
                for (const node of canvas.nodes.values()) {
                    (_a = node.nodeEl) === null || _a === void 0 ? void 0 : _a.removeClass("mindmap-animating");
                }
            }, 350);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5b3V0LWVuZ2luZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxheW91dC1lbmdpbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLFdBQVcsRUFBRSxlQUFlLEVBQUUsY0FBYyxFQUE2QixNQUFNLGNBQWMsQ0FBQztBQUN2RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQVU1RCxNQUFNLGNBQWMsR0FBaUI7SUFDcEMsYUFBYSxFQUFFLEVBQUU7SUFDakIsV0FBVyxFQUFFLEVBQUU7SUFDZixTQUFTLEVBQUUsR0FBRztJQUNkLFVBQVUsRUFBRSxFQUFFO0lBQ2QsT0FBTyxFQUFFLElBQUk7Q0FDYixDQUFDO0FBc0JGOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFPLFlBQVk7SUFHeEIsWUFBWSxNQUE4QjtRQUN6QyxJQUFJLENBQUMsTUFBTSxtQ0FBUSxjQUFjLEdBQUssTUFBTSxDQUFFLENBQUM7SUFDaEQsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxNQUFNLENBQUMsTUFBYztRQUNwQixNQUFNLE1BQU0sR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbkMsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUM7WUFBRSxPQUFPO1FBRWhDLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUF3QixDQUFDO1FBRWxELEtBQUssTUFBTSxJQUFJLElBQUksTUFBTSxFQUFFLENBQUM7WUFDM0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDaEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDaEMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7WUFFMUQsbURBQW1EO1lB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Q0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO29CQUMxQyxNQUFBLElBQUksQ0FBQyxNQUFNLDBDQUFFLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO2dCQUMvQyxDQUFDO1lBQ0YsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ1QsQ0FBQztJQUNGLENBQUM7Q0FDRCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgQ2FudmFzIH0gZnJvbSBcIi4uL3R5cGVzL2NhbnZhcy1pbnRlcm5hbFwiO1xuaW1wb3J0IHsgYnVpbGRGb3Jlc3QsIGZpbmRUcmVlRm9yTm9kZSwgZ2V0RGVzY2VuZGFudHMsIFRyZWVOb2RlLCBCcmFuY2hEaXJlY3Rpb24gfSBmcm9tIFwiLi90cmVlLW1vZGVsXCI7XG5pbXBvcnQgeyB1cGRhdGVBbGxFZGdlU2lkZXMgfSBmcm9tIFwiLi4vY2FudmFzL2VkZ2UtdXBkYXRlclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIExheW91dENvbmZpZyB7XG5cdGhvcml6b250YWxHYXA6IG51bWJlcjtcblx0dmVydGljYWxHYXA6IG51bWJlcjtcblx0bm9kZVdpZHRoOiBudW1iZXI7XG5cdG5vZGVIZWlnaHQ6IG51bWJlcjtcblx0YW5pbWF0ZTogYm9vbGVhbjtcbn1cblxuY29uc3QgREVGQVVMVF9DT05GSUc6IExheW91dENvbmZpZyA9IHtcblx0aG9yaXpvbnRhbEdhcDogODAsXG5cdHZlcnRpY2FsR2FwOiAyMCxcblx0bm9kZVdpZHRoOiAzMDAsXG5cdG5vZGVIZWlnaHQ6IDYwLFxuXHRhbmltYXRlOiB0cnVlLFxufTtcblxuaW50ZXJmYWNlIE5vZGVQb3NpdGlvbiB7XG5cdHg6IG51bWJlcjtcblx0eTogbnVtYmVyO1xufVxuXG4vKiogVmVydGljYWwgZXh0ZW50IGF0IGEgZ2l2ZW4gZGVwdGggY29sdW1uLiAqL1xuaW50ZXJmYWNlIERlcHRoRXh0ZW50IHtcblx0dG9wOiBudW1iZXI7XG5cdGJvdHRvbTogbnVtYmVyO1xufVxuXG4vKiogTWFwcyBkZXB0aCDihpIgdmVydGljYWwgZXh0ZW50LiBVc2VkIHRvIHBhY2sgc2libGluZyBzdWJ0cmVlcyB0aWdodGx5LiAqL1xudHlwZSBDb250b3VyID0gTWFwPG51bWJlciwgRGVwdGhFeHRlbnQ+O1xuXG4vKiogQSBzdWJ0cmVlJ3MgbGF5b3V0IHJlc3VsdDogcG9zaXRpb25zIGFuZCBjb250b3VyLiAqL1xuaW50ZXJmYWNlIFN1YnRyZWVJbmZvIHtcblx0cG9zaXRpb25zOiBNYXA8c3RyaW5nLCBOb2RlUG9zaXRpb24+O1xuXHRjb250b3VyOiBDb250b3VyO1xufVxuXG4vKipcbiAqIENvbnRvdXItYmFzZWQgdHJlZSBsYXlvdXQgZW5naW5lLlxuICogUGFja3Mgc2libGluZyBzdWJ0cmVlcyBhcyB0aWdodGx5IGFzIHBvc3NpYmxlOiBhIG5vZGUgb25seSBuZWVkc1xuICogdG8gY2xlYXIgc2libGluZ3MgYXQgdGhlIHNhbWUgZGVwdGggY29sdW1uLCBub3QgdGhlaXIgZGVzY2VuZGFudHNcbiAqIGluIGRlZXBlciBjb2x1bW5zLiBUaGlzIGVsaW1pbmF0ZXMgd2FzdGVkIHZlcnRpY2FsIHNwYWNlLlxuICovXG5leHBvcnQgY2xhc3MgTGF5b3V0RW5naW5lIHtcblx0cHJpdmF0ZSBjb25maWc6IExheW91dENvbmZpZztcblxuXHRjb25zdHJ1Y3Rvcihjb25maWc/OiBQYXJ0aWFsPExheW91dENvbmZpZz4pIHtcblx0XHR0aGlzLmNvbmZpZyA9IHsgLi4uREVGQVVMVF9DT05GSUcsIC4uLmNvbmZpZyB9O1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlY2FsY3VsYXRlIGFuZCBhcHBseSBsYXlvdXQgdG8gYWxsIHRyZWVzIGluIHRoZSBjYW52YXMuXG5cdCAqIEVhY2ggcm9vdCdzIGNoaWxkcmVuIGFyZSBwYXJ0aXRpb25lZCBpbnRvIGxlZnQvcmlnaHQgZ3JvdXBzIGFuZFxuXHQgKiBsYWlkIG91dCBpbmRlcGVuZGVudGx5LCBjZW50ZXJlZCBhcm91bmQgdGhlaXIgb3duIHJvb3QuXG5cdCAqL1xuXHRsYXlvdXQoY2FudmFzOiBDYW52YXMpOiB2b2lkIHtcblx0XHRjb25zdCBmb3Jlc3QgPSBidWlsZEZvcmVzdChjYW52YXMpO1xuXHRcdGlmIChmb3Jlc3QubGVuZ3RoID09PSAwKSByZXR1cm47XG5cblx0XHRjb25zdCBwb3NpdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgTm9kZVBvc2l0aW9uPigpO1xuXG5cdFx0Zm9yIChjb25zdCByb290IG9mIGZvcmVzdCkge1xuXHRcdFx0Y29uc3Qgcm9vdFggPSByb290LmNhbnZhc05vZGUueDtcblx0XHRcdGNvbnN0IHJvb3RZID0gcm9vdC5jYW52YXNOb2RlLnk7XG5cdFx0XHRwb3NpdGlvbnMuc2V0KHJvb3QuY2FudmFzTm9kZS5pZCwgeyB4OiByb290WCwgeTogcm9vdFkgfSk7XG5cblx0XHRcdC8vIFBhcnRpdGlvbiByb290J3MgY2hpbGRyZW4gaW50byBsZWZ0L3JpZ2h0IGdyb3Vwc1xuXHRcdFx0Y29uc3QgcmlnaHRDaGlsZHJlbiA9IHJvb3QuY2hpbGRyZW4uZmlsdGVyKGMgPT4gYy5kaXJlY3Rpb24gPT09IFwicmlnaHRcIik7XG5cdFx0XHRjb25zdCBsZWZ0Q2hpbGRyZW4gPSByb290LmNoaWxkcmVuLmZpbHRlcihjID0+IGMuZGlyZWN0aW9uID09PSBcImxlZnRcIik7XG5cblx0XHRcdC8vIExheW91dCBlYWNoIHNpZGUgaW5kZXBlbmRlbnRseVxuXHRcdFx0dGhpcy5sYXlvdXRHcm91cChyb290LCByaWdodENoaWxkcmVuLCBcInJpZ2h0XCIsIHJvb3RYLCByb290WSwgcG9zaXRpb25zKTtcblx0XHRcdHRoaXMubGF5b3V0R3JvdXAocm9vdCwgbGVmdENoaWxkcmVuLCBcImxlZnRcIiwgcm9vdFgsIHJvb3RZLCBwb3NpdGlvbnMpO1xuXHRcdH1cblxuXHRcdHRoaXMuYXBwbHlQb3NpdGlvbnMoY2FudmFzLCBwb3NpdGlvbnMpO1xuXHRcdHVwZGF0ZUFsbEVkZ2VTaWRlcyhjYW52YXMpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFBhcnRpYWxseSByZS1sYXlvdXQgb25seSB0aGUgY2hpbGRyZW4gb2YgYSBzcGVjaWZpYyBwYXJlbnQgbm9kZVxuXHQgKiAoYW5kIHRoZWlyIHN1YnRyZWVzKS4gVGhlIHBhcmVudCBzdGF5cyBpbiBwbGFjZTsgZXZlcnl0aGluZ1xuXHQgKiBvdXRzaWRlIHRoaXMgcGFyZW50J3Mgc3VidHJlZSBpcyB1bnRvdWNoZWQuXG5cdCAqL1xuXHRsYXlvdXRDaGlsZHJlbihjYW52YXM6IENhbnZhcywgcGFyZW50Tm9kZUlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBmb3Jlc3QgPSBidWlsZEZvcmVzdChjYW52YXMpO1xuXHRcdGlmIChmb3Jlc3QubGVuZ3RoID09PSAwKSByZXR1cm47XG5cblx0XHRjb25zdCBwYXJlbnRUcmVlTm9kZSA9IGZpbmRUcmVlRm9yTm9kZShmb3Jlc3QsIHBhcmVudE5vZGVJZCk7XG5cdFx0aWYgKCFwYXJlbnRUcmVlTm9kZSB8fCBwYXJlbnRUcmVlTm9kZS5jaGlsZHJlbi5sZW5ndGggPT09IDApIHJldHVybjtcblxuXHRcdGNvbnN0IHBvc2l0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBOb2RlUG9zaXRpb24+KCk7XG5cblx0XHRpZiAoIXBhcmVudFRyZWVOb2RlLnBhcmVudCkge1xuXHRcdFx0Ly8gUm9vdDogcmUtbGF5b3V0IGVhY2ggc2lkZSBpbmRlcGVuZGVudGx5LCBjZW50ZXJlZCBhcm91bmQgcm9vdFxuXHRcdFx0Y29uc3QgcmlnaHRDaGlsZHJlbiA9IHBhcmVudFRyZWVOb2RlLmNoaWxkcmVuLmZpbHRlcihjID0+IGMuZGlyZWN0aW9uID09PSBcInJpZ2h0XCIpO1xuXHRcdFx0Y29uc3QgbGVmdENoaWxkcmVuID0gcGFyZW50VHJlZU5vZGUuY2hpbGRyZW4uZmlsdGVyKGMgPT4gYy5kaXJlY3Rpb24gPT09IFwibGVmdFwiKTtcblx0XHRcdGNvbnN0IHJvb3RYID0gcGFyZW50VHJlZU5vZGUuY2FudmFzTm9kZS54O1xuXHRcdFx0Y29uc3Qgcm9vdFkgPSBwYXJlbnRUcmVlTm9kZS5jYW52YXNOb2RlLnk7XG5cdFx0XHR0aGlzLmxheW91dEdyb3VwKHBhcmVudFRyZWVOb2RlLCByaWdodENoaWxkcmVuLCBcInJpZ2h0XCIsIHJvb3RYLCByb290WSwgcG9zaXRpb25zKTtcblx0XHRcdHRoaXMubGF5b3V0R3JvdXAocGFyZW50VHJlZU5vZGUsIGxlZnRDaGlsZHJlbiwgXCJsZWZ0XCIsIHJvb3RYLCByb290WSwgcG9zaXRpb25zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gTm9uLXJvb3Q6IHBhcnRpdGlvbiBjaGlsZHJlbiBpbnRvIGxlZnQvcmlnaHQgYmFzZWQgb24gYWN0dWFsIHBvc2l0aW9uc1xuXHRcdFx0Y29uc3QgcGFyZW50Q3ggPSBwYXJlbnRUcmVlTm9kZS5jYW52YXNOb2RlLnggKyBwYXJlbnRUcmVlTm9kZS5jYW52YXNOb2RlLndpZHRoIC8gMjtcblx0XHRcdGNvbnN0IHJpZ2h0Q2hpbGRyZW4gPSBwYXJlbnRUcmVlTm9kZS5jaGlsZHJlbi5maWx0ZXIoYyA9PiB7XG5cdFx0XHRcdGNvbnN0IGNoaWxkQ3ggPSBjLmNhbnZhc05vZGUueCArIGMuY2FudmFzTm9kZS53aWR0aCAvIDI7XG5cdFx0XHRcdHJldHVybiBjaGlsZEN4ID49IHBhcmVudEN4O1xuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBsZWZ0Q2hpbGRyZW4gPSBwYXJlbnRUcmVlTm9kZS5jaGlsZHJlbi5maWx0ZXIoYyA9PiB7XG5cdFx0XHRcdGNvbnN0IGNoaWxkQ3ggPSBjLmNhbnZhc05vZGUueCArIGMuY2FudmFzTm9kZS53aWR0aCAvIDI7XG5cdFx0XHRcdHJldHVybiBjaGlsZEN4IDwgcGFyZW50Q3g7XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IHB4ID0gcGFyZW50VHJlZU5vZGUuY2FudmFzTm9kZS54O1xuXHRcdFx0Y29uc3QgcHkgPSBwYXJlbnRUcmVlTm9kZS5jYW52YXNOb2RlLnk7XG5cdFx0XHR0aGlzLmxheW91dEdyb3VwKHBhcmVudFRyZWVOb2RlLCByaWdodENoaWxkcmVuLCBcInJpZ2h0XCIsIHB4LCBweSwgcG9zaXRpb25zKTtcblx0XHRcdHRoaXMubGF5b3V0R3JvdXAocGFyZW50VHJlZU5vZGUsIGxlZnRDaGlsZHJlbiwgXCJsZWZ0XCIsIHB4LCBweSwgcG9zaXRpb25zKTtcblx0XHR9XG5cblx0XHR0aGlzLmFwcGx5UG9zaXRpb25zKGNhbnZhcywgcG9zaXRpb25zKTtcblx0XHR1cGRhdGVBbGxFZGdlU2lkZXMoY2FudmFzKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXN0YWNrIHRoZSBwYXJlbnQncyBkaXJlY3QgY2hpbGRyZW4gdmVydGljYWxseSBvbiBlYWNoIHNpZGUuXG5cdCAqIEVhY2ggY2hpbGQncyBzdWJ0cmVlIG1vdmVzIGFzIGEgYmxvY2sgKHByZXNlcnZpbmcgaW50ZXJuYWwgYXJyYW5nZW1lbnQpLlxuXHQgKiBEb2VzIE5PVCByZWN1cnNpdmVseSByZWFycmFuZ2UgZGVzY2VuZGFudCBwb3NpdGlvbnMuXG5cdCAqL1xuXHRyZXN0YWNrU2libGluZ3MoY2FudmFzOiBDYW52YXMsIHBhcmVudE5vZGVJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgZm9yZXN0ID0gYnVpbGRGb3Jlc3QoY2FudmFzKTtcblx0XHRjb25zdCBwYXJlbnRUcmVlTm9kZSA9IGZpbmRUcmVlRm9yTm9kZShmb3Jlc3QsIHBhcmVudE5vZGVJZCk7XG5cdFx0aWYgKCFwYXJlbnRUcmVlTm9kZSB8fCBwYXJlbnRUcmVlTm9kZS5jaGlsZHJlbi5sZW5ndGggPT09IDApIHJldHVybjtcblxuXHRcdGNvbnN0IHBhcmVudEN4ID0gcGFyZW50VHJlZU5vZGUuY2FudmFzTm9kZS54ICsgcGFyZW50VHJlZU5vZGUuY2FudmFzTm9kZS53aWR0aCAvIDI7XG5cdFx0Y29uc3QgcGFyZW50Q3kgPSBwYXJlbnRUcmVlTm9kZS5jYW52YXNOb2RlLnkgKyBwYXJlbnRUcmVlTm9kZS5jYW52YXNOb2RlLmhlaWdodCAvIDI7XG5cblx0XHQvLyBQYXJ0aXRpb24gY2hpbGRyZW4gYnkgc2lkZVxuXHRcdGNvbnN0IHJpZ2h0Q2hpbGRyZW4gPSBwYXJlbnRUcmVlTm9kZS5jaGlsZHJlbi5maWx0ZXIoYyA9PiB7XG5cdFx0XHRjb25zdCBjeCA9IGMuY2FudmFzTm9kZS54ICsgYy5jYW52YXNOb2RlLndpZHRoIC8gMjtcblx0XHRcdHJldHVybiBjeCA+PSBwYXJlbnRDeDtcblx0XHR9KTtcblx0XHRjb25zdCBsZWZ0Q2hpbGRyZW4gPSBwYXJlbnRUcmVlTm9kZS5jaGlsZHJlbi5maWx0ZXIoYyA9PiB7XG5cdFx0XHRjb25zdCBjeCA9IGMuY2FudmFzTm9kZS54ICsgYy5jYW52YXNOb2RlLndpZHRoIC8gMjtcblx0XHRcdHJldHVybiBjeCA8IHBhcmVudEN4O1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZXN0YWNrR3JvdXAoY2FudmFzLCByaWdodENoaWxkcmVuLCBwYXJlbnRDeSk7XG5cdFx0dGhpcy5yZXN0YWNrR3JvdXAoY2FudmFzLCBsZWZ0Q2hpbGRyZW4sIHBhcmVudEN5KTtcblxuXHRcdHVwZGF0ZUFsbEVkZ2VTaWRlcyhjYW52YXMpO1xuXHRcdGNhbnZhcy5yZXF1ZXN0U2F2ZSgpO1xuXHRcdGNhbnZhcy5yZXF1ZXN0RnJhbWUoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXN0YWNrIGEgZ3JvdXAgb2Ygc2libGluZ3MgdmVydGljYWxseSwgY2VudGVyZWQgb24gcGFyZW50Q3kuXG5cdCAqIEVhY2ggc2libGluZydzIHN1YnRyZWUgaXMgYmxvY2stbW92ZWQgKGludGVybmFsIHN0cnVjdHVyZSBwcmVzZXJ2ZWQpLlxuXHQgKi9cblx0cHJpdmF0ZSByZXN0YWNrR3JvdXAoXG5cdFx0Y2FudmFzOiBDYW52YXMsXG5cdFx0Y2hpbGRyZW46IFRyZWVOb2RlW10sXG5cdFx0cGFyZW50Q3k6IG51bWJlclxuXHQpOiB2b2lkIHtcblx0XHRpZiAoY2hpbGRyZW4ubGVuZ3RoID09PSAwKSByZXR1cm47XG5cblx0XHQvLyBTb3J0IGJ5IGN1cnJlbnQgWSBwb3NpdGlvblxuXHRcdGNvbnN0IHNvcnRlZCA9IFsuLi5jaGlsZHJlbl0uc29ydChcblx0XHRcdChhLCBiKSA9PiBhLmNhbnZhc05vZGUueSAtIGIuY2FudmFzTm9kZS55XG5cdFx0KTtcblxuXHRcdC8vIENvbXB1dGUgc3VidHJlZSBib3VuZGluZyBib3ggZm9yIGVhY2ggY2hpbGRcblx0XHRjb25zdCBiYm94ZXMgPSBzb3J0ZWQubWFwKGNoaWxkID0+IHtcblx0XHRcdGNvbnN0IGRlc2NlbmRhbnRzID0gZ2V0RGVzY2VuZGFudHMoY2hpbGQpO1xuXHRcdFx0Y29uc3QgYWxsTm9kZXMgPSBbY2hpbGQsIC4uLmRlc2NlbmRhbnRzXTtcblx0XHRcdGxldCBtaW5ZID0gSW5maW5pdHk7XG5cdFx0XHRsZXQgbWF4WSA9IC1JbmZpbml0eTtcblx0XHRcdGZvciAoY29uc3QgbiBvZiBhbGxOb2Rlcykge1xuXHRcdFx0XHRjb25zdCB0b3AgPSBuLmNhbnZhc05vZGUueTtcblx0XHRcdFx0Y29uc3QgYm90dG9tID0gdG9wICsgbi5jYW52YXNOb2RlLmhlaWdodDtcblx0XHRcdFx0aWYgKHRvcCA8IG1pblkpIG1pblkgPSB0b3A7XG5cdFx0XHRcdGlmIChib3R0b20gPiBtYXhZKSBtYXhZID0gYm90dG9tO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHsgY2hpbGQsIGRlc2NlbmRhbnRzLCBtaW5ZLCBtYXhZLCBoZWlnaHQ6IG1heFkgLSBtaW5ZIH07XG5cdFx0fSk7XG5cblx0XHQvLyBUb3RhbCBoZWlnaHQgd2l0aCBnYXBzXG5cdFx0Y29uc3QgdG90YWxIZWlnaHQgPSBiYm94ZXMucmVkdWNlKChzdW0sIGIpID0+IHN1bSArIGIuaGVpZ2h0LCAwKVxuXHRcdFx0KyAoYmJveGVzLmxlbmd0aCAtIDEpICogdGhpcy5jb25maWcudmVydGljYWxHYXA7XG5cblx0XHQvLyBTdGFydGluZyBZIHRvIGNlbnRlciB0aGUgYmxvY2sgYXJvdW5kIHBhcmVudEN5XG5cdFx0bGV0IGN1cnJlbnRZID0gcGFyZW50Q3kgLSB0b3RhbEhlaWdodCAvIDI7XG5cblx0XHQvLyBBcHBseSBwb3NpdGlvbnNcblx0XHRmb3IgKGNvbnN0IGJib3ggb2YgYmJveGVzKSB7XG5cdFx0XHRjb25zdCBkZWx0YVkgPSBjdXJyZW50WSAtIGJib3gubWluWTtcblx0XHRcdGlmIChkZWx0YVkgIT09IDApIHtcblx0XHRcdFx0YmJveC5jaGlsZC5jYW52YXNOb2RlLm1vdmVUbyh7XG5cdFx0XHRcdFx0eDogYmJveC5jaGlsZC5jYW52YXNOb2RlLngsXG5cdFx0XHRcdFx0eTogYmJveC5jaGlsZC5jYW52YXNOb2RlLnkgKyBkZWx0YVksXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGRlc2Mgb2YgYmJveC5kZXNjZW5kYW50cykge1xuXHRcdFx0XHRcdGRlc2MuY2FudmFzTm9kZS5tb3ZlVG8oe1xuXHRcdFx0XHRcdFx0eDogZGVzYy5jYW52YXNOb2RlLngsXG5cdFx0XHRcdFx0XHR5OiBkZXNjLmNhbnZhc05vZGUueSArIGRlbHRhWSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y3VycmVudFkgKz0gYmJveC5oZWlnaHQgKyB0aGlzLmNvbmZpZy52ZXJ0aWNhbEdhcDtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogTGF5b3V0IGEgZ3JvdXAgb2Ygc2FtZS1zaWRlIGNoaWxkcmVuLCB2ZXJ0aWNhbGx5IGNlbnRlcmVkIGFyb3VuZCByb290LlxuXHQgKiBVc2VzIGNvbnRvdXItYmFzZWQgcGFja2luZyBmb3IgY29tcGFjdCBzcGFjaW5nLlxuXHQgKi9cblx0cHJpdmF0ZSBsYXlvdXRHcm91cChcblx0XHRyb290OiBUcmVlTm9kZSxcblx0XHRjaGlsZHJlbjogVHJlZU5vZGVbXSxcblx0XHRkaXJlY3Rpb246IEJyYW5jaERpcmVjdGlvbixcblx0XHRyb290WDogbnVtYmVyLFxuXHRcdHJvb3RZOiBudW1iZXIsXG5cdFx0cG9zaXRpb25zOiBNYXA8c3RyaW5nLCBOb2RlUG9zaXRpb24+XG5cdCk6IHZvaWQge1xuXHRcdGlmIChjaGlsZHJlbi5sZW5ndGggPT09IDApIHJldHVybjtcblxuXHRcdGNvbnN0IHJvb3RIID0gcm9vdC5jYW52YXNOb2RlLmhlaWdodCB8fCB0aGlzLmNvbmZpZy5ub2RlSGVpZ2h0O1xuXHRcdGNvbnN0IHJvb3RXID0gcm9vdC5jYW52YXNOb2RlLndpZHRoIHx8IHRoaXMuY29uZmlnLm5vZGVXaWR0aDtcblx0XHRjb25zdCByb290Q2VudGVyWSA9IHJvb3RZICsgcm9vdEggLyAyO1xuXG5cdFx0Ly8gTGF5b3V0IGVhY2ggY2hpbGQgc3VidHJlZSBpbmRlcGVuZGVudGx5IGF0IHk9MFxuXHRcdGNvbnN0IHN1YnRyZWVzOiBTdWJ0cmVlSW5mb1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBjaGlsZHJlbikge1xuXHRcdFx0Y29uc3QgY2hpbGRXID0gY2hpbGQuY2FudmFzTm9kZS53aWR0aCB8fCB0aGlzLmNvbmZpZy5ub2RlV2lkdGg7XG5cdFx0XHRjb25zdCBjaGlsZFggPSBkaXJlY3Rpb24gPT09IFwicmlnaHRcIlxuXHRcdFx0XHQ/IHJvb3RYICsgcm9vdFcgKyB0aGlzLmNvbmZpZy5ob3Jpem9udGFsR2FwXG5cdFx0XHRcdDogcm9vdFggLSBjaGlsZFcgLSB0aGlzLmNvbmZpZy5ob3Jpem9udGFsR2FwO1xuXG5cdFx0XHRjb25zdCB0ZW1wUG9zaXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIE5vZGVQb3NpdGlvbj4oKTtcblx0XHRcdGNvbnN0IGNvbnRvdXIgPSB0aGlzLmxheW91dFN1YnRyZWUoXG5cdFx0XHRcdGNoaWxkLCBjaGlsZFgsIDAsIDAsIGRpcmVjdGlvbiwgdGVtcFBvc2l0aW9uc1xuXHRcdFx0KTtcblx0XHRcdHN1YnRyZWVzLnB1c2goeyBwb3NpdGlvbnM6IHRlbXBQb3NpdGlvbnMsIGNvbnRvdXIgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gUGFjayBzdWJ0cmVlcyB0aWdodGx5IHVzaW5nIGNvbnRvdXIgY29tcGFyaXNvblxuXHRcdGNvbnN0IHsgeU9mZnNldHMgfSA9IHRoaXMucGFja1N1YnRyZWVzKHN1YnRyZWVzKTtcblxuXHRcdC8vIENlbnRlciB0aGUgZGlyZWN0LWNoaWxkcmVuIGJsb2NrIGFyb3VuZCByb290J3MgdmVydGljYWwgY2VudGVyXG5cdFx0Y29uc3QgbGFzdElkeCA9IGNoaWxkcmVuLmxlbmd0aCAtIDE7XG5cdFx0Y29uc3QgbGFzdENoaWxkSCA9IGNoaWxkcmVuW2xhc3RJZHhdLmNhbnZhc05vZGUuaGVpZ2h0IHx8IHRoaXMuY29uZmlnLm5vZGVIZWlnaHQ7XG5cdFx0Y29uc3QgYmxvY2tUb3AgPSB5T2Zmc2V0c1swXTtcblx0XHRjb25zdCBibG9ja0JvdHRvbSA9IHlPZmZzZXRzW2xhc3RJZHhdICsgbGFzdENoaWxkSDtcblx0XHRjb25zdCBnbG9iYWxTaGlmdCA9IHJvb3RDZW50ZXJZIC0gKGJsb2NrVG9wICsgYmxvY2tCb3R0b20pIC8gMjtcblxuXHRcdC8vIEFwcGx5IHNoaWZ0IGFuZCBtZXJnZSBpbnRvIGZpbmFsIHBvc2l0aW9uc1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc3VidHJlZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IHlTaGlmdCA9IHlPZmZzZXRzW2ldICsgZ2xvYmFsU2hpZnQ7XG5cdFx0XHRmb3IgKGNvbnN0IFtpZCwgcG9zXSBvZiBzdWJ0cmVlc1tpXS5wb3NpdGlvbnMpIHtcblx0XHRcdFx0cG9zaXRpb25zLnNldChpZCwgeyB4OiBwb3MueCwgeTogcG9zLnkgKyB5U2hpZnQgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlY3Vyc2l2ZWx5IGxheSBvdXQgYSBub2RlIGFuZCBhbGwgaXRzIGRlc2NlbmRhbnRzLlxuXHQgKiBSZXR1cm5zIHRoZSBjb250b3VyICh2ZXJ0aWNhbCBleHRlbnQgcGVyIGRlcHRoIGNvbHVtbikuXG5cdCAqL1xuXHRwcml2YXRlIGxheW91dFN1YnRyZWUoXG5cdFx0bm9kZTogVHJlZU5vZGUsXG5cdFx0bm9kZVg6IG51bWJlcixcblx0XHRub2RlWTogbnVtYmVyLFxuXHRcdGRlcHRoOiBudW1iZXIsXG5cdFx0ZGlyZWN0aW9uOiBCcmFuY2hEaXJlY3Rpb24sXG5cdFx0cG9zaXRpb25zOiBNYXA8c3RyaW5nLCBOb2RlUG9zaXRpb24+XG5cdCk6IENvbnRvdXIge1xuXHRcdGNvbnN0IG5vZGVIID0gbm9kZS5jYW52YXNOb2RlLmhlaWdodCB8fCB0aGlzLmNvbmZpZy5ub2RlSGVpZ2h0O1xuXHRcdGNvbnN0IG5vZGVXID0gbm9kZS5jYW52YXNOb2RlLndpZHRoIHx8IHRoaXMuY29uZmlnLm5vZGVXaWR0aDtcblxuXHRcdHBvc2l0aW9ucy5zZXQobm9kZS5jYW52YXNOb2RlLmlkLCB7IHg6IG5vZGVYLCB5OiBub2RlWSB9KTtcblxuXHRcdGNvbnN0IGNvbnRvdXI6IENvbnRvdXIgPSBuZXcgTWFwKCk7XG5cdFx0Y29udG91ci5zZXQoZGVwdGgsIHsgdG9wOiBub2RlWSwgYm90dG9tOiBub2RlWSArIG5vZGVIIH0pO1xuXG5cdFx0aWYgKG5vZGUuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSByZXR1cm4gY29udG91cjtcblxuXHRcdC8vIExheW91dCBlYWNoIGNoaWxkIHN1YnRyZWUgaW5kZXBlbmRlbnRseSBhdCB5PTBcblx0XHRjb25zdCBjaGlsZFN1YnRyZWVzOiBTdWJ0cmVlSW5mb1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRjb25zdCBjaGlsZFcgPSBjaGlsZC5jYW52YXNOb2RlLndpZHRoIHx8IHRoaXMuY29uZmlnLm5vZGVXaWR0aDtcblx0XHRcdGNvbnN0IGNoaWxkWCA9IGRpcmVjdGlvbiA9PT0gXCJyaWdodFwiXG5cdFx0XHRcdD8gbm9kZVggKyBub2RlVyArIHRoaXMuY29uZmlnLmhvcml6b250YWxHYXBcblx0XHRcdFx0OiBub2RlWCAtIGNoaWxkVyAtIHRoaXMuY29uZmlnLmhvcml6b250YWxHYXA7XG5cblx0XHRcdGNvbnN0IHRlbXBQb3NpdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgTm9kZVBvc2l0aW9uPigpO1xuXHRcdFx0Y29uc3QgY2hpbGRDb250b3VyID0gdGhpcy5sYXlvdXRTdWJ0cmVlKFxuXHRcdFx0XHRjaGlsZCwgY2hpbGRYLCAwLCBkZXB0aCArIDEsIGRpcmVjdGlvbiwgdGVtcFBvc2l0aW9uc1xuXHRcdFx0KTtcblx0XHRcdGNoaWxkU3VidHJlZXMucHVzaCh7IHBvc2l0aW9uczogdGVtcFBvc2l0aW9ucywgY29udG91cjogY2hpbGRDb250b3VyIH0pO1xuXHRcdH1cblxuXHRcdC8vIFBhY2sgY2hpbGQgc3VidHJlZXMgdGlnaHRseVxuXHRcdGNvbnN0IHsgeU9mZnNldHMsIGNvbWJpbmVkQ29udG91ciB9ID0gdGhpcy5wYWNrU3VidHJlZXMoY2hpbGRTdWJ0cmVlcyk7XG5cblx0XHQvLyBDZW50ZXIgY2hpbGRyZW4gYmxvY2sgYXJvdW5kIHRoaXMgbm9kZSdzIHZlcnRpY2FsIGNlbnRlclxuXHRcdGNvbnN0IGxhc3RJZHggPSBub2RlLmNoaWxkcmVuLmxlbmd0aCAtIDE7XG5cdFx0Y29uc3QgbGFzdENoaWxkSCA9IG5vZGUuY2hpbGRyZW5bbGFzdElkeF0uY2FudmFzTm9kZS5oZWlnaHQgfHwgdGhpcy5jb25maWcubm9kZUhlaWdodDtcblx0XHRjb25zdCBibG9ja1RvcCA9IHlPZmZzZXRzWzBdO1xuXHRcdGNvbnN0IGJsb2NrQm90dG9tID0geU9mZnNldHNbbGFzdElkeF0gKyBsYXN0Q2hpbGRIO1xuXHRcdGNvbnN0IGNlbnRlclNoaWZ0ID0gKG5vZGVZICsgbm9kZUggLyAyKSAtIChibG9ja1RvcCArIGJsb2NrQm90dG9tKSAvIDI7XG5cblx0XHQvLyBBcHBseSBvZmZzZXRzIGFuZCBtZXJnZSBjaGlsZCBwb3NpdGlvbnNcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkU3VidHJlZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IHlTaGlmdCA9IHlPZmZzZXRzW2ldICsgY2VudGVyU2hpZnQ7XG5cdFx0XHRmb3IgKGNvbnN0IFtpZCwgcG9zXSBvZiBjaGlsZFN1YnRyZWVzW2ldLnBvc2l0aW9ucykge1xuXHRcdFx0XHRwb3NpdGlvbnMuc2V0KGlkLCB7IHg6IHBvcy54LCB5OiBwb3MueSArIHlTaGlmdCB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBNZXJnZSBzaGlmdGVkIGNoaWxkcmVuIGNvbnRvdXIgaW50byB0aGlzIG5vZGUncyBjb250b3VyXG5cdFx0Zm9yIChjb25zdCBbZCwgZXh0XSBvZiBjb21iaW5lZENvbnRvdXIpIHtcblx0XHRcdGNvbnN0IHNoaWZ0ZWQgPSB7IHRvcDogZXh0LnRvcCArIGNlbnRlclNoaWZ0LCBib3R0b206IGV4dC5ib3R0b20gKyBjZW50ZXJTaGlmdCB9O1xuXHRcdFx0Y29uc3QgZXhpc3RpbmcgPSBjb250b3VyLmdldChkKTtcblx0XHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0XHRpZiAoc2hpZnRlZC50b3AgPCBleGlzdGluZy50b3ApIGV4aXN0aW5nLnRvcCA9IHNoaWZ0ZWQudG9wO1xuXHRcdFx0XHRpZiAoc2hpZnRlZC5ib3R0b20gPiBleGlzdGluZy5ib3R0b20pIGV4aXN0aW5nLmJvdHRvbSA9IHNoaWZ0ZWQuYm90dG9tO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udG91ci5zZXQoZCwgeyAuLi5zaGlmdGVkIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBjb250b3VyO1xuXHR9XG5cblx0LyoqXG5cdCAqIFBhY2sgYW4gYXJyYXkgb2Ygc3VidHJlZXMgdmVydGljYWxseSB1c2luZyBjb250b3VyIGNvbXBhcmlzb24uXG5cdCAqIEZpcnN0IHN1YnRyZWUgc3RheXMgYXQgeT0wOyBlYWNoIHN1YnNlcXVlbnQgb25lIGlzIHNoaWZ0ZWQgZG93blxuXHQgKiBqdXN0IGVub3VnaCB0byBjbGVhciB0aGUgY29tYmluZWQgY29udG91ciBhdCBhbGwgc2hhcmVkIGRlcHRocy5cblx0ICovXG5cdHByaXZhdGUgcGFja1N1YnRyZWVzKFxuXHRcdHN1YnRyZWVzOiBTdWJ0cmVlSW5mb1tdXG5cdCk6IHsgeU9mZnNldHM6IG51bWJlcltdOyBjb21iaW5lZENvbnRvdXI6IENvbnRvdXIgfSB7XG5cdFx0aWYgKHN1YnRyZWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHsgeU9mZnNldHM6IFtdLCBjb21iaW5lZENvbnRvdXI6IG5ldyBNYXAoKSB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHlPZmZzZXRzOiBudW1iZXJbXSA9IFswXTtcblxuXHRcdC8vIENsb25lIGZpcnN0IHN1YnRyZWUncyBjb250b3VyIGFzIHRoZSBjb21iaW5lZCBiYXNlbGluZVxuXHRcdGNvbnN0IGNvbWJpbmVkQ29udG91cjogQ29udG91ciA9IG5ldyBNYXAoKTtcblx0XHRmb3IgKGNvbnN0IFtkLCBleHRdIG9mIHN1YnRyZWVzWzBdLmNvbnRvdXIpIHtcblx0XHRcdGNvbWJpbmVkQ29udG91ci5zZXQoZCwgeyB0b3A6IGV4dC50b3AsIGJvdHRvbTogZXh0LmJvdHRvbSB9KTtcblx0XHR9XG5cblx0XHRmb3IgKGxldCBpID0gMTsgaSA8IHN1YnRyZWVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBzdWIgPSBzdWJ0cmVlc1tpXTtcblxuXHRcdFx0Ly8gRmluZCBtaW5pbXVtIFktc2hpZnQgc28gdGhpcyBzdWJ0cmVlIGNsZWFycyBjb21iaW5lZCBhdCBhbGwgc2hhcmVkIGRlcHRoc1xuXHRcdFx0bGV0IHNoaWZ0ID0gMDtcblx0XHRcdGZvciAoY29uc3QgW2QsIGV4dF0gb2Ygc3ViLmNvbnRvdXIpIHtcblx0XHRcdFx0Y29uc3QgcHJldiA9IGNvbWJpbmVkQ29udG91ci5nZXQoZCk7XG5cdFx0XHRcdGlmIChwcmV2ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRjb25zdCBuZWVkZWQgPSBwcmV2LmJvdHRvbSArIHRoaXMuY29uZmlnLnZlcnRpY2FsR2FwIC0gZXh0LnRvcDtcblx0XHRcdFx0XHRpZiAobmVlZGVkID4gc2hpZnQpIHNoaWZ0ID0gbmVlZGVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHlPZmZzZXRzLnB1c2goc2hpZnQpO1xuXG5cdFx0XHQvLyBNZXJnZSBzaGlmdGVkIGNvbnRvdXIgaW50byBjb21iaW5lZFxuXHRcdFx0Zm9yIChjb25zdCBbZCwgZXh0XSBvZiBzdWIuY29udG91cikge1xuXHRcdFx0XHRjb25zdCBzaGlmdGVkID0geyB0b3A6IGV4dC50b3AgKyBzaGlmdCwgYm90dG9tOiBleHQuYm90dG9tICsgc2hpZnQgfTtcblx0XHRcdFx0Y29uc3QgZXhpc3RpbmcgPSBjb21iaW5lZENvbnRvdXIuZ2V0KGQpO1xuXHRcdFx0XHRpZiAoZXhpc3RpbmcpIHtcblx0XHRcdFx0XHRpZiAoc2hpZnRlZC50b3AgPCBleGlzdGluZy50b3ApIGV4aXN0aW5nLnRvcCA9IHNoaWZ0ZWQudG9wO1xuXHRcdFx0XHRcdGlmIChzaGlmdGVkLmJvdHRvbSA+IGV4aXN0aW5nLmJvdHRvbSkgZXhpc3RpbmcuYm90dG9tID0gc2hpZnRlZC5ib3R0b207XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29tYmluZWRDb250b3VyLnNldChkLCB7IC4uLnNoaWZ0ZWQgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyB5T2Zmc2V0cywgY29tYmluZWRDb250b3VyIH07XG5cdH1cblxuXHQvKipcblx0ICogQXBwbHkgY2FsY3VsYXRlZCBwb3NpdGlvbnMgdG8gY2FudmFzIG5vZGVzLlxuXHQgKi9cblx0cHJpdmF0ZSBhcHBseVBvc2l0aW9ucyhcblx0XHRjYW52YXM6IENhbnZhcyxcblx0XHRwb3NpdGlvbnM6IE1hcDxzdHJpbmcsIE5vZGVQb3NpdGlvbj5cblx0KTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBbbm9kZUlkLCBwb3NdIG9mIHBvc2l0aW9ucykge1xuXHRcdFx0Y29uc3Qgbm9kZSA9IGNhbnZhcy5ub2Rlcy5nZXQobm9kZUlkKTtcblx0XHRcdGlmICghbm9kZSkgY29udGludWU7XG5cblx0XHRcdGlmICh0aGlzLmNvbmZpZy5hbmltYXRlKSB7XG5cdFx0XHRcdG5vZGUubm9kZUVsPy5hZGRDbGFzcyhcIm1pbmRtYXAtYW5pbWF0aW5nXCIpO1xuXHRcdFx0fVxuXG5cdFx0XHRub2RlLm1vdmVUbyh7IHg6IHBvcy54LCB5OiBwb3MueSB9KTtcblx0XHR9XG5cblx0XHRjYW52YXMucmVxdWVzdFNhdmUoKTtcblx0XHRjYW52YXMucmVxdWVzdEZyYW1lKCk7XG5cblx0XHQvLyBSZW1vdmUgYW5pbWF0aW9uIGNsYXNzIGFmdGVyIHRyYW5zaXRpb24gY29tcGxldGVzXG5cdFx0aWYgKHRoaXMuY29uZmlnLmFuaW1hdGUpIHtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgY2FudmFzLm5vZGVzLnZhbHVlcygpKSB7XG5cdFx0XHRcdFx0bm9kZS5ub2RlRWw/LnJlbW92ZUNsYXNzKFwibWluZG1hcC1hbmltYXRpbmdcIik7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDM1MCk7XG5cdFx0fVxuXHR9XG59XG4iXX0=