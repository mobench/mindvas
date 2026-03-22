import { buildForest, findTreeForNode, getDescendants } from "../mindmap/tree-model";
/**
 * Zoom and focus utilities for mind map navigation.
 */
export class Navigation {
    constructor(canvasApi) {
        this.canvasApi = canvasApi;
    }
    /**
     * Zoom to fit an entire branch (node + all descendants).
     * Triggered by Ctrl+click on a node.
     */
    zoomToBranch(canvas, node) {
        const forest = buildForest(canvas);
        if (forest.length === 0)
            return;
        const treeNode = findTreeForNode(forest, node.id);
        if (!treeNode)
            return;
        const descendants = getDescendants(treeNode);
        const allNodes = [treeNode, ...descendants];
        if (allNodes.length === 0)
            return;
        // Calculate bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of allNodes) {
            const cn = n.canvasNode;
            minX = Math.min(minX, cn.x);
            minY = Math.min(minY, cn.y);
            maxX = Math.max(maxX, cn.x + cn.width);
            maxY = Math.max(maxY, cn.y + cn.height);
        }
        // Add padding
        const pad = 50;
        canvas.zoomToBbox({
            minX: minX - pad,
            minY: minY - pad,
            maxX: maxX + pad,
            maxY: maxY + pad,
        });
    }
    /**
     * Register Ctrl+click handler for zoom-to-branch.
     */
    registerClickHandler(canvas) {
        var _a;
        const handler = (e) => {
            if (!e.ctrlKey && !e.metaKey)
                return;
            // Find which node was clicked
            const target = e.target;
            const nodeEl = target.closest(".canvas-node");
            if (!nodeEl)
                return;
            // Find the canvas node by matching DOM element
            for (const node of canvas.nodes.values()) {
                if (node.nodeEl === nodeEl) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.zoomToBranch(canvas, node);
                    break;
                }
            }
        };
        (_a = canvas.wrapperEl) === null || _a === void 0 ? void 0 : _a.addEventListener("click", handler, true);
        return () => {
            var _a;
            (_a = canvas.wrapperEl) === null || _a === void 0 ? void 0 : _a.removeEventListener("click", handler, true);
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmF2aWdhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm5hdmlnYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFFLFdBQVcsRUFBRSxlQUFlLEVBQUUsY0FBYyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFckY7O0dBRUc7QUFDSCxNQUFNLE9BQU8sVUFBVTtJQUN0QixZQUFvQixTQUFvQjtRQUFwQixjQUFTLEdBQVQsU0FBUyxDQUFXO0lBQUcsQ0FBQztJQUU1Qzs7O09BR0c7SUFDSCxZQUFZLENBQUMsTUFBYyxFQUFFLElBQWdCO1FBQzVDLE1BQU0sTUFBTSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNuQyxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUFFLE9BQU87UUFFaEMsTUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDLFFBQVE7WUFBRSxPQUFPO1FBRXRCLE1BQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM3QyxNQUFNLFFBQVEsR0FBRyxDQUFDLFFBQVEsRUFBRSxHQUFHLFdBQVcsQ0FBQyxDQUFDO1FBQzVDLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDO1lBQUUsT0FBTztRQUVsQyx5QkFBeUI7UUFDekIsSUFBSSxJQUFJLEdBQUcsUUFBUSxFQUNsQixJQUFJLEdBQUcsUUFBUSxFQUNmLElBQUksR0FBRyxDQUFDLFFBQVEsRUFDaEIsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDO1FBRWxCLEtBQUssTUFBTSxDQUFDLElBQUksUUFBUSxFQUFFLENBQUM7WUFDMUIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQztZQUN4QixJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVCLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUIsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3ZDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN6QyxDQUFDO1FBRUQsY0FBYztRQUNkLE1BQU0sR0FBRyxHQUFHLEVBQUUsQ0FBQztRQUNmLE1BQU0sQ0FBQyxVQUFVLENBQUM7WUFDakIsSUFBSSxFQUFFLElBQUksR0FBRyxHQUFHO1lBQ2hCLElBQUksRUFBRSxJQUFJLEdBQUcsR0FBRztZQUNoQixJQUFJLEVBQUUsSUFBSSxHQUFHLEdBQUc7WUFDaEIsSUFBSSxFQUFFLElBQUksR0FBRyxHQUFHO1NBQ2hCLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILG9CQUFvQixDQUFDLE1BQWM7O1FBQ2xDLE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBYSxFQUFFLEVBQUU7WUFDakMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTztnQkFBRSxPQUFPO1lBRXJDLDhCQUE4QjtZQUM5QixNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBcUIsQ0FBQztZQUN2QyxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBZ0IsQ0FBQztZQUM3RCxJQUFJLENBQUMsTUFBTTtnQkFBRSxPQUFPO1lBRXBCLCtDQUErQztZQUMvQyxLQUFLLE1BQU0sSUFBSSxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztnQkFDMUMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLE1BQU0sRUFBRSxDQUFDO29CQUM1QixDQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7b0JBQ25CLENBQUMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztvQkFDcEIsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBQ2hDLE1BQU07Z0JBQ1AsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDLENBQUM7UUFFRixNQUFBLE1BQU0sQ0FBQyxTQUFTLDBDQUFFLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFM0QsT0FBTyxHQUFHLEVBQUU7O1lBQ1gsTUFBQSxNQUFNLENBQUMsU0FBUywwQ0FBRSxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQy9ELENBQUMsQ0FBQztJQUNILENBQUM7Q0FDRCIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgQ2FudmFzLCBDYW52YXNOb2RlIH0gZnJvbSBcIi4uL3R5cGVzL2NhbnZhcy1pbnRlcm5hbFwiO1xuaW1wb3J0IHsgQ2FudmFzQVBJIH0gZnJvbSBcIi4uL2NhbnZhcy9jYW52YXMtYXBpXCI7XG5pbXBvcnQgeyBidWlsZEZvcmVzdCwgZmluZFRyZWVGb3JOb2RlLCBnZXREZXNjZW5kYW50cyB9IGZyb20gXCIuLi9taW5kbWFwL3RyZWUtbW9kZWxcIjtcblxuLyoqXG4gKiBab29tIGFuZCBmb2N1cyB1dGlsaXRpZXMgZm9yIG1pbmQgbWFwIG5hdmlnYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBOYXZpZ2F0aW9uIHtcblx0Y29uc3RydWN0b3IocHJpdmF0ZSBjYW52YXNBcGk6IENhbnZhc0FQSSkge31cblxuXHQvKipcblx0ICogWm9vbSB0byBmaXQgYW4gZW50aXJlIGJyYW5jaCAobm9kZSArIGFsbCBkZXNjZW5kYW50cykuXG5cdCAqIFRyaWdnZXJlZCBieSBDdHJsK2NsaWNrIG9uIGEgbm9kZS5cblx0ICovXG5cdHpvb21Ub0JyYW5jaChjYW52YXM6IENhbnZhcywgbm9kZTogQ2FudmFzTm9kZSk6IHZvaWQge1xuXHRcdGNvbnN0IGZvcmVzdCA9IGJ1aWxkRm9yZXN0KGNhbnZhcyk7XG5cdFx0aWYgKGZvcmVzdC5sZW5ndGggPT09IDApIHJldHVybjtcblxuXHRcdGNvbnN0IHRyZWVOb2RlID0gZmluZFRyZWVGb3JOb2RlKGZvcmVzdCwgbm9kZS5pZCk7XG5cdFx0aWYgKCF0cmVlTm9kZSkgcmV0dXJuO1xuXG5cdFx0Y29uc3QgZGVzY2VuZGFudHMgPSBnZXREZXNjZW5kYW50cyh0cmVlTm9kZSk7XG5cdFx0Y29uc3QgYWxsTm9kZXMgPSBbdHJlZU5vZGUsIC4uLmRlc2NlbmRhbnRzXTtcblx0XHRpZiAoYWxsTm9kZXMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cblx0XHQvLyBDYWxjdWxhdGUgYm91bmRpbmcgYm94XG5cdFx0bGV0IG1pblggPSBJbmZpbml0eSxcblx0XHRcdG1pblkgPSBJbmZpbml0eSxcblx0XHRcdG1heFggPSAtSW5maW5pdHksXG5cdFx0XHRtYXhZID0gLUluZmluaXR5O1xuXG5cdFx0Zm9yIChjb25zdCBuIG9mIGFsbE5vZGVzKSB7XG5cdFx0XHRjb25zdCBjbiA9IG4uY2FudmFzTm9kZTtcblx0XHRcdG1pblggPSBNYXRoLm1pbihtaW5YLCBjbi54KTtcblx0XHRcdG1pblkgPSBNYXRoLm1pbihtaW5ZLCBjbi55KTtcblx0XHRcdG1heFggPSBNYXRoLm1heChtYXhYLCBjbi54ICsgY24ud2lkdGgpO1xuXHRcdFx0bWF4WSA9IE1hdGgubWF4KG1heFksIGNuLnkgKyBjbi5oZWlnaHQpO1xuXHRcdH1cblxuXHRcdC8vIEFkZCBwYWRkaW5nXG5cdFx0Y29uc3QgcGFkID0gNTA7XG5cdFx0Y2FudmFzLnpvb21Ub0Jib3goe1xuXHRcdFx0bWluWDogbWluWCAtIHBhZCxcblx0XHRcdG1pblk6IG1pblkgLSBwYWQsXG5cdFx0XHRtYXhYOiBtYXhYICsgcGFkLFxuXHRcdFx0bWF4WTogbWF4WSArIHBhZCxcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWdpc3RlciBDdHJsK2NsaWNrIGhhbmRsZXIgZm9yIHpvb20tdG8tYnJhbmNoLlxuXHQgKi9cblx0cmVnaXN0ZXJDbGlja0hhbmRsZXIoY2FudmFzOiBDYW52YXMpOiAoKCkgPT4gdm9pZCkgfCBudWxsIHtcblx0XHRjb25zdCBoYW5kbGVyID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGlmICghZS5jdHJsS2V5ICYmICFlLm1ldGFLZXkpIHJldHVybjtcblxuXHRcdFx0Ly8gRmluZCB3aGljaCBub2RlIHdhcyBjbGlja2VkXG5cdFx0XHRjb25zdCB0YXJnZXQgPSBlLnRhcmdldCBhcyBIVE1MRWxlbWVudDtcblx0XHRcdGNvbnN0IG5vZGVFbCA9IHRhcmdldC5jbG9zZXN0KFwiLmNhbnZhcy1ub2RlXCIpIGFzIEhUTUxFbGVtZW50O1xuXHRcdFx0aWYgKCFub2RlRWwpIHJldHVybjtcblxuXHRcdFx0Ly8gRmluZCB0aGUgY2FudmFzIG5vZGUgYnkgbWF0Y2hpbmcgRE9NIGVsZW1lbnRcblx0XHRcdGZvciAoY29uc3Qgbm9kZSBvZiBjYW52YXMubm9kZXMudmFsdWVzKCkpIHtcblx0XHRcdFx0aWYgKG5vZGUubm9kZUVsID09PSBub2RlRWwpIHtcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0XHR0aGlzLnpvb21Ub0JyYW5jaChjYW52YXMsIG5vZGUpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNhbnZhcy53cmFwcGVyRWw/LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBoYW5kbGVyLCB0cnVlKTtcblxuXHRcdHJldHVybiAoKSA9PiB7XG5cdFx0XHRjYW52YXMud3JhcHBlckVsPy5yZW1vdmVFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgaGFuZGxlciwgdHJ1ZSk7XG5cdFx0fTtcblx0fVxufVxuIl19