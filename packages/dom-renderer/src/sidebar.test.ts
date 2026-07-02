import { describe, it, expect, beforeEach } from "vitest";
import { createSidebars, renderLabels, destroySidebars } from "./sidebar.js";
import type { PixelAnchor } from "@attachbar/core";

function makeContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

function cleanup(container: HTMLElement) {
  document.body.removeChild(container);
}

describe("createSidebars", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  it("creates a sidebar element for each requested side", () => {
    const elements = createSidebars(container, ["top", "left"]);
    expect(elements.top).toBeDefined();
    expect(elements.left).toBeDefined();
    expect(elements.right).toBeUndefined();
    expect(elements.bottom).toBeUndefined();
    cleanup(container);
  });

  it("appends sidebar elements to the container", () => {
    createSidebars(container, ["top", "left"]);
    const children = Array.from(container.children);
    expect(children).toHaveLength(2);
    cleanup(container);
  });

  it("sets the correct data-attachbar-side attribute", () => {
    const elements = createSidebars(container, ["top", "left"]);
    expect(elements.top!.dataset.attachbarSide).toBe("top");
    expect(elements.left!.dataset.attachbarSide).toBe("left");
    cleanup(container);
  });

  it("assigns CSS class names", () => {
    const elements = createSidebars(container, ["top"]);
    expect(elements.top!.className).toContain("attachbar-sidebar");
    expect(elements.top!.className).toContain("attachbar-sidebar--top");
    cleanup(container);
  });

  it("sets position:absolute on sidebar elements", () => {
    const elements = createSidebars(container, ["top"]);
    expect(elements.top!.style.position).toBe("absolute");
    cleanup(container);
  });

  it("makes container position relative when it is static", () => {
    container.style.position = "";
    createSidebars(container, ["top"]);
    expect(container.style.position).toBe("relative");
    cleanup(container);
  });

  it("does not override container position when already set", () => {
    container.style.position = "absolute";
    createSidebars(container, ["top"]);
    expect(container.style.position).toBe("absolute");
    cleanup(container);
  });

  it("supports all four sides", () => {
    const elements = createSidebars(container, [
      "top",
      "bottom",
      "left",
      "right",
    ]);
    expect(Object.keys(elements)).toHaveLength(4);
    cleanup(container);
  });

  it("applies default sidebar sizes as inline style and dataset", () => {
    const elements = createSidebars(container, ["top", "left"]);
    expect(elements.top!.style.height).toBe("32px");
    expect(elements.top!.dataset.attachbarSize).toBe("32");
    expect(elements.left!.style.width).toBe("48px");
    expect(elements.left!.dataset.attachbarSize).toBe("48");
    cleanup(container);
  });

  it("applies custom sidebar sizes when provided", () => {
    const elements = createSidebars(container, ["top", "left"], { top: 24, left: 60 });
    expect(elements.top!.style.height).toBe("24px");
    expect(elements.left!.style.width).toBe("60px");
    cleanup(container);
  });
});

