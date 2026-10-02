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
//            petromin / swim / workshop / event, and every other community row is the Saturday ride.
//   members  _community_booking_gate: event_kind 'community' without open_to_all is booked only
//            by members (the Saturday tag, the Club).
//   free     _isFreeRide: a community ride (not snd96) that is not a paid ride.
//   gather   _gathersTime: the Saturday and National Day rides store "gather - start", the
//            others "start - end".
//   event    a ticketed event (ride_kind 'event', 2026-09-28): seats instead of bikes, its own
//            price per seat (sessions.price; _fare_now charges it instead of a bike fare), open to
//            everyone or to members (open_to_all), a description, no approval, no queue numbers.

export type RideKind = "jcc" | "saturday" | "swim" | "workshop" | "petromin" | "snd96" | "event";
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
  /** What the session is, as staff described it (an event's blurb); null when none. */
  description: string | null;
  /** An event's price per seat in SAR, null on a free event and on every other kind. */
  price: number | null;
  /** An event's seats (sessions.capacity); null on every other kind. */
  seats: number | null;
  /** The route the ride follows: an item's slug on the Routes page (sessions.route_slug), or null. */
  routeSlug: string | null;
  /** When bikes go out ("20:15"): the booking app's sessionCollectTime; null on a ride without
   *  bikes or one that gathers (the gathering is the moment to turn up). */
  collect: string | null;
  /** Places left (the booking app's spotsLeft on a ride nobody approves): capacity (12 when
   *  unset) less the bookings holding one; null when not counted (a ride staff approve, a full
   *  one, one further out, or a count that failed). The cards say it at 3 or fewer. */
  left?: number | null;
  /** A community ride staff approve (needs_approval not false): no places-left count. */
  approval?: boolean;
  capacity?: number | null;
  /** The booking wizard's extras (lib/booking.ts): the places an approval ride allocates
   *  (sessions.spots), the add-ons it sells, the waitlist cap and the Saturday groups' distances
   *  from its settings, and where it meets. */
  spots?: number | null;
  addons?: string[];
  wlCap?: number | null;
  km?: { beg: number; int: number };
  meetUrl?: string | null;
  location?: string | null;
};
export type RideData = { prices: RidePrice[]; sessions: RideSession[] };

type Row = {
  id?: unknown; session_date?: unknown; status?: unknown; title?: unknown; ride_kind?: unknown;
  event_kind?: unknown; bike_slots?: unknown; open_to_all?: unknown; paid_ride?: unknown;
  description?: unknown; price?: unknown; capacity?: unknown; route_slug?: unknown; needs_approval?: unknown;
  spots?: unknown; addons?: unknown; meet_url?: unknown; location?: unknown;
};

export function rideKind(r: Row): RideKind {
  const k = r.ride_kind;
  if (k === "snd96") return "snd96";
  if (r.event_kind !== "community") return "jcc";
  return k === "petromin" || k === "swim" || k === "workshop" || k === "event" ? k : "saturday";
}

/** A route's slug as the Routes page writes one (content/pages/routes.ts): lower-case letters,
 *  digits and single hyphens. Anything else reads as no route. */
export const ROUTE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const routeSlugOf = (v: unknown): string | null => (typeof v === "string" && v.length <= 60 && ROUTE_SLUG.test(v) ? v : null);

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null;

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

/** When bikes go out, as the booking app's sessionCollectTime: the session's own _collect, or 45
 *  minutes before the start (COLLECT_BEFORE_MIN). "HH:MM", or null without a time to go by. */
