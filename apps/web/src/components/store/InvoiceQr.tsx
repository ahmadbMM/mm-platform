import qrcode from "qrcode-generator";
import QrCanvas from "@/components/booking/QrCanvas";

// The simplified tax invoice's ZATCA QR (L06): the server works the code out once and draws it as an svg, then the
// browser paints the same modules on a canvas (the tickets' QrCanvas), which a phone's dark mode leaves as it is (it
// recolours an svg: the owner, 2026-10-05). The tile is the code's own white with a margin of a twentieth of the code
// each side, the canvas's geometry (lib/qr-paint.ts qrEdge). It prints as it shows.
export default function InvoiceQr({ text, label, size = 112 }: { text: string; label: string; size?: number }) {
  const qr = qrcode(0, "M");
  qr.addData(text);
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
  const m = n / 20;
  return (
    <span className="st-zqr">
      <svg role="img" aria-label={label} width={size} height={size} viewBox={`${-m} ${-m} ${n + 2 * m} ${n + 2 * m}`} shapeRendering="crispEdges">
        <rect x={-m} y={-m} width={n + 2 * m} height={n + 2 * m} fill="#fff" />
        <path d={d} fill="#1a1919" />
      </svg>
      <QrCanvas n={n} bits={bits} label={label} />
    </span>
  );
}
