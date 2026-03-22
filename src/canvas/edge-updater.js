function getCenter(node) {
    return {
        cx: node.x + node.width / 2,
        cy: node.y + node.height / 2,
    };
}
/**
 * Compute the optimal connection sides for an edge based on
 * the relative positions of the two connected nodes.
 * Uses a dominant-axis heuristic: whichever axis has the larger
 * center-to-center distance determines the side pair.
 */
export function computeEdgeSides(fromNode, toNode) {
    const fromCenter = getCenter(fromNode);
    const toCenter = getCenter(toNode);
    const dx = toCenter.cx - fromCenter.cx;
    // Mind map edges always connect horizontally (left/right).
    if (dx >= 0) {
        return { fromSide: "right", toSide: "left" };
    }
    else {
        return { fromSide: "left", toSide: "right" };
    }
}
/**
 * Update the from/to sides of all edges in the canvas
 * to match the current positions of their connected nodes.
 * Only mutates edges whose sides actually changed.
 */
export function updateAllEdgeSides(canvas) {
    let changed = false;
    for (const edge of canvas.edges.values()) {
        const fromNode = edge.from.node;
        const toNode = edge.to.node;
        if (!fromNode || !toNode)
            continue;
        const { fromSide, toSide } = computeEdgeSides(fromNode, toNode);
        if (edge.from.side !== fromSide || edge.to.side !== toSide) {
            edge.from.side = fromSide;
            edge.to.side = toSide;
            changed = true;
        }
    }
    if (changed) {
        canvas.requestFrame();
        canvas.requestSave();
    }
}
/**
 * Register pointer listeners on the canvas wrapper that update
 * edge connection sides both during and after node drags.
 * Uses a throttled pointermove for live updates and an immediate
 * pointerup for a final correction when the drag ends.
 * Returns a cleanup function to remove the listeners.
 */
