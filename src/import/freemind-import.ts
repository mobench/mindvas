import type {
	CanvasFileData,
	CanvasNodeFileData,
	CanvasEdgeFileData,
	NodeSide,
} from "../types/canvas-internal";
import { genId } from "../canvas/canvas-api";

type Position = "left" | "right";

interface FreeMindNode {
	text: string;
	position: Position;
	children: FreeMindNode[];
}

interface LayoutOptions {
	nodeWidth: number;
	nodeHeight: number;
	maxNodeHeight: number;
	horizontalGap: number;
	verticalGap: number;
}

/**
 * Parse a FreeMind/Coggle (.mm) XML string into a list of root trees.
 * Handles both standard FreeMind (<node> under <map>) and Coggle
 * exports (<x-coggle-rootnode> siblings).
 */
function parseFreeMindXml(xml: string): FreeMindNode[] {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, "text/xml");

	const errorNode = doc.querySelector("parsererror");
	if (errorNode) return [];

	const mapEl = doc.querySelector("map");
	if (!mapEl) return [];

	const roots: FreeMindNode[] = [];

	for (const child of Array.from(mapEl.children)) {
		if (child.tagName === "node" || child.tagName === "x-coggle-rootnode") {
			roots.push(parseNode(child, "right"));
		}
	}

	return roots;
}

function parseNode(el: Element, inheritedPosition: Position): FreeMindNode {
	const text = el.getAttribute("TEXT") || "Untitled";
	const posAttr = el.getAttribute("POSITION");
	const position: Position =
		posAttr === "left" ? "left" :
		posAttr === "right" ? "right" :
		inheritedPosition;
	const children: FreeMindNode[] = [];

	for (const child of Array.from(el.children)) {
		if (child.tagName === "node" || child.tagName === "x-coggle-rootnode") {
			children.push(parseNode(child, position));
		}
	}

	return { text, position, children };
}

/**
 * Estimate node height based on text content.
 * Uses a rough heuristic: ~8px per character width, ~22px line height, ~20px padding.
 */
function estimateNodeHeight(text: string, nodeWidth: number, minHeight: number, maxHeight: number): number {
	const AVG_CHAR_WIDTH = 8;
	const LINE_HEIGHT = 22;
	const PADDING = 20;

	const charsPerLine = Math.max(1, Math.floor((nodeWidth - PADDING) / AVG_CHAR_WIDTH));
	const paragraphs = text.split("\n");
	let totalLines = 0;

	for (const para of paragraphs) {
		if (para.length === 0) {
			totalLines += 1;
		} else {
			totalLines += Math.ceil(para.length / charsPerLine);
		}
	}

	const estimated = totalLines * LINE_HEIGHT + PADDING;
	return Math.min(Math.max(estimated, minHeight), maxHeight);
}


/**
 * Get the estimated height for a single node.
 */
function nodeHeight(node: FreeMindNode, opts: LayoutOptions): number {
	return estimateNodeHeight(node.text, opts.nodeWidth, opts.nodeHeight, opts.maxNodeHeight);
}

/**
 * Measure the total height of a subtree (for vertical centering).
 */
function subtreeHeight(
	node: FreeMindNode,
	opts: LayoutOptions
): number {
	if (node.children.length === 0) return nodeHeight(node, opts);

	let total = 0;
	for (let i = 0; i < node.children.length; i++) {
		if (i > 0) total += opts.verticalGap;
		total += subtreeHeight(node.children[i], opts);
	}
	return Math.max(nodeHeight(node, opts), total);
}

/**
 * Measure total height for a subset of children.
 */
function groupHeight(
	children: FreeMindNode[],
	opts: LayoutOptions
): number {
	if (children.length === 0) return 0;
	let total = 0;
	for (let i = 0; i < children.length; i++) {
		if (i > 0) total += opts.verticalGap;
		total += subtreeHeight(children[i], opts);
	}
	return total;
}

/**
 * Layout a single tree with left/right positioning support.
 */
