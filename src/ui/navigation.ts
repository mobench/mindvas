import type { Canvas, CanvasNode } from "../types/canvas-internal";
import { CanvasAPI } from "../canvas/canvas-api";
import { buildForest, findTreeForNode, getDescendants } from "../mindmap/tree-model";

/**
 * Zoom and focus utilities for mind map navigation.
 */
export class Navigation {
	constructor(private canvasApi: CanvasAPI) {}

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
			if (!e.ctrlKey && !e.metaKey) return;

			// Find which node was clicked
			const target = e.target as HTMLElement;
			const nodeEl = target.closest(".canvas-node") as HTMLElement;
			if (!nodeEl) return;

			// Find the canvas node by matching DOM element
			for (const node of canvas.nodes.values()) {
				if (node.nodeEl === nodeEl) {
					e.preventDefault();
					e.stopPropagation();
					this.zoomToBranch(canvas, node);
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
