import { EventRef, ItemView, Menu, WorkspaceLeaf } from "obsidian";

/** Augment Obsidian's types with undocumented APIs used by this plugin. */
declare module "obsidian" {
	interface Workspace {
		on(name: "canvas:node-menu", callback: (menu: Menu, node: CanvasNode) => void): EventRef;
	}
	interface WorkspaceTabs {
		children: WorkspaceLeaf[];
		selectTab?: (leaf: WorkspaceLeaf) => void;
	}
	interface WorkspaceMobileDrawer {
		children: WorkspaceLeaf[];
		selectTab?: (leaf: WorkspaceLeaf) => void;
	}
}

/**
 * Type declarations for Obsidian's undocumented Canvas runtime API.
 * These are reverse-engineered from the runtime object and may change between Obsidian versions.
 */

export interface CanvasNode {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color: string;
	text: string;
	type: "text" | "file" | "link" | "group";
	canvas: Canvas;
	nodeEl: HTMLElement;
	contentEl: HTMLElement;
	labelEl?: HTMLElement;
	isEditing: boolean;
	unknownData: Record<string, unknown>;

	moveTo(pos: { x: number; y: number }): void;
	moveAndResize(pos: {
		x: number;
		y: number;
		width: number;
		height: number;
	}): void;
	setColor(color: string): void;
	setText(text: string): void;
	startEditing(): void;
	blur(): void;
	focus(): void;
	getBBox(): { minX: number; minY: number; maxX: number; maxY: number };
}

export interface CanvasEdge {
	id: string;
	from: { node: CanvasNode; side: NodeSide; end: EdgeEnd };
	to: { node: CanvasNode; side: NodeSide; end: EdgeEnd };
	color: string;
	label: string;
	canvas: Canvas;
	lineEl?: HTMLElement;
	lineGroupEl?: HTMLElement;
	path?: { display: SVGPathElement };

	setColor(color: string): void;
}

export type NodeSide = "top" | "right" | "bottom" | "left";
export type EdgeEnd = "none" | "arrow";

export interface CreateNodeOptions {
	pos: { x: number; y: number };
	size?: { width: number; height: number };
	text?: string;
	type?: "text" | "file" | "link" | "group";
	focus?: boolean;
	save?: boolean;
}

export interface Canvas {
	nodes: Map<string, CanvasNode>;
	edges: Map<string, CanvasEdge>;
	selection: Set<CanvasNode | CanvasEdge>;
	nodeIndex: { data: unknown };

	view: CanvasView;
	wrapperEl: HTMLElement;

	x: number;
	y: number;
	zoom: number;
	tx: number;
	ty: number;
	tZoom: number;

	getData(): CanvasFileData;
	setData(data: CanvasFileData): void;
	importData(data: CanvasFileData): void;
	requestSave(): void;
	requestFrame(): void;

	createTextNode(options: CreateNodeOptions): CanvasNode;
	createFileNode(options: CreateNodeOptions & { file: string }): CanvasNode;
	createGroupNode(options: CreateNodeOptions & { label?: string }): CanvasNode;

	addNode(node: CanvasNode): void;
	removeNode(node: CanvasNode): void;

	addEdge(edge: CanvasEdge): void;
	removeEdge(edge: CanvasEdge): void;
	getEdgesForNode(node: CanvasNode): CanvasEdge[];

	selectOnly(item: CanvasNode | CanvasEdge): void;
	deselectAll(): void;
	getSelectionData(): { nodes: unknown[]; edges: unknown[] };

	zoomToSelection(): void;
	zoomToBbox(bbox: {
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
	}): void;
	zoomToFit(): void;

	posFromEvt(e: MouseEvent): { x: number; y: number };

	undo?: () => void;
	redo?: () => void;
}

export interface CanvasFileData {
	nodes: CanvasNodeFileData[];
	edges: CanvasEdgeFileData[];
	mindmap?: boolean;
}

export interface CanvasNodeFileData {
	id: string;
	type: "text" | "file" | "link" | "group";
	x: number;
	y: number;
	width: number;
	height: number;
	text?: string;
	file?: string;
	url?: string;
	color?: string;
	label?: string;
	[key: string]: unknown;
}

export interface CanvasEdgeFileData {
	id: string;
	fromNode: string;
	fromSide: NodeSide;
	fromEnd?: EdgeEnd;
	toNode: string;
	toSide: NodeSide;
	toEnd?: EdgeEnd;
	color?: string;
	label?: string;
}

export interface CanvasView extends ItemView {
	canvas: Canvas;
	file: { path: string };
}

/** Minimal CodeMirror 6 EditorView interface for text extraction. */
export interface CMEditorView {
	state: {
		selection: { main: { from: number; to: number } };
		sliceDoc: (from: number, to: number) => string;
	};
	dispatch: (tr: { changes: { from: number; to: number; insert: string } }) => void;
}

/** DOM element with a CodeMirror view reference attached by Obsidian. */
export interface CMContentElement extends HTMLElement {
	cmView?: { view: CMEditorView };
}

/** Obsidian's undocumented App.commands API for programmatic command execution. */
export interface ObsidianCommands {
	executeCommandById: (id: string) => boolean;
}
