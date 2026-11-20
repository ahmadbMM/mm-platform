// A listing's photos (components/market/w1/Gallery.tsx and Viewer.tsx): the arithmetic of stepping, swiping, zooming
// and moving a zoomed photo, apart from the components so it can be tested. Browser-safe, no state of its own.

/** The largest a photo is zoomed: four times its drawn size. */
export const W1_ZOOM_MAX = 4;
/** What a double tap (or a double click) zooms to. */
export const W1_ZOOM_TAP = 2.5;

/** The photo `d` steps from `at` (-1 the one before, 1 the next), never past either end. */
export function stepPhoto(at: number, n: number, d: number): number {
  if (!(n > 0)) return 0;
  return Math.min(n - 1, Math.max(0, Math.round(at) + Math.sign(d)));
}

/** What a swipe asks for: 1 the next photo, -1 the one before, 0 nothing. A swipe is mostly sideways and at least
 *  48px long; on a right-to-left page the next photo comes from the left, so the directions swap. */
export function swipeStep(dx: number, dy: number, rtl: boolean): -1 | 0 | 1 {
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
  const next = dx < 0 ? 1 : -1;
  return (rtl ? -next : next) as -1 | 1;
}

/** What an arrow key asks for: the key pointing the reading way is the next photo. */
export function keyStep(key: string, rtl: boolean): -1 | 0 | 1 {
  if (key !== "ArrowLeft" && key !== "ArrowRight") return 0;
  const next = key === "ArrowRight" ? 1 : -1;
  return (rtl ? -next : next) as -1 | 1;
}

/** A zoom kept between the photo's own size and four times it; anything within a hair of its own size is that. */
export function clampScale(s: number): number {
  if (!Number.isFinite(s)) return 1;
  const v = Math.min(W1_ZOOM_MAX, Math.max(1, s));
  return v < 1.02 ? 1 : v;
}

/** Where a zoomed photo may be moved to: never so far that its edge leaves the frame (w by h, the photo's box). */
export function clampPan(x: number, y: number, s: number, w: number, h: number): { x: number; y: number } {
  const mx = Math.max(0, (w * (s - 1)) / 2), my = Math.max(0, (h * (s - 1)) / 2);
  const fit = (v: number, m: number) => (Number.isFinite(v) ? Math.min(m, Math.max(-m, v)) : 0);
  return { x: fit(x, mx), y: fit(y, my) };
}

/** The zoom two fingers ask for: the zoom they started at, times how far apart they now are over how far they were. */
export function pinchScale(start: number, was: number, now: number): number {
  if (!(was > 0) || !(now > 0)) return clampScale(start);
  return clampScale(start * (now / was));
}
