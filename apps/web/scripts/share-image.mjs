// Builds public/site/og.jpg, the picture a shared link to the site shows when a page has none of
// its own (WhatsApp, X, iMessage...): 1200 x 630, the Corniche rider beside the brand mark.
// Run from apps/web: node scripts/share-image.mjs
import sharp from "sharp";

const W = 1200, H = 630, PANEL = 560;
const photo = await sharp("public/site/home/entry-riders.jpg")
  .extract({ left: 440, top: 330, width: 891, height: 877 })
  .resize(W - PANEL + 40, H, { fit: "cover" })
  .toBuffer();

const mark = `<path d="M27.5 189 V49.75 A14.75 14.75 0 0 1 57 49.75 V170.25 A14.75 14.75 0 0 0 86.5 170.25 V49.75 A14.75 14.75 0 0 1 116 49.75 V165 A24 24 0 0 0 140 189 H195" fill="none" stroke="#03FF89" stroke-width="23.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const panel = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#1A1919"/><stop offset="1" stop-color="#1A1919" stop-opacity="0"/></linearGradient></defs>
  <rect x="0" y="0" width="${PANEL}" height="${H}" fill="#1A1919"/>
  <rect x="${PANEL}" y="0" width="120" height="${H}" fill="url(#fade)"/>
  <g transform="translate(64 78) scale(0.52)">${mark}</g>
  <text x="68" y="300" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" font-size="64" fill="#FFFFFF" letter-spacing="-1">Micromobility</text>
  <text x="70" y="360" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="28" fill="#B9C0BA">Bikes · Experiences · Community</text>
  <text x="70" y="402" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="28" fill="#B9C0BA">Jeddah, Saudi Arabia</text>
  <text x="70" y="468" font-family="Geeza Pro, Noto Sans Arabic, sans-serif" font-size="34" font-weight="700" fill="#03FF89">مايكروموبيليتي · جدة</text>
  <text x="70" y="572" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" font-size="24" fill="#03FF89" letter-spacing="1">micromobility.sa</text>
</svg>`;

await sharp({ create: { width: W, height: H, channels: 3, background: "#1A1919" } })
  .composite([{ input: photo, left: PANEL - 40, top: 0 }, { input: Buffer.from(panel), left: 0, top: 0 }])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile("public/site/og.jpg");
console.log("wrote public/site/og.jpg");
