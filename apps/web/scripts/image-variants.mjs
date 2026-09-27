// Smaller copies of the site's own photos (public/site): a 640 px and a 1280 px WebP beside each
// photo over 40 KB, plus a WebP of the photo at its own width, and src/lib/image-variants.json
// saying which exist. The pages ask for the size they draw (lib/img.ts) instead of sending every
// visitor the full photo - 4.2 MB of them - and never the JPEG when a WebP of that size exists: the
// 350 KB business photo on Home is 78 KB as WebP. Two are left alone: og.jpg, the picture a shared
// link shows (the apps that fetch it want a JPEG), and photos that are WebP already (nothing to
// gain from a copy of the whole). PNGs get the two smaller copies but no copy of the whole: the
// PNGs here are logos with transparent backgrounds, drawn as they are.
// Run from apps/web after adding or replacing a photo: node scripts/image-variants.mjs
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import sharp from "sharp";

const ROOT = "public/site";
const WIDTHS = [640, 1280];
const MIN_BYTES = 40 * 1024;
const VARIANT = /\.w\d+\.webp$/;
const SKIP = new Set(["site/og.jpg"]);

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const manifest = {};
for (const file of walk(ROOT).sort()) {
  const rel = relative("public", file).split("\\").join("/");
  if (!/\.(jpe?g|png|webp)$/i.test(file) || VARIANT.test(file) || SKIP.has(rel) || statSync(file).size < MIN_BYTES) continue;
  const { width } = await sharp(file).metadata();
  if (!width) continue;
  // The smaller copies, never larger than the photo; then, for a JPEG, the whole photo as WebP.
  const widths = [...WIDTHS.filter((w) => w < width), ...(/\.jpe?g$/i.test(file) ? [width] : [])];
  const made = [];
  for (const w of widths) {
    const out = file.replace(/\.(jpe?g|png|webp)$/i, `.w${w}.webp`);
    if (!existsSync(out)) await (w < width ? sharp(file).resize({ width: w }) : sharp(file)).webp({ quality: 78 }).toFile(out);
    made.push(w);
  }
  if (made.length) manifest["/" + rel] = { width, variants: made };
}
writeFileSync("src/lib/image-variants.json", JSON.stringify(manifest, null, 1) + "\n");
console.log(`${Object.keys(manifest).length} photos have WebP copies`);
