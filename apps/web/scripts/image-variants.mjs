// Smaller copies of the site's own photos (public/site): a 640 px and a 1280 px WebP beside each
// photo over 40 KB, plus a WebP of the photo at its own width, and src/lib/image-variants.json
// saying which exist. The pages ask for the size they draw (lib/img.ts) instead of sending every
// visitor the full photo - 4.2 MB of them - and never the JPEG when a WebP of that size exists: the
// 350 KB business photo on Home is 78 KB as WebP. Two are left alone: og.jpg, the picture a shared
// link shows (the apps that fetch it want a JPEG), and photos that are WebP already (nothing to
// gain from a copy of the whole). PNGs get the two smaller copies but no copy of the whole: the
// PNGs here are logos with transparent backgrounds, drawn as they are.
// A photo replaced under the same name gets new copies: scripts/image-variants.sources.json keeps a hash of each
// photo the copies were made from, and a photo whose hash has changed loses all its copies (an old width's too) and
// gets them made again. A copy that existed used to be kept, so the site went on showing the old photo. A photo with
// no hash noted yet keeps the copies it has. Commit the hashes with the copies.
// Run from apps/web after adding or replacing a photo: node scripts/image-variants.mjs
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import sharp from "sharp";

const ROOT = "public/site";
const WIDTHS = [640, 1280];
const MIN_BYTES = 40 * 1024;
const VARIANT = /\.w\d+\.webp$/;
const SKIP = new Set(["site/og.jpg"]);
const SOURCES = "scripts/image-variants.sources.json";
const before = existsSync(SOURCES) ? JSON.parse(readFileSync(SOURCES, "utf8")) : {};
const sources = {};
/** A photo's copies on disk (hero.jpg: hero.w640.webp, hero.w1280.webp, hero.w2000.webp ...). */
const copiesOf = (file) => {
  const stem = basename(file).replace(/\.(jpe?g|png|webp)$/i, "");
  return readdirSync(dirname(file)).filter((n) => n.startsWith(`${stem}.w`) && /^\d+\.webp$/.test(n.slice(stem.length + 2))).map((n) => join(dirname(file), n));
};

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
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16);
  sources["/" + rel] = hash;
  if (before["/" + rel] && before["/" + rel] !== hash) for (const old of copiesOf(file)) unlinkSync(old); // replaced
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
writeFileSync(SOURCES, JSON.stringify(sources, null, 1) + "\n");
console.log(`${Object.keys(manifest).length} photos have WebP copies`);
