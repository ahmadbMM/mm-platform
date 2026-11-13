// The Ask pages' word cloud (components/ask/AskCloud.tsx): each answer once, sized by how many
// people sent it, the most sent in the middle and the rest around it, every word level. Pure: the
// page hands in the box's width and a ruler, so a test can lay out a cloud without a browser.
//
// Two layouts, and every word is always placed:
//   - the spiral, while the words fit the box with air around them: the most sent in the middle,
//     each next word at the first free spot on its way out;
//   - rows, once they do not (many answers, or a phone): the most sent in the middle row and the
//     rest in turn under and over it. Rows pack more than twice as tight as a spiral, so the words
//     stay larger and a phone scrolls less; when the box may grow, it grows only once the words
//     are as small as they may be.
// Fast enough to run on every poll (200 words in a few milliseconds): for the spiral the box is a
// coarse grid of cells, a word takes every cell it touches, and a spot is free when none of its
// cells is taken - so two words never share a pixel, and a spot is refused at its first taken
// cell. The first size is worked out from the words' area, so the spiral nearly always fits at the
// first try, and a word starts looking where the last one its size found room.

export type CloudWord = { w: string; n: number };
/** A word in its place: `width` and `height` are its box as it stands (a word turned on its side stands tall). */
export type Placed = { w: string; n: number; key: string; size: number; x: number; y: number; width: number; height: number; color: number; turned: boolean };
export type CloudLayout = { height: number; items: Placed[] };
/** `height`: a box of this height to fill (the big screen). The words shrink to fit it and it never grows.
 *  `mixed`: some words stand on their side (about one in three, never the most sent, never a long one) - while the
 *  words fit as a cloud; packed in rows they all lie flat. */
export type CloudBox = { height?: number; mixed?: boolean };

/** How the database groups answers (ask_answers.norm): case, punctuation and spaces ignored. */
export const cloudKey = (w: string) => w.toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");

/** The number of colours a palette has (lib/ask.ts ASK_PALETTES; ask.css .ask-c0 ... .ask-c5). */
export const CLOUD_COLORS = 6;

/** A word's colour, from its text: it keeps its colour as the cloud changes around it. */
export function colorOf(key: string): number {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return (h >>> 0) % CLOUD_COLORS;
}

const LINE = 1.15; // a word's box: its font size times this, the line-height ask.css gives it
const GAP_Y = 2;
/** The air beside a word, half on each side: a third of its font size, 6px at least - so two large words side by side
 *  read as two, as two small ones do. */
const gapX = (size: number) => Math.max(6, size * 0.34);
const FLOOR = 11; // the smallest a word is drawn, in px
const EDGE = 12; // a long answer stops this far short of the box's width
const CELL = 4; // the grid's cell, in px
const PITCH = 10; // between the spiral's turns, in px
const STEP = 8; // between two spots tried along the spiral, in px
const FILL = 0.4; // the share of the box the words' boxes take at the spiral's first try
const TAU = Math.PI * 2;

type Word = { w: string; n: number; base: number; wide: number };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A word's font size at a scale: never wider than the box, its air counted. */
const sizeOf = (x: Word, scale: number, W: number) => Math.min(x.base * scale, (W - EDGE) / (x.wide + 0.34));

/**
 * Lays the words out in a box `width` wide. `ruler(text)` is the text's width at a font size of
 * 100px. The box is about two thirds of its width high (a phone: as high as it is wide); when the
 * words do not fit, they shrink, and once they are as small as they may be, the box grows. With
 * `box.height` the box is that high and only the words change size. Every word is always placed,
 * inside the box, none over another; the most sent come first in `items`.
 */
