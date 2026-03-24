---
description: Using Mindvas with Arabic, Hebrew, and other right-to-left languages.
---

# Working with RTL content

Mindvas fully supports right-to-left (RTL) text in node content, group names, and the Map outline panel.

## What works

* **Node text** — Arabic, Hebrew, and other RTL text renders correctly in canvas nodes
* **Map outline** — Group names display correctly with count badges positioned at the end
* **Search filter** — Filters work with RTL text
* **Group rename** — Inline editing supports RTL input
* **Keyboard shortcuts** — Physical-key fallback ensures shortcuts work regardless of active keyboard layout

## Physical-key fallback

When using a non-Latin keyboard layout (Arabic, Hebrew, etc.), Obsidian's built-in hotkey system may not recognize your shortcuts. Mindvas includes a physical-key fallback that maps shortcuts to physical key positions rather than typed characters.

This means Ctrl+. (add child) works whether your keyboard is set to English or Arabic — the plugin detects the physical Period key regardless of what character it produces.

{% hint style="info" %}
The fallback only activates when a non-Latin layout is detected. It won't double-fire with Obsidian's built-in hotkey system.
{% endhint %}
