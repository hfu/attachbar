import maplibregl from "maplibre-gl";
import { createAttachbar } from "@attachbar/maplibre-adapter";
import { MockMgrsProvider } from "./mock-provider.js";

// ---------------------------------------------------------------------------
// Map setup
// ---------------------------------------------------------------------------

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
  center: [0, 30],
  zoom: 4,
});

// ---------------------------------------------------------------------------
// attachbar setup
// ---------------------------------------------------------------------------

const attachbar = createAttachbar({
  map,
  container: wrapper,
  provider: new MockMgrsProvider(),
  options: {
    sides: ["top", "left"],
    minPixelSpacing: 60,
    formatter: (value) => String(value),
    visibility: ({ zoom }) => zoom >= 2,
  },
});

// Expose to console for interactive debugging
(window as Record<string, unknown>).attachbar = attachbar;
(window as Record<string, unknown>).map = map;