export function registerDragEndHandler(canvas) {
    var _a, _b;
    let lastMoveUpdate = 0;
    const THROTTLE_MS = 40; // ~25fps — responsive but not wasteful
    const moveHandler = (e) => {
        // Only update while a button is pressed (i.e. during a drag)
        if (e.buttons === 0)
            return;
        const now = Date.now();
        if (now - lastMoveUpdate < THROTTLE_MS)
            return;
        lastMoveUpdate = now;
        updateAllEdgeSides(canvas);
    };
    const upHandler = () => {
        updateAllEdgeSides(canvas);
    };
    (_a = canvas.wrapperEl) === null || _a === void 0 ? void 0 : _a.addEventListener("pointermove", moveHandler);
    (_b = canvas.wrapperEl) === null || _b === void 0 ? void 0 : _b.addEventListener("pointerup", upHandler);
    return () => {
        var _a, _b;
        (_a = canvas.wrapperEl) === null || _a === void 0 ? void 0 : _a.removeEventListener("pointermove", moveHandler);
        (_b = canvas.wrapperEl) === null || _b === void 0 ? void 0 : _b.removeEventListener("pointerup", upHandler);
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRnZS11cGRhdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZWRnZS11cGRhdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQU9BLFNBQVMsU0FBUyxDQUFDLElBQWdCO0lBQ2xDLE9BQU87UUFDTixFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUM7UUFDM0IsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDO0tBQzVCLENBQUM7QUFDSCxDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsZ0JBQWdCLENBQy9CLFFBQW9CLEVBQ3BCLE1BQWtCO0lBRWxCLE1BQU0sVUFBVSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN2QyxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFbkMsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLEVBQUUsR0FBRyxVQUFVLENBQUMsRUFBRSxDQUFDO0lBRXZDLDJEQUEyRDtJQUMzRCxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUNiLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQztJQUM5QyxDQUFDO1NBQU0sQ0FBQztRQUNQLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsQ0FBQztJQUM5QyxDQUFDO0FBQ0YsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsTUFBYztJQUNoRCxJQUFJLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFFcEIsS0FBSyxNQUFNLElBQUksSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7UUFDMUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDaEMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUM7UUFFNUIsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLE1BQU07WUFBRSxTQUFTO1FBRW5DLE1BQU0sRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLEdBQUcsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRWhFLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRSxDQUFDO1lBQzVELElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQztZQUMxQixJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUM7WUFDdEIsT0FBTyxHQUFHLElBQUksQ0FBQztRQUNoQixDQUFDO0lBQ0YsQ0FBQztJQUVELElBQUksT0FBTyxFQUFFLENBQUM7UUFDYixNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDdEIsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3RCLENBQUM7QUFDRixDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUFDLE1BQWM7O0lBQ3BELElBQUksY0FBYyxHQUFHLENBQUMsQ0FBQztJQUN2QixNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUMsQ0FBQyx1Q0FBdUM7SUFFL0QsTUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFlLEVBQUUsRUFBRTtRQUN2Qyw2REFBNkQ7UUFDN0QsSUFBSSxDQUFDLENBQUMsT0FBTyxLQUFLLENBQUM7WUFBRSxPQUFPO1FBRTVCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN2QixJQUFJLEdBQUcsR0FBRyxjQUFjLEdBQUcsV0FBVztZQUFFLE9BQU87UUFDL0MsY0FBYyxHQUFHLEdBQUcsQ0FBQztRQUVyQixrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM1QixDQUFDLENBQUM7SUFFRixNQUFNLFNBQVMsR0FBRyxHQUFHLEVBQUU7UUFDdEIsa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDNUIsQ0FBQyxDQUFDO0lBRUYsTUFBQSxNQUFNLENBQUMsU0FBUywwQ0FBRSxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDL0QsTUFBQSxNQUFNLENBQUMsU0FBUywwQ0FBRSxnQkFBZ0IsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFFM0QsT0FBTyxHQUFHLEVBQUU7O1FBQ1gsTUFBQSxNQUFNLENBQUMsU0FBUywwQ0FBRSxtQkFBbUIsQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDbEUsTUFBQSxNQUFNLENBQUMsU0FBUywwQ0FBRSxtQkFBbUIsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDL0QsQ0FBQyxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgQ2FudmFzLCBDYW52YXNOb2RlLCBOb2RlU2lkZSB9IGZyb20gXCIuLi90eXBlcy9jYW52YXMtaW50ZXJuYWxcIjtcblxuaW50ZXJmYWNlIE5vZGVDZW50ZXIge1xuXHRjeDogbnVtYmVyO1xuXHRjeTogbnVtYmVyO1xufVxuXG5mdW5jdGlvbiBnZXRDZW50ZXIobm9kZTogQ2FudmFzTm9kZSk6IE5vZGVDZW50ZXIge1xuXHRyZXR1cm4ge1xuXHRcdGN4OiBub2RlLnggKyBub2RlLndpZHRoIC8gMixcblx0XHRjeTogbm9kZS55ICsgbm9kZS5oZWlnaHQgLyAyLFxuXHR9O1xufVxuXG4vKipcbiAqIENvbXB1dGUgdGhlIG9wdGltYWwgY29ubmVjdGlvbiBzaWRlcyBmb3IgYW4gZWRnZSBiYXNlZCBvblxuICogdGhlIHJlbGF0aXZlIHBvc2l0aW9ucyBvZiB0aGUgdHdvIGNvbm5lY3RlZCBub2Rlcy5cbiAqIFVzZXMgYSBkb21pbmFudC1heGlzIGhldXJpc3RpYzogd2hpY2hldmVyIGF4aXMgaGFzIHRoZSBsYXJnZXJcbiAqIGNlbnRlci10by1jZW50ZXIgZGlzdGFuY2UgZGV0ZXJtaW5lcyB0aGUgc2lkZSBwYWlyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcHV0ZUVkZ2VTaWRlcyhcblx0ZnJvbU5vZGU6IENhbnZhc05vZGUsXG5cdHRvTm9kZTogQ2FudmFzTm9kZVxuKTogeyBmcm9tU2lkZTogTm9kZVNpZGU7IHRvU2lkZTogTm9kZVNpZGUgfSB7XG5cdGNvbnN0IGZyb21DZW50ZXIgPSBnZXRDZW50ZXIoZnJvbU5vZGUpO1xuXHRjb25zdCB0b0NlbnRlciA9IGdldENlbnRlcih0b05vZGUpO1xuXG5cdGNvbnN0IGR4ID0gdG9DZW50ZXIuY3ggLSBmcm9tQ2VudGVyLmN4O1xuXG5cdC8vIE1pbmQgbWFwIGVkZ2VzIGFsd2F5cyBjb25uZWN0IGhvcml6b250YWxseSAobGVmdC9yaWdodCkuXG5cdGlmIChkeCA+PSAwKSB7XG5cdFx0cmV0dXJuIHsgZnJvbVNpZGU6IFwicmlnaHRcIiwgdG9TaWRlOiBcImxlZnRcIiB9O1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiB7IGZyb21TaWRlOiBcImxlZnRcIiwgdG9TaWRlOiBcInJpZ2h0XCIgfTtcblx0fVxufVxuXG4vKipcbiAqIFVwZGF0ZSB0aGUgZnJvbS90byBzaWRlcyBvZiBhbGwgZWRnZXMgaW4gdGhlIGNhbnZhc1xuICogdG8gbWF0Y2ggdGhlIGN1cnJlbnQgcG9zaXRpb25zIG9mIHRoZWlyIGNvbm5lY3RlZCBub2Rlcy5cbiAqIE9ubHkgbXV0YXRlcyBlZGdlcyB3aG9zZSBzaWRlcyBhY3R1YWxseSBjaGFuZ2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlQWxsRWRnZVNpZGVzKGNhbnZhczogQ2FudmFzKTogdm9pZCB7XG5cdGxldCBjaGFuZ2VkID0gZmFsc2U7XG5cblx0Zm9yIChjb25zdCBlZGdlIG9mIGNhbnZhcy5lZGdlcy52YWx1ZXMoKSkge1xuXHRcdGNvbnN0IGZyb21Ob2RlID0gZWRnZS5mcm9tLm5vZGU7XG5cdFx0Y29uc3QgdG9Ob2RlID0gZWRnZS50by5ub2RlO1xuXG5cdFx0aWYgKCFmcm9tTm9kZSB8fCAhdG9Ob2RlKSBjb250aW51ZTtcblxuXHRcdGNvbnN0IHsgZnJvbVNpZGUsIHRvU2lkZSB9ID0gY29tcHV0ZUVkZ2VTaWRlcyhmcm9tTm9kZSwgdG9Ob2RlKTtcblxuXHRcdGlmIChlZGdlLmZyb20uc2lkZSAhPT0gZnJvbVNpZGUgfHwgZWRnZS50by5zaWRlICE9PSB0b1NpZGUpIHtcblx0XHRcdGVkZ2UuZnJvbS5zaWRlID0gZnJvbVNpZGU7XG5cdFx0XHRlZGdlLnRvLnNpZGUgPSB0b1NpZGU7XG5cdFx0XHRjaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRpZiAoY2hhbmdlZCkge1xuXHRcdGNhbnZhcy5yZXF1ZXN0RnJhbWUoKTtcblx0XHRjYW52YXMucmVxdWVzdFNhdmUoKTtcblx0fVxufVxuXG4vKipcbiAqIFJlZ2lzdGVyIHBvaW50ZXIgbGlzdGVuZXJzIG9uIHRoZSBjYW52YXMgd3JhcHBlciB0aGF0IHVwZGF0ZVxuICogZWRnZSBjb25uZWN0aW9uIHNpZGVzIGJvdGggZHVyaW5nIGFuZCBhZnRlciBub2RlIGRyYWdzLlxuICogVXNlcyBhIHRocm90dGxlZCBwb2ludGVybW92ZSBmb3IgbGl2ZSB1cGRhdGVzIGFuZCBhbiBpbW1lZGlhdGVcbiAqIHBvaW50ZXJ1cCBmb3IgYSBmaW5hbCBjb3JyZWN0aW9uIHdoZW4gdGhlIGRyYWcgZW5kcy5cbiAqIFJldHVybnMgYSBjbGVhbnVwIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXJzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJEcmFnRW5kSGFuZGxlcihjYW52YXM6IENhbnZhcyk6ICgpID0+IHZvaWQge1xuXHRsZXQgbGFzdE1vdmVVcGRhdGUgPSAwO1xuXHRjb25zdCBUSFJPVFRMRV9NUyA9IDQwOyAvLyB+MjVmcHMg4oCUIHJlc3BvbnNpdmUgYnV0IG5vdCB3YXN0ZWZ1bFxuXG5cdGNvbnN0IG1vdmVIYW5kbGVyID0gKGU6IFBvaW50ZXJFdmVudCkgPT4ge1xuXHRcdC8vIE9ubHkgdXBkYXRlIHdoaWxlIGEgYnV0dG9uIGlzIHByZXNzZWQgKGkuZS4gZHVyaW5nIGEgZHJhZylcblx0XHRpZiAoZS5idXR0b25zID09PSAwKSByZXR1cm47XG5cblx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdGlmIChub3cgLSBsYXN0TW92ZVVwZGF0ZSA8IFRIUk9UVExFX01TKSByZXR1cm47XG5cdFx0bGFzdE1vdmVVcGRhdGUgPSBub3c7XG5cblx0XHR1cGRhdGVBbGxFZGdlU2lkZXMoY2FudmFzKTtcblx0fTtcblxuXHRjb25zdCB1cEhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0dXBkYXRlQWxsRWRnZVNpZGVzKGNhbnZhcyk7XG5cdH07XG5cblx0Y2FudmFzLndyYXBwZXJFbD8uYWRkRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJtb3ZlXCIsIG1vdmVIYW5kbGVyKTtcblx0Y2FudmFzLndyYXBwZXJFbD8uYWRkRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJ1cFwiLCB1cEhhbmRsZXIpO1xuXG5cdHJldHVybiAoKSA9PiB7XG5cdFx0Y2FudmFzLndyYXBwZXJFbD8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJtb3ZlXCIsIG1vdmVIYW5kbGVyKTtcblx0XHRjYW52YXMud3JhcHBlckVsPy5yZW1vdmVFdmVudExpc3RlbmVyKFwicG9pbnRlcnVwXCIsIHVwSGFuZGxlcik7XG5cdH07XG59XG4iXX0=