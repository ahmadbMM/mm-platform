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
//            petromin / swim / workshop / event / runher, and every other community row is the
//            Saturday ride.
//   members  _community_booking_gate: event_kind 'community' without open_to_all is booked only
//            by members (the Saturday tag, the Club).
//   free     _isFreeRide: a community ride (not snd96) that is not a paid ride.
//   gather   _gathersTime: the Saturday ride, the National Day ride and Run for Her store
//            "gather - start", the others "start - end".
//   event    a ticketed event (ride_kind 'event', 2026-09-28): seats instead of bikes, its own
//            price per seat (sessions.price; _fare_now charges it instead of a bike fare), open to
//            everyone or to members (open_to_all), a description, no approval, no queue numbers.
//   runher   Run for Her (ride_kind 'runher', 2026-10-05): a running event, not a ride - members
//            only, free, no bikes and no breakfast, one place per account, first come first served
//            to its places (80) and then the waitlist; nobody approves it. It meets at the Jeddah
//            Yacht Club (sessions.location 'JYC', the meeting point in meet_url), and each runner
//            picks 3 or 5 km (queue_entries.run_km).

export type RideKind = "jcc" | "saturday" | "swim" | "workshop" | "petromin" | "snd96" | "event" | "runher";
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
  /** Where the session is (sessions.location): "JCC" or nothing for the circuit, "JYC" for the
   *  Jeddah Yacht Club, else a place as staff wrote it; and its meeting point's map link
   *  (sessions.meet_url, https only). Only a read that asks for them has them (SESSION_COLS_PLACE):
   *  a session read without them has neither, and reads as on the circuit. */
  location?: string | null;
  meetUrl?: string | null;
  /** The breakfast stop staff set on the session, or the venue whose booking was confirmed
   *  (sessions.breakfast_name), and its Arabic name (breakfast_name_ar, which a venue booking through
   *  the vendor portal gives; rentals migration 20261004130000): trimmed, at most 80 characters, null
   *  when blank. Only a read that asks for them has them (SESSION_COLS_BREAKFAST), as with the place;
   *  Experiences names the stop on the Saturday ride alone (lib/event-info.ts infoBreakfast). */
  breakfast?: string | null;
  breakfastAr?: string | null;
};
export type RideData = { prices: RidePrice[]; sessions: RideSession[] };

type Row = {
  id?: unknown; session_date?: unknown; status?: unknown; title?: unknown; ride_kind?: unknown;
  event_kind?: unknown; bike_slots?: unknown; open_to_all?: unknown; paid_ride?: unknown;
  description?: unknown; price?: unknown; capacity?: unknown; route_slug?: unknown; needs_approval?: unknown;
  location?: unknown; meet_url?: unknown; breakfast_name?: unknown; breakfast_name_ar?: unknown;
};

export function rideKind(r: Row): RideKind {
  const k = r.ride_kind;
  if (k === "snd96") return "snd96";
  if (r.event_kind !== "community") return "jcc";
  return k === "petromin" || k === "swim" || k === "workshop" || k === "event" || k === "runher" ? k : "saturday";
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

/** Where a row says the session is, as the ticket reads it (lib/tickets.ts ticketSession): only when
 *  the read asked for the columns (SESSION_COLS_PLACE), so a row without them gives neither field. */
function placeOf(r: Row): Pick<RideSession, "location" | "meetUrl"> {
  if (!("location" in r) && !("meet_url" in r)) return {};
  const meet = typeof r.meet_url === "string" ? r.meet_url.trim() : "";
  return { location: typeof r.location === "string" && r.location.trim() ? r.location.trim() : null, meetUrl: /^https:\/\//i.test(meet) ? meet : null };
}

/** The breakfast stop a row names: only when the read asked for the columns (SESSION_COLS_BREAKFAST),
 *  so a row without them gives neither field. */
function breakfastOf(r: Row): Pick<RideSession, "breakfast" | "breakfastAr"> {
  if (!("breakfast_name" in r) && !("breakfast_name_ar" in r)) return {};
  const name = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80).trimEnd() : null);
  return { breakfast: name(r.breakfast_name), breakfastAr: name(r.breakfast_name_ar) };
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
    gather: kind === "saturday" || kind === "snd96" || kind === "runher",
    noCarbon: community,
    description: typeof r.description === "string" && r.description.trim() ? r.description.trim().slice(0, 2000) : null,
    // the database charges an event's seat only when the event is a paid ride (_fare_now)
    price: kind === "event" && !free && price !== null && price > 0 ? price : null,
    seats: kind === "event" && seats !== null && Number.isInteger(seats) && seats > 0 ? seats : null,
    routeSlug: routeSlugOf(r.route_slug),
    approval: community && r.needs_approval !== false,
    capacity: seats,
    left: null,
    collect: kind === "swim" || kind === "workshop" || kind === "event" || kind === "saturday" || kind === "snd96" || kind === "runher" ? null : collectTime(r.bike_slots),
    ...placeOf(r),
    ...breakfastOf(r),
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
  return { jcc: S(d.jccName), saturday: S(d.satName), swim: S(d.swimName), workshop: S(d.workshopName), snd96: S(d.snd96Name), event: S(d.eventName), runher: S(d.runHerName), petromin: "" };
}

