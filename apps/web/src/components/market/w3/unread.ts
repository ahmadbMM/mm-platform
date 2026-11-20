"use client";

import { useSyncExternalStore } from "react";
import { UNREAD_POLL_MS } from "@/lib/market/w3";
import { mkGet } from "@/lib/market/w3-client";

// How many of the account's Marketplace threads hold something unread, asked once for the whole page however many
// badges show it (the header's bar, its narrow menu, My Account's row): /api/market/unread, which answers a visitor
// with no account from the cookie alone. The first question waits until the page is idle. A visitor with no account
// is never asked again on that page; an account is asked again every minute and a half while the page is in view, and
// at once when it comes back into view or a thread has just been read (refreshUnread). Nothing is stored anywhere.
type State = { n: number; signedIn: boolean | null };
let state: State = { n: 0, signedIn: null };
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let asking = false;

const stop = () => { if (timer) clearTimeout(timer); timer = null; };
function wait() {
  stop();
  if (!subs.size || state.signedIn === false || document.visibilityState !== "visible") return;
  timer = setTimeout(() => void ask(), UNREAD_POLL_MS);
}
async function ask() {
  if (asking) return;
  asking = true;
  const r = await mkGet<{ signedIn: boolean; n: number }>("/api/market/unread");
  asking = false;
  if (r.ok) {
    const next: State = { signedIn: r.signedIn === true, n: r.signedIn === true && Number.isFinite(r.n) ? Math.max(0, Math.floor(r.n)) : 0 };
    const changed = next.n !== state.n;
    state = next;
    if (changed) subs.forEach((f) => f());
  }
  wait();
}
const onVisible = () => { if (document.visibilityState === "visible" && state.signedIn !== false) void ask(); else stop(); };

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
  if (started && state.signedIn !== false) void ask();
}
