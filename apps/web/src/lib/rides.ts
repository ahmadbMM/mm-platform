import { edgeStore, memo, resetMemo } from "./memo";
import { riyadhClock } from "./workshop-days";
import { priceRows, type PriceRow } from "./biz";
import { sessionGender, type SessionGender } from "./session-gender";
import { rideGroupKm } from "./kind-theme";

// The rides a visitor can book, read from the booking system itself: the bike prices
// (ride_prices) and the sessions still ahead (sessions). Both are tables the booking app reads
// with the same public key, and the sessions read sees exactly what list_sessions shows a
// visitor who is not signed in (sessions with no required tag). Only the few columns this site
// shows are asked for - the booking app's full list is ~47 KB, this is ~1.5 KB - and the answer
// is kept for a minute per Worker instance; a failed read keeps the last good copy.
//
// The rules below mirror the booking app (app.src.html) and the database, never guess:
//   kind     _rideKind: snd96 first, anything not 'community' is a circuit night (jcc), then
//            petromin / swim / workshop / event / runher / vlap / defe5k / arena / blood / yoga / farm, and
//            every other community row is the Saturday ride.
//   members  _community_booking_gate: event_kind 'community' without open_to_all is booked only
//            by members (the Saturday tag, the Club).
//   free     _isFreeRide: a community ride (not snd96) that is not a paid ride.
//   gather   _gathersTime: the Saturday ride, the National Day ride, Run for Her, Victory Lap and the Farm House
//            Night store "gather - start" (the farm night's arrival, then dinner), the others "start - end".
//   event    a ticketed event (ride_kind 'event', 2026-09-28): seats instead of bikes, its own
//            price per seat (sessions.price; _fare_now charges it instead of a bike fare), open to
//            everyone or to members (open_to_all), a description, no approval, no queue numbers.
//   runher   Run for Her (ride_kind 'runher', 2026-10-05): a running event, not a ride - members
//            only, free, no bikes and no breakfast, one place per account, first come first served
//            to its places (80) and then the waitlist; nobody approves it. It meets at the Jeddah
//            Yacht Club (sessions.location 'JYC', the meeting point in meet_url), and each runner
//            picks 3 or 5 km (queue_entries.run_km).
//   vlap     Victory Lap by Fitness Empire (ride_kind 'vlap', 2026-10-17; lib/vlap.ts): a hybrid fitness
//            race at the circuit run by Kamin Sports - booked by Community members and Victory Lap tag
//            holders, its card shown to everyone; no bikes, no breakfast; doors then the first heat
//            ("16:30 - 17:15", read as gathering - start); a paid ride at the session's own price per
//            athlete (sessions.price, 150 SAR VAT included), which only those who may book it are told.
//   defe5k   The DEFE 5KM Run (ride_kind 'defe5k', 2026-10-18): Defe's breast-cancer awareness 5 km race at
//            the circuit, a date inside the community rides (MicroMobility Experiences), not a card of its
//            own - members only, free, no bikes and no breakfast, one place per account, everyone runs
//            5 km (queue_entries.run_km, set by the database); one start time ("19:00"), no gathering.
//   arena    Arena Heros Hybrid Race (ride_kind 'arena', 2026-10-28; lib/arena.ts): a hybrid fitness race at Gymnation,
//            Tahlia Street, for Community members alone (the members' check, not Victory Lap's); teams of 2 women or
//            2 men, each partner booking their own place; no bikes, no breakfast; a window ("06:00 - 20:00", with a
//            prayer break), never a gathering; a paid ride at the session's own price per athlete (sessions.price,
//            140 SAR, medals included), which only members are told; a card of its own while it has a date.
//   blood    The Blood Donation event (ride_kind 'blood', 2026-11-03; lib/blood.ts): at the circuit, open to everyone,
//            free, no bikes, one place per account, a window, no price anywhere; a card of its own while it has a date,
//            and nothing names it before that (its words are the server's, content/blood-words.ts).
//   yoga     Yoga (ride_kind 'yoga', 2026-11-12; lib/yoga.ts): Hatha Yoga for Cyclists with Jassim Alsaady, a date inside
//            MicroMobility Experiences (the community card), never a card of its own - members only, free, one place per
//            account, first come first served to its places and then the waitlist; no bike, no breakfast, no gathering:
//            a start and an end ("16:00 - 17:30"), like the pool; at the place staff named (sessions.location, SILKDEER)
//            with its map (meet_url).
//   farm     Farm House Night (ride_kind 'farm', 2026-11-13; lib/farm.ts): Nawar Farm House Night at Little Farmhouse,
//            Dhahban, a date inside MicroMobility Experiences (the community card), never a card of its own, and shown to a
//            signed-in community member alone (farmForMembers: "not to public") - members only, free, staff approve every place as on the Saturday ride (needs_approval, hide_queue), and a member
//            books themselves and up to four family members on one booking in the booking app; no bike, no breakfast;
//            it gathers: "16:30 - 20:30" is the arrival, then dinner; at the place staff named (sessions.location) with
//            its map (meet_url).
//   featured _featured (2026-11-13): a date inside MicroMobility Experiences (the Saturday ride, a Petromin night, the
//            pool, the DEFE 5KM Run, yoga, the Farm House Night) that staff switched on (bike_slots._feat, beside _time:
//            no column); with no _feat the kind answers (yoga, the DEFE 5KM Run and the Farm House Night are featured as
//            made), and _feat 0 switches one off.
//   fbk      _sessFb (2026-11-13): Full, no waitlist. A session staff closed (status 'closed', which the database refuses
//            to book) with bike_slots._fbk, beside _time: no column. Riders still see it, said Fully booked, so nobody
//            takes it for called off; never a night called off (cancelled_at), a draft, or one waiting on its timer
//            (opens_at). A closed session without the mark stays out of every list, as before.

