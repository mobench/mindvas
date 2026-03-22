import { findNodeFromEvent } from "./canvas-api";
import { getGroupIds } from "../mindmap/tree-model";
/**
 * Identify "stranger" nodes inside a group — nodes whose parent is outside the group,
 * plus their descendants that are also inside the group.
 */
function identifyStrangers(canvas, canvasApi, group) {
    const groupIds = getGroupIds(canvas);
    // Find all non-group nodes whose center is inside the group bounds
    const gx = group.x;
    const gy = group.y;
    const gw = group.width;
    const gh = group.height;
    const insideIds = new Set();
    const insideNodes = new Map();
    for (const node of canvas.nodes.values()) {
        if (groupIds.has(node.id))
            continue;
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        if (cx >= gx && cx <= gx + gw && cy >= gy && cy <= gy + gh) {
            insideIds.add(node.id);
            insideNodes.set(node.id, node);
        }
    }
    // Find stranger entry points: inside nodes whose parent is outside the group
    const strangerIds = new Set();
    for (const nodeId of insideIds) {
        const node = insideNodes.get(nodeId);
        const parent = canvasApi.getParentNode(canvas, node);
        if (parent && !insideIds.has(parent.id)) {
            // This node's parent is outside — it's a stranger entry point.
            // BFS to collect it and its descendants that are also inside.
            const queue = [nodeId];
            strangerIds.add(nodeId);
            while (queue.length > 0) {
                const id = queue.shift();
                for (const edge of canvasApi.getOutgoingEdges(canvas, id)) {
                    const childId = edge.to.node.id;
                    if (!strangerIds.has(childId) && insideIds.has(childId)) {
                        strangerIds.add(childId);
                        queue.push(childId);
                    }
                }
            }
        }
    }
    return Array.from(strangerIds).map(id => insideNodes.get(id));
}
/**
 * Register Alt+drag handler for groups: when Alt is held during a group drag,
 * stranger nodes (belonging to other trees) stay put while the group and its
 * legitimate contents relocate.
 *
 * Returns a cleanup function to remove the listeners.
 */
