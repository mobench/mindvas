# Canvas Fuzzy Search

## Context

Users working with large mind maps need a way to quickly locate nodes by content without visually scanning the canvas. The existing `@@` inline suggest searches all canvas files vault-wide, but there's no modal search scoped to the current canvas. This feature adds a command-palette-style fuzzy search that shows matching nodes with tree breadcrumbs for context, then selects and zooms to the chosen node.

## Requirements

- Fuzzy search modal scoped to the **current** canvas only
- Results show: node content (with match highlights) + breadcrumb line (root > first branch child)
- Breadcrumb format matches `@@` node suggest: `[circle-dot] Root > [leaf] Branch`
- Selecting a result: `selectOnly` + `zoomToBbox` (reuse `CanvasAPI.selectAndZoom`)
- Registered as a command (`mindmap-search`) with assignable hotkey
- Setting: `searchIncludeRoots` (default `false`) — whether root nodes appear in results
- Command only available when a canvas view is active

## Architecture

### New file: `src/ui/canvas-search.ts`

**`CanvasSearchModal`** extends `SuggestModal<SearchEntry>`.

```ts
interface SearchEntry {
  canvasNode: CanvasNode;
  displayText: string;     // first line, cleaned
  rootText: string | null;
  branchText: string | null;
  match: SearchResult | null;
}
```

**Constructor** receives `app`, `canvas` (live Canvas object), `canvasApi`, `settings`.

**On open** (`getSuggestions("")`):
1. Iterate `canvas.nodes.values()`, skip group nodes (via `getGroupIds`).
2. Build `parentMap: Map<string, string>` from `canvas.edges` (`edge.to.node.id -> edge.from.node.id`, first parent wins).
3. For each node: clean text (first line, strip markdown), compute `getAncestorPath` → `rootText`/`branchText`.
4. If `searchIncludeRoots` is false, skip nodes with no entry in `parentMap` (roots).
5. Cache the entry list for the modal's lifetime.

**`getSuggestions(query)`**: `prepareFuzzySearch(query)` on `displayText`. Sort by `match.score` descending. Return top results.

**`renderSuggestion(entry, el)`**:
- Title div: `renderResults(el, entry.displayText, entry.match)`
- Breadcrumb div: same rendering as `node-suggest.ts` — `circle-dot` icon + root text (30 char truncate), optional `" > "` + `leaf` icon + branch text.

**`onChooseSuggestion(entry)`**: `canvasApi.selectAndZoom(canvas, entry.canvasNode, settings.navigationZoomPadding)`.

### Breadcrumb computation

Reuse `getAncestorPath` logic (currently duplicated in `node-suggest.ts` and `backlink-index.ts`). For this feature, build `parentMap` from live `canvas.edges` map rather than parsing JSON. Same walk-up algorithm.

### Command registration (in `main.ts`)

```ts
this.addCommand({
  id: "mindmap-search",
  name: "Search nodes in canvas",
  checkCallback: (checking) => {
    const canvas = this.canvasApi.getActiveCanvas() ?? this.canvasApi.getAnyCanvas();
    if (!canvas) return false;
    if (!checking) new CanvasSearchModal(this.app, canvas, this.canvasApi, this.settings).open();
    return true;
  },
});
```

### Settings addition

- `MindMapSettings.searchIncludeRoots: boolean` — default `false`
- Toggle in settings tab: "Include root nodes in search" / "When disabled, root nodes are excluded from canvas search results since they're visible in the layout"

### CSS

Reuse existing classes: `.mindvas-suggest-breadcrumb`, `.mindvas-suggest-breadcrumb-icon`. No new CSS.

## Verification

1. Build with `npm run build` — no type errors
2. Open a canvas with a multi-level mind map in Obsidian
3. Trigger the search command (assign a hotkey first)
4. Type a partial word — confirm fuzzy matching works, results show correct breadcrumbs
5. Select a result — confirm the node is selected and viewport zooms to it
6. Test with Arabic text — confirm RTL breadcrumbs render correctly
7. Toggle `searchIncludeRoots` in settings — confirm root nodes appear/disappear from results
8. Test on a canvas with no nodes / empty canvas — confirm modal opens but shows no results gracefully
