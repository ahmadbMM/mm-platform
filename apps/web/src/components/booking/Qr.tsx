import qrcode from "qrcode-generator";

// A ticket's code, drawn on the server as an SVG (no script reaches the browser for it): the
// booking app's own payload (lib/tickets.ts bookingRef), in the box the booking app draws.
export default function Qr({ payload, size = 120, label }: { payload: string; size?: number; label: string }) {
  const qr = qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  // The white tile (6px around the code, the booking app's) is drawn by the svg itself - its own
  // background rect, the margin inside the viewBox - not by a CSS background on the span: a browser
  // that darkens the page for the reader (Samsung Internet's dark mode, Chrome's auto dark) inverts
  // CSS backgrounds and would leave the code in a black frame, while an svg's own fills are kept.
  const m = n / 20; // 6px of a 120px code, in modules
  return (
    <span className="tk-qr">
      <svg role="img" aria-label={label} width={size + 12} height={size + 12} viewBox={`${-m} ${-m} ${n + 2 * m} ${n + 2 * m}`} shapeRendering="crispEdges">
        <rect x={-m} y={-m} width={n + 2 * m} height={n + 2 * m} fill="#fff" />
        <path d={d} fill="#1a1919" />
      </svg>
    </span>
  );
}
