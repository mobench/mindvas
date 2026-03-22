import { buildForest, findTreeForNode, countChildrenPerSide } from "./tree-model";
/**
 * Core mind map node operations: add child, add sibling, delete.
 */
export class NodeOperations {
    constructor(canvasApi, config) {
        this.canvasApi = canvasApi;
        this.config = config;
    }
    /**
     * Add a child node to the selected node.
     * If parent is root, places on the side with fewer children (ties go right).
     * If parent is non-root, inherits direction from its branch.
     * Returns the new node so the caller can start editing it.
     */
    addChild(canvas, parentNode) {
        const forest = buildForest(canvas);
        const parentTreeNode = findTreeForNode(forest, parentNode.id);
        const isRoot = parentTreeNode && !parentTreeNode.parent;
        // Determine direction for the new child
        let direction;
        if (isRoot && parentTreeNode) {
            const counts = countChildrenPerSide(parentTreeNode);
            direction = counts.left < counts.right ? "left" : "right";
        }
        else {
            direction = this.detectDirection(canvas, parentNode);
        }
        const existingChildren = this.canvasApi.getChildNodes(canvas, parentNode);
        // Position depends on direction
        let x;
        if (direction === "right") {
            x = parentNode.x + parentNode.width + this.config.horizontalGap;
        }
        else {
            x = parentNode.x - this.config.nodeWidth - this.config.horizontalGap;
        }
        // Position below the last same-side child, or vertically centered with parent
        let y;
        if (existingChildren.length > 0) {
            // Filter children on the same side
            const sameSideChildren = existingChildren.filter(c => {
                const childCx = c.x + c.width / 2;
                const parentCx = parentNode.x + parentNode.width / 2;
                return direction === "right" ? childCx > parentCx : childCx < parentCx;
            });
            if (sameSideChildren.length > 0) {
                const lastChild = sameSideChildren[sameSideChildren.length - 1];
                y = lastChild.y + lastChild.height + this.config.verticalGap;
            }
            else {
                y = parentNode.y + (parentNode.height - this.config.nodeHeight) / 2;
            }
        }
        else {
            y = parentNode.y + (parentNode.height - this.config.nodeHeight) / 2;
        }
        const newNode = this.canvasApi.createTextNode(canvas, x, y, "", this.config.nodeWidth, this.config.nodeHeight);
        if (parentNode.color)
            newNode.setColor(parentNode.color);
        if (direction === "right") {
            this.canvasApi.createEdge(canvas, parentNode, newNode, "right", "left", parentNode.color || undefined);
        }
        else {
            this.canvasApi.createEdge(canvas, parentNode, newNode, "left", "right", parentNode.color || undefined);
        }
        canvas.requestSave();
        return newNode;
    }
    /**
     * Add a sibling node below the selected node (same parent).
     * Inherits the branch direction from the current node.
     * Returns the new node.
     */
    addSibling(canvas, currentNode) {
        const parent = this.canvasApi.getParentNode(canvas, currentNode);
        if (!parent) {
            // Root node — can't add sibling, add child instead
            return this.addChild(canvas, currentNode);
        }
        const direction = this.detectDirection(canvas, currentNode);
        // Position below the current node, same x
        const x = currentNode.x;
        const y = currentNode.y + currentNode.height + this.config.verticalGap;
        const newNode = this.canvasApi.createTextNode(canvas, x, y, "", this.config.nodeWidth, this.config.nodeHeight);
        if (currentNode.color)
            newNode.setColor(currentNode.color);
        if (direction === "right") {
            this.canvasApi.createEdge(canvas, parent, newNode, "right", "left", currentNode.color || undefined);
        }
        else {
            this.canvasApi.createEdge(canvas, parent, newNode, "left", "right", currentNode.color || undefined);
        }
        canvas.requestSave();
        return newNode;
    }
    /**
     * Delete the current node and return cursor focus to parent.
     * Children of the deleted node get reconnected to the parent
     * with edge sides matching their branch direction.
     * Returns the parent node (for focusing).
     */
    deleteAndFocusParent(canvas, currentNode) {
        const parent = this.canvasApi.getParentNode(canvas, currentNode);
        if (!parent) {
            // Don't delete root node
            return null;
        }
        const direction = this.detectDirection(canvas, currentNode);
        // Get children of the node being deleted
        const orphans = this.canvasApi.getChildNodes(canvas, currentNode);
        // Reconnect orphaned children to the parent with correct edge sides
        for (const orphan of orphans) {
            if (direction === "right") {
                this.canvasApi.createEdge(canvas, parent, orphan, "right", "left");
            }
            else {
                this.canvasApi.createEdge(canvas, parent, orphan, "left", "right");
            }
        }
        // Remove the node (and its edges)
        this.canvasApi.removeNode(canvas, currentNode);
        canvas.requestSave();
        return parent;
    }
    /**
     * Flip a branch to the other side of its parent.
     * Mirrors the node and all descendants horizontally around the parent's center X.
     * Returns the parent node (for caller to trigger restack/layout).
     */
    flipBranch(canvas, node) {
        const parent = this.canvasApi.getParentNode(canvas, node);
        if (!parent)
            return null;
        const parentCx = parent.x + parent.width / 2;
        // Collect node + all descendants via BFS
        const allNodes = [node];
        const visited = new Set([node.id]);
        const queue = [node.id];
        while (queue.length > 0) {
            const id = queue.shift();
            for (const edge of this.canvasApi.getOutgoingEdges(canvas, id)) {
                const childId = edge.to.node.id;
                if (!visited.has(childId)) {
                    visited.add(childId);
                    allNodes.push(edge.to.node);
                    queue.push(childId);
                }
            }
        }
        // Mirror each node's X around parent's center
        for (const n of allNodes) {
            const newX = 2 * parentCx - n.x - n.width;
            n.moveTo({ x: newX, y: n.y });
        }
        return parent;
    }
    /**
     * Detect the branch direction of a node based on actual positions.
     * If node has children, uses their position. Otherwise, uses parent position.
     */
    detectDirection(canvas, node) {
        const nodeCx = node.x + node.width / 2;
        // If node has children, direction matches where they actually are
        const existingChildren = this.canvasApi.getChildNodes(canvas, node);
        if (existingChildren.length > 0) {
            const firstChildCx = existingChildren[0].x + existingChildren[0].width / 2;
            return firstChildCx < nodeCx ? "left" : "right";
        }
        // No children — determine from parent position (which side of parent am I on?)
        const parent = this.canvasApi.getParentNode(canvas, node);
        if (parent) {
            const parentCx = parent.x + parent.width / 2;
            return nodeCx < parentCx ? "left" : "right";
        }
        return "right";
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZS1vcGVyYXRpb25zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibm9kZS1vcGVyYXRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE9BQU8sRUFBRSxXQUFXLEVBQUUsZUFBZSxFQUFFLG9CQUFvQixFQUFtQixNQUFNLGNBQWMsQ0FBQztBQVNuRzs7R0FFRztBQUNILE1BQU0sT0FBTyxjQUFjO0lBQzFCLFlBQ1MsU0FBb0IsRUFDcEIsTUFBcUI7UUFEckIsY0FBUyxHQUFULFNBQVMsQ0FBVztRQUNwQixXQUFNLEdBQU4sTUFBTSxDQUFlO0lBQzNCLENBQUM7SUFFSjs7Ozs7T0FLRztJQUNILFFBQVEsQ0FBQyxNQUFjLEVBQUUsVUFBc0I7UUFDOUMsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ25DLE1BQU0sY0FBYyxHQUFHLGVBQWUsQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzlELE1BQU0sTUFBTSxHQUFHLGNBQWMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUM7UUFFeEQsd0NBQXdDO1FBQ3hDLElBQUksU0FBMEIsQ0FBQztRQUMvQixJQUFJLE1BQU0sSUFBSSxjQUFjLEVBQUUsQ0FBQztZQUM5QixNQUFNLE1BQU0sR0FBRyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUNwRCxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztRQUMzRCxDQUFDO2FBQU0sQ0FBQztZQUNQLFNBQVMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUN0RCxDQUFDO1FBRUQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFFMUUsZ0NBQWdDO1FBQ2hDLElBQUksQ0FBUyxDQUFDO1FBQ2QsSUFBSSxTQUFTLEtBQUssT0FBTyxFQUFFLENBQUM7WUFDM0IsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQztRQUNqRSxDQUFDO2FBQU0sQ0FBQztZQUNQLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDO1FBQ3RFLENBQUM7UUFFRCw4RUFBOEU7UUFDOUUsSUFBSSxDQUFTLENBQUM7UUFDZCxJQUFJLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxtQ0FBbUM7WUFDbkMsTUFBTSxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ3BELE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7Z0JBQ2xDLE1BQU0sUUFBUSxHQUFHLFVBQVUsQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7Z0JBQ3JELE9BQU8sU0FBUyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxHQUFHLFFBQVEsQ0FBQztZQUN4RSxDQUFDLENBQUMsQ0FBQztZQUNILElBQUksZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNqQyxNQUFNLFNBQVMsR0FBRyxnQkFBZ0IsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hFLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUM7WUFDOUQsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNyRSxDQUFDO1FBQ0YsQ0FBQzthQUFNLENBQUM7WUFDUCxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDckUsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUM1QyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQy9ELENBQUM7UUFFRixJQUFJLFVBQVUsQ0FBQyxLQUFLO1lBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFekQsSUFBSSxTQUFTLEtBQUssT0FBTyxFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsS0FBSyxJQUFJLFNBQVMsQ0FBQyxDQUFDO1FBQ3hHLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxVQUFVLENBQUMsS0FBSyxJQUFJLFNBQVMsQ0FBQyxDQUFDO1FBQ3hHLENBQUM7UUFFRCxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDckIsT0FBTyxPQUFPLENBQUM7SUFDaEIsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxVQUFVLENBQUMsTUFBYyxFQUFFLFdBQXVCO1FBQ2pELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQztRQUNqRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDYixtREFBbUQ7WUFDbkQsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQztRQUMzQyxDQUFDO1FBRUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFFNUQsMENBQTBDO1FBQzFDLE1BQU0sQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFDeEIsTUFBTSxDQUFDLEdBQUcsV0FBVyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDO1FBRXZFLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUM1QyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQy9ELENBQUM7UUFFRixJQUFJLFdBQVcsQ0FBQyxLQUFLO1lBQUUsT0FBTyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFM0QsSUFBSSxTQUFTLEtBQUssT0FBTyxFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxXQUFXLENBQUMsS0FBSyxJQUFJLFNBQVMsQ0FBQyxDQUFDO1FBQ3JHLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxXQUFXLENBQUMsS0FBSyxJQUFJLFNBQVMsQ0FBQyxDQUFDO1FBQ3JHLENBQUM7UUFFRCxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDckIsT0FBTyxPQUFPLENBQUM7SUFDaEIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsb0JBQW9CLENBQ25CLE1BQWMsRUFDZCxXQUF1QjtRQUV2QixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDakUsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2IseUJBQXlCO1lBQ3pCLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRTVELHlDQUF5QztRQUN6QyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFFbEUsb0VBQW9FO1FBQ3BFLEtBQUssTUFBTSxNQUFNLElBQUksT0FBTyxFQUFFLENBQUM7WUFDOUIsSUFBSSxTQUFTLEtBQUssT0FBTyxFQUFFLENBQUM7Z0JBQzNCLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztZQUNwRSxDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3BFLENBQUM7UUFDRixDQUFDO1FBRUQsa0NBQWtDO1FBQ2xDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQztRQUMvQyxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFckIsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILFVBQVUsQ0FBQyxNQUFjLEVBQUUsSUFBZ0I7UUFDMUMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyxNQUFNO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFekIsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztRQUU3Qyx5Q0FBeUM7UUFDekMsTUFBTSxRQUFRLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4QixNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzNDLE1BQU0sS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3hCLE9BQU8sS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN6QixNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFHLENBQUM7WUFDMUIsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO2dCQUNoRSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ2hDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7b0JBQzNCLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ3JCLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDNUIsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDckIsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsOENBQThDO1FBQzlDLEtBQUssTUFBTSxDQUFDLElBQUksUUFBUSxFQUFFLENBQUM7WUFDMUIsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLFFBQVEsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFDMUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFFRDs7O09BR0c7SUFDSyxlQUFlLENBQUMsTUFBYyxFQUFFLElBQWdCO1FBQ3ZELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7UUFFdkMsa0VBQWtFO1FBQ2xFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3BFLElBQUksZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ2pDLE1BQU0sWUFBWSxHQUFHLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO1lBQzNFLE9BQU8sWUFBWSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7UUFDakQsQ0FBQztRQUVELCtFQUErRTtRQUMvRSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDMUQsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNaLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7WUFDN0MsT0FBTyxNQUFNLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztRQUM3QyxDQUFDO1FBRUQsT0FBTyxPQUFPLENBQUM7SUFDaEIsQ0FBQztDQUNEIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgeyBDYW52YXMsIENhbnZhc05vZGUgfSBmcm9tIFwiLi4vdHlwZXMvY2FudmFzLWludGVybmFsXCI7XG5pbXBvcnQgeyBDYW52YXNBUEkgfSBmcm9tIFwiLi4vY2FudmFzL2NhbnZhcy1hcGlcIjtcbmltcG9ydCB7IGJ1aWxkRm9yZXN0LCBmaW5kVHJlZUZvck5vZGUsIGNvdW50Q2hpbGRyZW5QZXJTaWRlLCBCcmFuY2hEaXJlY3Rpb24gfSBmcm9tIFwiLi90cmVlLW1vZGVsXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm9kZU9wc0NvbmZpZyB7XG5cdG5vZGVXaWR0aDogbnVtYmVyO1xuXHRub2RlSGVpZ2h0OiBudW1iZXI7XG5cdGhvcml6b250YWxHYXA6IG51bWJlcjtcblx0dmVydGljYWxHYXA6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBDb3JlIG1pbmQgbWFwIG5vZGUgb3BlcmF0aW9uczogYWRkIGNoaWxkLCBhZGQgc2libGluZywgZGVsZXRlLlxuICovXG5leHBvcnQgY2xhc3MgTm9kZU9wZXJhdGlvbnMge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIGNhbnZhc0FwaTogQ2FudmFzQVBJLFxuXHRcdHByaXZhdGUgY29uZmlnOiBOb2RlT3BzQ29uZmlnXG5cdCkge31cblxuXHQvKipcblx0ICogQWRkIGEgY2hpbGQgbm9kZSB0byB0aGUgc2VsZWN0ZWQgbm9kZS5cblx0ICogSWYgcGFyZW50IGlzIHJvb3QsIHBsYWNlcyBvbiB0aGUgc2lkZSB3aXRoIGZld2VyIGNoaWxkcmVuICh0aWVzIGdvIHJpZ2h0KS5cblx0ICogSWYgcGFyZW50IGlzIG5vbi1yb290LCBpbmhlcml0cyBkaXJlY3Rpb24gZnJvbSBpdHMgYnJhbmNoLlxuXHQgKiBSZXR1cm5zIHRoZSBuZXcgbm9kZSBzbyB0aGUgY2FsbGVyIGNhbiBzdGFydCBlZGl0aW5nIGl0LlxuXHQgKi9cblx0YWRkQ2hpbGQoY2FudmFzOiBDYW52YXMsIHBhcmVudE5vZGU6IENhbnZhc05vZGUpOiBDYW52YXNOb2RlIHwgbnVsbCB7XG5cdFx0Y29uc3QgZm9yZXN0ID0gYnVpbGRGb3Jlc3QoY2FudmFzKTtcblx0XHRjb25zdCBwYXJlbnRUcmVlTm9kZSA9IGZpbmRUcmVlRm9yTm9kZShmb3Jlc3QsIHBhcmVudE5vZGUuaWQpO1xuXHRcdGNvbnN0IGlzUm9vdCA9IHBhcmVudFRyZWVOb2RlICYmICFwYXJlbnRUcmVlTm9kZS5wYXJlbnQ7XG5cblx0XHQvLyBEZXRlcm1pbmUgZGlyZWN0aW9uIGZvciB0aGUgbmV3IGNoaWxkXG5cdFx0bGV0IGRpcmVjdGlvbjogQnJhbmNoRGlyZWN0aW9uO1xuXHRcdGlmIChpc1Jvb3QgJiYgcGFyZW50VHJlZU5vZGUpIHtcblx0XHRcdGNvbnN0IGNvdW50cyA9IGNvdW50Q2hpbGRyZW5QZXJTaWRlKHBhcmVudFRyZWVOb2RlKTtcblx0XHRcdGRpcmVjdGlvbiA9IGNvdW50cy5sZWZ0IDwgY291bnRzLnJpZ2h0ID8gXCJsZWZ0XCIgOiBcInJpZ2h0XCI7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRpcmVjdGlvbiA9IHRoaXMuZGV0ZWN0RGlyZWN0aW9uKGNhbnZhcywgcGFyZW50Tm9kZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXhpc3RpbmdDaGlsZHJlbiA9IHRoaXMuY2FudmFzQXBpLmdldENoaWxkTm9kZXMoY2FudmFzLCBwYXJlbnROb2RlKTtcblxuXHRcdC8vIFBvc2l0aW9uIGRlcGVuZHMgb24gZGlyZWN0aW9uXG5cdFx0bGV0IHg6IG51bWJlcjtcblx0XHRpZiAoZGlyZWN0aW9uID09PSBcInJpZ2h0XCIpIHtcblx0XHRcdHggPSBwYXJlbnROb2RlLnggKyBwYXJlbnROb2RlLndpZHRoICsgdGhpcy5jb25maWcuaG9yaXpvbnRhbEdhcDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0eCA9IHBhcmVudE5vZGUueCAtIHRoaXMuY29uZmlnLm5vZGVXaWR0aCAtIHRoaXMuY29uZmlnLmhvcml6b250YWxHYXA7XG5cdFx0fVxuXG5cdFx0Ly8gUG9zaXRpb24gYmVsb3cgdGhlIGxhc3Qgc2FtZS1zaWRlIGNoaWxkLCBvciB2ZXJ0aWNhbGx5IGNlbnRlcmVkIHdpdGggcGFyZW50XG5cdFx0bGV0IHk6IG51bWJlcjtcblx0XHRpZiAoZXhpc3RpbmdDaGlsZHJlbi5sZW5ndGggPiAwKSB7XG5cdFx0XHQvLyBGaWx0ZXIgY2hpbGRyZW4gb24gdGhlIHNhbWUgc2lkZVxuXHRcdFx0Y29uc3Qgc2FtZVNpZGVDaGlsZHJlbiA9IGV4aXN0aW5nQ2hpbGRyZW4uZmlsdGVyKGMgPT4ge1xuXHRcdFx0XHRjb25zdCBjaGlsZEN4ID0gYy54ICsgYy53aWR0aCAvIDI7XG5cdFx0XHRcdGNvbnN0IHBhcmVudEN4ID0gcGFyZW50Tm9kZS54ICsgcGFyZW50Tm9kZS53aWR0aCAvIDI7XG5cdFx0XHRcdHJldHVybiBkaXJlY3Rpb24gPT09IFwicmlnaHRcIiA/IGNoaWxkQ3ggPiBwYXJlbnRDeCA6IGNoaWxkQ3ggPCBwYXJlbnRDeDtcblx0XHRcdH0pO1xuXHRcdFx0aWYgKHNhbWVTaWRlQ2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjb25zdCBsYXN0Q2hpbGQgPSBzYW1lU2lkZUNoaWxkcmVuW3NhbWVTaWRlQ2hpbGRyZW4ubGVuZ3RoIC0gMV07XG5cdFx0XHRcdHkgPSBsYXN0Q2hpbGQueSArIGxhc3RDaGlsZC5oZWlnaHQgKyB0aGlzLmNvbmZpZy52ZXJ0aWNhbEdhcDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHkgPSBwYXJlbnROb2RlLnkgKyAocGFyZW50Tm9kZS5oZWlnaHQgLSB0aGlzLmNvbmZpZy5ub2RlSGVpZ2h0KSAvIDI7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHkgPSBwYXJlbnROb2RlLnkgKyAocGFyZW50Tm9kZS5oZWlnaHQgLSB0aGlzLmNvbmZpZy5ub2RlSGVpZ2h0KSAvIDI7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3Tm9kZSA9IHRoaXMuY2FudmFzQXBpLmNyZWF0ZVRleHROb2RlKFxuXHRcdFx0Y2FudmFzLCB4LCB5LCBcIlwiLCB0aGlzLmNvbmZpZy5ub2RlV2lkdGgsIHRoaXMuY29uZmlnLm5vZGVIZWlnaHRcblx0XHQpO1xuXG5cdFx0aWYgKHBhcmVudE5vZGUuY29sb3IpIG5ld05vZGUuc2V0Q29sb3IocGFyZW50Tm9kZS5jb2xvcik7XG5cblx0XHRpZiAoZGlyZWN0aW9uID09PSBcInJpZ2h0XCIpIHtcblx0XHRcdHRoaXMuY2FudmFzQXBpLmNyZWF0ZUVkZ2UoY2FudmFzLCBwYXJlbnROb2RlLCBuZXdOb2RlLCBcInJpZ2h0XCIsIFwibGVmdFwiLCBwYXJlbnROb2RlLmNvbG9yIHx8IHVuZGVmaW5lZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY2FudmFzQXBpLmNyZWF0ZUVkZ2UoY2FudmFzLCBwYXJlbnROb2RlLCBuZXdOb2RlLCBcImxlZnRcIiwgXCJyaWdodFwiLCBwYXJlbnROb2RlLmNvbG9yIHx8IHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0Y2FudmFzLnJlcXVlc3RTYXZlKCk7XG5cdFx0cmV0dXJuIG5ld05vZGU7XG5cdH1cblxuXHQvKipcblx0ICogQWRkIGEgc2libGluZyBub2RlIGJlbG93IHRoZSBzZWxlY3RlZCBub2RlIChzYW1lIHBhcmVudCkuXG5cdCAqIEluaGVyaXRzIHRoZSBicmFuY2ggZGlyZWN0aW9uIGZyb20gdGhlIGN1cnJlbnQgbm9kZS5cblx0ICogUmV0dXJucyB0aGUgbmV3IG5vZGUuXG5cdCAqL1xuXHRhZGRTaWJsaW5nKGNhbnZhczogQ2FudmFzLCBjdXJyZW50Tm9kZTogQ2FudmFzTm9kZSk6IENhbnZhc05vZGUgfCBudWxsIHtcblx0XHRjb25zdCBwYXJlbnQgPSB0aGlzLmNhbnZhc0FwaS5nZXRQYXJlbnROb2RlKGNhbnZhcywgY3VycmVudE5vZGUpO1xuXHRcdGlmICghcGFyZW50KSB7XG5cdFx0XHQvLyBSb290IG5vZGUg4oCUIGNhbid0IGFkZCBzaWJsaW5nLCBhZGQgY2hpbGQgaW5zdGVhZFxuXHRcdFx0cmV0dXJuIHRoaXMuYWRkQ2hpbGQoY2FudmFzLCBjdXJyZW50Tm9kZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlyZWN0aW9uID0gdGhpcy5kZXRlY3REaXJlY3Rpb24oY2FudmFzLCBjdXJyZW50Tm9kZSk7XG5cblx0XHQvLyBQb3NpdGlvbiBiZWxvdyB0aGUgY3VycmVudCBub2RlLCBzYW1lIHhcblx0XHRjb25zdCB4ID0gY3VycmVudE5vZGUueDtcblx0XHRjb25zdCB5ID0gY3VycmVudE5vZGUueSArIGN1cnJlbnROb2RlLmhlaWdodCArIHRoaXMuY29uZmlnLnZlcnRpY2FsR2FwO1xuXG5cdFx0Y29uc3QgbmV3Tm9kZSA9IHRoaXMuY2FudmFzQXBpLmNyZWF0ZVRleHROb2RlKFxuXHRcdFx0Y2FudmFzLCB4LCB5LCBcIlwiLCB0aGlzLmNvbmZpZy5ub2RlV2lkdGgsIHRoaXMuY29uZmlnLm5vZGVIZWlnaHRcblx0XHQpO1xuXG5cdFx0aWYgKGN1cnJlbnROb2RlLmNvbG9yKSBuZXdOb2RlLnNldENvbG9yKGN1cnJlbnROb2RlLmNvbG9yKTtcblxuXHRcdGlmIChkaXJlY3Rpb24gPT09IFwicmlnaHRcIikge1xuXHRcdFx0dGhpcy5jYW52YXNBcGkuY3JlYXRlRWRnZShjYW52YXMsIHBhcmVudCwgbmV3Tm9kZSwgXCJyaWdodFwiLCBcImxlZnRcIiwgY3VycmVudE5vZGUuY29sb3IgfHwgdW5kZWZpbmVkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5jYW52YXNBcGkuY3JlYXRlRWRnZShjYW52YXMsIHBhcmVudCwgbmV3Tm9kZSwgXCJsZWZ0XCIsIFwicmlnaHRcIiwgY3VycmVudE5vZGUuY29sb3IgfHwgdW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHRjYW52YXMucmVxdWVzdFNhdmUoKTtcblx0XHRyZXR1cm4gbmV3Tm9kZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZWxldGUgdGhlIGN1cnJlbnQgbm9kZSBhbmQgcmV0dXJuIGN1cnNvciBmb2N1cyB0byBwYXJlbnQuXG5cdCAqIENoaWxkcmVuIG9mIHRoZSBkZWxldGVkIG5vZGUgZ2V0IHJlY29ubmVjdGVkIHRvIHRoZSBwYXJlbnRcblx0ICogd2l0aCBlZGdlIHNpZGVzIG1hdGNoaW5nIHRoZWlyIGJyYW5jaCBkaXJlY3Rpb24uXG5cdCAqIFJldHVybnMgdGhlIHBhcmVudCBub2RlIChmb3IgZm9jdXNpbmcpLlxuXHQgKi9cblx0ZGVsZXRlQW5kRm9jdXNQYXJlbnQoXG5cdFx0Y2FudmFzOiBDYW52YXMsXG5cdFx0Y3VycmVudE5vZGU6IENhbnZhc05vZGVcblx0KTogQ2FudmFzTm9kZSB8IG51bGwge1xuXHRcdGNvbnN0IHBhcmVudCA9IHRoaXMuY2FudmFzQXBpLmdldFBhcmVudE5vZGUoY2FudmFzLCBjdXJyZW50Tm9kZSk7XG5cdFx0aWYgKCFwYXJlbnQpIHtcblx0XHRcdC8vIERvbid0IGRlbGV0ZSByb290IG5vZGVcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpcmVjdGlvbiA9IHRoaXMuZGV0ZWN0RGlyZWN0aW9uKGNhbnZhcywgY3VycmVudE5vZGUpO1xuXG5cdFx0Ly8gR2V0IGNoaWxkcmVuIG9mIHRoZSBub2RlIGJlaW5nIGRlbGV0ZWRcblx0XHRjb25zdCBvcnBoYW5zID0gdGhpcy5jYW52YXNBcGkuZ2V0Q2hpbGROb2RlcyhjYW52YXMsIGN1cnJlbnROb2RlKTtcblxuXHRcdC8vIFJlY29ubmVjdCBvcnBoYW5lZCBjaGlsZHJlbiB0byB0aGUgcGFyZW50IHdpdGggY29ycmVjdCBlZGdlIHNpZGVzXG5cdFx0Zm9yIChjb25zdCBvcnBoYW4gb2Ygb3JwaGFucykge1xuXHRcdFx0aWYgKGRpcmVjdGlvbiA9PT0gXCJyaWdodFwiKSB7XG5cdFx0XHRcdHRoaXMuY2FudmFzQXBpLmNyZWF0ZUVkZ2UoY2FudmFzLCBwYXJlbnQsIG9ycGhhbiwgXCJyaWdodFwiLCBcImxlZnRcIik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmNhbnZhc0FwaS5jcmVhdGVFZGdlKGNhbnZhcywgcGFyZW50LCBvcnBoYW4sIFwibGVmdFwiLCBcInJpZ2h0XCIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFJlbW92ZSB0aGUgbm9kZSAoYW5kIGl0cyBlZGdlcylcblx0XHR0aGlzLmNhbnZhc0FwaS5yZW1vdmVOb2RlKGNhbnZhcywgY3VycmVudE5vZGUpO1xuXHRcdGNhbnZhcy5yZXF1ZXN0U2F2ZSgpO1xuXG5cdFx0cmV0dXJuIHBhcmVudDtcblx0fVxuXG5cdC8qKlxuXHQgKiBGbGlwIGEgYnJhbmNoIHRvIHRoZSBvdGhlciBzaWRlIG9mIGl0cyBwYXJlbnQuXG5cdCAqIE1pcnJvcnMgdGhlIG5vZGUgYW5kIGFsbCBkZXNjZW5kYW50cyBob3Jpem9udGFsbHkgYXJvdW5kIHRoZSBwYXJlbnQncyBjZW50ZXIgWC5cblx0ICogUmV0dXJucyB0aGUgcGFyZW50IG5vZGUgKGZvciBjYWxsZXIgdG8gdHJpZ2dlciByZXN0YWNrL2xheW91dCkuXG5cdCAqL1xuXHRmbGlwQnJhbmNoKGNhbnZhczogQ2FudmFzLCBub2RlOiBDYW52YXNOb2RlKTogQ2FudmFzTm9kZSB8IG51bGwge1xuXHRcdGNvbnN0IHBhcmVudCA9IHRoaXMuY2FudmFzQXBpLmdldFBhcmVudE5vZGUoY2FudmFzLCBub2RlKTtcblx0XHRpZiAoIXBhcmVudCkgcmV0dXJuIG51bGw7XG5cblx0XHRjb25zdCBwYXJlbnRDeCA9IHBhcmVudC54ICsgcGFyZW50LndpZHRoIC8gMjtcblxuXHRcdC8vIENvbGxlY3Qgbm9kZSArIGFsbCBkZXNjZW5kYW50cyB2aWEgQkZTXG5cdFx0Y29uc3QgYWxsTm9kZXMgPSBbbm9kZV07XG5cdFx0Y29uc3QgdmlzaXRlZCA9IG5ldyBTZXQ8c3RyaW5nPihbbm9kZS5pZF0pO1xuXHRcdGNvbnN0IHF1ZXVlID0gW25vZGUuaWRdO1xuXHRcdHdoaWxlIChxdWV1ZS5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBpZCA9IHF1ZXVlLnNoaWZ0KCkhO1xuXHRcdFx0Zm9yIChjb25zdCBlZGdlIG9mIHRoaXMuY2FudmFzQXBpLmdldE91dGdvaW5nRWRnZXMoY2FudmFzLCBpZCkpIHtcblx0XHRcdFx0Y29uc3QgY2hpbGRJZCA9IGVkZ2UudG8ubm9kZS5pZDtcblx0XHRcdFx0aWYgKCF2aXNpdGVkLmhhcyhjaGlsZElkKSkge1xuXHRcdFx0XHRcdHZpc2l0ZWQuYWRkKGNoaWxkSWQpO1xuXHRcdFx0XHRcdGFsbE5vZGVzLnB1c2goZWRnZS50by5ub2RlKTtcblx0XHRcdFx0XHRxdWV1ZS5wdXNoKGNoaWxkSWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gTWlycm9yIGVhY2ggbm9kZSdzIFggYXJvdW5kIHBhcmVudCdzIGNlbnRlclxuXHRcdGZvciAoY29uc3QgbiBvZiBhbGxOb2Rlcykge1xuXHRcdFx0Y29uc3QgbmV3WCA9IDIgKiBwYXJlbnRDeCAtIG4ueCAtIG4ud2lkdGg7XG5cdFx0XHRuLm1vdmVUbyh7IHg6IG5ld1gsIHk6IG4ueSB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcGFyZW50O1xuXHR9XG5cblx0LyoqXG5cdCAqIERldGVjdCB0aGUgYnJhbmNoIGRpcmVjdGlvbiBvZiBhIG5vZGUgYmFzZWQgb24gYWN0dWFsIHBvc2l0aW9ucy5cblx0ICogSWYgbm9kZSBoYXMgY2hpbGRyZW4sIHVzZXMgdGhlaXIgcG9zaXRpb24uIE90aGVyd2lzZSwgdXNlcyBwYXJlbnQgcG9zaXRpb24uXG5cdCAqL1xuXHRwcml2YXRlIGRldGVjdERpcmVjdGlvbihjYW52YXM6IENhbnZhcywgbm9kZTogQ2FudmFzTm9kZSk6IEJyYW5jaERpcmVjdGlvbiB7XG5cdFx0Y29uc3Qgbm9kZUN4ID0gbm9kZS54ICsgbm9kZS53aWR0aCAvIDI7XG5cblx0XHQvLyBJZiBub2RlIGhhcyBjaGlsZHJlbiwgZGlyZWN0aW9uIG1hdGNoZXMgd2hlcmUgdGhleSBhY3R1YWxseSBhcmVcblx0XHRjb25zdCBleGlzdGluZ0NoaWxkcmVuID0gdGhpcy5jYW52YXNBcGkuZ2V0Q2hpbGROb2RlcyhjYW52YXMsIG5vZGUpO1xuXHRcdGlmIChleGlzdGluZ0NoaWxkcmVuLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IGZpcnN0Q2hpbGRDeCA9IGV4aXN0aW5nQ2hpbGRyZW5bMF0ueCArIGV4aXN0aW5nQ2hpbGRyZW5bMF0ud2lkdGggLyAyO1xuXHRcdFx0cmV0dXJuIGZpcnN0Q2hpbGRDeCA8IG5vZGVDeCA/IFwibGVmdFwiIDogXCJyaWdodFwiO1xuXHRcdH1cblxuXHRcdC8vIE5vIGNoaWxkcmVuIOKAlCBkZXRlcm1pbmUgZnJvbSBwYXJlbnQgcG9zaXRpb24gKHdoaWNoIHNpZGUgb2YgcGFyZW50IGFtIEkgb24/KVxuXHRcdGNvbnN0IHBhcmVudCA9IHRoaXMuY2FudmFzQXBpLmdldFBhcmVudE5vZGUoY2FudmFzLCBub2RlKTtcblx0XHRpZiAocGFyZW50KSB7XG5cdFx0XHRjb25zdCBwYXJlbnRDeCA9IHBhcmVudC54ICsgcGFyZW50LndpZHRoIC8gMjtcblx0XHRcdHJldHVybiBub2RlQ3ggPCBwYXJlbnRDeCA/IFwibGVmdFwiIDogXCJyaWdodFwiO1xuXHRcdH1cblxuXHRcdHJldHVybiBcInJpZ2h0XCI7XG5cdH1cbn1cbiJdfQ==