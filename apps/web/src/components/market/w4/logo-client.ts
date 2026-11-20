import { MK_PHOTO_BYTES, MK_SMALL_BYTES, MK_SMALL_SIDE, mkFit } from "@/lib/market/core";
import { w4PostForm, type W4Answer } from "./api";

// A shop's logo on its way from the owner's phone to the Marketplace (browser only). The picture chosen is never sent
// as it is: it is drawn again onto a canvas and written out as a new JPEG, twice, the full copy and the 480px copy
// the photo route asks for (POST /api/market/photo, the selling builder's, with for=shop). A drawn picture carries
// nothing a camera wrote beside it: no place, no phone model, no time. A logo is shown small, so its full copy is
// 800px at most on its longest side, well inside the route's limits.

export type W4Copies = { full: Blob; small: Blob };

export const W4_LOGO_SIDE = 800;
// From a good picture down to a plain one: the first that fits the byte limit is the one sent.
const QUALITIES = [0.88, 0.8, 0.7, 0.6, 0.5];

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
  // a logo with see-through parts gets a white ground, as a JPEG has none
  cx.fillStyle = "#fff";
  cx.fillRect(0, 0, w, h);
  cx.imageSmoothingQuality = "high";
  cx.drawImage(src, 0, 0, w, h);
  return cv;
}

const encode = (cv: HTMLCanvasElement, q: number): Promise<Blob | null> => new Promise((done) => {
  try { cv.toBlob((b) => done(b), "image/jpeg", q); } catch { done(null); }
});

async function under(cv: HTMLCanvasElement, max: number): Promise<Blob | null> {
  for (const q of QUALITIES) {
    const b = await encode(cv, q);
    if (!b || b.type !== "image/jpeg") return null;
    if (b.size <= max) return b;
  }
  return null;
}

/** One chosen picture as the two copies to send, or null when it cannot be read (not a picture the browser can draw). */
export async function w4LogoCopies(file: Blob): Promise<W4Copies | null> {
  try {
    if (!file.size || file.size > 40_000_000) return null;
    const im = await load(file);
    if (!im) return null;
    const a = mkFit(im.naturalWidth, im.naturalHeight, W4_LOGO_SIDE);
    const big = a.w && a.h ? draw(im, a.w, a.h) : null;
    if (!big) return null;
    const s = mkFit(a.w, a.h, MK_SMALL_SIDE);
    const little = s.w && s.h ? draw(big, s.w, s.h) : null;
    if (!little) return null;
    const full = await under(big, MK_PHOTO_BYTES - 16_000);
    const small = await under(little, MK_SMALL_BYTES - 8_000);
    return full && small ? { full, small } : null;
  } catch {
    return null;
  }
}

/** The two copies sent to the photo route for the account's own shop. Answers {ok: true, name}: the stored name to
 *  put in the shop's `logo`. The shop must already exist (the database issues the name in the shop's own folder). */
export function w4LogoUpload(c: W4Copies): Promise<W4Answer<{ name: string }>> {
  const form = new FormData();
  form.set("for", "shop");
  form.set("ref", "");
  form.set("full", c.full, "full.jpg");
  form.set("small", c.small, "small.jpg");
  return w4PostForm<{ name: string }>("/api/market/photo", form);
}