describe("renderLabels", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  function makeAnchor(
    side: PixelAnchor["side"],
    px: number,
    py: number,
    value: unknown = "label"
  ): PixelAnchor {
    return { side, pixel: [px, py], value };
  }

  it("renders a label for each anchor in the matching sidebar", () => {
    const elements = createSidebars(container, ["top"]);
    renderLabels(elements, [makeAnchor("top", 100, 0, "A")], { zoom: 10 });
    const labels = elements.top!.querySelectorAll(".attachbar-label");
    expect(labels).toHaveLength(1);
    cleanup(container);
  });

  it("uses String(value) as default label text", () => {
    const elements = createSidebars(container, ["top"]);
    renderLabels(elements, [makeAnchor("top", 100, 0, 42)], { zoom: 10 });
    const label = elements.top!.querySelector(".attachbar-label")!;
    expect(label.textContent).toBe("42");
    cleanup(container);
  });

  it("applies custom formatter", () => {
    const elements = createSidebars(container, ["top"]);
    renderLabels(elements, [makeAnchor("top", 100, 0, 42)], {
      zoom: 10,
      formatter: (v) => `(${v})`,
    });
    const label = elements.top!.querySelector(".attachbar-label")!;
    expect(label.textContent).toBe("(42)");
    cleanup(container);
  });

  it("positions top-side label using pixel x as left", () => {
    const elements = createSidebars(container, ["top"]);
    renderLabels(elements, [makeAnchor("top", 123, 0)], { zoom: 10 });
    const label = elements.top!.querySelector<HTMLElement>(".attachbar-label")!;
    expect(label.style.left).toBe("123px");
    expect(label.style.top).toBe("50%");
    cleanup(container);
  });

  it("positions left-side label using pixel y as top", () => {
    const elements = createSidebars(container, ["left"]);
    renderLabels(elements, [makeAnchor("left", 0, 456)], { zoom: 10 });
    const label = elements.left!.querySelector<HTMLElement>(".attachbar-label")!;
    expect(label.style.top).toBe("456px");
    expect(label.style.left).toBe("50%");
    cleanup(container);
  });

  it("clears previous labels on each render call (idempotent)", () => {
    const elements = createSidebars(container, ["top"]);
    renderLabels(elements, [makeAnchor("top", 10, 0)], { zoom: 10 });
    renderLabels(elements, [makeAnchor("top", 10, 0)], { zoom: 10 });
    const labels = elements.top!.querySelectorAll(".attachbar-label");
    expect(labels).toHaveLength(1);
    cleanup(container);
  });

  it("skips anchors whose side has no sidebar element", () => {
    const elements = createSidebars(container, ["top"]);
    // No "left" sidebar — should not throw
    expect(() =>
      renderLabels(elements, [makeAnchor("left", 0, 100)], { zoom: 10 })
    ).not.toThrow();
    cleanup(container);
  });

  it("respects visibility callback and hides labels", () => {
    const elements = createSidebars(container, ["top"]);
    renderLabels(elements, [makeAnchor("top", 100, 0)], {
      zoom: 5,
      visibility: () => false,
    });
    const labels = elements.top!.querySelectorAll(".attachbar-label");
    expect(labels).toHaveLength(0);
    cleanup(container);
  });

  it("sets data-attachbar-value attribute on each label", () => {
    const elements = createSidebars(container, ["top"]);
    renderLabels(elements, [makeAnchor("top", 100, 0, "X")], { zoom: 10 });
    const label = elements.top!.querySelector<HTMLElement>(".attachbar-label")!;
    expect(label.dataset.attachbarValue).toBe("X");
    cleanup(container);
  });

  describe("corner reservation", () => {
    it("drops a top-side label that falls inside the left sidebar's width when both exist", () => {
      // Default sizes: left = 48px wide.
      const elements = createSidebars(container, ["top", "left"]);
      renderLabels(elements, [makeAnchor("top", 30, 0, "corner")], { zoom: 10 });
      const labels = elements.top!.querySelectorAll(".attachbar-label");
      expect(labels).toHaveLength(0);
      cleanup(container);
    });

    it("drops a left-side label that falls inside the top sidebar's height when both exist", () => {
      // Default sizes: top = 32px tall.
      const elements = createSidebars(container, ["top", "left"]);
      renderLabels(elements, [makeAnchor("left", 0, 20, "corner")], { zoom: 10 });
      const labels = elements.left!.querySelectorAll(".attachbar-label");
      expect(labels).toHaveLength(0);
      cleanup(container);
    });

    it("keeps a top-side label outside the reserved corner", () => {
      const elements = createSidebars(container, ["top", "left"]);
      renderLabels(elements, [makeAnchor("top", 60, 0, "clear")], { zoom: 10 });
      const labels = elements.top!.querySelectorAll(".attachbar-label");
      expect(labels).toHaveLength(1);
      cleanup(container);
    });

    it("does not reserve a corner when only one of the two sidebars exists", () => {
      const elements = createSidebars(container, ["top"]);
      renderLabels(elements, [makeAnchor("top", 5, 0, "no-left-sidebar")], { zoom: 10 });
      const labels = elements.top!.querySelectorAll(".attachbar-label");
      expect(labels).toHaveLength(1);
      cleanup(container);
    });

    it("respects a custom sidebarSize when reserving the corner", () => {
      const elements = createSidebars(container, ["top", "left"], { left: 10 });
      // x=30 would have been reserved under the default 48px left sidebar,
      // but the custom 10px size no longer covers it.
      renderLabels(elements, [makeAnchor("top", 30, 0, "clear-with-custom-size")], {
        zoom: 10,
      });
      const labels = elements.top!.querySelectorAll(".attachbar-label");
      expect(labels).toHaveLength(1);
      cleanup(container);
    });
  });
});

describe("destroySidebars", () => {
  it("removes sidebar elements from the container", () => {
    const container = makeContainer();
    const elements = createSidebars(container, ["top", "left"]);
    destroySidebars(container, elements);
    expect(container.children).toHaveLength(0);
    cleanup(container);
  });

  it("does not throw when called with empty elements map", () => {
    const container = makeContainer();
    expect(() => destroySidebars(container, {})).not.toThrow();
    cleanup(container);
  });
});
