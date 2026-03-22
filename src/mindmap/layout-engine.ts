import type { Canvas } from "../types/canvas-internal";
import { buildForest, findTreeForNode, getDescendants, TreeNode, BranchDirection } from "./tree-model";
import { updateAllEdgeSides } from "../canvas/edge-updater";

export interface LayoutConfig {
	horizontalGap: number;
	verticalGap: number;
	nodeWidth: number;
	nodeHeight: number;
	animate: boolean;
}

const DEFAULT_CONFIG: LayoutConfig = {
	horizontalGap: 80,
	verticalGap: 20,
	nodeWidth: 300,
	nodeHeight: 60,
	animate: true,
};

interface NodePosition {
	x: number;
	y: number;
}

/** Vertical extent at a given depth column. */
interface DepthExtent {
	top: number;
	bottom: number;
}

/** Maps depth → vertical extent. Used to pack sibling subtrees tightly. */
type Contour = Map<number, DepthExtent>;

/** A subtree's layout result: positions and contour. */
interface SubtreeInfo {
	positions: Map<string, NodePosition>;
	contour: Contour;
}

/**
 * Contour-based tree layout engine.
 * Packs sibling subtrees as tightly as possible: a node only needs
 * to clear siblings at the same depth column, not their descendants
 * in deeper columns. This eliminates wasted vertical space.
 */
export class LayoutEngine {
	private config: LayoutConfig;

