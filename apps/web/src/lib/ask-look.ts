import { sized } from "./img";

// How an Ask page and its questions look (contract section A): `look` is free jsonb staff set on a page and on each
// question. Everything that reads it is here - the theme, the palettes, each chart's choices - and anything it does
// not know falls back to the default, so a look written by a newer staff app never breaks a page.
//
// Colour: a chart is drawn on one of two surfaces, the white card of the light, green and sand themes or the ink card
// of the dark one. Each palette has six colours for each surface, stepped so two neighbours always tell apart (the
// dataviz validator: lightness band, chroma, colour-blind and normal separation - scratchpad p2/final.mjs holds the
// run), every light one 4.5:1 or more on white (cloud words are written in them), every dark one 3:1 or more on the
// ink card, and each able to carry a label in white or in ink at 4.5:1. On the dark card coloured WORDS take a lighter
// tint of the same hue (4.5:1 on ink), which a filled mark does not need. Mono is one hue by design: its six greys
// are ordered so neighbours stand 15 or more apart in lightness.

type Raw = Readonly<Record<string, unknown>>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const obj = (v: unknown): Raw | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null);
const oneOf = <T extends string>(v: unknown, all: readonly T[]): T => ((all as readonly unknown[]).includes(v) ? (v as T) : all[0]);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------------ themes and surfaces */

export const ASK_THEMES = ["light", "dark", "green", "sand"] as const;
export type AskTheme = (typeof ASK_THEMES)[number];
/** The page's theme: the ONE place a page's `look.theme` is read (ask.css holds each theme's tokens under
 *  .ask[data-ask-theme]). An unknown name is the light, cream page. */
export const askTheme = (pageLook: Raw): AskTheme => oneOf(pageLook.theme, ASK_THEMES);

export type AskSurface = "light" | "dark";
/** The surface a theme's charts are drawn on: every theme but the dark one keeps white cards. */
export const surfaceOf = (theme: AskTheme): AskSurface => (theme === "dark" ? "dark" : "light");
/** The two surfaces' card and text colours (ask.css --ask-card and --ask-ink; a test holds the two files together). */
export const SURFACES = { light: { card: "#ffffff", ink: "#1a1919" }, dark: { card: "#1a1919", ink: "#fbf9f4" } } as const;
export const NEON = "#03ff89";

/* ------------------------------------------------------------------ palettes */

export const ASK_PALETTES = {
  brand: ["#077a4b", "#79268b", "#897202", "#4e3baa", "#b04700", "#0050a0"],
  forest: ["#00823a", "#7b4200", "#538002", "#883500", "#03845f", "#865900"],
  ocean: ["#0050a0", "#067f5c", "#3144ae", "#03642b", "#027daf", "#6331a0"],
  sunset: ["#883500", "#695bcd", "#aa5e03", "#6331a0", "#926d01", "#79268b"],
  berry: ["#931157", "#6d5fd2", "#9b0c28", "#4f69d6", "#8a1a6f", "#0161bd"],
  mono: ["#1a1919", "#565d58", "#29302b", "#6b726d", "#3f4641", "#6f7771"],
} as const satisfies Record<string, readonly string[]>;
export type AskPaletteName = keyof typeof ASK_PALETTES;
/** The same six on the dark theme's ink card: the palette's hues, stepped for that surface. */
export const ASK_PALETTES_DARK: Record<AskPaletteName, readonly string[]> = {
  brand: ["#06b06e", "#7e4fbf", "#af9306", "#0d6bcc", "#d87903", "#6758ca"],
  forest: ["#28b058", "#926203", "#03af7f", "#a15800", "#71a81d", "#b14802"],
  ocean: ["#0d6bcc", "#03af7f", "#4862ce", "#04833b", "#7e4fbf", "#0ca9b0"],
  sunset: ["#db611c", "#6758ca", "#d87903", "#7e4fbf", "#bb8d05", "#9744a9"],
  berry: ["#b33672", "#8c81f7", "#bb3542", "#6d8bfc", "#a93b8c", "#378bee"],
  mono: ["#e3eae5", "#888e89", "#bfc6c1", "#696f6b", "#a3aaa5", "#707672"],
};
/** The tints coloured words are written in on the ink card (a word cloud's words): each dark step's own hue, lighter. */
export const ASK_WORDS_DARK: Record<AskPaletteName, readonly string[]> = {
  brand: ["#62e3a0", "#b48df4", "#e2c653", "#60a7ff", "#ffb475", "#9c95fe"],
  forest: ["#77e191", "#cd9a4e", "#5ce3b0", "#de904c", "#a6da6c", "#f0824e"],
  ocean: ["#60a7ff", "#5ce3b0", "#819eff", "#57be72", "#b48df4", "#5ddde4"],
  sunset: ["#fea278", "#9c95fe", "#ffb475", "#b48df4", "#efc053", "#ce83de"],
  berry: ["#ec79a9", "#c0bffe", "#f47a7d", "#b1c5fe", "#e17cc2", "#8ec0fe"],
  mono: ["#e3eae5", "#b9c0ba", "#cfd6d1", "#a0a6a2", "#d6ddd8", "#aeb5b0"],
};
const paletteName = (v: unknown): AskPaletteName | null => (typeof v === "string" && Object.hasOwn(ASK_PALETTES, v) ? (v as AskPaletteName) : null);
/** A question's chart colours: its own `look.palette`, else the page's, else the brand's. */
export const askPalette = (questionLook: Raw, pageLook: Raw): AskPaletteName => paletteName(questionLook.palette) ?? paletteName(pageLook.palette) ?? "brand";

