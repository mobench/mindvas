import { ItemView, WorkspaceLeaf, setIcon, Menu } from "obsidian";
import type { Canvas, CanvasNode } from "../types/canvas-internal";
import { buildForest, TreeNode, getDescendants } from "../mindmap/tree-model";

export const TOC_VIEW_TYPE = "mindvas-toc";

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
export class TocView extends ItemView {
	private canvasLeaf: WorkspaceLeaf | null = null;
	private collapsedGroups = new Set<string>();
	private selectedRoots = new Set<TreeNode>();
	private lastCanvas: Canvas | null = null;
	private rootElMap = new Map<TreeNode, HTMLElement>();

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return TOC_VIEW_TYPE;
	}

	getDisplayText(): string {
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		return "Mind Map TOC";
	}

	getIcon(): string {
		return "list-tree";
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("mindvas-toc");
	}

	/**
	 * Rebuild the TOC list from the current canvas state.
	 */
	refresh(canvas: Canvas): void {
		this.contentEl.empty();
		this.selectedRoots.clear();
		this.rootElMap.clear();
		this.lastCanvas = canvas;

		// Store the canvas leaf for click navigation
		this.canvasLeaf = this.app.workspace.getLeavesOfType("canvas")
			// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
			.find(l => (l.view as any)?.canvas === canvas) ?? null;

		const forest = buildForest(canvas);
		if (forest.length === 0) {
			this.contentEl.createDiv({
				cls: "mindvas-toc-empty",
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

		// Render ungrouped roots flat at top
		for (const root of ungrouped) {
			this.renderRootItem(this.contentEl, root, canvas, true);
		}

		// Render each group with roots as a collapsible section
		for (const group of groups) {
			if (group.roots.length === 0) continue;
			this.renderGroup(group, canvas);
		}
	}

	/**
	 * Render a single root node as a tree-item.
	 */
	private renderRootItem(
		container: HTMLElement,
		root: TreeNode,
		canvas: Canvas,
		isUngrouped: boolean
	): void {
		const treeItem = container.createDiv({ cls: "tree-item" });
		const self = treeItem.createDiv({
			cls: "tree-item-self is-clickable mindvas-toc-item",
		});
		self.createDiv({
			cls: "tree-item-inner",
			text: getRootTitle(root.canvasNode.text),
		});

		if (isUngrouped) {
			this.rootElMap.set(root, self);
		}

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
			if (this.canvasLeaf) {
				this.app.workspace.setActiveLeaf(this.canvasLeaf, { focus: true });
			}
			const node = root.canvasNode;
			canvas.selectOnly(node);
			const pad = 50;
			canvas.zoomToBbox({
				minX: node.x - pad,
				minY: node.y - pad,
				maxX: node.x + node.width + pad,
				maxY: node.y + node.height + pad,
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
		for (const [, el] of this.rootElMap) {
			el.removeClass("is-selected");
		}
		this.selectedRoots.clear();
	}

	private showContextMenu(e: MouseEvent): void {
		const count = this.selectedRoots.size;
		if (count === 0) return;
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle(`Create Group (${count} root${count > 1 ? "s" : ""})`)
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
			cls: "tree-item-self is-clickable mindvas-toc-group",
		});

		const collapseIcon = self.createDiv({ cls: "tree-item-icon collapse-icon" });
		setIcon(collapseIcon, "right-triangle");

		self.createDiv({
			cls: "tree-item-inner",
			text: group.label,
		});

		// Toggle collapse on header click
		self.addEventListener("click", () => {
			if (this.collapsedGroups.has(group.node.id)) {
				this.collapsedGroups.delete(group.node.id);
				treeItem.removeClass("is-collapsed");
			} else {
				this.collapsedGroups.add(group.node.id);
				treeItem.addClass("is-collapsed");
			}
		});

		const childrenContainer = treeItem.createDiv({ cls: "tree-item-children" });
		for (const root of group.roots) {
			this.renderRootItem(childrenContainer, root, canvas, false);
		}
	}

	/**
	 * Clear the TOC (no canvas active).
	 */
	clear(): void {
		this.canvasLeaf = null;
		this.lastCanvas = null;
		this.selectedRoots.clear();
		this.rootElMap.clear();
		this.contentEl.empty();
		this.contentEl.createDiv({
			cls: "mindvas-toc-empty",
			text: "Open a canvas to see root nodes",
		});
	}
}

/**
 * Extract a clean title from a node's text content.
 * Takes the first line, strips markdown heading markers.
 */
function getRootTitle(text: string): string {
	const firstLine = (text || "").split("\n")[0].trim();
	return firstLine.replace(/^#+\s*/, "") || "Untitled";
}
