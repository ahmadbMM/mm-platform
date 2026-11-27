import { PDF_MAX } from "./badge-request";

// A proof a rider sends with a badge request (components/account/BadgeGrid.tsx) or a distance on the leaderboards
// (components/leaderboard/Leaderboard.tsx), read in the browser: a picture made small, or a PDF as it is.
export type Proof = { url: string; kind: "image" | "pdf"; name: string };

// A picture made small as a receipt is (the long side 1600 px, a JPEG under ~2.5 MB); a PDF as it is, 2 MB at most,
// once its first bytes say PDF (the booking app's _bdrFile).
export function readProof(f: File): Promise<Proof | null> {
  const name = (f.name || "").slice(-120);
  return new Promise((ok) => {
    const rd = new FileReader();
    rd.onerror = () => ok(null);
    if (/^application\/pdf$/i.test(f.type) || (!/^image\//.test(f.type) && /\.pdf$/i.test(name))) {
      if (f.size > PDF_MAX) { ok(null); return; }
      rd.onload = () => { const s = String(rd.result || ""), b = s.slice(s.indexOf(",") + 1); ok(/^JVBER/.test(b) ? { url: `data:application/pdf;base64,${b}`, kind: "pdf", name: name || "proof.pdf" } : null); };
      rd.readAsDataURL(f);
      return;
    }
    if (!/^image\//.test(f.type)) { ok(null); return; }
    rd.onload = () => {
      const im = new Image();
      im.onerror = () => ok(null);
      im.onload = () => {
        const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight, 1)), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const cx = cv.getContext("2d"); if (!cx) { ok(null); return; }
        cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
        let q = 0.82, u = cv.toDataURL("image/jpeg", q);
        while (u.length > 2_500_000 && q > 0.4) { q -= 0.12; u = cv.toDataURL("image/jpeg", q); }
        ok({ url: u, kind: "image", name: name || "proof.jpg" });
      };
      im.src = String(rd.result);
    };
    rd.readAsDataURL(f);
  });
}