function layoutTree(
	root: FreeMindNode,
	startX: number,
	startY: number,
	opts: LayoutOptions,
	nodes: CanvasNodeFileData[],
	edges: CanvasEdgeFileData[]
): number {
	// Place root node
	const rootH = nodeHeight(root, opts);
	const rootId = genId();
	nodes.push({
		id: rootId,
		type: "text",
		x: startX,
		y: startY,
		width: opts.nodeWidth,
		height: rootH,
		text: root.text,
	});

	if (root.children.length === 0) return rootH;

	// Partition direct children by position
	const rightChildren = root.children.filter(c => c.position === "right");
	const leftChildren = root.children.filter(c => c.position === "left");

	const rootCy = startY + rootH / 2;

	// Layout right side
	layoutSide(rootId, rightChildren, "right", startX, rootCy, opts, nodes, edges);

	// Layout left side
	layoutSide(rootId, leftChildren, "left", startX, rootCy, opts, nodes, edges);

	// Calculate total height across both sides
	const rightH = groupHeight(rightChildren, opts);
	const leftH = groupHeight(leftChildren, opts);
	return Math.max(rootH, rightH, leftH);
}

/**
 * Layout children on one side of a parent, vertically centered around parentCy.
 */
function layoutSide(
	parentId: string,
	children: FreeMindNode[],
	side: Position,
	parentX: number,
	parentCy: number,
	opts: LayoutOptions,
	nodes: CanvasNodeFileData[],
	edges: CanvasEdgeFileData[]
): void {
	if (children.length === 0) return;

	const totalH = groupHeight(children, opts);
	let childY = parentCy - totalH / 2;

	const fromSide: NodeSide = side === "right" ? "right" : "left";
	const toSide: NodeSide = side === "right" ? "left" : "right";
	const childX = side === "right"
		? parentX + opts.nodeWidth + opts.horizontalGap
		: parentX - opts.nodeWidth - opts.horizontalGap;

	for (const child of children) {
		const childH = subtreeHeight(child, opts);
		const childNodeY = childY + childH / 2 - nodeHeight(child, opts) / 2;
		const childId = layoutBranch(child, childX, childNodeY, side, opts, nodes, edges);

		edges.push({
			id: genId(),
			fromNode: parentId,
			fromSide,
			fromEnd: "none",
			toNode: childId,
			toSide,
			toEnd: "arrow",
		});

		childY += childH + opts.verticalGap;
	}
}

/**
 * Recursively layout a node and its descendants on a given side.
 */
function layoutBranch(
	node: FreeMindNode,
	x: number,
	y: number,
	side: Position,
	opts: LayoutOptions,
	nodes: CanvasNodeFileData[],
	edges: CanvasEdgeFileData[]
): string {
	const h = nodeHeight(node, opts);
	const id = genId();
	nodes.push({
		id,
		type: "text",
		x,
		y,
		width: opts.nodeWidth,
		height: h,
		text: node.text,
	});

	if (node.children.length === 0) return id;

	const fromSide: NodeSide = side === "right" ? "right" : "left";
	const toSide: NodeSide = side === "right" ? "left" : "right";
	const childX = side === "right"
		? x + opts.nodeWidth + opts.horizontalGap
		: x - opts.nodeWidth - opts.horizontalGap;

	const totalH = groupHeight(node.children, opts);
	let childY = y + h / 2 - totalH / 2;

	for (const child of node.children) {
		const childH = subtreeHeight(child, opts);
		const childNodeY = childY + childH / 2 - nodeHeight(child, opts) / 2;
		const childId = layoutBranch(child, childX, childNodeY, side, opts, nodes, edges);

		edges.push({
			id: genId(),
			fromNode: id,
			fromSide,
			fromEnd: "none",
			toNode: childId,
			toSide,
			toEnd: "arrow",
		});

		childY += childH + opts.verticalGap;
	}

	return id;
}

/**
 * Convert a FreeMind/Coggle XML string to Obsidian Canvas JSON.
 * Supports multiple root nodes and left/right positioning.
 * Returns null if parsing fails.
 */
export function freemindToCanvas(
	xml: string,
	opts: LayoutOptions
): CanvasFileData | null {
	const roots = parseFreeMindXml(xml);
	if (roots.length === 0) return null;

	const nodes: CanvasNodeFileData[] = [];
	const edges: CanvasEdgeFileData[] = [];

	let currentY = 0;
	const treeGap = opts.verticalGap * 4;

	for (const root of roots) {
		const height = layoutTree(root, 0, currentY, opts, nodes, edges);
		currentY += height + treeGap;
	}

	return { nodes, edges, mindmap: true };
}
