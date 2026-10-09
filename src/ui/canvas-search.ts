import {
	App,
	SuggestModal,
	prepareFuzzySearch,
	renderResults,
	SearchResult,
	setIcon,
} from "obsidian";
import type { Canvas, CanvasNode } from "../types/canvas-internal";
import type { CanvasAPI } from "../canvas/canvas-api";
import type { MindMapSettings } from "../settings";
import { getGroupIds } from "../mindmap/tree-model";

interface SearchEntry {
	canvasNode: CanvasNode;
	displayText: string;
	rootText: string | null;
	branchText: string | null;
	match: SearchResult | null;
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

export class CanvasSearchModal extends SuggestModal<SearchEntry> {
	private entries: SearchEntry[] = [];

	constructor(
		app: App,
		private canvas: Canvas,
		private canvasApi: CanvasAPI,
		private settings: MindMapSettings,
	) {
		super(app);
		this.setPlaceholder("Search nodes…");
		if (this.app.vault.getConfig("rightToLeft")) {
			this.modalEl.style.direction = "rtl";
		}
		this.buildEntries();
	}

	private buildEntries(): void {
		const groupIds = getGroupIds(this.canvas);

		const parentMap = new Map<string, string>();
		for (const edge of this.canvas.edges.values()) {
			const childId = edge.to.node.id;
			if (!parentMap.has(childId)) {
				parentMap.set(childId, edge.from.node.id);
			}
		}

		const nodeTextMap = new Map<string, string>();
		for (const node of this.canvas.nodes.values()) {
			if (groupIds.has(node.id)) continue;
			const text = node.text?.trim();
			if (!text) continue;
			const cleaned = cleanDisplayText(text);
			if (cleaned) nodeTextMap.set(node.id, cleaned);
		}

		for (const [nodeId, displayText] of nodeTextMap) {
			const isRoot = !parentMap.has(nodeId);
			if (isRoot && !this.settings.searchIncludeRoots) continue;

			const ancestors = getAncestorPath(nodeId, parentMap);
			let rootText: string | null = null;
			let branchText: string | null = null;
			if (ancestors.length >= 1) {
				rootText = nodeTextMap.get(ancestors[0]) ?? null;
			}
			if (ancestors.length >= 2) {
				branchText = nodeTextMap.get(ancestors[1]) ?? null;
			}

			const canvasNode = this.canvas.nodes.get(nodeId);
			if (!canvasNode) continue;

			this.entries.push({
				canvasNode,
				displayText,
				rootText,
				branchText,
				match: null,
			});
		}
	}

	getSuggestions(query: string): SearchEntry[] {
		const tokens = query.split(/\s+/).filter(Boolean);
		if (tokens.length === 0) {
			return this.entries.map((e) => ({ ...e, match: { score: 0, matches: [] } }));
		}

		if (tokens.length === 1) {
			const fuzzy = prepareFuzzySearch(tokens[0]);
			const results: SearchEntry[] = [];
			for (const entry of this.entries) {
				const match = fuzzy(entry.displayText);
				if (match) results.push({ ...entry, match });
			}
			results.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
			return results;
		}

		const fuzzyMatchers = tokens.map((t) => prepareFuzzySearch(t));
		const results: SearchEntry[] = [];

		for (const entry of this.entries) {
			const words: { text: string; offset: number }[] = [];
			const wordRegex = /\S+/g;
			let m;
			while ((m = wordRegex.exec(entry.displayText)) !== null) {
				words.push({ text: m[0], offset: m.index });
			}
			if (words.length < tokens.length) continue;

			let bestScore = -Infinity;
			let bestMatches: SearchResult["matches"] | null = null;

			for (let start = 0; start <= words.length - tokens.length; start++) {
				let windowScore = 0;
				let windowMatches: SearchResult["matches"] = [];
				let windowValid = true;

				for (let t = 0; t < tokens.length; t++) {
					const match = fuzzyMatchers[t](words[start + t].text);
					if (!match) {
						windowValid = false;
						break;
					}
					windowScore += match.score;
					const offset = words[start + t].offset;
					for (const [s, e] of match.matches) {
						windowMatches.push([s + offset, e + offset]);
					}
				}

				if (windowValid && windowScore > bestScore) {
					bestScore = windowScore;
					bestMatches = windowMatches;
				}
			}

			if (bestMatches) {
				results.push({ ...entry, match: { score: bestScore, matches: bestMatches } });
			}
		}

		results.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
		return results;
	}

	renderSuggestion(entry: SearchEntry, el: HTMLElement): void {
		const titleEl = el.createDiv({ cls: "suggestion-title" });
		if (entry.match && entry.match.matches.length > 0) {
			renderResults(titleEl, entry.displayText, entry.match);
		} else {
			titleEl.setText(entry.displayText);
		}

		if (entry.rootText) {
			const breadcrumbEl = el.createDiv({ cls: "suggestion-note mindvas-suggest-breadcrumb" });
			const rootIconEl = breadcrumbEl.createSpan({ cls: "mindvas-suggest-breadcrumb-icon" });
			setIcon(rootIconEl, "circle-dot");
			breadcrumbEl.appendText(" " + truncate(entry.rootText, 30));
			if (entry.branchText) {
				breadcrumbEl.appendText(" › ");
				const branchIconEl = breadcrumbEl.createSpan({ cls: "mindvas-suggest-breadcrumb-icon" });
				setIcon(branchIconEl, "leaf");
				breadcrumbEl.appendText(" " + truncate(entry.branchText, 30));
			}
		}
	}

	onChooseSuggestion(entry: SearchEntry): void {
		this.canvasApi.selectAndZoom(
			this.canvas,
			entry.canvasNode,
			this.settings.navigationZoomPadding,
		);
	}
}
