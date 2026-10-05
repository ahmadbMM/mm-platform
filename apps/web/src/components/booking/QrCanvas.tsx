"use client";

import { useEffect, useRef } from "react";
import { paintQr } from "@/lib/qr-paint";

// The ticket's code drawn on a canvas in the browser (Qr.tsx sends the modules, not the QR library):
// a phone's dark mode recolours an svg's shapes and left the desk a code it could not scan, but it
// leaves a canvas's pixels as they are (lib/qr-paint.ts). Until it is painted - no script yet, or
// none at all - the canvas is hidden and the server's svg is the code. Once painted the tile (the
// .tk-qr span) is marked .cv: the canvas shows, at the phone's own pixel density (up to 3 a CSS
// pixel, every module edge on a whole pixel), and the svg is hidden but keeps the tile's size, so
// the canvas lies exactly over it. Only one of them is ever visible, so the code is announced once.
export default function QrCanvas({ n, bits, label }: { n: number; bits: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const tile = canvas?.parentElement;
    const pen = canvas?.getContext("2d");
    if (!canvas || !tile || !pen) return; // no canvas here: the svg stays the code
    let drawn = 0;
    // device: the canvas's width in device pixels, when the browser says it exactly (Chrome, Firefox),
    // taken only where it agrees with the pixel ratio (an emulated screen can report CSS pixels).
    const draw = (device?: number) => {
      const ratio = window.devicePixelRatio || 1;
      const css = canvas.getBoundingClientRect().width;
      const px = device && ratio <= 3 && Math.abs(device - css * ratio) <= 1 ? device : Math.round(css * Math.min(ratio, 3));
      if (px === drawn || !paintQr(canvas, pen, n, bits, px)) return; // not laid out yet (a hidden tab): the observer paints it later
      drawn = px;
      tile.classList.add("cv");
    };
    draw();
    if (typeof ResizeObserver === "undefined") return () => tile.classList.remove("cv");
    // The tile changes size with the screen (116px on a phone, booking.css) and with zoom: paint again.
    const watch = new ResizeObserver(([e]) => draw(e?.devicePixelContentBoxSize?.[0]?.inlineSize));
    try { watch.observe(canvas, { box: "device-pixel-content-box" }); } catch { watch.observe(canvas); }
    return () => { watch.disconnect(); tile.classList.remove("cv"); };
  }, [n, bits]);
  return <canvas ref={ref} className="tk-qr-cv" role="img" aria-label={label} />;
}