export function registerGroupDragHandler(canvas, canvasApi) {
    var _a, _b;
    const frozenNodes = [];
    const downHandler = (e) => {
        if (!e.altKey)
            return;
        const node = findNodeFromEvent(canvas, e);
        if (!node)
            return;
        // Check if the clicked node is a group
        if (!getGroupIds(canvas).has(node.id))
            return;
        const strangers = identifyStrangers(canvas, canvasApi, node);
        for (const stranger of strangers) {
            frozenNodes.push(stranger);
            stranger.moveTo = () => { };
        }
    };
    const upHandler = () => {
        if (frozenNodes.length === 0)
            return;
        for (const node of frozenNodes) {
            delete node.moveTo;
        }
        frozenNodes.length = 0;
        canvas.requestSave();
    };
    (_a = canvas.wrapperEl) === null || _a === void 0 ? void 0 : _a.addEventListener("pointerdown", downHandler, true);
    (_b = canvas.wrapperEl) === null || _b === void 0 ? void 0 : _b.addEventListener("pointerup", upHandler);
    return () => {
        var _a, _b;
        if (frozenNodes.length > 0) {
            for (const node of frozenNodes) {
                delete node.moveTo;
            }
            frozenNodes.length = 0;
        }
        (_a = canvas.wrapperEl) === null || _a === void 0 ? void 0 : _a.removeEventListener("pointerdown", downHandler, true);
        (_b = canvas.wrapperEl) === null || _b === void 0 ? void 0 : _b.removeEventListener("pointerup", upHandler);
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JvdXAtZHJhZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdyb3VwLWRyYWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFhLGlCQUFpQixFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQzVELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUVwRDs7O0dBR0c7QUFDSCxTQUFTLGlCQUFpQixDQUFDLE1BQWMsRUFBRSxTQUFvQixFQUFFLEtBQWlCO0lBQ2pGLE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUVyQyxtRUFBbUU7SUFDbkUsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNuQixNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ25CLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUM7SUFDdkIsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUV4QixNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBQ3BDLE1BQU0sV0FBVyxHQUFHLElBQUksR0FBRyxFQUFzQixDQUFDO0lBRWxELEtBQUssTUFBTSxJQUFJLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO1FBQzFDLElBQUksUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQUUsU0FBUztRQUNwQyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO1FBQ25DLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFDcEMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFF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TSxLQUFLLENBQUM7WUFBRSxPQUFPO1FBQ3JDLEtBQUssTUFBTSxJQUFJLElBQUksV0FBVyxFQUFFLENBQUM7WUFDaEMsT0FBUSxJQUFZLENBQUMsTUFBTSxDQUFDO1FBQzdCLENBQUM7UUFDRCxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUN2QixNQUFNLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDdEIsQ0FBQyxDQUFDO0lBRUYsTUFBQSxNQUFNLENBQUMsU0FBUywwQ0FBRSxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3JFLE1BQUEsTUFBTSxDQUFDLFNBQVMsMENBQUUsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBRTNELE9BQU8sR0FBRyxFQUFFOztRQUNYLElBQUksV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM1QixLQUFLLE1BQU0sSUFBSSxJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUNoQyxPQUFRLElBQVksQ0FBQyxNQUFNLENBQUM7WUFDN0IsQ0FBQztZQUNELFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ3hCLENBQUM7UUFDRCxNQUFBLE1BQU0sQ0FBQyxTQUFTLDBDQUFFLG1CQUFtQixDQUFDLGFBQWEsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEUsTUFBQSxNQUFNLENBQUMsU0FBUywwQ0FBRSxtQkFBbUIsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDL0QsQ0FBQyxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgQ2FudmFzLCBDYW52YXNOb2RlIH0gZnJvbSBcIi4uL3R5cGVzL2NhbnZhcy1pbnRlcm5hbFwiO1xuaW1wb3J0IHsgQ2FudmFzQVBJLCBmaW5kTm9kZUZyb21FdmVudCB9IGZyb20gXCIuL2NhbnZhcy1hcGlcIjtcbmltcG9ydCB7IGdldEdyb3VwSWRzIH0gZnJvbSBcIi4uL21pbmRtYXAvdHJlZS1tb2RlbFwiO1xuXG4vKipcbiAqIElkZW50aWZ5IFwic3RyYW5nZXJcIiBub2RlcyBpbnNpZGUgYSBncm91cCDigJQgbm9kZXMgd2hvc2UgcGFyZW50IGlzIG91dHNpZGUgdGhlIGdyb3VwLFxuICogcGx1cyB0aGVpciBkZXNjZW5kYW50cyB0aGF0IGFyZSBhbHNvIGluc2lkZSB0aGUgZ3JvdXAuXG4gKi9cbmZ1bmN0aW9uIGlkZW50aWZ5U3RyYW5nZXJzKGNhbnZhczogQ2FudmFzLCBjYW52YXNBcGk6IENhbnZhc0FQSSwgZ3JvdXA6IENhbnZhc05vZGUpOiBDYW52YXNOb2RlW10ge1xuXHRjb25zdCBncm91cElkcyA9IGdldEdyb3VwSWRzKGNhbnZhcyk7XG5cblx0Ly8gRmluZCBhbGwgbm9uLWdyb3VwIG5vZGVzIHdob3NlIGNlbnRlciBpcyBpbnNpZGUgdGhlIGdyb3VwIGJvdW5kc1xuXHRjb25zdCBneCA9IGdyb3VwLng7XG5cdGNvbnN0IGd5ID0gZ3JvdXAueTtcblx0Y29uc3QgZ3cgPSBncm91cC53aWR0aDtcblx0Y29uc3QgZ2ggPSBncm91cC5oZWlnaHQ7XG5cblx0Y29uc3QgaW5zaWRlSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdGNvbnN0IGluc2lkZU5vZGVzID0gbmV3IE1hcDxzdHJpbmcsIENhbnZhc05vZGU+KCk7XG5cblx0Zm9yIChjb25zdCBub2RlIG9mIGNhbnZhcy5ub2Rlcy52YWx1ZXMoKSkge1xuXHRcdGlmIChncm91cElkcy5oYXMobm9kZS5pZCkpIGNvbnRpbnVlO1xuXHRcdGNvbnN0IGN4ID0gbm9kZS54ICsgbm9kZS53aWR0aCAvIDI7XG5cdFx0Y29uc3QgY3kgPSBub2RlLnkgKyBub2RlLmhlaWdodCAvIDI7XG5cdFx0aWYgKGN4ID49IGd4ICYmIGN4IDw9IGd4ICsgZ3cgJiYgY3kgPj0gZ3kgJiYgY3kgPD0gZ3kgKyBnaCkge1xuXHRcdFx0aW5zaWRlSWRzLmFkZChub2RlLmlkKTtcblx0XHRcdGluc2lkZU5vZGVzLnNldChub2RlLmlkLCBub2RlKTtcblx0XHR9XG5cdH1cblxuXHQvLyBGaW5kIHN0cmFuZ2VyIGVudHJ5IHBvaW50czogaW5zaWRlIG5vZGVzIHdob3NlIHBhcmVudCBpcyBvdXRzaWRlIHRoZSBncm91cFxuXHRjb25zdCBzdHJhbmdlcklkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdGZvciAoY29uc3Qgbm9kZUlkIG9mIGluc2lkZUlkcykge1xuXHRcdGNvbnN0IG5vZGUgPSBpbnNpZGVOb2Rlcy5nZXQobm9kZUlkKSE7XG5cdFx0Y29uc3QgcGFyZW50ID0gY2FudmFzQXBpLmdldFBhcmVudE5vZGUoY2FudmFzLCBub2RlKTtcblx0XHRpZiAocGFyZW50ICYmICFpbnNpZGVJZHMuaGFzKHBhcmVudC5pZCkpIHtcblx0XHRcdC8vIFRoaXMgbm9kZSdzIHBhcmVudCBpcyBvdXRzaWRlIOKAlCBpdCdzIGEgc3RyYW5nZXIgZW50cnkgcG9pbnQuXG5cdFx0XHQvLyBCRlMgdG8gY29sbGVjdCBpdCBhbmQgaXRzIGRlc2NlbmRhbnRzIHRoYXQgYXJlIGFsc28gaW5zaWRlLlxuXHRcdFx0Y29uc3QgcXVldWUgPSBbbm9kZUlkXTtcblx0XHRcdHN0cmFuZ2VySWRzLmFkZChub2RlSWQpO1xuXHRcdFx0d2hpbGUgKHF1ZXVlLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Y29uc3QgaWQgPSBxdWV1ZS5zaGlmdCgpITtcblx0XHRcdFx0Zm9yIChjb25zdCBlZGdlIG9mIGNhbnZhc0FwaS5nZXRPdXRnb2luZ0VkZ2VzKGNhbnZhcywgaWQpKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2hpbGRJZCA9IGVkZ2UudG8ubm9kZS5pZDtcblx0XHRcdFx0XHRpZiAoIXN0cmFuZ2VySWRzLmhhcyhjaGlsZElkKSAmJiBpbnNpZGVJZHMuaGFzKGNoaWxkSWQpKSB7XG5cdFx0XHRcdFx0XHRzdHJhbmdlcklkcy5hZGQoY2hpbGRJZCk7XG5cdFx0XHRcdFx0XHRxdWV1ZS5wdXNoKGNoaWxkSWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiBBcnJheS5mcm9tKHN0cmFuZ2VySWRzKS5tYXAoaWQgPT4gaW5zaWRlTm9kZXMuZ2V0KGlkKSEpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIEFsdCtkcmFnIGhhbmRsZXIgZm9yIGdyb3Vwczogd2hlbiBBbHQgaXMgaGVsZCBkdXJpbmcgYSBncm91cCBkcmFnLFxuICogc3RyYW5nZXIgbm9kZXMgKGJlbG9uZ2luZyB0byBvdGhlciB0cmVlcykgc3RheSBwdXQgd2hpbGUgdGhlIGdyb3VwIGFuZCBpdHNcbiAqIGxlZ2l0aW1hdGUgY29udGVudHMgcmVsb2NhdGUuXG4gKlxuICogUmV0dXJucyBhIGNsZWFudXAgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lcnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3Rlckdyb3VwRHJhZ0hhbmRsZXIoY2FudmFzOiBDYW52YXMsIGNhbnZhc0FwaTogQ2FudmFzQVBJKTogKCkgPT4gdm9pZCB7XG5cdGNvbnN0IGZyb3plbk5vZGVzOiBDYW52YXNOb2RlW10gPSBbXTtcblxuXHRjb25zdCBkb3duSGFuZGxlciA9IChlOiBQb2ludGVyRXZlbnQpOiB2b2lkID0+IHtcblx0XHRpZiAoIWUuYWx0S2V5KSByZXR1cm47XG5cblx0XHRjb25zdCBub2RlID0gZmluZE5vZGVGcm9tRXZlbnQoY2FudmFzLCBlKTtcblx0XHRpZiAoIW5vZGUpIHJldHVybjtcblxuXHRcdC8vIENoZWNrIGlmIHRoZSBjbGlja2VkIG5vZGUgaXMgYSBncm91cFxuXHRcdGlmICghZ2V0R3JvdXBJZHMoY2FudmFzKS5oYXMobm9kZS5pZCkpIHJldHVybjtcblxuXHRcdGNvbnN0IHN0cmFuZ2VycyA9IGlkZW50aWZ5U3RyYW5nZXJzKGNhbnZhcywgY2FudmFzQXBpLCBub2RlKTtcblx0XHRmb3IgKGNvbnN0IHN0cmFuZ2VyIG9mIHN0cmFuZ2Vycykge1xuXHRcdFx0ZnJvemVuTm9kZXMucHVzaChzdHJhbmdlcik7XG5cdFx0XHRzdHJhbmdlci5tb3ZlVG8gPSAoKSA9PiB7fTtcblx0XHR9XG5cdH07XG5cblx0Y29uc3QgdXBIYW5kbGVyID0gKCk6IHZvaWQgPT4ge1xuXHRcdGlmIChmcm96ZW5Ob2Rlcy5sZW5ndGggPT09IDApIHJldHVybjtcblx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgZnJvemVuTm9kZXMpIHtcblx0XHRcdGRlbGV0ZSAobm9kZSBhcyBhbnkpLm1vdmVUbztcblx0XHR9XG5cdFx0ZnJvemVuTm9kZXMubGVuZ3RoID0gMDtcblx0XHRjYW52YXMucmVxdWVzdFNhdmUoKTtcblx0fTtcblxuXHRjYW52YXMud3JhcHBlckVsPy5hZGRFdmVudExpc3RlbmVyKFwicG9pbnRlcmRvd25cIiwgZG93bkhhbmRsZXIsIHRydWUpO1xuXHRjYW52YXMud3JhcHBlckVsPy5hZGRFdmVudExpc3RlbmVyKFwicG9pbnRlcnVwXCIsIHVwSGFuZGxlcik7XG5cblx0cmV0dXJuICgpID0+IHtcblx0XHRpZiAoZnJvemVuTm9kZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0Zm9yIChjb25zdCBub2RlIG9mIGZyb3plbk5vZGVzKSB7XG5cdFx0XHRcdGRlbGV0ZSAobm9kZSBhcyBhbnkpLm1vdmVUbztcblx0XHRcdH1cblx0XHRcdGZyb3plbk5vZGVzLmxlbmd0aCA9IDA7XG5cdFx0fVxuXHRcdGNhbnZhcy53cmFwcGVyRWw/LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJwb2ludGVyZG93blwiLCBkb3duSGFuZGxlciwgdHJ1ZSk7XG5cdFx0Y2FudmFzLndyYXBwZXJFbD8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJ1cFwiLCB1cEhhbmRsZXIpO1xuXHR9O1xufVxuIl19