export function collectTime(slots: unknown): string | null {
  let o: unknown = slots;
  if (typeof o === "string") {
    try { o = JSON.parse(o); } catch { o = null; }
  }
  const c = o && typeof o === "object" ? (o as Record<string, unknown>)._collect : null;
  if (typeof c === "string" && /^\s*\d{1,2}:\d{2}\s*$/.test(c)) return c.trim().padStart(5, "0");
  const t = slotTimes(slots);
  if (!t) return null;
  const m = Math.max(0, Number(t[0].slice(0, 2)) * 60 + Number(t[0].slice(3)) - 45);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const slotsOf = (slots: unknown): Record<string, unknown> => {
  let o: unknown = slots;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
};

/** The waitlist's cap in riders (the booking app's waitlistCap): the settings' _wl, a count or a
 *  percentage of the places (at least one); null for none. */
export function waitlistCap(slots: unknown, places: number): number | null {
  const w = slotsOf(slots)._wl as { m?: unknown; v?: unknown } | undefined;
  const v = Number(w && typeof w === "object" ? w.v : NaN);
  if (!w || !Number.isFinite(v) || v <= 0) return null;
  return w.m === "pct" ? Math.max(1, Math.round((places || 0) * v / 100)) : Math.floor(v);
}

/** The Saturday ride's two distances (_rgKm): the settings' _km, else 20 and 40 km. */
export function groupKm(slots: unknown): { beg: number; int: number } {
  const k = slotsOf(slots)._km as Record<string, unknown> | undefined;
  const one = (g: "beg" | "int", d: number) => { const v = Number(k && typeof k === "object" ? k[g] : NaN); return v > 0 && v <= 500 ? v : d; };
  return { beg: one("beg", 20), int: one("int", 40) };
}

/** The add-on ids a session sells (sessions.addons: a JSON list, or one already parsed). */
export function addonIds(v: unknown): string[] {
  let a: unknown = v;
  if (typeof a === "string") { try { a = JSON.parse(a); } catch { a = []; } }
  return Array.isArray(a) ? [...new Set(a.filter((x): x is string => typeof x === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(x)))].slice(0, 40) : [];
}

/** A session row as this site shows it, or null for one it does not show. Petromin nights are
 *  booked through the company's own form (micromobility.sa/petromin), so they are left out. */
export function toSession(r: Row, keepAll = false): RideSession | null {
  if (typeof r.id !== "string" || typeof r.session_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.session_date)) return null;
  if (!keepAll && r.status !== "open" && r.status !== "full") return null;
  const kind = rideKind(r);
  if (!keepAll && kind === "petromin") return null;
  const community = r.event_kind === "community";
  const free = community && kind !== "snd96" && r.paid_ride !== true;
  const price = num(r.price), seats = num(r.capacity);
  return {
    id: r.id,
    date: r.session_date,
    full: r.status === "full",
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : null,
    kind,
    members: community && r.open_to_all !== true,
    free,
    times: slotTimes(r.bike_slots),
    gather: kind === "saturday" || kind === "snd96",
    noCarbon: community,
    description: typeof r.description === "string" && r.description.trim() ? r.description.trim().slice(0, 2000) : null,
    // the database charges an event's seat only when the event is a paid ride (_fare_now)
    price: kind === "event" && !free && price !== null && price > 0 ? price : null,
    seats: kind === "event" && seats !== null && Number.isInteger(seats) && seats > 0 ? seats : null,
    routeSlug: routeSlugOf(r.route_slug),
    approval: community && r.needs_approval !== false,
    capacity: seats,
    spots: num(r.spots),
    addons: addonIds(r.addons),
    wlCap: waitlistCap(r.bike_slots, (community && r.needs_approval !== false ? num(r.spots) || seats : seats) || 0),
    km: groupKm(r.bike_slots),
    meetUrl: typeof r.meet_url === "string" && /^https:\/\//i.test(r.meet_url.trim()) ? r.meet_url.trim() : null,
    location: typeof r.location === "string" && r.location.trim() ? r.location.trim() : null,
    left: null,
    collect: kind === "swim" || kind === "workshop" || kind === "event" || kind === "saturday" || kind === "snd96" ? null : collectTime(r.bike_slots),
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
  return { jcc: S(d.jccName), saturday: S(d.satName), swim: S(d.swimName), workshop: S(d.workshopName), snd96: S(d.snd96Name), event: S(d.eventName), petromin: "" };
}

/** What to call a session, as the booking app does: a circuit night by its fixed name, any other
 *  session by what staff called it, else its kind. Staff titles are typed once, in English; in any
 *  other language a title that is just the kind's English name reads as that language's name. */
export function sessionName(s: Pick<RideSession, "kind" | "title">, names: Record<RideKind, string>, enNames: Record<RideKind, string>, localized: boolean): string {
  if (s.kind === "jcc" || !s.title) return names[s.kind];
  return localized && s.title.toLowerCase() === enNames[s.kind].trim().toLowerCase() ? names[s.kind] : s.title;
}

// The columns a sessions read asks for. The last three (description, price, route_slug) arrive
// with the 2026-09-28 migrations; until the owner applies them PostgREST refuses the whole read
// (400, 42703 "column does not exist"), so a read that fails that way is asked again with the
// columns that have always been there, and the new ones are left out for ten minutes before they
// are tried again. A session read that way simply has no description, price or route.
export const SESSION_COLS = "id,session_date,status,title,ride_kind,event_kind,bike_slots,open_to_all,paid_ride,capacity,needs_approval,spots,addons,meet_url,location";
export const SESSION_COLS_NEW = "description,price,route_slug";
const RETRY_NEW_MS = 10 * 60_000;
const MISSING: unique symbol = Symbol.for("mm.sessions.newColsMissingUntil");
const missingUntil = (): number => (globalThis as { [MISSING]?: number })[MISSING] ?? 0;

/** Rows of `sessions` matching `filter` (a PostgREST query string), with `cols` and the new
 *  columns when the database has them. Throws when neither read answers. */
export async function sessionRows(fetchImpl: typeof fetch, url: string, key: string, filter: string, cols: string = SESSION_COLS, now: number = Date.now()): Promise<unknown> {
  const withNew = `${url}/rest/v1/sessions?select=${cols},${SESSION_COLS_NEW}&${filter}`;
  const without = `${url}/rest/v1/sessions?select=${cols}&${filter}`;
  if (now < missingUntil()) return getJson(fetchImpl, without, key);
  try {
    return await getJson(fetchImpl, withNew, key);
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "400") throw e;
    (globalThis as { [MISSING]?: number })[MISSING] = now + RETRY_NEW_MS;
    return getJson(fetchImpl, without, key);
  }
}

