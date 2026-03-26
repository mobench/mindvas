import { ItemView, WorkspaceLeaf, setIcon, Menu, SearchComponent } from "obsidian";
import type { Canvas, CanvasNode, CanvasView as CanvasViewType } from "../types/canvas-internal";
import { buildForest, TreeNode, getDescendants, getGroupIds } from "../mindmap/tree-model";

export const OUTLINE_VIEW_TYPE = "mindvas-outline";

interface GroupInfo {
	node: CanvasNode;
	label: string;
	area: number;
	roots: TreeNode[];
}

/**
 * Sidebar panel listing root nodes grouped by canvas groups.
 * Styled with Obsidian's native tree-item classes to match the Outline panel.
 */
export class OutlineView extends ItemView {
	private canvasLeaf: WorkspaceLeaf | null = null;
	private collapsedGroups = new Set<string>();
	private selectedRoots = new Set<TreeNode>();
	private lastCanvas: Canvas | null = null;
	private groupIds: string[] = [];
	private draggedRoot: TreeNode | null = null;
	private dragSourceGroupId: string | null = null;
	private activeNodeId: string | null = null;
	private allItemEls = new Map<string, HTMLElement>();
	private groupElMap = new Map<string, HTMLElement>();
	private searchQuery = "";
	private navHeaderEl: HTMLElement | null = null;
	private collapseBtnEl: HTMLElement | null = null;
	private searchContainerEl: HTMLElement | null = null;
	private searchComponent: SearchComponent | null = null;
	zoomPadding = 0;
	onForestLayout: ((canvas: Canvas, groupId: string) => void) | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return OUTLINE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Map outline";
	}

	getIcon(): string {
		return "list-tree";
	}

	onOpen(): Promise<void> {
		this.contentEl.addClass("mindvas-outline");

		// Create nav-header on containerEl (sibling of view-content, like native Obsidian)
		const navHeader = this.containerEl.createDiv({ cls: "nav-header" });
		this.containerEl.insertBefore(navHeader, this.contentEl);
		this.navHeaderEl = navHeader;

		const navButtons = navHeader.createDiv({ cls: "nav-buttons-container" });

		// Search filter button
		const searchBtn = navButtons.createDiv({
			cls: "clickable-icon nav-action-button",
			attr: { "aria-label": "Search" },
		});
		setIcon(searchBtn, "search");

		// Collapse all / expand all button
		this.collapseBtnEl = navButtons.createDiv({
			cls: "clickable-icon nav-action-button",
			attr: { "aria-label": "Collapse all" },
		});
		setIcon(this.collapseBtnEl, "chevrons-down-up");
		this.collapseBtnEl.addEventListener("click", () => {
			if (!this.lastCanvas) return;
			const allCollapsed = this.groupIds.length > 0
				&& this.groupIds.every(id => this.collapsedGroups.has(id));
			if (allCollapsed) {
				this.collapsedGroups.clear();
			} else {
				for (const id of this.groupIds) this.collapsedGroups.add(id);
			}
			this.refresh(this.lastCanvas);
		});

		// Search input container
		this.searchContainerEl = navHeader.createDiv({ cls: "mindvas-outline-search-container" });
		this.searchContainerEl.hide();
		this.searchComponent = new SearchComponent(this.searchContainerEl);
		this.searchComponent.setPlaceholder("Filter...");
		this.searchComponent.onChange((value) => {
			this.searchQuery = value;
			this.applyFilter();
		});

		searchBtn.addEventListener("click", () => {
			if (!this.searchContainerEl || !this.searchComponent) return;
			if (this.searchContainerEl.isShown()) {
				this.searchContainerEl.hide();
				this.searchQuery = "";
				this.searchComponent.setValue("");
				this.applyFilter();
			} else {
				this.searchContainerEl.show();
				this.searchComponent.inputEl.focus();
			}
		});

		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.clear();
		if (this.navHeaderEl) {
			this.navHeaderEl.remove();
			this.navHeaderEl = null;
		}
		this.collapseBtnEl = null;
		this.searchContainerEl = null;
		this.searchComponent = null;
		return Promise.resolve();
	}

	/**
	 * Rebuild the outline from the current canvas state.
	 */
	refresh(canvas: Canvas): void {
		this.contentEl.empty();
		this.selectedRoots.clear();
		this.groupElMap.clear();
		this.allItemEls.clear();
		this.lastCanvas = canvas;

		// Store the canvas leaf for click navigation
		this.canvasLeaf = this.app.workspace.getLeavesOfType("canvas")
			.find(l => (l.view as unknown as CanvasViewType)?.canvas === canvas) ?? null;

		// Restore search state in the persistent search component
		if (this.searchComponent) {
			this.searchComponent.setValue(this.searchQuery);
		}

		const forest = buildForest(canvas);
		if (forest.length === 0) {
			this.contentEl.createDiv({
				cls: "mindvas-outline-empty",
				text: "No root nodes",
			});
			return;
		}

		// Collect canvas groups from serialized data (runtime nodes lack `type`)
		const groups: GroupInfo[] = [];
		for (const nd of canvas.getData().nodes) {
			if (nd.type !== "group") continue;
			const node = canvas.nodes.get(nd.id);
			if (!node) continue;
			groups.push({
				node,
				label: (nd.label || "").trim() || "Untitled Group",
				area: node.width * node.height,
				roots: [],
			});
		}

		// Sort groups by canvas position (top-to-bottom, left-to-right)
		groups.sort((a, b) => {
			const dy = a.node.y - b.node.y;
			if (Math.abs(dy) > 50) return dy;
			return a.node.x - b.node.x;
		});

		// Assign each root to the smallest containing group
		const ungrouped: TreeNode[] = [];
		for (const root of forest) {
			const cx = root.canvasNode.x + root.canvasNode.width / 2;
			const cy = root.canvasNode.y + root.canvasNode.height / 2;

			let bestGroup: GroupInfo | null = null;
			for (const g of groups) {
				if (
					cx >= g.node.x &&
					cx <= g.node.x + g.node.width &&
					cy >= g.node.y &&
					cy <= g.node.y + g.node.height
				) {
					if (!bestGroup || g.area < bestGroup.area) {
						bestGroup = g;
					}
				}
			}

			if (bestGroup) {
				bestGroup.roots.push(root);
			} else {
				ungrouped.push(root);
			}
		}

		// Render ungrouped roots in a drop zone (accepts trees dragged out of groups)
		const ungroupedZone = this.contentEl.createDiv({ cls: "mindvas-outline-ungrouped-zone" });
		ungroupedZone.addEventListener("dragover", (e) => {
			if (!this.draggedRoot || !this.dragSourceGroupId) return;
			e.preventDefault();
			ungroupedZone.addClass("is-drag-over");
		});
		ungroupedZone.addEventListener("dragleave", () => {
			ungroupedZone.removeClass("is-drag-over");
		});
		ungroupedZone.addEventListener("drop", (e) => {
			e.preventDefault();
			ungroupedZone.removeClass("is-drag-over");
			if (!this.draggedRoot || !this.dragSourceGroupId || !this.lastCanvas) return;
			this.ungroupTree(this.draggedRoot, this.dragSourceGroupId);
			this.draggedRoot = null;
			this.dragSourceGroupId = null;
		});
		for (const root of ungrouped) {
			this.renderRootItem(ungroupedZone, root, canvas, true);
		}

		// Render each group with roots as a collapsible section
		for (const group of groups) {
			if (group.roots.length === 0) continue;
			this.renderGroup(group, canvas);
		}

		this.groupIds = groups.filter(g => g.roots.length > 0).map(g => g.node.id);
		const allCollapsed = this.groupIds.length > 0
			&& this.groupIds.every(id => this.collapsedGroups.has(id));
		if (this.collapseBtnEl) {
			setIcon(this.collapseBtnEl, allCollapsed ? "chevrons-up-down" : "chevrons-down-up");
			this.collapseBtnEl.setAttribute("aria-label", allCollapsed ? "Expand all" : "Collapse all");
		}

		if (this.searchQuery) this.applyFilter();

		// Restore active item highlight after rebuild
		if (this.activeNodeId) {
			const el = this.allItemEls.get(this.activeNodeId);
			if (el) el.addClass("is-active");
		}
	}

	private applyFilter(): void {
		const q = this.searchQuery.toLowerCase().trim();

		// Filter ungrouped roots
		const ungroupedZone = this.contentEl.querySelector(".mindvas-outline-ungrouped-zone");
		if (ungroupedZone) {
			for (const item of Array.from(ungroupedZone.querySelectorAll(":scope > .tree-item"))) {
				const text = item.querySelector(".tree-item-inner")?.textContent?.toLowerCase() ?? "";
				(item as HTMLElement).toggleClass("is-hidden", q !== "" && !text.includes(q));
			}
		}

		// Filter groups: show if group label or any child root matches
		for (const groupItem of Array.from(this.contentEl.querySelectorAll(":scope > .tree-item"))) {
			const el = groupItem as HTMLElement;
			const groupHeader = el.querySelector(".mindvas-outline-group .tree-item-inner");
			if (!groupHeader) continue; // not a group tree-item

			const label = groupHeader.querySelector("span")?.textContent?.toLowerCase() ?? "";
			const groupLabelMatches = q === "" || label.includes(q);

			let anyChildVisible = false;
			for (const child of Array.from(el.querySelectorAll(".tree-item-children > .tree-item"))) {
				const childText = child.querySelector(".tree-item-inner")?.textContent?.toLowerCase() ?? "";
				const childMatches = q === "" || childText.includes(q);
				(child as HTMLElement).toggleClass("is-hidden", !childMatches && !groupLabelMatches);
				if (childMatches || groupLabelMatches) anyChildVisible = true;
			}

			el.toggleClass("is-hidden", q !== "" && !groupLabelMatches && !anyChildVisible);
		}
	}

	/**
	 * Render a single root node as a tree-item.
	 */
	private renderRootItem(
		container: HTMLElement,
		root: TreeNode,
		canvas: Canvas,
		isUngrouped: boolean,
		groupId?: string
	): void {
		const treeItem = container.createDiv({ cls: "tree-item" });
		const self = treeItem.createDiv({
			cls: "tree-item-self is-clickable mindvas-outline-item",
		});

		// Drag handle (before text content)
		const dragHandle = self.createDiv({ cls: "tree-item-icon mindvas-outline-drag-handle" });
		setIcon(dragHandle, "grip-vertical");

		self.createDiv({
			cls: "tree-item-inner",
			text: getRootTitle(root.canvasNode.text),
		});

		// Handle-based drag: only start drag when pointerdown on grip icon
		let dragAllowed = false;
		dragHandle.addEventListener("pointerdown", () => { dragAllowed = true; });
		self.addEventListener("pointerup", () => { dragAllowed = false; });

		self.setAttribute("draggable", "true");
		self.addEventListener("dragstart", (e) => {
			if (!dragAllowed) { e.preventDefault(); return; }
			dragAllowed = false;
			this.draggedRoot = root;
			this.dragSourceGroupId = groupId ?? null;
			self.addClass("is-dragging");
			e.dataTransfer?.setData("text/plain", root.canvasNode.id);
		});
		self.addEventListener("dragend", () => {
			self.removeClass("is-dragging");
			this.draggedRoot = null;
			this.dragSourceGroupId = null;
			for (const [, el] of this.groupElMap) {
				el.removeClass("is-drag-over");
			}
		});

		this.allItemEls.set(root.canvasNode.id, self);

		self.addEventListener("click", (e) => {
			if (isUngrouped && e.ctrlKey) {
				// Toggle multi-selection
				if (this.selectedRoots.has(root)) {
					this.selectedRoots.delete(root);
					self.removeClass("is-selected");
				} else {
					this.selectedRoots.add(root);
					self.addClass("is-selected");
				}
				return;
			}

			this.clearSelection();
			this.setActiveItem(root.canvasNode.id);
			if (this.canvasLeaf) {
				this.app.workspace.setActiveLeaf(this.canvasLeaf, { focus: true });
			}
			const node = root.canvasNode;
			canvas.selectOnly(node);
			const pad = this.zoomPadding;
			const cx = node.x + node.width / 2;
			const cy = node.y + node.height / 2;
			canvas.zoomToBbox({
				minX: cx - pad,
				minY: cy - pad,
				maxX: cx + pad,
				maxY: cy + pad,
			});
		});

		if (isUngrouped) {
			self.addEventListener("contextmenu", (e) => {
				e.preventDefault();
				// If right-clicked root not already selected, select only it
				if (!this.selectedRoots.has(root)) {
					this.clearSelection();
					this.selectedRoots.add(root);
					self.addClass("is-selected");
				}
				this.showContextMenu(e);
			});
		}
	}

	private clearSelection(): void {
		for (const root of this.selectedRoots) {
			this.allItemEls.get(root.canvasNode.id)?.removeClass("is-selected");
		}
		this.selectedRoots.clear();
	}

	private setActiveItem(nodeId: string): void {
		if (this.activeNodeId) {
			this.allItemEls.get(this.activeNodeId)?.removeClass("is-active");
		}
		this.activeNodeId = nodeId;
		const el = this.allItemEls.get(nodeId);
		el?.addClass("is-active");
		el?.scrollIntoView({ block: "nearest" });
	}

	private clearActiveItem(): void {
		if (this.activeNodeId) {
			this.allItemEls.get(this.activeNodeId)?.removeClass("is-active");
		}
		this.activeNodeId = null;
	}

	/**
	 * Sync outline highlight from the current canvas selection.
	 */
	syncHighlightFromCanvas(canvas: Canvas): void {
		if (canvas.selection.size !== 1) {
			this.clearActiveItem();
			return;
		}
		const item = canvas.selection.values().next().value;
		if (!item || !("nodeEl" in item)) {
			this.clearActiveItem();
			return;
		}
		const nodeId = (item as CanvasNode).id;
		if (this.allItemEls.has(nodeId)) {
			this.setActiveItem(nodeId);
		} else {
			this.clearActiveItem();
		}
	}

	private showContextMenu(e: MouseEvent): void {
		const count = this.selectedRoots.size;
		if (count === 0) return;
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle(`Create group (${count} root${count > 1 ? "s" : ""})`)
				.setIcon("group")
				.onClick(() => this.createGroupFromSelection());
		});
		menu.showAtMouseEvent(e);
	}

	private createGroupFromSelection(): void {
		const canvas = this.lastCanvas;
		if (!canvas || this.selectedRoots.size === 0) return;

		// Collect all canvas nodes: selected roots + their descendants
		const allNodes: CanvasNode[] = [];
		for (const root of this.selectedRoots) {
			allNodes.push(root.canvasNode);
			for (const desc of getDescendants(root)) {
				allNodes.push(desc.canvasNode);
			}
		}

		// Compute bounding box
		const PADDING = 20;
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const node of allNodes) {
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
			maxX = Math.max(maxX, node.x + node.width);
			maxY = Math.max(maxY, node.y + node.height);
		}
		minX -= PADDING;
		minY -= PADDING;
		maxX += PADDING;
		maxY += PADDING;

		const group = canvas.createGroupNode({
			pos: { x: minX, y: minY },
			size: { width: maxX - minX, height: maxY - minY },
			label: "",
		});

		canvas.requestSave();

		// Focus canvas and start editing the group label
		if (this.canvasLeaf) {
			this.app.workspace.setActiveLeaf(this.canvasLeaf, { focus: true });
		}
		canvas.selectOnly(group);
		setTimeout(() => group.startEditing(), 50);

		this.clearSelection();
	}

	/**
	 * Render a group as a collapsible tree-item section.
	 */
	private renderGroup(group: GroupInfo, canvas: Canvas): void {
		const isCollapsed = this.collapsedGroups.has(group.node.id);

		const treeItem = this.contentEl.createDiv({
			cls: "tree-item" + (isCollapsed ? " is-collapsed" : ""),
		});

		const self = treeItem.createDiv({
			cls: "tree-item-self is-clickable mindvas-outline-group",
		});

		const collapseIcon = self.createDiv({ cls: "tree-item-icon collapse-icon" });
		setIcon(collapseIcon, "right-triangle");

		const labelContainer = self.createDiv({ cls: "tree-item-inner" });
		const labelSpan = labelContainer.createSpan({ text: group.label });
		labelContainer.createSpan({ cls: "mindvas-outline-group-count", text: `${group.roots.length}` });

		// Drop target for drag-and-drop
		this.groupElMap.set(group.node.id, self);
		self.addEventListener("dragover", (e) => {
			if (!this.draggedRoot) return;
			e.preventDefault();
			self.addClass("is-drag-over");
		});
		self.addEventListener("dragleave", () => {
			self.removeClass("is-drag-over");
		});
		self.addEventListener("drop", (e) => {
			e.preventDefault();
			self.removeClass("is-drag-over");
			if (!this.draggedRoot || !this.lastCanvas) return;
			if (this.dragSourceGroupId === group.node.id) return;
			this.moveTreeToGroup(this.draggedRoot, group.node.id, this.dragSourceGroupId);
			this.draggedRoot = null;
			this.dragSourceGroupId = null;
		});

		// Delayed click to toggle collapse (avoids conflict with dblclick rename)
		let clickTimer: ReturnType<typeof setTimeout> | null = null;
		self.addEventListener("click", () => {
			if (clickTimer !== null) {
				clearTimeout(clickTimer);
				clickTimer = null;
				return;
			}
			clickTimer = setTimeout(() => {
				clickTimer = null;
				if (this.collapsedGroups.has(group.node.id)) {
					this.collapsedGroups.delete(group.node.id);
					treeItem.removeClass("is-collapsed");
				} else {
					this.collapsedGroups.add(group.node.id);
					treeItem.addClass("is-collapsed");
				}
			}, 250);
		});

		// Double-click to rename group
		self.addEventListener("dblclick", () => {
			if (clickTimer !== null) {
				clearTimeout(clickTimer);
				clickTimer = null;
			}
			this.startGroupRename(labelSpan, group, canvas);
		});

		// Context menu with forest layout and rename options
		self.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			const menu = new Menu();
			menu.addItem((item) => {
				item.setTitle("Rename group")
					.setIcon("pencil")
					.onClick(() => this.startGroupRename(labelSpan, group, canvas));
			});
			menu.addItem((item) => {
				item.setTitle("Layout forest")
					.setIcon("layout-grid")
					.onClick(() => {
						if (this.lastCanvas && this.onForestLayout) {
							this.onForestLayout(this.lastCanvas, group.node.id);
						}
					});
			});
			menu.showAtMouseEvent(e);
		});

		const childrenContainer = treeItem.createDiv({ cls: "tree-item-children" });
		for (const root of group.roots) {
			this.renderRootItem(childrenContainer, root, canvas, false, group.node.id);
		}
	}

	private moveTreeToGroup(root: TreeNode, targetGroupId: string, sourceGroupId: string | null): void {
		const canvas = this.lastCanvas;
		if (!canvas) return;

		const group = canvas.nodes.get(targetGroupId);
		if (!group) return;

		// Move entire subtree into the target group, preserving relative positions
		const targetX = group.x + group.width / 2 - root.canvasNode.width / 2;
		const targetY = group.y + group.height / 2 - root.canvasNode.height / 2;
		const dx = targetX - root.canvasNode.x;
		const dy = targetY - root.canvasNode.y;
		root.canvasNode.moveTo({ x: targetX, y: targetY });
		for (const desc of getDescendants(root)) {
			desc.canvasNode.moveTo({ x: desc.canvasNode.x + dx, y: desc.canvasNode.y + dy });
		}

		if (this.onForestLayout) {
			this.onForestLayout(canvas, targetGroupId);
			if (sourceGroupId) {
				this.onForestLayout(canvas, sourceGroupId);
			}
		}
	}

	private ungroupTree(root: TreeNode, sourceGroupId: string): void {
		const canvas = this.lastCanvas;
		if (!canvas) return;

		// Find a safe position below all groups
		const groupNodeIds = getGroupIds(canvas);
		let maxY = -Infinity;
		for (const gid of groupNodeIds) {
			const g = canvas.nodes.get(gid);
			if (g) maxY = Math.max(maxY, g.y + g.height);
		}
		const MARGIN = 80;
		root.canvasNode.moveTo({ x: root.canvasNode.x, y: maxY + MARGIN });

		if (this.onForestLayout) {
			this.onForestLayout(canvas, sourceGroupId);
		}
	}

	private startGroupRename(labelSpan: HTMLSpanElement, group: GroupInfo, canvas: Canvas): void {
		const originalText = labelSpan.textContent ?? "";
		labelSpan.contentEditable = "true";
		labelSpan.focus();

		const range = document.createRange();
		range.selectNodeContents(labelSpan);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);

		let done = false;

		const commit = () => {
			if (done) return;
			done = true;
			const newLabel = (labelSpan.textContent ?? "").trim() || "Untitled Group";
			labelSpan.contentEditable = "false";
			labelSpan.textContent = newLabel;
			cleanup();

			if (newLabel === originalText) return;

			const data = canvas.getData();
			const nodeData = data.nodes.find(n => n.id === group.node.id);
			if (nodeData) {
				nodeData.label = newLabel;
				canvas.setData(data);
			}
		};

		const cancel = () => {
			done = true;
			labelSpan.contentEditable = "false";
			labelSpan.textContent = originalText;
			cleanup();
		};

		const onKeydown = (e: KeyboardEvent) => {
			e.stopPropagation();
			if (e.key === "Enter") {
				e.preventDefault();
				commit();
			} else if (e.key === "Escape") {
				e.preventDefault();
				cancel();
			}
		};

		const onBlur = () => commit();
		const onClick = (e: MouseEvent) => e.stopPropagation();

		const cleanup = () => {
			labelSpan.removeEventListener("keydown", onKeydown);
			labelSpan.removeEventListener("blur", onBlur);
			labelSpan.removeEventListener("click", onClick);
		};

		labelSpan.addEventListener("keydown", onKeydown);
		labelSpan.addEventListener("blur", onBlur);
		labelSpan.addEventListener("click", onClick);
	}

	/**
	 * Clear the outline (no canvas active).
	 */
	clear(): void {
		this.canvasLeaf = null;
		this.lastCanvas = null;
		this.selectedRoots.clear();
		this.groupElMap.clear();
		this.allItemEls.clear();
		this.activeNodeId = null;
		this.draggedRoot = null;
		this.dragSourceGroupId = null;
		this.contentEl.empty();
		this.contentEl.createDiv({
			cls: "mindvas-outline-empty",
			text: "Open a canvas to see root nodes",
		});
	}
}

/**
 * Extract a clean title from a node's text content.
 * Takes the first line, strips markdown heading markers.
 */
export function getRootTitle(text: string): string {
	const firstLine = (text || "").split("\n")[0].trim();
	return firstLine
		.replace(/^#+\s*/, "")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		|| "Untitled";
}
