import { buildForest } from "./tree-model";
/**
 * Default color palette for top-level branches.
 * Uses Obsidian's canvas color system (string numbers "1"-"6" map to CSS vars).
 */
const DEFAULT_PALETTE = ["1", "2", "3", "4", "5", "6"];
/**
 * Assigns distinct colors to top-level branches and cascades to descendants.
 */
export class BranchColors {
    constructor(canvasApi, palette) {
        this.canvasApi = canvasApi;
        this.palette = palette !== null && palette !== void 0 ? palette : DEFAULT_PALETTE;
    }
    /**
     * Apply auto-coloring to all branches.
     */
    applyColors(canvas) {
        const forest = buildForest(canvas);
        if (forest.length === 0)
            return;
        // Each tree's top-level branches get distinct colors
        for (const root of forest) {
            root.children.forEach((child, index) => {
                const color = this.palette[index % this.palette.length];
                this.colorBranch(canvas, child, color);
            });
        }
        canvas.requestSave();
        canvas.requestFrame();
    }
    /**
     * Color a single branch (node + all descendants + edges).
     */
    colorBranch(canvas, node, color) {
        // Color the node itself
        node.canvasNode.setColor(color);
        // Color the edge connecting to this node from its parent
        const incomingEdge = this.findIncomingEdge(canvas, node.canvasNode);
        if (incomingEdge) {
            incomingEdge.setColor(color);
        }
        // Recurse into all descendants
        for (const child of node.children) {
            this.colorBranch(canvas, child, color);
        }
    }
    /**
     * Find the edge pointing TO this node.
     */
    findIncomingEdge(canvas, node) {
        var _a;
        const edges = this.canvasApi.getConnectedEdges(canvas, node);
        return (_a = edges.find(e => e.to.node.id === node.id)) !== null && _a !== void 0 ? _a : null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJhbmNoLWNvbG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJyYW5jaC1jb2xvcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFFLFdBQVcsRUFBNEIsTUFBTSxjQUFjLENBQUM7QUFFckU7OztHQUdHO0FBQ0gsTUFBTSxlQUFlLEdBQWEsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRWpFOztHQUVHO0FBQ0gsTUFBTSxPQUFPLFlBQVk7SUFHeEIsWUFDUyxTQUFvQixFQUM1QixPQUFrQjtRQURWLGNBQVMsR0FBVCxTQUFTLENBQVc7UUFHNUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLGFBQVAsT0FBTyxjQUFQLE9BQU8sR0FBSSxlQUFlLENBQUM7SUFDM0MsQ0FBQztJQUVEOztPQUVHO0lBQ0gsV0FBVyxDQUFDLE1BQWM7UUFDekIsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ25DLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDO1lBQUUsT0FBTztRQUVoQyxxREFBcUQ7UUFDckQsS0FBSyxNQUFNLElBQUksSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUMzQixJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRTtnQkFDdEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDeEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3hDLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQztRQUVELE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNyQixNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDdkIsQ0FBQztJQUVEOztPQUVHO0lBQ0ssV0FBVyxDQUFDLE1BQWMsRUFBRSxJQUFjLEVBQUUsS0FBYTtRQUNoRSx3QkFBd0I7UUFDeEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFaEMseURBQXlEO1FBQ3pELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3BFLElBQUksWUFBWSxFQUFFLENBQUM7WUFDbEIsWUFBWSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM5QixDQUFDO1FBRUQsK0JBQStCO1FBQy9CLEtBQUssTUFBTSxLQUFLLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ25DLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN4QyxDQUFDO0lBQ0YsQ0FBQztJQUVEOztPQUVHO0lBQ0ssZ0JBQWdCLENBQ3ZCLE1BQWMsRUFDZCxJQUFnQjs7UUFFaEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDN0QsT0FBTyxNQUFBLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDLEVBQUUsQ0FBQyxtQ0FBSSxJQUFJLENBQUM7SUFDMUQsQ0FBQztDQUVEIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgeyBDYW52YXMsIENhbnZhc05vZGUsIENhbnZhc0VkZ2UgfSBmcm9tIFwiLi4vdHlwZXMvY2FudmFzLWludGVybmFsXCI7XG5pbXBvcnQgeyBDYW52YXNBUEkgfSBmcm9tIFwiLi4vY2FudmFzL2NhbnZhcy1hcGlcIjtcbmltcG9ydCB7IGJ1aWxkRm9yZXN0LCBUcmVlTm9kZSwgZ2V0RGVzY2VuZGFudHMgfSBmcm9tIFwiLi90cmVlLW1vZGVsXCI7XG5cbi8qKlxuICogRGVmYXVsdCBjb2xvciBwYWxldHRlIGZvciB0b3AtbGV2ZWwgYnJhbmNoZXMuXG4gKiBVc2VzIE9ic2lkaWFuJ3MgY2FudmFzIGNvbG9yIHN5c3RlbSAoc3RyaW5nIG51bWJlcnMgXCIxXCItXCI2XCIgbWFwIHRvIENTUyB2YXJzKS5cbiAqL1xuY29uc3QgREVGQVVMVF9QQUxFVFRFOiBzdHJpbmdbXSA9IFtcIjFcIiwgXCIyXCIsIFwiM1wiLCBcIjRcIiwgXCI1XCIsIFwiNlwiXTtcblxuLyoqXG4gKiBBc3NpZ25zIGRpc3RpbmN0IGNvbG9ycyB0byB0b3AtbGV2ZWwgYnJhbmNoZXMgYW5kIGNhc2NhZGVzIHRvIGRlc2NlbmRhbnRzLlxuICovXG5leHBvcnQgY2xhc3MgQnJhbmNoQ29sb3JzIHtcblx0cHJpdmF0ZSBwYWxldHRlOiBzdHJpbmdbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIGNhbnZhc0FwaTogQ2FudmFzQVBJLFxuXHRcdHBhbGV0dGU/OiBzdHJpbmdbXVxuXHQpIHtcblx0XHR0aGlzLnBhbGV0dGUgPSBwYWxldHRlID8/IERFRkFVTFRfUEFMRVRURTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBcHBseSBhdXRvLWNvbG9yaW5nIHRvIGFsbCBicmFuY2hlcy5cblx0ICovXG5cdGFwcGx5Q29sb3JzKGNhbnZhczogQ2FudmFzKTogdm9pZCB7XG5cdFx0Y29uc3QgZm9yZXN0ID0gYnVpbGRGb3Jlc3QoY2FudmFzKTtcblx0XHRpZiAoZm9yZXN0Lmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG5cdFx0Ly8gRWFjaCB0cmVlJ3MgdG9wLWxldmVsIGJyYW5jaGVzIGdldCBkaXN0aW5jdCBjb2xvcnNcblx0XHRmb3IgKGNvbnN0IHJvb3Qgb2YgZm9yZXN0KSB7XG5cdFx0XHRyb290LmNoaWxkcmVuLmZvckVhY2goKGNoaWxkLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRjb25zdCBjb2xvciA9IHRoaXMucGFsZXR0ZVtpbmRleCAlIHRoaXMucGFsZXR0ZS5sZW5ndGhdO1xuXHRcdFx0XHR0aGlzLmNvbG9yQnJhbmNoKGNhbnZhcywgY2hpbGQsIGNvbG9yKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNhbnZhcy5yZXF1ZXN0U2F2ZSgpO1xuXHRcdGNhbnZhcy5yZXF1ZXN0RnJhbWUoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb2xvciBhIHNpbmdsZSBicmFuY2ggKG5vZGUgKyBhbGwgZGVzY2VuZGFudHMgKyBlZGdlcykuXG5cdCAqL1xuXHRwcml2YXRlIGNvbG9yQnJhbmNoKGNhbnZhczogQ2FudmFzLCBub2RlOiBUcmVlTm9kZSwgY29sb3I6IHN0cmluZyk6IHZvaWQge1xuXHRcdC8vIENvbG9yIHRoZSBub2RlIGl0c2VsZlxuXHRcdG5vZGUuY2FudmFzTm9kZS5zZXRDb2xvcihjb2xvcik7XG5cblx0XHQvLyBDb2xvciB0aGUgZWRnZSBjb25uZWN0aW5nIHRvIHRoaXMgbm9kZSBmcm9tIGl0cyBwYXJlbnRcblx0XHRjb25zdCBpbmNvbWluZ0VkZ2UgPSB0aGlzLmZpbmRJbmNvbWluZ0VkZ2UoY2FudmFzLCBub2RlLmNhbnZhc05vZGUpO1xuXHRcdGlmIChpbmNvbWluZ0VkZ2UpIHtcblx0XHRcdGluY29taW5nRWRnZS5zZXRDb2xvcihjb2xvcik7XG5cdFx0fVxuXG5cdFx0Ly8gUmVjdXJzZSBpbnRvIGFsbCBkZXNjZW5kYW50c1xuXHRcdGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuXHRcdFx0dGhpcy5jb2xvckJyYW5jaChjYW52YXMsIGNoaWxkLCBjb2xvcik7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEZpbmQgdGhlIGVkZ2UgcG9pbnRpbmcgVE8gdGhpcyBub2RlLlxuXHQgKi9cblx0cHJpdmF0ZSBmaW5kSW5jb21pbmdFZGdlKFxuXHRcdGNhbnZhczogQ2FudmFzLFxuXHRcdG5vZGU6IENhbnZhc05vZGVcblx0KTogQ2FudmFzRWRnZSB8IG51bGwge1xuXHRcdGNvbnN0IGVkZ2VzID0gdGhpcy5jYW52YXNBcGkuZ2V0Q29ubmVjdGVkRWRnZXMoY2FudmFzLCBub2RlKTtcblx0XHRyZXR1cm4gZWRnZXMuZmluZChlID0+IGUudG8ubm9kZS5pZCA9PT0gbm9kZS5pZCkgPz8gbnVsbDtcblx0fVxuXG59XG4iXX0=