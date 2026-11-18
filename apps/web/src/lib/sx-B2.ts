import { sized, srcSet } from "./img";
import { optionsOf, type StoreProduct } from "./store-core";
import { deliveryRange, readyDay, type Fulfil } from "./store-delivery";
import type { PaySettings } from "./pay/settings";

// The product page's rules from the "do all" build of 2026-11-18 (builder B2: the product page), pure so they are
// unit-tested (src/lib/__tests__/sx-B2.test.ts) and safe in the browser.

type Content = Record<string, unknown> | null | undefined;
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// ── SM06-B / P05: the size buttons in even rows ─────────────────────────────────────────────────

/** How many size buttons stand in a row: `narrow` in a column under about 400 px (a phone, the desktop's middle column),
 *  `wide` where there is room (a tablet, a wide column). Never a lone button on the last row when the sizes split evenly:
 *  six sizes go 3 + 3, then 6 across; four go 2 + 2 when they carry the rider height (two lines), else 4 across. */
export function sizeGrid(n: number, two: boolean): { narrow: number; wide: number } {
  const k = Math.max(1, Math.floor(n) || 1);
  const narrow = k <= 3 ? k : k === 4 ? (two ? 2 : 4) : k <= 6 || k === 9 ? 3 : 4;
  const wide = k <= 6 ? k : k === 9 ? 3 : 4;
  return { narrow, wide };
}

// ── P09: the product photos at the size they are drawn ──────────────────────────────────────────

/** The widths the media route answers (app/media/[...path]/route.ts): 320 for thumbnails, 1600 for a large sharp screen. */
export const MEDIA_WIDTHS = [320, 640, 1280, 1600] as const;
const isMedia = (url: string) => /^\/media\/[^?#]+$/.test(url);

/** The main photo's srcset, up to 1,600 px wide: a staff photo (/media) at every copy the route answers, a site photo
 *  (/site) at every copy the build made; any other address has none. */
export function pdpSrcSet(url: string): string | undefined {
  if (isMedia(url)) return MEDIA_WIDTHS.filter((w) => w >= 640).map((w) => `${url}?w=${w} ${w}w`).join(", ");
  return srcSet(url);
}

/** A thumbnail (64 px, 192 px on a 3x screen): a staff photo's smallest copy, else the smallest the site has. */
export const thumbSrc = (url: string): string => (isMedia(url) ? `${url}?w=320` : sized(url, 320));

/** What width the main photo is drawn at, for the browser to choose from the srcset: on a phone the column less the
 *  page's sides and the peek of the next photo; on a tablet about 55% of the page (two columns, SM07-B); from 1200 px
 *  the photo column of three (SM08-B) less its thumbnail rail, capped by the 1,320 px page. */
export const GALLERY_SIZES = "(min-width: 1200px) min(34vw, 500px), (min-width: 768px) 50vw, calc(100vw - 64px)";

// ── N09 / N01: a link that opens the product with a size and colour picked ──────────────────────

/** The size and colour an address asks for (?size=M&colour=Black, also ?color=), each only when the product comes in
 *  it: a size matched without regard to case, a colour by its English or Arabic name. Anything else is ignored. */
export function presetOf(p: Pick<StoreProduct, "variants">, q: Record<string, string | string[] | undefined> | null | undefined): { size: string | null; colour: string | null } {
  const one = (k: string) => { const v = q?.[k]; const s = Array.isArray(v) ? v[0] : v; return typeof s === "string" ? s.trim().slice(0, 40) : ""; };
  const o = optionsOf(p as StoreProduct);
  const want = one("size").toLowerCase();
  const size = want ? o.sizes.find((s) => s.toLowerCase() === want) ?? null : null;
  const c = (one("colour") || one("color")).toLowerCase().replace(/[-_+]/g, " ");
  const colour = c ? o.colours.find((x) => x.en.toLowerCase() === c || (x.ar ?? "").trim() === c)?.key ?? null : null;
  return { size, colour };
}

/** The product's address to share: the page's own (no language: the friend reads it in theirs), with the size and the
 *  colour picked. `base` is the site (https://micromobility.sa) or the browser's origin. */
export function shareHref(base: string, slug: string, pick: { size?: string | null; colour?: string | null }): string {
  const q = new URLSearchParams();
  if (pick.size) q.set("size", pick.size);
  if (pick.colour) q.set("colour", pick.colour);
  const s = q.toString();
  return `${base.replace(/\/+$/, "")}/store/${slug}${s ? `?${s}` : ""}`;
}

/** The slugs a shared saved list carries (/store/saved?list=max,helmet): store slugs only, at most `max`, no repeats. */
export function sharedSlugs(raw: string | string[] | undefined, max: number): string[] | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== "string" || !s.trim()) return null;
  const out: string[] = [];
  for (const x of s.split(",")) { const v = x.trim().toLowerCase(); if (/^[a-z][a-z0-9-]{1,60}$/.test(v) && !out.includes(v)) out.push(v); }
  return out.length ? out.slice(0, max) : null;
}

