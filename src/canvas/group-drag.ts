import type { Canvas, CanvasNode } from "../types/canvas-internal";
import { CanvasAPI, findNodeFromEvent } from "./canvas-api";
import { getGroupIds } from "../mindmap/tree-model";

/**
 * Identify "stranger" nodes inside a group — nodes whose parent is outside the group,
 * plus their descendants that are also inside the group.
 */
function identifyStrangers(canvas: Canvas, canvasApi: CanvasAPI, group: CanvasNode): CanvasNode[] {
	const groupIds = getGroupIds(canvas);

	// Find all non-group nodes whose center is inside the group bounds
	const gx = group.x;
	const gy = group.y;
	const gw = group.width;
	const gh = group.height;

	const insideIds = new Set<string>();
	const insideNodes = new Map<string, CanvasNode>();

	for (const node of canvas.nodes.values()) {
		if (groupIds.has(node.id)) continue;
		const cx = node.x + node.width / 2;
		const cy = node.y + node.height / 2;
		if (cx >= gx && cx <= gx + gw && cy >= gy && cy <= gy + gh) {
			insideIds.add(node.id);
			insideNodes.set(node.id, node);
		}
	}

	// Find stranger entry points: inside nodes whose parent is outside the group
	const strangerIds = new Set<string>();

	for (const nodeId of insideIds) {
		const node = insideNodes.get(nodeId)!;
		const parent = canvasApi.getParentNode(canvas, node);
		if (parent && !insideIds.has(parent.id)) {
			// This node's parent is outside — it's a stranger entry point.
			// BFS to collect it and its descendants that are also inside.
			const queue = [nodeId];
			strangerIds.add(nodeId);
			while (queue.length > 0) {
				const id = queue.shift()!;
				for (const edge of canvasApi.getOutgoingEdges(canvas, id)) {
					const childId = edge.to.node.id;
					if (!strangerIds.has(childId) && insideIds.has(childId)) {
						strangerIds.add(childId);
						queue.push(childId);
					}
				}
			}
		}
	}

	return Array.from(strangerIds).map(id => insideNodes.get(id)!);
}

/**
 * Register Alt+drag handler for groups: when Alt is held during a group drag,
 * stranger nodes (belonging to other trees) stay put while the group and its
 * legitimate contents relocate.
 *
 * Returns a cleanup function to remove the listeners.
 */
export function registerGroupDragHandler(canvas: Canvas, canvasApi: CanvasAPI): () => void {
	const frozenNodes: CanvasNode[] = [];

	const downHandler = (e: PointerEvent): void => {
		if (!e.altKey) return;

		const node = findNodeFromEvent(canvas, e);
		if (!node) return;

		// Check if the clicked node is a group
		if (!getGroupIds(canvas).has(node.id)) return;

		const strangers = identifyStrangers(canvas, canvasApi, node);
		for (const stranger of strangers) {
			frozenNodes.push(stranger);
			stranger.moveTo = () => {};
		}
	};

	const upHandler = (): void => {
		if (frozenNodes.length === 0) return;
		for (const node of frozenNodes) {
			delete (node as { moveTo?: unknown }).moveTo;
		}
		frozenNodes.length = 0;
		canvas.requestSave();
	};

	canvas.wrapperEl?.addEventListener("pointerdown", downHandler, true);
	canvas.wrapperEl?.addEventListener("pointerup", upHandler);

	return () => {
		if (frozenNodes.length > 0) {
			for (const node of frozenNodes) {
				delete (node as { moveTo?: unknown }).moveTo;
			}
			frozenNodes.length = 0;
		}
		canvas.wrapperEl?.removeEventListener("pointerdown", downHandler, true);
		canvas.wrapperEl?.removeEventListener("pointerup", upHandler);
	};
}
