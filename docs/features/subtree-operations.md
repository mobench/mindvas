---
description: Drag subtrees, detach branches, resize nodes, and manage tree structure.
---

# Subtree operations

## Drag a subtree

**Drag** any node to move it along with all its descendants. Relative positions are preserved — the whole branch moves together.

**Alt+drag** a node to move only that node, leaving its children in place. This is useful for repositioning a single node without disrupting the subtree below it.

## Drag within groups

**Alt+drag** a canvas group to move the group without dragging "stranger" nodes — nodes that belong to other trees but happen to be inside the group bounds.

## Detach a subtree

Disconnect a branch from its parent to create an independent tree:

1. Select the child node you want to detach
2. Run **Detach subtree as independent tree** from the command palette
3. The edge to the parent is removed and the node's color resets

The detached branch keeps its own internal structure. You can move it to a different group or canvas.

## Resize nodes

Nodes **auto-resize** to fit their content as you type (when auto-resize is active). They grow and shrink vertically up to the **Max node height** setting, after which they scroll.

For manual control:

* **Resize & re-layout selected subtree** — resizes all nodes in the selected subtree to fit content, then re-layouts
* **Resize all nodes to fit content** — resizes every node on the canvas and applies a full layout

## Selected text to child

When you run **Add child node** while text is selected inside a node, the selected text is moved to the new child node and deleted from the original. This is a quick way to split a node's content into a parent-child structure.

The same applies to **Add sibling node**.
