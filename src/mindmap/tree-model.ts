import type { Canvas, CanvasNode } from "../types/canvas-internal";

export type BranchDirection = "left" | "right";

/**
 * Represents a node in the mind map tree structure.
 */
export interface TreeNode {
	canvasNode: CanvasNode;
	parent: TreeNode | null;
	children: TreeNode[];
	depth: number;
	/** Index among siblings (0-based) */
	siblingIndex: number;
	/** Branch direction: null for root, inherited for deeper nodes */
	direction: BranchDirection | null;
}

/**
 * Builds a forest of tree structures from the flat canvas nodes and edges.
 * Each node with no incoming edges becomes a root of its own tree.
 * Returns all roots sorted by descending subtree size (largest first).
 */
export function buildForest(canvas: Canvas): TreeNode[] {
	const nodeMap = new Map<string, TreeNode>();
	const childIds = new Set<string>();

	// Identify all nodes that are targets of edges (they have parents)
	for (const edge of canvas.edges.values()) {
		childIds.add(edge.to.node.id);
	}

	const groupIds = getGroupIds(canvas);

	// Create TreeNode wrappers (skip group nodes)
	for (const node of canvas.nodes.values()) {
		if (groupIds.has(node.id)) continue;
		nodeMap.set(node.id, {
			canvasNode: node,
			parent: null,
			children: [],
			depth: 0,
			siblingIndex: 0,
			direction: null,
		});
	}

	// Build parent-child relationships from edges
	for (const edge of canvas.edges.values()) {
		const parentTree = nodeMap.get(edge.from.node.id);
		const childTree = nodeMap.get(edge.to.node.id);
		if (parentTree && childTree) {
			childTree.parent = parentTree;
			parentTree.children.push(childTree);
		}
	}

	// Sort children by y-position for consistent ordering
	for (const treeNode of nodeMap.values()) {
		treeNode.children.sort(
			(a, b) => a.canvasNode.y - b.canvasNode.y
		);
		treeNode.children.forEach((child, i) => {
			child.siblingIndex = i;
		});
	}

	// Collect all roots: nodes with no incoming edges
	const roots: TreeNode[] = [];
	for (const node of canvas.nodes.values()) {
		if (!childIds.has(node.id)) {
			const treeNode = nodeMap.get(node.id);
			if (treeNode) {
				setDepths(treeNode, 0);
				assignDirections(treeNode);
				roots.push(treeNode);
			}
		}
	}

	// Sort by descending subtree size (largest first)
	roots.sort((a, b) => countReachable(b) - countReachable(a));

	return roots;
}

/**
 * Collect the set of group node IDs from the serialized canvas data.
 * Runtime nodes lack `.type`, so this reads from getData().
 */
export function getGroupIds(canvas: Canvas): Set<string> {
	const ids = new Set<string>();
	for (const nd of canvas.getData().nodes) {
		if (nd.type === "group") ids.add(nd.id);
	}
	return ids;
}

/**
 * Find a TreeNode by ID across all trees in a forest.
 */
export function findTreeForNode(
	forest: TreeNode[],
	nodeId: string
): TreeNode | null {
	for (const root of forest) {
		const found = findTreeNode(root, nodeId);
		if (found) return found;
	}
	return null;
}

function countReachable(node: TreeNode): number {
	let count = 1;
	for (const child of node.children) {
		count += countReachable(child);
	}
	return count;
}

function setDepths(node: TreeNode, depth: number): void {
	node.depth = depth;
	for (const child of node.children) {
		setDepths(child, depth + 1);
	}
}

/**
 * Find the TreeNode corresponding to a canvas node ID within a single tree.
 */
function findTreeNode(
	root: TreeNode,
	nodeId: string
): TreeNode | null {
	if (root.canvasNode.id === nodeId) return root;
	for (const child of root.children) {
		const found = findTreeNode(child, nodeId);
		if (found) return found;
	}
	return null;
}

/**
 * Get all descendants of a tree node (for collapse/expand).
 */
export function getDescendants(node: TreeNode): TreeNode[] {
	const result: TreeNode[] = [];
	for (const child of node.children) {
		result.push(child);
		result.push(...getDescendants(child));
	}
	return result;
}

/**
 * Count total descendants.
 */
export function countDescendants(node: TreeNode): number {
	let count = 0;
	for (const child of node.children) {
		count += 1 + countDescendants(child);
	}
	return count;
}

/**
 * Get the next sibling, or null if last.
 */
export function getNextSibling(node: TreeNode): TreeNode | null {
	if (!node.parent) return null;
	const siblings = node.parent.children;
	const idx = siblings.indexOf(node);
	return idx < siblings.length - 1 ? siblings[idx + 1] : null;
}

/**
 * Get the previous sibling, or null if first.
 */
export function getPrevSibling(node: TreeNode): TreeNode | null {
	if (!node.parent) return null;
	const siblings = node.parent.children;
	const idx = siblings.indexOf(node);
	return idx > 0 ? siblings[idx - 1] : null;
}

/**
 * Get the first child, or null if leaf.
 */
export function getFirstChild(node: TreeNode): TreeNode | null {
	return node.children.length > 0 ? node.children[0] : null;
}

/**
 * Assign branch directions to all nodes in the tree.
 * Depth-1 children: direction based on X-center relative to root X-center.
 * Deeper children: inherit direction from their depth-1 ancestor.
 */
function assignDirections(root: TreeNode): void {
	const rootCx = root.canvasNode.x + root.canvasNode.width / 2;

	for (const child of root.children) {
		const childCx = child.canvasNode.x + child.canvasNode.width / 2;
		child.direction = childCx >= rootCx ? "right" : "left";
		propagateDirection(child, child.direction);
	}
}

function propagateDirection(node: TreeNode, dir: BranchDirection): void {
	for (const child of node.children) {
		child.direction = dir;
		propagateDirection(child, dir);
	}
}

/**
 * Count how many direct children of root are on each side.
 */
export function countChildrenPerSide(
	root: TreeNode
): { left: number; right: number } {
	let left = 0;
	let right = 0;
	for (const child of root.children) {
		if (child.direction === "left") left++;
		else right++;
	}
	return { left, right };
}
