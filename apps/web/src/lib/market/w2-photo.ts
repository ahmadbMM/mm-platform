import { MK_PHOTO_BYTES, MK_PHOTO_SIDE, MK_SMALL_BYTES, MK_SMALL_SIDE, mkImageKind } from "./core";

// A Marketplace photo's bytes, read without drawing it (W2): what kind of picture it is, how large it is drawn, whether
// it still carries a camera's Exif block, and the same picture with every part that describes it rather than draws it
// taken out. Browser-safe and pure: the selling form runs it over each copy it made before sending it, and the upload
// route (app/api/market/photo) runs it again over what arrived, so nothing a camera wrote beside the picture - where it
// was taken, on which phone, when - is ever stored, whoever sent it.
//
// A JPEG is a row of segments before its picture data. Kept: the tables and frame headers that draw it, JFIF (APP0),
// an ICC colour profile (APP2 "ICC_PROFILE") and Adobe's colour marker (APP14), without which some pictures change
// colour. Dropped: Exif and XMP (APP1), IPTC and Photoshop (APP13), every other application segment, comments, and
// anything after the end of the picture. A WebP is a RIFF file of chunks. Kept: VP8X, ICCP, ALPH, VP8 and VP8L.
// Dropped: EXIF, XMP and any chunk that is none of those; an animation is not a listing's photo and is not read.

export type W2PhotoKind = "jpg" | "webp";
export type W2Photo = {
  kind: W2PhotoKind;
  /** The picture's size in pixels. */
  w: number; h: number;
  /** It carried a camera's Exif block (taken out of `clean` either way). */
  exif: boolean;
  /** How many metadata segments or chunks were taken out. */
  dropped: number;
  /** The same picture without them. */
  clean: Uint8Array<ArrayBuffer>;
};

const ascii = (b: Uint8Array, at: number, text: string): boolean => {
  if (at + text.length > b.length) return false;
  for (let i = 0; i < text.length; i++) if (b[at + i] !== text.charCodeAt(i)) return false;
  return true;
};
function join(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

function readJpeg(b: Uint8Array): W2Photo | null {
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2, w = 0, h = 0, exif = false, dropped = 0, scans = 0, ended = false;
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i += 1; continue; } // a fill byte before a marker
    if (m === 0xd9) { parts.push(b.subarray(i, i + 2)); ended = true; break; } // the end of the picture: nothing after it is kept
    if (m === 0xd8 || m === 0x00) return null;
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { parts.push(b.subarray(i, i + 2)); i += 2; continue; } // markers that stand alone
    if (i + 4 > b.length) return null;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) return null;
    const end = i + 2 + len;
    if (m === 0xda) {
      // a scan: its header, then the picture's data up to the next marker (a stuffed FF00 and a restart are data)
      let j = end;
      while (j < b.length) {
        j = b.indexOf(0xff, j); // from one FF to the next: the data between them is never a marker
        if (j < 0) { j = b.length; break; }
        const n = j + 1 < b.length ? b[j + 1] : 0x00;
        if (n === 0x00 || (n >= 0xd0 && n <= 0xd7)) { j += 2; continue; }
        if (n === 0xff) { j += 1; continue; }
        break;
      }
      parts.push(b.subarray(i, Math.min(j, b.length)));
      scans += 1;
      i = j;
      continue;
    }
    const app = m >= 0xe0 && m <= 0xef;
    if (m === 0xe1 && ascii(b, i + 4, "Exif")) exif = true;
    const keep = (!app && m !== 0xfe)
      || (m === 0xe0 && (ascii(b, i + 4, "JFIF\0") || ascii(b, i + 4, "JFXX\0")))
      || (m === 0xe2 && ascii(b, i + 4, "ICC_PROFILE\0"))
      || (m === 0xee && ascii(b, i + 4, "Adobe"));
    if (keep) {
      // a frame header (SOF0 to SOF15, but not the tables that share its range): the picture's height, then its width
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && len >= 7) { h = (b[i + 5] << 8) | b[i + 6]; w = (b[i + 7] << 8) | b[i + 8]; }
      parts.push(b.subarray(i, end));
    } else dropped += 1;
    i = end;
  }
  if (!scans || !(w > 0) || !(h > 0)) return null;
  if (!ended) parts.push(new Uint8Array([0xff, 0xd9]));
  return { kind: "jpg", w, h, exif, dropped, clean: join(parts) };
}

