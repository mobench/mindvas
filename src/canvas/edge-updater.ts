import type { Canvas, CanvasNode, NodeSide } from "../types/canvas-internal";

interface NodeCenter {
	cx: number;
	cy: number;
}

function getCenter(node: CanvasNode): NodeCenter {
	return {
		cx: node.x + node.width / 2,
		cy: node.y + node.height / 2,
	};
}

/**
 * Compute the optimal connection sides for an edge based on
 * the relative positions of the two connected nodes.
 * Uses a dominant-axis heuristic: whichever axis has the larger
 * center-to-center distance determines the side pair.
 */
export function computeEdgeSides(
	fromNode: CanvasNode,
	toNode: CanvasNode
): { fromSide: NodeSide; toSide: NodeSide } {
	const fromCenter = getCenter(fromNode);
	const toCenter = getCenter(toNode);

	const dx = toCenter.cx - fromCenter.cx;

	// Mind map edges always connect horizontally (left/right).
	if (dx >= 0) {
		return { fromSide: "right", toSide: "left" };
	} else {
		return { fromSide: "left", toSide: "right" };
	}
}

/**
 * Update the from/to sides of all edges in the canvas
 * to match the current positions of their connected nodes.
 * Only mutates edges whose sides actually changed.
 */
export function updateAllEdgeSides(canvas: Canvas): void {
	let changed = false;

	for (const edge of canvas.edges.values()) {
		const fromNode = edge.from.node;
		const toNode = edge.to.node;

		if (!fromNode || !toNode) continue;

		const { fromSide, toSide } = computeEdgeSides(fromNode, toNode);

		if (edge.from.side !== fromSide || edge.to.side !== toSide) {
			edge.from.side = fromSide;
			edge.to.side = toSide;
			changed = true;
		}
	}

	if (changed) {
		canvas.requestFrame();
		canvas.requestSave();
	}
}

/**
 * Register pointer listeners on the canvas wrapper that update
 * edge connection sides both during and after node drags.
 * Uses a throttled pointermove for live updates and an immediate
 * pointerup for a final correction when the drag ends.
 * Returns a cleanup function to remove the listeners.
 */
export function registerDragEndHandler(canvas: Canvas): () => void {
	let lastMoveUpdate = 0;
	const THROTTLE_MS = 40; // ~25fps — responsive but not wasteful

	const moveHandler = (e: PointerEvent) => {
		// Only update while a button is pressed (i.e. during a drag)
		if (e.buttons === 0) return;

		const now = Date.now();
		if (now - lastMoveUpdate < THROTTLE_MS) return;
		lastMoveUpdate = now;

		updateAllEdgeSides(canvas);
	};

	const upHandler = () => {
		updateAllEdgeSides(canvas);
	};

	canvas.wrapperEl?.addEventListener("pointermove", moveHandler);
	canvas.wrapperEl?.addEventListener("pointerup", upHandler);

	return () => {
		canvas.wrapperEl?.removeEventListener("pointermove", moveHandler);
		canvas.wrapperEl?.removeEventListener("pointerup", upHandler);
	};
}
