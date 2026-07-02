import type { SpatialAnchor, SpatialProvider } from "@attachbar/maplibre-adapter";

/**
 * A mock SpatialProvider that generates evenly-spaced longitude labels along
 * the top edge and latitude labels along the left edge of the current view.
 *
 * This stands in for a real MGRS grid provider during M1 development.
 */
export class MockMgrsProvider implements SpatialProvider {
  private readonly intervalDeg: number;

  constructor(intervalDeg = 10) {
    this.intervalDeg = intervalDeg;
  }

  getAnchors({
    bounds,
    zoom,
    sides,
  }: {
    bounds: [number, number, number, number];
    zoom: number;
    sides: string[];
  }): SpatialAnchor[] {
    const [west, south, east, north] = bounds;
    const interval = this.getInterval(zoom);
    const anchors: SpatialAnchor[] = [];

    if (sides.includes("top")) {
      // Longitude labels along the top edge
      const startLng = Math.ceil(west / interval) * interval;
      for (let lng = startLng; lng <= east; lng += interval) {
        anchors.push({
          side: "top",
          lngLat: [lng, north],
          value: `${Math.abs(lng)}°${lng >= 0 ? "E" : "W"}`,
        });
      }
    }

    if (sides.includes("left")) {
      // Latitude labels along the left edge
      const startLat = Math.ceil(south / interval) * interval;
      for (let lat = startLat; lat <= north; lat += interval) {
        anchors.push({
          side: "left",
          lngLat: [west, lat],
          value: `${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}`,
        });
      }
    }

    return anchors;
  }

  private getInterval(zoom: number): number {
    if (zoom >= 10) return 1;
    if (zoom >= 7) return 2;
    if (zoom >= 5) return 5;
    return this.intervalDeg;
  }
}
