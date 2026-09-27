import { edgeStore, memo, resetMemo } from "./memo";
import { riyadhClock } from "./workshop-days";

// The rides a visitor can book, read from the booking system itself: the bike prices
// (ride_prices) and the sessions still ahead (sessions). Both are tables the booking app reads
// with the same public key, and the sessions read sees exactly what list_sessions shows a
// visitor who is not signed in (sessions with no required tag). Only the few columns this site
// shows are asked for - the booking app's full list is ~47 KB, this is ~1.5 KB - and the answer
// is kept for a minute per Worker instance; a failed read keeps the last good copy.
//
// The rules below mirror the booking app (app.src.html) and the database, never guess:
//   kind     _rideKind: snd96 first, anything not 'community' is a circuit night (jcc), then
//            petromin / swim / workshop, and every other community row is the Saturday ride.
//   members  _community_booking_gate: event_kind 'community' without open_to_all is booked only
//            by members (the Saturday tag, the Club).
//   free     _isFreeRide: a community ride (not snd96) that is not a paid ride.
//   gather   _gathersTime: the Saturday and National Day rides store "gather - start", the
//            others "start - end".

export type RideKind = "jcc" | "saturday" | "swim" | "workshop" | "petromin" | "snd96";
export type RidePrice = { type: string; price: number };
export type RideSession = {
  id: string;
  date: string; // YYYY-MM-DD, Riyadh
  full: boolean;
  title: string | null;
  kind: RideKind;
  members: boolean;
  free: boolean;
  /** [first, second] times as written by staff: start-end, or gather-start when `gather`. */
  times: [string, string] | null;
  gather: boolean;
  /** No Road Carbon bike on this ride: the booking app's _noCarbon, community rides except
   *  Petromin (and Petromin nights are not on this site at all). */
  noCarbon: boolean;
};
export type RideData = { prices: RidePrice[]; sessions: RideSession[] };

type Row = {
  id?: unknown; session_date?: unknown; status?: unknown; title?: unknown; ride_kind?: unknown;
  event_kind?: unknown; bike_slots?: unknown; open_to_all?: unknown; paid_ride?: unknown;
};

export function rideKind(r: Row): RideKind {
  const k = r.ride_kind;
  if (k === "snd96") return "snd96";
  if (r.event_kind !== "community") return "jcc";
  return k === "petromin" || k === "swim" || k === "workshop" ? k : "saturday";
}

/** "21:00 - 23:00" from the session's settings (stored as JSON text, or an object). */
export function slotTimes(slots: unknown): [string, string] | null {
  let o: unknown = slots;
  if (typeof o === "string") {
    try { o = JSON.parse(o); } catch { return null; }
  }
  const t = o && typeof o === "object" ? (o as Record<string, unknown>)._time : null;
  const m = typeof t === "string" ? /^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/.exec(t) : null;
  return m ? [m[1].padStart(5, "0"), m[2].padStart(5, "0")] : null;
}

/** A session row as this site shows it, or null for one it does not show. Petromin nights are
 *  booked through the company's own form (micromobility.sa/petromin), so they are left out. */
export function toSession(r: Row, keepAll = false): RideSession | null {
  if (typeof r.id !== "string" || typeof r.session_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.session_date)) return null;
  if (!keepAll && r.status !== "open" && r.status !== "full") return null;
  const kind = rideKind(r);
  if (!keepAll && kind === "petromin") return null;
  const community = r.event_kind === "community";
  return {
    id: r.id,
    date: r.session_date,
    full: r.status === "full",
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : null,
    kind,
    members: community && r.open_to_all !== true,
    free: community && kind !== "snd96" && r.paid_ride !== true,
    times: slotTimes(r.bike_slots),
    gather: kind === "saturday" || kind === "snd96",
    noCarbon: community,
  };
}

/** The sessions still ahead at `now` (Riyadh, "YYYY-MM-DDTHH:MM"), soonest first. Tonight's
 *  session stays until its second time has passed (the end, or the start of a ride that
 *  gathers); one that runs past midnight stays all day. */
export function upcoming(sessions: RideSession[], now: string): RideSession[] {
  const today = now.slice(0, 10), hm = now.slice(11, 16);
  return sessions
    .filter((s) => s.date > today || (s.date === today && (!s.times || s.times[1] < s.times[0] || s.times[1] > hm)))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.times?.[0] ?? "").localeCompare(b.times?.[0] ?? ""));
}

