import { describe, it, expect } from "vitest";
import { filterAnchors } from "./filter.js";
import type { PixelAnchor } from "./types.js";

function anchor(
  side: PixelAnchor["side"],
  px: number,
  py: number,
  value: unknown = px,
  priority?: number
): PixelAnchor {
  return { side, pixel: [px, py], value, priority };
}

describe("filterAnchors", () => {
  describe("top side – spacing along x axis", () => {
    it("keeps all anchors when spacing is sufficient", () => {
      const anchors = [
        anchor("top", 0, 0),
        anchor("top", 50, 0),
        anchor("top", 100, 0),
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      expect(result).toHaveLength(3);
    });

    it("drops anchors that are too close together", () => {
      const anchors = [
        anchor("top", 0, 0),
        anchor("top", 20, 0),  // too close to 0
        anchor("top", 100, 0),
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.pixel[0])).toEqual([0, 100]);
    });

    it("retains sorted order by x position after filtering", () => {
      const anchors = [
        anchor("top", 200, 0),
        anchor("top", 0, 0),
        anchor("top", 100, 0),
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      const xs = result.map((a) => a.pixel[0]);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
    });
  });

  describe("left side – spacing along y axis", () => {
    it("keeps all anchors when spacing is sufficient", () => {
      const anchors = [
        anchor("left", 0, 0),
        anchor("left", 0, 50),
        anchor("left", 0, 100),
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      expect(result).toHaveLength(3);
    });

    it("drops anchors that are too close on the y axis", () => {
      const anchors = [
        anchor("left", 0, 0),
        anchor("left", 0, 10),   // too close to 0
        anchor("left", 0, 100),
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.pixel[1])).toEqual([0, 100]);
    });
  });

  describe("right side – spacing along y axis", () => {
    it("uses y axis for right side", () => {
      const anchors = [
        anchor("right", 500, 0),
        anchor("right", 500, 10),
        anchor("right", 500, 200),
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      expect(result).toHaveLength(2);
    });
  });

  describe("bottom side – spacing along x axis", () => {
    it("uses x axis for bottom side", () => {
      const anchors = [
        anchor("bottom", 0, 600),
        anchor("bottom", 10, 600),
        anchor("bottom", 200, 600),
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      expect(result).toHaveLength(2);
    });
  });

  describe("priority handling", () => {
    it("keeps higher-priority anchor when two overlap", () => {
      const anchors = [
        anchor("top", 0, 0, "low", 1),
        anchor("top", 20, 0, "high", 10),
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe("high");
    });

    it("keeps earlier-position anchor when priorities are equal", () => {
      const anchors = [
        anchor("top", 10, 0, "a", 5),
        anchor("top", 30, 0, "b", 5), // same priority, 20px apart
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe("a");
    });

    it("keeps default priority (0) anchors normally", () => {
      const anchors = [
        anchor("top", 0, 0, "x"),
        anchor("top", 100, 0, "y"),
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      expect(result).toHaveLength(2);
    });
  });

  describe("multiple sides", () => {
    it("handles anchors from different sides independently", () => {
      const anchors = [
        anchor("top", 0, 0),
        anchor("top", 10, 0),    // too close to first top anchor
        anchor("left", 0, 0),
        anchor("left", 0, 10),   // too close to first left anchor
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      expect(result).toHaveLength(2);
      const sides = result.map((a) => a.side).sort();
      expect(sides).toEqual(["left", "top"]);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty input", () => {
      expect(filterAnchors([], { minPixelSpacing: 40 })).toEqual([]);
    });

    it("returns single anchor unchanged", () => {
      const a = anchor("top", 50, 0, "x");
      const result = filterAnchors([a], { minPixelSpacing: 40 });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(a);
    });

    it("applies exact boundary (< not <=)", () => {
      // anchor at 0 and 40 – exactly minPixelSpacing apart should both survive
      const anchors = [
        anchor("top", 0, 0),
        anchor("top", 40, 0),
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      expect(result).toHaveLength(2);
    });

    it("drops anchor at exactly minPixelSpacing - 1 apart", () => {
      const anchors = [
        anchor("top", 0, 0),
        anchor("top", 39, 0),
      ];
      const result = filterAnchors(anchors, { minPixelSpacing: 40 });
      expect(result).toHaveLength(1);
    });
  });
});
