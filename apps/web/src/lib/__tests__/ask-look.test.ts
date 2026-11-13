import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RESULT_VIEWS } from "../../components/ask/results";
import { ASK_DRAWN } from "../ask";
import {
  ASK_PALETTES, ASK_PALETTES_DARK, ASK_THEMES, ASK_VIZ, ASK_WORDS_DARK, NEON, SURFACES, VIZ_LIMIT,
  askColors, askImage, askPalette, askTheme, askViz, cased, contrast, limitOf, lookWords, mix, onColor, pageLook, paletteVars, questionLook, ramp, seriesColor, surfaceOf,
  type AskPaletteName,
} from "../ask-look";

// How an Ask page and its questions look (lib/ask-look.ts): `look` is free jsonb staff set, so everything that reads
// it must take anything - and the colours it leads to must read: the numbers here are the WCAG ones.
const NAMES = Object.keys(ASK_PALETTES) as AskPaletteName[];
const CSS = readFileSync(new URL("../../components/ask/ask.css", import.meta.url), "utf8");

describe("the page's theme", () => {
  it("is read in one place: one of the four, the light page otherwise", () => {
    expect(askTheme({})).toBe("light");
    for (const t of ASK_THEMES) expect(askTheme({ theme: t })).toBe(t);
    expect(askTheme({ theme: "neon" })).toBe("light");
    expect(askTheme({ theme: 3 })).toBe("light");
    expect(ASK_THEMES).toEqual(["light", "dark", "green", "sand"]);
  });
  it("draws its charts on a white card, or on the ink card of the dark theme", () => {
    expect(ASK_THEMES.map(surfaceOf)).toEqual(["light", "dark", "light", "light"]);
  });
  it("has its tokens in the stylesheet: a block a theme, and the two cards' colours as the sums here hold them", () => {
    for (const t of ["dark", "green", "sand"]) expect(CSS, t).toContain(`.ask[data-ask-theme="${t}"] {`);
    const block = (from: string) => { const at = CSS.indexOf(from); return CSS.slice(at, CSS.indexOf("\n}", at)); };
    const token = (css: string, name: string) => new RegExp(`${name}: (#[0-9a-f]{6});`).exec(css)?.[1];
    const light = block(".ask, .ask-light {"), dark = block('.ask[data-ask-theme="dark"] {');
    expect(token(light, "--ask-card")).toBe(SURFACES.light.card);
    expect(token(light, "--ask-ink")).toBe(SURFACES.light.ink);
    expect(token(dark, "--ask-card")).toBe(SURFACES.dark.card);
    expect(token(dark, "--ask-ink")).toBe(SURFACES.dark.ink);
    // before a results box sets its palette, the stylesheet's own is the brand's
    ASK_PALETTES.brand.forEach((c, i) => { expect(token(light, `--ask-c${i}`)).toBe(c); expect(token(light, `--ask-w${i}`)).toBe(c); });
    expect(token(light, "--ask-mark")).toBe(ASK_PALETTES.brand[0]);
  });
  it("keeps every theme's text on its ground at 4.5:1 or more, and a control's outline at 3:1", () => {
    const block = (from: string) => { const at = CSS.indexOf(from); return CSS.slice(at, CSS.indexOf("\n}", at)); };
    const read = (css: string) => Object.fromEntries([...css.matchAll(/(--ask-[a-z0-9-]+): (#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]));
    const base = { ...read(block(".ask, .ask-light {")), ...read(block(".ask {")) };
    for (const theme of ASK_THEMES) {
      const t = theme === "light" ? base : { ...base, ...read(block(`.ask[data-ask-theme="${theme}"] {`)) };
      const pairs: [string, string, number][] = [
        ["--ask-pg-ink", "--ask-page", 4.5], ["--ask-pg-ink2", "--ask-page", 4.5], ["--ask-pg-on-btn", "--ask-pg-btn", 4.5], ["--ask-on-pill", "--ask-pill", 4.5],
        ["--ask-pg-accent", "--ask-page", 3], ["--ask-pg-rim", "--ask-page", 3],
        ["--ask-ink", "--ask-card", 4.5], ["--ask-ink2", "--ask-card", 4.5], ["--ask-ink3", "--ask-card", 4.5], ["--ask-ink", "--ask-soft", 4.5], ["--ask-ink2", "--ask-soft", 4.5],
        ["--ask-on-accent", "--ask-accent", 4.5], ["--ask-accent", "--ask-card", 4.5], ["--ask-bad", "--ask-card", 4.5], ["--ask-good", "--ask-card", 4.5], ["--ask-on-sel", "--ask-sel", 4.5],
        ["--ask-on-chip", "--ask-chip", 4.5], ["--ask-on-chip-wait", "--ask-chip-wait", 4.5], ["--ask-on-chip-no", "--ask-chip-no", 4.5], ["--ask-on-chip-done", "--ask-chip-done", 4.5],
        ["--ask-rim", "--ask-card", 3],
      ];
      for (const [text, ground, least] of pairs) expect(contrast(t[text], t[ground]), `${theme}: ${text} on ${ground}`).toBeGreaterThanOrEqual(least);
    }
  });
});

describe("palettes", () => {
  it("takes a question's chart colours from its own palette, else the page's, else the brand's", () => {
    expect(askPalette({}, {})).toBe("brand");
    expect(askPalette({ palette: "ocean" }, { palette: "berry" })).toBe("ocean");
    expect(askPalette({}, { palette: "berry" })).toBe("berry");
    expect(askPalette({ palette: "rainbow" }, { palette: "mono" })).toBe("mono");
    expect(askPalette({ palette: "toString" }, {})).toBe("brand");
    expect(NAMES).toEqual(["brand", "forest", "ocean", "sunset", "berry", "mono"]);
  });
  it("has six colours a palette for each card, every one a plain hex and no two the same", () => {
    for (const set of [ASK_PALETTES, ASK_PALETTES_DARK, ASK_WORDS_DARK]) {
      expect(Object.keys(set)).toEqual(NAMES);
      for (const name of NAMES) {
        expect(set[name]).toHaveLength(6);
        for (const c of set[name]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
        expect(new Set(set[name]).size, name).toBe(6);
      }
    }
  });
  it("reads on its card: a light colour 4.5:1 on white (words are written in it), a dark one 3:1 on ink and its word tint 4.5:1", () => {
    for (const name of NAMES) {
      for (const c of ASK_PALETTES[name]) expect(contrast(c, SURFACES.light.card), `${name} ${c}`).toBeGreaterThanOrEqual(4.5);
      for (const c of ASK_PALETTES_DARK[name]) expect(contrast(c, SURFACES.dark.card), `${name} ${c} dark`).toBeGreaterThanOrEqual(3);
      for (const c of ASK_WORDS_DARK[name]) expect(contrast(c, SURFACES.dark.card), `${name} ${c} word`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("can carry a label inside every colour, in white or in ink, at 4.5:1", () => {
    for (const surface of ["light", "dark"] as const) for (const name of NAMES) {
      const c = askColors(name, surface);
      c.fills.forEach((fill, i) => {
        expect(["#ffffff", "#1a1919"]).toContain(c.on[i]);
        expect(contrast(fill, c.on[i]), `${surface} ${name} ${fill}`).toBeGreaterThanOrEqual(4.5);
      });
      expect(contrast(c.mark, c.onMark), `${surface} ${name} mark`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.mark, SURFACES[surface].card), `${surface} ${name} mark on its card`).toBeGreaterThanOrEqual(3);
      // a seventh to a twelfth thing: the same six as tints, each still able to carry its label
      for (let i = 6; i < 12; i++) {
        const s = seriesColor(c, i);
        expect(contrast(s.fill, s.on), `${surface} ${name} #${i + 1}`).toBeGreaterThanOrEqual(4.5);
        expect(s.fill).not.toBe(c.fills[i - 6]);
      }
      expect(seriesColor(c, 2)).toEqual({ fill: c.fills[2], on: c.on[2] });
    }
  });
  it("draws a chart of one thing in the palette's first colour - and in the neon on the dark theme's own palette", () => {
    expect(askColors("brand", "light").mark).toBe(ASK_PALETTES.brand[0]);
    expect(askColors("brand", "dark").mark).toBe(NEON);
    expect(askColors("ocean", "dark").mark).toBe(ASK_PALETTES_DARK.ocean[0]);
    expect(askColors("ocean", "dark").words).toBe(ASK_WORDS_DARK.ocean);
    expect(askColors("ocean", "light").words).toBe(ASK_PALETTES.ocean);
  });
  it("hands a results box its colours as custom properties", () => {
    const v = paletteVars("brand");
    expect(v["--ask-mark"]).toBe("#077a4b");
    expect(v["--ask-on-mark"]).toBe("#ffffff");
    expect([0, 1, 2, 3, 4, 5].map((i) => v[`--ask-c${i}`])).toEqual([...ASK_PALETTES.brand]);
    expect([0, 1, 2, 3, 4, 5].map((i) => v[`--ask-w${i}`])).toEqual([...ASK_PALETTES.brand]);
    expect(Object.keys(v)).toHaveLength(20);
    const d = paletteVars("berry", "dark");
    expect(d["--ask-c0"]).toBe(ASK_PALETTES_DARK.berry[0]);
    expect(d["--ask-w0"]).toBe(ASK_WORDS_DARK.berry[0]);
    expect(d["--ask-on0"]).toBe(onColor(ASK_PALETTES_DARK.berry[0]));
  });
  it("steps one hue for ordered values: more is more ink on white and more light on ink, and every step takes a label", () => {
    const lum = (hex: string) => contrast(hex, "#000000");
    for (const surface of ["light", "dark"] as const) for (const name of NAMES) for (const n of [1, 3, 5, 10]) {
      const steps = ramp(askColors(name, surface).mark, surface, n);
      expect(steps).toHaveLength(n);
      for (const s of steps) expect(Math.max(contrast(s, "#ffffff"), contrast(s, "#1a1919")), `${surface} ${name} ${n} ${s}`).toBeGreaterThanOrEqual(4.5);
      for (let i = 1; i < n; i++) {
        if (surface === "light") expect(lum(steps[i]), `${name} ${n} step ${i}`).toBeLessThanOrEqual(lum(steps[i - 1]) + 1e-9);
        else expect(lum(steps[i]), `${name} ${n} dark step ${i}`).toBeGreaterThanOrEqual(lum(steps[i - 1]) - 1e-9);
      }
    }
    expect(ramp("#077a4b", "light", 0)).toHaveLength(1);
  });
  it("mixes two colours and picks what is written on one", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#077a4b", "#ffffff", 0)).toBe("#077a4b");
    expect(mix("#077a4b", "#ffffff", 4)).toBe("#ffffff");
    expect(onColor("#077a4b")).toBe("#ffffff");
    expect(onColor(NEON)).toBe("#1a1919");
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });
});

describe("a page's look", () => {
  it("is all defaults for a look that is empty, missing or not a look at all", () => {
    const plain = { theme: "light", palette: null, cover: null, thanks_en: "", thanks_ar: "", layout: "stack", screen: { qr: true, count: true, rotate: 0 } };
    for (const raw of [{}, null, undefined, "dark", 7, [], { theme: "plaid", layout: "grid", screen: "all", palette: "rainbow", cover: 12, thanks_en: 4 }]) expect(pageLook(raw), JSON.stringify(raw)).toEqual(plain);
  });
  it("reads every key it knows", () => {
    const l = pageLook({ theme: "green", palette: "ocean", cover: "https://cdn.example.com/a.jpg", thanks_en: "  Thank   you! ", thanks_ar: "شكراً", layout: "steps", screen: { qr: false, code: false, count: false, rotate: 20 }, later: "ignored" });
    expect(l).toEqual({ theme: "green", palette: "ocean", cover: "https://cdn.example.com/a.jpg", thanks_en: "Thank you!", thanks_ar: "شكراً", layout: "steps", screen: { qr: false, count: false, rotate: 20 } });
  });
  it("cuts a thanks line at 120 characters and keeps the screen's own pace between 5 seconds and 10 minutes", () => {
    expect([...pageLook({ thanks_en: "x".repeat(300) }).thanks_en]).toHaveLength(120);
    expect([...pageLook({ thanks_ar: "ش".repeat(300) }).thanks_ar]).toHaveLength(120);
    const rotate = (v: unknown) => pageLook({ screen: { rotate: v } }).screen.rotate;
    expect([0, -4, 2, 5, 12.4, 9999, "20", null, Number.NaN, Infinity].map(rotate)).toEqual([0, 0, 5, 5, 12, 600, 0, 0, 0, 0]);
    expect(pageLook({ screen: { qr: "no" } }).screen.qr).toBe(true);
  });
  it("draws a picture only from an https address, and one of the site's own uploads through /media", () => {
    expect(askImage("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
    for (const bad of ["http://cdn.example.com/a.jpg", "//cdn.example.com/a.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "https://a.example/x y.jpg", 'https://a.example/x".jpg', "", null, 4, `https://a.example/${"a".repeat(500)}`]) {
      expect(askImage(bad), String(bad).slice(0, 40)).toBeNull();
    }
    expect(askImage("https://micromobility.sa/media/ask/cover-1.jpg")).toBe("/media/ask/cover-1.jpg?w=1280");
    expect(askImage("https://www.micromobility.sa/media/ask/cover-1.jpg", 600)).toBe("/media/ask/cover-1.jpg?w=640");
    expect(askImage("https://staging.micromobility.sa/media/pages/a/b.webp", 960)).toBe("/media/pages/a/b.webp?w=1280");
    // an address under /media that the media route would not serve stays as it is - it is never rewritten into a path
    expect(askImage("https://micromobility.sa/media/../admin")).toBe("https://micromobility.sa/media/../admin");
    expect(askImage("https://micromobility.sa/media/a.jpg?w=9")).toBe("https://micromobility.sa/media/a.jpg?w=9");
  });
});

describe("a question's look", () => {
  it("is all defaults for a look that is empty or not a look", () => {
    const plain = { sort: "given", values: "both", total: true, limit: null, case: "typed", angle: "flat", size: "m" };
    for (const raw of [{}, null, "bars", [], { sort: "random", values: "all", total: "yes", limit: "many", case: "title", angle: "tilted", size: "xl" }]) expect(questionLook(raw), JSON.stringify(raw)).toEqual(plain);
  });
  it("reads every key it knows, and keeps `limit` between 10 and 150", () => {
    expect(questionLook({ sort: "count", values: "percent", total: false, limit: 40, case: "upper", angle: "mixed", size: "l" }))
      .toEqual({ sort: "count", values: "percent", total: false, limit: 40, case: "upper", angle: "mixed", size: "l" });
    expect([3, 10, 75.6, 400, Number.NaN].map((limit) => questionLook({ limit }).limit)).toEqual([10, 10, 76, 150, null]);
  });
  it("shows a chart's own number of entries until staff set one", () => {
    const none = questionLook({});
    expect(VIZ_LIMIT).toMatchObject({ cloud: 60, bars: 10, list: 10 });
    expect(limitOf(none, "cloud")).toBe(60);
    expect(limitOf(none, "bars")).toBe(10);
    expect(limitOf(none, "list")).toBe(10);
    expect(limitOf(none, "wall")).toBe(150);
    expect(limitOf(questionLook({ limit: 25 }), "cloud")).toBe(25);
    expect(limitOf(questionLook({ limit: 25 }), "bars")).toBe(25);
  });
  it("draws a question with the chart staff picked when it is built, with the kind's first otherwise", () => {
    expect(askViz({}, ["cloud", "bubbles"])).toBe("cloud");
    expect(askViz({ viz: "bubbles" }, ["cloud", "bubbles"])).toBe("bubbles");
    expect(askViz({ viz: "treemap" }, ["cloud", "bubbles"])).toBe("cloud");
    expect(askViz({ viz: 4 }, ["bars"])).toBe("bars");
    expect(askViz({}, [])).toBeNull();
  });
  it("has every chart the contract names built, under the same names and with the same one first", () => {
    for (const kind of ASK_DRAWN) {
      if (kind === "info") { expect(ASK_VIZ[kind]).toBeUndefined(); continue; }
      expect(Object.keys(RESULT_VIEWS[kind] ?? {}), kind).toEqual([...ASK_VIZ[kind]]);
    }
    expect(Object.keys(ASK_VIZ).sort()).toEqual(Object.keys(RESULT_VIEWS).sort());
    expect(Object.values(ASK_VIZ).flat()).toHaveLength(30);
  });
});

describe("a chart's words", () => {
  const words = [{ w: "Shade", n: 2 }, { w: "more bikes", n: 9 }, { w: "shade", n: 4 }, { w: "Music", n: 4 }, { w: "water", n: 1 }];
  it("puts the most sent first and keeps what was sent as it was typed", () => {
    expect(lookWords(words, questionLook({}), "cloud", "en").map((x) => `${x.w}:${x.n}`)).toEqual(["more bikes:9", "shade:4", "Music:4", "Shade:2", "water:1"]);
  });
  it("writes them in the look's case, counting together what the case makes one", () => {
    expect(lookWords(words, questionLook({ case: "upper" }), "cloud", "en").map((x) => `${x.w}:${x.n}`)).toEqual(["MORE BIKES:9", "SHADE:6", "MUSIC:4", "WATER:1"]);
    expect(lookWords(words, questionLook({ case: "lower" }), "cloud", "en").map((x) => `${x.w}:${x.n}`)).toEqual(["more bikes:9", "shade:6", "music:4", "water:1"]);
    expect(cased("istanbul", "upper", "tr")).toBe("İSTANBUL");
    expect(cased("Ride", "typed", "en")).toBe("Ride");
    expect(cased("مرحبا", "upper", "ar")).toBe("مرحبا");
    expect(cased("Ride", "lower", "not a locale")).toBe("ride");
  });
  it("shows as many as the chart's own number, or as staff set", () => {
    const many = Array.from({ length: 90 }, (_, i) => ({ w: `w${i}`, n: 90 - i }));
    expect(lookWords(many, questionLook({}), "cloud", "en")).toHaveLength(60);
    expect(lookWords(many, questionLook({}), "bars", "en").map((x) => x.w)).toEqual(many.slice(0, 10).map((x) => x.w));
    expect(lookWords(many, questionLook({ limit: 25 }), "list", "en")).toHaveLength(25);
    expect(lookWords([], questionLook({}), "cloud", "en")).toEqual([]);
  });
});
