import { App, setIcon } from "obsidian";
import type { Canvas, CanvasNode } from "../types/canvas-internal";
import type { BacklinkIndex, BacklinkEntry } from "../backlinks/backlink-index";

export class BacklinkBadges {
	private badgeEls = new Map<string, HTMLElement>();
	private activePopover: HTMLElement | null = null;
	private popoverCloseHandlers: (() => void)[] = [];
	private canvas: Canvas | null = null;

	constructor(
		private app: App,
		private index: BacklinkIndex,
		private onNavigateToMd: (path: string) => void,
		private onNavigateToCanvasNode: (canvasPath: string, nodeId: string) => void,
	) {}

	render(canvas: Canvas): void {
		this.canvas = canvas;
		const canvasPath = canvas.view.file.path;

		const seen = new Set<string>();
		for (const node of canvas.nodes.values()) {
			seen.add(node.id);
			const count = this.index.getCount(canvasPath, node.id);
			this.renderBadge(node, count);
		}

		for (const [id, el] of this.badgeEls) {
			if (!seen.has(id)) {
				el.remove();
				this.badgeEls.delete(id);
			}
		}
	}

	updateNode(nodeId: string): void {
		if (!this.canvas) return;
		const canvasPath = this.canvas.view.file.path;
		const node = this.canvas.nodes.get(nodeId);
		if (!node) return;
		const count = this.index.getCount(canvasPath, nodeId);
		this.renderBadge(node, count);
	}

	cleanup(): void {
		this.dismissPopover();
		for (const el of this.badgeEls.values()) {
			el.remove();
		}
		this.badgeEls.clear();
		this.canvas = null;
	}

	private renderBadge(node: CanvasNode, count: number): void {
		const existing = this.badgeEls.get(node.id);

		if (count === 0) {
			if (existing) {
				existing.remove();
				this.badgeEls.delete(node.id);
			}
			return;
		}

		if (!node.nodeEl) return;

		if (existing) {
			const countEl = existing.querySelector(".mindvas-backlink-count");
			if (countEl) countEl.textContent = String(count);
			if (!node.nodeEl.contains(existing)) {
				node.nodeEl.appendChild(existing);
			}
			return;
		}

		const badge = node.nodeEl.createDiv({ cls: "mindvas-backlink-badge" });
		if (this.app.vault.getConfig("rightToLeft")) badge.addClass("is-rtl");
		const iconEl = badge.createSpan({ cls: "mindvas-backlink-icon" });
		setIcon(iconEl, "links-coming-in");
		badge.createSpan({ cls: "mindvas-backlink-count", text: String(count) });

		badge.addEventListener("click", (e) => {
			e.stopPropagation();
			e.preventDefault();
			this.showPopover(node, badge);
		});

		this.badgeEls.set(node.id, badge);
	}

	private showPopover(node: CanvasNode, badge: HTMLElement): void {
		this.dismissPopover();
		if (!this.canvas) return;

		const canvasPath = this.canvas.view.file.path;
		const entries = this.index.getBacklinks(canvasPath, node.id);
		if (entries.length === 0) return;

		const popover = createDiv({ cls: "mindvas-backlinks-popover" });

		for (const entry of entries) {
			const item = popover.createDiv({ cls: "mindvas-backlinks-popover-item" });

			const icon = item.createSpan({ cls: "mindvas-backlinks-popover-icon" });
			setIcon(icon, entry.sourceType === "md" ? "file-text" : "layout-dashboard");

			const textContainer = item.createDiv({ cls: "mindvas-backlinks-popover-text" });
			const basename = entry.sourcePath.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");
			textContainer.createDiv({ cls: "mindvas-backlinks-popover-filename", text: basename });
			textContainer.createDiv({ cls: "mindvas-backlinks-popover-snippet", text: entry.snippet });

			item.addEventListener("click", () => {
				this.dismissPopover();
				if (entry.sourceType === "md") {
					this.onNavigateToMd(entry.sourcePath);
				} else if (entry.sourceNodeId) {
					this.onNavigateToCanvasNode(entry.sourcePath, entry.sourceNodeId);
				} else {
					this.onNavigateToMd(entry.sourcePath);
				}
			});
		}

		const wrapperEl = this.canvas.wrapperEl;
		wrapperEl.appendChild(popover);
		this.activePopover = popover;

		this.positionPopover(popover, badge, wrapperEl);

		const onClickOutside = (e: PointerEvent) => {
			if (!popover.contains(e.target as Node) && !badge.contains(e.target as Node)) {
				this.dismissPopover();
			}
		};
		const onEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				this.dismissPopover();
			}
		};

		setTimeout(() => {
			document.addEventListener("pointerdown", onClickOutside, { capture: true });
		}, 0);
		document.addEventListener("keydown", onEscape);

		this.popoverCloseHandlers = [
			() => document.removeEventListener("pointerdown", onClickOutside, { capture: true }),
			() => document.removeEventListener("keydown", onEscape),
		];
	}

	private positionPopover(popover: HTMLElement, badge: HTMLElement, wrapper: HTMLElement): void {
		const badgeRect = badge.getBoundingClientRect();
		const wrapperRect = wrapper.getBoundingClientRect();

		let top = badgeRect.bottom - wrapperRect.top + 4;
		let left = badgeRect.left - wrapperRect.left;

		requestAnimationFrame(() => {
			const popoverRect = popover.getBoundingClientRect();
			if (left + popoverRect.width > wrapperRect.width) {
				left = wrapperRect.width - popoverRect.width - 8;
			}
			if (left < 0) left = 8;

			if (top + popoverRect.height > wrapperRect.height) {
				top = badgeRect.top - wrapperRect.top - popoverRect.height - 4;
			}

			popover.style.top = `${top}px`;
			popover.style.left = `${left}px`;
		});

		popover.style.top = `${top}px`;
		popover.style.left = `${left}px`;
	}

	private dismissPopover(): void {
		for (const cleanup of this.popoverCloseHandlers) {
			cleanup();
		}
		this.popoverCloseHandlers = [];
		if (this.activePopover) {
			this.activePopover.remove();
			this.activePopover = null;
		}
	}
}
