# DECISIONS: attachbar

A lightweight decision log. Each entry captures a choice that wasn't
obvious from the code alone — the alternative considered and why it lost.
For what changed and when, see [CHANGELOG.md](./CHANGELOG.md). For the
architecture these decisions produced, see [HANDOVER.md](./HANDOVER.md).

---

## D1: Adopt the "egress" pattern instead of in-map annotation hacks

**Date**: 2026-07-02

**Context**: In `mgrs-pmtiles`, MGRS grid lines are genuine map content,
but marginal numeric labels (top/left edge values, frame-like annotations)
are conceptually outside map content. Rendering both as in-map layers
mixes non-feature UI with map features, and requires screen-position
hacks (e.g. filtering by rendered pixel margin) to fake a "frame."

**Decision**: Externalize marginal annotations to a DOM layer adjacent to
the map div, bridged by `map.project()`/`unproject()`. attachbar owns
this bridge; the map only renders true map content.

**Consequence**: attachbar is a separate, generic package rather than a
mgrs-pmtiles-internal feature. See D4 for how far that genericness goes
in practice.

---

## D2: Split into `core` / `dom-renderer` / `maplibre-adapter`

**Date**: 2026-07-02

**Context**: The pipeline (read map state → resolve anchors → filter →
render) mixes three concerns with different testability needs: pure
filtering logic, DOM manipulation, and MapLibre-specific event wiring.

**Decision**: Three packages, each independently testable:
- `core` — types + `filterAnchors`, no DOM, no MapLibre. Runs under a
  plain `node` vitest environment.
- `dom-renderer` — sidebar DOM lifecycle, tested under `jsdom`.
- `maplibre-adapter` — event subscription, throttling, and the
  `createAttachbar` entry point that composes the other two.

**Consequence**: `core` can be reused by a non-DOM consumer later
(e.g. server-side anchor computation) without pulling in jsdom or
maplibre-gl.

---

## D3: Phase 1 scope is top/left only, no theming, no plugin ecosystem

**Date**: 2026-07-02

**Context**: mgrs-pmtiles' immediate need is top/left marginal labels.
Building right/bottom support, a theme system, or plugin hooks before a
single real consumer exists risks designing for requirements that don't
exist yet.

**Decision**: Phase 1 (M1–M3) supports `top`/`left` sides only. `right`/
`bottom` are modeled in the type system (`AttachbarSide`) but not
implemented until a concrete need appears (M4).

**Consequence**: The `SpatialProvider`/`AttachbarOptions` contracts
already accept all four sides, so M4 should be additive, not a breaking
API change.

---

## D4: MGRS-specific logic stays in `examples/`, not promoted to `packages/`

**Date**: 2026-07-02 (reaffirmed 2026-07-03 after the real provider landed)

**Context**: attachbar's `core`/`dom-renderer`/`maplibre-adapter`
packages are meant to stay generic (D1). MGRS is the only consumer so
far, so any MGRS-aware code is a candidate for overfitting the public
API to one use case.

**Decision**: `MgrsSourceProvider` and all MGRS-specific logic live in
`examples/mgrs-pmtiles/`, implementing the generic `SpatialProvider`
contract from `@attachbar/core`. Nothing in `packages/` knows what MGRS
is.

**Consequence**: Promoting `MgrsSourceProvider` to a real package (e.g.
`@attachbar/mgrs-provider`) is deferred until a second consumer actually
needs it — see HANDOVER.md §13.

---

## D5: The real MGRS provider reuses mgrs-pmtiles' live vector tiles instead of re-deriving grid geometry

**Date**: 2026-07-03

**Context**: For M2, the mock provider (evenly-spaced degree lines) needed
replacing with something that shows real MGRS values. Two approaches were
considered:
1. Recompute MGRS grid-line crossings independently using the `mgrs` npm
   library (sample viewport edges, binary-search for digit-group
   transitions).
2. Reuse the same martin-served vector tiles
   (`https://tunnel.optgeo.org/martin/mgrs-hokkaido`) that mgrs-pmtiles
   already renders in-map, reading its pre-generated
   `mgrs_{10km,1km,100m}_label_{e,n}` point layers via
   `map.querySourceFeatures()`.

Approach 1 was partially prototyped but abandoned once the user clarified
the intent: reuse mgrs-pmtiles' existing pmtiles data as the source of
truth, rather than recompute it.

**Decision**: `MgrsSourceProvider` (approach 2) queries the live tileset
directly. mgrs-pmtiles' own `web/main.js` — including its screen-position
edge-detection hack for picking "near-edge" labels — is left completely
untouched. That hack is the "before"; attachbar's external sidebars are
the "after." The two coexist in separate repos; this repo does not modify
`mgrs-pmtiles`.

**Consequence**: attachbar's example depends on network access to the
live martin endpoint (no offline/local fallback beyond the original mock
provider, which is kept in the tree but no longer wired into `main.ts`).
Grid line dedup (multiple tile instances of the same grid line) is
handled by picking whichever loaded feature sits closest to the relevant
edge, not by recomputing exact crossings.

---

## D6: No edge labels for the 100km band

**Date**: 2026-07-03

**Context**: Investigated whether attachbar should show 100km-resolution
grid labels in the sidebars at low zoom.

**Decision**: Not implemented — the upstream tileset only exposes
`mgrs_100km_label_points` (centroid labels, 2-letter square ID), with no
`_label_e`/`_label_n` edge variant, matching mgrs-pmtiles' own
`centroidLabelSpecs` (no edge spec for 100km). There is no data to query
for this case; revisit only if mgrs-pmtiles' tileset gains edge-oriented
100km labels.

---

## D7: Publish the example via GitHub Pages from a committed `docs/` folder

**Date**: 2026-07-03

