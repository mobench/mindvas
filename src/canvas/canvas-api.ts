import { App, ItemView } from "obsidian";
import type {
	Canvas,
	CanvasView,
	CanvasNode,
	CanvasEdge,
	NodeSide,
} from "../types/canvas-internal";

interface EdgeIndex {
	/** Edges pointing TO a node (node is target) */
	incoming: Map<string, CanvasEdge[]>;
	/** Edges pointing FROM a node (node is source) */
	outgoing: Map<string, CanvasEdge[]>;
}

/**
 * Generate a 16-character hex ID for canvas elements.
 */
export function genId(): string {
	return Array.from({ length: 16 }, () =>
		Math.floor(Math.random() * 16).toString(16)
	).join("");
}

/**
 * Find the CanvasNode whose nodeEl contains the event target.
 */
export function findNodeFromEvent(canvas: Canvas, e: PointerEvent | MouseEvent): CanvasNode | null {
	const target = e.target as HTMLElement;
	if (!target) return null;
	for (const node of canvas.nodes.values()) {
		if (node.nodeEl?.contains(target)) return node;
	}
	return null;
}

/**
 * Typed wrapper around Obsidian's undocumented Canvas runtime API.
 * Maintains a lazily-built edge index for O(1) parent/child lookups.
 */
export class CanvasAPI {
	private edgeIndex: EdgeIndex | null = null;
	private indexedCanvas: Canvas | null = null;
	private indexedEdgeIds: Set<string> | null = null;

	constructor(private app: App) {}

	/**
	 * Get or rebuild the edge index for the given canvas.
	 * Rebuilds if canvas changed or edge count changed (structural mutation).
	 */
	private getEdgeIndex(canvas: Canvas): EdgeIndex {
		if (
			this.edgeIndex &&
			this.indexedCanvas === canvas &&
			this.edgeIdsMatch(canvas)
		) {
			return this.edgeIndex;
		}

		const incoming = new Map<string, CanvasEdge[]>();
		const outgoing = new Map<string, CanvasEdge[]>();

		for (const edge of canvas.edges.values()) {
			const fromId = edge.from.node.id;
			const toId = edge.to.node.id;

			let out = outgoing.get(fromId);
			if (!out) { out = []; outgoing.set(fromId, out); }
			out.push(edge);

			let inc = incoming.get(toId);
			if (!inc) { inc = []; incoming.set(toId, inc); }
			inc.push(edge);
		}

		this.edgeIndex = { incoming, outgoing };
		this.indexedCanvas = canvas;
		this.indexedEdgeIds = new Set(canvas.edges.keys());
		return this.edgeIndex;
	}

	/**
	 * Check whether the cached edge ID set still matches the live canvas.
	 */
	private edgeIdsMatch(canvas: Canvas): boolean {
		if (!this.indexedEdgeIds || canvas.edges.size !== this.indexedEdgeIds.size) return false;
		for (const id of canvas.edges.keys()) {
			if (!this.indexedEdgeIds.has(id)) return false;
		}
		return true;
	}

	/**
	 * Invalidate the edge index (call after adding/removing edges).
	 */
	invalidateEdgeIndex(): void {
		this.edgeIndex = null;
	}

	/**
	 * Get the active canvas if a canvas view is currently focused.
	 */
	getActiveCanvas(): Canvas | null {
		const view = this.app.workspace.getActiveViewOfType(ItemView);
		if (!view || view.getViewType() !== "canvas") return null;

		return (view as unknown as CanvasView).canvas ?? null;
	}

	/**
	 * Get canvas from any open canvas leaf (first found).
	 */
	getAnyCanvas(): Canvas | null {
		const leaves = this.app.workspace.getLeavesOfType("canvas");
		if (leaves.length === 0) return null;

		const view = leaves[0].view as unknown as CanvasView;
		return view?.canvas ?? null;
	}

	/**
	 * Get the currently selected node (single selection).
	 */
	getSelectedNode(canvas: Canvas): CanvasNode | null {
		const selection = canvas.selection;
		if (selection.size !== 1) return null;

		const item = selection.values().next().value;
		if (!item || !("nodeEl" in item)) return null;

		return item as CanvasNode;
	}

