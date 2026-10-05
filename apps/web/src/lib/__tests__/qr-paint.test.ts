import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import qrcode from "qrcode-generator";
import { paintQr, qrEdge, qrRects, QR_DARK, QR_LIGHT } from "../qr-paint";
import Qr from "../../components/booking/Qr";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// The ticket's code painted on a canvas (QrCanvas.tsx), which a phone's dark mode leaves as it is
// (the owner, 2026-10-05: "the dark qr codes arent getting scanned properly"): the same tile as the
// svg's viewBox, every module on whole device pixels, and nothing but the code's own two colours.
const code = (payload: string) => {
  const qr = qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  const n = qr.getModuleCount();
  let bits = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) bits += qr.isDark(r, c) ? "1" : "0";
  return { n, bits, dark: (r: number, c: number) => qr.isDark(r, c) };
};

// The rectangles laid on a px-by-px grid of pixels: 1 where dark, and how often each was painted.
const raster = (rects: [number, number, number, number][], px: number) => {
  const g = new Uint8Array(px * px);
  for (const [x, y, w, h] of rects) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j * px + i]++;
  return g;
};

describe("the ticket's code as pixels", () => {
  const { n, bits, dark } = code("MMC-4-q1abcd");

  it("keeps the svg's tile: 6px of white round a 132px tile, the code in whole pixels", () => {
    expect(qrEdge(n, 0, 132)).toBe(6);
    expect(qrEdge(n, n, 132)).toBe(126);
    expect(qrEdge(n, 0, 396)).toBe(18); // three device pixels a CSS pixel
    expect(qrEdge(n, n, 396)).toBe(378);
    for (let k = 0; k < n; k++) expect(qrEdge(n, k + 1, 132)).toBeGreaterThan(qrEdge(n, k, 132));
  });

  for (const px of [116, 132, 174, 232, 264, 346, 347, 348, 396]) {
    it(`paints exactly the dark modules on a ${px}px tile, with no hairline between them`, () => {
      const rects = qrRects(n, bits, px);
      for (const r of rects) for (const v of r) expect(Number.isInteger(v)).toBe(true);
      const g = raster(rects, px);
      expect(g.every((v) => v <= 1)).toBe(true); // no pixel painted twice
      const e = Array.from({ length: n + 1 }, (_, k) => qrEdge(n, k, px));
      const unit = px / (1.1 * n);
      for (let k = 0; k < n; k++) {
        // every module is a module wide, give or take the one pixel its edges were snapped by
        expect(e[k + 1] - e[k]).toBeGreaterThanOrEqual(Math.floor(unit));
        expect(e[k + 1] - e[k]).toBeLessThanOrEqual(Math.ceil(unit));
      }
      // a pixel is dark exactly when the module it lies in is: the margin and the light modules white
      const at = (v: number) => (v < e[0] || v >= e[n] ? -1 : e.findIndex((edge, k) => v >= edge && v < e[k + 1]));
      let wrong = 0;
      for (let y = 0; y < px; y++) {
        const r = at(y);
        for (let x = 0; x < px; x++) {
          const c = at(x);
          const want = r >= 0 && c >= 0 && dark(r, c) ? 1 : 0;
          if (g[y * px + x] !== want) wrong++;
        }
      }
      expect(wrong).toBe(0);
    });
  }

  it("draws a row's run of dark modules as one rectangle", () => {
    const rects = qrRects(n, bits, 132);
    let runs = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c) && (c === 0 || !dark(r, c - 1))) runs++;
    expect(rects).toHaveLength(runs);
    // the finder pattern's top row: seven modules in one
    expect(rects[0]).toEqual([6, 6, qrEdge(n, 7, 132) - 6, qrEdge(n, 1, 132) - 6]);
  });

  it("paints the whole tile white first, then the dark modules, on a canvas of the asked size", () => {
    const canvas = { width: 300, height: 150 };
    const calls: [string, number, number, number, number][] = [];
    const pen = { fillStyle: "#000" as string | CanvasGradient | CanvasPattern, fillRect(x: number, y: number, w: number, h: number) { calls.push([String(this.fillStyle), x, y, w, h]); } };
    expect(paintQr(canvas, pen, n, bits, 264)).toBe(true);
    expect(canvas).toEqual({ width: 264, height: 264 });
    expect(calls[0]).toEqual([QR_LIGHT, 0, 0, 264, 264]);
    expect(calls.slice(1).every((c) => c[0] === QR_DARK)).toBe(true);
    expect(calls.slice(1).map((c) => c.slice(1))).toEqual(qrRects(n, bits, 264));
    expect(QR_LIGHT).toBe("#fff");
    expect(QR_DARK).toBe("#1a1919"); // the svg's own ink
  });

  it("leaves the canvas alone when there is nothing to paint (the svg stays the code)", () => {
    const canvas = { width: 300, height: 150 };
    const pen = { fillStyle: "#000" as string | CanvasGradient | CanvasPattern, fillRect() { throw new Error("painted"); } };
    expect(paintQr(canvas, pen, n, bits, 0)).toBe(false); // not laid out yet
    expect(paintQr(canvas, pen, n, bits.slice(1), 132)).toBe(false);
    expect(paintQr(canvas, pen, 0, "", 132)).toBe(false);
    expect(canvas).toEqual({ width: 300, height: 150 });
  });
});

describe("the ticket's code on the page", () => {
  it("sends the canvas between the svg and the moving line, hidden until painted, named as the svg is", () => {
    const html = renderToStaticMarkup(createElement(Qr, { payload: "MMC-4-q1abcd", label: "Queue number #4" }));
    expect(html).toMatch(/^<span class="tk-qr"><svg role="img" aria-label="Queue number #4" width="132" height="132"[^>]*>.*?<\/svg><canvas class="tk-qr-cv" role="img" aria-label="Queue number #4"><\/canvas><svg class="tk-qr-live"/);
  });
  it("never sends the QR library to the browser: the canvas paints from the modules", () => {
    const src = readFileSync(new URL("../../components/booking/QrCanvas.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/^"use client";/);
    expect([...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1])).toEqual(["react", "@/lib/qr-paint"]);
    expect(readFileSync(new URL("../qr-paint.ts", import.meta.url), "utf8")).not.toMatch(/^import /m);
  });
});
