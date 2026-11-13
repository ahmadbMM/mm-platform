import { describe, expect, it } from "vitest";
import { arcs, between, dial, dotCounts, floored, onCircle, onDial, packCircles, radar, sector, shares, squarify, topBy } from "../ask-charts";

// The sums behind the Ask charts (lib/ask-charts.ts): pure, so the same results always draw the same picture.
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("shares", () => {
  it("gives each value its part of the whole, and nothing when there is no whole", () => {
    expect(shares([1, 1, 2])).toEqual([0.25, 0.25, 0.5]);
    expect(shares([0, 0])).toEqual([0, 0]);
    expect(shares([3, -1, Number.NaN])).toEqual([1, 0, 0]);
    expect(shares([])).toEqual([]);
  });
  it("keeps a floor under a small share so its mark can carry its name, without touching nothing", () => {
    const f = floored([96, 2, 2, 0], 0.05);
    expect(sum(f)).toBeCloseTo(1, 9);
    expect(f[1]).toBeCloseTo(0.05, 9);
    expect(f[2]).toBeCloseTo(0.05, 9);
    expect(f[3]).toBe(0);
    expect(f[0]).toBeCloseTo(0.9, 9);
    // more things than the floor has room for: they share evenly
    expect(floored([1, 1, 1, 1], 0.4)).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(floored([0, 0], 0.1)).toEqual([0, 0]);
    // the order of sizes is kept
    const g = floored([50, 30, 15, 4, 1], 0.06);
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeLessThanOrEqual(g[i - 1] + 1e-9);
  });
});

describe("tiles", () => {
  it("cuts the box into one tile a value, each as large as its share, none over another, none outside", () => {
    const values = [40, 25, 15, 10, 6, 4];
    const tiles = squarify(values, 320, 200);
    expect(tiles).toHaveLength(values.length);
    const whole = 320 * 200;
    tiles.forEach((t, i) => {
      expect(t.w * t.h).toBeCloseTo((values[i] / 100) * whole, 3);
      expect(t.x).toBeGreaterThanOrEqual(-1e-6);
      expect(t.y).toBeGreaterThanOrEqual(-1e-6);
      expect(t.x + t.w).toBeLessThanOrEqual(320 + 1e-6);
      expect(t.y + t.h).toBeLessThanOrEqual(200 + 1e-6);
    });
    for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i], b = tiles[j];
      const over = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1e-6 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1e-6;
      expect(over, `${i} over ${j}`).toBe(false);
    }
    // the tiles stay near square: none is a sliver
    for (const t of tiles) expect(Math.max(t.w / t.h, t.h / t.w)).toBeLessThan(4);
  });
  it("gives a value of nothing a tile of no size, and one value the whole box", () => {
    expect(squarify([5, 0], 100, 50)).toEqual([{ x: 0, y: 0, w: 100, h: 50 }, { x: 0, y: 0, w: 0, h: 0 }]);
    expect(squarify([], 100, 50)).toEqual([]);
    expect(squarify([0, 0], 100, 50).every((t) => t.w === 0 && t.h === 0)).toBe(true);
  });
});

describe("packed circles", () => {
  it("places every circle clear of the others, in a box that starts at nothing", () => {
    const radii = [40, 28, 22, 18, 14, 12, 10, 10, 8, 8, 6, 6];
    const { circles, width, height } = packCircles(radii, 1.6, 2);
    expect(circles).toHaveLength(radii.length);
    circles.forEach((c, i) => {
      expect(c.r).toBe(radii[i]);
      expect(c.x - c.r).toBeGreaterThanOrEqual(-1e-6);
      expect(c.y - c.r).toBeGreaterThanOrEqual(-1e-6);
      expect(c.x + c.r).toBeLessThanOrEqual(width + 1e-6);
      expect(c.y + c.r).toBeLessThanOrEqual(height + 1e-6);
    });
    for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) {
      const d = Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y);
      expect(d, `${i} and ${j}`).toBeGreaterThanOrEqual(circles[i].r + circles[j].r + 2 - 1e-6);
    }
    // a wide box makes a wide pack
    expect(width).toBeGreaterThan(height);
    expect(packCircles(radii, 0.6, 2).height).toBeGreaterThan(packCircles(radii, 0.6, 2).width);
  });
  it("is the same every time, and nothing for nothing", () => {
    expect(packCircles([10, 8, 6], 1)).toEqual(packCircles([10, 8, 6], 1));
    expect(packCircles([], 1)).toEqual({ circles: [], width: 0, height: 0 });
    expect(packCircles([12], 1)).toEqual({ circles: [{ x: 12, y: 12, r: 12 }], width: 24, height: 24 });
  });
});

