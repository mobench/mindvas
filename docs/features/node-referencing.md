---
description: >-
  Create clickable links to nodes that work across canvases and from markdown
  notes.
---

# Node referencing

Copy a link to any node or group and paste it anywhere in your vault. Clicking the link navigates directly to that node.

## How to use

{% stepper %}
{% step %}
### Copy the link

Right-click a node on the canvas and choose **Copy node link**. The link is copied to your clipboard as a markdown link.
{% endstep %}

{% step %}
### Paste it

Paste the link into any node's text, or into a markdown note. It appears as a clickable link showing the node's title.
{% endstep %}

{% step %}
### Click to navigate

Click the link (node must be focused, not in edit mode). Obsidian opens the target canvas and zooms to the node.
{% endstep %}
{% endstepper %}

## How it works

The link format is:

```
[Node Title](obsidian://mindvas-navigate?canvas=path/to/canvas.canvas&id=abc123)
```

* **canvas** — the vault-relative path to the canvas file
* **id** — the node's unique 16-character hex ID

## Cross-canvas links

Links include the canvas file path, so they work from:

* Other nodes on the same canvas
* Nodes on a different canvas
* Regular markdown notes

If the target canvas isn't open, Mindvas opens it first, then navigates to the node.

## Group links

Right-click a group (either on canvas or in the Map outline) to copy a link to the group. Clicking it zooms to fit the entire group.

{% hint style="warning" %}
If the target node is deleted, clicking the link shows a "Target node not found" notice.
{% endhint %}
