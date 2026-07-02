import type { MapGeoJSONFeature } from "maplibre-gl";
import type { SpatialAnchor, SpatialProvider, AttachbarSide } from "@attachbar/maplibre-adapter";

/** Vector source id used for the shared MGRS grid data (see main.ts). */
export const MGRS_SOURCE_ID = "mgrs-pmtiles";

interface PrecisionBand {
  minzoom: number;
  eastingLayer: string;
  northingLayer: string;
}

/**
 * Mirrors the zoom bands mgrs-pmtiles' own web/main.js uses for its edge
 * label layers (see `gridZoomBands` / `edgeLabelSpecs` there), ordered from
 * finest to coarsest so the first band whose minzoom is satisfied wins.
 */
const PRECISION_BANDS: PrecisionBand[] = [
  { minzoom: 15, eastingLayer: "mgrs_100m_label_e", northingLayer: "mgrs_100m_label_n" },
  { minzoom: 11, eastingLayer: "mgrs_1km_label_e", northingLayer: "mgrs_1km_label_n" },
  { minzoom: 8, eastingLayer: "mgrs_10km_label_e", northingLayer: "mgrs_10km_label_n" },
];

function pickBand(zoom: number): PrecisionBand | null {
  for (const band of PRECISION_BANDS) {
    if (zoom >= band.minzoom) return band;
  }
  return null;
}

/** Minimal surface of maplibregl.Map this provider depends on (for testing). */
export interface SourceFeatureQueryable {
  querySourceFeatures(
    sourceId: string,
    params?: { sourceLayer: string }
  ): MapGeoJSONFeature[];
}

/**
 * A SpatialProvider that reuses the same MGRS vector tiles mgrs-pmtiles
 * renders in-map (the martin endpoint) as its source of truth, rather than
 * re-deriving grid geometry independently.
 *
 * mgrs-pmtiles pre-generates one label point per grid-line crossing per
 * tile in its "*_label_e" (easting, conceptually a top-edge ruler value)
 * and "*_label_n" (northing, left-edge ruler value) layers. Those points
 * are scattered across the whole viewport, not just near the frame edge —
 * mgrs-pmtiles' own UI used to pick out the near-edge ones by rendered
 * screen position. Here we instead keep every distinct grid line and let
 * attachbar's `filterAnchors` + external sidebars do the decluttering, but
 * still prefer the instance closest to the relevant edge when a grid line
 * crosses multiple loaded tiles.
 */
export class MgrsSourceProvider implements SpatialProvider {
  constructor(private readonly map: SourceFeatureQueryable) {}

  getAnchors({
    bounds,
    zoom,
    sides,
  }: {
    bounds: [number, number, number, number];
    zoom: number;
    sides: AttachbarSide[];
  }): SpatialAnchor[] {
    const band = pickBand(zoom);
    if (!band) return [];

    const anchors: SpatialAnchor[] = [];
    if (sides.includes("top")) {
      anchors.push(...this.collectEdge(band.eastingLayer, bounds, "top"));
    }
    if (sides.includes("left")) {
      anchors.push(...this.collectEdge(band.northingLayer, bounds, "left"));
    }
    return anchors;
  }

  private collectEdge(
    sourceLayer: string,
    bounds: [number, number, number, number],
    side: Extract<AttachbarSide, "top" | "left">
  ): SpatialAnchor[] {
    const [west, south, east, north] = bounds;

    let features: MapGeoJSONFeature[];
    try {
      features = this.map.querySourceFeatures(MGRS_SOURCE_ID, { sourceLayer });
    } catch {
      return [];
    }

    // Deduplicate by grid id, keeping whichever loaded instance sits
    // closest to the edge this side represents (top → nearest the north
    // bound, left → nearest the west bound).
    const best = new Map<string, { anchor: SpatialAnchor; distance: number }>();

    for (const feature of features) {
      if (feature.geometry.type !== "Point") continue;
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      if (lng < west || lng > east || lat < south || lat > north) continue;

      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const key = String(props.mgrs ?? props.label ?? `${lng},${lat}`);
      const distance = side === "top" ? Math.abs(north - lat) : Math.abs(lng - west);

      const existing = best.get(key);
      if (existing && existing.distance <= distance) continue;

      best.set(key, {
        distance,
        anchor: {
          side,
          lngLat: [lng, lat],
          value: props.label ?? key,
        },
      });
    }

    return Array.from(best.values(), (entry) => entry.anchor);
  }
}
