import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { createAttachbar } from "@attachbar/maplibre-adapter";
import { MgrsSourceProvider, MGRS_SOURCE_ID } from "./mgrs-source-provider.js";

// GSI's optimal_bvmap style references pmtiles:// source URLs — register
// the protocol handler before creating the map, same as mgrs-pmtiles'
// own web/main.js.
try {
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
} catch (error) {
  console.error("Failed to initialize PMTiles protocol", error);
}

// ---------------------------------------------------------------------------
// Map setup
// ---------------------------------------------------------------------------

// Same martin-served MGRS vector tiles that mgrs-pmtiles' own web viewer
// renders in-map (see mgrs-pmtiles/web/main.js). attachbar reuses this data
// as its SpatialProvider source instead of re-deriving grid geometry.
const MGRS_TILEJSON = "https://tunnel.optgeo.org/martin/mgrs-hokkaido";

// GSI (国土地理院) optimal vector tile basemap — same style mgrs-pmtiles'
// own web/main.js uses, instead of a generic OSM raster tile.
const GSI_STYLE_URL = "https://gsi-cyberjapan.github.io/optimal_bvmap/style/std.json";

// Style layer maxzoom is exclusive, so this is data maxzoom + 1 — mirrors
// mgrs-pmtiles' own `gridZoomBands`.
const GRID_ZOOM_BANDS: Record<string, { minzoom: number; maxzoom: number }> = {
  mgrs_100km: { minzoom: 3, maxzoom: 8 },
  mgrs_10km: { minzoom: 8, maxzoom: 11 },
  mgrs_1km: { minzoom: 11, maxzoom: 15 },
  mgrs_100m: { minzoom: 15, maxzoom: 22 },
};

const GRID_LINE_COLOR = "#003399";

const wrapper = document.getElementById("wrapper") as HTMLElement;
const mapEl = document.getElementById("map") as HTMLElement;

async function main(): Promise<void> {
  const style: maplibregl.StyleSpecification = {
    version: 8,
    sources: {},
    layers: [],
  };

  try {
    const gsiResponse = await fetch(GSI_STYLE_URL);
    const gsiStyle = await gsiResponse.json();
    if (gsiStyle.sources) style.sources = { ...gsiStyle.sources, ...style.sources };
    if (gsiStyle.layers) style.layers = [...gsiStyle.layers, ...style.layers];
    if (gsiStyle.sprite) style.sprite = gsiStyle.sprite;
    // Deliberately not carrying over gsiStyle.glyphs — mirrors
    // mgrs-pmtiles' own web/main.js, which relies on the browser's local
    // fonts instead of fetching a remote glyphs PBF endpoint.
  } catch (error) {
    console.error("Failed to load GSI basemap style", error);
  }

  const map = new maplibregl.Map({
    container: mapEl,
    style,
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

    // Visible grid frame lines (100km/10km/1km/100m), matching
    // mgrs-pmtiles' own `overlayLayers` styling. These also make MapLibre
    // fetch tiles for the source across the full zoom range, which is
    // what MgrsSourceProvider's querySourceFeatures() reads from.
    //
    // Deliberately not added: mgrs-pmtiles' edge-label symbol layers
    // (mgrs_{10km,1km,100m}_label_{e,n}). Those numeric values are
    // attachbar's job — shown only in the external sidebars, never
    // drawn in-map. This is the "after" to mgrs-pmtiles' in-map "before".
    for (const [sourceLayer, band] of Object.entries(GRID_ZOOM_BANDS)) {
      map.addLayer({
        id: `${sourceLayer}-line`,
        type: "line",
        source: MGRS_SOURCE_ID,
        "source-layer": sourceLayer,
        minzoom: band.minzoom,
        maxzoom: band.maxzoom,
        paint: {
          "line-color": GRID_LINE_COLOR,
          "line-opacity": sourceLayer === "mgrs_100m" ? 0.75 : 1,
          "line-width": ["interpolate", ["linear"], ["zoom"], band.minzoom, 0.4, band.maxzoom, 1.6],
        },
      });
    }

    // 100km-square centroid labels ("alphabet" grid square IDs, e.g. "VN")
    // are the one MGRS annotation that stays in-map: they have no
    // edge-oriented variant to hand off to attachbar (see DECISIONS.md
    // D6), and they read naturally as area labels rather than marginal
    // ruler values.
    map.addLayer({
      id: "mgrs-100km-label",
      type: "symbol",
      source: MGRS_SOURCE_ID,
      "source-layer": "mgrs_100km_label_points",
      minzoom: 5,
      maxzoom: GRID_ZOOM_BANDS.mgrs_100km.maxzoom,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Open Sans", "Arial", "sans-serif"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 8, 6, 12, 7, 16, 8, 20],
        "text-allow-overlap": true,
        "text-anchor": "center",
        "text-justify": "center",
      },
      paint: {
        "text-color": GRID_LINE_COLOR,
        "text-opacity": 0.92,
      },
    });
  });

  // -------------------------------------------------------------------------
  // attachbar setup
  // -------------------------------------------------------------------------

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
}

main();
