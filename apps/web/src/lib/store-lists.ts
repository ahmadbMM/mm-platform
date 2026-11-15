import { parseCart, type CartItem } from "./cart";

// The lists the store keeps in this browser alone, besides the cart (CONTRACTS.md section 7): products saved for later
// without an account (F07), the products last looked at (F08), and cart lines put aside (F68). Never a price, never
// anything about the person; a list that cannot be read is empty.
export const SAVED_KEY = "mm-saved";
export const RECENT_KEY = "mm-recent";
export const LATER_KEY = "mm-later";
export const MAX_SAVED = 50;
export const MAX_RECENT = 12;
export const MAX_LATER = 20;

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
