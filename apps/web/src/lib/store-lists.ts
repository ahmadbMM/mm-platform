import { parseCart, type CartItem } from "./cart";

// The lists the store keeps in this browser alone, besides the cart (CONTRACTS.md section 7): products saved for later
// without an account (F07), the products last looked at (F08), cart lines put aside (F68), and the gift keys of the
// orders placed here that bought gift cards (CONTRACTS.md Additions by lead: gift card codes). Never a price, never
// anything about the person; a list that cannot be read is empty.
export const SAVED_KEY = "mm-saved";
export const RECENT_KEY = "mm-recent";
export const LATER_KEY = "mm-later";
export const GIFT_KEYS_KEY = "mm-gift-keys";
export const MAX_SAVED = 50;
export const MAX_RECENT = 12;
export const MAX_LATER = 20;
export const MAX_GIFT_KEYS = 20;

const SLUG = /^[a-z][a-z0-9-]{1,60}$/;

/** A kept list of product slugs: unknown entries dropped, each once, newest first, `max` at most. */
export function parseSlugs(raw: unknown, max: number): string[] {
  let v = raw;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return []; } }
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === "string" && SLUG.test(x)))].slice(0, max);
}

/** The list with `slug` first (moved there when it is already in it). */
export const slugFirst = (list: readonly string[], slug: string, max: number): string[] =>
  SLUG.test(slug) ? [slug, ...list.filter((s) => s !== slug)].slice(0, max) : [...list];

/** Saved (F07): the slug added when it is not saved, taken out when it is. */
export const slugToggle = (list: readonly string[], slug: string, max = MAX_SAVED): string[] =>
  list.includes(slug) ? list.filter((s) => s !== slug) : slugFirst(list, slug, max);

/** Saved for later (F68): cart lines as the cart keeps them, 20 at most. */
export const parseLater = (raw: unknown): CartItem[] => parseCart(raw).slice(0, MAX_LATER);

/** An order's gift key as store_checkout gives it: 32 hex characters. */
export type GiftKey = { no: number; key: string };
const KEY32 = /^[0-9a-f]{32}$/;
const orderNoOk = (no: unknown): no is number => typeof no === "number" && Number.isInteger(no) && no > 0 && no < 1e9;

/** The gift keys this browser kept (an order's whole gift card codes are shown to its buyer with it; the order's own link
 *  and Track order alone show them masked): unknown entries dropped, one per order, newest first, 20 at most. */
export function parseGiftKeys(raw: unknown): GiftKey[] {
  let v = raw;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return []; } }
  if (!Array.isArray(v)) return [];
  const seen = new Set<number>();
  const out: GiftKey[] = [];
  for (const x of v) {
    const o = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
    const key = typeof o.key === "string" ? o.key.toLowerCase() : "";
    if (!orderNoOk(o.no) || !KEY32.test(key) || seen.has(o.no)) continue;
    seen.add(o.no);
    out.push({ no: o.no, key });
  }
  return out.slice(0, MAX_GIFT_KEYS);
}

/** The list with this order's gift key first (in place of one kept for it before). */
export const giftKeyFirst = (list: readonly GiftKey[], no: number, key: string): GiftKey[] =>
  orderNoOk(no) && KEY32.test(key.toLowerCase()) ? parseGiftKeys([{ no, key: key.toLowerCase() }, ...list.filter((g) => g.no !== no)]) : [...list];

/** The gift key kept for this order, or null. */
export const giftKeyOf = (list: readonly GiftKey[], no: number): string | null => list.find((g) => g.no === no)?.key ?? null;
