import variants from "./image-variants.json";

// The size of a photo a page actually draws. The site's own photos (/site/...) have 640 and
// 1280 px WebP copies beside them (scripts/image-variants.mjs, image-variants.json); a photo staff
// uploaded (/media/...) is asked for with ?w=, which the media route answers with its smaller copy
// when the staff page saved one, else with the photo itself. Any other address is left alone.

type Entry = { width: number; variants: number[] };
const SITE = variants as Record<string, Entry>;
export const WIDTHS = [640, 1280] as const;

const variantPath = (url: string, w: number) => url.replace(/\.(jpe?g|png|webp)$/i, `.w${w}.webp`);
const isMedia = (url: string) => /^\/media\/[^?#]+$/.test(url);

/** The photo at about `w` pixels wide (the smallest copy at least that wide), else as it is. */
export function sized(url: string, w: number): string {
  if (!url) return url;
  const e = SITE[url];
  if (e) {
    const fit = e.variants.find((v) => v >= w);
    return fit ? variantPath(url, fit) : url;
  }
  if (isMedia(url)) return `${url}?w=${WIDTHS.find((v) => v >= w) ?? WIDTHS[WIDTHS.length - 1]}`;
  return url;
}

/** srcset for an <img>: every copy and the photo itself, so the browser picks by screen. */
export function srcSet(url: string): string | undefined {
  const e = SITE[url];
  if (e) return [...e.variants.map((v) => `${variantPath(url, v)} ${v}w`), `${url} ${e.width}w`].join(", ");
  if (isMedia(url)) return WIDTHS.map((v) => `${url}?w=${v} ${v}w`).join(", ");
  return undefined;
}

/** A CSS background: the photo at the size it is drawn (1280 px by default - the width of the
 *  larger cards and a phone's full screen at 3x). */
export const bg = (url: string, w = 1280) => sized(url, w);
