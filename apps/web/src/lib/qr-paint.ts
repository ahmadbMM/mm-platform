// The ticket's code as a bitmap (components/booking/QrCanvas.tsx), in a plain module so the tests
// and the canvas share it. Samsung Internet's dark mode recolours an svg - its rects as background,
// darkened, and its paths as foreground, lightened - which turned the code's white tile dark and its
// modules light, and the desk's scanner could not read it (the owner, 2026-10-05: "the dark qr codes
// arent getting scanned properly"). A page cannot opt out; a canvas's pixels are left alone.

/** A rectangle of whole device pixels: x, y, width, height. */
export type QrRect = [x: number, y: number, w: number, h: number];

export const QR_LIGHT = "#fff";
export const QR_DARK = "#1a1919";

/** Where module edge k (0 to n) falls on a tile px pixels wide, in whole pixels. The tile is the
 *  svg's viewBox: the code's n modules and a margin of n/20 modules each side (6px of the 132px
 *  tile), so edge k sits (n/20 + k) / (1.1n) of the way across - (n + 20k) / 22n, exactly. */
export function qrEdge(n: number, k: number, px: number): number {
  return Math.round(((n + 20 * k) * px) / (22 * n));
}

/** The dark modules of an n-by-n code (bits: n*n of "0" and "1", row by row) on a px-by-px tile,
 *  a row's run of dark modules as one rectangle. Every edge is a whole pixel and two neighbouring
 *  modules share theirs, so no hairline of the tile shows between them. */
export function qrRects(n: number, bits: string, px: number): QrRect[] {
  if (!Number.isInteger(n) || n < 1 || bits.length !== n * n || !Number.isInteger(px) || px < 1) return [];
  const e: number[] = [];
  for (let k = 0; k <= n; k++) e.push(qrEdge(n, k, px));
  const out: QrRect[] = [];
  for (let r = 0; r < n; r++) {
    const h = e[r + 1] - e[r];
    for (let c = 0; c < n; ) {
      if (bits.charCodeAt(r * n + c) !== 49) { c++; continue; }
      let end = c + 1;
      while (end < n && bits.charCodeAt(r * n + end) === 49) end++;
      if (h > 0 && e[end] > e[c]) out.push([e[c], e[r], e[end] - e[c], h]);
      c = end;
    }
  }
  return out;
}

/** Paints the code on a canvas px device pixels square: the whole tile white, then the dark modules.
 *  Setting the canvas's size clears it and its pen, so the pen is set after. */
export function paintQr(
  canvas: { width: number; height: number },
  pen: Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect">,
  n: number,
  bits: string,
  px: number,
): boolean {
  const rects = qrRects(n, bits, px);
  if (!rects.length) return false;
  canvas.width = px;
  canvas.height = px;
  pen.fillStyle = QR_LIGHT;
  pen.fillRect(0, 0, px, px);
  pen.fillStyle = QR_DARK;
  for (const [x, y, w, h] of rects) pen.fillRect(x, y, w, h);
  return true;
}