**Context**: Wanted a shareable, zero-infrastructure way to demo the
example. GitHub Pages' "deploy from a branch" mode can serve a `/docs`
folder on `main` directly, with no Actions workflow required.

**Decision**: `examples/mgrs-pmtiles/vite.config.ts` builds to the
repo-root `docs/` with `base: "./"` (relative asset paths, required
since project pages serve from a `/attachbar/` subpath, not the domain
root). Build output is committed, not gitignored. `.nojekyll` is included
so Pages skips Jekyll processing.

**Consequence**: `docs/` must be rebuilt and re-committed manually after
source changes (`npm run build` or `npm run build:docs`) — there is no CI
step doing this automatically yet.

---

## D8: Sidebar thickness becomes JS-owned to fix top-left corner collisions

**Date**: 2026-07-03

**Context**: HANDOVER.md §8/§11 flagged "deterministic corner handling
policy" as a requirement with no implemented mitigation. Verified the gap
concretely: the top and left sidebars are DOM siblings covering the same
top-left rectangle (`left` is appended after `top`, so it paints over
it), and a "top" label with `pixel.x` inside the left sidebar's width (or
a "left" label with `pixel.y` inside the top sidebar's height) rendered
underneath the other sidebar's translucent background — visually faded
or clipped. Confirmed via a live screenshot before fixing.

The root cause was that sidebar pixel size was 100% author-CSS-owned
(`.attachbar-sidebar--top { height: 32px }` in `index.html`) and
invisible to the JS layer, so `renderLabels` had no way to know where the
"other" sidebar's territory started. `index.html` already carried a
comment flagging this as fragile ("keep in sync with createAttachbar
sidebar height/width").

**Decision**: Added `AttachbarOptions.sidebarSize` (default `{ top: 32,
bottom: 32, left: 48, right: 48 }`). `createSidebars` now sets each
sidebar's `width`/`height` via inline style directly (author CSS only
handles background/border/font), and stamps the resolved size onto
`el.dataset.attachbarSize`. `renderLabels` reads those dataset values
back to reserve the top-left corner: a "top" anchor whose x falls inside
the left sidebar's width is dropped, and vice versa for "left" anchors
inside the top sidebar's height (only when both sidebars are actually
present).

Right/bottom corners are intentionally not handled yet — they need the
container's total width/height, which isn't shipped in Phase 1 (D3).

**Consequence**: Custom sidebar sizes must now go through
`AttachbarOptions.sidebarSize`, not CSS `height`/`width` overrides on
`.attachbar-sidebar--*` (CSS can still override background, border,
font, etc.). This removes the CSS/JS sync hazard entirely instead of
papering over it.

---

## D9: Show the MGRS grid frame and the 100km "alphabet" centroid labels in-map; switch to GSI's basemap

**Date**: 2026-07-03

**Context**: Feedback after reviewing the GitHub Pages demo: (1) the
basemap should be GSI's (国土地理院) optimal vector tiles, same as
mgrs-pmtiles' own viewer, not a generic OSM raster; (2) while the
numeric edge annotations should stay sidebar-only (D5), the grid's frame
lines themselves should be visible in-map, and the 100km-square centroid
labels ("alphabet" 2-letter square IDs, e.g. "VN") should render in-map
at low zoom — matching mgrs-pmtiles' own `centroidLabelSpecs`, since
those have no edge-oriented variant to hand off (D6).

**Decision**:
- Fetch and merge GSI's `optimal_bvmap/style/std.json`, same as
  mgrs-pmtiles' `web/main.js`. Its vector source uses `pmtiles://` URLs,
  so the `pmtiles` package's `Protocol` must be registered via
  `maplibregl.addProtocol` before the map is created — this was missed
  on the first pass and produced `URL scheme "pmtiles" is not
  supported` errors with a blank basemap; fixed by mirroring
  mgrs-pmtiles' own protocol registration.
- Add visible `mgrs_{100km,10km,1km,100m}` line layers (matching
  mgrs-pmtiles' `overlayLayers` styling: `#003399`, zoom-interpolated
  width) in place of the earlier zero-opacity "loader" layers from D5 —
  these now double as both the visible grid frame and the tile-loading
  trigger for `MgrsSourceProvider`'s `querySourceFeatures()`.
- Add the `mgrs-100km-label` symbol layer (source-layer
  `mgrs_100km_label_points`, minzoom 5–8) for the in-map alphabet
  labels. Deliberately still not adding the `*_label_{e,n}` edge symbol
  layers — those numeric values remain sidebar-only.
- On fonts: initially assumed (matching MapLibre's older
  `localIdeographFontFamily`, which is CJK-only) that omitting
  `style.glyphs` would leave the centroid labels' Latin characters
  unrendered, and considered keeping GSI's real glyphs URL to be safe.
  User feedback and research into MapLibre GL JS
  ([PR #4564](https://github.com/maplibre/maplibre-gl-js/pull/4564),
  merged 2025-10-31) confirmed that recent versions render **all**
  `text-field` content locally via TinySDF when `glyphs` is absent, not
  just CJK ranges — matching mgrs-pmtiles' own approach of omitting
  `glyphs` entirely. Verified live: `mgrs-100km-label` renders real text
  ("UQ", "VQ", "WQ", ...) with no glyphs URL configured. This required
  bumping `maplibre-gl` in the example from `^4.0.0` (resolved to
  4.7.1, released 2024-09, predates the PR) to `5.24.0` — the same
  version mgrs-pmtiles itself depends on.

**Consequence**: The example now depends on `pmtiles` and a much newer
`maplibre-gl`. The corner-reservation fix (D8) continues to apply
unchanged since it only concerns attachbar's own sidebars, not the
in-map grid/basemap.
