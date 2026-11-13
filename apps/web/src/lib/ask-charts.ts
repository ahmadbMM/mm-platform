// The sums behind the Ask charts (components/ask/results): where a treemap's tiles go, how circles pack, which of a
// hundred dots belong to which option, a ring's arcs, a radar's corners. Pure and deterministic - the same results
// always draw the same picture, on the server and in the browser - so they are tested without one.

export type Rect = { x: number; y: number; w: number; h: number };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

/** Each value's share of the whole (0 when there is no whole). */
export function shares(values: readonly number[]): number[] {
  const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = sum(safe);
  return safe.map((v) => (total > 0 ? v / total : 0));
}

/** Shares with a floor: a value that is not nothing gets at least `least` of the whole, so its tile or bubble can
 *  carry its name; the others give way in proportion. The printed numbers stay the true ones. */
export function floored(values: readonly number[], least: number): number[] {
  const s = shares(values);
  const live = s.filter((v) => v > 0).length;
  if (!live) return s;
  const floor = Math.min(least, 1 / live);
  let out = s.map((v) => (v > 0 ? Math.max(v, floor) : 0));
  // what the floor added is taken from those above it, a few rounds until it settles
  for (let round = 0; round < 6; round++) {
    const over = sum(out) - 1;
    if (over <= 1e-9) break;
    const room = sum(out.map((v) => Math.max(0, v - floor)));
    if (room <= 0) break;
    out = out.map((v) => (v > floor ? v - (over * (v - floor)) / room : v));
  }
  const total = sum(out);
  return out.map((v) => v / total);
}

/** A squarified treemap: a rectangle `W` by `H` cut into one tile a value, each tile's area its value's share, tiles
 *  kept as square as they can be. The tiles come back in the order of the values, which should be largest first; a
 *  value of nothing gets a tile of no size. */
export function squarify(values: readonly number[], W: number, H: number): Rect[] {
  const s = shares(values);
  const out: Rect[] = values.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  const todo = s.map((v, i) => ({ i, area: v * W * H })).filter((t) => t.area > 0);
  let x = 0, y = 0, w = W, h = H;
  // the worst aspect ratio of a row of tiles laid along a side of this length
  const worst = (row: number[], side: number) => {
    const total = sum(row);
    if (!total || !side) return Infinity;
    const big = Math.max(...row), small = Math.min(...row);
    return Math.max((side * side * big) / (total * total), (total * total) / (side * side * small));
  };
  let at = 0;
  while (at < todo.length) {
    const side = Math.min(w, h);
    const row = [todo[at].area];
    let end = at + 1;
    while (end < todo.length && worst([...row, todo[end].area], side) <= worst(row, side)) row.push(todo[end++].area);
    const total = sum(row);
    const last = end >= todo.length;
    // the row takes a strip along the shorter side; the last row takes what is left, so the tiles close the box
    if (w >= h) {
      const strip = last ? w : total / h;
      let yy = y;
      row.forEach((a, k) => { const th = k === row.length - 1 ? y + h - yy : a / strip; out[todo[at + k].i] = { x, y: yy, w: strip, h: th }; yy += th; });
      x += strip; w -= strip;
    } else {
      const strip = last ? h : total / w;
      let xx = x;
      row.forEach((a, k) => { const tw = k === row.length - 1 ? x + w - xx : a / strip; out[todo[at + k].i] = { x: xx, y, w: tw, h: strip }; xx += tw; });
      y += strip; h -= strip;
    }
    at = end;
  }
  return out;
}

export type Circle = { x: number; y: number; r: number };
/** Circles packed around the first (the largest should come first): each next one at the nearest free place on a
 *  spiral out from the middle, stretched to `aspect` (width over height) so the pack fills a box of that shape. They
 *  never touch (`gap` between any two). Returned in a box that starts at 0, 0, with its width and height. */
export function packCircles(radii: readonly number[], aspect = 1, gap = 2): { circles: Circle[]; width: number; height: number } {
  const placed: Circle[] = [];
  const a = clamp(aspect, 0.4, 3);
  for (let i = 0; i < radii.length; i++) {
    const r = Math.max(0, radii[i]);
    if (!placed.length) { placed.push({ x: 0, y: 0, r }); continue; }
    const step = Math.max(2, r * 0.35);
    let spot: Circle | null = null;
    for (let t = 0; t < 40000 && !spot; t++) {
      // an even walk outwards: the angle advances by the golden angle, the distance grows with the square root
      const d = step * Math.sqrt(t), ang = t * 2.399963 + i;
      const x = d * Math.cos(ang) * Math.sqrt(a), y = (d * Math.sin(ang)) / Math.sqrt(a);
      let free = true;
      for (const p of placed) { const need = p.r + r + gap; const dx = p.x - x, dy = p.y - y; if (dx * dx + dy * dy < need * need) { free = false; break; } }
      if (free) spot = { x, y, r };
    }
    placed.push(spot ?? { x: 0, y: 0, r: 0 });
  }
  if (!placed.length) return { circles: [], width: 0, height: 0 };
  const left = Math.min(...placed.map((c) => c.x - c.r)), top = Math.min(...placed.map((c) => c.y - c.r));
  const right = Math.max(...placed.map((c) => c.x + c.r)), bottom = Math.max(...placed.map((c) => c.y + c.r));
  return { circles: placed.map((c) => ({ x: c.x - left, y: c.y - top, r: c.r })), width: right - left, height: bottom - top };
}