/* -- colour sums: sRGB hex in, hex out ------------------------------------------------------------------ */
const rgb = (hex: string): [number, number, number] => { const h = hex.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]; };
const hex = (c: number[]) => "#" + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
/** `a` with `t` (0 to 1) of `b` mixed in. */
export const mix = (a: string, b: string, t: number): string => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * clamp(t, 0, 1))); };
const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
/** WCAG relative luminance and contrast ratio. */
export const luminance = (h: string): number => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string): number => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const WHITE = "#ffffff", INK = "#1a1919";
/** What is written inside a filled mark: white or ink, whichever reads better on it. */
export const onColor = (fill: string): string => (contrast(fill, WHITE) >= contrast(fill, INK) ? WHITE : INK);

/** One hue in `n` steps for ordered values (a scale's marks, a heat map's counts), the least first: from a tint of the
 *  mark on the card, through the mark itself, to a shade of it - so more always reads as more ink on the white card and
 *  more light on the ink one. No step lands where neither white nor ink would read on it. */
export function ramp(mark: string, surface: AskSurface, n: number): string[] {
  const { card, ink } = SURFACES[surface];
  const count = Math.max(1, Math.floor(n));
  const at = (p: number) => (p <= 0.7 ? mix(card, mark, 0.34 + (p / 0.7) * 0.66) : mix(mark, ink, ((p - 0.7) / 0.3) * 0.38));
  return Array.from({ length: count }, (_, i) => {
    let p = count === 1 ? 0.7 : i / (count - 1);
    let c = at(p);
    // nudged toward the strong end until a label reads on it (4.5:1 in white or ink)
    for (let k = 0; k < 12 && Math.max(contrast(c, WHITE), contrast(c, INK)) < 4.5; k++) { p = Math.min(1, p + 0.025); c = at(p); }
    return c;
  });
}

export type AskColors = {
  /** The six a chart of several things fills its marks with, and what is written inside each. */
  fills: readonly string[]; on: readonly string[];
  /** The six coloured words are written in. */
  words: readonly string[];
  /** The one colour of a chart of one thing (bars, columns, a track), and what is written inside it. */
  mark: string; onMark: string;
  surface: AskSurface;
};
/** A palette's colours on a surface. The dark theme's single mark is the neon, as the theme is: ink page, neon marks -
 *  for the brand's palette; another palette keeps its own first colour. */
export function askColors(name: AskPaletteName, surface: AskSurface): AskColors {
  const fills = surface === "dark" ? ASK_PALETTES_DARK[name] : ASK_PALETTES[name];
  const mark = surface === "dark" && name === "brand" ? NEON : fills[0];
  return { fills, on: fills.map(onColor), words: surface === "dark" ? ASK_WORDS_DARK[name] : fills, mark, onMark: onColor(mark), surface };
}
/** The colour of the i-th of several things, and what is written inside it. The first six are the palette's; a
 *  seventh to a twelfth (a question of many options) take the same six again as a tint toward the card - told from
 *  their first lap by the number and the name every chart writes beside its marks, never by colour alone. */
