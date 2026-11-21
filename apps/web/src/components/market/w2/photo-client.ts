import { MK_PHOTO_BYTES, MK_PHOTO_SIDE, MK_SMALL_BYTES, MK_SMALL_SIDE, mkFit } from "@/lib/market/core";
import { w2Photo } from "@/lib/market/w2-photo";
import { w2PostForm, type W2Answer } from "./api";

// A photo on its way from the seller's phone to the Marketplace (browser only). The picture the camera or the library
// gave is never sent as it is: it is drawn again, smaller, onto a canvas and written out as a new JPEG - twice, the
// full copy (longest side 1,600px) and the small one (480px) the contract names. A drawn picture carries nothing the
// camera wrote beside it: no place, no phone model, no time. What was written is then read back (lib/market/w2-photo.ts)
// and anything that describes the picture rather than draws it is taken out, so the copies are clean whatever the
// browser did; the upload route checks the same again.

export type W2Copies = { full: Blob; small: Blob };

// From a good picture down to a plain one: the first that fits the byte limit is the one sent.
const QUALITIES = [0.86, 0.78, 0.7, 0.6, 0.5, 0.4];

function load(file: Blob): Promise<HTMLImageElement | null> {
  return new Promise((done) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    const end = (v: HTMLImageElement | null) => { URL.revokeObjectURL(url); done(v); };
    im.onload = () => end(im.naturalWidth > 0 && im.naturalHeight > 0 ? im : null);
    im.onerror = () => end(null);
    im.src = url;
  });
}

function draw(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement | null {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const cx = cv.getContext("2d");
  if (!cx) return null;
  // a picture with see-through parts gets a white ground, as a JPEG has none
  cx.fillStyle = "#fff";
  cx.fillRect(0, 0, w, h);
  cx.imageSmoothingQuality = "high";
  cx.drawImage(src, 0, 0, w, h);
  return cv;
}

const encode = (cv: HTMLCanvasElement, q: number): Promise<Blob | null> => new Promise((done) => {
  try { cv.toBlob((b) => done(b), "image/jpeg", q); } catch { done(null); }
});

/** The canvas as a clean JPEG of `max` bytes at most, or null. */
async function under(cv: HTMLCanvasElement, max: number): Promise<Blob | null> {
  for (const q of QUALITIES) {
    const b = await encode(cv, q);
    if (!b) return null;
    if (b.size > max) continue;
    const read = w2Photo(new Uint8Array(await b.arrayBuffer()));
    if (!read || read.kind !== "jpg") return null;
    return new Blob([read.clean], { type: "image/jpeg" });
  }
  return null;
}

/** One chosen picture as the two copies to send, or null when it cannot be read (not a picture the browser can draw). */
export async function w2Shrink(file: Blob): Promise<W2Copies | null> {
  try {
    if (!file.size || file.size > 80_000_000) return null;
    const im = await load(file);
    if (!im) return null;
    const a = mkFit(im.naturalWidth, im.naturalHeight, MK_PHOTO_SIDE);
    const big = a.w && a.h ? draw(im, a.w, a.h) : null;
    if (!big) return null;
    const s = mkFit(a.w, a.h, MK_SMALL_SIDE);
    const little = draw(big, s.w, s.h);
    if (!little) return null;
    const full = await under(big, MK_PHOTO_BYTES - 16_000);
    const small = await under(little, MK_SMALL_BYTES - 8_000);
    return full && small ? { full, small } : null;
  } catch {
    return null;
  }
}

/** The two copies sent to POST /api/market/photo: a listing's photo (`ref` its number) or the account's shop's logo
 *  (`ref` null). Answers {ok: true, name}: the name to put in the listing's `photos` or the shop's `logo`. */
export function w2Upload(target: "listing" | "shop", ref: number | null, c: W2Copies): Promise<W2Answer<{ name: string }>> {
  const form = new FormData();
  form.set("for", target);
  form.set("ref", ref ? String(ref) : "");
  form.set("full", c.full, "full.jpg");
  form.set("small", c.small, "small.jpg");
  return w2PostForm<{ name: string }>("/api/market/photo", form);
}
