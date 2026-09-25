// Smaller copies of the site's own photos (public/site): a 640 px and a 1280 px WebP beside each
// photo over 40 KB, and src/lib/image-variants.json saying which exist. The pages ask for the size
// they draw (lib/img.ts) instead of sending every visitor the full photo - 4.2 MB of them.
// Run from apps/web after adding or replacing a photo: node scripts/image-variants.mjs
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import sharp from "sharp";

const ROOT = "public/site";
const WIDTHS = [640, 1280];
const MIN_BYTES = 40 * 1024;
const VARIANT = /\.w\d+\.webp$/;

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const manifest = {};
for (const file of walk(ROOT).sort()) {
  if (!/\.(jpe?g|png|webp)$/i.test(file) || VARIANT.test(file) || statSync(file).size < MIN_BYTES) continue;
  const { width } = await sharp(file).metadata();
  const made = [];
  for (const w of WIDTHS) {
    if (!width || w >= width) continue; // never larger than the original
    const out = file.replace(/\.(jpe?g|png|webp)$/i, `.w${w}.webp`);
    if (!existsSync(out)) await sharp(file).resize({ width: w }).webp({ quality: 78 }).toFile(out);
    made.push(w);
  }
  if (made.length) manifest["/" + relative("public", file).split("\\").join("/")] = { width, variants: made };
}
writeFileSync("src/lib/image-variants.json", JSON.stringify(manifest, null, 1) + "\n");
console.log(`${Object.keys(manifest).length} photos have smaller copies`);
