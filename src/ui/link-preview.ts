import { App, Component, MarkdownRenderer, TFile, setIcon } from "obsidian";
import type { Canvas } from "../types/canvas-internal";

const LINK_RE = /obsidian:\/\/mindvas-navigate\?canvas=([^&\s)"'\]]+)&id=([0-9a-f]{16})/;
const SHOW_DELAY = 300;

function getAncestorPath(nodeId: string, parentMap: Map<string, string>): string[] {
	const path: string[] = [];
	const visited = new Set<string>([nodeId]);
	let current = nodeId;
	while (parentMap.has(current)) {
		current = parentMap.get(current)!;
		if (visited.has(current)) break;
		visited.add(current);
		path.unshift(current);
	}
	return path;
}

function cleanDisplayText(raw: string): string {
	const firstLine = raw.split("\n")[0].trim();
	return firstLine
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/[#*_~`>]/g, "")
		.trim();
}

function truncate(text: string, max: number): string {
	return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export class LinkPreview {
	private activePopover: HTMLElement | null = null;
	private activeComponent: Component | null = null;
	private showTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingLink: HTMLAnchorElement | null = null;
	private cleanupFns: (() => void)[] = [];

	constructor(private app: App) {}

	register(canvas: Canvas): () => void {
		const wrapperEl = canvas.wrapperEl;

		const onMouseOver = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			const linkEl = target.closest("a[href*='mindvas-navigate']") as HTMLAnchorElement | null;
			if (!linkEl) return;

			linkEl.removeAttribute("aria-label");
			linkEl.title = "";

			if (this.activePopover && this.pendingLink === linkEl) return;

			this.cancelPending();
			this.pendingLink = linkEl;

			this.showTimer = setTimeout(() => {
				if (!linkEl.matches(":hover")) return;
				void this.showPreview(linkEl, wrapperEl);
			}, SHOW_DELAY);
		};

		wrapperEl.addEventListener("mouseover", onMouseOver, true);

		const cleanup = () => {
			wrapperEl.removeEventListener("mouseover", onMouseOver, true);
			this.dismiss();
			this.cancelPending();
		};

		return cleanup;
	}

	private cancelPending(): void {
		if (this.showTimer) {
			clearTimeout(this.showTimer);
			this.showTimer = null;
		}
		this.pendingLink = null;
	}

	private async showPreview(linkEl: HTMLAnchorElement, wrapperEl: HTMLElement): Promise<void> {
		const href = linkEl.getAttribute("href") ?? "";
		const match = href.match(LINK_RE);
		if (!match) return;

		const canvasPath = decodeURIComponent(match[1]);
		const nodeId = match[2];

		const file = this.app.vault.getAbstractFileByPath(canvasPath);
		if (!file || !(file instanceof TFile)) return;

		let content: string;
		try {
			content = await this.app.vault.cachedRead(file);
		} catch {
			return;
		}

		let data: {
			nodes?: Array<{ id?: string; type?: string; text?: string }>;
			edges?: Array<{ fromNode?: string; toNode?: string }>;
		};
		try {
			data = JSON.parse(content);
		} catch {
			return;
		}

		if (!data.nodes) return;
		const targetNode = data.nodes.find((n) => n.id === nodeId);
		if (!targetNode?.text) return;

		const parentMap = new Map<string, string>();
		if (data.edges) {
			for (const edge of data.edges) {
				if (!edge.fromNode || !edge.toNode) continue;
				if (!parentMap.has(edge.toNode)) {
					parentMap.set(edge.toNode, edge.fromNode);
				}
			}
		}

		const nodeTextMap = new Map<string, string>();
		for (const node of data.nodes) {
			if (!node.id || node.type === "group") continue;
			const text = node.text?.trim();
			if (!text) continue;
			const cleaned = cleanDisplayText(text);
			if (cleaned) nodeTextMap.set(node.id, cleaned);
		}

		const ancestors = getAncestorPath(nodeId, parentMap);
		let rootText: string | null = null;
		let branchText: string | null = null;
		if (ancestors.length >= 1) {
			rootText = nodeTextMap.get(ancestors[0]) ?? null;
		}
		if (ancestors.length >= 2) {
			branchText = nodeTextMap.get(ancestors[1]) ?? null;
		}

		this.dismiss();

		const popover = createDiv({ cls: "mindvas-link-preview" });
		if (this.app.vault.getConfig("rightToLeft")) {
			popover.style.direction = "rtl";
		}

		const contentEl = popover.createDiv({ cls: "mindvas-link-preview-content" });
		const component = new Component();
		component.load();
		this.activeComponent = component;

		await MarkdownRenderer.render(this.app, targetNode.text, contentEl, canvasPath, component);

		const breadcrumbEl = popover.createDiv({ cls: "mindvas-link-preview-breadcrumb mindvas-suggest-breadcrumb" });
		const canvasName = canvasPath.replace(/^.*[\\/]/, "").replace(/\.canvas$/, "");
		const canvasIconEl = breadcrumbEl.createSpan({ cls: "mindvas-suggest-breadcrumb-icon" });
		setIcon(canvasIconEl, "layout-dashboard");
		breadcrumbEl.appendText(" " + truncate(canvasName, 30));
		if (rootText) {
			breadcrumbEl.appendText("  ·  ");
			const rootIconEl = breadcrumbEl.createSpan({ cls: "mindvas-suggest-breadcrumb-icon" });
			setIcon(rootIconEl, "circle-dot");
			breadcrumbEl.appendText(" " + truncate(rootText, 30));
			if (branchText) {
				breadcrumbEl.appendText(" › ");
				const branchIconEl = breadcrumbEl.createSpan({ cls: "mindvas-suggest-breadcrumb-icon" });
				setIcon(branchIconEl, "leaf");
				breadcrumbEl.appendText(" " + truncate(branchText, 30));
			}
		}

		wrapperEl.appendChild(popover);
		this.activePopover = popover;
		this.positionPopover(popover, linkEl, wrapperEl);

		const onPopoverLeave = (e: MouseEvent) => {
			const related = e.relatedTarget as HTMLElement | null;
			if (related && (linkEl.contains(related) || popover.contains(related))) return;
			this.dismiss();
		};

		const onLinkLeave = (e: MouseEvent) => {
			const related = e.relatedTarget as HTMLElement | null;
			if (related && popover.contains(related)) return;
			this.dismiss();
		};

		popover.addEventListener("mouseleave", onPopoverLeave);
		linkEl.addEventListener("mouseleave", onLinkLeave);

		this.cleanupFns = [
			() => popover.removeEventListener("mouseleave", onPopoverLeave),
			() => linkEl.removeEventListener("mouseleave", onLinkLeave),
		];
	}

	private positionPopover(popover: HTMLElement, anchor: HTMLElement, wrapper: HTMLElement): void {
		const anchorRect = anchor.getBoundingClientRect();
		const wrapperRect = wrapper.getBoundingClientRect();

		let top = anchorRect.bottom - wrapperRect.top + 4;
		let left = anchorRect.left - wrapperRect.left;

		popover.style.top = `${top}px`;
		popover.style.left = `${left}px`;

		requestAnimationFrame(() => {
			const popoverRect = popover.getBoundingClientRect();
			if (left + popoverRect.width > wrapperRect.width) {
				left = wrapperRect.width - popoverRect.width - 8;
			}
			if (left < 0) left = 8;

			if (top + popoverRect.height > wrapperRect.height) {
				top = anchorRect.top - wrapperRect.top - popoverRect.height - 4;
			}

			popover.style.top = `${top}px`;
			popover.style.left = `${left}px`;
		});
	}

	private dismiss(): void {
		for (const fn of this.cleanupFns) fn();
		this.cleanupFns = [];

		if (this.activeComponent) {
			this.activeComponent.unload();
			this.activeComponent = null;
		}
		if (this.activePopover) {
			this.activePopover.remove();
			this.activePopover = null;
		}
		this.pendingLink = null;
	}
}
