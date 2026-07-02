# attachbar

A reusable UI pattern that implements the **egress** concept: projecting MapLibre internal state outside the `map div` into adjacent DOM UI layers.

## Packages

| Package | Description |
|---------|-------------|
| [`@attachbar/core`](./packages/core) | Types and anchor-filtering logic (no DOM, no MapLibre dependency) |
| [`@attachbar/dom-renderer`](./packages/dom-renderer) | Sidebar DOM management and label placement |
| [`@attachbar/maplibre-adapter`](./packages/maplibre-adapter) | MapLibre event wiring and the `createAttachbar` entry point |

## Quick start

```ts
import { createAttachbar } from "@attachbar/maplibre-adapter";

const attachbar = createAttachbar({
  map,                   // maplibregl.Map instance
  container: wrapper,    // wrapper div that also contains the map div
  provider,              // SpatialProvider implementation
  options: {
    sides: ["top", "left"],
    minPixelSpacing: 60,
    formatter: (value) => String(value),
    visibility: ({ zoom }) => zoom >= 4,
  },
});

// Later:
attachbar.update();   // force a re-render
attachbar.destroy();  // clean up listeners and DOM
```

## Examples

See [`examples/mgrs-pmtiles`](./examples/mgrs-pmtiles) for a live integration reading real MGRS grid labels from mgrs-pmtiles' vector tileset. Published at `docs/` via GitHub Pages.

## Architecture

See [HANDOVER.md](./HANDOVER.md) for the full design document, [DECISIONS.md](./DECISIONS.md) for the reasoning behind key choices, and [CHANGELOG.md](./CHANGELOG.md) for a running log of changes.

## Development

```sh
npm install
npm test       # run all package tests
npm run build  # build all packages
```
