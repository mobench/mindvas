---
description: Flip branches, balance layouts, and manage branch colors.
---

# Branch management

## Branch coloring

When **Auto-color branches** is enabled (on by default), each top-level branch from a root node gets a distinct color. Colors are reapplied automatically when you add or delete nodes.

To manually trigger coloring, run **Apply branch colors** from the command palette.

## Flip branch

Move a branch to the opposite side of its parent. If a child branch is on the right, flipping it moves it to the left (and vice versa).

Run **Flip branch to other side** from the command palette with a node selected.

## Balanced layout

Distribute a root node's children evenly on both sides for a centered mind map:

1. Select a root node that has children on one side
2. Run **Toggle balanced layout** from the command palette
3. Children alternate between right and left sides

Run the command again to collapse all children back to one side.

{% hint style="info" %}
Spatial navigation (up/down) is side-aware in balanced layouts — it navigates within the same side first, then crosses to the other side at the boundary.
{% endhint %}

## Auto-layout

When **Auto-layout** is enabled, the tree structure recalculates after every operation (add, delete, flip, drag). The contour-based algorithm packs sibling subtrees as tightly as possible — a shallow subtree tucks under a deep neighbor to save vertical space.

To manually trigger a full re-layout, run **Re-layout mind map** from the command palette.