const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16)) + b[at + 3] * 0x1000000;
const u24 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
const WEBP_KEEP = ["VP8X", "ICCP", "ALPH", "VP8 ", "VP8L"];

function readWebp(b: Uint8Array): W2Photo | null {
  const parts: Uint8Array[] = [];
  let i = 12, w = 0, h = 0, exif = false, dropped = 0, picture = false;
  while (i + 8 <= b.length) {
    const id = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
    const size = u32(b, i + 4);
    const end = i + 8 + size;
    if (end > b.length) return null;
    const p = i + 8;
    if (id === "ANIM" || id === "ANMF") return null;
    if (id === "EXIF") exif = true;
    if (WEBP_KEEP.includes(id)) {
      const chunk = new Uint8Array(8 + size + (size & 1));
      chunk.set(b.subarray(i, end));
      if (id === "VP8X") {
        if (size < 10) return null;
        chunk[8] &= ~0x0c; // no Exif and no XMP follow any more
        w = 1 + u24(b, p + 4); h = 1 + u24(b, p + 7);
      } else if (id === "VP8 ") {
        if (size < 10 || b[p + 3] !== 0x9d || b[p + 4] !== 0x01 || b[p + 5] !== 0x2a) return null;
        if (!w) { w = (b[p + 6] | (b[p + 7] << 8)) & 0x3fff; h = (b[p + 8] | (b[p + 9] << 8)) & 0x3fff; }
        picture = true;
      } else if (id === "VP8L") {
        if (size < 5 || b[p] !== 0x2f) return null;
        if (!w) { w = 1 + (((b[p + 2] & 0x3f) << 8) | b[p + 1]); h = 1 + (((b[p + 4] & 0x0f) << 10) | (b[p + 3] << 2) | ((b[p + 2] & 0xc0) >> 6)); }
        picture = true;
      }
      parts.push(chunk);
    } else dropped += 1;
    i = end + (size & 1);
  }
  if (!picture || !(w > 0) || !(h > 0)) return null;
  const body = join(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 12));
  const riff = 4 + body.length;
  out[4] = riff & 0xff; out[5] = (riff >> 8) & 0xff; out[6] = (riff >> 16) & 0xff; out[7] = (riff >> 24) & 0xff;
  out.set(body, 12);
  return { kind: "webp", w, h, exif, dropped, clean: out };
}

/** One photo's bytes, read: its kind by its first bytes (never its name), its size, whether it carried Exif, and the
 *  same picture with every metadata part taken out. null for anything that is not a whole JPEG or WebP picture. */
export function w2Photo(bytes: Uint8Array): W2Photo | null {
  const kind = mkImageKind(bytes);
  try { return kind === "jpg" ? readJpeg(bytes) : kind === "webp" ? readWebp(bytes) : null; } catch { return null; }
}

/** Why the upload route does not take a pair of copies, or null when it does: "too_big" (a copy over its byte limit),
 *  "invalid" (a copy that is not a JPEG or WebP picture, the two of different kinds, one that still carries Exif, or
 *  one drawn larger than its copy may be). The limits are the bucket's and the contract's (lib/market/core.ts). */
export function w2PairRefusal(full: { bytes: number; photo: W2Photo | null }, small: { bytes: number; photo: W2Photo | null }): "too_big" | "invalid" | null {
  if (!full.bytes || !small.bytes) return "invalid";
  if (full.bytes > MK_PHOTO_BYTES || small.bytes > MK_SMALL_BYTES) return "too_big";
  const a = full.photo, b = small.photo;
  if (!a || !b || a.kind !== b.kind) return "invalid";
  if (a.exif || b.exif) return "invalid";
  if (Math.max(a.w, a.h) > MK_PHOTO_SIDE || Math.max(b.w, b.h) > MK_SMALL_SIDE) return "invalid";
  if (a.clean.length > MK_PHOTO_BYTES || b.clean.length > MK_SMALL_BYTES) return "too_big";
  return null;
}

export const W2_PHOTO_TYPE: Record<W2PhotoKind, "image/jpeg" | "image/webp"> = { jpg: "image/jpeg", webp: "image/webp" };
