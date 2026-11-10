"use client";

import { useSyncExternalStore } from "react";
import { addItem, CART_KEY, parseCart, removeItem, setItemQty, type CartItem } from "@/lib/cart";

// The cart in this browser (localStorage "mm-cart"), shared by the header's count, the product page, the
// cart and checkout: one copy here, every component that shows it re-drawn when it changes - in this tab,
// and in another tab through the storage event. The server knows nothing of it, so a page is drawn with an
// empty cart and fills in once it is in the browser (no mismatch while React takes the page over).

const EMPTY: CartItem[] = [];
let cache: CartItem[] | null = null;
const listeners = new Set<() => void>();

function read(): CartItem[] {
  if (cache) return cache;
  try { cache = parseCart(window.localStorage.getItem(CART_KEY)); } catch { cache = []; }
  return cache;
}

function write(next: CartItem[]) {
  cache = next;
  try { window.localStorage.setItem(CART_KEY, JSON.stringify(next)); } catch { /* private mode or full: kept for this page */ }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== CART_KEY && e.key !== null) return;
    cache = null;
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Adds `qty` of a variant: how many the cart took (fewer at 10 a line, 0 when the line already has 10), or null
 *  when the cart already has 20 lines. */
export function cartAdd(variant: string, qty: number): number | null {
  const c = read(), id = variant.toLowerCase();
  const had = c.find((l) => l.variant === id)?.qty ?? 0;
  const next = addItem(c, variant, qty);
  if (!next) return null;
  const got = (next.find((l) => l.variant === id)?.qty ?? 0) - had;
  if (got > 0) write(next);
  return got;
}
export const cartSetQty = (variant: string, qty: number) => write(setItemQty(read(), variant, qty));
export const cartRemove = (variant: string) => write(removeItem(read(), variant));
export const cartClear = () => write([]);
/** Puts lines back (an order that was not paid): each added to what is there. */
export function cartRestore(items: CartItem[]) {
  let c = read();
  for (const i of items) c = addItem(c, i.variant, i.qty) ?? c;
  write(c);
}

const never = () => () => {};
/** False while the page is the server's drawing, true once it runs in the browser: the cart is known only then. */
export const useHydrated = () => useSyncExternalStore(never, () => true, () => false);

/** The delivery way picked on the cart, carried to checkout for this visit. */
export const FULFIL_KEY = "mm-cart-fulfil";
export function savedFulfil(): string | null {
  try { return window.sessionStorage.getItem(FULFIL_KEY); } catch { return null; }
}
export function saveFulfil(v: string) {
  try { window.sessionStorage.setItem(FULFIL_KEY, v); } catch { /* not kept */ }
}
