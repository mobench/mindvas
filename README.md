# Canvas MindMap

Turn Obsidian Canvas into a powerful mind mapping tool with keyboard-driven node operations, auto-layout, and branch coloring.

## Features

- **Keyboard-driven editing** — Add child/sibling nodes, delete nodes, and navigate the tree entirely from the keyboard
- **Auto-layout** — Automatically arranges nodes in a clean tree layout after every operation
- **Branch coloring** — Assigns distinct colors to each top-level branch for visual clarity
- **Balanced layout** — Distribute children on both sides of a root node for a centered mind map
- **Flip branches** — Move a branch to the opposite side of its parent
- **Spatial navigation** — Navigate between nodes using directional commands (right, left, up, down)
- **Auto-resize** — Nodes automatically resize to fit their content as you type
- **Resize to fit** — Batch-resize selected subtree or all nodes to fit their content
- **Subtree drag** — Dragging a node moves its entire subtree; hold Alt to move a single node
- **FreeMind import** — Import `.mm` files from FreeMind into Obsidian Canvas
- **Table of contents** — A sidebar view showing the tree structure for quick navigation
- **Non-Latin keyboard support** — Physical key fallback for Arabic, Cyrillic, and other keyboard layouts

## Commands

All commands are available from the command palette (`Ctrl/Cmd+P`). You can assign your own hotkeys in Settings > Hotkeys.

| Command | Description |
|---------|-------------|
| Re-layout mind map | Recalculate and apply layout to the entire canvas |
| Edit selected node | Start editing the selected node |
| Add child node | Create a new child node (selected text moves to child) |
| Add sibling node | Create a sibling node below the current one |
| Delete node and focus parent | Remove the current node and select its parent |
| Flip branch to other side | Move a branch to the opposite side of its parent |
| Toggle balanced layout | Distribute children evenly on both sides, or collapse to one side |
| Navigate right/left/up/down | Move selection spatially through the tree |
| Resize & re-layout selected subtree | Resize nodes in the subtree to fit content and re-layout |
| Resize all nodes to fit content | Resize every node in the canvas to fit its content |
| Apply branch colors | Manually trigger branch color assignment |
| Toggle mindmap mode | Enable or disable mindmap mode for the current canvas |
| Toggle table of contents | Open or close the TOC sidebar |
| Import FreeMind file | Import a `.mm` mind map file into the current canvas |

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Default mindmap mode | Whether canvases open in mindmap mode by default | On |
| Auto-layout | Automatically arrange nodes after adding/deleting | On |
| Auto-color branches | Assign distinct colors to top-level branches | On |
| Horizontal gap | Space between parent and child nodes (px) | 80 |
| Vertical gap | Space between sibling nodes (px) | 20 |
| Default node width | Width of newly created nodes (px) | 300 |
| Default node height | Height of newly created nodes (px) | 60 |
| Max node height | Maximum height before a node scrolls (px) | 300 |
| Navigation zoom padding | Extra space around the target node when zooming after navigation (px) | 200 |

## Installation

### From community plugins (coming soon)

1. Open Settings > Community plugins
2. Search for "Canvas MindMap"
3. Click Install, then Enable

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/mobench/canvas-mindmap/releases/latest)
2. Create a folder `canvas-mindmap` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into that folder
4. Enable the plugin in Settings > Community plugins

## Disclosures

- This plugin does **not** make any network requests
- This plugin does **not** collect telemetry or analytics
- This plugin does **not** access files outside your vault
- This plugin has **no** paid features or premium tiers
- This plugin is desktop only (Canvas is a desktop feature)