export function seriesColor(c: AskColors, i: number): { fill: string; on: string } {
  const k = ((i % c.fills.length) + c.fills.length) % c.fills.length;
  if (i < c.fills.length) return { fill: c.fills[k], on: c.on[k] };
  const { card } = SURFACES[c.surface];
  let t = 0.42, fill = mix(c.fills[k], card, t);
  while (Math.max(contrast(fill, WHITE), contrast(fill, INK)) < 4.5 && t < 0.74) { t += 0.04; fill = mix(c.fills[k], card, t); }
  return { fill, on: onColor(fill) };
}

/** The palette as the custom properties a results box sets: --ask-c0..5 (fills), --ask-on0..5 (what is written inside
 *  each), --ask-w0..5 (coloured words), --ask-mark and --ask-on-mark. A chart draws with these and names no colour. */
export function paletteVars(name: AskPaletteName, surface: AskSurface = "light"): Record<string, string> {
  const c = askColors(name, surface);
  const out: Record<string, string> = { "--ask-mark": c.mark, "--ask-on-mark": c.onMark };
  c.fills.forEach((v, i) => { out[`--ask-c${i}`] = v; out[`--ask-on${i}`] = c.on[i]; out[`--ask-w${i}`] = c.words[i]; });
  return out;
}

/* ------------------------------------------------------------------ a page's look */

export type ScreenLook = { qr: boolean; count: boolean; rotate: number };
export type PageLook = {
  theme: AskTheme; palette: AskPaletteName | null;
  /** The five reaction buttons under each question (and their counts on the big screen): off unless staff turn them on. */
  reactions: boolean;
  /** A picture across the top, as the page draws it (lib/ask-look.ts askImage), or null. */
  cover: string | null;
  thanks_en: string; thanks_ar: string;
  layout: "stack" | "steps";
  screen: ScreenLook;
};
const flag = (v: unknown, dflt: boolean) => (typeof v === "boolean" ? v : dflt);
/** A page's `look`, every key at its value or its default. `rotate`: seconds a question stays on the big screen before
 *  the next comes on by itself, 0 for never; at least 5 and at most 600 when set. Thanks lines are cut at 120. */
export function pageLook(raw: unknown): PageLook {
  const l = obj(raw) ?? {};
  const s = obj(l.screen) ?? {};
  const rotate = typeof s.rotate === "number" && Number.isFinite(s.rotate) && s.rotate > 0 ? clamp(Math.round(s.rotate), 5, 600) : 0;
  const cut = (v: unknown) => [...str(v).replace(/\s+/g, " ").trim()].slice(0, 120).join("");
  return {
    theme: askTheme(l), palette: paletteName(l.palette), reactions: l.reactions === true, cover: askImage(l.cover, 1280), thanks_en: cut(l.thanks_en), thanks_ar: cut(l.thanks_ar),
    layout: oneOf(l.layout, ["stack", "steps"] as const),
    screen: { qr: flag(s.qr, true), count: flag(s.count, true), rotate },
  };
}

/** A picture's address as a page draws it: https only. One of the site's own uploads (the `site` storage bucket, or
 *  its /media address on micromobility.sa) is drawn from /media, the way the site's other pictures are, at about `w`
 *  pixels wide; any other https picture as it is. */
