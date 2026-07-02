/**
 * The four sides of a map frame where annotations may be placed.
 */
export type AttachbarSide = "top" | "left" | "right" | "bottom";

/**
 * Configuration options for an attachbar instance.
 */
export interface AttachbarOptions {
  /** Which sides to render annotations on. */
  sides: AttachbarSide[];
  /** Minimum pixel distance between two labels on the same side. Default: 40. */
  minPixelSpacing?: number;
  /** Custom formatter for converting a spatial value to a display string. */
  formatter?: (
    value: unknown,
    ctx: { side: AttachbarSide; zoom: number }
  ) => string;
  /** Controls whether labels are visible at a given zoom/side. */
  visibility?: (ctx: { zoom: number; side: AttachbarSide }) => boolean;
}

/**
 * A geographic anchor provided by a SpatialProvider.
 */
export interface SpatialAnchor {
  /** Which sidebar this anchor belongs to. */
  side: AttachbarSide;
  /** Geographic coordinate [longitude, latitude]. */
  lngLat: [number, number];
  /** The value to display (e.g. a grid label). */
  value: unknown;
  /** Higher-priority anchors are preferred when spacing conflicts arise. */
  priority?: number;
}

/**
 * A SpatialAnchor that has been projected to screen-space pixel coordinates.
 */
export interface PixelAnchor {
  side: AttachbarSide;
  /** Screen-space coordinate [x, y] in pixels from the top-left of the map. */
  pixel: [number, number];
  value: unknown;
  priority?: number;
}

/**
 * Contract for any component that supplies geographic anchors to attachbar.
 */
export interface SpatialProvider {
  getAnchors(input: {
    /** Map bounds as [west, south, east, north]. */
    bounds: [number, number, number, number];
    zoom: number;
    sides: AttachbarSide[];
  }): SpatialAnchor[];
}
