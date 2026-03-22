import type { Canvas, CanvasNode } from "../types/canvas-internal";

interface AutoResizeConfig {
	minHeight: number;
	maxHeight: number;
}

/**
 * Get CodeMirror editor elements from a canvas node's iframe.
 * Used to measure content height via .cm-content.offsetHeight.
 */
export function getEditorElements(node: CanvasNode): {
	iframe: HTMLIFrameElement | null;
	scroller: HTMLElement | null;
	cmContent: HTMLElement | null;
} {
	const iframe = node.contentEl?.querySelector<HTMLIFrameElement>("iframe");
	if (!iframe?.contentDocument) return { iframe: null, scroller: null, cmContent: null };

	const scroller = iframe.contentDocument.querySelector<HTMLElement>(".cm-scroller");
	const cmContent = iframe.contentDocument.querySelector<HTMLElement>(".cm-content");
	return { iframe, scroller, cmContent };
}

export interface AutoResizeHandle {
	/** Remove all listeners and observers. */
	cleanup: () => void;
	/** Finalize the currently editing node before leaving it.
	 *  Call synchronously before any action that exits the current node
	 *  (navigate, create child/sibling, delete).
	 *  Cleans up observers but does NOT trigger relayout — the command
	 *  handler is responsible for its own layout. */
	finalizeNode: () => void;
}

/**
 * Registers auto-resize behavior for canvas nodes:
 * - While editing: node grows to fit content (up to maxHeight), never shrinks.
 * - On natural exit (focusout): calls onEditExit callback after a delay
 *   to let the preview sizer render, enabling resize + relayout.
 * - On command exit (finalizeNode): cleanup only, no relayout.
 * Returns a handle with cleanup() and finalizeNode().
 */
export function registerAutoResize(
	canvas: Canvas,
	config: AutoResizeConfig,
	onEditExit?: (canvas: Canvas, node: CanvasNode) => void
): AutoResizeHandle {
	let activeNode: CanvasNode | null = null;
	let observer: MutationObserver | null = null;
	let inputHandler: (() => void) | null = null;
	/** Cached DOM refs to avoid querySelector on every keystroke */
	let cachedCmContent: HTMLElement | null = null;
	let cachedScroller: HTMLElement | null = null;
	let cachedInputTarget: Document | HTMLElement | null = null;

	function onContentChange(): void {
		if (!activeNode || !cachedScroller || !cachedCmContent) return;

		const contentH = cachedCmContent.offsetHeight;
		const chrome = activeNode.height - cachedScroller.clientHeight;
		const targetH = Math.min(Math.max(contentH + chrome, config.minHeight), config.maxHeight);

		// Only grow, never shrink during editing
		if (targetH > activeNode.height) {
			activeNode.moveAndResize({
				x: activeNode.x,
				y: activeNode.y,
				width: activeNode.width,
				height: targetH,
			});
			canvas.requestSave();
		}
	}

	function startWatching(node: CanvasNode): void {
		const { iframe, scroller, cmContent } = getEditorElements(node);

		activeNode = node;
		cachedCmContent = cmContent;
		cachedScroller = scroller;

		// Observe inside the iframe where actual editing happens
		const observeTarget = cmContent ?? iframe?.contentDocument?.body;
		if (observeTarget) {
			observer = new MutationObserver(onContentChange);
			observer.observe(observeTarget, {
				childList: true,
				subtree: true,
				characterData: true,
			});
		} else {
			observer = new MutationObserver(onContentChange);
			observer.observe(node.contentEl, {
				childList: true,
				subtree: true,
				characterData: true,
			});
		}

		cachedInputTarget = iframe?.contentDocument ?? node.contentEl;
		const handler = () => onContentChange();
		inputHandler = handler;
		cachedInputTarget.addEventListener("input", handler);

		// Measure immediately in case existing content already overflows
		onContentChange();
	}

	function stopWatching(triggerRelayout: boolean = true): void {
		if (!activeNode) return;
		const node = activeNode;

		// Disconnect observers
		observer?.disconnect();
		if (inputHandler && cachedInputTarget) {
			cachedInputTarget.removeEventListener("input", inputHandler);
		}

		// Reset state
		activeNode = null;
		observer = null;
		inputHandler = null;
		cachedCmContent = null;
		cachedScroller = null;
		cachedInputTarget = null;

		// On natural exit: delay to let Obsidian complete edit-to-preview transition,
		// then resize+relayout via callback
		if (triggerRelayout && onEditExit) {
			onEditExit(canvas, node);
		}
	}

	const focusInHandler = (e: FocusEvent): void => {
		const target = e.target as HTMLElement | null;
		const nodeEl = target?.closest?.(".canvas-node") as HTMLElement | null;
		if (!nodeEl) return;

		for (const node of canvas.nodes.values()) {
			if (node.nodeEl === nodeEl && node.isEditing && node !== activeNode) {
				if (activeNode) stopWatching();
				startWatching(node);
				return;
			}
		}
	};

	const focusOutHandler = (): void => {
		if (!activeNode) return;
		setTimeout(() => {
			if (activeNode && !activeNode.isEditing) {
				stopWatching();
			}
		}, 50);
	};

	// Clicking canvas background exits edit mode but doesn't trigger focusout
	const pointerHandler = (e: PointerEvent): void => {
		if (!activeNode) return;
		// Ignore clicks inside the editing node
		if (activeNode.nodeEl?.contains(e.target as Node)) return;
		setTimeout(() => {
			if (activeNode && !activeNode.isEditing) {
				stopWatching();
			}
		}, 50);
	};

	canvas.wrapperEl?.addEventListener("focusin", focusInHandler);
	canvas.wrapperEl?.addEventListener("focusout", focusOutHandler);
	canvas.wrapperEl?.addEventListener("pointerdown", pointerHandler);

	return {
		cleanup: () => {
			if (activeNode) stopWatching(false);
			canvas.wrapperEl?.removeEventListener("focusin", focusInHandler);
			canvas.wrapperEl?.removeEventListener("focusout", focusOutHandler);
			canvas.wrapperEl?.removeEventListener("pointerdown", pointerHandler);
		},
		finalizeNode: () => {
			if (activeNode) stopWatching(false);
		},
	};
}