export type RideKind = "jcc" | "saturday" | "swim" | "workshop" | "petromin" | "snd96" | "event" | "runher" | "vlap" | "defe5k" | "arena" | "blood" | "yoga" | "farm";
/** A ride_prices row: the fare, and (lib/biz.ts faresOf) the highest fare quoted and the employees' fare when the database has them. */
export type RidePrice = PriceRow;
export type RideSession = {
  id: string;
  date: string; // YYYY-MM-DD, Riyadh
  /** Full with its waitlist open (status 'full'): it is booked onto the waitlist. */
  full: boolean;
  /** Full, no waitlist (the booking app's _sessFb, 2026-11-13; fbkOf): staff closed it as fully booked, and riders still
   *  see it, said Fully booked, with no way to book it or join a waitlist. Never `full` too. toSession always sets it; a
   *  copy kept at the edge from before has none, and held no such session. */
  fbk?: boolean;
  title: string | null;
  /** The session's name in Arabic (sessions.title_ar, rentals 20261113170000; the owner's pick on the booking app's
   *  theming page, 2026-11-13): an Arabic page names the session by it (sessionName). Trimmed, at most 60 characters,
   *  null when blank. Only a read that asks for it has it (SESSION_COLS_TITLE_AR); a copy kept at the edge from before
   *  has none, and reads as none. */
  titleAr?: string | null;
  kind: RideKind;
  members: boolean;
  free: boolean;
  /** [first, second] times as written by staff: start-end, or gather-start when `gather`. */
  times: [string, string] | null;
  gather: boolean;
  /** No Road Carbon bike on this ride: the booking app's _noCarbon, community rides except
   *  Petromin. */
  noCarbon: boolean;
  /** What the session is, as staff described it (an event's blurb); null when none. */
  description: string | null;
  /** An event's price per seat in SAR (and Victory Lap's and Arena Heros' per athlete, said only to those
   *  who may book it), null on a free event and on every other kind. */
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
  /** Bikes out of service on the session (sessions.out_bikes, rentals 20261107111000; the booking app's _n6rOutN): each
   *  takes a place off the capacity, as the database's _out_bikes_guard waitlists a rider past capacity less these.
   *  Only a read that asks for it has it (SESSION_COLS_OUT); a copy kept at the edge from before has none, and reads as 0. */
  out?: number;
  /** A community ride staff approve (needs_approval not false): no places-left count. */
  approval?: boolean;
  /** Its rider list is out (sessions.hide_queue false, the booking app's _commPublished; never the National Day ride):
   *  until then a rider who holds a place on a ride staff approve is told Reserved, never a verdict (lib/held.ts). Only
   *  a read that asks for it has it (SESSION_COLS_PUBLISHED); a copy kept at the edge from before has none, and reads
   *  as not out. */
  published?: boolean;
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
  /** The breakfast stop staff set on the session, or the venue whose booking was confirmed
   *  (sessions.breakfast_name), and its Arabic name (breakfast_name_ar, which a venue booking through
   *  the vendor portal gives; rentals migration 20261004130000): trimmed, at most 80 characters, null
   *  when blank. Only a read that asks for them has them (SESSION_COLS_BREAKFAST), as with the place;
   *  Experiences names the stop on the Saturday ride and Run for Her alone (lib/event-info.ts infoBreakfast). */
  breakfast?: string | null;
  breakfastAr?: string | null;
  /** When riders are told where the Saturday ride meets and has breakfast (sessions.reveal_at, ISO; the
   *  owner, 2026-10-06; rentals migration 20261006150000): until then list_sessions gives the session
   *  with its place, route and breakfast stop blank (lib/tickets.ts spotHeld). Null when nothing is held
   *  back; only a read that asks for it has it (SESSION_COLS_REVEAL). */
  revealAt?: string | null;
  /** Victory Lap's settings (sessions.vl: the races and divisions open, how to pay; lib/vlap.ts), the
   *  raw value; only a read that asks for it has it (SESSION_COLS_VL), and only on Victory Lap and on Arena
   *  Heros, whose settings have the same shape (lib/arena.ts). */
  vl?: unknown;
  /** Men only ('male'), women only ('female') or mixed (null): sessions.gender_only (the owner, 2026-10-27; rentals
   *  20261027150000; lib/session-gender.ts). toSession always sets it, null when the read did not ask for it
   *  (SESSION_COLS_GENDER); a copy kept at the edge from before has none, and reads as mixed. */
  gender?: SessionGender | null;
  /** The bike types staff closed on this session: sessions.closed_types (the owner, 2026-11-03; rentals 20261103210000).
   *  Riders cannot book them, so they are not priced (bike-kinds.ts typeOffered). toSession always sets it, empty when
   *  the read did not ask for it (SESSION_COLS_CLOSED); a copy kept at the edge from before has none, and reads as open. */
  closedTypes?: string[];
  /** Featured (the booking app's _featured, 2026-11-13; featuredOf): Experiences lists it first among its event's dates,
   *  under "Featured", and gives it a card above the event cards. toSession always sets it; a copy kept at the edge from
   *  before has none, and reads as not featured. */
  featured?: boolean;
  /** The breakfast spot is for community members only (bike_slots._bfm; the booking app's _bfMem, 2026-11-13; bfMembersOf):
   *  a visitor who is not a member is told nothing of it. Set only when it is. */
  bfMembers?: boolean;
  /** The Saturday ride's two groups' distances in km (bike_slots._km, the usual 20 and 40 when unset; lib/kind-theme.ts
   *  rideGroupKm): its Details draw the two routes with them. Only on the Saturday ride. */
  groupKm?: { beg: number; int: number };
};
export type RideData = { prices: RidePrice[]; sessions: RideSession[] };

