import { App, TFile } from "obsidian";

export interface BacklinkEntry {
	sourcePath: string;
	sourceType: "md" | "canvas";
	sourceNodeId?: string;
	snippet: string;
}

type BacklinkKey = string;

const MINDVAS_LINK_RE = /obsidian:\/\/mindvas-navigate\?canvas=([^&\s)"'\]]+)&id=([0-9a-f]{16})/g;

function makeKey(canvasPath: string, nodeId: string): BacklinkKey {
	return canvasPath + ":" + nodeId;
}

function extractSnippet(text: string, matchIndex: number): string {
	const lineStart = text.lastIndexOf("\n", matchIndex) + 1;
	let lineEnd = text.indexOf("\n", matchIndex);
	if (lineEnd === -1) lineEnd = text.length;
	const line = text.slice(lineStart, lineEnd).trim();
	return line.length > 80 ? line.slice(0, 77) + "…" : line;
}

function firstLine(text: string): string {
	const end = text.indexOf("\n");
	const line = (end === -1 ? text : text.slice(0, end)).trim();
	return line.length > 80 ? line.slice(0, 77) + "…" : line;
}

export class BacklinkIndex {
	private index = new Map<BacklinkKey, BacklinkEntry[]>();
	private fileKeys = new Map<string, Set<BacklinkKey>>();
	private built = false;

	constructor(private app: App) {}

	async buildFullIndex(): Promise<void> {
		if (this.built) return;
		this.index.clear();
		this.fileKeys.clear();

		const allFiles = this.app.vault.getFiles();
		const mdFiles = allFiles.filter(f => f.extension === "md");
		const canvasFiles = allFiles.filter(f => f.extension === "canvas");

		const BATCH = 50;
		for (let i = 0; i < mdFiles.length; i += BATCH) {
			const batch = mdFiles.slice(i, i + BATCH);
			for (const file of batch) {
				await this.scanMdFile(file);
			}
			if (i + BATCH < mdFiles.length) {
				await new Promise(r => setTimeout(r, 0));
			}
		}

		for (let i = 0; i < canvasFiles.length; i += BATCH) {
			const batch = canvasFiles.slice(i, i + BATCH);
			for (const file of batch) {
				await this.scanCanvasFile(file);
			}
			if (i + BATCH < canvasFiles.length) {
				await new Promise(r => setTimeout(r, 0));
			}
		}

		this.built = true;
	}

	async updateFile(file: TFile): Promise<void> {
		this.removeFile(file.path);
		if (file.extension === "md") {
			await this.scanMdFile(file);
		} else if (file.extension === "canvas") {
			await this.scanCanvasFile(file);
		}
	}

	removeFile(path: string): void {
		const keys = this.fileKeys.get(path);
		if (!keys) return;
		for (const key of keys) {
			const entries = this.index.get(key);
			if (!entries) continue;
			const filtered = entries.filter(e => e.sourcePath !== path);
			if (filtered.length === 0) {
				this.index.delete(key);
			} else {
				this.index.set(key, filtered);
			}
		}
		this.fileKeys.delete(path);
	}

	getBacklinks(canvasPath: string, nodeId: string): BacklinkEntry[] {
		return this.index.get(makeKey(canvasPath, nodeId)) ?? [];
	}

	getCount(canvasPath: string, nodeId: string): number {
		return this.index.get(makeKey(canvasPath, nodeId))?.length ?? 0;
	}

	invalidate(): void {
		this.built = false;
	}

	clear(): void {
		this.index.clear();
		this.fileKeys.clear();
		this.built = false;
	}

	private addEntry(key: BacklinkKey, entry: BacklinkEntry): void {
		let list = this.index.get(key);
		if (!list) {
			list = [];
			this.index.set(key, list);
		}
		list.push(entry);

		let keys = this.fileKeys.get(entry.sourcePath);
		if (!keys) {
			keys = new Set();
			this.fileKeys.set(entry.sourcePath, keys);
		}
		keys.add(key);
	}

	private async scanMdFile(file: TFile): Promise<void> {
		let content: string;
		try {
			content = await this.app.vault.cachedRead(file);
		} catch {
			return;
		}

		MINDVAS_LINK_RE.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = MINDVAS_LINK_RE.exec(content)) !== null) {
			const canvasPath = decodeURIComponent(match[1]);
			const nodeId = match[2];
			const key = makeKey(canvasPath, nodeId);
			this.addEntry(key, {
				sourcePath: file.path,
				sourceType: "md",
				snippet: extractSnippet(content, match.index),
			});
		}
	}

	private async scanCanvasFile(file: TFile): Promise<void> {
		let content: string;
		try {
			content = await this.app.vault.cachedRead(file);
		} catch {
			return;
		}

		let data: { nodes?: Array<{ type?: string; text?: string; id?: string }> };
		try {
			data = JSON.parse(content);
		} catch {
			return;
		}

		if (!data.nodes) return;
		for (const node of data.nodes) {
			if (node.type !== "text" || !node.text) continue;

			MINDVAS_LINK_RE.lastIndex = 0;
			let match: RegExpExecArray | null;
			while ((match = MINDVAS_LINK_RE.exec(node.text)) !== null) {
				const canvasPath = decodeURIComponent(match[1]);
				const nodeId = match[2];
				const key = makeKey(canvasPath, nodeId);
				this.addEntry(key, {
					sourcePath: file.path,
					sourceType: "canvas",
					sourceNodeId: node.id,
					snippet: firstLine(node.text),
				});
			}
		}
	}
}
