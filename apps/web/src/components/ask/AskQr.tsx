"use client";

import { useEffect, useRef } from "react";
import { paintQr } from "@/lib/qr-paint";

// The big screen's QR code, painted on a canvas (lib/qr-paint.ts: whole device pixels, a white tile around the code)
// from the modules the server worked out - the QR library never reaches the browser. Painted again whenever the
// screen's size changes; its size is the stylesheet's.
export default function AskQr({ n, bits, label }: { n: number; bits: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const pen = canvas?.getContext("2d");
    if (!canvas || !pen) return;
    let drawn = 0;
    const draw = () => {
      const px = Math.round(canvas.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 3));
      if (px < 1 || px === drawn) return;
      if (paintQr(canvas, pen, n, bits, px)) drawn = px;
    };
    draw();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(draw);
    watch.observe(canvas);
    return () => watch.disconnect();
  }, [n, bits]);
  return <canvas ref={ref} className="ask-qr" role="img" aria-label={label} />;
}