type Row = {
  id?: unknown; session_date?: unknown; status?: unknown; title?: unknown; title_ar?: unknown; ride_kind?: unknown;
  event_kind?: unknown; bike_slots?: unknown; open_to_all?: unknown; paid_ride?: unknown;
  description?: unknown; price?: unknown; capacity?: unknown; route_slug?: unknown; needs_approval?: unknown;
  spots?: unknown; addons?: unknown; meet_url?: unknown; location?: unknown; breakfast_name?: unknown; breakfast_name_ar?: unknown; reveal_at?: unknown; vl?: unknown;
  gender_only?: unknown; closed_types?: unknown;
  out_bikes?: unknown; hide_queue?: unknown;
  cancelled_at?: unknown; draft?: unknown; opens_at?: unknown;
};

export function rideKind(r: Row): RideKind {
  const k = r.ride_kind;
  if (k === "snd96") return "snd96";
  if (r.event_kind !== "community") return "jcc";
  // a kind this list does not know reads as the Saturday ride, as the booking app's _rideKind does: every kind
  // the booking app makes is named here (Arena Heros since 2026-10-28, which read as a Saturday ride before; yoga since
  // 2026-11-12; the Farm House Night since 2026-11-13)
  return k === "petromin" || k === "swim" || k === "workshop" || k === "event" || k === "runher" || k === "vlap" || k === "defe5k" || k === "arena" || k === "blood" || k === "yoga" || k === "farm" ? k : "saturday";
}

/** A route's slug as the Routes page writes one (content/pages/routes.ts): lower-case letters,
 *  digits and single hyphens. Anything else reads as no route. */
export const ROUTE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const routeSlugOf = (v: unknown): string | null => (typeof v === "string" && v.length <= 60 && ROUTE_SLUG.test(v) ? v : null);

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null;

/** "21:00 - 23:00" from the session's settings (stored as JSON text, or an object). A session with one
 *  time only (the DEFE 5KM Run's "19:00", 2026-10-18: the booking app's sessionTime says "7 PM") gives that
 *  time twice: oneTime tells it apart, and a page says it once. */