/** The names a page gives each kind of session (Experiences > Next dates). */
export function kindNames(d: Record<string, unknown>): Record<RideKind, string> {
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  return { jcc: S(d.jccName), saturday: S(d.satName), swim: S(d.swimName), workshop: S(d.workshopName), snd96: S(d.snd96Name), petromin: "" };
}

/** What to call a session, as the booking app does: a circuit night by its fixed name, any other
 *  session by what staff called it, else its kind. Staff titles are typed once, in English; in any
 *  other language a title that is just the kind's English name reads as that language's name. */
export function sessionName(s: Pick<RideSession, "kind" | "title">, names: Record<RideKind, string>, enNames: Record<RideKind, string>, localized: boolean): string {
  if (s.kind === "jcc" || !s.title) return names[s.kind];
  return localized && s.title.toLowerCase() === enNames[s.kind].trim().toLowerCase() ? names[s.kind] : s.title;
}

/** Booked sessions by id, whatever their state (a Petromin night, one staff have closed since):
 *  the Account page names a rider's bookings with them. Ids are checked before they reach the
 *  query string. */
export async function loadSessionsById(ids: string[], fetchImpl: typeof fetch = fetch): Promise<RideSession[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const clean = [...new Set(ids)].filter((x) => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 40);
  if (!url || !key || !clean.length) return [];
  const cols = "id,session_date,status,title,ride_kind,event_kind,bike_slots,open_to_all,paid_ride";
  try {
    const rows = await getJson(fetchImpl, `${url}/rest/v1/sessions?select=${cols}&id=in.(${clean.join(",")})`, key);
    return Array.isArray(rows) ? (rows as Row[]).map((r) => toSession(r, true)).filter((x): x is RideSession => x !== null) : [];
  } catch {
    return [];
  }
}

const TTL_MS = 60_000;
const KEY = "rides";

export async function getJson(fetchImpl: typeof fetch, url: string, key: string): Promise<unknown> {
  const res = await fetchImpl(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/** One read of both: the prices and the sessions from today (Riyadh) on. Each keeps the copy it
 *  replaces when its own read fails; null when neither has ever been read. */
async function readRides(prev: RideData | null, fetchImpl: typeof fetch, now: number): Promise<RideData | null> {
  let prices = prev?.prices ?? null;
  let sessions = prev?.sessions ?? null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const today = riyadhClock(new Date(now)).slice(0, 10);
    const cols = "id,session_date,status,title,ride_kind,event_kind,bike_slots,open_to_all,paid_ride";
    const [p, s] = await Promise.allSettled([
      getJson(fetchImpl, `${url}/rest/v1/ride_prices?select=type,price`, key),
      getJson(fetchImpl, `${url}/rest/v1/sessions?select=${cols}&session_date=gte.${today}&status=in.(open,full)&order=session_date.asc&limit=60`, key),
    ]);
    if (p.status === "fulfilled" && Array.isArray(p.value)) {
      prices = (p.value as { type?: unknown; price?: unknown }[])
        .filter((x) => typeof x.type === "string" && typeof x.price === "number" && Number.isFinite(x.price) && x.price >= 0)
        .map((x) => ({ type: x.type as string, price: x.price as number }));
    }
    if (s.status === "fulfilled" && Array.isArray(s.value)) {
      sessions = (s.value as Row[]).map((r) => toSession(r)).filter((x): x is RideSession => x !== null);
    }
  }
  return prices || sessions ? { prices: prices ?? [], sessions: sessions ?? [] } : null;
}

/**
 * The prices and the sessions from today (Riyadh) on, read once per Worker instance and kept for a
 * minute (lib/memo.ts: everyone asking at once shares the read, a copy past the minute is served
 * while it is refreshed, and the last good copy - this instance's, else the edge's - stands in for
 * a failed read). Null only when nothing has ever been read; the page then shows its own words
 * without prices or dates.
 */
export async function loadRides(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<RideData | null> {
  return memo<RideData>(KEY, { ttl: TTL_MS, now, read: (prev) => readRides(prev, fetchImpl, now), keep: edgeStore("rides") });
}

/** For tests: forget the cached copy. */
export function resetRides(): void {
  resetMemo(KEY);
}