/** What to call a session, as the booking app does: a circuit night by its fixed name, any other
 *  session by what staff called it, else its kind. Staff titles are typed once, in English; in any
 *  other language a title that is just the kind's English name reads as that language's name. */
export function sessionName(s: Pick<RideSession, "kind" | "title">, names: Record<RideKind, string>, enNames: Record<RideKind, string>, localized: boolean): string {
  if (s.kind === "jcc" || !s.title) return names[s.kind];
  return localized && s.title.toLowerCase() === enNames[s.kind].trim().toLowerCase() ? names[s.kind] : s.title;
}

// The columns a sessions read asks for. Some arrive with later migrations: SESSION_COLS_NEW
// (description, price, route_slug) with the 2026-09-28 ones, and a caller can name groups of its own
// (the breakfast stop's Arabic name and offer, lib/tickets-data.ts). Until the owner applies one,
// PostgREST refuses the whole read (400, 42703 "column sessions.<name> does not exist"), so a read
// refused that way is asked again without the group that holds that column, and that group alone is
// left out for ten minutes before it is tried again. A session read that way simply has none of its
// columns. Any other refusal is passed on and leaves nothing out: any 400 once stripped every price,
// description and route from the whole site for ten minutes.
export const SESSION_COLS = "id,session_date,status,title,ride_kind,event_kind,bike_slots,open_to_all,paid_ride,capacity,needs_approval";
export const SESSION_COLS_NEW = "description,price,route_slug";
// Where a session is and its meeting point (2026-10-05): the Experiences dialogs say where each date
// meets (lib/event-info.ts). A group of its own, so a database without them reads as before.
export const SESSION_COLS_PLACE = "location,meet_url";
// The breakfast stop by name, in Arabic too (the owner, 2026-10-05: "add the restaurant's name in the
// session whenever it's added"): the Saturday ride's card, its Details and the summary on Experiences
// name it. A group of its own as well, so a database without them reads as before.
export const SESSION_COLS_BREAKFAST = "breakfast_name,breakfast_name_ar";
const RETRY_NEW_MS = 10 * 60_000;
const MISSING: unique symbol = Symbol.for("mm.sessions.missingColumnGroups");
/** Each optional group of columns the database refused, and until when it is left out. */
const missing = (): Record<string, number> => ((globalThis as { [MISSING]?: Record<string, number> })[MISSING] ??= {});

/** A read PostgREST refused. The message is the HTTP status, as it always was; PostgREST's own code
 *  ("42703", "PGRST202") and message ride along when it gave them. */
export class ReadError extends Error {
  constructor(status: number, readonly code: string = "", readonly detail: string = "") {
    super(String(status));
  }
}

/** The column a refusal says the database does not have (400, Postgres 42703: "column
 *  sessions.route_slug does not exist", or another qualifier through list_sessions), or null for any
 *  other refusal. */
