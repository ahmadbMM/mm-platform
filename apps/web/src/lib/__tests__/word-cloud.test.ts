import { describe, expect, it } from "vitest";
import { CLOUD_COLORS, cloudKey, colorOf, layoutCloud, type CloudLayout, type Placed } from "../word-cloud";

// The Ask pages' word cloud (components/ask/AskCloud.tsx). A ruler that gives every character
// 55px at a font size of 100px stands in for the browser's.
const ruler = (s: string) => [...s].length * 55;
const overlaps = (a: Placed, b: Placed) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const words = (n: number) => Array.from({ length: n }, (_, i) => ({ w: `Idea number ${i + 1}`, n: (i % 7) + 1 }));

/** Every word inside the box, none over another: what is wrong with a layout, as a list (empty when it is sound). */
function faults({ height, items }: CloudLayout, width: number): string[] {
  const out: string[] = [];
  for (const p of items) {
    if (!(p.x >= 0 && p.y >= 0 && p.x + p.width <= width + 0.01 && p.y + p.height <= height + 0.01)) out.push(`outside: ${p.w}`);
    if (!(p.size > 0)) out.push(`no size: ${p.w}`);
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (overlaps(items[i], items[j])) out.push(`${items[i].w} over ${items[j].w}`);
  return out;
}
const sound = (laid: CloudLayout, width: number, label: string) => expect(faults(laid, width), label).toEqual([]);

describe("the word cloud", () => {
  it("places every answer, inside the box, none over another", () => {
    for (const width of [320, 390, 760, 1060]) {
      for (const n of [1, 5, 40, 200]) {
        const laid = layoutCloud(words(n), width, ruler);
        expect(laid.items.length, `${n} at ${width}`).toBe(n);
        sound(laid, width, `${n} at ${width}`);
      }
    }
  });
  it("lays 200 answers out in well under 50 ms, on a phone and on a wide screen", () => {
    for (const width of [320, 1060]) {
      const list = words(200);
      layoutCloud(list, width, ruler); // the first run readies the code
      let best = Infinity;
      for (let i = 0; i < 5; i++) {
        const from = performance.now();
        layoutCloud(list, width, ruler);
        best = Math.min(best, performance.now() - from);
      }
      expect(best, `at ${width}`).toBeLessThan(50);
    }
  });
  it("draws an answer sent more often larger, the most sent in the middle", () => {
    const { height, items } = layoutCloud([{ w: "Face painting", n: 9 }, { w: "Pony rides", n: 3 }, { w: "Kites", n: 1 }], 900, ruler);
    const [a, b, c] = items;
    expect(a.size).toBeGreaterThan(b.size);
    expect(b.size).toBeGreaterThan(c.size);
    expect(Math.abs(a.x + a.width / 2 - 450)).toBeLessThan(2);
    expect(Math.abs(a.y + a.height / 2 - height / 2)).toBeLessThan(2);
  });
  it("puts the most sent first whatever order they come in, and lays the same words out the same way", () => {
    const mixed = [{ w: "Kites", n: 1 }, { w: "Face painting", n: 9 }, { w: "Pony rides", n: 3 }];
    const { items } = layoutCloud(mixed, 900, ruler);
    expect(items.map((p) => p.w)).toEqual(["Face painting", "Pony rides", "Kites"]);
    expect(layoutCloud(mixed, 900, ruler)).toEqual(layoutCloud(mixed, 900, ruler));
    expect(layoutCloud(words(80), 700, ruler)).toEqual(layoutCloud(words(80), 700, ruler));
  });
  it("keeps a long answer inside a phone's width", () => {
    const { items } = layoutCloud([{ w: "x".repeat(40), n: 5 }, { w: "Swings", n: 1 }], 320, ruler);
    expect(items[0].width).toBeLessThanOrEqual(320);
  });
  it("fills a box of a given height (the big screen) without growing it, however many answers", () => {
    for (const [width, height] of [[1600, 620], [1100, 420], [640, 300]]) {
      for (const n of [1, 12, 60, 150]) {
        const laid = layoutCloud(words(n), width, ruler, { height });
        expect(laid.height, `${n} in ${width}x${height}`).toBe(height);
        expect(laid.items.length, `${n} in ${width}x${height}`).toBe(n);
        sound(laid, width, `${n} in ${width}x${height}`);
      }
    }
    // a big screen draws a small cloud large
    const few = layoutCloud(words(5), 1600, ruler, { height: 620 });
    expect(Math.max(...few.items.map((p) => p.size))).toBeGreaterThan(60);
  });
  it("packs the words in rows when no spiral holds them: a box far too small still shows every answer", () => {
    const tight = layoutCloud(words(150), 240, ruler, { height: 120 });
    expect(tight.items.length).toBe(150);
    expect(tight.height).toBe(120);
    sound(tight, 240, "150 in 240x120");
    const long = Array.from({ length: 60 }, (_, i) => ({ w: `A much longer answer than the others, number ${i + 1}`, n: 60 - i }));
    const narrow = layoutCloud(long, 200, ruler);
    expect(narrow.items.length).toBe(60);
    sound(narrow, 200, "60 long at 200");
  });
  it("draws nothing for no answers, or a box too narrow to draw in", () => {
    expect(layoutCloud([], 800, ruler)).toEqual({ height: 0, items: [] });
    expect(layoutCloud([{ w: "  ", n: 3 }, { w: "Kites", n: 0 }], 800, ruler)).toEqual({ height: 0, items: [] });
    expect(layoutCloud(words(3), 40, ruler)).toEqual({ height: 0, items: [] });
    expect(layoutCloud(words(3), Number.NaN, ruler)).toEqual({ height: 0, items: [] });
  });
  it("gives a word the same colour whatever else is in the cloud, and groups as the database does", () => {
    expect(cloudKey(" Face  painting! ")).toBe(cloudKey("face painting"));
    expect(cloudKey("رسم على الوجه")).toBe("رسمعلىالوجه");
    expect(colorOf(cloudKey("Face painting"))).toBe(colorOf(cloudKey("FACE PAINTING")));
    const seen = new Set(words(60).map((x) => colorOf(cloudKey(x.w))));
    expect(seen.size).toBe(CLOUD_COLORS);
  });
});
