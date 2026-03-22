import { findNodeFromEvent } from "./canvas-api";
/**
 * Collect all descendant nodes by walking outgoing edges (BFS).
 * Uses the edge index for O(N) traversal instead of O(N*E).
 */
function collectDescendants(canvas, canvasApi, nodeId) {
    const result = [];
    const visited = new Set([nodeId]);
    const queue = [nodeId];
    while (queue.length > 0) {
        const id = queue.shift();
        for (const edge of canvasApi.getOutgoingEdges(canvas, id)) {
            const childId = edge.to.node.id;
            if (!visited.has(childId)) {
                visited.add(childId);
                result.push(edge.to.node);
                queue.push(childId);
            }
        }
    }
    return result;
}
/**
 * Register pointer listeners that make dragging a node also move
 * all its descendant nodes, preserving relative positions.
 *
 * Uses capture-phase pointerdown to install a moveTo wrapper BEFORE
 * Obsidian's own handlers fire, ensuring descendants move from the
 * very first drag frame — even in a single click-drag gesture.
 *
 * Hold Alt while dragging to move only the single node.
 *
 * Returns a cleanup function to remove the listeners.
 */
export function registerSubtreeDragHandler(canvas, canvasApi) {
    var _a, _b, _c;
    let draggedNode = null;
    let cachedDescendants = null;
    let originalMoveTo = null;
    function installWrapper(node) {
        const descendants = collectDescendants(canvas, canvasApi, node.id);
        if (descendants.length === 0)
            return;
        draggedNode = node;
        cachedDescendants = descendants;
        // Wrap moveTo so descendants move in the same call stack.
        // Use prototype's moveTo (not instance) to avoid stacked wrappers.
        originalMoveTo = Object.getPrototypeOf(node).moveTo.bind(node);
        node.moveTo = (pos) => {
            const dx = pos.x - node.x;
            const dy = pos.y - node.y;
            originalMoveTo(pos);
            // Call descendants' moveTo via prototype to bypass any
            // per-instance wrappers — prevents infinite recursion.
            for (const desc of cachedDescendants) {
                Object.getPrototypeOf(desc).moveTo.call(desc, { x: desc.x + dx, y: desc.y + dy });
            }
        };
    }
    function clearDragSession() {
        if (draggedNode && originalMoveTo) {
            // Remove instance override to restore prototype method lookup
            delete draggedNode.moveTo;
        }
        draggedNode = null;
        cachedDescendants = null;
        originalMoveTo = null;
    }
    // Capture-phase pointerdown: fires BEFORE Obsidian's bubble-phase handlers.
    // Find clicked node from e.target (selection not updated yet) and install
    // the moveTo wrapper immediately — before any drag moveTo() calls.
    const downHandler = (e) => {
        // Clear any stale session from a previous drag
        if (draggedNode)
            clearDragSession();
        if (e.altKey)
            return;
        const node = findNodeFromEvent(canvas, e);
        if (node) {
            installWrapper(node);
        }
    };
    const moveHandler = (e) => {
        if (e.buttons === 0)
            return;
        // Alt key = solo drag
        if (e.altKey) {
            if (draggedNode)
                clearDragSession();
            return;
        }
        // Fallback: if downHandler missed (e.g. programmatic selection)
        if (!draggedNode) {
            const node = canvasApi.getSelectedNode(canvas);
            if (node)
                installWrapper(node);
            if (!draggedNode)
                return;
        }
        // Verify the dragged node is still selected
        const currentSelected = canvasApi.getSelectedNode(canvas);
        if (!currentSelected || currentSelected.id !== draggedNode.id) {
            clearDragSession();
        }
    };
    const upHandler = () => {
        if (!draggedNode)
            return;
        canvas.requestSave();
        clearDragSession();
    };
    // downHandler in capture phase (true) — fires before Obsidian's handlers
    (_a = canvas.wrapperEl) === null || _a === void 0 ? void 0 : _a.addEventListener("pointerdown", downHandler, true);
    (_b = canvas.wrapperEl) === null || _b === void 0 ? void 0 : _b.addEventListener("pointermove", moveHandler);
    (_c = canvas.wrapperEl) === null || _c === void 0 ? void 0 : _c.addEventListener("pointerup", upHandler);
    return () => {
        var _a, _b, _c;
        clearDragSession();
        (_a = canvas.wrapperEl) === null || _a === void 0 ? void 0 : _a.removeEventListener("pointerdown", downHandler, true);
        (_b = canvas.wrapperEl) === null || _b === void 0 ? void 0 : _b.removeEventListener("pointermove", moveHandler);
        (_c = canvas.wrapperEl) === null || _c === void 0 ? void 0 : _c.removeEventListener("pointerup", upHandler);
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VidHJlZS1kcmFnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3VidHJlZS1kcmFnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBYSxpQkFBaUIsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUU1RDs7O0dBR0c7QUFDSCxTQUFTLGtCQUFrQixDQUFDLE1BQWMsRUFBRSxTQUFvQixFQUFFLE1BQWM7SUFDL0UsTUFBTSxNQUFNLEdBQWlCLEVBQUUsQ0FBQztJQUNoQyxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDMUMsTUFBTSxLQUFLLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUV2QixPQUFPLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDekIsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRyxDQUFDO1FBQzFCLEtBQUssTUFBTSxJQUFJLElBQUksU0FBUyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQzNELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNoQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUMzQixPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNyQixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzFCLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDckIsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7O0dBV0c7QUFDSCxNQUFNLFVBQVUsMEJBQTBCLENBQUMsTUFBYyxFQUFFLFNBQW9C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LGVBQWUsR0FBRyxTQUFTLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyxlQUFlLElBQUksZUFBZSxDQUFDLEVBQUUsS0FBSyxXQUFXLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDL0QsZ0JBQWdCLEVBQUUsQ0FBQztRQUNwQixDQUFDO0lBQ0YsQ0FBQyxDQUFDO0lBRUYsTUFBTSxTQUFTLEdBQUcsR0FBUyxFQUFFO1FBQzVCLElBQUksQ0FBQyxXQUFXO1lBQUUsT0FBTztRQUN6QixNQUFNLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDckIsZ0JBQWdCLEVBQUUsQ0FBQztJQUNwQixDQUFDLENBQUM7SUFFRix5RUFBeUU7SUFDekUsTUFBQSxNQUFNLENBQUMsU0FBUywwQ0FBRSxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3JFLE1BQUEsTUFBTSxDQUFDLFNBQVMsMENBQUUsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQy9ELE1BQUEsTUFBTSxDQUFDLFNBQVMsMENBQUUsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBRTNELE9BQU8sR0FBRyxFQUFFOztRQUNYLGdCQUFnQixFQUFFLENBQUM7UUFDbkIsTUFBQSxNQUFNLENBQUMsU0FBUywwQ0FBRSxtQkFBbUIsQ0FBQyxhQUFhLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3hFLE1BQUEsTUFBTSxDQUFDLFNBQVMsMENBQUUsbUJBQW1CLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ2xFLE1BQUEsTUFBTSxDQUFDLFNBQVMsMENBQUUsbUJBQW1CLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQy9ELENBQUMsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IENhbnZhcywgQ2FudmFzTm9kZSB9IGZyb20gXCIuLi90eXBlcy9jYW52YXMtaW50ZXJuYWxcIjtcbmltcG9ydCB7IENhbnZhc0FQSSwgZmluZE5vZGVGcm9tRXZlbnQgfSBmcm9tIFwiLi9jYW52YXMtYXBpXCI7XG5cbi8qKlxuICogQ29sbGVjdCBhbGwgZGVzY2VuZGFudCBub2RlcyBieSB3YWxraW5nIG91dGdvaW5nIGVkZ2VzIChCRlMpLlxuICogVXNlcyB0aGUgZWRnZSBpbmRleCBmb3IgTyhOKSB0cmF2ZXJzYWwgaW5zdGVhZCBvZiBPKE4qRSkuXG4gKi9cbmZ1bmN0aW9uIGNvbGxlY3REZXNjZW5kYW50cyhjYW52YXM6IENhbnZhcywgY2FudmFzQXBpOiBDYW52YXNBUEksIG5vZGVJZDogc3RyaW5nKTogQ2FudmFzTm9kZVtdIHtcblx0Y29uc3QgcmVzdWx0OiBDYW52YXNOb2RlW10gPSBbXTtcblx0Y29uc3QgdmlzaXRlZCA9IG5ldyBTZXQ8c3RyaW5nPihbbm9kZUlkXSk7XG5cdGNvbnN0IHF1ZXVlID0gW25vZGVJZF07XG5cblx0d2hpbGUgKHF1ZXVlLmxlbmd0aCA+IDApIHtcblx0XHRjb25zdCBpZCA9IHF1ZXVlLnNoaWZ0KCkhO1xuXHRcdGZvciAoY29uc3QgZWRnZSBvZiBjYW52YXNBcGkuZ2V0T3V0Z29pbmdFZGdlcyhjYW52YXMsIGlkKSkge1xuXHRcdFx0Y29uc3QgY2hpbGRJZCA9IGVkZ2UudG8ubm9kZS5pZDtcblx0XHRcdGlmICghdmlzaXRlZC5oYXMoY2hpbGRJZCkpIHtcblx0XHRcdFx0dmlzaXRlZC5hZGQoY2hpbGRJZCk7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGVkZ2UudG8ubm9kZSk7XG5cdFx0XHRcdHF1ZXVlLnB1c2goY2hpbGRJZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgcG9pbnRlciBsaXN0ZW5lcnMgdGhhdCBtYWtlIGRyYWdnaW5nIGEgbm9kZSBhbHNvIG1vdmVcbiAqIGFsbCBpdHMgZGVzY2VuZGFudCBub2RlcywgcHJlc2VydmluZyByZWxhdGl2ZSBwb3NpdGlvbnMuXG4gKlxuICogVXNlcyBjYXB0dXJlLXBoYXNlIHBvaW50ZXJkb3duIHRvIGluc3RhbGwgYSBtb3ZlVG8gd3JhcHBlciBCRUZPUkVcbiAqIE9ic2lkaWFuJ3Mgb3duIGhhbmRsZXJzIGZpcmUsIGVuc3VyaW5nIGRlc2NlbmRhbnRzIG1vdmUgZnJvbSB0aGVcbiAqIHZlcnkgZmlyc3QgZHJhZyBmcmFtZSDigJQgZXZlbiBpbiBhIHNpbmdsZSBjbGljay1kcmFnIGdlc3R1cmUuXG4gKlxuICogSG9sZCBBbHQgd2hpbGUgZHJhZ2dpbmcgdG8gbW92ZSBvbmx5IHRoZSBzaW5nbGUgbm9kZS5cbiAqXG4gKiBSZXR1cm5zIGEgY2xlYW51cCBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVycy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyU3VidHJlZURyYWdIYW5kbGVyKGNhbnZhczogQ2FudmFzLCBjYW52YXNBcGk6IENhbnZhc0FQSSk6ICgpID0+IHZvaWQge1xuXHRsZXQgZHJhZ2dlZE5vZGU6IENhbnZhc05vZGUgfCBudWxsID0gbnVsbDtcblx0bGV0IGNhY2hlZERlc2NlbmRhbnRzOiBDYW52YXNOb2RlW10gfCBudWxsID0gbnVsbDtcblx0bGV0IG9yaWdpbmFsTW92ZVRvOiAoKHBvczogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9KSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xuXG5cdGZ1bmN0aW9uIGluc3RhbGxXcmFwcGVyKG5vZGU6IENhbnZhc05vZGUpOiB2b2lkIHtcblx0XHRjb25zdCBkZXNjZW5kYW50cyA9IGNvbGxlY3REZXNjZW5kYW50cyhjYW52YXMsIGNhbnZhc0FwaSwgbm9kZS5pZCk7XG5cdFx0aWYgKGRlc2NlbmRhbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG5cdFx0ZHJhZ2dlZE5vZGUgPSBub2RlO1xuXHRcdGNhY2hlZERlc2NlbmRhbnRzID0gZGVzY2VuZGFudHM7XG5cblx0XHQvLyBXcmFwIG1vdmVUbyBzbyBkZXNjZW5kYW50cyBtb3ZlIGluIHRoZSBzYW1lIGNhbGwgc3RhY2suXG5cdFx0Ly8gVXNlIHByb3RvdHlwZSdzIG1vdmVUbyAobm90IGluc3RhbmNlKSB0byBhdm9pZCBzdGFja2VkIHdyYXBwZXJzLlxuXHRcdG9yaWdpbmFsTW92ZVRvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKG5vZGUpLm1vdmVUby5iaW5kKG5vZGUpO1xuXHRcdG5vZGUubW92ZVRvID0gKHBvczogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9KSA9PiB7XG5cdFx0XHRjb25zdCBkeCA9IHBvcy54IC0gbm9kZS54O1xuXHRcdFx0Y29uc3QgZHkgPSBwb3MueSAtIG5vZGUueTtcblx0XHRcdG9yaWdpbmFsTW92ZVRvIShwb3MpO1xuXHRcdFx0Ly8gQ2FsbCBkZXNjZW5kYW50cycgbW92ZVRvIHZpYSBwcm90b3R5cGUgdG8gYnlwYXNzIGFueVxuXHRcdFx0Ly8gcGVyLWluc3RhbmNlIHdyYXBwZXJzIOKAlCBwcmV2ZW50cyBpbmZpbml0ZSByZWN1cnNpb24uXG5cdFx0XHRmb3IgKGNvbnN0IGRlc2Mgb2YgY2FjaGVkRGVzY2VuZGFudHMhKSB7XG5cdFx0XHRcdE9iamVjdC5nZXRQcm90b3R5cGVPZihkZXNjKS5tb3ZlVG8uY2FsbChcblx0XHRcdFx0XHRkZXNjLCB7IHg6IGRlc2MueCArIGR4LCB5OiBkZXNjLnkgKyBkeSB9XG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIGNsZWFyRHJhZ1Nlc3Npb24oKTogdm9pZCB7XG5cdFx0aWYgKGRyYWdnZWROb2RlICYmIG9yaWdpbmFsTW92ZVRvKSB7XG5cdFx0XHQvLyBSZW1vdmUgaW5zdGFuY2Ugb3ZlcnJpZGUgdG8gcmVzdG9yZSBwcm90b3R5cGUgbWV0aG9kIGxvb2t1cFxuXHRcdFx0ZGVsZXRlIChkcmFnZ2VkTm9kZSBhcyBhbnkpLm1vdmVUbztcblx0XHR9XG5cdFx0ZHJhZ2dlZE5vZGUgPSBudWxsO1xuXHRcdGNhY2hlZERlc2NlbmRhbnRzID0gbnVsbDtcblx0XHRvcmlnaW5hbE1vdmVUbyA9IG51bGw7XG5cdH1cblxuXHQvLyBDYXB0dXJlLXBoYXNlIHBvaW50ZXJkb3duOiBmaXJlcyBCRUZPUkUgT2JzaWRpYW4ncyBidWJibGUtcGhhc2UgaGFuZGxlcnMuXG5cdC8vIEZpbmQgY2xpY2tlZCBub2RlIGZyb20gZS50YXJnZXQgKHNlbGVjdGlvbiBub3QgdXBkYXRlZCB5ZXQpIGFuZCBpbnN0YWxsXG5cdC8vIHRoZSBtb3ZlVG8gd3JhcHBlciBpbW1lZGlhdGVseSDigJQgYmVmb3JlIGFueSBkcmFnIG1vdmVUbygpIGNhbGxzLlxuXHRjb25zdCBkb3duSGFuZGxlciA9IChlOiBQb2ludGVyRXZlbnQpOiB2b2lkID0+IHtcblx0XHQvLyBDbGVhciBhbnkgc3RhbGUgc2Vzc2lvbiBmcm9tIGEgcHJldmlvdXMgZHJhZ1xuXHRcdGlmIChkcmFnZ2VkTm9kZSkgY2xlYXJEcmFnU2Vzc2lvbigpO1xuXG5cdFx0aWYgKGUuYWx0S2V5KSByZXR1cm47XG5cblx0XHRjb25zdCBub2RlID0gZmluZE5vZGVGcm9tRXZlbnQoY2FudmFzLCBlKTtcblx0XHRpZiAobm9kZSkge1xuXHRcdFx0aW5zdGFsbFdyYXBwZXIobm9kZSk7XG5cdFx0fVxuXHR9O1xuXG5cdGNvbnN0IG1vdmVIYW5kbGVyID0gKGU6IFBvaW50ZXJFdmVudCk6IHZvaWQgPT4ge1xuXHRcdGlmIChlLmJ1dHRvbnMgPT09IDApIHJldHVybjtcblxuXHRcdC8vIEFsdCBrZXkgPSBzb2xvIGRyYWdcblx0XHRpZiAoZS5hbHRLZXkpIHtcblx0XHRcdGlmIChkcmFnZ2VkTm9kZSkgY2xlYXJEcmFnU2Vzc2lvbigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEZhbGxiYWNrOiBpZiBkb3duSGFuZGxlciBtaXNzZWQgKGUuZy4gcHJvZ3JhbW1hdGljIHNlbGVjdGlvbilcblx0XHRpZiAoIWRyYWdnZWROb2RlKSB7XG5cdFx0XHRjb25zdCBub2RlID0gY2FudmFzQXBpLmdldFNlbGVjdGVkTm9kZShjYW52YXMpO1xuXHRcdFx0aWYgKG5vZGUpIGluc3RhbGxXcmFwcGVyKG5vZGUpO1xuXHRcdFx0aWYgKCFkcmFnZ2VkTm9kZSkgcmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFZlcmlmeSB0aGUgZHJhZ2dlZCBub2RlIGlzIHN0aWxsIHNlbGVjdGVkXG5cdFx0Y29uc3QgY3VycmVudFNlbGVjdGVkID0gY2FudmFzQXBpLmdldFNlbGVjdGVkTm9kZShjYW52YXMpO1xuXHRcdGlmICghY3VycmVudFNlbGVjdGVkIHx8IGN1cnJlbnRTZWxlY3RlZC5pZCAhPT0gZHJhZ2dlZE5vZGUuaWQpIHtcblx0XHRcdGNsZWFyRHJhZ1Nlc3Npb24oKTtcblx0XHR9XG5cdH07XG5cblx0Y29uc3QgdXBIYW5kbGVyID0gKCk6IHZvaWQgPT4ge1xuXHRcdGlmICghZHJhZ2dlZE5vZGUpIHJldHVybjtcblx0XHRjYW52YXMucmVxdWVzdFNhdmUoKTtcblx0XHRjbGVhckRyYWdTZXNzaW9uKCk7XG5cdH07XG5cblx0Ly8gZG93bkhhbmRsZXIgaW4gY2FwdHVyZSBwaGFzZSAodHJ1ZSkg4oCUIGZpcmVzIGJlZm9yZSBPYnNpZGlhbidzIGhhbmRsZXJzXG5cdGNhbnZhcy53cmFwcGVyRWw/LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVyZG93blwiLCBkb3duSGFuZGxlciwgdHJ1ZSk7XG5cdGNhbnZhcy53cmFwcGVyRWw/LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVybW92ZVwiLCBtb3ZlSGFuZGxlcik7XG5cdGNhbnZhcy53cmFwcGVyRWw/LmFkZEV2ZW50TGlzdGVuZXIoXCJwb2ludGVydXBcIiwgdXBIYW5kbGVyKTtcblxuXHRyZXR1cm4gKCkgPT4ge1xuXHRcdGNsZWFyRHJhZ1Nlc3Npb24oKTtcblx0XHRjYW52YXMud3JhcHBlckVsPy5yZW1vdmVFdmVudExpc3RlbmVyKFwicG9pbnRlcmRvd25cIiwgZG93bkhhbmRsZXIsIHRydWUpO1xuXHRcdGNhbnZhcy53cmFwcGVyRWw/LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJwb2ludGVybW92ZVwiLCBtb3ZlSGFuZGxlcik7XG5cdFx0Y2FudmFzLndyYXBwZXJFbD8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJ1cFwiLCB1cEhhbmRsZXIpO1xuXHR9O1xufVxuIl19