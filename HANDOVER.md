# HANDOVER: attachbar

> This is the architecture/reference doc. For *why* a given choice was
> made, see [DECISIONS.md](./DECISIONS.md). For *what* changed and when,
> see [CHANGELOG.md](./CHANGELOG.md).

## 1. Project overview

`attachbar` is a reusable UI/component pattern that implements the **egress** concept proposed in:

- https://github.com/UNopenGIS/7/issues/923

### egress (definition)
Egress is a design pattern that projects MapLibre internal state outside the `map div` into adjacent DOM UI layers.

In short:

> Project map-internal state to map-external UI.

---

## 2. Why this project exists

In `mgrs-pmtiles`, grid lines are naturally map content, but marginal numeric annotations (top/left edge values, frame-like labels) are conceptually **outside** map content.

Trying to solve both entirely inside the map renderer causes structural issues:

- non-feature UI treated as if it were a map feature
- unstable behavior across continuous zoom
- hard-to-maintain in-map hacks for paper-map-like marginal annotations

`attachbar` externalizes this responsibility and provides a clean separation:

- **inside map**: basemap, vector tiles, grid lines
- **outside map**: sidebars, marginal labels, frame annotations
- **bridge**: geographic ↔ pixel transforms (`project` / `unproject`)

---

## 3. Dependency and relationship to `mgrs-pmtiles`

This repository is intended as a **foundational dependency** for `mgrs-pmtiles` egress implementation.

- Primary proving ground: MGRS marginal labels (top/left first)
- `mgrs-pmtiles` depends on `attachbar` for robust, reusable map-external annotation behavior
- `attachbar` should remain generic enough to support non-MGRS use cases later

See also:

- https://github.com/hfu/mgrs-pmtiles

---

## 4. Scope (initial)

### In scope (Phase 1)
- Wrapper-adjacent sidebars (`top`, `left`)
- Read current map extent/state
- Compute edge segments (top/left)
- Derive intersections or segmented intervals against grid-like structures
- Convert positions with `map.project(...)`
- Render numeric labels in external DOM layers
- Follow map `move`, `zoom`, `resize`

### Out of scope (Phase 1)
- Full 4-side support (`right`, `bottom`)
- Rich typography / advanced theme system
- Non-essential plugin ecosystem integrations
- Over-generalization before first production usage

---

## 5. Architecture

### 5.1 Conceptual pipeline
1. Acquire current view state (extent, transform, viewport size)
2. Represent viewport edges as segments
3. Resolve relation with target spatial structure (e.g., MGRS grid)
4. Obtain candidate anchor positions (intersections or interval midpoints)
5. Convert anchors to screen pixels (`project`)
6. Apply filtering rules (min pixel spacing, zoom-dependent visibility)
7. Render/update labels in sidebar DOM

### 5.2 Responsibilities
- **Core engine** (`packages/core`): types, anchor filtering, public API contracts
- **MapLibre adapter** (`packages/maplibre-adapter`): map state extraction, event wiring, project bridge
- **DOM renderer** (`packages/dom-renderer`): sidebar containers, label placement, lifecycle
- **Integration layer**: MapLibre event subscription & throttled updates (inside maplibre-adapter)

### 5.3 UI layout model
```
wrapper (position: relative)
├── .attachbar-sidebar--top   (position: absolute, overlay)
├── .attachbar-sidebar--left  (position: absolute, overlay)
└── #map                      (MapLibre target div)
```

Sidebars are non-interfering UI (`pointer-events: none`).

---

## 6. Package structure

```
packages/
  core/              Pure types + filtering logic. No DOM, no MapLibre.
  dom-renderer/      Sidebar DOM management and label placement.
  maplibre-adapter/  MapLibre event wiring + createAttachbar entry point.
examples/
  mgrs-pmtiles/      Reference integration reading real MGRS grid labels
                     from mgrs-pmtiles' live vector tileset. Builds to
                     ../../docs for GitHub Pages.
```

---

## 7. Public API