export function slotTimes(slots: unknown): [string, string] | null {
  let o: unknown = slots;
  if (typeof o === "string") {
    try { o = JSON.parse(o); } catch { return null; }
  }
  const t = o && typeof o === "object" ? (o as Record<string, unknown>)._time : null;
  const m = typeof t === "string" ? /^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/.exec(t) : null;
  if (m) return [m[1].padStart(5, "0"), m[2].padStart(5, "0")];
  const one = typeof t === "string" ? /^\s*(\d{1,2}:\d{2})\s*$/.exec(t) : null;
  return one ? [one[1].padStart(5, "0"), one[1].padStart(5, "0")] : null;
}

/** The kinds of date inside MicroMobility Experiences, the only ones that can be featured (the booking app's _featOk,
 *  its _evMatch(s, 'community')): never a circuit night, nor a kind with a card of its own (the T100 day, a ticketed
 *  event, Run for Her, Victory Lap, Arena Heros, the Blood Donation event, the National Day ride). */
export const FEATURE_OK: readonly RideKind[] = ["saturday", "petromin", "swim", "defe5k", "yoga", "farm"];
/** The special events, featured as they are made (the booking app's FEAT_KINDS; the Farm House Night since 2026-11-13). */
export const FEATURED_KINDS: readonly RideKind[] = ["yoga", "defe5k", "farm"];

/** Whether a date is featured (the booking app's _featured, 2026-11-13): one inside MicroMobility Experiences whose
 *  settings say so (bike_slots._feat, stored as JSON text or an object: staff's switch, 1 or 0); with no _feat at all
 *  its kind answers, so a special event is featured until staff switch it off (_feat 0). */
export function featuredOf(kind: RideKind, slots: unknown): boolean {
  if (!FEATURE_OK.includes(kind)) return false;
  let o: unknown = slots;
  if (typeof o === "string") {
    try { o = JSON.parse(o); } catch { o = null; }
  }
  const f = o && typeof o === "object" ? (o as Record<string, unknown>)._feat : null;
  return f == null ? FEATURED_KINDS.includes(kind) : !!f;
}

/** Who sees the breakfast spot (the booking app's _bfMem / _bfOff; the owner, 2026-11-13: "add a switch on the breakfast spot
 *  to choose to show it to all booking cards or only members booking cards"): bike_slots._bfm 1, stored as JSON text or an
 *  object, is community members only. A visitor who is not a member reads no name, link or offer, and no "announced at" line;
 *  the meeting point and the route are as they were. It is what the page shows, not a secret: the row still carries it. */
export function bfMembersOf(slots: unknown): boolean {
  let o: unknown = slots;
  if (typeof o === "string") {
    try { o = JSON.parse(o); } catch { o = null; }
  }
  return !!o && typeof o === "object" && !!(o as Record<string, unknown>)._bfm;
}

/** Whether a row is Full, no waitlist (the booking app's _sessFb, 2026-11-13): closed, its settings marked (bike_slots._fbk,
 *  stored as JSON text or an object), not called off, not a draft and not waiting on its timer. Those three are told only by
 *  a read that asked for them (SESSION_COLS_FBK): a row without them is not taken for one, so a night called off is
 *  never shown as fully booked by a database that refused the columns. */
export function fbkOf(r: Row): boolean {
  if (r.status !== "closed" || !("cancelled_at" in r) || !("draft" in r) || !("opens_at" in r)) return false;
  if (r.cancelled_at != null || r.draft === true || r.opens_at != null) return false;
  let o: unknown = r.bike_slots;
  if (typeof o === "string") {
    try { o = JSON.parse(o); } catch { o = null; }
  }
  return !!o && typeof o === "object" && !!(o as Record<string, unknown>)._fbk;
}

/** A session with a start time alone (slotTimes gave the one time twice): "7 PM", never "7 PM – 7 PM". */
export const oneTime = (t: readonly [string, string] | null | undefined): boolean => !!t && t[0] === t[1];

/** A session's times as a page writes them: "gathering a · start b" on a ride that gathers, the start
 *  alone on a session with one time, else the window "a – b". `clock` writes a time in the page's clock. */