	/**
	 * Create a text node at a given position.
	 */
	createTextNode(
		canvas: Canvas,
		x: number,
		y: number,
		text: string = "",
		width: number = 260,
		height: number = 60
	): CanvasNode {
		const node = canvas.createTextNode({
			pos: { x, y },
			size: { width, height },
			text,
			focus: false,
			save: false,
		});
		return node;
	}

	/**
	 * Create an edge between two nodes using canvas.importData.
	 */
	createEdge(
		canvas: Canvas,
		fromNode: CanvasNode,
		toNode: CanvasNode,
		fromSide: NodeSide = "right",
		toSide: NodeSide = "left",
		color?: string
	): void {
		const id = genId();

		canvas.importData({
			edges: [
				{
					id,
					fromNode: fromNode.id,
					fromSide,
					fromEnd: "none",
					toNode: toNode.id,
					toSide,
					toEnd: "arrow",
					...(color ? { color } : {}),
				},
			],
			nodes: [],
		});
		this.invalidateEdgeIndex();
	}

	/**
	 * Remove a node and all its connected edges.
	 */
	removeNode(canvas: Canvas, node: CanvasNode): void {
		// Find and remove connected edges
		const connectedEdges = this.getConnectedEdges(canvas, node);
		for (const edge of connectedEdges) {
			canvas.removeEdge(edge);
		}
		canvas.removeNode(node);
		this.invalidateEdgeIndex();
	}

	/**
	 * Get all edges connected to a node (incoming + outgoing).
	 */
	getConnectedEdges(canvas: Canvas, node: CanvasNode): CanvasEdge[] {
		const idx = this.getEdgeIndex(canvas);
		const inc = idx.incoming.get(node.id) ?? [];
		const out = idx.outgoing.get(node.id) ?? [];
		return [...inc, ...out];
	}

	/**
	 * Get parent node (the node that has an edge pointing TO this node).
	 */
	getParentNode(canvas: Canvas, node: CanvasNode): CanvasNode | null {
		const idx = this.getEdgeIndex(canvas);
		const inc = idx.incoming.get(node.id);
		return inc && inc.length > 0 ? inc[0].from.node : null;
	}

	/**
	 * Get child nodes (nodes that this node has edges pointing TO).
	 */
	getChildNodes(canvas: Canvas, node: CanvasNode): CanvasNode[] {
		const idx = this.getEdgeIndex(canvas);
		const out = idx.outgoing.get(node.id) ?? [];
		const children = out.map(e => e.to.node);
		// Sort by y position (top to bottom) for consistent sibling order
		children.sort((a, b) => a.y - b.y);
		return children;
	}

	/**
	 * Get outgoing edges from a node (for BFS traversal).
	 */
	getOutgoingEdges(canvas: Canvas, nodeId: string): CanvasEdge[] {
		const idx = this.getEdgeIndex(canvas);
		return idx.outgoing.get(nodeId) ?? [];
	}

	/**
	 * Get sibling nodes (other children of the same parent).
	 */
	getSiblingNodes(canvas: Canvas, node: CanvasNode): CanvasNode[] {
		const parent = this.getParentNode(canvas, node);
		if (!parent) return [];

		return this.getChildNodes(canvas, parent).filter(
			(n) => n.id !== node.id
		);
	}

	/**
	 * Select a node and zoom to it with padding.
	 */
	selectAndZoom(canvas: Canvas, node: CanvasNode, zoomPadding: number): void {
		canvas.selectOnly(node);
		if (zoomPadding > 0) {
			const cx = node.x + node.width / 2;
			const cy = node.y + node.height / 2;
			canvas.zoomToBbox({
				minX: cx - zoomPadding,
				minY: cy - zoomPadding,
				maxX: cx + zoomPadding,
				maxY: cy + zoomPadding,
			});
		} else {
			canvas.zoomToSelection();
		}
	}

	selectAndEdit(canvas: Canvas, node: CanvasNode, zoomPadding: number = 0): void {
		this.selectAndZoom(canvas, node, zoomPadding);
		setTimeout(() => {
			node.startEditing();
		}, 50);
	}

}
