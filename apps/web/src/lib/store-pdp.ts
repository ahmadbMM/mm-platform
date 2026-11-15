import { buyNowHref, MAX_QTY, type CartItem } from "./cart";
import { deliveryOptions, type DeliveryOption, type Fulfil } from "./store-delivery";
import type { PaySettings } from "./pay/settings";
import { optionsOf, productStock, sizeRow, variantPrice, type CmRange, type SizeRow, type StoreProduct, type StoreVariant } from "./store-core";

// The product page's top half (store build 2026-11-15, chain w3a): the rules its buy box, size guide, gallery and
// photo viewer follow, kept here so they are tested without drawing anything. Nothing here reads anything, so the
// browser's components use it.

const r2 = (n: number) => Math.round(n * 100) / 100;

// ── The estimated total beside Add (F25) and the delivery rows at the picked price (X06) ─────────

export type Estimate = {
  /** What the goods come to: the picked item times its quantity, and every extra ticked (the lowest price when no
   *  variant is picked yet, so the delivery rows say what the cheapest choice would cost). */
  subtotal: number;
  /** Every way to have it at that subtotal, with its fee (the free-delivery threshold reached or not). */
  options: DeliveryOption[];
  /** The way picked, else the first offered; null when none is. */
  way: DeliveryOption | null;
  /** The estimated total with that way's fee; null while the item's price is not known (sizes at different prices and
   *  none picked). */
  total: number | null;
};

export function estimate(s: PaySettings, a: { unit: number | null; lo: number; qty: number; extras: readonly number[]; shipKsa: boolean; picked: string | null }): Estimate {
  const qty = Math.min(MAX_QTY, Math.max(1, Math.floor(a.qty) || 1));
  const subtotal = r2((a.unit ?? a.lo) * qty + a.extras.reduce((n, x) => n + x, 0));
  const options = deliveryOptions(s, { subtotal, shipKsa: a.shipKsa });
  const way = options.find((o) => o.id === a.picked) ?? options[0] ?? null;
  return { subtotal, options, way, total: a.unit === null ? null : r2(subtotal + (way?.fee ?? 0)) };
}

/** A way kept from the cart or this page (sessionStorage mm-cart-fulfil), as a delivery way, or null. */
export const keptWay = (v: string | null | undefined): Fulfil | null => (v === "pickup" || v === "jeddah" || v === "ksa" ? v : null);

// ── Sizes: the rider's height inside each size button (F20), the size guide (F21) and its height field (F22) ──

/** A centimetre range as the page words it: "165-174", "190+" (no top), "up to 160" (no bottom); null without one. */
export type CmText = { kind: "range"; min: number; max: number } | { kind: "from"; min: number } | { kind: "upto"; max: number };
export function cmText(r: CmRange | null | undefined): CmText | null {
  if (!r) return null;
  if (r.min !== null && r.max !== null) return { kind: "range", min: r.min, max: r.max };
  if (r.min !== null) return { kind: "from", min: r.min };
  if (r.max !== null) return { kind: "upto", max: r.max };
  return null;
}

/** The rider height staff gave this size (F20), or null. */
export const sizeHeight = (p: StoreProduct, size: string): CmText | null => cmText(sizeRow(p, size)?.height);

export type GuideCol = "height" | "chest" | "waist";
/** The size guide (F21): the rows staff gave for the sizes the product comes in, in the product's order, and the columns
 *  any row fills (a bike's rider height; a jersey's chest and waist). Null when no size has one. */
export function guideOf(p: StoreProduct): { cols: GuideCol[]; rows: SizeRow[] } | null {
  const sizes = optionsOf(p).sizes;
  const rows = sizes.map((s) => sizeRow(p, s)).filter((r): r is SizeRow => !!r);
  if (!rows.length) return null;
  const cols = (["height", "chest", "waist"] as const).filter((c) => rows.some((r) => r[c]));
  return { cols, rows };
}

/** A height typed in the guide (F22): whole centimetres 50-230 in any digits, else null. */
export function heightCm(raw: string): number | null {
  const d = raw.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0)).replace(/\D/g, "");
  if (!d || d.length > 3) return null;
  const n = Number(d);
  return n >= 50 && n <= 230 ? n : null;
}

