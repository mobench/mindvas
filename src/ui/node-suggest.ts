import {
	App,
	TFile,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	EditorPosition,
	Editor,
	prepareFuzzySearch,
	renderResults,
	SearchResult,
	setIcon,
} from "obsidian";

interface CanvasNodeEntry {
	nodeId: string;
	canvasPath: string;
	canvasName: string;
	displayText: string;
	rootText: string | null;
	branchText: string | null;
}

interface NodeSuggestion extends CanvasNodeEntry {
	match: SearchResult;
}

const TRIGGER = "@@";

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

export class NodeSuggest extends EditorSuggest<NodeSuggestion> {
	private cache: CanvasNodeEntry[] | null = null;
	private cacheTime = 0;
	private static CACHE_TTL = 5000;

	constructor(app: App) {
		super(app);
		this.limit = 20;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const before = line.slice(0, cursor.ch);
		const triggerIdx = before.lastIndexOf(TRIGGER);
		if (triggerIdx === -1) return null;

		const query = before.slice(triggerIdx + TRIGGER.length);
		if (query.includes("\n")) return null;

		return {
			start: { line: cursor.line, ch: triggerIdx },
			end: cursor,
			query,
		};
	}

	async getSuggestions(context: EditorSuggestContext): Promise<NodeSuggestion[]> {
		const entries = await this.getNodeEntries();
		const query = context.query.trim();

		if (!query) {
			return entries.slice(0, this.limit).map((e) => ({
				...e,
				match: { score: 0, matches: [] },
			}));
		}

		const fuzzy = prepareFuzzySearch(query);
		const results: NodeSuggestion[] = [];

		for (const entry of entries) {
			const match = fuzzy(entry.displayText)
				?? fuzzy(entry.canvasName)
				?? (entry.rootText ? fuzzy(entry.rootText) : null)
				?? (entry.branchText ? fuzzy(entry.branchText) : null);
			if (match) {
				results.push({ ...entry, match });
			}
		}

		results.sort((a, b) => b.match.score - a.match.score);
		return results.slice(0, this.limit);
	}

	renderSuggestion(suggestion: NodeSuggestion, el: HTMLElement): void {
		const titleEl = el.createDiv({ cls: "suggestion-title" });
		if (suggestion.match.matches.length > 0) {
			renderResults(titleEl, suggestion.displayText, suggestion.match);
		} else {
			titleEl.setText(suggestion.displayText);
		}

		const noteEl = el.createDiv({ cls: "suggestion-note" });
		noteEl.appendText(suggestion.canvasName);

		if (suggestion.rootText) {
			noteEl.appendText(" — ");
			const breadcrumbEl = noteEl.createSpan({ cls: "mindvas-suggest-breadcrumb" });
			const rootIconEl = breadcrumbEl.createSpan({ cls: "mindvas-suggest-breadcrumb-icon" });
			setIcon(rootIconEl, "circle-dot");
			breadcrumbEl.appendText(" " + truncate(suggestion.rootText, 30));
			if (suggestion.branchText) {
				breadcrumbEl.appendText(" › ");
				const branchIconEl = breadcrumbEl.createSpan({ cls: "mindvas-suggest-breadcrumb-icon" });
				setIcon(branchIconEl, "leaf");
				breadcrumbEl.appendText(" " + truncate(suggestion.branchText, 30));
			}
		}
	}

	selectSuggestion(suggestion: NodeSuggestion, _evt: MouseEvent | KeyboardEvent): void {
		if (!this.context) return;

		const encodedCanvas = encodeURIComponent(suggestion.canvasPath);
		const link = `[${suggestion.displayText}](obsidian://mindvas-navigate?canvas=${encodedCanvas}&id=${suggestion.nodeId})`;

		this.context.editor.replaceRange(
			link,
			this.context.start,
			this.context.end,
		);
	}

	private async getNodeEntries(): Promise<CanvasNodeEntry[]> {
		const now = Date.now();
		if (this.cache && now - this.cacheTime < NodeSuggest.CACHE_TTL) {
			return this.cache;
		}

		const entries: CanvasNodeEntry[] = [];
		const canvasFiles = this.app.vault.getFiles().filter((f) => f.extension === "canvas");

		for (const file of canvasFiles) {
			let content: string;
			try {
				content = await this.app.vault.cachedRead(file);
			} catch {
				continue;
			}

			let data: {
				nodes?: Array<{ id?: string; type?: string; text?: string }>;
				edges?: Array<{ fromNode?: string; toNode?: string }>;
			};
			try {
				data = JSON.parse(content);
			} catch {
				continue;
			}

			if (!data.nodes) continue;
			const canvasName = file.basename;

			const parentMap = new Map<string, string>();
			if (data.edges) {
				for (const edge of data.edges) {
					if (!edge.fromNode || !edge.toNode) continue;
					if (parentMap.has(edge.toNode)) continue;
					parentMap.set(edge.toNode, edge.fromNode);
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

			for (const [nodeId, displayText] of nodeTextMap) {
				const ancestors = getAncestorPath(nodeId, parentMap);
				let rootText: string | null = null;
				let branchText: string | null = null;

				if (ancestors.length >= 1) {
					rootText = nodeTextMap.get(ancestors[0]) ?? null;
				}
				if (ancestors.length >= 2) {
					branchText = nodeTextMap.get(ancestors[1]) ?? null;
				}

				entries.push({
					nodeId,
					canvasPath: file.path,
					canvasName,
					displayText,
					rootText,
					branchText,
				});
			}
		}

		this.cache = entries;
		this.cacheTime = now;
		return entries;
	}
}