	constructor(config?: Partial<LayoutConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Recalculate and apply layout to all trees in the canvas.
	 * Each root's children are partitioned into left/right groups and
	 * laid out independently, centered around their own root.
	 */
	layout(canvas: Canvas): void {
		const forest = buildForest(canvas);
		if (forest.length === 0) return;

		const positions = new Map<string, NodePosition>();

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
	layoutChildren(canvas: Canvas, parentNodeId: string): void {
		const forest = buildForest(canvas);
		if (forest.length === 0) return;

		const parentTreeNode = findTreeForNode(forest, parentNodeId);
		if (!parentTreeNode || parentTreeNode.children.length === 0) return;

		const positions = new Map<string, NodePosition>();

		if (!parentTreeNode.parent) {
			// Root: re-layout each side independently, centered around root
			const rightChildren = parentTreeNode.children.filter(c => c.direction === "right");
			const leftChildren = parentTreeNode.children.filter(c => c.direction === "left");
			const rootX = parentTreeNode.canvasNode.x;
			const rootY = parentTreeNode.canvasNode.y;
			this.layoutGroup(parentTreeNode, rightChildren, "right", rootX, rootY, positions);
			this.layoutGroup(parentTreeNode, leftChildren, "left", rootX, rootY, positions);
		} else {
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
	restackSiblings(canvas: Canvas, parentNodeId: string): void {
		const forest = buildForest(canvas);
		const parentTreeNode = findTreeForNode(forest, parentNodeId);
		if (!parentTreeNode || parentTreeNode.children.length === 0) return;

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
	private restackGroup(
		canvas: Canvas,
		children: TreeNode[],
		parentCy: number
	): void {
		if (children.length === 0) return;

		// Sort by current Y position
		const sorted = [...children].sort(
			(a, b) => a.canvasNode.y - b.canvasNode.y
		);

		// Compute subtree bounding box for each child
		const bboxes = sorted.map(child => {
			const descendants = getDescendants(child);
			const allNodes = [child, ...descendants];
			let minY = Infinity;
			let maxY = -Infinity;
			for (const n of allNodes) {
				const top = n.canvasNode.y;
				const bottom = top + n.canvasNode.height;
				if (top < minY) minY = top;
				if (bottom > maxY) maxY = bottom;
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
	private layoutGroup(
		root: TreeNode,
		children: TreeNode[],
		direction: BranchDirection,
		rootX: number,
		rootY: number,
		positions: Map<string, NodePosition>
	): void {
		if (children.length === 0) return;

		const rootH = root.canvasNode.height || this.config.nodeHeight;
		const rootW = root.canvasNode.width || this.config.nodeWidth;
		const rootCenterY = rootY + rootH / 2;

		// Layout each child subtree independently at y=0
		const subtrees: SubtreeInfo[] = [];
		for (const child of children) {
			const childW = child.canvasNode.width || this.config.nodeWidth;
			const childX = direction === "right"
				? rootX + rootW + this.config.horizontalGap
				: rootX - childW - this.config.horizontalGap;

			const tempPositions = new Map<string, NodePosition>();
			const contour = this.layoutSubtree(
				child, childX, 0, 0, direction, tempPositions
			);
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
	private layoutSubtree(
		node: TreeNode,
		nodeX: number,
		nodeY: number,
		depth: number,
		direction: BranchDirection,
		positions: Map<string, NodePosition>
	): Contour {
		const nodeH = node.canvasNode.height || this.config.nodeHeight;
		const nodeW = node.canvasNode.width || this.config.nodeWidth;

		positions.set(node.canvasNode.id, { x: nodeX, y: nodeY });

		const contour: Contour = new Map();
		contour.set(depth, { top: nodeY, bottom: nodeY + nodeH });

		if (node.children.length === 0) return contour;

		// Layout each child subtree independently at y=0
		const childSubtrees: SubtreeInfo[] = [];
		for (const child of node.children) {
			const childW = child.canvasNode.width || this.config.nodeWidth;
			const childX = direction === "right"
				? nodeX + nodeW + this.config.horizontalGap
				: nodeX - childW - this.config.horizontalGap;

			const tempPositions = new Map<string, NodePosition>();
			const childContour = this.layoutSubtree(
				child, childX, 0, depth + 1, direction, tempPositions
			);
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
				if (shifted.top < existing.top) existing.top = shifted.top;
				if (shifted.bottom > existing.bottom) existing.bottom = shifted.bottom;
			} else {
				contour.set(d, { ...shifted });
			}
		}

		return contour;
	}

	/**
	 * Pack an array of subtrees vertically using contour comparison.
	 * First subtree stays at y=0; each subsequent one is shifted down
	 * just enough to clear the combined contour at all shared depths.
	 */
	private packSubtrees(
		subtrees: SubtreeInfo[]
	): { yOffsets: number[]; combinedContour: Contour } {
		if (subtrees.length === 0) {
			return { yOffsets: [], combinedContour: new Map() };
		}

		const yOffsets: number[] = [0];

		// Clone first subtree's contour as the combined baseline
		const combinedContour: Contour = new Map();
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
					if (needed > shift) shift = needed;
				}
			}

			yOffsets.push(shift);

			// Merge shifted contour into combined
			for (const [d, ext] of sub.contour) {
				const shifted = { top: ext.top + shift, bottom: ext.bottom + shift };
				const existing = combinedContour.get(d);
				if (existing) {
					if (shifted.top < existing.top) existing.top = shifted.top;
					if (shifted.bottom > existing.bottom) existing.bottom = shifted.bottom;
				} else {
					combinedContour.set(d, { ...shifted });
				}
			}
		}

		return { yOffsets, combinedContour };
	}

	/**
	 * Apply calculated positions to canvas nodes.
	 */
	private applyPositions(
		canvas: Canvas,
		positions: Map<string, NodePosition>
	): void {
		for (const [nodeId, pos] of positions) {
			const node = canvas.nodes.get(nodeId);
			if (!node) continue;

			if (this.config.animate) {
				node.nodeEl?.addClass("mindmap-animating");
			}

			node.moveTo({ x: pos.x, y: pos.y });
		}

		canvas.requestSave();
		canvas.requestFrame();

		// Remove animation class after transition completes
		if (this.config.animate) {
			setTimeout(() => {
				for (const node of canvas.nodes.values()) {
					node.nodeEl?.removeClass("mindmap-animating");
				}
			}, 350);
		}
	}
}