/** Tests only: try the new columns again at once. */
export function resetSessionColumns(): void {
  delete (globalThis as { [MISSING]?: number })[MISSING];
}

/** Booked sessions by id, whatever their state (a Petromin night, one staff have closed since):
 *  the Account page names a rider's bookings with them. Ids are checked before they reach the
 *  query string. */
export async function loadSessionsById(ids: string[], fetchImpl: typeof fetch = fetch): Promise<RideSession[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const clean = [...new Set(ids)].filter((x) => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 40);
  if (!url || !key || !clean.length) return [];
  try {
    const rows = await sessionRows(fetchImpl, url, key, `id=in.(${clean.join(",")})`);
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

/** How many bookings hold a place on a session (_holdsSpot): every row but a cancelled, removed or
 *  no-show one, and not a rider on their own bike (who holds a place only on a Petromin night,
 *  which this site never lists). Asked as a count, so nothing but the number comes back. */
export async function placesTaken(fetchImpl: typeof fetch, url: string, key: string, sessionId: string): Promise<number | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(sessionId)) return null;
  try {
    const res = await fetchImpl(`${url}/rest/v1/queue_public?select=id&session_id=eq.${sessionId}&status=not.in.(cancelled,removed,noshow)&or=(type_preference.is.null,type_preference.neq.Own)`, {
      method: "HEAD",
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    const m = /\/(\d+)$/.exec(res.headers.get("content-range") ?? "");
    return res.ok && m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/** The places left on the soonest open sessions nobody approves (at most 12 counts a read). */
async function withPlacesLeft(sessions: RideSession[], fetchImpl: typeof fetch, url: string, key: string): Promise<RideSession[]> {
  const ask = sessions.filter((s) => !s.full && !s.approval).slice(0, 12);
  const counts = await Promise.all(ask.map((s) => placesTaken(fetchImpl, url, key, s.id)));
  const left = new Map(ask.map((s, i) => [s.id, counts[i] == null ? null : Math.max(0, (s.capacity || 12) - (counts[i] as number))]));
  return sessions.map((s) => (left.has(s.id) ? { ...s, left: left.get(s.id) ?? null } : s));
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
    const [p, s] = await Promise.allSettled([
      getJson(fetchImpl, `${url}/rest/v1/ride_prices?select=type,price`, key),
      sessionRows(fetchImpl, url, key, `session_date=gte.${today}&status=in.(open,full)&order=session_date.asc&limit=60`, SESSION_COLS, now),
    ]);
    if (p.status === "fulfilled" && Array.isArray(p.value)) {
      prices = (p.value as { type?: unknown; price?: unknown }[])
        .filter((x) => typeof x.type === "string" && typeof x.price === "number" && Number.isFinite(x.price) && x.price >= 0)
        .map((x) => ({ type: x.type as string, price: x.price as number }));
    }
    if (s.status === "fulfilled" && Array.isArray(s.value)) {
      sessions = await withPlacesLeft((s.value as Row[]).map((r) => toSession(r)).filter((x): x is RideSession => x !== null), fetchImpl, url, key);
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
  resetSessionColumns();
}
