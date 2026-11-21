"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { ManageError } from "@/lib/booking-manage";
import type { ManageCtx } from "@/lib/booking-manage-server";

// The browser's half of changing a booking on a ticket (TicketManage.tsx, TicketLockers.tsx, LockerPick.tsx): one read of
// what the dialogs need per booking (POST /api/booking/manage), shared by every part of the ticket that asks for it, and
// the one way they post a change. A change tells the page twice: router.refresh() draws a server-drawn page again, and a
// "mm:booking-changed" event ({detail: {action, session, ids}}) on window tells a page that drew the ticket itself (the
// booking flow's confirmation) to read its tickets again.

export type Answer<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; error: ManageError | "network"; detail?: string; i?: number; field?: string; moved?: number; of?: number };

/** A change posted to one of the booking routes, its answer read whatever the status: "network" when none came. */
export async function postManage<T = Record<string, unknown>>(path: string, body: unknown): Promise<Answer<T>> {
  try {
    const r = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const b = (await r.json().catch(() => null)) as Answer<T> | null;
    return b && typeof b === "object" && "ok" in b ? b : { ok: false, error: "generic" };
  } catch {
    return { ok: false, error: "network" };
  }
}

export type BookingChange = { action: "cancel" | "edit" | "drop" | "addons" | "move" | "locker"; session: string; ids: string[] };
/** Says a booking changed: the event for a page that drew its tickets itself. */
export function announce(change: BookingChange) {
  try { window.dispatchEvent(new CustomEvent<BookingChange>("mm:booking-changed", { detail: change })); } catch { /* no window */ }
}

type Snap = { ctx: ManageCtx | null; error: string | null };
const NONE: Snap = { ctx: null, error: null };
type Entry = { snap: Snap; busy: Promise<void> | null; subs: Set<() => void> };
const store = new Map<string, Entry>();
const entryOf = (id: string): Entry => {
  let e = store.get(id);
  if (!e) { e = { snap: NONE, busy: null, subs: new Set() }; store.set(id, e); }
  return e;
};
const tell = (e: Entry) => { for (const f of e.subs) f(); };

/** Reads (again, with `force`) what the dialogs need for the account's booking on `session`. */
export function loadManage(session: string, force = false): Promise<void> {
  const e = entryOf(session);
  if (e.busy) return e.busy;
  if (e.snap.ctx && !force) return Promise.resolve();
  e.busy = (async () => {
    const a = await postManage<Omit<ManageCtx, "ok">>("/api/booking/manage", { session });
    // a new snapshot each time, so the store's readers see the change
    e.snap = a.ok ? { ctx: a as unknown as ManageCtx, error: null } : { ctx: a.error === "gone" ? null : e.snap.ctx, error: a.error };
    e.busy = null;
    tell(e);
  })();
  return e.busy;
}

/** The booking's read as it stands (null until it lands), read once when `on` (a ticket with something to change). */
export function useManage(session: string, on: boolean): { ctx: ManageCtx | null; error: string | null; reload: () => Promise<void> } {
  const sub = useCallback((f: () => void) => { const e = entryOf(session); e.subs.add(f); return () => { e.subs.delete(f); }; }, [session]);
  const snap = useCallback(() => store.get(session)?.snap ?? NONE, [session]);
  const e = useSyncExternalStore(sub, snap, () => NONE);
  useEffect(() => { if (on) void loadManage(session); }, [session, on]);
  const reload = useCallback(() => loadManage(session, true), [session]);
  return { ctx: e.ctx, error: e.error, reload };
}

/** {0}, {1}... filled in order (the booking app's .replace('{0}', ...)). */
export const fillN = (s: string, ...v: (string | number)[]) => v.reduce<string>((o, x, i) => o.split(`{${i}}`).join(String(x)), s);

/** The app router, when the ticket is drawn under one (a ticket drawn alone, in a test, has none: nothing to refresh). */
export function useRefresh(): ReturnType<typeof useRouter> | null {
  try { return useRouter(); } catch { return null; }
}