export function layoutCloud(words: CloudWord[], width: number, ruler: (text: string) => number, box: CloudBox = {}): CloudLayout {
  const list = words.filter((x) => x && typeof x.w === "string" && x.w.trim() && x.n > 0);
  const W = Math.floor(width);
  if (!list.length || !(W >= 80)) return { height: 0, items: [] };
  const fixed = typeof box.height === "number" && box.height >= 80 ? Math.floor(box.height) : 0;
  const phone = W < 560;
  const maxSize = fixed ? clamp(Math.min(W / 9, fixed / 4.5), 26, 200) : Math.min(phone ? 44 : 78, Math.max(26, W / 8));
  const minSize = fixed ? Math.max(15, maxSize * 0.24) : phone ? 15 : 17;
  const ns = list.map((x) => x.n);
  const hi = Math.max(...ns), lo = Math.min(...ns);
  // all sent as often: one size, larger while the cloud is small
  const share = (n: number) => (hi === lo ? (list.length <= 8 ? 0.55 : 0.3) : Math.sqrt((n - lo) / (hi - lo)));
  // the most sent first (as the database sends them): they take the middle, the rest fill in around them
  const sorted: Word[] = list
    .map((x, i) => ({ x, i }))
    .sort((a, b) => b.x.n - a.x.n || a.i - b.i)
    .map(({ x }) => ({ w: x.w, n: x.n, base: minSize + (maxSize - minSize) * share(x.n), wide: Math.max(1, ruler(x.w)) / 100 }));
  const floor = (fixed ? 9 : FLOOR) / minSize;
  const H = fixed || Math.round(phone ? Math.max(300, W * 1.05) : Math.max(320, W * 0.58));
  const area = sorted.reduce((a, x) => { const size = sizeOf(x, 1, W); return a + (x.wide * size + gapX(size)) * (size * LINE + GAP_Y); }, 0);
  // The spiral, at the size that fills the box about two fifths, then a little smaller, three times at most - and only
  // while its words stay near their full size (a phone's least sent word 13px or more): smaller than that, rows hold
  // the same words larger.
  const least = Math.max(floor, fixed || !phone ? 0.75 : 0.86);
  let scale = Math.min(1, Math.sqrt((W * H * FILL) / area));
  for (let attempt = 0; attempt < 3 && scale >= least; attempt++, scale *= 0.92) {
    const items = spiral(sorted, scale, W, H, box.mixed === true);
    if (items) return fixed ? { height: H, items } : trimmed(items, H);
  }
  return rows(sorted, floor, W, H, fixed > 0);
}

const PAD = 14; // around a cloud drawn in a box of its own height
const LEAST_HIGH = 96;
/** A small cloud in a box no higher than it needs: the words keep their places around the middle (the most sent
 *  stays in it), and what was empty above and below them goes. */
function trimmed(items: Placed[], H: number): CloudLayout {
  const mid = H / 2;
  let reach = 0;
  for (const p of items) reach = Math.max(reach, mid - p.y, p.y + p.height - mid);
  const height = Math.min(H, Math.max(LEAST_HIGH, Math.ceil(2 * (reach + PAD))));
  if (height >= H) return { height: H, items };
  const up = Math.round(mid - height / 2);
  return { height, items: items.map((p) => ({ ...p, y: p.y - up })) };
}

const placed = (x: Word, size: number, px: number, py: number, turned = false): Placed => {
  const key = cloudKey(x.w) || x.w;
  const along = x.wide * size + gapX(size), across = size * LINE + GAP_Y;
  return { w: x.w, n: x.n, key, size: Math.round(size * 10) / 10, x: px, y: py, width: turned ? across : along, height: turned ? along : across, color: colorOf(key), turned };
};
/** Whether a word stands on its side in a mixed cloud: by its own text, so it stays as it is while the cloud changes. */
const turns = (x: Word, i: number): boolean => i > 0 && [...x.w].length <= 14 && colorOf(`${cloudKey(x.w)}|turn`) % 3 === 0;

