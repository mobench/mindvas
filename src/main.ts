import { Plugin, Notice, TFolder, debounce, WorkspaceLeaf, setIcon } from "obsidian";
import type { Canvas } from "./types/canvas-internal";
import { CanvasAPI } from "./canvas/canvas-api";
import { NodeOperations } from "./mindmap/node-operations";
import { LayoutEngine } from "./mindmap/layout-engine";
import { BranchColors } from "./mindmap/branch-colors";
import { KeyboardHandler } from "./ui/keyboard-handler";

import { Navigation } from "./ui/navigation";
import {
	MindMapSettings,
	DEFAULT_SETTINGS,
	MindMapSettingTab,
} from "./settings";
import { registerDragEndHandler } from "./canvas/edge-updater";
import { registerSubtreeDragHandler } from "./canvas/subtree-drag";
import { registerGroupDragHandler } from "./canvas/group-drag";
import { registerAutoResize, AutoResizeHandle, getEditorElements } from "./ui/auto-resize";
import { TocView, TOC_VIEW_TYPE } from "./ui/toc-view";
import { freemindToCanvas } from "./import/freemind-import";
import { getGroupIds, buildForest, findTreeForNode } from "./mindmap/tree-model";

export default class CanvasMindMapPlugin extends Plugin {
	settings: MindMapSettings = DEFAULT_SETTINGS;

	private canvasApi!: CanvasAPI;
	private nodeOps!: NodeOperations;
	private layoutEngine!: LayoutEngine;
	private branchColors!: BranchColors;
	private keyboardHandler!: KeyboardHandler;

	private navigation!: Navigation;
	private cleanupClickHandler: (() => void) | null = null;
	private cleanupDragHandler: (() => void) | null = null;
	private cleanupSubtreeDragHandler: (() => void) | null = null;
	private cleanupGroupDragHandler: (() => void) | null = null;
	private autoResizeHandle: AutoResizeHandle | null = null;
	private interceptedCanvas: Canvas | null = null;
	private toggleBtnEl: HTMLElement | null = null;
	private cleanupGroupBoundsHandler: (() => void) | null = null;
	/** Pending timers/observers/RAFs to cancel on unload or canvas switch. */
	private pendingTimers: Set<ReturnType<typeof setTimeout>> = new Set();
	private pendingRafs: Set<number> = new Set();
	private pendingObservers: Set<MutationObserver> = new Set();
	/** Original canvas methods for unwrapping on cleanup. */
	private origCanvasMethods: {
		requestSave?: () => void;
		createGroupNode?: (options: any) => any;
	} = {};
	/** Set to true on unload to prevent deferred callbacks from running. */
	private unloaded = false;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Initialize core services
		this.canvasApi = new CanvasAPI(this.app);
		this.nodeOps = new NodeOperations(this.canvasApi, {
			nodeWidth: this.settings.defaultNodeWidth,
			nodeHeight: this.settings.defaultNodeHeight,
			horizontalGap: this.settings.horizontalGap,
			verticalGap: this.settings.verticalGap,
		});
		this.layoutEngine = new LayoutEngine({
			horizontalGap: this.settings.horizontalGap,
			verticalGap: this.settings.verticalGap,
			nodeWidth: this.settings.defaultNodeWidth,
			nodeHeight: this.settings.defaultNodeHeight,
		});
		this.branchColors = new BranchColors(this.canvasApi);
		this.navigation = new Navigation(this.canvasApi);

		// Register keyboard shortcuts
		this.keyboardHandler = new KeyboardHandler(
			this,
			this.canvasApi,
			this.nodeOps,
			this.layoutEngine,
			this.branchColors,
			() => this.settings.autoColor,
			(canvas: Canvas) => this.isMindmapCanvas(canvas),
			(canvas: Canvas) => this.updateGroupBounds(canvas)
		);
		this.keyboardHandler.zoomPadding = this.settings.navigationZoomPadding;
		this.keyboardHandler.register();