export function timesText(t: readonly [string, string] | null | undefined, gathers: boolean, clock: (hhmm: string) => string, w: { gather: string; start: string }): string {
  if (!t) return "";
  if (gathers && !oneTime(t)) return `${w.gather} ${clock(t[0])} · ${w.start} ${clock(t[1])}`;
  return oneTime(t) ? clock(t[0]) : `${clock(t[0])} – ${clock(t[1])}`;
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

/** The waitlist's own bike collection time, as staff set it on the session (the booking app's bike_slots._wlCollect,
 *  the owner 2026-11-10): "HH:MM", "" when staff emptied the box (no time of its own), or undefined when the session
 *  has none stored (wlCollectTime then takes a circuit night's default). */
export function wlCollectSlot(slots: unknown): string | undefined {
  let o: unknown = slots;
  if (typeof o === "string") {
    try { o = JSON.parse(o); } catch { o = null; }
  }
  if (!o || typeof o !== "object" || !Object.prototype.hasOwnProperty.call(o, "_wlCollect")) return undefined;
  const c = (o as Record<string, unknown>)._wlCollect;
  return typeof c === "string" && /^\s*\d{1,2}:\d{2}\s*$/.test(c) ? c.trim().padStart(5, "0") : "";
}

/** The breakfast stop a row names: only when the read asked for the columns (SESSION_COLS_BREAKFAST),
 *  so a row without them gives neither field. */
function breakfastOf(r: Row): Pick<RideSession, "breakfast" | "breakfastAr"> {
  if (!("breakfast_name" in r) && !("breakfast_name_ar" in r)) return {};
  const name = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80).trimEnd() : null);
  return { breakfast: name(r.breakfast_name), breakfastAr: name(r.breakfast_name_ar) };
}

/** The session's Arabic name a row gives (SESSION_COLS_TITLE_AR): only when the read asked for it. */
function titleArOf(r: Row): Pick<RideSession, "titleAr"> {
  if (!("title_ar" in r)) return {};
  return { titleAr: typeof r.title_ar === "string" && r.title_ar.trim() ? r.title_ar.trim().slice(0, 60).trimEnd() : null };
}

/** When a row says riders are told where it meets (SESSION_COLS_REVEAL): only when the read asked. */
function revealOf(r: Row): Pick<RideSession, "revealAt"> {
  if (!("reveal_at" in r)) return {};
  return { revealAt: typeof r.reveal_at === "string" && Number.isFinite(Date.parse(r.reveal_at)) ? r.reveal_at : null };
}

/** The bikes out of service a row says (sessions.out_bikes, {type: count}; the booking app's _n6rOut/_n6rOutN): the
 *  whole positive counts summed, anything else none. Only when the read asked for it (SESSION_COLS_OUT). */
function outOf(r: Row): Pick<RideSession, "out"> {
  if (!("out_bikes" in r)) return {};
  let o = r.out_bikes;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  if (!o || typeof o !== "object" || Array.isArray(o)) return { out: 0 };
  return { out: Object.values(o as Record<string, unknown>).reduce<number>((n, v) => { const c = Math.floor(Number(v)); return c > 0 ? n + c : n; }, 0) };
}

/** Whether a row says its rider list is out (SESSION_COLS_PUBLISHED): only when the read asked for it, and only on a
 *  community date (`community`: event_kind 'community', not the National Day ride). */
function publishedOf(r: Row, community: boolean): Pick<RideSession, "published"> {
  if (!("hide_queue" in r)) return {};
  return { published: community && r.hide_queue === false };
}

/** A session row as this site shows it, or null for one it does not show: an open or full session, and one closed as
 *  Full, no waitlist (fbkOf). Petromin nights are
 *  left out unless `petromin` (or `keepAll`): only Experiences lists them, under Petromin Days to a
 *  Petromin tag holder and among the community rides to a community member (the owner, 2026-10-12);
 *  every other page leaves them out as before. */
