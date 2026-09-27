import variants from "./image-variants.json";

// The size of a photo a page actually draws. The site's own photos (/site/...) have WebP copies
// beside them - at 640 and 1280 px, and at the photo's own width (scripts/image-variants.mjs,
// image-variants.json) - so a page never sends the JPEG when a WebP of that size exists; a photo
// staff uploaded (/media/...) is asked for with ?w=, which the media route answers with its smaller
// copy when the staff page saved one, else with the photo itself. Any other address is left alone.

type Entry = { width: number; variants: number[] };
const SITE = variants as Record<string, Entry>;
export const WIDTHS = [640, 1280] as const;

const variantPath = (url: string, w: number) => url.replace(/\.(jpe?g|png|webp)$/i, `.w${w}.webp`);
const isMedia = (url: string) => /^\/media\/[^?#]+$/.test(url);
/** A WebP copy of the whole photo exists, so the photo itself is never needed. */
const wholeCopy = (e: Entry) => e.variants.includes(e.width);

/** The photo at about `w` pixels wide: the smallest copy at least that wide, else the copy of the
 *  whole photo, else - a photo that is a WebP already - the photo as it is. */
export function sized(url: string, w: number): string {
  if (!url) return url;
  const e = SITE[url];
  if (e) {
    const fit = e.variants.find((v) => v >= w) ?? (wholeCopy(e) ? e.width : null);
    return fit ? variantPath(url, fit) : url;
  }
  if (isMedia(url)) return `${url}?w=${WIDTHS.find((v) => v >= w) ?? WIDTHS[WIDTHS.length - 1]}`;
  return url;
}

/** srcset for an <img>: every copy, and the photo itself only when no copy is the whole of it, so
 *  the browser picks by screen. */
export function srcSet(url: string): string | undefined {
  const e = SITE[url];
  if (e) return [...e.variants.map((v) => `${variantPath(url, v)} ${v}w`), ...(wholeCopy(e) ? [] : [`${url} ${e.width}w`])].join(", ");
  if (isMedia(url)) return WIDTHS.map((v) => `${url}?w=${v} ${v}w`).join(", ");
  return undefined;
}

/** A CSS background: the photo at the size it is drawn (1280 px by default - the width of the
 *  larger cards and a phone's full screen at 3x). */
export const bg = (url: string, w = 1280) => sized(url, w);