```ts
type AttachbarSide = "top" | "left" | "right" | "bottom";

interface AttachbarOptions {
  sides: AttachbarSide[];
  minPixelSpacing?: number;
  formatter?: (value: unknown, ctx: { side: AttachbarSide; zoom: number }) => string;
  visibility?: (ctx: { zoom: number; side: AttachbarSide }) => boolean;
}

interface SpatialAnchor {
  side: AttachbarSide;
  lngLat: [number, number];
  value: unknown;
  priority?: number;
}

interface SpatialProvider {
  getAnchors(input: {
    bounds: [number, number, number, number];
    zoom: number;
    sides: AttachbarSide[];
  }): SpatialAnchor[];
}

declare function createAttachbar(params: {
  map: maplibregl.Map;
  container: HTMLElement;
  provider: SpatialProvider;
  options?: AttachbarOptions;
}): {
  update(): void;
  destroy(): void;
};
```

---

## 8. Performance and stability requirements

- Throttle rendering updates on high-frequency map events (default 50 ms)
- Ensure idempotent redraws (no DOM leak / duplicate nodes)
- Min pixel spacing rule to avoid overcrowding
- Stable behavior during continuous zoom and resize
- Deterministic corner handling policy (documented and tested)

---

## 9. Testing strategy

- **Unit tests** in `packages/core/src/filter.test.ts`
  - anchor filtering (spacing / priority)
  - boundary conditions

- **Unit tests** in `packages/dom-renderer/src/sidebar.test.ts`
  - sidebar creation, label placement, cleanup

- **Integration tests** in `packages/maplibre-adapter/src/index.test.ts`
  - map event subscription lifecycle
  - update / destroy API
  - formatter and visibility hooks

---

## 10. Milestones

### M1: Feasibility prototype ✅
- top/left sidebars
- basic anchors from mock provider
- DOM rendering loop

### M2: MGRS integration proof ✅
- real provider for MGRS-oriented anchors, reading mgrs-pmtiles' live
  tileset (`MgrsSourceProvider`) — see DECISIONS.md D5
- basic spacing/visibility controls (`minPixelSpacing`, `visibility`)
- interval-midpoint strategy: not needed in practice — real tile data
  already supplies exact grid-line-crossing points, so only the
  "intersections" branch of the pipeline (§5.1 step 4) is exercised

### M3: Hardening
- resize/zoom stress stability
- API cleanup
- packaging for external consumption

### M4: Expansion
- right/bottom support
- generic frame annotation recipes

---

## 11. Risks and mitigations

- **Risk**: overfitting to MGRS  
  **Mitigation**: provider contract stays generic; MGRS lives in example/integration package (D4).

- **Risk**: performance under continuous interaction  
  **Mitigation**: throttled updates + minimal DOM diff strategy.

- **Risk**: ambiguous corner/collision behavior  
  **Mitigation**: explicit policy with test coverage.

---

## 12. Definition of done (for first adoption by `mgrs-pmtiles`)

- `mgrs-pmtiles` can render MGRS grid lines in-map
- top/left marginal numeric labels are rendered out-of-map via `attachbar`
- behavior remains readable and stable across expected zoom range
- dependency relation and integration instructions documented

---

## 13. Practical next actions

1. ~~Create repository, monorepo skeleton, M1 mock provider~~ ✅
2. ~~Wire M2 against `mgrs-pmtiles` integration example~~ ✅ — see CHANGELOG.md
3. Iterate API from real usage feedback; promote `MgrsSourceProvider` out
   of `examples/` only if a second consumer appears (D4)
4. M3 hardening: resize/zoom stress beyond the manual spot-check done so
   far, API cleanup, packaging for external consumption
5. Switch `mgrs-pmtiles`'s own `web/main.js` from its screen-position
   edge-detection hack to consuming `attachbar` — out of scope for this
   repo (see D5); tracked separately

New decisions belong in [DECISIONS.md](./DECISIONS.md); notable changes
belong in [CHANGELOG.md](./CHANGELOG.md).

---

## 14. Notes for maintainers

This project is not "just UI decoration."  
It is an implementation of the **egress** architectural separation and is expected to serve as reusable infrastructure for map-external annotations, with `mgrs-pmtiles` as the first concrete dependency.

See also: [DECISIONS.md](./DECISIONS.md) for why things are shaped this
way, and [CHANGELOG.md](./CHANGELOG.md) for a running log of what's
landed.