export function missingColumn(e: unknown): string | null {
  if (!(e instanceof ReadError) || e.message !== "400" || e.code !== "42703") return null;
  const m = /column\s+(?:"?[\w$]+"?\.)*"?([\w$]+)"?\s+does not exist/i.exec(e.detail);
  return m ? m[1] : null;
}

/** The signed-in account a sessions read is made for: its id and the booking app's session token. */
export type SessionReader = { id: string; token: string };

/** list_sessions is not in this database (PostgREST's 404 / PGRST202, Postgres's 42883). */
const noFunction = (e: unknown) => e instanceof ReadError && (e.message === "404" || e.code === "PGRST202" || e.code === "42883");

/** `sessions` rows for a PostgREST query (select and filters). For an account, through
 *  list_sessions(p_id, p_token), as the booking app's customers read them (_sessionsFetch): the only
 *  read that returns a tag-gated (private) ride the account may see - the table hides those from the
 *  public key - and, with a token it no longer accepts, the public sessions alone. Otherwise, or on a
 *  database without the function, the table with the public key, which sees exactly the sessions
 *  with no required tag. Never keep what is read for an account where another visitor could see it. */
export async function readSessions(fetchImpl: typeof fetch, url: string, key: string, query: string, account?: SessionReader | null): Promise<unknown> {
  if (account) {
    try {
      return await getJson(fetchImpl, `${url}/rest/v1/rpc/list_sessions?${query}`, key, { p_id: account.id, p_token: account.token });
    } catch (e) {
      if (!noFunction(e)) throw e;
    }
  }
  return getJson(fetchImpl, `${url}/rest/v1/sessions?${query}`, key);
}

/** Rows of `sessions` matching `filter` (a PostgREST query string), with `cols` and every optional
 *  group of columns (SESSION_COLS_NEW, then `opts.optional`) the database has; for `opts.account`
 *  when one is given (readSessions). Throws when no read answers. */
export async function sessionRows(fetchImpl: typeof fetch, url: string, key: string, filter: string, cols: string = SESSION_COLS, now: number = Date.now(),
  opts: { optional?: string[]; account?: SessionReader | null } = {}): Promise<unknown> {
  const left = missing();
  const groups = [SESSION_COLS_NEW, ...(opts.optional ?? [])].filter((g) => !(now < (left[g] ?? 0)));
  for (let bare = false; ;) {
    try {
      return await readSessions(fetchImpl, url, key, `select=${[cols, ...(bare ? [] : groups)].join(",")}&${filter}`, opts.account);
    } catch (e) {
      const col = missingColumn(e);
      const g = col && !bare ? groups.find((x) => x.split(",").includes(col)) : undefined;
      if (g) {
        left[g] = now + RETRY_NEW_MS; // that group alone, for ten minutes
        groups.splice(groups.indexOf(g), 1);
      } else if (!col && !bare && groups.length && e instanceof ReadError && e.code === "42703") {
        bare = true; // a missing column it does not name: once more without the optional groups, leaving none out after
      } else {
        throw e;
      }
    }
  }
}

/** Tests only: try every optional column again at once. */
export function resetSessionColumns(): void {
  delete (globalThis as { [MISSING]?: Record<string, number> })[MISSING];
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

/** A PostgREST read with the public key: a GET, or a POST of `body` (a function's arguments). A
 *  refusal throws a ReadError. */
export async function getJson(fetchImpl: typeof fetch, url: string, key: string, body?: Record<string, unknown>): Promise<unknown> {
  const headers: Record<string, string> = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetchImpl(url, {
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => null)) as { code?: unknown; message?: unknown } | null;
    throw new ReadError(res.status, typeof b?.code === "string" ? b.code : "", typeof b?.message === "string" ? b.message : "");
  }
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
      sessionRows(fetchImpl, url, key, `session_date=gte.${today}&status=in.(open,full)&order=session_date.asc&limit=60`, SESSION_COLS, now, { optional: [SESSION_COLS_PLACE, SESSION_COLS_BREAKFAST] }),
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
