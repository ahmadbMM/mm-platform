import { shrinkSize, UPLOAD_MAX } from "@/lib/sx-B4";

// The browser half of after the sale (builder B4): a POST of JSON to one of this site's routes, and a photo shrunk on
// the phone before it is sent (N08: a phone's photo is 3-12 MB; the store keeps a 1600 px JPEG, well under 700 KB).

export async function postJson<T extends Record<string, unknown>>(url: string, body: unknown): Promise<T & { ok?: boolean; error?: string }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({ ok: false, error: "generic" }))) as T & { ok?: boolean; error?: string };
  } catch {
    return { ok: false, error: "network" } as T & { ok?: boolean; error?: string };
  }
}

/** The photo as a JPEG whose long side is 1600 px at most, or null when the browser cannot read it. The camera's
 *  orientation is applied (createImageBitmap reads EXIF by default), and nothing of the original file's metadata goes:
 *  the canvas writes none (no place a photo was taken travels with it). */
export async function shrinkPhoto(file: File, max = 1600, quality = 0.82): Promise<Blob | null> {
  if (!/^image\//.test(file.type) && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) return null;
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(file);
    const { w, h } = shrinkSize(bmp.width, bmp.height, max);
    if (!w || !h) return null;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    if (!g) return null;
    g.drawImage(bmp, 0, 0, w, h);
    for (const q of [quality, 0.7, 0.55]) {
      const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));
      if (b && b.size <= UPLOAD_MAX) return b;
    }
    return null;
  } catch {
    return null;
  } finally {
    try { bmp?.close(); } catch { /* already gone */ }
  }
}

/** Sends one shrunk photo into the order's folder (/api/store/claim-photo); the path it was stored at, or an error code. */
export async function uploadPhoto(no: number, key: string, file: File): Promise<{ path: string; blob: Blob } | { error: string }> {
  const blob = await shrinkPhoto(file);
  if (!blob) return { error: "photos" };
  try {
    const r = await fetch(`/api/store/claim-photo?no=${no}&k=${key}`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
    const b = (await r.json().catch(() => ({}))) as { ok?: boolean; path?: string; error?: string };
    return b.ok && b.path ? { path: b.path, blob } : { error: b.error || "photos" };
  } catch {
    return { error: "network" };
  }
}