		// Command: Re-layout entire mind map
		this.addCommand({
			id: "mindmap-relayout",
			name: "Re-layout mind map",
			checkCallback: (checking: boolean) => {
				const canvas = this.canvasApi.getActiveCanvas();
				if (!canvas) return false;
				if (!this.isMindmapCanvas(canvas)) return false;
				if (checking) return true;
				this.layoutEngine.layout(canvas);
				this.updateGroupBounds(canvas);
			},
		});

		// Command: Resize + re-layout selected subtree (Ctrl+Shift+L)
		this.addCommand({
			id: "mindmap-resize-subtree",
			name: "Resize & re-layout selected subtree",
			checkCallback: (checking: boolean) => {
				const canvas = this.canvasApi.getActiveCanvas();
				if (!canvas) return false;
				const node = this.canvasApi.getSelectedNode(canvas);
				if (!node) return false;
				if (checking) return true;
				const wasEditing = node.isEditing;
				this.resizeNodes(canvas, this.collectSubtreeNodes(canvas, node));
				this.layoutEngine.layoutChildren(canvas, node.id);
				this.updateGroupBounds(canvas);
				if (wasEditing) node.startEditing();
			},
		});

		// Command: Resize all nodes to fit content (Ctrl+Shift+Alt+R)
		this.addCommand({
			id: "mindmap-resize-all",
			name: "Resize all nodes to fit content",
			checkCallback: (checking: boolean) => {
				const canvas = this.canvasApi.getActiveCanvas();
				if (!canvas) return false;
				if (!this.isMindmapCanvas(canvas)) return false;
				if (canvas.nodes.size === 0) return false;
				if (checking) return true;
				this.resizeNodes(canvas, Array.from(canvas.nodes.values()));
				this.layoutEngine.layout(canvas);
				this.updateGroupBounds(canvas);
			},
		});

		// Command: Apply branch colors
		this.addCommand({
			id: "mindmap-apply-colors",
			name: "Apply branch colors",
			checkCallback: (checking: boolean) => {
				const canvas = this.canvasApi.getActiveCanvas();
				if (!canvas) return false;
				if (!this.isMindmapCanvas(canvas)) return false;
				if (checking) return true;
				this.branchColors.applyColors(canvas);
			},
		});

		// Command: Toggle mindmap mode for current canvas
		this.addCommand({
			id: "mindmap-toggle-mode",
			name: "Toggle mindmap mode for this canvas",
			checkCallback: (checking: boolean) => {
				const canvas = this.canvasApi.getActiveCanvas();
				if (!canvas) return false;
				if (checking) return true;
				this.toggleMindmapMode(canvas);
			},
		});

