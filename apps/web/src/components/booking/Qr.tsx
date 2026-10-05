import qrcode from "qrcode-generator";
import QrCanvas from "./QrCanvas";

// A ticket's code: the booking app's own payload (lib/tickets.ts bookingRef), in the box the booking
// app draws. The server works the code out once and draws it as an svg, which is what shows until
// the browser has painted the same modules on a canvas (QrCanvas.tsx; the library never reaches the
// browser, only the modules do): the svg is the code with no script, or before the page has woken.
export default function Qr({ payload, size = 120, label }: { payload: string; size?: number; label: string }) {
  const qr = qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  let bits = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const dark = qr.isDark(r, c);
      bits += dark ? "1" : "0";
      if (dark) d += `M${c} ${r}h1v1h-1z`;
    }
  }
  // The white tile (6px around the code, the booking app's) is the code's own, never a CSS
  // background on the span, which a browser darkening the page for the reader would turn dark. The
  // svg draws it as its own background rect, the margin inside the viewBox; Samsung Internet's dark
  // mode still recolours an svg's shapes (its rect darkened, its path lightened: the owner,
  // 2026-10-05, "the dark qr codes arent getting scanned properly"), which is why the canvas takes
  // over: its pixels are left as they are.
  const m = n / 20; // 6px of a 120px code, in modules
  // A line runs round the tile without stopping, so staff can tell a live ticket from a screenshot
  // at a glance (the owner, 2026-10-04: "a constantly moving line around the qr code ... that its
  // live and not a screenshot"; the booking app's .qr-live): a green quarter of the edge, one lap
  // every 2.4 s (booking.css). It is an svg's own stroke, over the canvas as over the svg, and it
  // runs in the tile's white margin, about 2px in from the edge, never over the code. Its width is
  // 3px in the tile's 0-100 units: vector-effect="non-scaling-stroke" would keep it 3px by itself,
  // but Chrome and Safari then lay the dashes out against the unscaled length and draw two of them.
  // Its corner follows the night ticket's tile, rounded at 10px, which would clip a tighter one.
  return (
    <span className="tk-qr">
      <svg role="img" aria-label={label} width={size + 12} height={size + 12} viewBox={`${-m} ${-m} ${n + 2 * m} ${n + 2 * m}`} shapeRendering="crispEdges">
        <rect x={-m} y={-m} width={n + 2 * m} height={n + 2 * m} fill="#fff" />
        <path d={d} fill="#1a1919" />
      </svg>
      <QrCanvas n={n} bits={bits} label={label} />
      <svg className="tk-qr-live" aria-hidden="true" focusable="false" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="1.5" y="1.5" width="97" height="97" rx="6" pathLength={100} fill="none" stroke="#00b467" strokeWidth={Math.round(30000 / (size + 12)) / 100} strokeLinecap="round" />
      </svg>
    </span>
  );
}