// ── Sold out: the back-in-stock request (F34) ───────────────────────────────────────────────────

/** The variant a request for a sold-out choice names: the size (or colour) tapped with the other choice as picked, else
 *  the first variant of it. The product's own "Tell me when it's back" (no size or colour tapped) names the choice made
 *  (`picked`, a size and colour sold out together), else the first variant. Null when it names none. */
export function soldOutTarget(p: StoreProduct, dim: "size" | "colour" | null, value: string | null, other: string | null, picked: StoreVariant | null = null): StoreVariant | null {
  if (!dim || value === null) return picked ?? p.variants[0] ?? null;
  const has = (v: StoreVariant) => (dim === "size" ? v.size === value : v.color_en === value);
  const otherOk = (v: StoreVariant) => !other || (dim === "size" ? !v.color_en || v.color_en === other : !v.size || v.size === other);
  return p.variants.find((v) => has(v) && otherOk(v)) ?? p.variants.find(has) ?? null;
}

/** "M · Black" for the request's title and the staff list's label (≤ 60, as store_stock_requests keeps it). */
export const requestLabel = (v: StoreVariant | null) => (v ? [v.size, v.color_en].filter(Boolean).join(" · ").slice(0, 60) : "");

// ── The Extras step of a bike (F60) ─────────────────────────────────────────────────────────────

/** The add-ons a bike's Extras step offers as tick rows: the products staff put under Goes with, in their order, that
 *  can be bought now (in stock, not a gift card). */
export const extrasOf = (related: readonly StoreProduct[]): StoreProduct[] =>
  related.filter((x) => x.kind !== "gift_card" && productStock(x).kind !== "out").slice(0, 8);

/** The choices an add-on can be ticked with: its variants still in stock, in staff's order. */
export const extraChoices = (x: StoreProduct): StoreVariant[] => x.variants.filter((v) => v.stock > 0);

/** The ticked add-ons as cart lines (one of each) with their prices: a tick whose choice is gone is left out. */
export function ticked(extras: readonly StoreProduct[], picks: Readonly<Record<string, string | null>>): { variant: string; price: number; product: StoreProduct }[] {
  const out: { variant: string; price: number; product: StoreProduct }[] = [];
  for (const x of extras) {
    const id = picks[x.id];
    if (!id) continue;
    const v = extraChoices(x).find((c) => c.id === id);
    if (v) out.push({ variant: v.id.toLowerCase(), price: variantPrice(x, v), product: x });
  }
  return out;
}

// ── Buy now (F35) with the ticked extras, and the express Apple Pay button (F83) ────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_WITH = 8;

/** /store/checkout?buy=<variant>&qty=<n> (lib/cart.ts buyNowHref), and &with=<variant>,<variant> for the extras ticked
 *  with it, one of each (CONTRACTS.md, Additions by w3a). */
export function buyNowWithHref(variant: string, qty: number, extras: readonly string[] = []): string {
  const main = variant.toLowerCase();
  const w = [...new Set(extras.map((x) => x.toLowerCase()).filter((x) => UUID.test(x) && x !== main))].slice(0, MAX_WITH);
  return buyNowHref(variant, qty) + (w.length ? `&with=${w.join(",")}` : "");
}

/** Every line a buy-now address names: the item bought now, then each extra once (at most 8, no repeat of the item);
 *  [] when it names no item. The checkout's reader for buyNowWithHref. */
export function buyNowLines(q: Record<string, string | string[] | undefined> | URLSearchParams): CartItem[] {
  const get = (k: string) => (q instanceof URLSearchParams ? q.get(k) : typeof q[k] === "string" ? (q[k] as string) : null);
  const id = (get("buy") ?? "").toLowerCase();
  if (!UUID.test(id)) return [];
  const n = Math.floor(Number(get("qty") ?? "1"));
  const out: CartItem[] = [{ variant: id, qty: n >= 1 && n <= MAX_QTY ? n : 1 }];
  for (const x of (get("with") ?? "").split(",").map((s) => s.trim().toLowerCase())) {
    if (out.length > MAX_WITH) break;
    if (UUID.test(x) && !out.some((l) => l.variant === x)) out.push({ variant: x, qty: 1 });
  }
  return out;
}

