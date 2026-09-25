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
  return (
    <span className="tk-qr">
      <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges">
        <path d={d} fill="#1a1919" />
      </svg>
    </span>
  );
}