/** The spiral: the first word in the middle, each next one at the first free spot on its way out. Null when a word finds none. */
function spiral(list: Word[], scale: number, W: number, H: number, mixed = false): Placed[] | null {
  const cols = Math.ceil(W / CELL), lines = Math.ceil(H / CELL);
  const taken = new Uint8Array(cols * lines);
  const items: Placed[] = [];
  const cx = W / 2, cy = H / 2;
  const ratio = W / H; // the spiral is an ellipse the box's shape, so the cloud fills it
  const reach = (H / 2) * Math.SQRT2 + PITCH; // out to the box's corners
  const along = Math.max(ratio, 1);
  // Words come largest first. One about as high as the last starts a little inside where that one found room (the
  // middle is full of its like); a smaller one starts from the middle again, and fills the gaps the larger ones left.
  let classHigh = 0, lastAt = 0;
  for (let i = 0; i < list.length; i++) {
    const size = sizeOf(list[i], scale, W);
    const flat = list[i].wide * size + gapX(size), high = size * LINE + GAP_Y;
    // a word on its side: its box stands tall, when the box is high enough to hold it
    const turned = mixed && turns(list[i], i) && flat <= H - EDGE;
    const w = turned ? high : flat, h = turned ? flat : high;
    if (high < classHigh * 0.8 || high > classHigh) { classHigh = high; lastAt = 0; }
    // each word starts its spiral at its own angle, so the cloud does not lean one way
    const turn = (i * 2.399963) % TAU;
    let found = false;
    for (let t = (lastAt * 0.7 * TAU) / PITCH; ; ) {
      const r = (PITCH * t) / TAU;
      if (r > reach) break;
      const x = Math.round(cx + r * ratio * Math.cos(t + turn) - w / 2), y = Math.round(cy + r * Math.sin(t + turn) - h / 2);
      t += STEP / Math.max(r * along, STEP);
      if (x < 0 || y < 0 || x + w > W || y + h > H) continue;
      const c0 = (x / CELL) | 0, c1 = Math.min(cols - 1, ((x + w - 0.001) / CELL) | 0);
      const l0 = (y / CELL) | 0, l1 = Math.min(lines - 1, ((y + h - 0.001) / CELL) | 0);
      // the middle first: where another word most often is
      if (taken[((l0 + l1) >> 1) * cols + ((c0 + c1) >> 1)]) continue;
      let free = true;
      for (let l = l0; free && l <= l1; l++) {
        const row = l * cols;
        for (let c = c0; c <= c1; c++) if (taken[row + c]) { free = false; break; }
      }
      if (!free) continue;
      for (let l = l0; l <= l1; l++) taken.fill(1, l * cols + c0, l * cols + c1 + 1);
      items.push(placed(list[i], size, x, y, turned));
      lastAt = r;
      found = true;
      break;
    }
    if (!found) return null;
  }
  return items;
}

type Row = { at: number[]; width: number; height: number };

/** The words in rows at a scale, in the order given: a row is full when the next word would pass the box's width. */
function rowsAt(list: Word[], scale: number, W: number): { made: Row[]; total: number } {
  const made: Row[] = [];
  let row: Row = { at: [], width: 0, height: 0 };
  let total = 0;
  for (let i = 0; i < list.length; i++) {
    const size = sizeOf(list[i], scale, W);
    const w = list[i].wide * size + gapX(size), h = size * LINE + GAP_Y;
    if (row.at.length && row.width + w > W) { made.push(row); total += row.height; row = { at: [], width: 0, height: 0 }; }
    row.at.push(i);
    row.width += w;
    row.height = Math.max(row.height, h);
  }
  made.push(row);
  return { made, total: total + row.height };
}

/** Rows, the most sent in the middle row and the rest in turn under and over it, each row's largest in its middle:
 *  always fits. The words are as large as the box holds, down to `floor`; past that a box that may grow does, and one
 *  that may not (`fixed`) has its words shrunk until the rows fit. */
function rows(list: Word[], floor: number, W: number, H: number, fixed: boolean): CloudLayout {
  let scale = 1;
  let fit = rowsAt(list, scale, W);
  if (fit.total > H) {
    scale = floor;
    fit = rowsAt(list, scale, W);
    if (fit.total <= H) {
      // the largest size whose rows the box holds, between the smallest and full size
      let lo = floor, hi = 1;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        const at = rowsAt(list, mid, W);
        if (at.total <= H) { lo = mid; scale = mid; fit = at; } else hi = mid;
      }
    } else if (fixed) {
      for (let i = 0; i < 80 && fit.total > H; i++) {
        scale *= Math.max(0.5, Math.min(0.95, Math.sqrt(H / fit.total)));
        fit = rowsAt(list, scale, W);
      }
    }
  }
  // top to bottom: ... third, first, second, fourth ...
  const order: Row[] = [];
  fit.made.forEach((r, i) => (i % 2 ? order.push(r) : order.unshift(r)));
  // a box of its own height is as high as its rows, with a little air above and below them
  const height = fixed ? H : Math.max(LEAST_HIGH, Math.ceil(fit.total) + 2 * PAD);
  const items: Placed[] = new Array(list.length);
  let y = Math.max(0, (height - fit.total) / 2);
  for (const r of order) {
    const across: number[] = [];
    r.at.forEach((i, k) => (k % 2 ? across.push(i) : across.unshift(i)));
    let x = Math.max(0, (W - r.width) / 2);
    for (const i of across) {
      const size = sizeOf(list[i], scale, W);
      const p = placed(list[i], size, x, y + (r.height - (size * LINE + GAP_Y)) / 2);
      items[i] = p;
      x += p.width;
    }
    y += r.height;
  }
  return { height, items };
}
