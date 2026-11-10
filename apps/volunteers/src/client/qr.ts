// The certificate's QR code, to its public check page: drawn on a canvas and handed to the certificate as a PNG (the
// template's {{qr}}, rentals certificate/). The encoder is the website's own (qrcode-generator, apps/web's
// components/booking/Qr.tsx), fetched in its own chunk only when a certificate is made; the painting follows apps/web's
// lib/qr-paint.ts: a tile with a margin of a twentieth of the code each side, whole-pixel edges, so no hairline shows
// between two modules, and pixels a browser's dark mode leaves alone. The certificate's colours are the staff app's
// (SPEC.md, amendment 7): the brand's black on its off-white.

export const CHECK_ORIGIN = "https://volunteer.micromobility.sa";
/** Where a certificate is checked: the address its QR code and its Share give. */
export const checkUrl = (code: string) => `${CHECK_ORIGIN}/#check/${encodeURIComponent(code)}`;

const LIGHT = "#FBF9F4", DARK = "#1A1919";
const edge = (n: number, k: number, px: number) => Math.round(((n + 20 * k) * px) / (22 * n));

/** The code for this text as a PNG data URL, px pixels square; "" when it cannot be drawn. */
export async function qrPng(text: string, px = 330): Promise<string> {
  try {
    const qrcode = (await import("qrcode-generator")).default;
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const pen = canvas.getContext("2d");
    if (!pen) return "";
    pen.fillStyle = LIGHT;
    pen.fillRect(0, 0, px, px);
    pen.fillStyle = DARK;
    const e: number[] = [];
    for (let k = 0; k <= n; k++) e.push(edge(n, k, px));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n;) {
        if (!qr.isDark(r, c)) { c++; continue; }
        let end = c + 1;
        while (end < n && qr.isDark(r, end)) end++;
        pen.fillRect(e[c], e[r], e[end] - e[c], e[r + 1] - e[r]);
        c = end;
      }
    }
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}
