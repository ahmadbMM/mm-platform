"use client";

import { useEffect, type RefObject } from "react";
import { boxCookie, boxValue, CART_N_COOKIE, WIDE } from "@/lib/sx-b3";

// P10 / SM10-B (2026-11-18): the cart and checkout keep their place before the browser's cart is read. The server draws
// an empty box of the height they had when last drawn here (or of their lines, on a first visit), so the footer under
// them no longer jumps once the cart appears (CLS 0.17 and 0.16 measured). Two small cookies, nothing personal: the
// number of lines and the box's height, kept a month.

const MAX_AGE = 60 * 60 * 24 * 30;

export function setCookie(name: string, value: string) {
  try { document.cookie = `${name}=${value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; Secure`; } catch { /* not kept */ }
}
export function readCookie(name: string): string | undefined {
  try {
    const hit = document.cookie.split(";").map((x) => x.trim()).find((x) => x.startsWith(`${name}=`));
    return hit ? hit.slice(name.length + 1) : undefined;
  } catch { return undefined; }
}

/** The cart's line count, as the cart is written (components/store/useCart.ts). */
export const keepCartCount = (n: number) => setCookie(CART_N_COOKIE, String(Math.max(0, Math.min(20, n))));

/** Keeps the box's height for its next first drawing: as it changes (the cart), or once as it is first drawn (checkout,
 *  whose steps open and close after). */
export function useBoxCookie(ref: RefObject<HTMLElement | null>, key: "cart" | "co", n: number, drawn: boolean, once = false) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !drawn) return;
    if (key === "cart") keepCartCount(n); // a cart kept from before the count was written
    const save = () => {
      const name = boxCookie(key);
      setCookie(name, boxValue(readCookie(name), n, window.innerWidth >= WIDE, el.getBoundingClientRect().height));
    };
    if (once) {
      const id = requestAnimationFrame(() => requestAnimationFrame(save));
      return () => cancelAnimationFrame(id);
    }
    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(save, 250); });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [ref, key, n, drawn, once]);
}
