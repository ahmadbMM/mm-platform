import { findVariant, priceRange, variantPrice, type Store, type StoreProduct, type StoreVariant } from "./store-core";

// The cart (localStorage "mm-cart"): only what was picked and how many, [{variant, qty}], never a price.
// Every price comes from the products the page was drawn with, and the order's from the database.

export type CartItem = { variant: string; qty: number };
export const CART_KEY = "mm-cart";
export const MAX_QTY = 10;
export const MAX_LINES = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What was kept, as a cart: unknown entries dropped, quantities kept 1 to 10, one line per variant, 20 lines at most. */
export function parseCart(raw: unknown): CartItem[] {
  let v = raw;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return []; } }
  if (!Array.isArray(v)) return [];
  const out: CartItem[] = [];
  for (const x of v) {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const id = typeof o.variant === "string" ? o.variant.toLowerCase() : "";
    const qty = Math.floor(Number(o.qty));
    if (!UUID.test(id) || !(qty >= 1)) continue;
    const at = out.find((l) => l.variant === id);
    if (at) at.qty = Math.min(MAX_QTY, at.qty + qty);
    else if (out.length < MAX_LINES) out.push({ variant: id, qty: Math.min(MAX_QTY, qty) });
  }
  return out;
}

/** The cart with `qty` more of a variant (at most 10 of it); a new line goes first. Null when the cart is full. */
export function addItem(cart: CartItem[], variant: string, qty: number): CartItem[] | null {
  const id = variant.toLowerCase();
  const n = Math.max(1, Math.floor(qty));
  if (cart.some((l) => l.variant === id)) return cart.map((l) => (l.variant === id ? { ...l, qty: Math.min(MAX_QTY, l.qty + n) } : l));
  if (cart.length >= MAX_LINES) return null;
  return [{ variant: id, qty: Math.min(MAX_QTY, n) }, ...cart];
}

export const setItemQty = (cart: CartItem[], variant: string, qty: number): CartItem[] =>
  cart.map((l) => (l.variant === variant ? { ...l, qty: Math.min(MAX_QTY, Math.max(1, Math.floor(qty))) } : l));
export const removeItem = (cart: CartItem[], variant: string): CartItem[] => cart.filter((l) => l.variant !== variant);
export const cartCount = (cart: CartItem[]) => cart.reduce((n, l) => n + l.qty, 0);

/** Why a line cannot be ordered as it is: the variant is gone, sold out, or has fewer left than asked for. */
export type LineIssue = "gone" | "out" | "short" | null;
export type CartLine = {
  item: CartItem;
  product: StoreProduct | null;
  variant: StoreVariant | null;
  unit: number;
  total: number;
  issue: LineIssue;
};

/** The cart priced with the store as the page has it. A line that cannot be ordered costs nothing here. */
export function cartLines(cart: CartItem[], store: Store): CartLine[] {
  return cart.map((item) => {
    const hit = findVariant(store, item.variant);
    if (!hit) return { item, product: null, variant: null, unit: 0, total: 0, issue: "gone" };
    const unit = variantPrice(hit.product, hit.variant);
    const issue: LineIssue = hit.variant.stock <= 0 ? "out" : hit.variant.stock < item.qty ? "short" : null;
    return { item, product: hit.product, variant: hit.variant, unit, total: issue ? 0 : Math.round(unit * item.qty * 100) / 100, issue };
  });
}

export const subtotalOf = (lines: CartLine[]) => Math.round(lines.reduce((n, l) => n + l.total, 0) * 100) / 100;

/** Whether every product in these lines may go by courier (a bike may not). */
export const shipsKsa = (lines: CartLine[]) => lines.every((l) => !l.product || l.product.ship_ksa);

/** "From" goes before a product's price when its variants cost different amounts. */
export const priceFrom = (p: StoreProduct) => { const r = priceRange(p); return r.lo !== r.hi; };
