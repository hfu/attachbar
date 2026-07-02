import maplibregl from "maplibre-gl";
import { createAttachbar } from "@attachbar/maplibre-adapter";
import { MgrsSourceProvider, MGRS_SOURCE_ID } from "./mgrs-source-provider.js";

// ---------------------------------------------------------------------------
// Map setup
// ---------------------------------------------------------------------------

// Same martin-served MGRS vector tiles that mgrs-pmtiles' own web viewer
// renders in-map (see mgrs-pmtiles/web/main.js). attachbar reuses this data
// as its SpatialProvider source instead of re-deriving grid geometry.
const MGRS_TILEJSON = "https://tunnel.optgeo.org/martin/mgrs-hokkaido";

// Style layer maxzoom is exclusive, so this is data maxzoom + 1 — mirrors
// mgrs-pmtiles' own `gridZoomBands`.
const GRID_ZOOM_BANDS: Record<string, { minzoom: number; maxzoom: number }> = {
  mgrs_100km: { minzoom: 3, maxzoom: 8 },
  mgrs_10km: { minzoom: 8, maxzoom: 11 },
  mgrs_1km: { minzoom: 11, maxzoom: 15 },
  mgrs_100m: { minzoom: 15, maxzoom: 22 },
};

const wrapper = document.getElementById("wrapper") as HTMLElement;
const mapEl = document.getElementById("map") as HTMLElement;

const map = new maplibregl.Map({
  container: mapEl,
  style: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm",
      },
    ],
  },
  // Hokkaido — the primary proving ground for MGRS marginal labels (see
  // HANDOVER.md §3) and the area covered by the mgrs-hokkaido tileset.
  center: [141.3545, 43.0618],
  zoom: 9,
});

map.on("load", () => {
  map.addSource(MGRS_SOURCE_ID, {
    type: "vector",
    url: MGRS_TILEJSON,
    maxzoom: 16,
  });

  // Invisible lines purely to make MapLibre fetch tiles for this source
  // across the full zoom range. The grid itself is never drawn in-map —
  // egress means its values are projected out to attachbar's sidebars
  // instead (contrast with mgrs-pmtiles' own in-map grid + edge-detection
  // hack in web/main.js, which this example intentionally leaves alone).
  for (const [sourceLayer, band] of Object.entries(GRID_ZOOM_BANDS)) {
    map.addLayer({
      id: `${sourceLayer}-loader`,
      type: "line",
      source: MGRS_SOURCE_ID,
      "source-layer": sourceLayer,
      minzoom: band.minzoom,
      maxzoom: band.maxzoom,
      paint: { "line-opacity": 0 },
    });
  }
});

// ---------------------------------------------------------------------------
// attachbar setup
// ---------------------------------------------------------------------------

const attachbar = createAttachbar({
  map,
  container: wrapper,
  provider: new MgrsSourceProvider(map),
  options: {
    sides: ["top", "left"],
    minPixelSpacing: 60,
    formatter: (value) => String(value),
    visibility: ({ zoom }) => zoom >= 8,
  },
});

// Grid tiles stream in asynchronously; re-render as they arrive so labels
// appear as soon as querySourceFeatures has data, not just on the next
// move/zoom.
map.on("sourcedata", (e) => {
  if (e.sourceId === MGRS_SOURCE_ID && e.isSourceLoaded) {
    attachbar.update();
  }
});

// Expose to console for interactive debugging
(window as Record<string, unknown>).attachbar = attachbar;
(window as Record<string, unknown>).map = map;
