import type { Canvas, CanvasNode, CanvasEdge } from "../types/canvas-internal";
import { CanvasAPI } from "../canvas/canvas-api";
import { buildForest, TreeNode } from "./tree-model";

/**
 * Default color palette for top-level branches.
 * Uses Obsidian's canvas color system (string numbers "1"-"6" map to CSS vars).
 */
const DEFAULT_PALETTE: string[] = ["1", "2", "3", "4", "5", "6"];

/**
 * Assigns distinct colors to top-level branches and cascades to descendants.
 */
export class BranchColors {
	private palette: string[];

	constructor(
		private canvasApi: CanvasAPI,
		private colorLeafNodes: () => boolean = () => true,
		palette?: string[]
	) {
		this.palette = palette ?? DEFAULT_PALETTE;
	}

	/**
	 * Apply auto-coloring to all branches.
	 */
	applyColors(canvas: Canvas): void {
		const forest = buildForest(canvas);
		if (forest.length === 0) return;

		// Each tree's top-level branches get distinct colors
		for (const root of forest) {
			root.children.forEach((child, index) => {
				const color = this.palette[index % this.palette.length];
				this.colorBranch(canvas, child, color);
			});
		}

		canvas.requestSave();
		canvas.requestFrame();
	}

	/**
	 * Color a single branch (node + all descendants + edges).
	 */
	private colorBranch(canvas: Canvas, node: TreeNode, color: string): void {
		const isLeaf = node.children.length === 0;

		if (!isLeaf || this.colorLeafNodes()) {
			node.canvasNode.setColor(color);
		} else {
			node.canvasNode.setColor("");
		}

		const incomingEdge = this.findIncomingEdge(canvas, node.canvasNode);
		if (incomingEdge) {
			incomingEdge.setColor(color);
		}

		for (const child of node.children) {
			this.colorBranch(canvas, child, color);
		}
	}

	/**
	 * Find the edge pointing TO this node.
	 */
	private findIncomingEdge(
		canvas: Canvas,
		node: CanvasNode
	): CanvasEdge | null {
		const edges = this.canvasApi.getConnectedEdges(canvas, node);
		return edges.find(e => e.to.node.id === node.id) ?? null;
	}

}
