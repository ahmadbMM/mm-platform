"use client";

import { useSyncExternalStore } from "react";
import { UNREAD_POLL_MS, UNREAD_UNKNOWN, unreadAfter, unreadAsksAgain, type UnreadState } from "@/lib/market/w3-unread";

// How many of the account's Marketplace threads hold something unread, asked once for the whole page however many
// badges show it (the header's bar, its narrow menu, My Account's row): /api/market/unread, which answers a visitor
// with no account from the cookie alone. The first question waits until the page is idle. A visitor with no account
// (or with a session the database no longer takes) is never asked again on that page; an account is asked again every
// minute and a half while the page is in view, and at once when it comes back into view, a thread has just been read
// or a message arrived (refreshUnread). Nothing is stored anywhere. The rules are lib/market/w3-unread.ts, the one
// file of the Marketplace's this brings to the site's header: it imports nothing else of it.
let state: UnreadState = UNREAD_UNKNOWN;
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let asking = false;

const stop = () => { if (timer) clearTimeout(timer); timer = null; };
function wait() {
  stop();
  if (!subs.size || !unreadAsksAgain(state) || document.visibilityState !== "visible") return;
  timer = setTimeout(() => void ask(), UNREAD_POLL_MS);
}
async function ask() {
  if (asking) return;
  asking = true;
  let raw: unknown = null;
  try {
    const r = await fetch("/api/market/unread", { cache: "no-store", credentials: "same-origin" });
    raw = await r.json().catch(() => null);
  } catch { /* no connection: what is known stays as it was */ }
  asking = false;
  const next = unreadAfter(state, raw);
  const changed = next.n !== state.n;
  state = next;
  if (changed) subs.forEach((f) => f());
  wait();
}
const onVisible = () => { if (document.visibilityState === "visible" && unreadAsksAgain(state)) void ask(); else stop(); };

function subscribe(f: () => void) {
  subs.add(f);
  if (!started) {
    started = true;
    document.addEventListener("visibilitychange", onVisible);
    // (Safari has no requestIdleCallback: a short wait there)
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => void ask(), { timeout: 4000 });
    else setTimeout(() => void ask(), 1200);
  } else if (!timer && !asking) {
    wait(); // a badge is back on the page after none was: the asking carries on
  }
  return () => {
    subs.delete(f);
    if (!subs.size) stop();
  };
}

/** The unread number for a badge: 0 until it is known, and for a visitor with no account. */
export const useUnread = (): number => useSyncExternalStore(subscribe, () => state.n, () => 0);
/** Ask again now: a thread was just opened (and so read), or a message arrived. Does nothing before the first badge
 *  has asked, or for a visitor with no account. */
export function refreshUnread(): void {
  if (started && unreadAsksAgain(state)) void ask();
}
