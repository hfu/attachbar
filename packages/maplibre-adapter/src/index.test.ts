import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAttachbar } from "./index.js";
import type { SpatialAnchor, SpatialProvider } from "@attachbar/core";

// ---------------------------------------------------------------------------
// Minimal MapLibre map stub
// ---------------------------------------------------------------------------

type MapEventHandler = (...args: unknown[]) => void;

function makeMapStub(overrides: Partial<ReturnType<typeof buildMapStub>> = {}) {
  return { ...buildMapStub(), ...overrides };
}

function buildMapStub() {
  const handlers = new Map<string, Set<MapEventHandler>>();

  return {
    getBounds: vi.fn(() => ({
      getWest: () => -180,
      getSouth: () => -85,
      getEast: () => 180,
      getNorth: () => 85,
    })),
    getZoom: vi.fn(() => 8),
    project: vi.fn(([lng, lat]: [number, number]) => ({ x: lng + 180, y: lat + 90 })),
    loaded: vi.fn(() => true),
    on: vi.fn((event: string, handler: MapEventHandler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: MapEventHandler) => {
      handlers.get(event)?.delete(handler);
    }),
    once: vi.fn((event: string, handler: MapEventHandler) => {
      handler();
    }),
    /** Helper for tests – fire a fake event. */
    emit(event: string) {
      handlers.get(event)?.forEach((h) => h());
    },
    _handlers: handlers,
  };
}

// ---------------------------------------------------------------------------
// Minimal SpatialProvider stub
// ---------------------------------------------------------------------------

