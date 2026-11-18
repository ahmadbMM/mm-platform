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

/** Why a line cannot be ordered as it is: the variant is gone, sold out, has fewer left than asked for, or the line takes
 *  its product past the most one order may hold ("max", the product-management build 2026-11-19). */
export type LineIssue = "gone" | "out" | "short" | "max" | null;
export type CartLine = {
  item: CartItem;
  product: StoreProduct | null;
  variant: StoreVariant | null;
  unit: number;
  total: number;
  issue: LineIssue;
};

/** The cart priced with the store as the page has it. A line that cannot be ordered costs nothing here. A Preview product
 *  (staging) is never sold, so its line is gone; a pre-order is ordered beyond its stock; a product's lines together hold
 *  at most its limit (max_per_order), the line that goes past it marked "max". */
export function cartLines(cart: CartItem[], store: Store): CartLine[] {
  const had = new Map<string, number>();
  return cart.map((item) => {
    const hit = findVariant(store, item.variant);
    if (!hit || hit.product.preview) return { item, product: null, variant: null, unit: 0, total: 0, issue: "gone" };
    const unit = variantPrice(hit.product, hit.variant);
    const before = had.get(hit.product.id) ?? 0;
    had.set(hit.product.id, before + item.qty);
    const limit = hit.product.max_per_order;
    const issue: LineIssue = !hit.product.preorder && hit.variant.stock <= 0 ? "out" : !hit.product.preorder && hit.variant.stock < item.qty ? "short"
      : limit !== null && before + item.qty > limit ? "max" : null;
    return { item, product: hit.product, variant: hit.variant, unit, total: issue ? 0 : Math.round(unit * item.qty * 100) / 100, issue };
  });
}

/** How many of a product's sizes and colours together the cart holds. */
export const productInCart = (cart: readonly CartItem[], p: Pick<StoreProduct, "variants">): number => {
  const ids = new Set(p.variants.map((v) => v.id.toLowerCase()));
  return cart.reduce((n, l) => n + (ids.has(l.variant) ? l.qty : 0), 0);
};

/** How many more of a variant the cart can take: 10 a line, what is in stock (a pre-order has no such bound) and the
 *  product's limit across its lines, less what the cart holds. None of a Preview (never sold). */
export function roomFor(cart: readonly CartItem[], p: Pick<StoreProduct, "variants" | "preorder" | "max_per_order"> & { preview?: boolean }, v: Pick<StoreVariant, "id" | "stock">): number {
  if (p.preview) return 0;
  const line = cart.find((l) => l.variant === v.id.toLowerCase())?.qty ?? 0;
  const byStock = p.preorder ? MAX_QTY : v.stock;
  const byLimit = p.max_per_order === null ? Infinity : p.max_per_order - productInCart(cart, p);
  return Math.max(0, Math.min(MAX_QTY - line, byStock - line, byLimit));
}

/** The cart with each product's lines brought down to its limit (max_per_order): the first lines keep theirs, a later
 *  one takes what is left and goes when nothing is. `changed` says whether anything was cut. */
export function clampCart(cart: readonly CartItem[], store: Store): { cart: CartItem[]; changed: boolean } {
  const had = new Map<string, number>();
  const out: CartItem[] = [];
  let changed = false;
  for (const l of cart) {
    const hit = findVariant(store, l.variant);
    const limit = hit?.product.max_per_order ?? null;
    if (!hit || limit === null) { out.push(l); continue; }
    const before = had.get(hit.product.id) ?? 0;
    const qty = Math.min(l.qty, Math.max(0, limit - before));
    had.set(hit.product.id, before + qty);
    if (qty !== l.qty) changed = true;
    if (qty > 0) out.push(qty === l.qty ? l : { ...l, qty });
  }
  return { cart: out, changed };
}

export const subtotalOf = (lines: CartLine[]) => Math.round(lines.reduce((n, l) => n + l.total, 0) * 100) / 100;

/** Whether every product in these lines may go by courier (a bike may not). */
export const shipsKsa = (lines: CartLine[]) => lines.every((l) => !l.product || l.product.ship_ksa);

/** "From" goes before a product's price when its variants cost different amounts. */
export const priceFrom = (p: StoreProduct) => { const r = priceRange(p); return r.lo !== r.hi; };

// ── The store build (2026-11-15, CONTRACTS.md sections 3 and 7) ─────────────────────────────────

/** "Buy now" (F35): /store/checkout?buy=<variant>&qty=<1-10> checks out that one line and leaves the cart alone. Null
 *  when the address asks for none (or a malformed one). */
export function buyNowOf(q: Record<string, string | string[] | undefined> | URLSearchParams): CartItem | null {
  const get = (k: string) => (q instanceof URLSearchParams ? q.get(k) : typeof q[k] === "string" ? (q[k] as string) : null);
  const id = (get("buy") ?? "").toLowerCase(), qty = Math.floor(Number(get("qty") ?? "1"));
  return UUID.test(id) ? { variant: id, qty: qty >= 1 && qty <= MAX_QTY ? qty : 1 } : null;
}
export const buyNowHref = (variant: string, qty = 1) => `/store/checkout?buy=${encodeURIComponent(variant.toLowerCase())}&qty=${Math.min(MAX_QTY, Math.max(1, Math.floor(qty)))}`;

/** How long an Add button says "Added" with its drawn tick before it is Add again (D14-E): the same moment on a card's quick
 *  add, the buy box, the add-ons and the starter set. */
export const ADDED_MS = 2500;

/** The bundle discounts these lines earn (F31), as the database works them out at checkout (store_checkout): only beside
 *  a discount licence; for each product with a bundle, in the store's order, every complete set (the product and each
 *  of its items once, a unit counted in one set only) costs the bundle's price instead of the lowest price of each.
 *  Gift cards never. A line that cannot be ordered is not counted. */
export function bundleDiscount(lines: CartLine[], licence: string | boolean | null): { ref: string; sets: number; amount: number }[] {
  if (!licence) return [];
  const ok = lines.filter((l) => !l.issue && l.product && l.variant && l.product.kind !== "gift_card");
  const left = new Map<string, number>(), unit = new Map<string, number>();
  for (const l of ok) {
    const id = (l.product as StoreProduct).id;
    left.set(id, (left.get(id) ?? 0) + l.item.qty);
    unit.set(id, Math.min(unit.get(id) ?? Infinity, l.unit));
  }
  const heads = [...new Map(ok.map((l) => [(l.product as StoreProduct).id, l.product as StoreProduct])).values()]
    .filter((p) => p.bundle).sort((a, b) => a.sort - b.sort || a.name_en.localeCompare(b.name_en));
  const out: { ref: string; sets: number; amount: number }[] = [];
  for (const p of heads) {
    const ids = [p.id, ...(p.bundle as NonNullable<StoreProduct["bundle"]>).items];
    if (ids.some((id) => !left.has(id))) continue;
    const sets = Math.min(...ids.map((id) => left.get(id) ?? 0));
    const per = Math.round((ids.reduce((n, id) => n + (unit.get(id) ?? 0), 0) - (p.bundle as NonNullable<StoreProduct["bundle"]>).price) * 100) / 100;
    if (sets < 1 || per <= 0) continue;
    for (const id of ids) left.set(id, (left.get(id) ?? 0) - sets);
    out.push({ ref: p.slug, sets, amount: Math.round(per * sets * 100) / 100 });
  }
  return out;
}
