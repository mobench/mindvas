---
description: Insert a new node between existing parent and child nodes.
---

# Insert node between

Alt+click on a node's connection point (the purple dot) to insert a new node between it and its connected nodes.

## How to use

1. Hover near a node's edge until the purple connection dot appears
2. **Alt+click** the purple dot
3. A new node is created between the parent and child, edges are rewired, and the tree re-layouts

## Behavior

**On an incoming connection (left side):**
Inserts a new node between the parent and the clicked node.

```
Before: Parent ── Child
After:  Parent ── New ── Child
```

**On an outgoing connection (right side) with multiple children:**
Inserts a new node between the clicked node and ALL its children on that side.

```
Before: Parent ─┬─ Child 1
                ├─ Child 2
                └─ Child 3

After:  Parent ── New ─┬─ Child 1
                       ├─ Child 2
                       └─ Child 3
```

{% hint style="info" %}
The new node enters edit mode immediately so you can start typing.
{% endhint %}

{% hint style="info" %}
Alt+click on the node body (not the connection dot) still triggers tree selection, not insert.
{% endhint %}
