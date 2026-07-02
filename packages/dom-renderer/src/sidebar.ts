import type { AttachbarSide, AttachbarOptions, PixelAnchor } from "@attachbar/core";

/** Map from side name to the sidebar HTMLElement. */
export type SidebarElements = Partial<Record<AttachbarSide, HTMLElement>>;

const SIDEBAR_BASE_STYLES: CSSStyleDeclaration["cssText"] = "";

const SIDEBAR_SIDE_STYLES: Record<AttachbarSide, Partial<CSSStyleDeclaration>> =
  {
    top: {
      position: "absolute",
      top: "0",
      left: "0",
      right: "0",
      overflow: "hidden",
      pointerEvents: "none",
    },
    bottom: {
      position: "absolute",
      bottom: "0",
      left: "0",
      right: "0",
      overflow: "hidden",
      pointerEvents: "none",
    },
    left: {
      position: "absolute",
      top: "0",
      left: "0",
      bottom: "0",
      overflow: "hidden",
      pointerEvents: "none",
    },
    right: {
      position: "absolute",
      top: "0",
      right: "0",
      bottom: "0",
      overflow: "hidden",
      pointerEvents: "none",
    },
  };

/**
 * Create sidebar overlay elements for the requested sides and append them to
 * the container.  The container is given `position: relative` if it currently
 * has static positioning.
 */
export function createSidebars(
  container: HTMLElement,
  sides: AttachbarSide[]
): SidebarElements {
  const computed = getComputedStyle(container);
  // jsdom returns "" for unset styles; browsers report "static" — handle both
  if (computed.position === "static" || computed.position === "") {
    container.style.position = "relative";
  }

  const elements: SidebarElements = {};

  for (const side of sides) {
    const el = document.createElement("div");
    el.dataset.attachbarSide = side;
    el.className = `attachbar-sidebar attachbar-sidebar--${side}`;

    const sideStyles = SIDEBAR_SIDE_STYLES[side];
    for (const [key, value] of Object.entries(sideStyles) as [
      keyof CSSStyleDeclaration,
      string,
    ][]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el.style as any)[key] = value;
    }

    container.appendChild(el);
    elements[side] = el;
  }

  return elements;
}

/**
 * Render label elements into the appropriate sidebar containers.
 *
 * Each call fully replaces the previous set of labels (idempotent, no leaks).
 *
 * Label positioning:
 * - **top / bottom** sidebars: label is placed at `left: pixel.x` and
 *   vertically centred inside the sidebar via `top: 50%`.
 * - **left / right** sidebars: label is placed at `top: pixel.y` and
 *   horizontally centred inside the sidebar via `left: 50%`.
 */
export function renderLabels(
  elements: SidebarElements,
  anchors: PixelAnchor[],
  opts: {
    zoom: number;
    formatter?: AttachbarOptions["formatter"];
    visibility?: AttachbarOptions["visibility"];
  }
): void {
  // Clear existing labels first (idempotent redraw)
  for (const el of Object.values(elements) as HTMLElement[]) {
    el.innerHTML = "";
  }

  for (const anchor of anchors) {
    const container = elements[anchor.side];
    if (!container) continue;

    if (opts.visibility) {
      if (!opts.visibility({ zoom: opts.zoom, side: anchor.side })) continue;
    }

    const label = document.createElement("span");
    label.className = "attachbar-label";
    label.dataset.attachbarValue = String(anchor.value);
    label.textContent = opts.formatter
      ? opts.formatter(anchor.value, { side: anchor.side, zoom: opts.zoom })
      : String(anchor.value);

    label.style.position = "absolute";
    label.style.transform = "translate(-50%, -50%)";

    const [px, py] = anchor.pixel;
    if (anchor.side === "top" || anchor.side === "bottom") {
      label.style.left = `${px}px`;
      label.style.top = "50%";
    } else {
      label.style.top = `${py}px`;
      label.style.left = "50%";
    }

    container.appendChild(label);
  }
}

/**
 * Remove all sidebar elements from the container and clean up.
 */
export function destroySidebars(
  container: HTMLElement,
  elements: SidebarElements
): void {
  for (const el of Object.values(elements) as HTMLElement[]) {
    if (el.parentNode === container) {
      container.removeChild(el);
    }
  }
}

void SIDEBAR_BASE_STYLES; // silence unused warning
