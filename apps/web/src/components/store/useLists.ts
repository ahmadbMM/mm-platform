"use client";

import { useSyncExternalStore } from "react";
import type { CartItem } from "@/lib/cart";
import {
  GIFT_KEYS_KEY, giftKeyFirst, giftKeyOf, LATER_KEY, MAX_RECENT, MAX_SAVED, parseGiftKeys, parseLater, parseSlugs, RECENT_KEY, SAVED_KEY, slugFirst,
  slugToggle, type GiftKey,
} from "@/lib/store-lists";

// The store's browser-kept lists (lib/store-lists.ts) the way useCart keeps the cart: one copy per key here, every
// component that shows a list re-drawn when it changes, in this tab and in another through the storage event. A page is
// drawn with empty lists and fills in once it runs in the browser.

type Kind = "saved" | "recent" | "later" | "gifts";
const KEYS: Record<Kind, string> = { saved: SAVED_KEY, recent: RECENT_KEY, later: LATER_KEY, gifts: GIFT_KEYS_KEY };
const parse: Record<Kind, (raw: unknown) => unknown[]> = {
  saved: (r) => parseSlugs(r, MAX_SAVED),
  recent: (r) => parseSlugs(r, MAX_RECENT),
  later: (r) => parseLater(r),
  gifts: (r) => parseGiftKeys(r),
};
const EMPTY: unknown[] = [];
const cache: Partial<Record<Kind, unknown[]>> = {};
const listeners = new Set<() => void>();

function read(k: Kind): unknown[] {
  const hit = cache[k];
  if (hit) return hit;
  let v: unknown[] = [];
  try { v = parse[k](window.localStorage.getItem(KEYS[k])); } catch { /* blocked storage: empty */ }
  cache[k] = v;
  return v;
}
function write(k: Kind, next: unknown[]) {
  cache[k] = next;
  try { window.localStorage.setItem(KEYS[k], JSON.stringify(next)); } catch { /* private mode or full: kept for this page */ }
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    const k = (Object.keys(KEYS) as Kind[]).find((x) => KEYS[x] === e.key);
    if (e.key !== null && !k) return;
    if (k) delete cache[k]; else for (const x of Object.keys(KEYS) as Kind[]) delete cache[x];
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

/** Saved products' slugs, newest first (F07). */
export const useSaved = () => useSyncExternalStore(subscribe, () => read("saved") as string[], () => EMPTY as string[]);
/** The products last looked at, newest first (F08). */
export const useRecent = () => useSyncExternalStore(subscribe, () => read("recent") as string[], () => EMPTY as string[]);
/** Cart lines saved for later (F68). */
export const useLater = () => useSyncExternalStore(subscribe, () => read("later") as CartItem[], () => EMPTY as CartItem[]);

/** Saves a product, or takes it out of Saved; answers whether it is saved now. */
export function savedToggle(slug: string): boolean {
  const next = slugToggle(read("saved") as string[], slug);
  write("saved", next);
  return next.includes(slug);
}
/** Puts a product first among the last looked at (the product page, RecordView). */
export const recentAdd = (slug: string) => {
  const was = read("recent") as string[];
  if (was[0] !== slug) write("recent", slugFirst(was, slug, MAX_RECENT));
};
/** Puts a cart line aside, first, in place of one already kept for that variant; laterRemove takes one back out. */
export function laterPut(item: CartItem) {
  const was = read("later") as CartItem[];
  write("later", parseLater([item, ...was.filter((l) => l.variant !== item.variant.toLowerCase())]));
}
export const laterRemove = (variant: string) => write("later", (read("later") as CartItem[]).filter((l) => l.variant !== variant.toLowerCase()));

/** Keeps the gift key the checkout gave for an order that buys gift cards: this browser alone then shows their whole codes
 *  on the order's page (the order's link and Track order show them masked). */
export const giftKeyKeep = (no: number, key: string) => write("gifts", giftKeyFirst(read("gifts") as GiftKey[], no, key));
/** The gift key this browser kept for the order, or null. */
export const giftKeyFor = (no: number): string | null => giftKeyOf(read("gifts") as GiftKey[], no);
