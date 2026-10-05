// Builds the two icons browsers ask for by name, from the brand mark already in the site - no new
// artwork:
//   - src/app/favicon.ico: the tab icon (src/app/icon.png, the mark alone on a transparent square)
//     at 16, 32 and 48 px, for the /favicon.ico every browser and crawler asks for;
//   - src/app/apple-icon.png: 180 x 180 for a phone's home screen, which shows no transparency, so
//     the mark is drawn as the share image draws it (scripts/share-image.mjs): neon on the brand black,
//     inside the margin iOS rounds off.
// Next serves both at /favicon.ico and /apple-icon.png and names them in every page's head;
// next.config.ts answers /apple-touch-icon.png (and -precomposed), the addresses iPhones and
// crawlers also ask for, with the same file.
// Run from apps/web after the mark changes: node scripts/make-icons.mjs
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const MARK = `<path d="M27.5 189 V49.75 A14.75 14.75 0 0 1 57 49.75 V170.25 A14.75 14.75 0 0 0 86.5 170.25 V49.75 A14.75 14.75 0 0 1 116 49.75 V165 A24 24 0 0 0 140 189 H195" fill="none" stroke="#03FF89" stroke-width="23.5" stroke-linecap="round" stroke-linejoin="round"/>`;

// apple-icon.png: the mark (its 223-unit box drawn at 74% of the side, so the mark itself spans about
// two thirds of it), centred on #1A1919.
const SIDE = 180, MARK_PX = Math.round(SIDE * 0.74);
const apple = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIDE}" height="${SIDE}" viewBox="0 0 ${SIDE} ${SIDE}">
  <rect width="${SIDE}" height="${SIDE}" fill="#1A1919"/>
  <g transform="translate(${(SIDE - MARK_PX) / 2} ${(SIDE - MARK_PX) / 2}) scale(${MARK_PX / 223})">${MARK}</g>
</svg>`;
writeFileSync("src/app/apple-icon.png", await sharp(Buffer.from(apple)).png({ compressionLevel: 9 }).toBuffer());

// favicon.ico: an ICO file whose images are PNGs (every browser since 2007 reads them).
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => sharp("src/app/icon.png").resize(s, s, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer()));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); // reserved
head.writeUInt16LE(1, 2); // 1 = icon
head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(s, e); // width (0 would mean 256)
  head.writeUInt8(s, e + 1); // height
  head.writeUInt8(0, e + 2); // no palette
  head.writeUInt8(0, e + 3); // reserved
  head.writeUInt16LE(1, e + 4); // colour planes
  head.writeUInt16LE(32, e + 6); // bits per pixel
  head.writeUInt32LE(pngs[i].length, e + 8);
  head.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
writeFileSync("src/app/favicon.ico", Buffer.concat([head, ...pngs]));
console.log("src/app/apple-icon.png and src/app/favicon.ico written");
