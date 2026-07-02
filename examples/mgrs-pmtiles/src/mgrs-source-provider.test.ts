import { describe, it, expect, vi } from "vitest";
import { MgrsSourceProvider, MGRS_SOURCE_ID, type SourceFeatureQueryable } from "./mgrs-source-provider.js";
import type { MapGeoJSONFeature } from "maplibre-gl";

function feature(
  lngLat: [number, number],
  props: Record<string, unknown>
): MapGeoJSONFeature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: lngLat },
    properties: props,
  } as unknown as MapGeoJSONFeature;
}

function makeMapStub(bySourceLayer: Record<string, MapGeoJSONFeature[]>): SourceFeatureQueryable {
  return {
    querySourceFeatures: vi.fn((sourceId: string, params?: { sourceLayer: string }) => {
      expect(sourceId).toBe(MGRS_SOURCE_ID);
      return bySourceLayer[params?.sourceLayer ?? ""] ?? [];
    }),
  };
}

const HOKKAIDO_BOUNDS: [number, number, number, number] = [140, 42, 143, 44];

describe("MgrsSourceProvider", () => {
  it("returns no anchors below the coarsest precision band's minzoom", () => {
    const map = makeMapStub({});
    const provider = new MgrsSourceProvider(map);

    const anchors = provider.getAnchors({ bounds: HOKKAIDO_BOUNDS, zoom: 7.9, sides: ["top", "left"] });

    expect(anchors).toEqual([]);
    expect(map.querySourceFeatures).not.toHaveBeenCalled();
  });

  it("queries the 10km label layers between zoom 8 and 11", () => {
    const map = makeMapStub({
      mgrs_10km_label_e: [feature([141, 44], { mgrs: "54TWN07", label: "07" })],
    });
    const provider = new MgrsSourceProvider(map);

    provider.getAnchors({ bounds: HOKKAIDO_BOUNDS, zoom: 9, sides: ["top"] });

    expect(map.querySourceFeatures).toHaveBeenCalledWith(MGRS_SOURCE_ID, {
      sourceLayer: "mgrs_10km_label_e",
    });
  });

  it("queries the 1km label layers between zoom 11 and 15", () => {
    const map = makeMapStub({ mgrs_1km_label_n: [] });
    const provider = new MgrsSourceProvider(map);

    provider.getAnchors({ bounds: HOKKAIDO_BOUNDS, zoom: 12, sides: ["left"] });

    expect(map.querySourceFeatures).toHaveBeenCalledWith(MGRS_SOURCE_ID, {
      sourceLayer: "mgrs_1km_label_n",
    });
  });

  it("queries the 100m label layers at zoom 15 and above", () => {
    const map = makeMapStub({ mgrs_100m_label_e: [] });
    const provider = new MgrsSourceProvider(map);

    provider.getAnchors({ bounds: HOKKAIDO_BOUNDS, zoom: 16, sides: ["top"] });

    expect(map.querySourceFeatures).toHaveBeenCalledWith(MGRS_SOURCE_ID, {
      sourceLayer: "mgrs_100m_label_e",
    });
  });

  it("maps 'top' to easting (-e) layers and 'left' to northing (-n) layers", () => {
    const map = makeMapStub({ mgrs_10km_label_e: [], mgrs_10km_label_n: [] });
    const provider = new MgrsSourceProvider(map);

    provider.getAnchors({ bounds: HOKKAIDO_BOUNDS, zoom: 9, sides: ["top", "left"] });

    expect(map.querySourceFeatures).toHaveBeenCalledWith(MGRS_SOURCE_ID, {
      sourceLayer: "mgrs_10km_label_e",
    });
    expect(map.querySourceFeatures).toHaveBeenCalledWith(MGRS_SOURCE_ID, {
      sourceLayer: "mgrs_10km_label_n",
    });
  });

  it("drops features outside the current bounds", () => {
    const map = makeMapStub({
      mgrs_10km_label_e: [
        feature([141, 44], { mgrs: "in-bounds", label: "in" }),
        feature([160, 44], { mgrs: "out-of-bounds", label: "out" }),
      ],
    });
    const provider = new MgrsSourceProvider(map);

    const anchors = provider.getAnchors({ bounds: HOKKAIDO_BOUNDS, zoom: 9, sides: ["top"] });

    expect(anchors).toHaveLength(1);
    expect(anchors[0].value).toBe("in");
  });

  it("deduplicates repeated grid lines, keeping the instance closest to the edge", () => {
    // Same easting grid line ("mgrs" id) crossed by two tiles at different
    // latitudes; the one nearer the north bound (43.9) should win for "top".
    const map = makeMapStub({
      mgrs_10km_label_e: [
        feature([141, 42.5], { mgrs: "54TWN07", label: "07" }),
        feature([141, 43.9], { mgrs: "54TWN07", label: "07" }),
      ],
    });
    const provider = new MgrsSourceProvider(map);

    const anchors = provider.getAnchors({ bounds: HOKKAIDO_BOUNDS, zoom: 9, sides: ["top"] });

    expect(anchors).toHaveLength(1);
    expect(anchors[0].lngLat).toEqual([141, 43.9]);
  });

  it("deduplicates repeated grid lines for 'left', keeping the instance closest to the west bound", () => {
    const map = makeMapStub({
      mgrs_10km_label_n: [
        feature([142.5, 43], { mgrs: "54TWN26", label: "26" }),
        feature([140.1, 43], { mgrs: "54TWN26", label: "26" }),
      ],
    });
    const provider = new MgrsSourceProvider(map);

    const anchors = provider.getAnchors({ bounds: HOKKAIDO_BOUNDS, zoom: 9, sides: ["left"] });

    expect(anchors).toHaveLength(1);
    expect(anchors[0].lngLat).toEqual([140.1, 43]);
  });

  it("ignores non-Point features", () => {
    const lineFeature = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[141, 43], [141, 44]] },
      properties: { mgrs: "x" },
    } as unknown as MapGeoJSONFeature;
    const map = makeMapStub({ mgrs_10km_label_e: [lineFeature] });
    const provider = new MgrsSourceProvider(map);

    const anchors = provider.getAnchors({ bounds: HOKKAIDO_BOUNDS, zoom: 9, sides: ["top"] });

    expect(anchors).toEqual([]);
  });

  it("falls back to the mgrs id as the label when 'label' is missing", () => {
    const map = makeMapStub({
      mgrs_10km_label_e: [feature([141, 44], { mgrs: "54TWN07" })],
    });
    const provider = new MgrsSourceProvider(map);

    const anchors = provider.getAnchors({ bounds: HOKKAIDO_BOUNDS, zoom: 9, sides: ["top"] });

    expect(anchors[0].value).toBe("54TWN07");
  });

  it("swallows querySourceFeatures errors (e.g. source not yet loaded) and returns no anchors", () => {
    const map: SourceFeatureQueryable = {
      querySourceFeatures: vi.fn(() => {
        throw new Error("source not loaded");
      }),
    };
    const provider = new MgrsSourceProvider(map);

    const anchors = provider.getAnchors({ bounds: HOKKAIDO_BOUNDS, zoom: 9, sides: ["top", "left"] });

    expect(anchors).toEqual([]);
  });
});