/** A shared link's preview text (Open Graph): the price with VAT, then the tagline. A plain text a phone draws in its
 *  own font, so the amount is written with the currency's letters (as /bikes writes a ride's price), not the new riyal
 *  sign, which many phones cannot draw yet. */
export function previewText(locale: string, price: number, from: boolean, tagline: string): string {
  const n = Math.round(price).toLocaleString("en-US");
  const amt = locale === "ar" ? `${from ? "من " : ""}${n} ر.س شامل الضريبة` : `${from ? "From " : ""}SAR ${n} incl. VAT`;
  return tagline ? `${amt} · ${tagline}` : amt;
}

// ── N12: the free first check-up ────────────────────────────────────────────────────────────────

/** The weeks within which a new bike's first check-up is free (site_content store.checkup = {on, weeks}): 12 unless
 *  staff change it, null when they switch it off (on: false or weeks 0). */
export function checkupWeeks(c: Content): number | null {
  const v = obj(c?.["store.checkup"]);
  if (!v) return 12;
  if (v.on === false) return null;
  const w = Number(v.weeks ?? 12);
  return Number.isInteger(w) && w >= 1 && w <= 52 ? w : w === 0 ? null : 12;
}

// ── N36: "Order by <date> for Eid delivery", only when it is true ───────────────────────────────

/** An occasion staff set (site_content store.orderBy): its name, its day, and the last day to order for each way. */
export type OrderBy = { en: string; ar: string | null; day: string; by: Partial<Record<Fulfil, string>> };
export function orderByOf(c: Content): OrderBy | null {
  const v = obj(c?.["store.orderBy"]);
  if (!v) return null;
  const en = typeof v.en === "string" ? v.en.trim().slice(0, 30) : "";
  const ar = typeof v.ar === "string" && v.ar.trim() ? v.ar.trim().slice(0, 30) : null;
  const day = typeof v.day === "string" && DAY.test(v.day) ? v.day : "";
  const b = obj(v.by) ?? {};
  const by: Partial<Record<Fulfil, string>> = {};
  for (const k of ["pickup", "jeddah", "ksa"] as const) if (typeof b[k] === "string" && DAY.test(b[k] as string)) by[k] = b[k] as string;
  return en && day && Object.keys(by).length ? { en, ar, day, by } : null;
}

/** The last day to order by each way for the occasion, when ordering today really has it there in time: today is on or
 *  before staff's last day, and the way's own latest date for an order placed today (the delivery range's end, pickup's
 *  ready day) is on or before the occasion. A way with no dates set says nothing. */
export function orderByDays(o: OrderBy | null, s: PaySettings, today: string): Partial<Record<Fulfil, string>> {
  if (!o || today > o.day) return {};
  const out: Partial<Record<Fulfil, string>> = {};
  for (const k of ["pickup", "jeddah", "ksa"] as const) {
    const by = o.by[k];
    if (!by || today > by || by > o.day) continue;
    const last = k === "pickup" ? readyDay(s, today) : deliveryRange(s.delivery[k].days, today)?.to ?? null;
    if (last && last <= o.day) out[k] = by;
  }
  return out;
}

// ── N25: an ex-rental bike's record ─────────────────────────────────────────────────────────────

/** What store_fleet_record answers for a certified pre-owned bike linked to a fleet bike: its rides and whole months in
 *  the fleet. Null for anything else (not linked, an older database, an answer out of shape). */
export function fleetRecordOf(v: unknown): { rides: number; months: number } | null {
  const o = obj(v);
  if (!o) return null;
  const rides = Number(o.rides), months = Number(o.months);
  if (!Number.isInteger(rides) || !Number.isInteger(months) || rides < 0 || months < 0 || rides > 100000 || months > 600) return null;
  return rides === 0 && months === 0 ? null : { rides, months };
}

/** What store_rode_type answers (N16): the signed-in rider's Saturday rides on this bike's type; null when none. */
export function rodeOf(v: unknown): number | null {
  const n = Number(obj(v)?.rides ?? v);
  return Number.isInteger(n) && n > 0 && n < 10000 ? n : null;
}
