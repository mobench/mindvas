import type { Canvas, CanvasNode } from "../types/canvas-internal";
import { CanvasAPI, findNodeFromEvent } from "./canvas-api";

/**
 * Collect all descendant nodes by walking outgoing edges (BFS).
 * Uses the edge index for O(N) traversal instead of O(N*E).
 */
function collectDescendants(canvas: Canvas, canvasApi: CanvasAPI, nodeId: string): CanvasNode[] {
	const result: CanvasNode[] = [];
	const visited = new Set<string>([nodeId]);
	const queue = [nodeId];

	while (queue.length > 0) {
		const id = queue.shift()!;
		for (const edge of canvasApi.getOutgoingEdges(canvas, id)) {
			const childId = edge.to.node.id;
			if (!visited.has(childId)) {
				visited.add(childId);
				result.push(edge.to.node);
				queue.push(childId);
			}
		}
	}
	return result;
}

/**
 * Register pointer listeners that make dragging a node also move
 * all its descendant nodes, preserving relative positions.
 *
 * Uses capture-phase pointerdown to install a moveTo wrapper BEFORE
 * Obsidian's own handlers fire, ensuring descendants move from the
 * very first drag frame — even in a single click-drag gesture.
 *
 * Hold Alt while dragging to move only the single node.
 *
 * Returns a cleanup function to remove the listeners.
 */
export function registerSubtreeDragHandler(canvas: Canvas, canvasApi: CanvasAPI): () => void {
	let draggedNode: CanvasNode | null = null;
	let cachedDescendants: CanvasNode[] | null = null;
	let originalMoveTo: ((pos: { x: number; y: number }) => void) | null = null;

	function installWrapper(node: CanvasNode): void {
		const descendants = collectDescendants(canvas, canvasApi, node.id);
		if (descendants.length === 0) return;

		draggedNode = node;
		cachedDescendants = descendants;

		// Wrap moveTo so descendants move in the same call stack.
		// Use prototype's moveTo (not instance) to avoid stacked wrappers.
		const proto = Object.getPrototypeOf(node) as CanvasNode;
		originalMoveTo = proto.moveTo.bind(node);
		node.moveTo = (pos: { x: number; y: number }) => {
			const dx = pos.x - node.x;
			const dy = pos.y - node.y;
			originalMoveTo!(pos);
			// Call descendants' moveTo via prototype to bypass any
			// per-instance wrappers — prevents infinite recursion.
			for (const desc of cachedDescendants!) {
				const descProto = Object.getPrototypeOf(desc) as CanvasNode;
				descProto.moveTo.call(
					desc, { x: desc.x + dx, y: desc.y + dy }
				);
			}
		};
	}

	function clearDragSession(): void {
		if (draggedNode && originalMoveTo) {
			// Remove instance override to restore prototype method lookup
			delete (draggedNode as { moveTo?: unknown }).moveTo;
		}
		draggedNode = null;
		cachedDescendants = null;
		originalMoveTo = null;
	}

	// Capture-phase pointerdown: fires BEFORE Obsidian's bubble-phase handlers.
	// Find clicked node from e.target (selection not updated yet) and install
	// the moveTo wrapper immediately — before any drag moveTo() calls.
	const downHandler = (e: PointerEvent): void => {
		// Clear any stale session from a previous drag
		if (draggedNode) clearDragSession();

		if (e.altKey) return;

		const node = findNodeFromEvent(canvas, e);
		if (node) {
			installWrapper(node);
		}
	};

	const moveHandler = (e: PointerEvent): void => {
		if (e.buttons === 0) return;

		// Alt key = solo drag
		if (e.altKey) {
			if (draggedNode) clearDragSession();
			return;
		}

		// Fallback: if downHandler missed (e.g. programmatic selection)
		if (!draggedNode) {
			const node = canvasApi.getSelectedNode(canvas);
			if (node) installWrapper(node);
			if (!draggedNode) return;
		}

		// Verify the dragged node is still selected
		const currentSelected = canvasApi.getSelectedNode(canvas);
		if (!currentSelected || currentSelected.id !== draggedNode.id) {
			clearDragSession();
		}
	};

	const upHandler = (): void => {
		if (!draggedNode) return;
		canvas.requestSave();
		clearDragSession();
	};

	// downHandler in capture phase (true) — fires before Obsidian's handlers
	canvas.wrapperEl?.addEventListener("pointerdown", downHandler, true);
	canvas.wrapperEl?.addEventListener("pointermove", moveHandler);
	canvas.wrapperEl?.addEventListener("pointerup", upHandler);

	return () => {
		clearDragSession();
		canvas.wrapperEl?.removeEventListener("pointerdown", downHandler, true);
		canvas.wrapperEl?.removeEventListener("pointermove", moveHandler);
		canvas.wrapperEl?.removeEventListener("pointerup", upHandler);
	};
}