/** A hundred dots (or `cells`) shared between the values by their share of the whole - the largest remainders take
 *  the dots left over, so they always add up, and a value that is not nothing never has none while there are dots
 *  enough. All nothing when there is no whole. */
export function dotCounts(values: readonly number[], cells = 100): number[] {
  const s = shares(values);
  if (!sum(s)) return values.map(() => 0);
  const exact = s.map((v) => v * cells);
  const out = exact.map(Math.floor);
  const order = exact.map((v, i) => ({ i, rest: v - Math.floor(v) })).sort((p, q) => q.rest - p.rest || p.i - q.i);
  for (let k = 0, left = cells - sum(out); left > 0; k++, left--) out[order[k % order.length].i]++;
  // a value that has some of the whole shows at least one dot, taken from the one with the most
  for (let i = 0; i < out.length; i++) {
    if (s[i] > 0 && out[i] === 0) { const most = out.indexOf(Math.max(...out)); if (out[most] > 1) { out[most]--; out[i]++; } }
  }
  return out;
}

/** A ring's arcs: where each value's arc starts and how long it is, as shares of the whole turn, in order. */
export function arcs(values: readonly number[]): { from: number; len: number }[] {
  const s = shares(values);
  let from = 0;
  return s.map((len) => { const a = { from, len }; from += len; return a; });
}

/** A radar's corners: one a value, the first straight up and the rest clockwise, each as far from the middle as its
 *  value is between `min` and `max` (a missing one sits in the middle). Also where each axis ends, for its label. */
export function radar(values: readonly (number | null)[], min: number, max: number, r: number, cx = r, cy = r): { points: [number, number][]; ends: [number, number][] } {
  const n = values.length;
  const span = max - min || 1;
  const dir = (i: number): [number, number] => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n); return [Math.cos(a), Math.sin(a)]; };
  return {
    points: values.map((v, i) => { const [dx, dy] = dir(i); const k = v === null ? 0 : clamp((v - min) / span, 0, 1); return [cx + dx * r * k, cy + dy * r * k]; }),
    ends: values.map((_, i) => { const [dx, dy] = dir(i); return [cx + dx * r, cy + dy * r]; }),
  };
}

/** Where a value sits between two ends, 0 to 1 (the middle when the ends are the same). */
export const between = (v: number, lo: number, hi: number): number => (hi > lo ? clamp((v - lo) / (hi - lo), 0, 1) : 0.5);

/** The first `n` of a list by a number, largest first (ties keep their order). */
export function topBy<T>(items: readonly T[], by: (x: T) => number, n: number): T[] {
  return items.map((x, i) => ({ x, i })).sort((p, q) => by(q.x) - by(p.x) || p.i - q.i).slice(0, Math.max(0, n)).map(({ x }) => x);
}

const f2 = (v: number) => String(Math.round(v * 100) / 100);
/** Where a share of the whole turn falls on a circle: 0 is straight up, the turn goes clockwise. */
export const onCircle = (cx: number, cy: number, r: number, turn: number): [number, number] => {
  const a = -Math.PI / 2 + turn * 2 * Math.PI;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
/** The outline of a ring's part (or a pie's, with `r0` of 0): from the share `from` of the whole turn, `len` long,
 *  between the radii `r0` and `r1` - an SVG path. A part that is the whole turn is drawn as two halves; one of no
 *  length is no path at all. */
export function sector(cx: number, cy: number, r0: number, r1: number, from: number, len: number): string {
  const l = clamp(len, 0, 1);
  if (l <= 0) return "";
  if (l >= 0.9999) return [sector(cx, cy, r0, r1, 0, 0.5), sector(cx, cy, r0, r1, 0.5, 0.5)].join(" ");
  const big = l > 0.5 ? 1 : 0;
  const [x0, y0] = onCircle(cx, cy, r1, from), [x1, y1] = onCircle(cx, cy, r1, from + l);
  if (r0 <= 0) return `M${f2(cx)} ${f2(cy)}L${f2(x0)} ${f2(y0)}A${f2(r1)} ${f2(r1)} 0 ${big} 1 ${f2(x1)} ${f2(y1)}Z`;
  const [x2, y2] = onCircle(cx, cy, r0, from + l), [x3, y3] = onCircle(cx, cy, r0, from);
  return `M${f2(x0)} ${f2(y0)}A${f2(r1)} ${f2(r1)} 0 ${big} 1 ${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}A${f2(r0)} ${f2(r0)} 0 ${big} 0 ${f2(x3)} ${f2(y3)}Z`;
}

/** A half dial's arc: the upper half of a circle from its left end (0) to its right (1), drawn from the share `from`
 *  to the share `to` - an SVG path to stroke. Nothing when the two are the same. */
export function dial(cx: number, cy: number, r: number, from: number, to: number): string {
  const a = clamp(from, 0, 1), b = clamp(to, 0, 1);
  if (b <= a) return "";
  const at = (s: number): [number, number] => [cx - r * Math.cos(s * Math.PI), cy - r * Math.sin(s * Math.PI)];
  const [x0, y0] = at(a), [x1, y1] = at(b);
  return `M${f2(x0)} ${f2(y0)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(x1)} ${f2(y1)}`;
}
/** Where a share of a half dial falls (0 its left end, 1 its right). */
export const onDial = (cx: number, cy: number, r: number, share: number): [number, number] => {
  const s = clamp(share, 0, 1);
  return [cx - r * Math.cos(s * Math.PI), cy - r * Math.sin(s * Math.PI)];
};
