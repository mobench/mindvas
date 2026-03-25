---
description: Complete list of all Mindvas commands.
---

# Commands

All commands are available from the command palette (`Ctrl/Cmd+P`). Search for "Mindvas" to find them. No default hotkeys are set — assign your own in **Settings > Hotkeys**.

## Node editing

| Command | Description |
|---------|-------------|
| Edit selected node | Start editing the selected node's text |
| Add child node | Create a child node from the selected node. If text is selected, it moves to the child |
| Add sibling node | Create a sibling node next to the current one. If text is selected, it moves to the sibling |
| Delete node and focus parent | Remove the current node and select its parent |

## Navigation

| Command | Description |
|---------|-------------|
| Navigate right | Move to the nearest right-side child, or to parent if children are left |
| Navigate left | Move to the nearest left-side child, or to parent if children are right |
| Navigate to next sibling | Move to the next sibling (side-aware in balanced layouts) |
| Navigate to previous sibling | Move to the previous sibling (side-aware in balanced layouts) |

## Layout and formatting

| Command | Description |
|---------|-------------|
| Re-layout mind map | Recalculate layout for all trees on the canvas |
| Layout forest | Arrange trees within the selected group into a grid |
| Flip branch to other side | Move a branch to the opposite side of its parent |
| Toggle balanced layout | Distribute children on both sides, or collapse to one side |
| Apply branch colors | Manually assign colors to top-level branches |

## Resize

| Command | Description |
|---------|-------------|
| Resize & re-layout selected subtree | Resize nodes in the subtree to fit content, then re-layout |
| Resize all nodes to fit content | Resize every node on the canvas and apply full layout |

## Other

| Command | Description |
|---------|-------------|
| Toggle mindmap mode | Enable or disable mindmap mode for the current canvas |
| Detach subtree as independent tree | Disconnect a branch from its parent |
| Import mind map (.mm) file to canvas | Import a FreeMind/Coggle file into a new canvas |

## Suggested hotkeys

| Command | Suggested hotkey |
|---------|-----------------|
| Edit selected node | `Enter` |
| Add child node | `Ctrl + .` |
| Add sibling node | `Ctrl + Enter` |
| Delete node and focus parent | `Ctrl + Shift + Backspace` |
| Flip branch | `Ctrl + Shift + S` |
| Toggle balanced layout | `Ctrl + Shift + D` |
| Navigate right/left/up/down | `Ctrl + Alt + Arrow keys` |
| Resize & re-layout subtree | `Ctrl + Shift + L` |

{% hint style="info" %}
Mindvas includes a physical-key fallback for non-Latin keyboard layouts. See [Working with RTL content](../guides/rtl-content.md).
{% endhint %}
