---
description: Automatically arrange multiple trees within a group into a clean grid.
---

# Forest layout

When you have multiple mind map trees inside a canvas group, forest layout arranges them into a tidy grid.

## How to trigger

* **From the Map outline** — right-click a group > "Layout forest"
* **From the canvas** — right-click a group on the canvas > "Layout forest"
* **From the command palette** — select a node inside a group, then run "Layout forest"

## How it works

1. Each tree's internal layout is recalculated first (contour-based packing)
2. Trees are sorted in reading order (top-to-bottom, left-to-right)
3. Trees are flow-packed into rows targeting a square-ish grid shape
4. The group resizes to fit all trees with padding

## Grid shape

The algorithm uses `ceil(sqrt(N))` trees per row with average tree width to determine row breaks. For example:

* 4 trees → 2×2 grid
* 9 trees → 3×3 grid
* 12 trees → 4×3 grid

## Spacing

Trees have wider gaps between them than nodes within a tree (1.5x horizontal, 3x vertical) for clear visual separation.

## Drag and drop

Drag a tree from the Map outline into a group. The entire subtree moves together, preserving the left/right arrangement of children. Forest layout runs automatically after the drop.