function makeProvider(anchors: SpatialAnchor[] = []): SpatialProvider {
  return { getAnchors: vi.fn(() => anchors) };
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function makeContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

function cleanup(el: HTMLElement) {
  if (el.parentNode) el.parentNode.removeChild(el);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createAttachbar", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  it("creates sidebar DOM elements for requested sides", () => {
    const map = makeMapStub();
    const attachbar = createAttachbar({
      map: map as never,
      container,
      provider: makeProvider(),
      options: { sides: ["top", "left"] },
    });

    const topSidebar = container.querySelector("[data-attachbar-side='top']");
    const leftSidebar = container.querySelector("[data-attachbar-side='left']");
    expect(topSidebar).not.toBeNull();
    expect(leftSidebar).not.toBeNull();

    attachbar.destroy();
    cleanup(container);
  });

  it("subscribes to map move, zoom, and resize events", () => {
    const map = makeMapStub();
    const attachbar = createAttachbar({
      map: map as never,
      container,
      provider: makeProvider(),
      options: { sides: ["top"] },
    });

    expect(map.on).toHaveBeenCalledWith("move", expect.any(Function));
    expect(map.on).toHaveBeenCalledWith("zoom", expect.any(Function));
    expect(map.on).toHaveBeenCalledWith("resize", expect.any(Function));

    attachbar.destroy();
    cleanup(container);
  });

  it("unsubscribes from map events on destroy", () => {
    const map = makeMapStub();
    const attachbar = createAttachbar({
      map: map as never,
      container,
      provider: makeProvider(),
      options: { sides: ["top"] },
    });

    attachbar.destroy();

    expect(map.off).toHaveBeenCalledWith("move", expect.any(Function));
    expect(map.off).toHaveBeenCalledWith("zoom", expect.any(Function));
    expect(map.off).toHaveBeenCalledWith("resize", expect.any(Function));

    cleanup(container);
  });

  it("removes sidebar DOM elements on destroy", () => {
    const map = makeMapStub();
    const attachbar = createAttachbar({
      map: map as never,
      container,
      provider: makeProvider(),
      options: { sides: ["top", "left"] },
    });

    attachbar.destroy();

    expect(container.children).toHaveLength(0);
    cleanup(container);
  });

  it("calls provider.getAnchors during initial update", () => {
    const provider = makeProvider();
    const map = makeMapStub();

    const attachbar = createAttachbar({
      map: map as never,
      container,
      provider,
      options: { sides: ["top"] },
    });

    expect(provider.getAnchors).toHaveBeenCalledTimes(1);
    const call = (provider.getAnchors as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call).toMatchObject({
      bounds: [-180, -85, 180, 85],
      zoom: 8,
      sides: ["top"],
    });

    attachbar.destroy();
    cleanup(container);
  });

  it("renders labels from provider anchors into the sidebar", () => {
    const anchors: SpatialAnchor[] = [
      { side: "top", lngLat: [10, 45], value: "10E" },
      { side: "top", lngLat: [20, 45], value: "20E" },
    ];
    const provider = makeProvider(anchors);
    const map = makeMapStub();
    // Space out the projections so minPixelSpacing is satisfied
    map.project = vi.fn(([lng, lat]: [number, number]) => ({
      x: (lng + 180) * 5,
      y: lat + 90,
    }));

    const attachbar = createAttachbar({
      map: map as never,
      container,
      provider,
      options: { sides: ["top"], minPixelSpacing: 40 },
    });

    const labels = container.querySelectorAll(".attachbar-label");
    expect(labels.length).toBeGreaterThanOrEqual(1);

    attachbar.destroy();
    cleanup(container);
  });

  it("update() method triggers a fresh render", () => {
    const provider = makeProvider();
    const map = makeMapStub();

    const attachbar = createAttachbar({
      map: map as never,
      container,
      provider,
      options: { sides: ["top"] },
    });

    const callsBefore = (provider.getAnchors as ReturnType<typeof vi.fn>).mock.calls.length;
    attachbar.update();
    const callsAfter = (provider.getAnchors as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(callsAfter).toBe(callsBefore + 1);

    attachbar.destroy();
    cleanup(container);
  });

  it("waits for load event when map is not yet loaded", () => {
    const map = makeMapStub({ loaded: vi.fn(() => false) });
    const provider = makeProvider();

    const attachbar = createAttachbar({
      map: map as never,
      container,
      provider,
      options: { sides: ["top"] },
    });

    // map.once("load", ...) stub calls the callback immediately in our mock
    expect(map.once).toHaveBeenCalledWith("load", expect.any(Function));
    expect(provider.getAnchors).toHaveBeenCalledTimes(1);

    attachbar.destroy();
    cleanup(container);
  });

  it("applies formatter to rendered labels", () => {
    const anchors: SpatialAnchor[] = [
      { side: "top", lngLat: [10, 45], value: 10 },
    ];
    const map = makeMapStub();
    map.project = vi.fn(() => ({ x: 100, y: 50 }));

    const attachbar = createAttachbar({
      map: map as never,
      container,
      provider: makeProvider(anchors),
      options: {
        sides: ["top"],
        formatter: (v) => `${v}°`,
      },
    });

    const label = container.querySelector(".attachbar-label");
    expect(label?.textContent).toBe("10°");

    attachbar.destroy();
    cleanup(container);
  });

  it("applies visibility callback and hides all labels when false", () => {
    const anchors: SpatialAnchor[] = [
      { side: "top", lngLat: [10, 45], value: "X" },
    ];
    const map = makeMapStub();
    map.project = vi.fn(() => ({ x: 100, y: 50 }));

    const attachbar = createAttachbar({
      map: map as never,
      container,
      provider: makeProvider(anchors),
      options: {
        sides: ["top"],
        visibility: () => false,
      },
    });

    const labels = container.querySelectorAll(".attachbar-label");
    expect(labels).toHaveLength(0);

    attachbar.destroy();
    cleanup(container);
  });

  it("defaults to top and left sides when options are omitted", () => {
    const map = makeMapStub();

    const attachbar = createAttachbar({
      map: map as never,
      container,
      provider: makeProvider(),
    });

    const top = container.querySelector("[data-attachbar-side='top']");
    const left = container.querySelector("[data-attachbar-side='left']");
    expect(top).not.toBeNull();
    expect(left).not.toBeNull();

    attachbar.destroy();
    cleanup(container);
  });
});
