import { App, TFile, Notice } from "obsidian";

const MINDVAS_LINK_RE = /obsidian:\/\/mindvas-navigate\?canvas=([^&\s)"'\]]+)&id=([0-9a-f]{16})/g;

export async function rewriteCanvasPath(
	app: App,
	oldPath: string,
	newPath: string,
): Promise<number> {
	const encodedOld = encodeURIComponent(oldPath);
	const encodedNew = encodeURIComponent(newPath);
	let updated = 0;

	const allFiles = app.vault.getFiles();
	const candidates = allFiles.filter(f => f.extension === "md" || f.extension === "canvas");

	for (const file of candidates) {
		let content: string;
		try {
			content = await app.vault.read(file);
		} catch {
			continue;
		}

		const replaced = content.replace(MINDVAS_LINK_RE, (match, canvasParam) => {
			const decoded = decodeURIComponent(canvasParam);
			if (decoded === oldPath) {
				updated++;
				return match.replace(canvasParam, encodedNew);
			}
			return match;
		});

		if (replaced !== content) {
			await app.vault.modify(file, replaced);
		}
	}

	return updated;
}

export async function repairBrokenLinks(app: App): Promise<number> {
	const nodeLocationCache = new Map<string, { canvasPath: string; nodeId: string }>();

	const canvasFiles = app.vault.getFiles().filter(f => f.extension === "canvas");
	for (const cf of canvasFiles) {
		let content: string;
		try {
			content = await app.vault.cachedRead(cf);
		} catch {
			continue;
		}
		let data: { nodes?: Array<{ id?: string; type?: string }> };
		try {
			data = JSON.parse(content);
		} catch {
			continue;
		}
		if (!data.nodes) continue;
		for (const node of data.nodes) {
			if (node.id) {
				nodeLocationCache.set(node.id, { canvasPath: cf.path, nodeId: node.id });
			}
		}
	}

	let repaired = 0;
	const allFiles = app.vault.getFiles().filter(f => f.extension === "md" || f.extension === "canvas");

	for (const file of allFiles) {
		let content: string;
		try {
			content = await app.vault.read(file);
		} catch {
			continue;
		}

		let modified = false;
		const replaced = content.replace(MINDVAS_LINK_RE, (match, canvasParam, nodeId) => {
			const decoded = decodeURIComponent(canvasParam);
			const targetFile = app.vault.getAbstractFileByPath(decoded);
			if (targetFile) return match;

			const location = nodeLocationCache.get(nodeId);
			if (!location) return match;

			repaired++;
			modified = true;
			return match.replace(canvasParam, encodeURIComponent(location.canvasPath));
		});

		if (modified) {
			await app.vault.modify(file, replaced);
		}
	}

	return repaired;
}
