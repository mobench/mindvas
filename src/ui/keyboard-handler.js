import { Platform } from "obsidian";
import { buildForest, findTreeForNode, getNextSibling, getPrevSibling, } from "../mindmap/tree-model";
/**
 * Registers all mind map keyboard shortcuts on the canvas.
 */
export class KeyboardHandler {
    constructor(plugin, canvasApi, nodeOps, layoutEngine, branchColors, autoColorEnabled, isMindmapEnabled = () => true, onNodesChanged = () => { }) {
        this.plugin = plugin;
        this.canvasApi = canvasApi;
        this.nodeOps = nodeOps;
        this.layoutEngine = layoutEngine;
        this.branchColors = branchColors;
        this.autoColorEnabled = autoColorEnabled;
        this.isMindmapEnabled = isMindmapEnabled;
        this.onNodesChanged = onNodesChanged;
        /** Called before actions that leave the current node, to finalize auto-resize. */
        this.onBeforeLeaveNode = null;
        /** Padding (px) added around target node when zooming after navigation. */
        this.zoomPadding = 0;
    }
    register() {
        // Enter → Edit selected node (cursor at end)
        this.plugin.addCommand({
            id: "mindmap-edit-node",
            name: "Edit selected node",
            checkCallback: (checking) => {
                const canvas = this.canvasApi.getActiveCanvas();
                if (!canvas)
                    return false;
                const node = this.canvasApi.getSelectedNode(canvas);
                if (!node)
                    return false;
                if (node.isEditing)
                    return false;
                if (checking)
                    return true;
                node.startEditing();
            },
        });
        // Ctrl+> → Create child node
        this.plugin.addCommand({
            id: "mindmap-add-child",
            name: "Add child node",
            checkCallback: (checking) => {
                var _a;
                const canvas = this.canvasApi.getActiveCanvas();
                if (!canvas)
                    return false;
                const node = this.canvasApi.getSelectedNode(canvas);
                if (!node)
                    return false;
                if (checking)
                    return true;
                let selectedText = null;
                if (node.isEditing) {
                    selectedText = this.extractAndDeleteSelection(node);
                }
                (_a = this.onBeforeLeaveNode) === null || _a === void 0 ? void 0 : _a.call(this);
                const newNode = this.nodeOps.addChild(canvas, node);
                if (newNode) {
                    if (selectedText)
                        newNode.setText(selectedText);
                    this.layoutEngine.layoutChildren(canvas, node.id);
                    if (this.autoColorEnabled() && this.isMindmapEnabled(canvas)) {
                        this.branchColors.applyColors(canvas);
                    }
                    this.onNodesChanged(canvas);
                    this.canvasApi.selectAndEdit(canvas, newNode, this.zoomPadding);
                }
            },
        });
        // Shift+Enter → Create sibling node
        this.plugin.addCommand({
            id: "mindmap-add-sibling",
            name: "Add sibling node",
            checkCallback: (checking) => {
                var _a;
                const canvas = this.canvasApi.getActiveCanvas();
                if (!canvas)
                    return false;
                const node = this.canvasApi.getSelectedNode(canvas);
                if (!node)
                    return false;
                if (checking)
                    return true;
                let selectedText = null;
                if (node.isEditing) {
                    selectedText = this.extractAndDeleteSelection(node);
                }
                (_a = this.onBeforeLeaveNode) === null || _a === void 0 ? void 0 : _a.call(this);
                const newNode = this.nodeOps.addSibling(canvas, node);
                if (newNode) {
                    if (selectedText)
                        newNode.setText(selectedText);
                    const parent = this.canvasApi.getParentNode(canvas, node);
                    if (parent) {
                        this.layoutEngine.layoutChildren(canvas, parent.id);
                    }
                    if (this.autoColorEnabled() && this.isMindmapEnabled(canvas)) {
                        this.branchColors.applyColors(canvas);
                    }
                    this.onNodesChanged(canvas);
                    this.canvasApi.selectAndEdit(canvas, newNode, this.zoomPadding);
                }
            },
        });
        // Ctrl+Shift+Enter → Delete node, focus parent
        this.plugin.addCommand({
            id: "mindmap-delete-node",
            name: "Delete node and focus parent",
            checkCallback: (checking) => {
                var _a;
                const canvas = this.canvasApi.getActiveCanvas();
                if (!canvas)
                    return false;
                const node = this.canvasApi.getSelectedNode(canvas);
                if (!node)
                    return false;
                if (checking)
                    return true;
                (_a = this.onBeforeLeaveNode) === null || _a === void 0 ? void 0 : _a.call(this);
                const parent = this.nodeOps.deleteAndFocusParent(canvas, node);
                if (parent) {
                    this.layoutEngine.layoutChildren(canvas, parent.id);
                    if (this.autoColorEnabled() && this.isMindmapEnabled(canvas)) {
                        this.branchColors.applyColors(canvas);
                    }
                    this.onNodesChanged(canvas);
                    this.canvasApi.selectAndEdit(canvas, parent, this.zoomPadding);
                }
            },
        });
        // Ctrl+Shift+S → Swap/flip branch to other side
        this.plugin.addCommand({
            id: "mindmap-flip-branch",
            name: "Flip branch to other side",
            checkCallback: (checking) => {
                var _a;
                const canvas = this.canvasApi.getActiveCanvas();
                if (!canvas)
                    return false;
                if (!this.isMindmapEnabled(canvas))
                    return false;
                const node = this.canvasApi.getSelectedNode(canvas);
                if (!node)
                    return false;
                const parent = this.canvasApi.getParentNode(canvas, node);
                if (!parent)
                    return false;
                if (checking)
                    return true;
                const wasEditing = node.isEditing;
                if (!wasEditing)
                    (_a = this.onBeforeLeaveNode) === null || _a === void 0 ? void 0 : _a.call(this);
                const parentNode = this.nodeOps.flipBranch(canvas, node);
                if (parentNode) {
                    this.layoutEngine.restackSiblings(canvas, parentNode.id);
                    if (this.autoColorEnabled()) {
                        this.branchColors.applyColors(canvas);
                    }
                    this.onNodesChanged(canvas);
                    if (wasEditing)
                        node.startEditing();
                }
            },
        });
        // Ctrl+Shift+D → Toggle balanced layout (distribute children on both sides)
        this.plugin.addCommand({
            id: "mindmap-toggle-balance",
            name: "Toggle balanced layout",
            checkCallback: (checking) => {
                var _a;
                const canvas = this.canvasApi.getActiveCanvas();
                if (!canvas)
                    return false;
                if (!this.isMindmapEnabled(canvas))
                    return false;
                const node = this.canvasApi.getSelectedNode(canvas);
                if (!node)
                    return false;
                const children = this.canvasApi.getChildNodes(canvas, node);
                if (children.length < 2)
                    return false;
                if (checking)
                    return true;
                (_a = this.onBeforeLeaveNode) === null || _a === void 0 ? void 0 : _a.call(this);
                const nodeCx = node.x + node.width / 2;
                // Check if all children are on one side
                let allRight = true;
                let allLeft = true;
                for (const child of children) {
                    const childCx = child.x + child.width / 2;
                    if (childCx >= nodeCx)
                        allLeft = false;
                    else
                        allRight = false;
                }
                const allOneSide = allRight || allLeft;
                if (allOneSide) {
                    // Balance: distribute evenly, alternating right/left
                    const sorted = [...children].sort((a, b) => a.y - b.y);
                    for (let i = 0; i < sorted.length; i++) {
                        const child = sorted[i];
                        if (i % 2 === 1) {
                            // Move to the other side
                            const mirrorX = nodeCx - (child.x + child.width / 2 - nodeCx) - child.width / 2;
                            child.moveTo({ x: mirrorX, y: child.y });
                        }
                    }
                }
                else {
                    // Collapse all to right side
                    for (const child of children) {
                        const childCx = child.x + child.width / 2;
                        if (childCx < nodeCx) {
                            const mirrorX = nodeCx + (nodeCx - childCx) - child.width / 2;
                            child.moveTo({ x: mirrorX, y: child.y });
                        }
                    }
                }
                // Re-layout to clean up positions
                this.layoutEngine.layoutChildren(canvas, node.id);
                if (this.autoColorEnabled()) {
                    this.branchColors.applyColors(canvas);
                }
                this.onNodesChanged(canvas);
            },
        });
        // Ctrl+Alt+Right → Navigate spatially right
        this.plugin.addCommand({
            id: "mindmap-nav-right",
            name: "Navigate right",
            checkCallback: (checking) => {
                return this.navigateCommand(checking, (tree) => {
                    var _a, _b;
                    if (!tree.direction) {
                        // Root: go to nearest right-side child
                        const rightChildren = tree.children.filter(c => c.direction === "right");
                        return this.nearestChild(tree, rightChildren);
                    }
                    // Non-root: use actual positions
                    const nodeCx = tree.canvasNode.x + tree.canvasNode.width / 2;
                    if (tree.children.length > 0) {
                        const childCx = tree.children[0].canvasNode.x + tree.children[0].canvasNode.width / 2;
                        if (childCx >= nodeCx)
                            return this.nearestChild(tree); // children are to the right
                        // Children are to the left → right goes to parent
                        return (_b = (_a = tree.parent) === null || _a === void 0 ? void 0 : _a.canvasNode) !== null && _b !== void 0 ? _b : null;
                    }
                    // Leaf: right goes to parent if parent is to the right
                    if (tree.parent) {
                        const parentCx = tree.parent.canvasNode.x + tree.parent.canvasNode.width / 2;
                        if (parentCx >= nodeCx)
                            return tree.parent.canvasNode;
                    }
                    return null;
                });
            },
        });
        // Ctrl+Alt+Left → Navigate spatially left
        this.plugin.addCommand({
            id: "mindmap-nav-left",
            name: "Navigate left",
            checkCallback: (checking) => {
                return this.navigateCommand(checking, (tree) => {
                    var _a, _b;
                    if (!tree.direction) {
                        // Root: go to nearest left-side child
                        const leftChildren = tree.children.filter(c => c.direction === "left");
                        return this.nearestChild(tree, leftChildren);
                    }
                    // Non-root: use actual positions
                    const nodeCx = tree.canvasNode.x + tree.canvasNode.width / 2;
                    if (tree.children.length > 0) {
                        const childCx = tree.children[0].canvasNode.x + tree.children[0].canvasNode.width / 2;
                        if (childCx < nodeCx)
                            return this.nearestChild(tree); // children are to the left
                        // Children are to the right → left goes to parent
                        return (_b = (_a = tree.parent) === null || _a === void 0 ? void 0 : _a.canvasNode) !== null && _b !== void 0 ? _b : null;
                    }
                    // Leaf: left goes to parent if parent is to the left
                    if (tree.parent) {
                        const parentCx = tree.parent.canvasNode.x + tree.parent.canvasNode.width / 2;
                        if (parentCx < nodeCx)
                            return tree.parent.canvasNode;
                    }
                    return null;
                });
            },
        });
        // Ctrl+Alt+Down → Navigate to next sibling (side-aware if balanced, Y-order if single-side)
        this.plugin.addCommand({
            id: "mindmap-nav-next-sibling",
            name: "Navigate to next sibling",
            checkCallback: (checking) => {
                return this.navigateCommand(checking, (tree) => {
                    if (!tree.parent)
                        return null;
                    // Try balanced navigation for two-sided layouts
                    const balanced = this.balancedSiblingNav(tree, "down");
                    if (balanced)
                        return balanced;
                    // Fall back to Y-order for vertical stacks
                    const next = getNextSibling(tree);
                    if (next)
                        return next.canvasNode;
                    return tree.parent.children[0].canvasNode;
                });
            },
        });
        // Ctrl+Alt+Up → Navigate to previous sibling (side-aware if balanced, Y-order if single-side)
        this.plugin.addCommand({
            id: "mindmap-nav-prev-sibling",
            name: "Navigate to previous sibling",
            checkCallback: (checking) => {
                return this.navigateCommand(checking, (tree) => {
                    if (!tree.parent)
                        return null;
                    // Try balanced navigation for two-sided layouts
                    const balanced = this.balancedSiblingNav(tree, "up");
                    if (balanced)
                        return balanced;
                    // Fall back to Y-order for vertical stacks
                    const prev = getPrevSibling(tree);
                    if (prev)
                        return prev.canvasNode;
                    const siblings = tree.parent.children;
                    return siblings[siblings.length - 1].canvasNode;
                });
            },
        });
        // Register physical-key fallback for non-Latin keyboard layouts
        this.registerPhysicalKeyShortcuts();
    }
    /**
     * Access the CodeMirror 6 EditorView inside a canvas node's iframe.
     */
    getEditorView(node) {
        var _a, _b, _c, _d, _e, _f, _g;
        const iframe = (_a = node.contentEl) === null || _a === void 0 ? void 0 : _a.querySelector("iframe");
        const doc = (_b = iframe === null || iframe === void 0 ? void 0 : iframe.contentDocument) !== null && _b !== void 0 ? _b : (_c = node.contentEl) === null || _c === void 0 ? void 0 : _c.ownerDocument;
        if (!doc)
            return null;
        const cmContent = (_e = ((_d = iframe === null || iframe === void 0 ? void 0 : iframe.contentDocument) !== null && _d !== void 0 ? _d : node.contentEl)) === null || _e === void 0 ? void 0 : _e.querySelector(".cm-content");
        return (_g = (_f = cmContent === null || cmContent === void 0 ? void 0 : cmContent.cmView) === null || _f === void 0 ? void 0 : _f.view) !== null && _g !== void 0 ? _g : null;
    }
    /**
     * Extract the selected text from a node's editor and delete it.
     * Returns the selected text, or null if nothing is selected.
     */
    extractAndDeleteSelection(node) {
        const view = this.getEditorView(node);
        if (!view)
            return null;
        const { from, to } = view.state.selection.main;
        if (from === to)
            return null;
        const text = view.state.sliceDoc(from, to);
        view.dispatch({ changes: { from, to, insert: "" } });
        return text;
    }
    /**
     * Fallback keydown listener that uses event.code (physical key position)
     * instead of event.key (character). Activates only when a non-Latin layout
     * is detected (event.key doesn't match the expected Latin character),
     * so it won't double-fire with Obsidian's built-in hotkey system.
     */
    registerPhysicalKeyShortcuts() {
        const shortcuts = [
            { code: "Period", key: ".", ctrl: true, shift: false, alt: false, cmdId: "mindvas:mindmap-add-child" },
            { code: "KeyS", key: "s", ctrl: true, shift: true, alt: false, cmdId: "mindvas:mindmap-flip-branch" },
            { code: "KeyD", key: "d", ctrl: true, shift: true, alt: false, cmdId: "mindvas:mindmap-toggle-balance" },
            { code: "KeyL", key: "l", ctrl: true, shift: true, alt: false, cmdId: "mindvas:mindmap-resize-subtree" },
            { code: "KeyR", key: "r", ctrl: true, shift: true, alt: true, cmdId: "mindvas:mindmap-resize-all" },
        ];
        this.plugin.registerDomEvent(document, "keydown", (e) => {
            var _a, _b, _c;
            const canvas = this.canvasApi.getActiveCanvas();
            if (!canvas)
                return;
            const ctrlOrCmd = Platform.isMacOS ? e.metaKey : e.ctrlKey;
            if (!ctrlOrCmd)
                return;
            // Undo/Redo fallback for non-Latin layouts
            const canvasAny = canvas;
            if (e.code === "KeyZ" && !e.altKey && e.key.toLowerCase() !== "z") {
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey) {
                    (_a = canvasAny.redo) === null || _a === void 0 ? void 0 : _a.call(canvasAny);
                }
                else {
                    (_b = canvasAny.undo) === null || _b === void 0 ? void 0 : _b.call(canvasAny);
                }
                return;
            }
            if (e.code === "KeyY" && !e.shiftKey && !e.altKey && e.key.toLowerCase() !== "y") {
                e.preventDefault();
                e.stopPropagation();
                (_c = canvasAny.redo) === null || _c === void 0 ? void 0 : _c.call(canvasAny);
                return;
            }
            const commands = this.plugin.app.commands;
            if (!(commands === null || commands === void 0 ? void 0 : commands.executeCommandById))
                return;
            for (const s of shortcuts) {
                if (e.code === s.code &&
                    ctrlOrCmd === s.ctrl &&
                    e.shiftKey === s.shift &&
                    e.altKey === s.alt) {
                    // If event.key matches expected Latin char, Obsidian's
                    // hotkey system will handle it — don't double-fire
                    if (e.key.toLowerCase() === s.key)
                        return;
                    // Non-Latin layout: Obsidian won't match, so we handle it
                    e.preventDefault();
                    e.stopPropagation();
                    commands.executeCommandById(s.cmdId);
                    return;
                }
            }
        });
    }
    /**
     * Navigate to a sibling using side-aware Y-order for balanced (two-sided) layouts.
     * Within the same side, moves to the next/prev sibling by Y position.
     * At the boundary, crosses to the other side's extreme (top↔top, bottom↔bottom).
     * Returns null if siblings are all on one side (caller should fall back to Y-order).
     */
    balancedSiblingNav(tree, direction) {
        if (!tree.parent || tree.parent.children.length < 2)
            return null;
        const siblings = tree.parent.children;
        const parentNode = tree.parent.canvasNode;
        const parentCx = parentNode.x + parentNode.width / 2;
        // Partition siblings into left and right sides, sorted by Y ascending
        const leftSiblings = [];
        const rightSiblings = [];
        for (const s of siblings) {
            const sCx = s.canvasNode.x + s.canvasNode.width / 2;
            if (sCx < parentCx)
                leftSiblings.push(s);
            else
                rightSiblings.push(s);
        }
        if (leftSiblings.length === 0 || rightSiblings.length === 0)
            return null; // single side → use Y-order
        const byCy = (a, b) => (a.canvasNode.y + a.canvasNode.height / 2) - (b.canvasNode.y + b.canvasNode.height / 2);
        leftSiblings.sort(byCy);
        rightSiblings.sort(byCy);
        // Determine which side the current node is on
        const currentCx = tree.canvasNode.x + tree.canvasNode.width / 2;
        const sameSide = currentCx < parentCx ? leftSiblings : rightSiblings;
        const otherSide = currentCx < parentCx ? rightSiblings : leftSiblings;
        const idx = sameSide.indexOf(tree);
        if (idx === -1)
            return null;
        if (direction === "down") {
            if (idx < sameSide.length - 1)
                return sameSide[idx + 1].canvasNode;
            // At bottommost → jump to bottommost on other side
            return otherSide[otherSide.length - 1].canvasNode;
        }
        else {
            if (idx > 0)
                return sameSide[idx - 1].canvasNode;
            // At topmost → jump to topmost on other side
            return otherSide[0].canvasNode;
        }
    }
    /**
     * Find the child whose vertical center is closest to the current node's.
     */
    nearestChild(tree, candidates) {
        const children = candidates !== null && candidates !== void 0 ? candidates : tree.children;
        if (children.length === 0)
            return null;
        const nodeCy = tree.canvasNode.y + tree.canvasNode.height / 2;
        let best = children[0];
        let bestDist = Math.abs((best.canvasNode.y + best.canvasNode.height / 2) - nodeCy);
        for (let i = 1; i < children.length; i++) {
            const childCy = children[i].canvasNode.y + children[i].canvasNode.height / 2;
            const dist = Math.abs(childCy - nodeCy);
            if (dist < bestDist) {
                best = children[i];
                bestDist = dist;
            }
        }
        return best.canvasNode;
    }
    /**
     * Helper for navigation commands.
     */
    navigateCommand(checking, getTarget) {
        var _a;
        const canvas = this.canvasApi.getActiveCanvas();
        if (!canvas)
            return false;
        const node = this.canvasApi.getSelectedNode(canvas);
        if (!node)
            return false;
        // Short-circuit: avoid expensive buildForest during frequent checking calls
        if (checking)
            return true;
        const forest = buildForest(canvas);
        if (forest.length === 0)
            return false;
        const treeNode = findTreeForNode(forest, node.id);
        if (!treeNode)
            return false;
        const target = getTarget(treeNode);
        if (!target)
            return false;
        (_a = this.onBeforeLeaveNode) === null || _a === void 0 ? void 0 : _a.call(this);
        // Relayout from the root of the tree containing the node being left
        let root = treeNode;
        while (root.parent)
            root = root.parent;
        this.layoutEngine.layoutChildren(canvas, root.canvasNode.id);
        this.onNodesChanged(canvas);
        this.canvasApi.selectAndEdit(canvas, target, this.zoomPadding);
        return true;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2V5Ym9hcmQtaGFuZGxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImtleWJvYXJkLWhhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFFBQVEsRUFBVSxNQUFNLFVBQVUsQ0FBQztBQU01QyxPQUFPLEVBQ04sV0FBVyxFQUNYLGVBQWUsRUFDZixjQUFjLEVBQ2QsY0FBYyxHQUdkLE1BQU0sdUJBQXVCLENBQUM7QUFFL0I7O0dBRUc7QUFDSCxNQUFNLE9BQU8sZUFBZTtJQU0zQixZQUNTLE1BQWMsRUFDZCxTQUFvQixFQUNyQixPQUF1QixFQUN2QixZQUEwQixFQUN6QixZQUEwQixFQUMxQixnQkFBK0IsRUFDL0IsbUJBQWdELEdBQUcsRUFBRSxDQUFDLElBQUksRUFDMUQsaUJBQTJDLEdBQUcsRUFBRSxHQUFFLENBQUM7UUFQbkQsV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUNkLGNBQVMsR0FBVCxTQUFTLENBQVc7UUFDckIsWUFBTyxHQUFQLE9BQU8sQ0FBZ0I7UUFDdkIsaUJBQVksR0FBWixZQUFZLENBQWM7UUFDekIsaUJBQVksR0FBWixZQUFZLENBQWM7UUFDMUIscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFlO1FBQy9CLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBMEM7UUFDMUQsbUJBQWMsR0FBZCxjQUFjLENBQXFDO1FBYjVELGtGQUFrRjtRQUNsRixzQkFBaUIsR0FBd0IsSUFBSSxDQUFDO1FBQzlDLDJFQUEyRTtRQUMzRSxnQkFBVyxHQUFXLENBQUMsQ0FBQztJQVdyQixDQUFDO0lBRUosUUFBUTtRQUNQLDZDQUE2QztRQUM3QyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztZQUN0QixFQUFFLEVBQUUsbUJBQW1CO1lBQ3ZCLElBQUksRUFBRSxvQkFBb0I7WUFDMUIsYUFBYSxFQUFFLENBQUMsUUFBaUIsRUFBRSxFQUFFO2dCQUNwQyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFD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QU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsTUFBTTtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBRTFCLE1BQUEsSUFBSSxDQUFDLGlCQUFpQixvREFBSSxDQUFDO1FBQzNCLG9FQUFvRTtRQUNwRSxJQUFJLElBQUksR0FBRyxRQUFRLENBQUM7UUFDcEIsT0FBTyxJQUFJLENBQUMsTUFBTTtZQUFFLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxZQUFZLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzdELElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDL0QsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0NBQ0QiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQbGF0Zm9ybSwgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSB7IENhbnZhcywgQ2FudmFzTm9kZSB9IGZyb20gXCIuLi90eXBlcy9jYW52YXMtaW50ZXJuYWxcIjtcbmltcG9ydCB7IENhbnZhc0FQSSB9IGZyb20gXCIuLi9jYW52YXMvY2FudmFzLWFwaVwiO1xuaW1wb3J0IHsgTm9kZU9wZXJhdGlvbnMgfSBmcm9tIFwiLi4vbWluZG1hcC9ub2RlLW9wZXJhdGlvbnNcIjtcbmltcG9ydCB7IExheW91dEVuZ2luZSB9IGZyb20gXCIuLi9taW5kbWFwL2xheW91dC1lbmdpbmVcIjtcbmltcG9ydCB7IEJyYW5jaENvbG9ycyB9IGZyb20gXCIuLi9taW5kbWFwL2JyYW5jaC1jb2xvcnNcIjtcbmltcG9ydCB7XG5cdGJ1aWxkRm9yZXN0LFxuXHRmaW5kVHJlZUZvck5vZGUsXG5cdGdldE5leHRTaWJsaW5nLFxuXHRnZXRQcmV2U2libGluZyxcblx0Z2V0Rmlyc3RDaGlsZCxcblx0VHJlZU5vZGUsXG59IGZyb20gXCIuLi9taW5kbWFwL3RyZWUtbW9kZWxcIjtcblxuLyoqXG4gKiBSZWdpc3RlcnMgYWxsIG1pbmQgbWFwIGtleWJvYXJkIHNob3J0Y3V0cyBvbiB0aGUgY2FudmFzLlxuICovXG5leHBvcnQgY2xhc3MgS2V5Ym9hcmRIYW5kbGVyIHtcblx0LyoqIENhbGxlZCBiZWZvcmUgYWN0aW9ucyB0aGF0IGxlYXZlIHRoZSBjdXJyZW50IG5vZGUsIHRvIGZpbmFsaXplIGF1dG8tcmVzaXplLiAqL1xuXHRvbkJlZm9yZUxlYXZlTm9kZTogKCgpID0+IHZvaWQpIHwgbnVsbCA9IG51bGw7XG5cdC8qKiBQYWRkaW5nIChweCkgYWRkZWQgYXJvdW5kIHRhcmdldCBub2RlIHdoZW4gem9vbWluZyBhZnRlciBuYXZpZ2F0aW9uLiAqL1xuXHR6b29tUGFkZGluZzogbnVtYmVyID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuXHRcdHByaXZhdGUgY2FudmFzQXBpOiBDYW52YXNBUEksXG5cdFx0cHVibGljIG5vZGVPcHM6IE5vZGVPcGVyYXRpb25zLFxuXHRcdHB1YmxpYyBsYXlvdXRFbmdpbmU6IExheW91dEVuZ2luZSxcblx0XHRwcml2YXRlIGJyYW5jaENvbG9yczogQnJhbmNoQ29sb3JzLFxuXHRcdHByaXZhdGUgYXV0b0NvbG9yRW5hYmxlZDogKCkgPT4gYm9vbGVhbixcblx0XHRwcml2YXRlIGlzTWluZG1hcEVuYWJsZWQ6IChjYW52YXM6IENhbnZhcykgPT4gYm9vbGVhbiA9ICgpID0+IHRydWUsXG5cdFx0cHJpdmF0ZSBvbk5vZGVzQ2hhbmdlZDogKGNhbnZhczogQ2FudmFzKSA9PiB2b2lkID0gKCkgPT4ge31cblx0KSB7fVxuXG5cdHJlZ2lzdGVyKCk6IHZvaWQge1xuXHRcdC8vIEVudGVyIOKGkiBFZGl0IHNlbGVjdGVkIG5vZGUgKGN1cnNvciBhdCBlbmQpXG5cdFx0dGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG5cdFx0XHRpZDogXCJtaW5kbWFwLWVkaXQtbm9kZVwiLFxuXHRcdFx0bmFtZTogXCJFZGl0IHNlbGVjdGVkIG5vZGVcIixcblx0XHRcdGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHRjb25zdCBjYW52YXMgPSB0aGlzLmNhbnZhc0FwaS5nZXRBY3RpdmVDYW52YXMoKTtcblx0XHRcdFx0aWYgKCFjYW52YXMpIHJldHVybiBmYWxzZTtcblx0XHRcdFx0Y29uc3Qgbm9kZSA9IHRoaXMuY2FudmFzQXBpLmdldFNlbGVjdGVkTm9kZShjYW52YXMpO1xuXHRcdFx0XHRpZiAoIW5vZGUpIHJldHVybiBmYWxzZTtcblx0XHRcdFx0aWYgKG5vZGUuaXNFZGl0aW5nKSByZXR1cm4gZmFsc2U7XG5cdFx0XHRcdGlmIChjaGVja2luZykgcmV0dXJuIHRydWU7XG5cblx0XHRcdFx0bm9kZS5zdGFydEVkaXRpbmcoKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHQvLyBDdHJsKz4g4oaSIENyZWF0ZSBjaGlsZCBub2RlXG5cdFx0dGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG5cdFx0XHRpZDogXCJtaW5kbWFwLWFkZC1jaGlsZFwiLFxuXHRcdFx0bmFtZTogXCJBZGQgY2hpbGQgbm9kZVwiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGNhbnZhcyA9IHRoaXMuY2FudmFzQXBpLmdldEFjdGl2ZUNhbnZhcygpO1xuXHRcdFx0XHRpZiAoIWNhbnZhcykgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRjb25zdCBub2RlID0gdGhpcy5jYW52YXNBcGkuZ2V0U2VsZWN0ZWROb2RlKGNhbnZhcyk7XG5cdFx0XHRcdGlmICghbm9kZSkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoY2hlY2tpbmcpIHJldHVybiB0cnVlO1xuXG5cdFx0XHRcdGxldCBzZWxlY3RlZFRleHQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRcdFx0XHRpZiAobm9kZS5pc0VkaXRpbmcpIHtcblx0XHRcdFx0XHRzZWxlY3RlZFRleHQgPSB0aGlzLmV4dHJhY3RBbmREZWxldGVTZWxlY3Rpb24obm9kZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5vbkJlZm9yZUxlYXZlTm9kZT8uKCk7XG5cdFx0XHRcdGNvbnN0IG5ld05vZGUgPSB0aGlzLm5vZGVPcHMuYWRkQ2hpbGQoY2FudmFzLCBub2RlKTtcblx0XHRcdFx0aWYgKG5ld05vZGUpIHtcblx0XHRcdFx0XHRpZiAoc2VsZWN0ZWRUZXh0KSBuZXdOb2RlLnNldFRleHQoc2VsZWN0ZWRUZXh0KTtcblx0XHRcdFx0XHR0aGlzLmxheW91dEVuZ2luZS5sYXlvdXRDaGlsZHJlbihjYW52YXMsIG5vZGUuaWQpO1xuXHRcdFx0XHRcdGlmICh0aGlzLmF1dG9Db2xvckVuYWJsZWQoKSAmJiB0aGlzLmlzTWluZG1hcEVuYWJsZWQoY2FudmFzKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5icmFuY2hDb2xvcnMuYXBwbHlDb2xvcnMoY2FudmFzKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5vbk5vZGVzQ2hhbmdlZChjYW52YXMpO1xuXHRcdFx0XHRcdHRoaXMuY2FudmFzQXBpLnNlbGVjdEFuZEVkaXQoY2FudmFzLCBuZXdOb2RlLCB0aGlzLnpvb21QYWRkaW5nKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdC8vIFNoaWZ0K0VudGVyIOKGkiBDcmVhdGUgc2libGluZyBub2RlXG5cdFx0dGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG5cdFx0XHRpZDogXCJtaW5kbWFwLWFkZC1zaWJsaW5nXCIsXG5cdFx0XHRuYW1lOiBcIkFkZCBzaWJsaW5nIG5vZGVcIixcblx0XHRcdGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHRjb25zdCBjYW52YXMgPSB0aGlzLmNhbnZhc0FwaS5nZXRBY3RpdmVDYW52YXMoKTtcblx0XHRcdFx0aWYgKCFjYW52YXMpIHJldHVybiBmYWxzZTtcblx0XHRcdFx0Y29uc3Qgbm9kZSA9IHRoaXMuY2FudmFzQXBpLmdldFNlbGVjdGVkTm9kZShjYW52YXMpO1xuXHRcdFx0XHRpZiAoIW5vZGUpIHJldHVybiBmYWxzZTtcblx0XHRcdFx0aWYgKGNoZWNraW5nKSByZXR1cm4gdHJ1ZTtcblxuXHRcdFx0XHRsZXQgc2VsZWN0ZWRUZXh0OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0XHRcdFx0aWYgKG5vZGUuaXNFZGl0aW5nKSB7XG5cdFx0XHRcdFx0c2VsZWN0ZWRUZXh0ID0gdGhpcy5leHRyYWN0QW5kRGVsZXRlU2VsZWN0aW9uKG5vZGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMub25CZWZvcmVMZWF2ZU5vZGU/LigpO1xuXHRcdFx0XHRjb25zdCBuZXdOb2RlID0gdGhpcy5ub2RlT3BzLmFkZFNpYmxpbmcoY2FudmFzLCBub2RlKTtcblx0XHRcdFx0aWYgKG5ld05vZGUpIHtcblx0XHRcdFx0XHRpZiAoc2VsZWN0ZWRUZXh0KSBuZXdOb2RlLnNldFRleHQoc2VsZWN0ZWRUZXh0KTtcblx0XHRcdFx0XHRjb25zdCBwYXJlbnQgPSB0aGlzLmNhbnZhc0FwaS5nZXRQYXJlbnROb2RlKGNhbnZhcywgbm9kZSk7XG5cdFx0XHRcdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0XHRcdFx0dGhpcy5sYXlvdXRFbmdpbmUubGF5b3V0Q2hpbGRyZW4oY2FudmFzLCBwYXJlbnQuaWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodGhpcy5hdXRvQ29sb3JFbmFibGVkKCkgJiYgdGhpcy5pc01pbmRtYXBFbmFibGVkKGNhbnZhcykpIHtcblx0XHRcdFx0XHRcdHRoaXMuYnJhbmNoQ29sb3JzLmFwcGx5Q29sb3JzKGNhbnZhcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMub25Ob2Rlc0NoYW5nZWQoY2FudmFzKTtcblx0XHRcdFx0XHR0aGlzLmNhbnZhc0FwaS5zZWxlY3RBbmRFZGl0KGNhbnZhcywgbmV3Tm9kZSwgdGhpcy56b29tUGFkZGluZyk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHQvLyBDdHJsK1NoaWZ0K0VudGVyIOKGkiBEZWxldGUgbm9kZSwgZm9jdXMgcGFyZW50XG5cdFx0dGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG5cdFx0XHRpZDogXCJtaW5kbWFwLWRlbGV0ZS1ub2RlXCIsXG5cdFx0XHRuYW1lOiBcIkRlbGV0ZSBub2RlIGFuZCBmb2N1cyBwYXJlbnRcIixcblx0XHRcdGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHRjb25zdCBjYW52YXMgPSB0aGlzLmNhbnZhc0FwaS5nZXRBY3RpdmVDYW52YXMoKTtcblx0XHRcdFx0aWYgKCFjYW52YXMpIHJldHVybiBmYWxzZTtcblx0XHRcdFx0Y29uc3Qgbm9kZSA9IHRoaXMuY2FudmFzQXBpLmdldFNlbGVjdGVkTm9kZShjYW52YXMpO1xuXHRcdFx0XHRpZiAoIW5vZGUpIHJldHVybiBmYWxzZTtcblx0XHRcdFx0aWYgKGNoZWNraW5nKSByZXR1cm4gdHJ1ZTtcblxuXHRcdFx0XHR0aGlzLm9uQmVmb3JlTGVhdmVOb2RlPy4oKTtcblx0XHRcdFx0Y29uc3QgcGFyZW50ID0gdGhpcy5ub2RlT3BzLmRlbGV0ZUFuZEZvY3VzUGFyZW50KFxuXHRcdFx0XHRcdGNhbnZhcyxcblx0XHRcdFx0XHRub2RlXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdFx0XHR0aGlzLmxheW91dEVuZ2luZS5sYXlvdXRDaGlsZHJlbihjYW52YXMsIHBhcmVudC5pZCk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuYXV0b0NvbG9yRW5hYmxlZCgpICYmIHRoaXMuaXNNaW5kbWFwRW5hYmxlZChjYW52YXMpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmJyYW5jaENvbG9ycy5hcHBseUNvbG9ycyhjYW52YXMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLm9uTm9kZXNDaGFuZ2VkKGNhbnZhcyk7XG5cdFx0XHRcdFx0dGhpcy5jYW52YXNBcGkuc2VsZWN0QW5kRWRpdChjYW52YXMsIHBhcmVudCwgdGhpcy56b29tUGFkZGluZyk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHQvLyBDdHJsK1NoaWZ0K1Mg4oaSIFN3YXAvZmxpcCBicmFuY2ggdG8gb3RoZXIgc2lkZVxuXHRcdHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6IFwibWluZG1hcC1mbGlwLWJyYW5jaFwiLFxuXHRcdFx0bmFtZTogXCJGbGlwIGJyYW5jaCB0byBvdGhlciBzaWRlXCIsXG5cdFx0XHRjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0Y29uc3QgY2FudmFzID0gdGhpcy5jYW52YXNBcGkuZ2V0QWN0aXZlQ2FudmFzKCk7XG5cdFx0XHRcdGlmICghY2FudmFzKSByZXR1cm4gZmFsc2U7XG5cdFx0XHRcdGlmICghdGhpcy5pc01pbmRtYXBFbmFibGVkKGNhbnZhcykpIHJldHVybiBmYWxzZTtcblx0XHRcdFx0Y29uc3Qgbm9kZSA9IHRoaXMuY2FudmFzQXBpLmdldFNlbGVjdGVkTm9kZShjYW52YXMpO1xuXHRcdFx0XHRpZiAoIW5vZGUpIHJldHVybiBmYWxzZTtcblx0XHRcdFx0Y29uc3QgcGFyZW50ID0gdGhpcy5jYW52YXNBcGkuZ2V0UGFyZW50Tm9kZShjYW52YXMsIG5vZGUpO1xuXHRcdFx0XHRpZiAoIXBhcmVudCkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoY2hlY2tpbmcpIHJldHVybiB0cnVlO1xuXG5cdFx0XHRcdGNvbnN0IHdhc0VkaXRpbmcgPSBub2RlLmlzRWRpdGluZztcblx0XHRcdFx0aWYgKCF3YXNFZGl0aW5nKSB0aGlzLm9uQmVmb3JlTGVhdmVOb2RlPy4oKTtcblx0XHRcdFx0Y29uc3QgcGFyZW50Tm9kZSA9IHRoaXMubm9kZU9wcy5mbGlwQnJhbmNoKGNhbnZhcywgbm9kZSk7XG5cdFx0XHRcdGlmIChwYXJlbnROb2RlKSB7XG5cdFx0XHRcdFx0dGhpcy5sYXlvdXRFbmdpbmUucmVzdGFja1NpYmxpbmdzKGNhbnZhcywgcGFyZW50Tm9kZS5pZCk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuYXV0b0NvbG9yRW5hYmxlZCgpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmJyYW5jaENvbG9ycy5hcHBseUNvbG9ycyhjYW52YXMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLm9uTm9kZXNDaGFuZ2VkKGNhbnZhcyk7XG5cdFx0XHRcdFx0aWYgKHdhc0VkaXRpbmcpIG5vZGUuc3RhcnRFZGl0aW5nKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHQvLyBDdHJsK1NoaWZ0K0Qg4oaSIFRvZ2dsZSBiYWxhbmNlZCBsYXlvdXQgKGRpc3RyaWJ1dGUgY2hpbGRyZW4gb24gYm90aCBzaWRlcylcblx0XHR0aGlzLnBsdWdpbi5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiBcIm1pbmRtYXAtdG9nZ2xlLWJhbGFuY2VcIixcblx0XHRcdG5hbWU6IFwiVG9nZ2xlIGJhbGFuY2VkIGxheW91dFwiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGNhbnZhcyA9IHRoaXMuY2FudmFzQXBpLmdldEFjdGl2ZUNhbnZhcygpO1xuXHRcdFx0XHRpZiAoIWNhbnZhcykgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoIXRoaXMuaXNNaW5kbWFwRW5hYmxlZChjYW52YXMpKSByZXR1cm4gZmFsc2U7XG5cdFx0XHRcdGNvbnN0IG5vZGUgPSB0aGlzLmNhbnZhc0FwaS5nZXRTZWxlY3RlZE5vZGUoY2FudmFzKTtcblx0XHRcdFx0aWYgKCFub2RlKSByZXR1cm4gZmFsc2U7XG5cdFx0XHRcdGNvbnN0IGNoaWxkcmVuID0gdGhpcy5jYW52YXNBcGkuZ2V0Q2hpbGROb2RlcyhjYW52YXMsIG5vZGUpO1xuXHRcdFx0XHRpZiAoY2hpbGRyZW4ubGVuZ3RoIDwgMikgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoY2hlY2tpbmcpIHJldHVybiB0cnVlO1xuXG5cdFx0XHRcdHRoaXMub25CZWZvcmVMZWF2ZU5vZGU/LigpO1xuXG5cdFx0XHRcdGNvbnN0IG5vZGVDeCA9IG5vZGUueCArIG5vZGUud2lkdGggLyAyO1xuXG5cdFx0XHRcdC8vIENoZWNrIGlmIGFsbCBjaGlsZHJlbiBhcmUgb24gb25lIHNpZGVcblx0XHRcdFx0bGV0IGFsbFJpZ2h0ID0gdHJ1ZTtcblx0XHRcdFx0bGV0IGFsbExlZnQgPSB0cnVlO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2hpbGRDeCA9IGNoaWxkLnggKyBjaGlsZC53aWR0aCAvIDI7XG5cdFx0XHRcdFx0aWYgKGNoaWxkQ3ggPj0gbm9kZUN4KSBhbGxMZWZ0ID0gZmFsc2U7XG5cdFx0XHRcdFx0ZWxzZSBhbGxSaWdodCA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGFsbE9uZVNpZGUgPSBhbGxSaWdodCB8fCBhbGxMZWZ0O1xuXG5cdFx0XHRcdGlmIChhbGxPbmVTaWRlKSB7XG5cdFx0XHRcdFx0Ly8gQmFsYW5jZTogZGlzdHJpYnV0ZSBldmVubHksIGFsdGVybmF0aW5nIHJpZ2h0L2xlZnRcblx0XHRcdFx0XHRjb25zdCBzb3J0ZWQgPSBbLi4uY2hpbGRyZW5dLnNvcnQoKGEsIGIpID0+IGEueSAtIGIueSk7XG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzb3J0ZWQubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNoaWxkID0gc29ydGVkW2ldO1xuXHRcdFx0XHRcdFx0aWYgKGkgJSAyID09PSAxKSB7XG5cdFx0XHRcdFx0XHRcdC8vIE1vdmUgdG8gdGhlIG90aGVyIHNpZGVcblx0XHRcdFx0XHRcdFx0Y29uc3QgbWlycm9yWCA9IG5vZGVDeCAtIChjaGlsZC54ICsgY2hpbGQud2lkdGggLyAyIC0gbm9kZUN4KSAtIGNoaWxkLndpZHRoIC8gMjtcblx0XHRcdFx0XHRcdFx0Y2hpbGQubW92ZVRvKHsgeDogbWlycm9yWCwgeTogY2hpbGQueSB9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gQ29sbGFwc2UgYWxsIHRvIHJpZ2h0IHNpZGVcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjaGlsZEN4ID0gY2hpbGQueCArIGNoaWxkLndpZHRoIC8gMjtcblx0XHRcdFx0XHRcdGlmIChjaGlsZEN4IDwgbm9kZUN4KSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG1pcnJvclggPSBub2RlQ3ggKyAobm9kZUN4IC0gY2hpbGRDeCkgLSBjaGlsZC53aWR0aCAvIDI7XG5cdFx0XHRcdFx0XHRcdGNoaWxkLm1vdmVUbyh7IHg6IG1pcnJvclgsIHk6IGNoaWxkLnkgfSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUmUtbGF5b3V0IHRvIGNsZWFuIHVwIHBvc2l0aW9uc1xuXHRcdFx0XHR0aGlzLmxheW91dEVuZ2luZS5sYXlvdXRDaGlsZHJlbihjYW52YXMsIG5vZGUuaWQpO1xuXHRcdFx0XHRpZiAodGhpcy5hdXRvQ29sb3JFbmFibGVkKCkpIHtcblx0XHRcdFx0XHR0aGlzLmJyYW5jaENvbG9ycy5hcHBseUNvbG9ycyhjYW52YXMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMub25Ob2Rlc0NoYW5nZWQoY2FudmFzKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHQvLyBDdHJsK0FsdCtSaWdodCDihpIgTmF2aWdhdGUgc3BhdGlhbGx5IHJpZ2h0XG5cdFx0dGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG5cdFx0XHRpZDogXCJtaW5kbWFwLW5hdi1yaWdodFwiLFxuXHRcdFx0bmFtZTogXCJOYXZpZ2F0ZSByaWdodFwiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm5hdmlnYXRlQ29tbWFuZChjaGVja2luZywgKHRyZWUpID0+IHtcblx0XHRcdFx0XHRpZiAoIXRyZWUuZGlyZWN0aW9uKSB7XG5cdFx0XHRcdFx0XHQvLyBSb290OiBnbyB0byBuZWFyZXN0IHJpZ2h0LXNpZGUgY2hpbGRcblx0XHRcdFx0XHRcdGNvbnN0IHJpZ2h0Q2hpbGRyZW4gPSB0cmVlLmNoaWxkcmVuLmZpbHRlcihjID0+IGMuZGlyZWN0aW9uID09PSBcInJpZ2h0XCIpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMubmVhcmVzdENoaWxkKHRyZWUsIHJpZ2h0Q2hpbGRyZW4pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvLyBOb24tcm9vdDogdXNlIGFjdHVhbCBwb3NpdGlvbnNcblx0XHRcdFx0XHRjb25zdCBub2RlQ3ggPSB0cmVlLmNhbnZhc05vZGUueCArIHRyZWUuY2FudmFzTm9kZS53aWR0aCAvIDI7XG5cdFx0XHRcdFx0aWYgKHRyZWUuY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgY2hpbGRDeCA9IHRyZWUuY2hpbGRyZW5bMF0uY2FudmFzTm9kZS54ICsgdHJlZS5jaGlsZHJlblswXS5jYW52YXNOb2RlLndpZHRoIC8gMjtcblx0XHRcdFx0XHRcdGlmIChjaGlsZEN4ID49IG5vZGVDeCkgcmV0dXJuIHRoaXMubmVhcmVzdENoaWxkKHRyZWUpOyAvLyBjaGlsZHJlbiBhcmUgdG8gdGhlIHJpZ2h0XG5cdFx0XHRcdFx0XHQvLyBDaGlsZHJlbiBhcmUgdG8gdGhlIGxlZnQg4oaSIHJpZ2h0IGdvZXMgdG8gcGFyZW50XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJlZS5wYXJlbnQ/LmNhbnZhc05vZGUgPz8gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gTGVhZjogcmlnaHQgZ29lcyB0byBwYXJlbnQgaWYgcGFyZW50IGlzIHRvIHRoZSByaWdodFxuXHRcdFx0XHRcdGlmICh0cmVlLnBhcmVudCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgcGFyZW50Q3ggPSB0cmVlLnBhcmVudC5jYW52YXNOb2RlLnggKyB0cmVlLnBhcmVudC5jYW52YXNOb2RlLndpZHRoIC8gMjtcblx0XHRcdFx0XHRcdGlmIChwYXJlbnRDeCA+PSBub2RlQ3gpIHJldHVybiB0cmVlLnBhcmVudC5jYW52YXNOb2RlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fSk7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXG5cdFx0Ly8gQ3RybCtBbHQrTGVmdCDihpIgTmF2aWdhdGUgc3BhdGlhbGx5IGxlZnRcblx0XHR0aGlzLnBsdWdpbi5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiBcIm1pbmRtYXAtbmF2LWxlZnRcIixcblx0XHRcdG5hbWU6IFwiTmF2aWdhdGUgbGVmdFwiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm5hdmlnYXRlQ29tbWFuZChjaGVja2luZywgKHRyZWUpID0+IHtcblx0XHRcdFx0XHRpZiAoIXRyZWUuZGlyZWN0aW9uKSB7XG5cdFx0XHRcdFx0XHQvLyBSb290OiBnbyB0byBuZWFyZXN0IGxlZnQtc2lkZSBjaGlsZFxuXHRcdFx0XHRcdFx0Y29uc3QgbGVmdENoaWxkcmVuID0gdHJlZS5jaGlsZHJlbi5maWx0ZXIoYyA9PiBjLmRpcmVjdGlvbiA9PT0gXCJsZWZ0XCIpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMubmVhcmVzdENoaWxkKHRyZWUsIGxlZnRDaGlsZHJlbik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIE5vbi1yb290OiB1c2UgYWN0dWFsIHBvc2l0aW9uc1xuXHRcdFx0XHRcdGNvbnN0IG5vZGVDeCA9IHRyZWUuY2FudmFzTm9kZS54ICsgdHJlZS5jYW52YXNOb2RlLndpZHRoIC8gMjtcblx0XHRcdFx0XHRpZiAodHJlZS5jaGlsZHJlbi5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjaGlsZEN4ID0gdHJlZS5jaGlsZHJlblswXS5jYW52YXNOb2RlLnggKyB0cmVlLmNoaWxkcmVuWzBdLmNhbnZhc05vZGUud2lkdGggLyAyO1xuXHRcdFx0XHRcdFx0aWYgKGNoaWxkQ3ggPCBub2RlQ3gpIHJldHVybiB0aGlzLm5lYXJlc3RDaGlsZCh0cmVlKTsgLy8gY2hpbGRyZW4gYXJlIHRvIHRoZSBsZWZ0XG5cdFx0XHRcdFx0XHQvLyBDaGlsZHJlbiBhcmUgdG8gdGhlIHJpZ2h0IOKGkiBsZWZ0IGdvZXMgdG8gcGFyZW50XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJlZS5wYXJlbnQ/LmNhbnZhc05vZGUgPz8gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gTGVhZjogbGVmdCBnb2VzIHRvIHBhcmVudCBpZiBwYXJlbnQgaXMgdG8gdGhlIGxlZnRcblx0XHRcdFx0XHRpZiAodHJlZS5wYXJlbnQpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHBhcmVudEN4ID0gdHJlZS5wYXJlbnQuY2FudmFzTm9kZS54ICsgdHJlZS5wYXJlbnQuY2FudmFzTm9kZS53aWR0aCAvIDI7XG5cdFx0XHRcdFx0XHRpZiAocGFyZW50Q3ggPCBub2RlQ3gpIHJldHVybiB0cmVlLnBhcmVudC5jYW52YXNOb2RlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fSk7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXG5cdFx0Ly8gQ3RybCtBbHQrRG93biDihpIgTmF2aWdhdGUgdG8gbmV4dCBzaWJsaW5nIChzaWRlLWF3YXJlIGlmIGJhbGFuY2VkLCBZLW9yZGVyIGlmIHNpbmdsZS1zaWRlKVxuXHRcdHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6IFwibWluZG1hcC1uYXYtbmV4dC1zaWJsaW5nXCIsXG5cdFx0XHRuYW1lOiBcIk5hdmlnYXRlIHRvIG5leHQgc2libGluZ1wiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLm5hdmlnYXRlQ29tbWFuZChjaGVja2luZywgKHRyZWUpID0+IHtcblx0XHRcdFx0XHRpZiAoIXRyZWUucGFyZW50KSByZXR1cm4gbnVsbDtcblx0XHRcdFx0XHQvLyBUcnkgYmFsYW5jZWQgbmF2aWdhdGlvbiBmb3IgdHdvLXNpZGVkIGxheW91dHNcblx0XHRcdFx0XHRjb25zdCBiYWxhbmNlZCA9IHRoaXMuYmFsYW5jZWRTaWJsaW5nTmF2KHRyZWUsIFwiZG93blwiKTtcblx0XHRcdFx0XHRpZiAoYmFsYW5jZWQpIHJldHVybiBiYWxhbmNlZDtcblx0XHRcdFx0XHQvLyBGYWxsIGJhY2sgdG8gWS1vcmRlciBmb3IgdmVydGljYWwgc3RhY2tzXG5cdFx0XHRcdFx0Y29uc3QgbmV4dCA9IGdldE5leHRTaWJsaW5nKHRyZWUpO1xuXHRcdFx0XHRcdGlmIChuZXh0KSByZXR1cm4gbmV4dC5jYW52YXNOb2RlO1xuXHRcdFx0XHRcdHJldHVybiB0cmVlLnBhcmVudC5jaGlsZHJlblswXS5jYW52YXNOb2RlO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHQvLyBDdHJsK0FsdCtVcCDihpIgTmF2aWdhdGUgdG8gcHJldmlvdXMgc2libGluZyAoc2lkZS1hd2FyZSBpZiBiYWxhbmNlZCwgWS1vcmRlciBpZiBzaW5nbGUtc2lkZSlcblx0XHR0aGlzLnBsdWdpbi5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiBcIm1pbmRtYXAtbmF2LXByZXYtc2libGluZ1wiLFxuXHRcdFx0bmFtZTogXCJOYXZpZ2F0ZSB0byBwcmV2aW91cyBzaWJsaW5nXCIsXG5cdFx0XHRjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubmF2aWdhdGVDb21tYW5kKGNoZWNraW5nLCAodHJlZSkgPT4ge1xuXHRcdFx0XHRcdGlmICghdHJlZS5wYXJlbnQpIHJldHVybiBudWxsO1xuXHRcdFx0XHRcdC8vIFRyeSBiYWxhbmNlZCBuYXZpZ2F0aW9uIGZvciB0d28tc2lkZWQgbGF5b3V0c1xuXHRcdFx0XHRcdGNvbnN0IGJhbGFuY2VkID0gdGhpcy5iYWxhbmNlZFNpYmxpbmdOYXYodHJlZSwgXCJ1cFwiKTtcblx0XHRcdFx0XHRpZiAoYmFsYW5jZWQpIHJldHVybiBiYWxhbmNlZDtcblx0XHRcdFx0XHQvLyBGYWxsIGJhY2sgdG8gWS1vcmRlciBmb3IgdmVydGljYWwgc3RhY2tzXG5cdFx0XHRcdFx0Y29uc3QgcHJldiA9IGdldFByZXZTaWJsaW5nKHRyZWUpO1xuXHRcdFx0XHRcdGlmIChwcmV2KSByZXR1cm4gcHJldi5jYW52YXNOb2RlO1xuXHRcdFx0XHRcdGNvbnN0IHNpYmxpbmdzID0gdHJlZS5wYXJlbnQuY2hpbGRyZW47XG5cdFx0XHRcdFx0cmV0dXJuIHNpYmxpbmdzW3NpYmxpbmdzLmxlbmd0aCAtIDFdLmNhbnZhc05vZGU7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdC8vIFJlZ2lzdGVyIHBoeXNpY2FsLWtleSBmYWxsYmFjayBmb3Igbm9uLUxhdGluIGtleWJvYXJkIGxheW91dHNcblx0XHR0aGlzLnJlZ2lzdGVyUGh5c2ljYWxLZXlTaG9ydGN1dHMoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBY2Nlc3MgdGhlIENvZGVNaXJyb3IgNiBFZGl0b3JWaWV3IGluc2lkZSBhIGNhbnZhcyBub2RlJ3MgaWZyYW1lLlxuXHQgKi9cblx0cHJpdmF0ZSBnZXRFZGl0b3JWaWV3KG5vZGU6IENhbnZhc05vZGUpOiBhbnkge1xuXHRcdGNvbnN0IGlmcmFtZSA9IG5vZGUuY29udGVudEVsPy5xdWVyeVNlbGVjdG9yKFwiaWZyYW1lXCIpIGFzIEhUTUxJRnJhbWVFbGVtZW50IHwgbnVsbDtcblx0XHRjb25zdCBkb2MgPSBpZnJhbWU/LmNvbnRlbnREb2N1bWVudCA/PyBub2RlLmNvbnRlbnRFbD8ub3duZXJEb2N1bWVudDtcblx0XHRpZiAoIWRvYykgcmV0dXJuIG51bGw7XG5cdFx0Y29uc3QgY21Db250ZW50ID0gKGlmcmFtZT8uY29udGVudERvY3VtZW50ID8/IG5vZGUuY29udGVudEVsKT8ucXVlcnlTZWxlY3RvcihcIi5jbS1jb250ZW50XCIpIGFzIGFueTtcblx0XHRyZXR1cm4gY21Db250ZW50Py5jbVZpZXc/LnZpZXcgPz8gbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBFeHRyYWN0IHRoZSBzZWxlY3RlZCB0ZXh0IGZyb20gYSBub2RlJ3MgZWRpdG9yIGFuZCBkZWxldGUgaXQuXG5cdCAqIFJldHVybnMgdGhlIHNlbGVjdGVkIHRleHQsIG9yIG51bGwgaWYgbm90aGluZyBpcyBzZWxlY3RlZC5cblx0ICovXG5cdHByaXZhdGUgZXh0cmFjdEFuZERlbGV0ZVNlbGVjdGlvbihub2RlOiBDYW52YXNOb2RlKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0Y29uc3QgdmlldyA9IHRoaXMuZ2V0RWRpdG9yVmlldyhub2RlKTtcblx0XHRpZiAoIXZpZXcpIHJldHVybiBudWxsO1xuXHRcdGNvbnN0IHsgZnJvbSwgdG8gfSA9IHZpZXcuc3RhdGUuc2VsZWN0aW9uLm1haW47XG5cdFx0aWYgKGZyb20gPT09IHRvKSByZXR1cm4gbnVsbDtcblx0XHRjb25zdCB0ZXh0ID0gdmlldy5zdGF0ZS5zbGljZURvYyhmcm9tLCB0byk7XG5cdFx0dmlldy5kaXNwYXRjaCh7IGNoYW5nZXM6IHsgZnJvbSwgdG8sIGluc2VydDogXCJcIiB9IH0pO1xuXHRcdHJldHVybiB0ZXh0O1xuXHR9XG5cblx0LyoqXG5cdCAqIEZhbGxiYWNrIGtleWRvd24gbGlzdGVuZXIgdGhhdCB1c2VzIGV2ZW50LmNvZGUgKHBoeXNpY2FsIGtleSBwb3NpdGlvbilcblx0ICogaW5zdGVhZCBvZiBldmVudC5rZXkgKGNoYXJhY3RlcikuIEFjdGl2YXRlcyBvbmx5IHdoZW4gYSBub24tTGF0aW4gbGF5b3V0XG5cdCAqIGlzIGRldGVjdGVkIChldmVudC5rZXkgZG9lc24ndCBtYXRjaCB0aGUgZXhwZWN0ZWQgTGF0aW4gY2hhcmFjdGVyKSxcblx0ICogc28gaXQgd29uJ3QgZG91YmxlLWZpcmUgd2l0aCBPYnNpZGlhbidzIGJ1aWx0LWluIGhvdGtleSBzeXN0ZW0uXG5cdCAqL1xuXHRwcml2YXRlIHJlZ2lzdGVyUGh5c2ljYWxLZXlTaG9ydGN1dHMoKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2hvcnRjdXRzID0gW1xuXHRcdFx0eyBjb2RlOiBcIlBlcmlvZFwiLCBrZXk6IFwiLlwiLCBjdHJsOiB0cnVlLCBzaGlmdDogZmFsc2UsIGFsdDogZmFsc2UsIGNtZElkOiBcIm1pbmR2YXM6bWluZG1hcC1hZGQtY2hpbGRcIiB9LFxuXHRcdFx0eyBjb2RlOiBcIktleVNcIiwga2V5OiBcInNcIiwgY3RybDogdHJ1ZSwgc2hpZnQ6IHRydWUsIGFsdDogZmFsc2UsIGNtZElkOiBcIm1pbmR2YXM6bWluZG1hcC1mbGlwLWJyYW5jaFwiIH0sXG5cdFx0XHR7IGNvZGU6IFwiS2V5RFwiLCBrZXk6IFwiZFwiLCBjdHJsOiB0cnVlLCBzaGlmdDogdHJ1ZSwgYWx0OiBmYWxzZSwgY21kSWQ6IFwibWluZHZhczptaW5kbWFwLXRvZ2dsZS1iYWxhbmNlXCIgfSxcblx0XHRcdHsgY29kZTogXCJLZXlMXCIsIGtleTogXCJsXCIsIGN0cmw6IHRydWUsIHNoaWZ0OiB0cnVlLCBhbHQ6IGZhbHNlLCBjbWRJZDogXCJtaW5kdmFzOm1pbmRtYXAtcmVzaXplLXN1YnRyZWVcIiB9LFxuXHRcdFx0eyBjb2RlOiBcIktleVJcIiwga2V5OiBcInJcIiwgY3RybDogdHJ1ZSwgc2hpZnQ6IHRydWUsIGFsdDogdHJ1ZSwgY21kSWQ6IFwibWluZHZhczptaW5kbWFwLXJlc2l6ZS1hbGxcIiB9LFxuXHRcdF07XG5cblx0XHR0aGlzLnBsdWdpbi5yZWdpc3RlckRvbUV2ZW50KGRvY3VtZW50LCBcImtleWRvd25cIiwgKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcblx0XHRcdGNvbnN0IGNhbnZhcyA9IHRoaXMuY2FudmFzQXBpLmdldEFjdGl2ZUNhbnZhcygpO1xuXHRcdFx0aWYgKCFjYW52YXMpIHJldHVybjtcblx0XHRcdGNvbnN0IGN0cmxPckNtZCA9IFBsYXRmb3JtLmlzTWFjT1MgPyBlLm1ldGFLZXkgOiBlLmN0cmxLZXk7XG5cdFx0XHRpZiAoIWN0cmxPckNtZCkgcmV0dXJuO1xuXG5cdFx0XHQvLyBVbmRvL1JlZG8gZmFsbGJhY2sgZm9yIG5vbi1MYXRpbiBsYXlvdXRzXG5cdFx0XHRjb25zdCBjYW52YXNBbnkgPSBjYW52YXMgYXMgYW55O1xuXHRcdFx0aWYgKGUuY29kZSA9PT0gXCJLZXlaXCIgJiYgIWUuYWx0S2V5ICYmIGUua2V5LnRvTG93ZXJDYXNlKCkgIT09IFwielwiKSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0aWYgKGUuc2hpZnRLZXkpIHtcblx0XHRcdFx0XHRjYW52YXNBbnkucmVkbz8uKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2FudmFzQW55LnVuZG8/LigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChlLmNvZGUgPT09IFwiS2V5WVwiICYmICFlLnNoaWZ0S2V5ICYmICFlLmFsdEtleSAmJiBlLmtleS50b0xvd2VyQ2FzZSgpICE9PSBcInlcIikge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdGNhbnZhc0FueS5yZWRvPy4oKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjb21tYW5kcyA9ICh0aGlzLnBsdWdpbi5hcHAgYXMgYW55KS5jb21tYW5kcztcblx0XHRcdGlmICghY29tbWFuZHM/LmV4ZWN1dGVDb21tYW5kQnlJZCkgcmV0dXJuO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHMgb2Ygc2hvcnRjdXRzKSB7XG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHRlLmNvZGUgPT09IHMuY29kZSAmJlxuXHRcdFx0XHRcdGN0cmxPckNtZCA9PT0gcy5jdHJsICYmXG5cdFx0XHRcdFx0ZS5zaGlmdEtleSA9PT0gcy5zaGlmdCAmJlxuXHRcdFx0XHRcdGUuYWx0S2V5ID09PSBzLmFsdFxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHQvLyBJZiBldmVudC5rZXkgbWF0Y2hlcyBleHBlY3RlZCBMYXRpbiBjaGFyLCBPYnNpZGlhbidzXG5cdFx0XHRcdFx0Ly8gaG90a2V5IHN5c3RlbSB3aWxsIGhhbmRsZSBpdCDigJQgZG9uJ3QgZG91YmxlLWZpcmVcblx0XHRcdFx0XHRpZiAoZS5rZXkudG9Mb3dlckNhc2UoKSA9PT0gcy5rZXkpIHJldHVybjtcblx0XHRcdFx0XHQvLyBOb24tTGF0aW4gbGF5b3V0OiBPYnNpZGlhbiB3b24ndCBtYXRjaCwgc28gd2UgaGFuZGxlIGl0XG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFx0Y29tbWFuZHMuZXhlY3V0ZUNvbW1hbmRCeUlkKHMuY21kSWQpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIE5hdmlnYXRlIHRvIGEgc2libGluZyB1c2luZyBzaWRlLWF3YXJlIFktb3JkZXIgZm9yIGJhbGFuY2VkICh0d28tc2lkZWQpIGxheW91dHMuXG5cdCAqIFdpdGhpbiB0aGUgc2FtZSBzaWRlLCBtb3ZlcyB0byB0aGUgbmV4dC9wcmV2IHNpYmxpbmcgYnkgWSBwb3NpdGlvbi5cblx0ICogQXQgdGhlIGJvdW5kYXJ5LCBjcm9zc2VzIHRvIHRoZSBvdGhlciBzaWRlJ3MgZXh0cmVtZSAodG9w4oaUdG9wLCBib3R0b23ihpRib3R0b20pLlxuXHQgKiBSZXR1cm5zIG51bGwgaWYgc2libGluZ3MgYXJlIGFsbCBvbiBvbmUgc2lkZSAoY2FsbGVyIHNob3VsZCBmYWxsIGJhY2sgdG8gWS1vcmRlcikuXG5cdCAqL1xuXHRwcml2YXRlIGJhbGFuY2VkU2libGluZ05hdih0cmVlOiBUcmVlTm9kZSwgZGlyZWN0aW9uOiBcInVwXCIgfCBcImRvd25cIik6IENhbnZhc05vZGUgfCBudWxsIHtcblx0XHRpZiAoIXRyZWUucGFyZW50IHx8IHRyZWUucGFyZW50LmNoaWxkcmVuLmxlbmd0aCA8IDIpIHJldHVybiBudWxsO1xuXG5cdFx0Y29uc3Qgc2libGluZ3MgPSB0cmVlLnBhcmVudC5jaGlsZHJlbjtcblx0XHRjb25zdCBwYXJlbnROb2RlID0gdHJlZS5wYXJlbnQuY2FudmFzTm9kZTtcblx0XHRjb25zdCBwYXJlbnRDeCA9IHBhcmVudE5vZGUueCArIHBhcmVudE5vZGUud2lkdGggLyAyO1xuXG5cdFx0Ly8gUGFydGl0aW9uIHNpYmxpbmdzIGludG8gbGVmdCBhbmQgcmlnaHQgc2lkZXMsIHNvcnRlZCBieSBZIGFzY2VuZGluZ1xuXHRcdGNvbnN0IGxlZnRTaWJsaW5nczogVHJlZU5vZGVbXSA9IFtdO1xuXHRcdGNvbnN0IHJpZ2h0U2libGluZ3M6IFRyZWVOb2RlW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHMgb2Ygc2libGluZ3MpIHtcblx0XHRcdGNvbnN0IHNDeCA9IHMuY2FudmFzTm9kZS54ICsgcy5jYW52YXNOb2RlLndpZHRoIC8gMjtcblx0XHRcdGlmIChzQ3ggPCBwYXJlbnRDeCkgbGVmdFNpYmxpbmdzLnB1c2gocyk7XG5cdFx0XHRlbHNlIHJpZ2h0U2libGluZ3MucHVzaChzKTtcblx0XHR9XG5cblx0XHRpZiAobGVmdFNpYmxpbmdzLmxlbmd0aCA9PT0gMCB8fCByaWdodFNpYmxpbmdzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7IC8vIHNpbmdsZSBzaWRlIOKGkiB1c2UgWS1vcmRlclxuXG5cdFx0Y29uc3QgYnlDeSA9IChhOiBUcmVlTm9kZSwgYjogVHJlZU5vZGUpID0+XG5cdFx0XHQoYS5jYW52YXNOb2RlLnkgKyBhLmNhbnZhc05vZGUuaGVpZ2h0IC8gMikgLSAoYi5jYW52YXNOb2RlLnkgKyBiLmNhbnZhc05vZGUuaGVpZ2h0IC8gMik7XG5cdFx0bGVmdFNpYmxpbmdzLnNvcnQoYnlDeSk7XG5cdFx0cmlnaHRTaWJsaW5ncy5zb3J0KGJ5Q3kpO1xuXG5cdFx0Ly8gRGV0ZXJtaW5lIHdoaWNoIHNpZGUgdGhlIGN1cnJlbnQgbm9kZSBpcyBvblxuXHRcdGNvbnN0IGN1cnJlbnRDeCA9IHRyZWUuY2FudmFzTm9kZS54ICsgdHJlZS5jYW52YXNOb2RlLndpZHRoIC8gMjtcblx0XHRjb25zdCBzYW1lU2lkZSA9IGN1cnJlbnRDeCA8IHBhcmVudEN4ID8gbGVmdFNpYmxpbmdzIDogcmlnaHRTaWJsaW5ncztcblx0XHRjb25zdCBvdGhlclNpZGUgPSBjdXJyZW50Q3ggPCBwYXJlbnRDeCA/IHJpZ2h0U2libGluZ3MgOiBsZWZ0U2libGluZ3M7XG5cblx0XHRjb25zdCBpZHggPSBzYW1lU2lkZS5pbmRleE9mKHRyZWUpO1xuXHRcdGlmIChpZHggPT09IC0xKSByZXR1cm4gbnVsbDtcblxuXHRcdGlmIChkaXJlY3Rpb24gPT09IFwiZG93blwiKSB7XG5cdFx0XHRpZiAoaWR4IDwgc2FtZVNpZGUubGVuZ3RoIC0gMSkgcmV0dXJuIHNhbWVTaWRlW2lkeCArIDFdLmNhbnZhc05vZGU7XG5cdFx0XHQvLyBBdCBib3R0b21tb3N0IOKGkiBqdW1wIHRvIGJvdHRvbW1vc3Qgb24gb3RoZXIgc2lkZVxuXHRcdFx0cmV0dXJuIG90aGVyU2lkZVtvdGhlclNpZGUubGVuZ3RoIC0gMV0uY2FudmFzTm9kZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGlkeCA+IDApIHJldHVybiBzYW1lU2lkZVtpZHggLSAxXS5jYW52YXNOb2RlO1xuXHRcdFx0Ly8gQXQgdG9wbW9zdCDihpIganVtcCB0byB0b3Btb3N0IG9uIG90aGVyIHNpZGVcblx0XHRcdHJldHVybiBvdGhlclNpZGVbMF0uY2FudmFzTm9kZTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogRmluZCB0aGUgY2hpbGQgd2hvc2UgdmVydGljYWwgY2VudGVyIGlzIGNsb3Nlc3QgdG8gdGhlIGN1cnJlbnQgbm9kZSdzLlxuXHQgKi9cblx0cHJpdmF0ZSBuZWFyZXN0Q2hpbGQodHJlZTogVHJlZU5vZGUsIGNhbmRpZGF0ZXM/OiBUcmVlTm9kZVtdKTogQ2FudmFzTm9kZSB8IG51bGwge1xuXHRcdGNvbnN0IGNoaWxkcmVuID0gY2FuZGlkYXRlcyA/PyB0cmVlLmNoaWxkcmVuO1xuXHRcdGlmIChjaGlsZHJlbi5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG5cdFx0Y29uc3Qgbm9kZUN5ID0gdHJlZS5jYW52YXNOb2RlLnkgKyB0cmVlLmNhbnZhc05vZGUuaGVpZ2h0IC8gMjtcblx0XHRsZXQgYmVzdCA9IGNoaWxkcmVuWzBdO1xuXHRcdGxldCBiZXN0RGlzdCA9IE1hdGguYWJzKChiZXN0LmNhbnZhc05vZGUueSArIGJlc3QuY2FudmFzTm9kZS5oZWlnaHQgLyAyKSAtIG5vZGVDeSk7XG5cblx0XHRmb3IgKGxldCBpID0gMTsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBjaGlsZEN5ID0gY2hpbGRyZW5baV0uY2FudmFzTm9kZS55ICsgY2hpbGRyZW5baV0uY2FudmFzTm9kZS5oZWlnaHQgLyAyO1xuXHRcdFx0Y29uc3QgZGlzdCA9IE1hdGguYWJzKGNoaWxkQ3kgLSBub2RlQ3kpO1xuXHRcdFx0aWYgKGRpc3QgPCBiZXN0RGlzdCkge1xuXHRcdFx0XHRiZXN0ID0gY2hpbGRyZW5baV07XG5cdFx0XHRcdGJlc3REaXN0ID0gZGlzdDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gYmVzdC5jYW52YXNOb2RlO1xuXHR9XG5cblx0LyoqXG5cdCAqIEhlbHBlciBmb3IgbmF2aWdhdGlvbiBjb21tYW5kcy5cblx0ICovXG5cdHByaXZhdGUgbmF2aWdhdGVDb21tYW5kKFxuXHRcdGNoZWNraW5nOiBib29sZWFuLFxuXHRcdGdldFRhcmdldDogKHRyZWU6IFRyZWVOb2RlKSA9PiBDYW52YXNOb2RlIHwgbnVsbFxuXHQpOiBib29sZWFuIHtcblx0XHRjb25zdCBjYW52YXMgPSB0aGlzLmNhbnZhc0FwaS5nZXRBY3RpdmVDYW52YXMoKTtcblx0XHRpZiAoIWNhbnZhcykgcmV0dXJuIGZhbHNlO1xuXG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMuY2FudmFzQXBpLmdldFNlbGVjdGVkTm9kZShjYW52YXMpO1xuXHRcdGlmICghbm9kZSkgcmV0dXJuIGZhbHNlO1xuXG5cdFx0Ly8gU2hvcnQtY2lyY3VpdDogYXZvaWQgZXhwZW5zaXZlIGJ1aWxkRm9yZXN0IGR1cmluZyBmcmVxdWVudCBjaGVja2luZyBjYWxsc1xuXHRcdGlmIChjaGVja2luZykgcmV0dXJuIHRydWU7XG5cblx0XHRjb25zdCBmb3Jlc3QgPSBidWlsZEZvcmVzdChjYW52YXMpO1xuXHRcdGlmIChmb3Jlc3QubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2U7XG5cblx0XHRjb25zdCB0cmVlTm9kZSA9IGZpbmRUcmVlRm9yTm9kZShmb3Jlc3QsIG5vZGUuaWQpO1xuXHRcdGlmICghdHJlZU5vZGUpIHJldHVybiBmYWxzZTtcblxuXHRcdGNvbnN0IHRhcmdldCA9IGdldFRhcmdldCh0cmVlTm9kZSk7XG5cdFx0aWYgKCF0YXJnZXQpIHJldHVybiBmYWxzZTtcblxuXHRcdHRoaXMub25CZWZvcmVMZWF2ZU5vZGU/LigpO1xuXHRcdC8vIFJlbGF5b3V0IGZyb20gdGhlIHJvb3Qgb2YgdGhlIHRyZWUgY29udGFpbmluZyB0aGUgbm9kZSBiZWluZyBsZWZ0XG5cdFx0bGV0IHJvb3QgPSB0cmVlTm9kZTtcblx0XHR3aGlsZSAocm9vdC5wYXJlbnQpIHJvb3QgPSByb290LnBhcmVudDtcblx0XHR0aGlzLmxheW91dEVuZ2luZS5sYXlvdXRDaGlsZHJlbihjYW52YXMsIHJvb3QuY2FudmFzTm9kZS5pZCk7XG5cdFx0dGhpcy5vbk5vZGVzQ2hhbmdlZChjYW52YXMpO1xuXHRcdHRoaXMuY2FudmFzQXBpLnNlbGVjdEFuZEVkaXQoY2FudmFzLCB0YXJnZXQsIHRoaXMuem9vbVBhZGRpbmcpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59XG4iXX0=