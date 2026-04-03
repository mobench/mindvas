import { Plugin, Notice, TFile, TFolder, Menu, debounce, WorkspaceLeaf, setIcon, ItemView } from "obsidian";
import type { Canvas, CanvasNode, CanvasEdge, CreateNodeOptions } from "./types/canvas-internal";
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
import { OutlineView, OUTLINE_VIEW_TYPE } from "./ui/outline-view";
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
	private cleanupSelectionSyncHandler: (() => void) | null = null;
	private cleanupInsertNodeHandler: (() => void) | null = null;
	/** Pending timers/observers/RAFs to cancel on unload or canvas switch. */
	private pendingTimers: Set<ReturnType<typeof setTimeout>> = new Set();
	private pendingRafs: Set<number> = new Set();
	private pendingObservers: Set<MutationObserver> = new Set();
	/** Original canvas methods for unwrapping on cleanup. */
	private origCanvasMethods: {
		requestSave?: () => void;
		createGroupNode?: (options: CreateNodeOptions & { label?: string }) => import("./types/canvas-internal").CanvasNode;
		undo?: () => void;
		redo?: () => void;
		selectOnly?: (item: CanvasNode | CanvasEdge) => void;
	} = {};
	/** Set to true on unload to prevent deferred callbacks from running. */
	private unloaded = false;
	/** Navigation history for back/forward. */
	private navHistory: string[] = [];
	private navHistoryIndex = -1;
	private navSkipTracking = false;
	private lastNavCanvas: Canvas | null = null;
	private cleanupNavHandler: (() => void) | null = null;

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

		// Command: Layout forest (arrange trees within a group)
		this.addCommand({
			id: "mindmap-layout-forest",
			name: "Layout forest",
			checkCallback: (checking: boolean) => {
				const canvas = this.canvasApi.getActiveCanvas();
				if (!canvas) return false;
				if (!this.isMindmapCanvas(canvas)) return false;

				// Find the group containing the selected node
				const selected = this.canvasApi.getSelectedNode(canvas);
				if (!selected) return false;

				const groupIds = getGroupIds(canvas);
				const cx = selected.x + selected.width / 2;
				const cy = selected.y + selected.height / 2;
				let targetGroupId: string | null = null;
				let smallestArea = Infinity;

				for (const gid of groupIds) {
					const g = canvas.nodes.get(gid);
					if (!g) continue;
					if (cx >= g.x && cx <= g.x + g.width && cy >= g.y && cy <= g.y + g.height) {
						const area = g.width * g.height;
						if (area < smallestArea) {
							smallestArea = area;
							targetGroupId = gid;
						}
					}
				}

				if (!targetGroupId) return false;
				if (checking) return true;
				this.layoutEngine.layoutForest(canvas, targetGroupId);
			},
		});

		// Command: Detach subtree as independent tree
		this.addCommand({
			id: "mindmap-detach-subtree",
			name: "Detach subtree as independent tree",
			checkCallback: (checking: boolean) => {
				const canvas = this.canvasApi.getActiveCanvas();
				if (!canvas) return false;
				if (!this.isMindmapCanvas(canvas)) return false;

				const node = this.canvasApi.getSelectedNode(canvas);
				if (!node) return false;

				const parent = this.canvasApi.getParentNode(canvas, node);
				if (!parent) return false;

				if (checking) return true;

				const edges = this.canvasApi.getOutgoingEdges(canvas, parent.id);
				const edge = edges.find(e => e.to.node.id === node.id);
				if (!edge) return;

				canvas.removeEdge(edge);
				this.canvasApi.invalidateEdgeIndex();

				node.setColor("");

				this.layoutEngine.layoutChildren(canvas, parent.id);
				this.updateGroupBounds(canvas);
				canvas.requestSave();
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

		// Register outline sidebar view
		this.registerView(OUTLINE_VIEW_TYPE, (leaf) => new OutlineView(leaf));

		// Show outline if a mindmap canvas is already open on startup
		this.app.workspace.onLayoutReady(() => {
			const view = this.app.workspace.getActiveViewOfType(ItemView);
			if (view) this.onLeafChange(view.leaf);
		});

		// Import FreeMind: right-click context menu on folders
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				// Show on folders only
				if (!(file instanceof TFolder)) return;

				menu.addItem((item) => {
					item.setTitle("Import mind map (.mm) to canvas")
						.setIcon("file-input")
						.onClick(() => this.importFreeMindFile(file.path));
				});
			})
		);

		// Node referencing: "Copy node link" in canvas node context menu
		this.registerEvent(
			this.app.workspace.on("canvas:node-menu", (menu: Menu, node: CanvasNode) => {
				const canvas = this.canvasApi.getActiveCanvas();

				menu.addItem((item) => {
					item.setTitle("Copy node link")
						.setIcon("link")
						.onClick(() => {
							const canvasPath = node.canvas.view.file.path;
							void navigator.clipboard.writeText(`obsidian://mindvas-navigate?canvas=${encodeURIComponent(canvasPath)}&id=${node.id}`);
							new Notice("Node link copied");
						});
				});

				if (canvas) {
					const groupIds = getGroupIds(canvas);
					if (groupIds.has(node.id)) {
						menu.addItem((item) => {
							item.setTitle("Layout forest")
								.setIcon("layout-grid")
								.onClick(() => {
									this.layoutEngine.layoutForest(canvas, node.id);
									this.updateGroupBounds(canvas);
								});
						});
					}
				}
			})
		);

		// Node referencing: handle obsidian://mindvas-navigate protocol
		this.registerObsidianProtocolHandler("mindvas-navigate", async (params) => {
			const nodeId = params.id;
			if (!nodeId) return;

			const canvasPath = params.canvas;
			if (canvasPath) {
				const file = this.app.vault.getAbstractFileByPath(canvasPath);
				if (file && file instanceof TFile) {
					const leaf = this.app.workspace.getLeaf();
					await leaf.openFile(file);
					await new Promise(resolve => setTimeout(resolve, 200));
				}
			}

			const canvas = this.canvasApi.getActiveCanvas() ?? this.canvasApi.getAnyCanvas();
			if (!canvas) {
				new Notice("Canvas not found");
				return;
			}

			const node = canvas.nodes.get(nodeId);
			if (!node) {
				new Notice("Target node not found");
				return;
			}

			this.canvasApi.selectAndZoom(canvas, node, this.settings.navigationZoomPadding);
		});

		// Navigation history: back/forward commands
		this.addCommand({
			id: "mindmap-nav-back",
			name: "Navigate back",
			checkCallback: (checking: boolean) => {
				const canvas = this.canvasApi.getActiveCanvas();
				if (!canvas || this.navHistoryIndex <= 0) return false;
				if (checking) return true;
				this.navigateBack(canvas);
			},
		});
		this.addCommand({
			id: "mindmap-nav-forward",
			name: "Navigate forward",
			checkCallback: (checking: boolean) => {
				const canvas = this.canvasApi.getActiveCanvas();
				if (!canvas || this.navHistoryIndex >= this.navHistory.length - 1) return false;
				if (checking) return true;
				this.navigateForward(canvas);
			},
		});

		// Import FreeMind: command palette
		this.addCommand({
			id: "mindmap-import-freemind",
			name: "Import mind map (.mm) file to canvas",
			callback: () => this.importFreeMindFile(),
		});

		// Settings tab
		this.addSettingTab(new MindMapSettingTab(this.app, this));

	}

	private pushNavHistory(nodeId: string): void {
		if (this.navHistory[this.navHistoryIndex] === nodeId) return;
		this.navHistory.splice(this.navHistoryIndex + 1);
		this.navHistory.push(nodeId);
		if (this.navHistory.length > 50) this.navHistory.shift();
		this.navHistoryIndex = this.navHistory.length - 1;
	}

	private navigateBack(canvas: Canvas): void {
		if (this.navHistoryIndex <= 0) return;
		this.keyboardHandler?.onBeforeLeaveNode?.();
		this.navSkipTracking = true;
		this.navHistoryIndex--;
		const nodeId = this.navHistory[this.navHistoryIndex];
		const node = canvas.nodes.get(nodeId);
		if (!node) { this.navSkipTracking = false; return; }
		this.canvasApi.selectAndZoom(canvas, node, this.settings.navigationZoomPadding);
		this.navSkipTracking = false;
	}

	private navigateForward(canvas: Canvas): void {
		if (this.navHistoryIndex >= this.navHistory.length - 1) return;
		this.keyboardHandler?.onBeforeLeaveNode?.();
		this.navSkipTracking = true;
		this.navHistoryIndex++;
		const nodeId = this.navHistory[this.navHistoryIndex];
		const node = canvas.nodes.get(nodeId);
		if (!node) { this.navSkipTracking = false; return; }
		this.canvasApi.selectAndZoom(canvas, node, this.settings.navigationZoomPadding);
		this.navSkipTracking = false;
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
		if (this.cleanupSelectionSyncHandler) {
			this.cleanupSelectionSyncHandler();
			this.cleanupSelectionSyncHandler = null;
		}
		if (this.cleanupInsertNodeHandler) {
			this.cleanupInsertNodeHandler();
			this.cleanupInsertNodeHandler = null;
		}
		if (this.cleanupNavHandler) {
			this.cleanupNavHandler();
			this.cleanupNavHandler = null;
		}
		if (this.autoResizeHandle) {
			this.autoResizeHandle.cleanup();
			this.autoResizeHandle = null;
		}
		this.lastNavCanvas = null;
		if (this.toggleBtnEl) {
			this.toggleBtnEl.remove();
			this.toggleBtnEl = null;
		}
	}

	/**
	 * Called when the active leaf changes — set up canvas-specific UI.
	 */
	private onLeafChange(leaf: WorkspaceLeaf | null): void {
		// Don't clean up when focus moves to sidebar panels
		if (leaf?.view?.getViewType() === OUTLINE_VIEW_TYPE) return;
		const root = leaf?.getRoot();
		if (root && root !== this.app.workspace.rootSplit) return;

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
		if (this.cleanupSelectionSyncHandler) {
			this.cleanupSelectionSyncHandler();
			this.cleanupSelectionSyncHandler = null;
		}
		if (this.cleanupInsertNodeHandler) {
			this.cleanupInsertNodeHandler();
			this.cleanupInsertNodeHandler = null;
		}
		if (this.cleanupNavHandler) {
			this.cleanupNavHandler();
			this.cleanupNavHandler = null;
		}
		if (this.autoResizeHandle) {
			this.autoResizeHandle.cleanup();
			this.autoResizeHandle = null;
		}

		const canvas = this.canvasApi.getActiveCanvas();

		// Only reset nav history when switching to a different canvas
		if (canvas && canvas !== this.lastNavCanvas) {
			this.navHistory = [];
			this.navHistoryIndex = -1;
		}
		if (canvas) {
			this.lastNavCanvas = canvas;
		}

		if (!canvas) {
			if (this.toggleBtnEl) {
				this.toggleBtnEl.remove();
				this.toggleBtnEl = null;
			}
			this.hideOutline();
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

		// Sync outline highlight when canvas selection changes (click or Escape)
		const syncOutlineSelection = () => {
			this.trackedRaf(() => {
				for (const leaf of this.app.workspace.getLeavesOfType(OUTLINE_VIEW_TYPE)) {
					if (leaf.view instanceof OutlineView) {
						leaf.view.syncHighlightFromCanvas(canvas);
					}
				}
			});
		};
		const onCanvasClick = () => syncOutlineSelection();
		const onCanvasKeydown = (e: KeyboardEvent) => {
			if (e.key === "Escape") syncOutlineSelection();
			if (e.key === "s" && (e.ctrlKey || e.metaKey) && !e.shiftKey) syncOutlineSelection();
		};
		canvas.wrapperEl.addEventListener("click", onCanvasClick);
		canvas.wrapperEl.addEventListener("keydown", onCanvasKeydown);
		this.cleanupSelectionSyncHandler = () => {
			canvas.wrapperEl.removeEventListener("click", onCanvasClick);
			canvas.wrapperEl.removeEventListener("keydown", onCanvasKeydown);
		};

		// Insert node between parent and child via Alt+click on connection point
		const onInsertNodeClick = (e: MouseEvent) => {
			if (!e.altKey) return;

			const target = e.target as HTMLElement;
			const connectionPoint = target.closest(".canvas-node-connection-point");
			if (!connectionPoint) return;

			const side = connectionPoint.getAttribute("data-side");
			if (!side) return;

			// Connection point is an overlay, not inside .canvas-node — find node by position
			const canvasPos = canvas.posFromEvt(e);
			let clickedNode: CanvasNode | null = null;
			let closestDist = Infinity;
			for (const node of canvas.nodes.values()) {
				const cx = node.x + node.width / 2;
				const cy = node.y + node.height / 2;
				const dist = Math.hypot(canvasPos.x - cx, canvasPos.y - cy);
				if (dist < closestDist) {
					closestDist = dist;
					clickedNode = node;
				}
			}
			if (!clickedNode) return;

			// Collect ALL edges on this side of the clicked node
			const incomingEdges: CanvasEdge[] = [];
			const outgoingEdges: CanvasEdge[] = [];
			for (const edge of canvas.edges.values()) {
				if (edge.to.node.id === clickedNode.id && edge.to.side === side) {
					incomingEdges.push(edge);
				}
				if (edge.from.node.id === clickedNode.id && edge.from.side === side) {
					outgoingEdges.push(edge);
				}
			}

			const edges = outgoingEdges.length > 0 ? outgoingEdges : incomingEdges;
			if (edges.length === 0) return;

			e.preventDefault();
			e.stopPropagation();

			const isOutgoing = outgoingEdges.length > 0;
			const fromSide = edges[0].from.side;
			const toSide = edges[0].to.side;

			if (isOutgoing) {
				// Insert between clickedNode and all its children on this side
				const children = edges.map(edge => edge.to.node);
				const avgY = children.reduce((s, c) => s + c.y + c.height / 2, 0) / children.length;
				const midX = (clickedNode.x + clickedNode.width + children[0].x) / 2
					- this.settings.defaultNodeWidth / 2;
				const midY = avgY - this.settings.defaultNodeHeight / 2;

				const newNode = this.canvasApi.createTextNode(canvas, midX, midY);
				for (const edge of edges) canvas.removeEdge(edge);
				this.canvasApi.invalidateEdgeIndex();
				this.canvasApi.createEdge(canvas, clickedNode, newNode, fromSide, toSide);
				for (const child of children) {
					this.canvasApi.createEdge(canvas, newNode, child, fromSide, toSide);
				}

				this.finishInsertNode(canvas, newNode, clickedNode);
			} else {
				// Insert between parent and clickedNode (single incoming edge)
				const edge = edges[0];
				const parentNode = edge.from.node;
				const midX = (parentNode.x + parentNode.width / 2 + clickedNode.x + clickedNode.width / 2) / 2
					- this.settings.defaultNodeWidth / 2;
				const midY = (parentNode.y + parentNode.height / 2 + clickedNode.y + clickedNode.height / 2) / 2
					- this.settings.defaultNodeHeight / 2;

				const newNode = this.canvasApi.createTextNode(canvas, midX, midY);
				canvas.removeEdge(edge);
				this.canvasApi.invalidateEdgeIndex();
				this.canvasApi.createEdge(canvas, parentNode, newNode, fromSide, toSide);
				this.canvasApi.createEdge(canvas, newNode, clickedNode, fromSide, toSide);

				this.finishInsertNode(canvas, newNode, parentNode);
			}
		};
		canvas.wrapperEl.addEventListener("click", onInsertNodeClick, true);
		this.cleanupInsertNodeHandler = () =>
			canvas.wrapperEl.removeEventListener("click", onInsertNodeClick, true);

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
		// Mouse back/forward buttons for navigation history (optional)
		if (this.settings.mouseNavigation) {
			const onPointerDown = (e: PointerEvent) => {
				if (e.button === 3) {
					e.preventDefault();
					e.stopImmediatePropagation();
					this.navigateBack(canvas);
				}
				if (e.button === 4) {
					e.preventDefault();
					e.stopImmediatePropagation();
					this.navigateForward(canvas);
				}
			};
			canvas.wrapperEl.addEventListener("pointerdown", onPointerDown, true);
			this.cleanupNavHandler = () => canvas.wrapperEl.removeEventListener("pointerdown", onPointerDown, true);
		}

		// Auto-color if enabled (mindmap only)
		if (this.settings.autoColor && this.isMindmapCanvas(canvas)) {
			this.branchColors.applyColors(canvas);
		}

		// Intercept canvas methods (store originals for cleanup)
		const origSave = canvas.requestSave.bind(canvas);
		const origCreateGroup = canvas.createGroupNode.bind(canvas);
		const origUndo = canvas.undo?.bind(canvas);
		const origRedo = canvas.redo?.bind(canvas);
		const origSelectOnly = canvas.selectOnly.bind(canvas);
		this.origCanvasMethods = { requestSave: origSave, createGroupNode: origCreateGroup, undo: origUndo, redo: origRedo, selectOnly: origSelectOnly };
		this.interceptedCanvas = canvas;

		// Track selection changes for navigation history
		canvas.selectOnly = (item: CanvasNode | CanvasEdge) => {
			origSelectOnly(item);
			if (!this.navSkipTracking && "nodeEl" in item) {
				this.pushNavHistory(item.id);
			}
		};

		canvas.requestSave = () => {
			origSave();
			this.debouncedOutlineRefresh();
		};
		canvas.createGroupNode = (options: CreateNodeOptions & { label?: string }) => {
			const group = origCreateGroup(options);
			this.updateGroupBounds(canvas);
			return group;
		};
		if (origUndo) {
			canvas.undo = () => {
				origUndo();
				this.debouncedOutlineRefresh();
			};
		}
		if (origRedo) {
			canvas.redo = () => {
				origRedo();
				this.debouncedOutlineRefresh();
			};
		}
		if (this.isMindmapCanvas(canvas)) {
			this.showOutline(canvas);
		} else {
			this.hideOutline();
		}
	}

	private debouncedOutlineRefresh = debounce(() => {
		if (this.unloaded) return;
		const canvas = this.canvasApi.getActiveCanvas()
			?? this.canvasApi.getAnyCanvas();
		if (canvas) {
			this.refreshOutline(canvas);
		}
	}, 300);

	private refreshOutline(canvas: Canvas): void {
		for (const leaf of this.app.workspace.getLeavesOfType(OUTLINE_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof OutlineView) {
				view.zoomPadding = this.settings.navigationZoomPadding;
				view.onForestLayout = (c, groupId) => {
					this.layoutEngine.layoutForest(c, groupId);
					this.updateGroupBounds(c);
				};
				view.refresh(canvas);
			}
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
			const sizer = node.contentEl?.querySelector<HTMLElement>(".markdown-preview-sizer");
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
			const sizer = node.contentEl?.querySelector<HTMLElement>(".markdown-preview-sizer");
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

	private finishInsertNode(canvas: Canvas, newNode: CanvasNode, nearNode: CanvasNode): void {
		const forest = buildForest(canvas);
		const treeNode = findTreeForNode(forest, nearNode.id);
		if (treeNode) {
			let root = treeNode;
			while (root.parent) root = root.parent;
			this.layoutEngine.layoutChildren(canvas, root.canvasNode.id);
		}
		if (this.settings.autoColor && this.isMindmapCanvas(canvas)) {
			this.branchColors.applyColors(canvas);
		}
		this.updateGroupBounds(canvas);
		this.canvasApi.selectAndEdit(canvas, newNode, this.settings.navigationZoomPadding);
	}

	private showOutline(canvas: Canvas): void {
		const leaves = this.app.workspace.getLeavesOfType(OUTLINE_VIEW_TYPE);
		if (leaves.length > 0) {
			this.refreshOutline(canvas);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		void leaf.setViewState({ type: OUTLINE_VIEW_TYPE }).then(() => {
			void this.app.workspace.revealLeaf(leaf);
			this.reorderOutlineToTop(leaf);
			this.refreshOutline(canvas);
		});
	}

	private hideOutline(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(OUTLINE_VIEW_TYPE)) {
			leaf.detach();
		}
	}

	private reorderOutlineToTop(leaf: WorkspaceLeaf): void {
		const parent = leaf.parent;
		if (!parent?.children) return;
		const children = parent.children;
		const idx = children.indexOf(leaf);
		if (idx > 0) {
			children.splice(idx, 1);
			children.unshift(leaf);
		}
		parent.selectTab?.(leaf);
	}

	/**
	 * Import a FreeMind .mm file and create a .canvas file.
	 * @param folderPath Optional target folder; defaults to vault root.
	 */
	private importFreeMindFile(folderPath?: string): void {
		// Open native file picker for .mm files
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".mm";
		const handler = () => {
			input.removeEventListener("change", handler);
			const file = input.files?.[0];
			if (!file) return;

			void (async () => {
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
						"Failed to parse .mm file. Make sure it is a valid mind map file."
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
				if (created instanceof TFile) {
					await this.app.workspace.getLeaf(false).openFile(created);
				}

				new Notice(
					`Imported "${file.name}" as "${canvasPath}"`
				);
			})();
		};
		input.addEventListener("change", handler);
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
		data.mindmap = newValue;
		canvas.setData(data);
		canvas.requestSave();

		// Re-apply or remove auto-color
		if (newValue && this.settings.autoColor) {
			this.branchColors.applyColors(canvas);
		}

		if (newValue) {
			this.showOutline(canvas);
		} else {
			this.hideOutline();
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
			if (this.origCanvasMethods.undo) {
				this.interceptedCanvas.undo = this.origCanvasMethods.undo;
			}
			if (this.origCanvasMethods.redo) {
				this.interceptedCanvas.redo = this.origCanvasMethods.redo;
			}
			if (this.origCanvasMethods.selectOnly) {
				this.interceptedCanvas.selectOnly = this.origCanvasMethods.selectOnly;
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
