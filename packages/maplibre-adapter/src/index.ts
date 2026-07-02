import type { Map as MaplibreMap } from "maplibre-gl";
import {
  filterAnchors,
  type AttachbarOptions,
  type SpatialProvider,
  type PixelAnchor,
} from "@attachbar/core";
import {
  createSidebars,
  renderLabels,
  destroySidebars,
  type SidebarElements,
} from "@attachbar/dom-renderer";

/** How many milliseconds to wait before processing a burst of map events. */
const DEFAULT_THROTTLE_MS = 50;

/**
 * Returns a throttled version of `fn` that executes at most once per `ms`,
 * plus a `cancel()` to drop any pending trailing call (e.g. on teardown, so
 * a throttled call scheduled just before `destroy()` doesn't fire against
 * already-removed state).
 */
function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): { run: T; cancel(): void } {
  let pending: ReturnType<typeof setTimeout> | null = null;
  let latestArgs: Parameters<T> | null = null;

  const run = ((...args: Parameters<T>) => {
    latestArgs = args;
    if (pending === null) {
      pending = setTimeout(() => {
        pending = null;
        if (latestArgs !== null) {
          fn(...latestArgs);
          latestArgs = null;
        }
      }, ms);
    }
  }) as T;

  const cancel = () => {
    if (pending !== null) {
      clearTimeout(pending);
      pending = null;
    }
    latestArgs = null;
  };

  return { run, cancel };
}

/** Parameters for {@link createAttachbar}. */
export interface CreateAttachbarParams {
  /** The MapLibre GL JS map instance. */
  map: MaplibreMap;
  /**
   * The wrapper HTMLElement that contains both the map div and the sidebar
   * overlays.  Sidebars will be appended as children of this element.
   */
  container: HTMLElement;
  /** Supplies geographic anchors from which labels are derived. */
  provider: SpatialProvider;
  /** Rendering and filtering options. */
  options?: AttachbarOptions;
}

/** Handle returned by {@link createAttachbar}. */
export interface Attachbar {
  /** Force an immediate re-render outside of the normal event cycle. */
  update(): void;
  /** Remove event listeners and DOM elements, cleaning up the instance. */
  destroy(): void;
}

/**
 * Create an attachbar instance that projects MapLibre internal state to
 * map-external DOM sidebars.
 *
 * The returned object exposes `update()` for manual refreshes and `destroy()`
 * for cleanup.
 */
export function createAttachbar({
  map,
  container,
  provider,
  options = { sides: ["top", "left"] },
}: CreateAttachbarParams): Attachbar {
  const sides = options.sides ?? ["top", "left"];
  const minPixelSpacing = options.minPixelSpacing ?? 40;

  const sidebarElements: SidebarElements = createSidebars(container, sides, options.sidebarSize);

  function update(): void {
    const bounds = map.getBounds();
    const zoom = map.getZoom();

    const boundsArray: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];

    const spatialAnchors = provider.getAnchors({
      bounds: boundsArray,
      zoom,
      sides,
    });

    // Project geographic coordinates to screen-space pixels
    const pixelAnchors: PixelAnchor[] = spatialAnchors.map((a) => {
      const point = map.project(a.lngLat);
      return {
        side: a.side,
        pixel: [point.x, point.y] as [number, number],
        value: a.value,
        priority: a.priority,
      };
    });

    // Enforce minimum label spacing
    const filtered = filterAnchors(pixelAnchors, { minPixelSpacing });

    renderLabels(sidebarElements, filtered, {
      zoom,
      formatter: options.formatter,
      visibility: options.visibility,
    });
  }

  const throttled = throttle(update as (...args: unknown[]) => void, DEFAULT_THROTTLE_MS);
  const throttledUpdate = throttled.run as typeof update;

  map.on("move", throttledUpdate);
  map.on("zoom", throttledUpdate);
  map.on("resize", throttledUpdate);

  // Trigger an initial render once the map is ready
  if (map.loaded()) {
    update();
  } else {
    map.once("load", update);
  }

  function destroy(): void {
    map.off("move", throttledUpdate);
    map.off("zoom", throttledUpdate);
    map.off("resize", throttledUpdate);
    map.off("load", update);
    throttled.cancel();
    destroySidebars(container, sidebarElements);
  }

  return { update, destroy };
}

// Re-export core types for convenience
export type {
  AttachbarSide,
  AttachbarOptions,
  SpatialAnchor,
  SpatialProvider,
  PixelAnchor,
} from "@attachbar/core";