export function askImage(v: unknown, w = 1280): string | null {
  if (typeof v !== "string" || v.length > 500 || !/^https:\/\/[^\s"'<>]+$/i.test(v)) return null;
  const store = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const own = store && v.startsWith(`${store}/storage/v1/object/public/site/`) ? v.slice(`${store}/storage/v1/object/public/site/`.length)
    : /^https:\/\/(?:www\.|staging\.)?micromobility\.sa\/media\//i.test(v) ? v.replace(/^https:\/\/[^/]+\/media\//i, "") : null;
  // only what the media route serves: a folder, then a plain file name - and no query of its own
  if (own && /^[a-z0-9_-]+(\/[A-Za-z0-9_.-]+)+$/.test(own) && !own.includes("..")) return sized(`/media/${own}`, w);
  return v;
}

/* ------------------------------------------------------------------ a question's look */

/** The charts each kind can be drawn with, by the names staff pick (`look.viz`); the FIRST is the kind's default. */
export const ASK_VIZ: Readonly<Record<string, readonly string[]>> = {
  cloud: ["cloud", "bubbles", "bars", "tiles", "list"],
  open: ["cards", "wall", "spotlight", "stream"],
  qa: ["list", "spotlight"],
  choice: ["bars", "columns", "donut", "pie", "dots", "tiles"],
  scales: ["tracks", "radar", "stacked", "heat"],
  ranking: ["bars", "podium", "ladder"],
  points: ["bars", "donut", "tiles"],
  number: ["histogram", "gauge", "strip"],
  // stage 2 (contract H4). A form has nothing public but its count: one view, which staff never pick.
  grid: ["scatter"],
  pin: ["dots", "heat"],
  quiz: ["bars", "columns"],
  quiz_text: ["list", "cloud"],
  form: ["count"],
};
/** The chart a question's results are drawn with: its `look.viz` when that chart is built for its kind, else the
 *  kind's first (its default). `built` is the kind's row of the charts' registry (components/ask/results). */
export function askViz(questionLook: Raw, built: readonly string[]): string | null {
  const asked = questionLook.viz;
  return typeof asked === "string" && built.includes(asked) ? asked : built[0] ?? null;
}

export type QuestionLook = {
  /** `given`: the order staff wrote; `count`: the largest first. */
  sort: "given" | "count";
  /** The numbers written on a chart. */
  values: "both" | "count" | "percent" | "none";
  /** Whether the chart says how many answered. */
  total: boolean;
  /** How many entries a chart of entries shows (words, answers): 10 to 150, or null for the chart's own. */
  limit: number | null;
  case: "typed" | "upper" | "lower";
  angle: "flat" | "mixed";
  size: "m" | "s" | "l";
};
/** A question's `look`, every key at its value or its default. */
export function questionLook(raw: unknown): QuestionLook {
  const l = obj(raw) ?? {};
  const limit = typeof l.limit === "number" && Number.isFinite(l.limit) ? clamp(Math.round(l.limit), 10, 150) : null;
  return {
    sort: oneOf(l.sort, ["given", "count"] as const), values: oneOf(l.values, ["both", "count", "percent", "none"] as const), total: flag(l.total, true), limit,
    case: oneOf(l.case, ["typed", "upper", "lower"] as const), angle: oneOf(l.angle, ["flat", "mixed"] as const), size: oneOf(l.size, ["m", "s", "l"] as const),
  };
}
/** How many entries a chart of entries shows when staff set no `limit`: 60 words in a cloud, 10 in bars and lists (the
 *  contract's), 30 bubbles and 16 tiles (as many as stay readable), and every written answer the database sends. */
export const VIZ_LIMIT: Readonly<Record<string, number>> = { cloud: 60, bubbles: 30, bars: 10, list: 10, tiles: 16 };
export const limitOf = (look: QuestionLook, viz: string, most = 150): number => clamp(look.limit ?? VIZ_LIMIT[viz] ?? most, 1, most);

/** The entries a chart of words draws: the most sent first, as many as the look's `limit` (else the chart's own),
 *  written in the look's `case` - two entries that the case makes one are counted together. */
export function lookWords(words: readonly { w: string; n: number }[], look: QuestionLook, viz: string, locale: string): { w: string; n: number }[] {
  const seen = new Map<string, { w: string; n: number }>();
  for (const x of words) {
    const w = cased(x.w, look.case, locale);
    const had = seen.get(w);
    if (had) had.n += x.n; else seen.set(w, { w, n: x.n });
  }
  return [...seen.values()].map((x, i) => ({ x, i })).sort((p, q) => q.x.n - p.x.n || p.i - q.i).slice(0, limitOf(look, viz)).map(({ x }) => x);
}

/** A word as a cloud writes it (`look.case`), in the reader's language's own casing rules. */
export function cased(word: string, how: QuestionLook["case"], locale: string): string {
  if (how === "typed") return word;
  try { return how === "upper" ? word.toLocaleUpperCase(locale) : word.toLocaleLowerCase(locale); } catch { return how === "upper" ? word.toUpperCase() : word.toLowerCase(); }
}
