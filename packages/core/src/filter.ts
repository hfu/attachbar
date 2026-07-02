import type { PixelAnchor, AttachbarSide } from "./types.js";

export interface FilterOptions {
  minPixelSpacing: number;
}

/**
 * Filter pixel anchors to enforce a minimum spacing along each side's primary
 * axis, keeping higher-priority anchors over lower-priority ones.
 *
 * - "top" / "bottom" sides: spacing measured along the **x** axis.
 * - "left" / "right" sides: spacing measured along the **y** axis.
 *
 * When two anchors have equal priority, the one with the smaller axis
 * coordinate is retained and the other is discarded.
 */
export function filterAnchors(
  anchors: PixelAnchor[],
  options: FilterOptions
): PixelAnchor[] {
  const { minPixelSpacing } = options;
  const bySide = new Map<AttachbarSide, PixelAnchor[]>();

  for (const anchor of anchors) {
    const list = bySide.get(anchor.side) ?? [];
    list.push(anchor);
    bySide.set(anchor.side, list);
  }

  const result: PixelAnchor[] = [];

  for (const [side, sideAnchors] of bySide) {
    // Axis index: 0 = x for horizontal sides, 1 = y for vertical sides
    const axis: 0 | 1 =
      side === "top" || side === "bottom" ? 0 : 1;

    // Sort by priority descending so high-priority anchors are processed first,
    // then by axis position ascending so earlier positions are preferred on ties.
    const sorted = [...sideAnchors].sort((a, b) => {
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      if (pb !== pa) return pb - pa;
      return a.pixel[axis] - b.pixel[axis];
    });

    const kept: PixelAnchor[] = [];
    for (const anchor of sorted) {
      const pos = anchor.pixel[axis];
      const tooClose = kept.some(
        (k) => Math.abs(k.pixel[axis] - pos) < minPixelSpacing
      );
      if (!tooClose) {
        kept.push(anchor);
      }
    }

    // Re-sort by axis position for deterministic, visually ordered output
    kept.sort((a, b) => a.pixel[axis] - b.pixel[axis]);
    result.push(...kept);
  }

  return result;
}