describe("a hundred dots", () => {
  it("always adds up, and gives a value that is not nothing at least one dot", () => {
    expect(dotCounts([1, 1, 1])).toEqual([34, 33, 33]);
    expect(sum(dotCounts([7, 5, 3, 1]))).toBe(100);
    expect(dotCounts([500, 1, 0])).toEqual([99, 1, 0]);
    expect(dotCounts([0, 0])).toEqual([0, 0]);
    expect(dotCounts([3, 1], 4)).toEqual([3, 1]);
    for (const values of [[13, 29, 31, 7, 2], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [999, 1, 1, 1]]) {
      const d = dotCounts(values);
      expect(sum(d)).toBe(100);
      values.forEach((v, i) => expect(d[i] > 0).toBe(v > 0));
    }
  });
});

describe("rings, dials and radars", () => {
  it("lays a ring's arcs one after another around the whole turn", () => {
    expect(arcs([1, 1, 2])).toEqual([{ from: 0, len: 0.25 }, { from: 0.25, len: 0.25 }, { from: 0.5, len: 0.5 }]);
    expect(arcs([0, 0])).toEqual([{ from: 0, len: 0 }, { from: 0, len: 0 }]);
  });
  it("starts a turn straight up and goes clockwise", () => {
    const near = (p: [number, number], x: number, y: number) => { expect(p[0]).toBeCloseTo(x, 6); expect(p[1]).toBeCloseTo(y, 6); };
    near(onCircle(100, 100, 50, 0), 100, 50);
    near(onCircle(100, 100, 50, 0.25), 150, 100);
    near(onCircle(100, 100, 50, 0.5), 100, 150);
    near(onCircle(100, 100, 50, 0.75), 50, 100);
  });
  it("draws a part as a closed path, a whole turn as two halves, and nothing for nothing", () => {
    expect(sector(100, 100, 60, 97, 0, 0)).toBe("");
    const quarter = sector(100, 100, 60, 97, 0, 0.25);
    expect(quarter).toMatch(/^M100 3A97 97 0 0 1 197 100L160 100A60 60 0 0 0 100 40Z$/);
    expect(sector(100, 100, 0, 97, 0, 0.25)).toMatch(/^M100 100L100 3A97 97 0 0 1 197 100Z$/);
    expect(sector(100, 100, 60, 97, 0.1, 0.7)).toContain(" 0 1 1 "); // more than half a turn: the long way round
    const whole = sector(100, 100, 60, 97, 0, 1);
    expect(whole.split("Z").filter(Boolean)).toHaveLength(2);
    expect(whole).not.toContain("NaN");
  });
  it("draws a half dial from its left end to its right, over the top", () => {
    expect(dial(100, 100, 84, 0, 1)).toBe("M16 100A84 84 0 0 1 184 100");
    expect(dial(100, 100, 84, 0, 0.5)).toBe("M16 100A84 84 0 0 1 100 16");
    expect(dial(100, 100, 84, 0.4, 0.4)).toBe("");
    expect(dial(100, 100, 84, 0, 7)).toBe(dial(100, 100, 84, 0, 1));
    const [x, y] = onDial(100, 100, 84, 0.5);
    expect(x).toBeCloseTo(100, 6);
    expect(y).toBeCloseTo(16, 6);
  });
  it("puts a radar's first corner straight up, the lowest mark in the middle and the highest at the rim", () => {
    const { points, ends } = radar([5, 1, 3, null], 1, 5, 80, 100, 100);
    expect(points[0][0]).toBeCloseTo(100, 6);
    expect(points[0][1]).toBeCloseTo(20, 6);
    expect(points[1][0]).toBeCloseTo(100, 6); // the lowest mark: the middle
    expect(points[1][1]).toBeCloseTo(100, 6);
    expect(points[2][1]).toBeCloseTo(140, 6); // half way, straight down
    expect(points[3]).toEqual([100, 100]); // no answers: the middle
    expect(ends[1][0]).toBeCloseTo(180, 6);
    expect(ends[1][1]).toBeCloseTo(100, 6);
    expect(radar([9, -4], 1, 5, 10, 0, 0).points[0][1]).toBeCloseTo(-10, 6); // never past the rim
  });
  it("says where a value falls between two ends, and takes the first few of a list by a number", () => {
    expect(between(5, 0, 10)).toBe(0.5);
    expect(between(-3, 0, 10)).toBe(0);
    expect(between(30, 0, 10)).toBe(1);
    expect(between(4, 4, 4)).toBe(0.5);
    expect(topBy([{ w: "a", n: 1 }, { w: "b", n: 5 }, { w: "c", n: 5 }, { w: "d", n: 2 }], (x) => x.n, 3).map((x) => x.w)).toEqual(["b", "c", "d"]);
    expect(topBy([1, 2, 3], (x) => x, 0)).toEqual([]);
  });
});
