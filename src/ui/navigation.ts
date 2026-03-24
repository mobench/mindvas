import type { Canvas, CanvasNode } from "../types/canvas-internal";
import { CanvasAPI } from "../canvas/canvas-api";
import { buildForest, findTreeForNode, getDescendants } from "../mindmap/tree-model";

/**
 * Zoom and focus utilities for mind map navigation.
 */
export class Navigation {
	constructor(private canvasApi: CanvasAPI) {}

	/**
	 * Select the entire tree (root + all descendants) that a node belongs to.
	 * Triggered by Alt+click on a node.
	 */
	selectTree(canvas: Canvas, node: CanvasNode): void {
		const forest = buildForest(canvas);
		if (forest.length === 0) return;
		const treeNode = findTreeForNode(forest, node.id);
		if (!treeNode) return;

		let root = treeNode;
		while (root.parent) root = root.parent;

		const allNodes = [root, ...getDescendants(root)];
		canvas.deselectAll();
		for (const n of allNodes) {
			canvas.selection.add(n.canvasNode);
		}
		canvas.requestFrame();
	}

	/**
	 * Zoom to fit an entire branch (node + all descendants).
	 * Triggered by Ctrl+click on a node.
	 */
	zoomToBranch(canvas: Canvas, node: CanvasNode): void {
		const forest = buildForest(canvas);
		if (forest.length === 0) return;

		const treeNode = findTreeForNode(forest, node.id);
		if (!treeNode) return;

		const descendants = getDescendants(treeNode);
		const allNodes = [treeNode, ...descendants];
		if (allNodes.length === 0) return;

		// Calculate bounding box
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;

		for (const n of allNodes) {
			const cn = n.canvasNode;
			minX = Math.min(minX, cn.x);
			minY = Math.min(minY, cn.y);
			maxX = Math.max(maxX, cn.x + cn.width);
			maxY = Math.max(maxY, cn.y + cn.height);
		}

		// Add padding
		const pad = 50;
		canvas.zoomToBbox({
			minX: minX - pad,
			minY: minY - pad,
			maxX: maxX + pad,
			maxY: maxY + pad,
		});
	}

	/**
	 * Register Ctrl+click handler for zoom-to-branch.
	 */
	registerClickHandler(canvas: Canvas): (() => void) | null {
		const handler = (e: MouseEvent) => {
			if (!e.ctrlKey && !e.metaKey && !e.altKey) return;

			const target = e.target as HTMLElement;
			if (target.closest(".canvas-node-connection-point")) return;
			const nodeEl = target.closest(".canvas-node") as HTMLElement;
			if (!nodeEl) return;

			for (const node of canvas.nodes.values()) {
				if (node.nodeEl === nodeEl) {
					e.preventDefault();
					e.stopPropagation();
					if (e.altKey) {
						this.selectTree(canvas, node);
					} else {
						this.zoomToBranch(canvas, node);
					}
					break;
				}
			}
		};

		canvas.wrapperEl?.addEventListener("click", handler, true);

		return () => {
			canvas.wrapperEl?.removeEventListener("click", handler, true);
		};
	}
}
