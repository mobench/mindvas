/**
 * Get CodeMirror editor elements from a canvas node's iframe.
 * Used to measure content height via .cm-content.offsetHeight.
 */
export function getEditorElements(node) {
    var _a;
    const iframe = (_a = node.contentEl) === null || _a === void 0 ? void 0 : _a.querySelector("iframe");
    if (!(iframe === null || iframe === void 0 ? void 0 : iframe.contentDocument))
        return { iframe: null, scroller: null, cmContent: null };
    const scroller = iframe.contentDocument.querySelector(".cm-scroller");
    const cmContent = iframe.contentDocument.querySelector(".cm-content");
    return { iframe, scroller, cmContent };
}
/**
 * Registers auto-resize behavior for canvas nodes:
 * - While editing: node grows to fit content (up to maxHeight), never shrinks.
 * - On natural exit (focusout): calls onEditExit callback after a delay
 *   to let the preview sizer render, enabling resize + relayout.
 * - On command exit (finalizeNode): cleanup only, no relayout.
 * Returns a handle with cleanup() and finalizeNode().
 */
export function registerAutoResize(canvas, config, onEditExit) {
    var _a, _b, _c;
    let activeNode = null;
    let observer = null;
    let inputHandler = null;
    /** Cached DOM refs to avoid querySelector on every keystroke */
    let cachedCmContent = null;
    let cachedScroller = null;
    let cachedInputTarget = null;
    function onContentChange() {
        if (!activeNode || !cachedScroller || !cachedCmContent)
            return;
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
    function startWatching(node) {
        var _a, _b;
        const { iframe, scroller, cmContent } = getEditorElements(node);
        activeNode = node;
        cachedCmContent = cmContent;
        cachedScroller = scroller;
        // Observe inside the iframe where actual editing happens
        const observeTarget = cmContent !== null && cmContent !== void 0 ? cmContent : (_a = iframe === null || iframe === void 0 ? void 0 : iframe.contentDocument) === null || _a === void 0 ? void 0 : _a.body;
        if (observeTarget) {
            observer = new MutationObserver(onContentChange);
            observer.observe(observeTarget, {
                childList: true,
                subtree: true,
                characterData: true,
            });
        }
        else {
            observer = new MutationObserver(onContentChange);
            observer.observe(node.contentEl, {
                childList: true,
                subtree: true,
                characterData: true,
            });
        }
        cachedInputTarget = (_b = iframe === null || iframe === void 0 ? void 0 : iframe.contentDocument) !== null && _b !== void 0 ? _b : node.contentEl;
        const handler = () => onContentChange();
        inputHandler = handler;
        cachedInputTarget.addEventListener("input", handler);
        // Measure immediately in case existing content already overflows
        onContentChange();
    }
    function stopWatching(triggerRelayout = true) {
        if (!activeNode)
            return;
        const node = activeNode;
        // Disconnect observers
        observer === null || observer === void 0 ? void 0 : observer.disconnect();
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
    const focusInHandler = (e) => {
        var _a;
        const target = e.target;
        const nodeEl = (_a = target === null || target === void 0 ? void 0 : target.closest) === null || _a === void 0 ? void 0 : _a.call(target, ".canvas-node");
        if (!nodeEl)
            return;
        for (const node of canvas.nodes.values()) {
            if (node.nodeEl === nodeEl && node.isEditing && node !== activeNode) {
                if (activeNode)
                    stopWatching();
                startWatching(node);
                return;
            }
        }
    };
    const focusOutHandler = () => {
        if (!activeNode)
            return;
        setTimeout(() => {
            if (activeNode && !activeNode.isEditing) {
                stopWatching();
            }
        }, 50);
    };
    // Clicking canvas background exits edit mode but doesn't trigger focusout
    const pointerHandler = (e) => {
        var _a;
        if (!activeNode)
            return;
        // Ignore clicks inside the editing node
        if ((_a = activeNode.nodeEl) === null || _a === void 0 ? void 0 : _a.contains(e.target))
            return;
        setTimeout(() => {
            if (activeNode && !activeNode.isEditing) {
                stopWatching();
            }
        }, 50);
    };
    (_a = canvas.wrapperEl) === null || _a === void 0 ? void 0 : _a.addEventListener("focusin", focusInHandler);
    (_b = canvas.wrapperEl) === null || _b === void 0 ? void 0 : _b.addEventListener("focusout", focusOutHandler);
    (_c = canvas.wrapperEl) === null || _c === void 0 ? void 0 : _c.addEventListener("pointerdown", pointerHandler);
    return {
        cleanup: () => {
            var _a, _b, _c;
            if (activeNode)
                stopWatching(false);
            (_a = canvas.wrapperEl) === null || _a === void 0 ? void 0 : _a.removeEventListener("focusin", focusInHandler);
            (_b = canvas.wrapperEl) === null || _b === void 0 ? void 0 : _b.removeEventListener("focusout", focusOutHandler);
            (_c = canvas.wrapperEl) === null || _c === void 0 ? void 0 : _c.removeEventListener("pointerdown", pointerHandler);
        },
        finalizeNode: () => {
            if (activeNode)
                stopWatching(false);
        },
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0by1yZXNpemUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhdXRvLXJlc2l6ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFPQTs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsSUFBZ0I7O0lBS2pELE1BQU0sTUFBTSxHQUFHLE1BQUEsSUFBSSxDQUFDLFNBQVMsMENBQUUsYUFBYSxDQUFDLFFBQVEsQ0FBNkIsQ0FBQztJQUNuRixJQUFJLENBQUMsQ0FBQSxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsZUFBZSxDQUFBO1FBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFFdkYsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUF1QixDQUFDO0lBQzVGLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBdUIsQ0FBQztJQUM1RixPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsQ0FBQztBQUN4QyxDQUFDO0FBYUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FDakMsTUFBYyxFQUNkLE1BQXdCLEVBQ3hCLFVBQXVEOztJQUV2RCxJQUFJLFVBQVUsR0FBc0IsSUFBSSxDQUFDO0lBQ3pDLElBQUksUUFBUSxHQUE0QixJQUFJLENBQUM7SUFDN0MsSUFBSSxZQUFZLEdBQXdCLElBQUksQ0FBQztJQUM3QyxnRUFBZ0U7SUFDaEUsSUFBSSxlQUFlLEdBQXVCLElBQUksQ0FBQztJQUMvQyxJQUFJLGNBQWMsR0FBdUIsSUFBSSxDQUFDO0lBQzlDLElBQUksaUJBQWlCLEdBQWtDLElBQUksQ0FBQztJQUU1RCxTQUFTLGVBQWU7UUFDdkIsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLGNBQWMsSUFBSSxD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LENBQUMsS0FBSyxDQUFDLENBQUM7UUFDckMsQ0FBQztLQUNELENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgeyBDYW52YXMsIENhbnZhc05vZGUgfSBmcm9tIFwiLi4vdHlwZXMvY2FudmFzLWludGVybmFsXCI7XG5cbmludGVyZmFjZSBBdXRvUmVzaXplQ29uZmlnIHtcblx0bWluSGVpZ2h0OiBudW1iZXI7XG5cdG1heEhlaWdodDogbnVtYmVyO1xufVxuXG4vKipcbiAqIEdldCBDb2RlTWlycm9yIGVkaXRvciBlbGVtZW50cyBmcm9tIGEgY2FudmFzIG5vZGUncyBpZnJhbWUuXG4gKiBVc2VkIHRvIG1lYXN1cmUgY29udGVudCBoZWlnaHQgdmlhIC5jbS1jb250ZW50Lm9mZnNldEhlaWdodC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEVkaXRvckVsZW1lbnRzKG5vZGU6IENhbnZhc05vZGUpOiB7XG5cdGlmcmFtZTogSFRNTElGcmFtZUVsZW1lbnQgfCBudWxsO1xuXHRzY3JvbGxlcjogSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRjbUNvbnRlbnQ6IEhUTUxFbGVtZW50IHwgbnVsbDtcbn0ge1xuXHRjb25zdCBpZnJhbWUgPSBub2RlLmNvbnRlbnRFbD8ucXVlcnlTZWxlY3RvcihcImlmcmFtZVwiKSBhcyBIVE1MSUZyYW1lRWxlbWVudCB8IG51bGw7XG5cdGlmICghaWZyYW1lPy5jb250ZW50RG9jdW1lbnQpIHJldHVybiB7IGlmcmFtZTogbnVsbCwgc2Nyb2xsZXI6IG51bGwsIGNtQ29udGVudDogbnVsbCB9O1xuXG5cdGNvbnN0IHNjcm9sbGVyID0gaWZyYW1lLmNvbnRlbnREb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmNtLXNjcm9sbGVyXCIpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0Y29uc3QgY21Db250ZW50ID0gaWZyYW1lLmNvbnRlbnREb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmNtLWNvbnRlbnRcIikgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRyZXR1cm4geyBpZnJhbWUsIHNjcm9sbGVyLCBjbUNvbnRlbnQgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBdXRvUmVzaXplSGFuZGxlIHtcblx0LyoqIFJlbW92ZSBhbGwgbGlzdGVuZXJzIGFuZCBvYnNlcnZlcnMuICovXG5cdGNsZWFudXA6ICgpID0+IHZvaWQ7XG5cdC8qKiBGaW5hbGl6ZSB0aGUgY3VycmVudGx5IGVkaXRpbmcgbm9kZSBiZWZvcmUgbGVhdmluZyBpdC5cblx0ICogIENhbGwgc3luY2hyb25vdXNseSBiZWZvcmUgYW55IGFjdGlvbiB0aGF0IGV4aXRzIHRoZSBjdXJyZW50IG5vZGVcblx0ICogIChuYXZpZ2F0ZSwgY3JlYXRlIGNoaWxkL3NpYmxpbmcsIGRlbGV0ZSkuXG5cdCAqICBDbGVhbnMgdXAgb2JzZXJ2ZXJzIGJ1dCBkb2VzIE5PVCB0cmlnZ2VyIHJlbGF5b3V0IOKAlCB0aGUgY29tbWFuZFxuXHQgKiAgaGFuZGxlciBpcyByZXNwb25zaWJsZSBmb3IgaXRzIG93biBsYXlvdXQuICovXG5cdGZpbmFsaXplTm9kZTogKCkgPT4gdm9pZDtcbn1cblxuLyoqXG4gKiBSZWdpc3RlcnMgYXV0by1yZXNpemUgYmVoYXZpb3IgZm9yIGNhbnZhcyBub2RlczpcbiAqIC0gV2hpbGUgZWRpdGluZzogbm9kZSBncm93cyB0byBmaXQgY29udGVudCAodXAgdG8gbWF4SGVpZ2h0KSwgbmV2ZXIgc2hyaW5rcy5cbiAqIC0gT24gbmF0dXJhbCBleGl0IChmb2N1c291dCk6IGNhbGxzIG9uRWRpdEV4aXQgY2FsbGJhY2sgYWZ0ZXIgYSBkZWxheVxuICogICB0byBsZXQgdGhlIHByZXZpZXcgc2l6ZXIgcmVuZGVyLCBlbmFibGluZyByZXNpemUgKyByZWxheW91dC5cbiAqIC0gT24gY29tbWFuZCBleGl0IChmaW5hbGl6ZU5vZGUpOiBjbGVhbnVwIG9ubHksIG5vIHJlbGF5b3V0LlxuICogUmV0dXJucyBhIGhhbmRsZSB3aXRoIGNsZWFudXAoKSBhbmQgZmluYWxpemVOb2RlKCkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckF1dG9SZXNpemUoXG5cdGNhbnZhczogQ2FudmFzLFxuXHRjb25maWc6IEF1dG9SZXNpemVDb25maWcsXG5cdG9uRWRpdEV4aXQ/OiAoY2FudmFzOiBDYW52YXMsIG5vZGU6IENhbnZhc05vZGUpID0+IHZvaWRcbik6IEF1dG9SZXNpemVIYW5kbGUge1xuXHRsZXQgYWN0aXZlTm9kZTogQ2FudmFzTm9kZSB8IG51bGwgPSBudWxsO1xuXHRsZXQgb2JzZXJ2ZXI6IE11dGF0aW9uT2JzZXJ2ZXIgfCBudWxsID0gbnVsbDtcblx0bGV0IGlucHV0SGFuZGxlcjogKCgpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XG5cdC8qKiBDYWNoZWQgRE9NIHJlZnMgdG8gYXZvaWQgcXVlcnlTZWxlY3RvciBvbiBldmVyeSBrZXlzdHJva2UgKi9cblx0bGV0IGNhY2hlZENtQ29udGVudDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblx0bGV0IGNhY2hlZFNjcm9sbGVyOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXHRsZXQgY2FjaGVkSW5wdXRUYXJnZXQ6IERvY3VtZW50IHwgSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuXHRmdW5jdGlvbiBvbkNvbnRlbnRDaGFuZ2UoKTogdm9pZCB7XG5cdFx0aWYgKCFhY3RpdmVOb2RlIHx8ICFjYWNoZWRTY3JvbGxlciB8fCAhY2FjaGVkQ21Db250ZW50KSByZXR1cm47XG5cblx0XHRjb25zdCBjb250ZW50SCA9IGNhY2hlZENtQ29udGVudC5vZmZzZXRIZWlnaHQ7XG5cdFx0Y29uc3QgY2hyb21lID0gYWN0aXZlTm9kZS5oZWlnaHQgLSBjYWNoZWRTY3JvbGxlci5jbGllbnRIZWlnaHQ7XG5cdFx0Y29uc3QgdGFyZ2V0SCA9IE1hdGgubWluKE1hdGgubWF4KGNvbnRlbnRIICsgY2hyb21lLCBjb25maWcubWluSGVpZ2h0KSwgY29uZmlnLm1heEhlaWdodCk7XG5cblx0XHQvLyBPbmx5IGdyb3csIG5ldmVyIHNocmluayBkdXJpbmcgZWRpdGluZ1xuXHRcdGlmICh0YXJnZXRIID4gYWN0aXZlTm9kZS5oZWlnaHQpIHtcblx0XHRcdGFjdGl2ZU5vZGUubW92ZUFuZFJlc2l6ZSh7XG5cdFx0XHRcdHg6IGFjdGl2ZU5vZGUueCxcblx0XHRcdFx0eTogYWN0aXZlTm9kZS55LFxuXHRcdFx0XHR3aWR0aDogYWN0aXZlTm9kZS53aWR0aCxcblx0XHRcdFx0aGVpZ2h0OiB0YXJnZXRILFxuXHRcdFx0fSk7XG5cdFx0XHRjYW52YXMucmVxdWVzdFNhdmUoKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBzdGFydFdhdGNoaW5nKG5vZGU6IENhbnZhc05vZGUpOiB2b2lkIHtcblx0XHRjb25zdCB7IGlmcmFtZSwgc2Nyb2xsZXIsIGNtQ29udGVudCB9ID0gZ2V0RWRpdG9yRWxlbWVudHMobm9kZSk7XG5cblx0XHRhY3RpdmVOb2RlID0gbm9kZTtcblx0XHRjYWNoZWRDbUNvbnRlbnQgPSBjbUNvbnRlbnQ7XG5cdFx0Y2FjaGVkU2Nyb2xsZXIgPSBzY3JvbGxlcjtcblxuXHRcdC8vIE9ic2VydmUgaW5zaWRlIHRoZSBpZnJhbWUgd2hlcmUgYWN0dWFsIGVkaXRpbmcgaGFwcGVuc1xuXHRcdGNvbnN0IG9ic2VydmVUYXJnZXQgPSBjbUNvbnRlbnQgPz8gaWZyYW1lPy5jb250ZW50RG9jdW1lbnQ/LmJvZHk7XG5cdFx0aWYgKG9ic2VydmVUYXJnZXQpIHtcblx0XHRcdG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIob25Db250ZW50Q2hhbmdlKTtcblx0XHRcdG9ic2VydmVyLm9ic2VydmUob2JzZXJ2ZVRhcmdldCwge1xuXHRcdFx0XHRjaGlsZExpc3Q6IHRydWUsXG5cdFx0XHRcdHN1YnRyZWU6IHRydWUsXG5cdFx0XHRcdGNoYXJhY3RlckRhdGE6IHRydWUsXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihvbkNvbnRlbnRDaGFuZ2UpO1xuXHRcdFx0b2JzZXJ2ZXIub2JzZXJ2ZShub2RlLmNvbnRlbnRFbCwge1xuXHRcdFx0XHRjaGlsZExpc3Q6IHRydWUsXG5cdFx0XHRcdHN1YnRyZWU6IHRydWUsXG5cdFx0XHRcdGNoYXJhY3RlckRhdGE6IHRydWUsXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjYWNoZWRJbnB1dFRhcmdldCA9IGlmcmFtZT8uY29udGVudERvY3VtZW50ID8/IG5vZGUuY29udGVudEVsO1xuXHRcdGNvbnN0IGhhbmRsZXIgPSAoKSA9PiBvbkNvbnRlbnRDaGFuZ2UoKTtcblx0XHRpbnB1dEhhbmRsZXIgPSBoYW5kbGVyO1xuXHRcdGNhY2hlZElucHV0VGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCBoYW5kbGVyKTtcblxuXHRcdC8vIE1lYXN1cmUgaW1tZWRpYXRlbHkgaW4gY2FzZSBleGlzdGluZyBjb250ZW50IGFscmVhZHkgb3ZlcmZsb3dzXG5cdFx0b25Db250ZW50Q2hhbmdlKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBzdG9wV2F0Y2hpbmcodHJpZ2dlclJlbGF5b3V0OiBib29sZWFuID0gdHJ1ZSk6IHZvaWQge1xuXHRcdGlmICghYWN0aXZlTm9kZSkgcmV0dXJuO1xuXHRcdGNvbnN0IG5vZGUgPSBhY3RpdmVOb2RlO1xuXG5cdFx0Ly8gRGlzY29ubmVjdCBvYnNlcnZlcnNcblx0XHRvYnNlcnZlcj8uZGlzY29ubmVjdCgpO1xuXHRcdGlmIChpbnB1dEhhbmRsZXIgJiYgY2FjaGVkSW5wdXRUYXJnZXQpIHtcblx0XHRcdGNhY2hlZElucHV0VGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCBpbnB1dEhhbmRsZXIpO1xuXHRcdH1cblxuXHRcdC8vIFJlc2V0IHN0YXRlXG5cdFx0YWN0aXZlTm9kZSA9IG51bGw7XG5cdFx0b2JzZXJ2ZXIgPSBudWxsO1xuXHRcdGlucHV0SGFuZGxlciA9IG51bGw7XG5cdFx0Y2FjaGVkQ21Db250ZW50ID0gbnVsbDtcblx0XHRjYWNoZWRTY3JvbGxlciA9IG51bGw7XG5cdFx0Y2FjaGVkSW5wdXRUYXJnZXQgPSBudWxsO1xuXG5cdFx0Ly8gT24gbmF0dXJhbCBleGl0OiBkZWxheSB0byBsZXQgT2JzaWRpYW4gY29tcGxldGUgZWRpdC10by1wcmV2aWV3IHRyYW5zaXRpb24sXG5cdFx0Ly8gdGhlbiByZXNpemUrcmVsYXlvdXQgdmlhIGNhbGxiYWNrXG5cdFx0aWYgKHRyaWdnZXJSZWxheW91dCAmJiBvbkVkaXRFeGl0KSB7XG5cdFx0XHRvbkVkaXRFeGl0KGNhbnZhcywgbm9kZSk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgZm9jdXNJbkhhbmRsZXIgPSAoZTogRm9jdXNFdmVudCk6IHZvaWQgPT4ge1xuXHRcdGNvbnN0IHRhcmdldCA9IGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRjb25zdCBub2RlRWwgPSB0YXJnZXQ/LmNsb3Nlc3Q/LihcIi5jYW52YXMtbm9kZVwiKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0aWYgKCFub2RlRWwpIHJldHVybjtcblxuXHRcdGZvciAoY29uc3Qgbm9kZSBvZiBjYW52YXMubm9kZXMudmFsdWVzKCkpIHtcblx0XHRcdGlmIChub2RlLm5vZGVFbCA9PT0gbm9kZUVsICYmIG5vZGUuaXNFZGl0aW5nICYmIG5vZGUgIT09IGFjdGl2ZU5vZGUpIHtcblx0XHRcdFx0aWYgKGFjdGl2ZU5vZGUpIHN0b3BXYXRjaGluZygpO1xuXHRcdFx0XHRzdGFydFdhdGNoaW5nKG5vZGUpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdGNvbnN0IGZvY3VzT3V0SGFuZGxlciA9ICgpOiB2b2lkID0+IHtcblx0XHRpZiAoIWFjdGl2ZU5vZGUpIHJldHVybjtcblx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGlmIChhY3RpdmVOb2RlICYmICFhY3RpdmVOb2RlLmlzRWRpdGluZykge1xuXHRcdFx0XHRzdG9wV2F0Y2hpbmcoKTtcblx0XHRcdH1cblx0XHR9LCA1MCk7XG5cdH07XG5cblx0Ly8gQ2xpY2tpbmcgY2FudmFzIGJhY2tncm91bmQgZXhpdHMgZWRpdCBtb2RlIGJ1dCBkb2Vzbid0IHRyaWdnZXIgZm9jdXNvdXRcblx0Y29uc3QgcG9pbnRlckhhbmRsZXIgPSAoZTogUG9pbnRlckV2ZW50KTogdm9pZCA9PiB7XG5cdFx0aWYgKCFhY3RpdmVOb2RlKSByZXR1cm47XG5cdFx0Ly8gSWdub3JlIGNsaWNrcyBpbnNpZGUgdGhlIGVkaXRpbmcgbm9kZVxuXHRcdGlmIChhY3RpdmVOb2RlLm5vZGVFbD8uY29udGFpbnMoZS50YXJnZXQgYXMgTm9kZSkpIHJldHVybjtcblx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGlmIChhY3RpdmVOb2RlICYmICFhY3RpdmVOb2RlLmlzRWRpdGluZykge1xuXHRcdFx0XHRzdG9wV2F0Y2hpbmcoKTtcblx0XHRcdH1cblx0XHR9LCA1MCk7XG5cdH07XG5cblx0Y2FudmFzLndyYXBwZXJFbD8uYWRkRXZlbnRMaXN0ZW5lcihcImZvY3VzaW5cIiwgZm9jdXNJbkhhbmRsZXIpO1xuXHRjYW52YXMud3JhcHBlckVsPy5hZGRFdmVudExpc3RlbmVyKFwiZm9jdXNvdXRcIiwgZm9jdXNPdXRIYW5kbGVyKTtcblx0Y2FudmFzLndyYXBwZXJFbD8uYWRkRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJkb3duXCIsIHBvaW50ZXJIYW5kbGVyKTtcblxuXHRyZXR1cm4ge1xuXHRcdGNsZWFudXA6ICgpID0+IHtcblx0XHRcdGlmIChhY3RpdmVOb2RlKSBzdG9wV2F0Y2hpbmcoZmFsc2UpO1xuXHRcdFx0Y2FudmFzLndyYXBwZXJFbD8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImZvY3VzaW5cIiwgZm9jdXNJbkhhbmRsZXIpO1xuXHRcdFx0Y2FudmFzLndyYXBwZXJFbD8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImZvY3Vzb3V0XCIsIGZvY3VzT3V0SGFuZGxlcik7XG5cdFx0XHRjYW52YXMud3JhcHBlckVsPy5yZW1vdmVFdmVudExpc3RlbmVyKFwicG9pbnRlcmRvd25cIiwgcG9pbnRlckhhbmRsZXIpO1xuXHRcdH0sXG5cdFx0ZmluYWxpemVOb2RlOiAoKSA9PiB7XG5cdFx0XHRpZiAoYWN0aXZlTm9kZSkgc3RvcFdhdGNoaW5nKGZhbHNlKTtcblx0XHR9LFxuXHR9O1xufVxuIl19