// ── Tabby's line under the price (F29) ──────────────────────────────────────────────────────────

/** One of Tabby's four payments for this amount (the last one takes what rounding leaves), worked in whole halalas: in
 *  riyals 4.4 * 25 is 110.00000000000001, which rounded up to 1.11 where a quarter of 4.40 is 1.10. */
export const tabbyPart = (amount: number): number => Math.ceil(Math.round((Number(amount) || 0) * 100) / 4) / 100;

// ── Ask about it on WhatsApp (F32) ──────────────────────────────────────────────────────────────

/** The number WhatsApp opens: the site's WhatsApp link when it is a wa.me one, else the contact phone; digits only. */
export function waDigits(link: string | null | undefined, phone: string | null | undefined): string {
  const m = /^https:\/\/(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?phone=)\+?(\d{8,15})/i.exec((link ?? "").trim());
  if (m) return m[1];
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 ? d : "";
}
export const waHref = (digits: string, text: string) => (digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : "");

// ── Latin names inside Arabic text (O11-B) ──────────────────────────────────────────────────────

/** A text cut where Latin runs start and end ("دراجة ALVAS DA54 MAX الجديدة" -> the Arabic, "ALVAS DA54 MAX", the
 *  Arabic), so a right-to-left page isolates each Latin run in <bdi>. A run holds at least one Latin letter: a number
 *  alone stays in the sentence. */
export function latinRuns(text: string): { text: string; latin: boolean }[] {
  const out: { text: string; latin: boolean }[] = [];
  const re = /[A-Za-z0-9][A-Za-z0-9.'’+×/&\- ]*/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    let run = m[0];
    // a run never ends on a space or a mark that belongs to the sentence around it
    const trail = /[\s.'’+/&-]+$/.exec(run)?.[0] ?? "";
    run = run.slice(0, run.length - trail.length);
    if (!/[A-Za-z]/.test(run)) continue;
    const start = m.index ?? 0;
    if (start > at) out.push({ text: text.slice(at, start), latin: false });
    out.push({ text: run, latin: true });
    at = start + run.length;
  }
  if (at < text.length) out.push({ text: text.slice(at), latin: false });
  return out.filter((x) => x.text);
}

// ── The gallery (D12-C), its viewer (F13) ───────────────────────────────────────────────────────

/** The photo after (or before) this one: no wrap past the ends. */
export const stepPhoto = (at: number, n: number, by: 1 | -1): number => Math.min(Math.max(0, at + by), Math.max(0, n - 1));

export const ZOOM_MAX = 4;
/** A pinch: the zoom it started at times how far the fingers moved apart, kept 1 to 4. */
export function pinchScale(start: number, startDist: number, dist: number): number {
  if (!(startDist > 0) || !(dist > 0)) return clampScale(start);
  return clampScale(start * (dist / startDist));
}
export const clampScale = (s: number) => Math.min(ZOOM_MAX, Math.max(1, Number.isFinite(s) ? s : 1));

/** How far a zoomed photo can be moved: never so far that its edge leaves the frame's (w × h the frame). */
export function clampPan(x: number, y: number, scale: number, w: number, h: number): { x: number; y: number } {
  const mx = Math.max(0, ((scale - 1) * w) / 2), my = Math.max(0, ((scale - 1) * h) / 2);
  const c = (v: number, m: number) => (m === 0 ? 0 : Math.min(m, Math.max(-m, v)));
  return { x: c(x, mx), y: c(y, my) };
}

/** A swipe along the photos at zoom 1: the way it goes (+1 the next photo), or 0 for a tap or a short move. On a
 *  right-to-left page the next photo comes from the left, so a swipe to the right shows it (A06-A). */
export function swipeStep(dx: number, dy: number, rtl: boolean): 1 | -1 | 0 {
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
  const toNext = rtl ? dx > 0 : dx < 0;
  return toNext ? 1 : -1;
}

/** The arrow key that shows the next photo: the reading direction's. */
export const keyStep = (key: string, rtl: boolean): 1 | -1 | 0 =>
  key === "ArrowRight" ? (rtl ? -1 : 1) : key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
