<div align="center">

![Mindvas Banner](assets/banner.png)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/release/mobench/canvas-mindmap)](https://github.com/mobench/canvas-mindmap/releases)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.5.0+-purple.svg)](https://obsidian.md)

</div>

---

## Features

- **Keyboard-driven editing** — Add, delete, and navigate nodes entirely from the keyboard
- **Auto-layout** — Nodes arrange themselves into a clean tree after every operation
- **Branch coloring** — Each top-level branch gets a distinct color automatically
- **Balanced layout** — Distribute children on both sides of the root for a centered mind map
- **Subtree drag** — Dragging a node moves its entire subtree; hold `Alt` to move a single node
- **Spatial navigation** — Move between nodes directionally (right, left, up, down)
- **Auto-resize** — Nodes resize to fit their content as you type
- **FreeMind import** — Import `.mm` files directly into Canvas
- **Table of contents** — Sidebar view for quick navigation through the tree
- **Non-Latin keyboard support** — Physical key fallback for Arabic, Cyrillic, and other layouts

## Quick Start

1. Install the plugin and open any Canvas
2. Mindmap mode activates automatically — start typing to create your root node
3. Press `Tab` to add a child node, `Enter` for a sibling
4. Use arrow keys to navigate between nodes
5. The layout updates automatically as you build your map

## Installation

### Community Plugins

1. Open **Settings > Community plugins**
2. Search for **Mindvas**
3. Click **Install**, then **Enable**

<details>
<summary>Manual installation</summary>

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/mobench/canvas-mindmap/releases/latest)
2. Create a folder `mindvas` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into that folder
4. Enable the plugin in **Settings > Community plugins**

</details>

## Commands

All commands are available from the command palette (`Ctrl/Cmd+P`). Assign your own hotkeys in **Settings > Hotkeys**.

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
| Resize & re-layout subtree | Resize nodes in the subtree to fit content and re-layout |
| Resize all nodes to fit content | Resize every node in the canvas to fit its content |
| Apply branch colors | Manually trigger branch color assignment |
| Toggle mindmap mode | Enable or disable mindmap mode for the current canvas |
| Toggle table of contents | Open or close the TOC sidebar |
| Import FreeMind file | Import a `.mm` mind map file into the current canvas |

<details>
<summary>Settings</summary>

| Setting | Description | Default |
|---------|-------------|:-------:|
| Default mindmap mode | Whether canvases open in mindmap mode by default | On |
| Auto-layout | Automatically arrange nodes after adding/deleting | On |
| Auto-color branches | Assign distinct colors to top-level branches | On |
| Horizontal gap | Space between parent and child nodes (px) | 80 |
| Vertical gap | Space between sibling nodes (px) | 20 |
| Default node width | Width of newly created nodes (px) | 300 |
| Default node height | Height of newly created nodes (px) | 60 |
| Max node height | Maximum height before a node scrolls (px) | 300 |
| Navigation zoom padding | Extra space around the target node when zooming (px) | 200 |

</details>

## Contributing

Found a bug or have a feature request? [Open an issue](https://github.com/mobench/canvas-mindmap/issues).

## Support

If you find this plugin useful, consider [buying me a coffee](https://buymeacoffee.com/mobench).

## License

[MIT](LICENSE)

---

> [!NOTE]
> This plugin is desktop-only (Canvas is a desktop feature). It does not make network requests, collect telemetry, or access files outside your vault.
