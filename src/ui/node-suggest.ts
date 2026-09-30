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
} from "obsidian";

interface CanvasNodeEntry {
	nodeId: string;
	canvasPath: string;
	canvasName: string;
	displayText: string;
}

interface NodeSuggestion extends CanvasNodeEntry {
	match: SearchResult;
}

const TRIGGER = "@@";

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
			const match = fuzzy(entry.displayText) ?? fuzzy(entry.canvasName);
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

		el.createDiv({
			cls: "suggestion-note",
			text: suggestion.canvasName,
		});
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

			let data: { nodes?: Array<{ id?: string; type?: string; text?: string }> };
			try {
				data = JSON.parse(content);
			} catch {
				continue;
			}

			if (!data.nodes) continue;
			const canvasName = file.basename;

			for (const node of data.nodes) {
				if (!node.id || node.type === "group") continue;
				const text = node.text?.trim();
				if (!text) continue;

				const firstLine = text.split("\n")[0].trim();
				const displayText = firstLine
					.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
					.replace(/[#*_~`>]/g, "")
					.trim();

				if (!displayText) continue;

				entries.push({
					nodeId: node.id,
					canvasPath: file.path,
					canvasName,
					displayText,
				});
			}
		}

		this.cache = entries;
		this.cacheTime = now;
		return entries;
	}
}