		// Watch for canvas view activation to set up UI
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				this.onLeafChange(leaf);
			})
		);

		// Register TOC sidebar view
		this.registerView(TOC_VIEW_TYPE, (leaf) => new TocView(leaf));

		// Command: Toggle TOC panel
		this.addCommand({
			id: "mindmap-toggle-toc",
			name: "Toggle Table of Contents",
			callback: async () => {
				const leaves = this.app.workspace.getLeavesOfType(TOC_VIEW_TYPE);
				if (leaves.length > 0) {
					leaves[0].detach();
				} else {
					const leaf = this.app.workspace.getRightLeaf(false);
					if (leaf) {
						await leaf.setViewState({ type: TOC_VIEW_TYPE });
						this.app.workspace.revealLeaf(leaf);
					}
				}
			},
		});

		// Import FreeMind: right-click context menu on folders
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				// Show on folders only
				if (!(file instanceof TFolder)) return;

				menu.addItem((item) => {
					item.setTitle("Import FreeMind (.mm) to Canvas")
						.setIcon("file-input")
						.onClick(() => this.importFreeMindFile(file.path));
				});
			})
		);

		// Import FreeMind: command palette
		this.addCommand({
			id: "mindmap-import-freemind",
			name: "Import FreeMind (.mm) file to Canvas",
			callback: () => this.importFreeMindFile(),
		});

		// Settings tab
		this.addSettingTab(new MindMapSettingTab(this.app, this));

	}

	onunload(): void {
		this.unloaded = true;
		// Cancel all pending async operations first
		this.cancelPendingAsync();
		this.unwrapCanvasMethods();

		if (this.cleanupClickHandler) {
			this.cleanupClickHandler();
			this.cleanupClickHandler = null;
		}
		if (this.cleanupDragHandler) {
			this.cleanupDragHandler();
			this.cleanupDragHandler = null;
		}
		if (this.cleanupSubtreeDragHandler) {
			this.cleanupSubtreeDragHandler();
			this.cleanupSubtreeDragHandler = null;
		}
		if (this.cleanupGroupDragHandler) {
			this.cleanupGroupDragHandler();
			this.cleanupGroupDragHandler = null;
		}
		if (this.cleanupGroupBoundsHandler) {
			this.cleanupGroupBoundsHandler();
			this.cleanupGroupBoundsHandler = null;
		}
		if (this.autoResizeHandle) {
			this.autoResizeHandle.cleanup();
			this.autoResizeHandle = null;
		}
		if (this.toggleBtnEl) {
			this.toggleBtnEl.remove();
			this.toggleBtnEl = null;
		}
	}

	/**
	 * Called when the active leaf changes — set up canvas-specific UI.
	 */
	private onLeafChange(leaf: WorkspaceLeaf | null): void {
		// Don't clean up when focus moves to our own TOC sidebar
		if (leaf?.view?.getViewType() === TOC_VIEW_TYPE) return;

		// Cancel pending async operations and unwrap previous canvas
		this.cancelPendingAsync();
		this.unwrapCanvasMethods();

		// Clean up previous canvas handlers
		if (this.cleanupClickHandler) {
			this.cleanupClickHandler();
			this.cleanupClickHandler = null;
		}
		if (this.cleanupDragHandler) {
			this.cleanupDragHandler();
			this.cleanupDragHandler = null;
		}
		if (this.cleanupSubtreeDragHandler) {
			this.cleanupSubtreeDragHandler();
			this.cleanupSubtreeDragHandler = null;
		}
		if (this.cleanupGroupDragHandler) {
			this.cleanupGroupDragHandler();
			this.cleanupGroupDragHandler = null;
		}
		if (this.cleanupGroupBoundsHandler) {
			this.cleanupGroupBoundsHandler();
			this.cleanupGroupBoundsHandler = null;
		}
		if (this.autoResizeHandle) {
			this.autoResizeHandle.cleanup();
			this.autoResizeHandle = null;
		}

		const canvas = this.canvasApi.getActiveCanvas();
		if (!canvas) {
			if (this.toggleBtnEl) {
				this.toggleBtnEl.remove();
				this.toggleBtnEl = null;
			}
			this.clearToc();
			return;
		}

		// Inject mindmap toggle button into canvas toolbar
		this.injectToggleButton(canvas);

		// Set up Ctrl+click zoom handler
		this.cleanupClickHandler =
			this.navigation.registerClickHandler(canvas);

		// Set up drag-end edge update handler
		this.cleanupDragHandler =
			registerDragEndHandler(canvas);

		// Set up subtree drag handler (move descendants with parent)
		this.cleanupSubtreeDragHandler =
			registerSubtreeDragHandler(canvas, this.canvasApi);

		// Set up group drag handler (Alt+drag leaves stranger nodes behind)
		this.cleanupGroupDragHandler =
			registerGroupDragHandler(canvas, this.canvasApi);

		// Update group bounds after any drag operation (deferred to let positions settle)
		const onDragEnd = () => this.trackedRaf(() => this.updateGroupBounds(canvas));
		canvas.wrapperEl.addEventListener('pointerup', onDragEnd);
		this.cleanupGroupBoundsHandler = () =>
			canvas.wrapperEl.removeEventListener('pointerup', onDragEnd);

		// Set up auto-resize handler (grow/shrink nodes with content)
		this.autoResizeHandle = registerAutoResize(
			canvas,
			{
				minHeight: this.settings.defaultNodeHeight,
				maxHeight: this.settings.maxNodeHeight,
			},
			(canvas, editedNode) => {
				this.waitForPreview(editedNode, () => {
					// Guard: skip if canvas changed while waiting
					if (this.canvasApi.getActiveCanvas() !== canvas) return;
					const forest = buildForest(canvas);
					const treeNode = findTreeForNode(forest, editedNode.id);
					if (!treeNode) return;
					let root = treeNode;
					while (root.parent) root = root.parent;
					this.resizeNodes(canvas, this.collectSubtreeNodes(canvas, root.canvasNode));
					this.layoutEngine.layoutChildren(canvas, root.canvasNode.id);
					this.updateGroupBounds(canvas);
				});
			}
		);
		this.keyboardHandler.onBeforeLeaveNode = () => {
			this.autoResizeHandle?.finalizeNode();
			const node = this.canvasApi.getSelectedNode(canvas);
			if (node?.isEditing) {
				this.waitForPreview(node, () => {
					// Guard: skip if canvas changed while waiting
					if (this.canvasApi.getActiveCanvas() !== canvas) return;
					this.resizeNodes(canvas, [node]);
					this.relayoutFromRoot(canvas, node);
				});
			}
		};

		// Auto-color if enabled (mindmap only)
		if (this.settings.autoColor && this.isMindmapCanvas(canvas)) {
			this.branchColors.applyColors(canvas);
		}

		// Intercept canvas methods (store originals for cleanup)
		const origSave = canvas.requestSave.bind(canvas);
		const origCreateGroup = canvas.createGroupNode.bind(canvas);
		this.origCanvasMethods = { requestSave: origSave, createGroupNode: origCreateGroup };
		this.interceptedCanvas = canvas;

		canvas.requestSave = () => {
			origSave();
			this.debouncedTocRefresh();
		};
		canvas.createGroupNode = (options: any) => {
			const group = origCreateGroup(options);
			this.updateGroupBounds(canvas);
			return group;
		};
		this.refreshToc(canvas);
	}

	private debouncedTocRefresh = debounce(() => {
		if (this.unloaded) return;
		const canvas = this.canvasApi.getActiveCanvas()
			?? this.canvasApi.getAnyCanvas();
		if (canvas) {
			this.refreshToc(canvas);
		} else {
			this.clearToc();
		}
	}, 300);

	private refreshToc(canvas: Canvas): void {
		for (const leaf of this.app.workspace.getLeavesOfType(TOC_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof TocView) view.refresh(canvas);
		}
	}

	/**
	 * Collect a node and all its descendants via BFS.
	 */
	private collectSubtreeNodes(canvas: Canvas, root: import("./types/canvas-internal").CanvasNode): import("./types/canvas-internal").CanvasNode[] {
		const result = [root];
		const visited = new Set<string>([root.id]);
		const queue = [root.id];
		while (queue.length > 0) {
			const id = queue.shift()!;
			for (const edge of this.canvasApi.getOutgoingEdges(canvas, id)) {
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
	 * Recalculate bounds for all groups to tightly fit their contained subtrees.
	 * A root node belongs to a group if its center is inside the group's current bounds.
	 */
	updateGroupBounds(canvas: Canvas): void {
		const PADDING = 20;
		const groupIds = getGroupIds(canvas);
		if (groupIds.size === 0) return;

		let changed = false;

		for (const groupId of groupIds) {
			const group = canvas.nodes.get(groupId);
			if (!group) continue;

			const gx = group.x;
			const gy = group.y;
			const gw = group.width;
			const gh = group.height;

			// Collect subtrees of all non-group nodes whose center is inside this group
			const contained = new Set<import("./types/canvas-internal").CanvasNode>();
			for (const node of canvas.nodes.values()) {
				if (groupIds.has(node.id)) continue;
				const cx = node.x + node.width / 2;
				const cy = node.y + node.height / 2;
				if (cx >= gx && cx <= gx + gw && cy >= gy && cy <= gy + gh) {
					for (const n of this.collectSubtreeNodes(canvas, node)) {
						contained.add(n);
					}
				}
			}

			// No nodes inside — leave group unchanged
			if (contained.size === 0) continue;

			// Compute bounding box
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const node of contained) {
				minX = Math.min(minX, node.x);
				minY = Math.min(minY, node.y);
				maxX = Math.max(maxX, node.x + node.width);
				maxY = Math.max(maxY, node.y + node.height);
			}

			const newX = minX - PADDING;
			const newY = minY - PADDING;
			const newW = (maxX - minX) + PADDING * 2;
			const newH = (maxY - minY) + PADDING * 2;

			// Only resize if bounds actually changed
			if (newX !== gx || newY !== gy || newW !== gw || newH !== gh) {
				group.nodeEl?.addClass('mindmap-group-animating');
				group.moveAndResize({ x: newX, y: newY, width: newW, height: newH });
				changed = true;
			}
		}

		if (changed) {
			canvas.requestSave();
			// Remove animation class after transition completes
			this.trackedTimeout(() => {
				for (const groupId of groupIds) {
					const group = canvas.nodes.get(groupId);
					group?.nodeEl?.removeClass('mindmap-group-animating');
				}
			}, 260);
		}
	}

	/**
	 * Wait for a node's preview sizer to appear in the DOM, then invoke callback.
	 * Uses MutationObserver instead of arbitrary setTimeout for precise timing.
	 */
	private waitForPreview(node: import("./types/canvas-internal").CanvasNode, callback: () => void): void {
		const sizer = node.contentEl?.querySelector(".markdown-preview-sizer");
		if (sizer && !node.isEditing) {
			callback();
			return;
		}
		const observer = new MutationObserver(() => {
			const s = node.contentEl?.querySelector(".markdown-preview-sizer");
			if (s && !node.isEditing) {
				observer.disconnect();
				this.pendingObservers.delete(observer);
				this.trackedRaf(() => callback());
			}
		});
		this.pendingObservers.add(observer);
		observer.observe(node.contentEl, { childList: true, subtree: true });
		this.trackedTimeout(() => {
			observer.disconnect();
			this.pendingObservers.delete(observer);
		}, 500);
	}

	/**
	 * Find the root of the tree containing a node and relayout from there.
	 */
	private relayoutFromRoot(canvas: Canvas, node: import("./types/canvas-internal").CanvasNode): void {
		const forest = buildForest(canvas);
		const treeNode = findTreeForNode(forest, node.id);
		if (!treeNode) return;
		let root = treeNode;
		while (root.parent) root = root.parent;
		this.layoutEngine.layoutChildren(canvas, root.canvasNode.id);
		this.updateGroupBounds(canvas);
	}

	/**
	 * Resize nodes to fit their rendered content, capped at maxNodeHeight.
	 * Handles both preview mode (markdown sizer) and edit mode (CodeMirror).
	 */
	private resizeNodes(canvas: Canvas, nodes: import("./types/canvas-internal").CanvasNode[]): void {
		const minH = this.settings.defaultNodeHeight;
		const maxH = this.settings.maxNodeHeight;
		const targetW = this.settings.defaultNodeWidth;
		const BORDER = 2;
		const SCALE = 1.2;
		let changed = false;
		const unmeasurable: import("./types/canvas-internal").CanvasNode[] = [];

		for (const node of nodes) {
			let contentH: number | null = null;
			let targetH = node.height;

			if (node.isEditing) {
				// Editing: measure via CodeMirror .cm-content
				const { cmContent, scroller } = getEditorElements(node);
				if (cmContent && scroller) {
					contentH = 0;
					for (const child of Array.from(cmContent.children)) {
						contentH += (child as HTMLElement).offsetHeight;
					}
					targetH = Math.min(Math.max(Math.ceil(contentH * SCALE) + BORDER, minH), maxH);
					if (targetH !== node.height || targetW !== node.width) {
						node.moveAndResize({ x: node.x, y: node.y, width: targetW, height: targetH });
						changed = true;
					}
					continue;
				}
			}

			// Preview mode: measure via .markdown-preview-sizer children
			const sizer = node.contentEl?.querySelector(".markdown-preview-sizer") as HTMLElement | null;
			if (!sizer) {
				// DOM not rendered (off-screen node) — apply width, collect for height retry
				if (node.width !== targetW) {
					node.moveAndResize({ x: node.x, y: node.y, width: targetW, height: node.height });
					changed = true;
				}
				if (node.text) unmeasurable.push(node);
				continue;
			}

			contentH = 0;
			for (const child of Array.from(sizer.children)) {
				contentH += (child as HTMLElement).offsetHeight;
			}

			// If we measured 0 but the node has text, the DOM isn't rendered yet
			// (off-screen virtualization). Apply width but skip height change.
			if (contentH === 0 && node.text) {
				if (node.width !== targetW) {
					node.moveAndResize({ x: node.x, y: node.y, width: targetW, height: node.height });
					changed = true;
				}
				unmeasurable.push(node);
				continue;
			}

			targetH = Math.min(Math.max(Math.ceil(contentH * SCALE) + BORDER, minH), maxH);
			if (targetH === node.height && targetW === node.width) continue;

			node.moveAndResize({ x: node.x, y: node.y, width: targetW, height: targetH });
			changed = true;
		}

		if (changed) canvas.requestSave();

		// Retry unmeasurable nodes after a delay to let Obsidian render them
		if (unmeasurable.length > 0) {
			this.trackedTimeout(() => this.resizeNodesRetry(canvas, unmeasurable, minH, maxH, BORDER, SCALE), 200);
		}
	}

	/**
	 * Retry resizing nodes that couldn't be measured on the first pass.
	 * After layout repositions nodes, Obsidian may have rendered their content.
	 */
	private resizeNodesRetry(
		canvas: Canvas,
		nodes: import("./types/canvas-internal").CanvasNode[],
		minH: number, maxH: number, BORDER: number, SCALE: number
	): void {
		let changed = false;
		for (const node of nodes) {
			const sizer = node.contentEl?.querySelector(".markdown-preview-sizer") as HTMLElement | null;
			if (!sizer) continue;

			let contentH = 0;
			for (const child of Array.from(sizer.children)) {
				contentH += (child as HTMLElement).offsetHeight;
			}
			if (contentH === 0) continue;

			const targetH = Math.min(Math.max(Math.ceil(contentH * SCALE) + BORDER, minH), maxH);
			if (targetH === node.height) continue;

			node.moveAndResize({ x: node.x, y: node.y, width: node.width, height: targetH });
			changed = true;
		}
		if (changed) canvas.requestSave();
	}

	private clearToc(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(TOC_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof TocView) view.clear();
		}
	}

	/**
	 * Import a FreeMind .mm file and create a .canvas file.
	 * @param folderPath Optional target folder; defaults to vault root.
	 */
	private async importFreeMindFile(folderPath?: string): Promise<void> {
		// Open native file picker for .mm files
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".mm";
		const onChange = async () => {
			input.removeEventListener("change", onChange);
			const file = input.files?.[0];
			if (!file) return;

			const xml = await file.text();
			const canvasData = freemindToCanvas(xml, {
				nodeWidth: this.settings.defaultNodeWidth,
				nodeHeight: this.settings.defaultNodeHeight,
				maxNodeHeight: this.settings.maxNodeHeight,
				horizontalGap: this.settings.horizontalGap,
				verticalGap: this.settings.verticalGap,
			});

			if (!canvasData) {
				new Notice(
					"Failed to parse FreeMind file. Make sure it is a valid .mm file."
				);
				return;
			}

			const baseName = file.name.replace(/\.mm$/i, "");
			const folder = folderPath ? folderPath + "/" : "";
			let canvasPath = `${folder}${baseName}.canvas`;

			// Avoid overwriting existing files
			let counter = 1;
			while (this.app.vault.getAbstractFileByPath(canvasPath)) {
				canvasPath = `${folder}${baseName} ${counter}.canvas`;
				counter++;
			}

			await this.app.vault.create(
				canvasPath,
				JSON.stringify(canvasData, null, "\t")
			);

			// Open the new canvas
			const created = this.app.vault.getAbstractFileByPath(canvasPath);
			if (created) {
				await this.app.workspace.getLeaf(false).openFile(created as any);
			}

			new Notice(
				`Imported "${file.name}" as "${canvasPath}"`
			);
		};
		input.addEventListener("change", onChange);
		input.click();
	}

	isMindmapCanvas(canvas: Canvas): boolean {
		const data = canvas.getData();
		if (typeof data.mindmap === 'boolean') return data.mindmap;
		return this.settings.defaultMindmapMode;
	}

	private toggleMindmapMode(canvas: Canvas): void {
		const data = canvas.getData();
		const newValue = !this.isMindmapCanvas(canvas);
		(data as any).mindmap = newValue;
		canvas.setData(data);
		canvas.requestSave();

		// Re-apply or remove auto-color
		if (newValue && this.settings.autoColor) {
			this.branchColors.applyColors(canvas);
		}

		this.updateToggleButton(canvas);
	}

	private injectToggleButton(canvas: Canvas): void {
		// Remove previous button
		if (this.toggleBtnEl) {
			this.toggleBtnEl.remove();
			this.toggleBtnEl = null;
		}

		const controls = canvas.view.containerEl.querySelector('.canvas-controls');
		if (!controls) return;

		const btn = document.createElement('div');
		btn.addClass('mindvas-toggle-btn', 'clickable-icon');
		btn.setAttribute('aria-label', 'Toggle mindmap mode');
		this.registerDomEvent(btn, 'click', (e) => {
			e.stopPropagation();
			this.toggleMindmapMode(canvas);
		});

		controls.prepend(btn);
		this.toggleBtnEl = btn;
		this.updateToggleButton(canvas);
	}

	private updateToggleButton(canvas: Canvas): void {
		if (!this.toggleBtnEl) return;
		const isActive = this.isMindmapCanvas(canvas);
		this.toggleBtnEl.empty();
		setIcon(this.toggleBtnEl, isActive ? 'network' : 'layout-dashboard');
		this.toggleBtnEl.toggleClass('is-active', isActive);
		this.toggleBtnEl.setAttribute('aria-label',
			isActive ? 'Mindmap mode (active)' : 'Mindmap mode (inactive)');
	}

	/** Schedule a setTimeout that is automatically cancelled on unload/canvas switch. */
	private trackedTimeout(callback: () => void, ms: number): void {
		const id = setTimeout(() => {
			this.pendingTimers.delete(id);
			callback();
		}, ms);
		this.pendingTimers.add(id);
	}

	/** Schedule a requestAnimationFrame that is automatically cancelled on cleanup. */
	private trackedRaf(callback: () => void): void {
		const id = requestAnimationFrame(() => {
			this.pendingRafs.delete(id);
			callback();
		});
		this.pendingRafs.add(id);
	}

	/** Cancel all pending tracked timers, RAFs, and observers. */
	private cancelPendingAsync(): void {
		for (const id of this.pendingTimers) clearTimeout(id);
		this.pendingTimers.clear();
		for (const id of this.pendingRafs) cancelAnimationFrame(id);
		this.pendingRafs.clear();
		for (const obs of this.pendingObservers) obs.disconnect();
		this.pendingObservers.clear();
	}

	/** Restore wrapped canvas methods to originals. */
	private unwrapCanvasMethods(): void {
		if (this.interceptedCanvas) {
			if (this.origCanvasMethods.requestSave) {
				this.interceptedCanvas.requestSave = this.origCanvasMethods.requestSave;
			}
			if (this.origCanvasMethods.createGroupNode) {
				this.interceptedCanvas.createGroupNode = this.origCanvasMethods.createGroupNode;
			}
		}
		this.interceptedCanvas = null;
		this.origCanvasMethods = {};
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		// Update services with new settings
		this.layoutEngine = new LayoutEngine({
			horizontalGap: this.settings.horizontalGap,
			verticalGap: this.settings.verticalGap,
			nodeWidth: this.settings.defaultNodeWidth,
			nodeHeight: this.settings.defaultNodeHeight,
		});
		this.nodeOps = new NodeOperations(this.canvasApi, {
			nodeWidth: this.settings.defaultNodeWidth,
			nodeHeight: this.settings.defaultNodeHeight,
			horizontalGap: this.settings.horizontalGap,
			verticalGap: this.settings.verticalGap,
		});

		// Update keyboard handler references so it uses the new instances
		if (this.keyboardHandler) {
			this.keyboardHandler.nodeOps = this.nodeOps;
			this.keyboardHandler.layoutEngine = this.layoutEngine;
			this.keyboardHandler.zoomPadding = this.settings.navigationZoomPadding;
		}
	}
}