export function toSession(r: Row, keepAll = false, petromin = false): RideSession | null {
  if (typeof r.id !== "string" || typeof r.session_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.session_date)) return null;
  const fbk = fbkOf(r);
  if (!keepAll && r.status !== "open" && r.status !== "full" && !fbk) return null;
  const kind = rideKind(r);
  if (!keepAll && !petromin && kind === "petromin") return null;
  const community = r.event_kind === "community";
  const free = community && kind !== "snd96" && r.paid_ride !== true;
  const price = num(r.price), seats = num(r.capacity);
  return {
    id: r.id,
    date: r.session_date,
    full: r.status === "full",
    fbk,
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : null,
    kind,
    members: community && r.open_to_all !== true,
    free,
    times: slotTimes(r.bike_slots),
    // the Farm House Night gathers too (2026-11-13): its arrival, then dinner
    gather: kind === "saturday" || kind === "snd96" || kind === "runher" || kind === "vlap" || kind === "farm",
    noCarbon: community && kind !== "petromin", // Road Carbon goes out on a Petromin night
    description: typeof r.description === "string" && r.description.trim() ? r.description.trim().slice(0, 2000) : null,
    // the database charges an event's seat only when the event is a paid ride (_fare_now); Victory Lap's and
    // Arena Heros' price is per athlete
    price: (kind === "event" || kind === "vlap" || kind === "arena") && !free && price !== null && price > 0 ? price : null,
    seats: kind === "event" && seats !== null && Number.isInteger(seats) && seats > 0 ? seats : null,
    routeSlug: routeSlugOf(r.route_slug),
    approval: community && kind !== "snd96" && r.needs_approval !== false, // _isApprovalRide: not the National Day ride
    capacity: seats,
    spots: num(r.spots),
    addons: addonIds(r.addons),
    wlCap: waitlistCap(r.bike_slots, (community && r.needs_approval !== false ? num(r.spots) || seats : seats) || 0),
    km: groupKm(r.bike_slots),
    meetUrl: typeof r.meet_url === "string" && /^https:\/\//i.test(r.meet_url.trim()) ? r.meet_url.trim() : null,
    location: typeof r.location === "string" && r.location.trim() ? r.location.trim() : null,
    left: null,
    collect: kind === "swim" || kind === "workshop" || kind === "event" || kind === "saturday" || kind === "snd96" || kind === "runher" || kind === "vlap" || kind === "defe5k" || kind === "arena" || kind === "blood" || kind === "yoga" || kind === "farm" ? null : collectTime(r.bike_slots),
    ...titleArOf(r),
    ...(kind === "saturday" ? { groupKm: rideGroupKm(r.bike_slots) } : {}),
    ...breakfastOf(r),
    ...(bfMembersOf(r.bike_slots) ? { bfMembers: true } : {}),
    ...revealOf(r),
    ...outOf(r),
    ...publishedOf(r, community && kind !== "snd96"),
    ...((kind === "vlap" || kind === "arena") && "vl" in r ? { vl: r.vl ?? null } : {}),
    gender: sessionGender(r.gender_only),
    closedTypes: Array.isArray(r.closed_types) ? r.closed_types.filter((x): x is string => typeof x === "string") : [],
    featured: featuredOf(kind, r.bike_slots),
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

/** The sessions without the Petromin nights: every page but Experiences, which shows them only to a
 *  Petromin tag holder or a community member (the owner, 2026-10-12), lists none. */
export const withoutPetromin = (sessions: RideSession[]): RideSession[] => sessions.filter((s) => s.kind !== "petromin");

/** The names a page gives each kind of session (Experiences > Next dates). The Blood Donation event's is no field of
 *  the Website editor, whose schema anyone may read (api/site-schema): a page that may show one adds its name
 *  (content/blood-words.ts bloodName), as it adds Petromin's; nor the Farm House Night's, which is for community members'
 *  eyes alone (content/farm-words.ts farmName, 2026-11-13). */
export function kindNames(d: Record<string, unknown>): Record<RideKind, string> {
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  return { jcc: S(d.jccName), saturday: S(d.satName), swim: S(d.swimName), workshop: S(d.workshopName), snd96: S(d.snd96Name), event: S(d.eventName), runher: S(d.runHerName), vlap: S(d.vlName), defe5k: S(d.defeName), arena: S(d.arName), yoga: S(d.yogaName), petromin: "", blood: "", farm: "" };
}

/** What to call a session, as the booking app does: a circuit night by its fixed name, any other
 *  session by what staff called it, else its kind. Staff titles are typed once, in English; in any
 *  other language a title that is just the kind's English name reads as that language's name. An
 *  Arabic page (`arabic`) names it by its Arabic name when staff gave one (sessions.title_ar, the
 *  booking app's _evName since 2026-11-13). */
export function sessionName(s: Pick<RideSession, "kind" | "title"> & { titleAr?: string | null }, names: Record<RideKind, string>, enNames: Record<RideKind, string>, localized: boolean, arabic = false): string {
  if (s.kind === "jcc") return names.jcc;
  if (arabic && s.titleAr) return s.titleAr;
  if (!s.title) return names[s.kind];
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
export const SESSION_COLS = "id,session_date,status,title,ride_kind,event_kind,bike_slots,open_to_all,paid_ride,capacity,needs_approval,spots,addons,meet_url,location";
export const SESSION_COLS_NEW = "description,price,route_slug";
// Where a session is and its meeting point (2026-10-05): the Experiences dialogs say where each date
// meets (lib/event-info.ts). A group of its own, so a database without them reads as before.
export const SESSION_COLS_PLACE = "location,meet_url"; // staging: already in SESSION_COLS (its on-site booking reads them)
// The breakfast stop by name, in Arabic too (the owner, 2026-10-05: "add the restaurant's name in the
// session whenever it's added"): the Saturday ride's card, its Details and the summary on Experiences
// name it. A group of its own as well, so a database without them reads as before.
export const SESSION_COLS_BREAKFAST = "breakfast_name,breakfast_name_ar";
// When riders are told where the Saturday ride meets and has breakfast (the owner, 2026-10-06: rentals
// migration 20261006150000). A group of its own, so a database without it reads as before.
export const SESSION_COLS_REVEAL = "reveal_at";
// Victory Lap's settings (rentals migration 20261017210000): the races and divisions open to book and how
// to pay; Arena Heros' too (20261028200000). A group of its own, so a database without it reads as before
// (every race open, the default line).
export const SESSION_COLS_VL = "vl";
// Men only, women only or mixed (the owner, 2026-10-27; rentals migration 20261027150000; lib/session-gender.ts). A
// group of its own, so a database without it reads as before: every session mixed.
export const SESSION_COLS_GENDER = "gender_only";
// The bike types closed on a session (the owner, 2026-11-03; rentals migration 20261103210000). A group of its own, so
// a database without it reads as before: every type open.
export const SESSION_COLS_CLOSED = "closed_types";
// A session's name in Arabic (the owner's pick on the booking app's theming page, 2026-11-13; rentals migration
// 20261113170000): an Arabic page names the session by it. A group of its own, so a database without it reads as before.
export const SESSION_COLS_TITLE_AR = "title_ar";
// The bikes out of service on a session (2026-11-06, OT01; rentals migration 20261107111000): they take places off its
// capacity, so the places left the cards say count them. A group of its own, so a database without it reads as before.
export const SESSION_COLS_OUT = "out_bikes";
// Whether a ride's rider list is out (sessions.hide_queue, which a ticket's session read has always asked for,
// lib/tickets-data.ts): Experiences says what a signed-in visitor holds on a date (the owner's pick 4, 2026-11-13;
// lib/held.ts), and on a ride staff approve that is Reserved until the list is out. A group of its own, so a database
// without it reads as before: no list known to be out.
export const SESSION_COLS_PUBLISHED = "hide_queue";
// Whether a closed session may be shown as Full, no waitlist (the booking app's _sessFb, 2026-11-13; fbkOf): never a night
// called off (cancelled_at, rentals 20260928200000), a draft or one waiting on its timer (draft, opens_at, 20261107110000).
// A group of its own, so a database without them reads as before: no closed session shown.
export const SESSION_COLS_FBK = "cancelled_at,draft,opens_at";
/** The sessions the lists of the sessions ahead show (a PostgREST filter): open and full ones, and the closed ones whose
 *  settings carry the Full, no waitlist mark (bike_slots is text; toSession reads the mark itself and the rest of fbkOf). */
export const SESSION_STATUS_SHOWN = "or=(status.in.(open,full),and(status.eq.closed,bike_slots.like.*_fbk*))";
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

/** `sessions` rows for a PostgREST query (select and filters), through list_sessions(p_id, p_token),
 *  as the booking app's customers read them (_sessionsFetch). For an account it is the only read that
 *  returns a tag-gated (private) ride the account may see - the table hides those from the public key -
 *  and, with a token it no longer accepts, the public sessions alone; without one (null, null), the
 *  public sessions. A visitor who is not signed in reads through it too since 2026-10-06: a Saturday
 *  ride whose meeting point is told later (sessions.reveal_at) is hidden from the table's direct read
 *  until then, and the function gives it with its place blank (rentals 20261006150000). Only a database
 *  without the function falls back to the table with the public key. Never keep what is read for an
 *  account where another visitor could see it. */
export async function readSessions(fetchImpl: typeof fetch, url: string, key: string, query: string, account?: SessionReader | null): Promise<unknown> {
  try {
    return await getJson(fetchImpl, `${url}/rest/v1/rpc/list_sessions?${query}`, key, { p_id: account?.id ?? null, p_token: account?.token ?? null });
  } catch (e) {
    if (!noFunction(e)) throw e;
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

/** Booked sessions by id, whatever their state (a Petromin night, one staff have closed since), as
 *  `account` may see them: read for the signed-in account, a private ride it holds a booking on comes back
 *  too. Each says whether it is for men only or women only (SESSION_COLS_GENDER), which every visitor may
 *  see (the owner, 2026-10-28). Ids are checked before they reach the query string. (My Account's tickets
 *  read through lib/tickets-data.ts loadTicketSessions.) */
export async function loadSessionsById(ids: string[], fetchImpl: typeof fetch = fetch, account: SessionReader | null = null): Promise<RideSession[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const clean = [...new Set(ids)].filter((x) => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 40);
  if (!url || !key || !clean.length) return [];
  try {
    const rows = await sessionRows(fetchImpl, url, key, `id=in.(${clean.join(",")})`, SESSION_COLS, Date.now(), { optional: [SESSION_COLS_GENDER], account });
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
 *  no-show one, and not a rider on their own bike, who holds a place only on a Petromin night
 *  (`ownTakesPlace`, the booking app's _ownTakesPlace). Asked as a count, so nothing but the number
 *  comes back. */
export async function placesTaken(fetchImpl: typeof fetch, url: string, key: string, sessionId: string, ownTakesPlace = false): Promise<number | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(sessionId)) return null;
  try {
    const own = ownTakesPlace ? "" : "&or=(type_preference.is.null,type_preference.neq.Own)";
    const res = await fetchImpl(`${url}/rest/v1/queue_public?select=id&session_id=eq.${sessionId}&status=not.in.(cancelled,removed,noshow)${own}`, {
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

/** The places left on the soonest open sessions nobody approves (at most 12 counts a read): the booking app's spotsLeft,
 *  capacity (12 when unset) less the bikes out of service, less the bookings holding a place. Never on one closed as
 *  fully booked, which takes no booking. */
async function withPlacesLeft(sessions: RideSession[], fetchImpl: typeof fetch, url: string, key: string): Promise<RideSession[]> {
  const ask = sessions.filter((s) => !s.full && !s.fbk && !s.approval).slice(0, 12);
  const counts = await Promise.all(ask.map((s) => placesTaken(fetchImpl, url, key, s.id, s.kind === "petromin")));
  const left = new Map(ask.map((s, i) => [s.id, counts[i] == null ? null : Math.max(0, (s.capacity || 12) - (s.out ?? 0) - (counts[i] as number))]));
  return sessions.map((s) => (left.has(s.id) ? { ...s, left: left.get(s.id) ?? null } : s));
}

/** The optional groups of columns every list of the sessions ahead asks for (staging: not the place, which
 *  SESSION_COLS already holds for its on-site booking). */
const SESSION_GROUPS = [SESSION_COLS_BREAKFAST, SESSION_COLS_REVEAL, SESSION_COLS_VL, SESSION_COLS_GENDER, SESSION_COLS_CLOSED, SESSION_COLS_TITLE_AR];

/** Each of these sessions' rule, men only, women only or null (mixed; the owner, 2026-10-27), read through
 *  list_sessions for the signed-in account: the Club's members' area lists the next members' rides from
 *  member_area, which does not say it, and names it on each ride's chip. Every ride member_area gives is
 *  listed whatever its rule (the owner, 2026-10-28); one missing here reads as mixed, as every session does
 *  on a database without the column. Null when they could not be read. */
export async function sessionGenders(ids: string[], account: SessionReader, fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<Map<string, SessionGender | null> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const clean = [...new Set(ids)].filter((x) => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 40);
  if (!url || !key) return null;
  if (!clean.length) return new Map();
  try {
    const rows = await sessionRows(fetchImpl, url, key, `id=in.(${clean.join(",")})`, "id", now, { optional: [SESSION_COLS_GENDER], account });
    if (!Array.isArray(rows)) return null;
    return new Map((rows as Row[]).filter((r) => typeof r.id === "string").map((r) => [r.id as string, sessionGender(r.gender_only)]));
  } catch {
    return null;
  }
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
      getJson(fetchImpl, `${url}/rest/v1/ride_prices?select=*`, key), // every column: max_price and employee_price too (lib/biz.ts)
      // and the bikes out of service, which the places left count (withPlacesLeft), and whether each rider list is out;
      // the closed sessions marked Full, no waitlist too, with what tells one from a night called off (SESSION_COLS_FBK)
      sessionRows(fetchImpl, url, key, `session_date=gte.${today}&${SESSION_STATUS_SHOWN}&order=session_date.asc&limit=60`, SESSION_COLS, now, { optional: [...SESSION_GROUPS, SESSION_COLS_OUT, SESSION_COLS_PUBLISHED, SESSION_COLS_FBK] }),
    ]);
    if (p.status === "fulfilled" && Array.isArray(p.value)) prices = priceRows(p.value);
    if (s.status === "fulfilled" && Array.isArray(s.value)) {
      // the Petromin nights too: Experiences shows them to Petromin tag holders, under Petromin Days
      // (2026-10-12), and the other pages leave them out (withoutPetromin)
      sessions = await withPlacesLeft((s.value as Row[]).map((r) => toSession(r, false, true)).filter((x): x is RideSession => x !== null), fetchImpl, url, key);
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
