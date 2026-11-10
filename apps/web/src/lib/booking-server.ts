// The server's half of booking on the website (lib/booking.ts has the shared rules): the
// signed-in account as the wizard needs it, and the booking itself, made through the booking
// app's own token-checked functions with the id and token from the account cookie only.
import type { Session } from "./account-core";
import {
  JCC_ACCOUNT_CAP, addonCap, codeOne, genderRefused, hasRideGroups, heightOk, heightToSize, isRiderType, maxRiders, needsBike, needsWaiver, noCarbon, ownOffered,
  pgDue, promoRows, refusalOf, rgOk, waiverKind, type BookAccount, type BookSession, type PgField, type Refusal, type Rider, type RideGroup,
} from "./booking";
import { cleanName } from "./rpc-client";
import { bizOf } from "./biz";
import { loadSiteContent } from "./site";
import { addonIds, placesTaken, rideKind, SESSION_COLS_GENDER, sessionRows, waitlistCap } from "./rides";
import { sessionGender } from "./session-gender";

export type RpcAnswer<T> = { status: number; data: T | null; error: { code?: string; message?: string; details?: string } | null };

/** A booking-app function called with the public key, keeping the database's refusal whole
 *  (code, message and detail: the ride rules name themselves in the detail). */
export async function rpcCall<T>(fn: string, args: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<RpcAnswer<T>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: 0, data: null, error: { message: "config" } };
  try {
    const res = await fetchImpl(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) return { status: res.status, data: null, error: { code: String(body?.code ?? ""), message: String(body?.message ?? ""), details: String(body?.details ?? "") } };
    return { status: res.status, data: body as T, error: null };
  } catch {
    return { status: 0, data: null, error: { message: "network" } };
  }
}

type Row = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const LIVE = ["waiting", "active", "waitlist"];

/** The fields the server holds a booking for (customer_fix_fields), and whether they are only a
 *  community member's birth date and nationality not on file (_commAskOnly). */
export function asksOf(fields: unknown, profile: { birth_date?: unknown; nationality?: unknown }): { asks: string[]; communityOnly: boolean } {
  const list = Array.isArray(fields) ? fields.filter((x): x is string => typeof x === "string") : [];
  const comm = list.length > 0 && list.every((k) => (k === "birth_date" || k === "nationality") && !S(profile[k as "birth_date" | "nationality"]).trim());
  return { asks: comm ? [] : list, communityOnly: comm };
}

/** The account as the wizard reads it, from its own rows (my_bookings), its profile
 *  (customer_profile, already read by getAccount), the community tag and the server's asks. */
export function accountFrom(name: string, profile: Row, rows: Row[], member: boolean, fixFields: unknown): BookAccount {
  const live: Record<string, number> = {};
  const rejected = new Set<string>();
  let count = 0;
  for (const r of rows) {
    const sid = S(r.session_id) || S(r.session_date);
    if (LIVE.includes(S(r.status))) live[sid] = (live[sid] ?? 0) + 1;
    if (r.approval === "rejected") rejected.add(sid);
    if (!["cancelled", "removed"].includes(S(r.status))) count++;
  }
  const hidden = S(profile.hidden_types).split(",").map((x) => x.trim()).filter(Boolean);
  const dp = S(profile.default_pay);
  const house: BookAccount["house"] = dp === "house" ? "all" : dp.startsWith("house:") ? dp.slice(6).split(",").map((x) => x.trim()).filter(Boolean) : null;
  const birth = S(profile.birth_date), nationality = S(profile.nationality);
  const { asks, communityOnly } = asksOf(fixFields, profile);
  const h = Number(profile.height);
  // The profile page asks what the account's bookings make due and is not on file (_pgDue: the nationality from the
  // first booking, the birth date from the fourth); a community member's page, what the server asked (_pgOpen's ask).
  const pgAsk: PgField[] = communityOnly
    ? (fixFields as string[]).filter((k) => k === "birth_date" || k === "nationality").map((k): PgField => (k === "birth_date" ? "birth" : "nat"))
    : pgDue({ birth, nationality }, count);
  return {
    name, height: Number.isInteger(h) && h >= 100 && h <= 250 ? h : null, hidden, house, member,
    rejected: [...rejected], live, asks,
    profileGate: communityOnly ? "community" : pgAsk.length ? "profile" : "none",
    pgAsk, count,
    birth, nationality,
    gender: sessionGender(profile.gender), // a session for one gender is booked by that gender alone (2026-10-27)
  };
}

/** The signed-in account's booking context: three reads beside the profile getAccount made. */
export async function bookingAccount(acct: Session & { name: string; profile?: Row }, fetchImpl: typeof fetch = fetch): Promise<BookAccount> {
  const args = { p_id: acct.id, p_token: acct.token };
  const [rows, member, fix] = await Promise.all([
    rpcCall<Row[]>("my_bookings", args, fetchImpl),
    rpcCall<boolean>("community_member", args, fetchImpl),
    rpcCall<string[]>("customer_fix_fields", args, fetchImpl),
  ]);
  return accountFrom(acct.name, acct.profile ?? {}, Array.isArray(rows.data) ? rows.data : [], member.data === true, fix.data);
}

// ── The booking ──────────────────────────────────────────────────────────────────────────────

/** What the wizard sends: the ride, each rider, the group, the add-ons, the code it applied (and
 *  which type it is for, to know which riders carry it), and the waiver's tick. Never a price. */
export type BookInput = {
  sessionId: string;
  riders: Rider[];
  group: RideGroup | null;
  addons: { id: string; qty: number }[];
  promo: { code: string; appliesTo: string | null } | null;
  waiver: boolean;
  /** Pay online now (the rider's choice where paying now is optional; always, where it is required). */
  payNow: boolean;
  /** Let the account's wallet pay what it can first (the review's Wallet switch). */
  wallet: boolean;
  /** The rider is booking a place, not knowingly joining a full session's waitlist (rentals 20261111030000): a place
   *  another device took first is refused (PLACE_GONE) rather than turned into a waitlist place, and the rider chooses. */
  seatOnly: boolean;
};

const ID = /^[A-Za-z0-9_-]{1,64}$/;
/** The request body, cleaned: anything malformed is null. */
export function readInput(b: unknown): BookInput | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  const sessionId = S(o.sessionId);
  if (!ID.test(sessionId)) return null;
  if (!Array.isArray(o.riders) || o.riders.length < 1 || o.riders.length > 10) return null;
  const riders: Rider[] = [];
  for (const x of o.riders) {
    if (!x || typeof x !== "object") return null;
    const r = x as Record<string, unknown>;
    const type = S(r.type);
    if (type && !isRiderType(type)) return null;
    riders.push({ name: cleanName(S(r.name)).slice(0, 60), height: String(r.height ?? "").trim().slice(0, 3), type: (type || "") as Rider["type"] });
  }
  const group = rgOk(o.group) ? o.group : null;
  const addons: BookInput["addons"] = [];
  if (Array.isArray(o.addons)) {
    for (const a of o.addons.slice(0, 20)) {
      const id = S((a as Record<string, unknown>)?.id), qty = Number((a as Record<string, unknown>)?.qty);
      if (ID.test(id) && Number.isInteger(qty) && qty >= 1 && qty <= 20 && !addons.some((x) => x.id === id)) addons.push({ id, qty });
    }
  }
  let promo: BookInput["promo"] = null;
  if (o.promo && typeof o.promo === "object") {
    const p = o.promo as Record<string, unknown>;
    const code = S(p.code).trim();
    if (/^[A-Za-z0-9_-]{1,40}$/.test(code)) promo = { code, appliesTo: isRiderType(p.appliesTo) ? p.appliesTo : null };
  }
  return { sessionId, riders, group, addons, promo, waiver: o.waiver === true, payNow: o.payNow === true, wallet: o.wallet === true, seatOnly: o.seatOnly === true };
}

/** The session the booking is for, read fresh (never the page's cached copy). */
export type LiveSession = Pick<BookSession, "id" | "date" | "kind" | "community" | "members" | "free" | "approval" | "seat" | "capacity" | "wlCap" | "addons" | "gender"> & { full: boolean; open: boolean; day: string };
export function liveSession(r: Row, today: string): LiveSession | null {
  if (!ID.test(S(r.id)) || !/^\d{4}-\d{2}-\d{2}$/.test(S(r.session_date))) return null;
  const kind = rideKind(r);
  const community = r.event_kind === "community";
  const approval = community && r.needs_approval !== false;
  const cap = Number(r.capacity) || 0, spots = Number(r.spots) || 0;
  const places = (approval ? spots || cap : cap) || 12;
  const free = community && kind !== "snd96" && r.paid_ride !== true;
  const price = Number(r.price);
  return {
    id: S(r.id), date: S(r.session_date), kind, community, members: community && r.open_to_all !== true, free, approval,
    seat: kind === "event" ? (free ? 0 : Number.isFinite(price) && price > 0 ? price : 0) : null,
    capacity: places, wlCap: waitlistCap(r.bike_slots, places), addons: addonIds(r.addons),
    full: r.status === "full", open: (r.status === "open" || r.status === "full") && S(r.session_date) >= today && kind !== "petromin", day: S(r.day),
    gender: sessionGender(r.gender_only), // men only, women only or mixed (null; the owner, 2026-10-27)
  };
}

export type Checked = { ok: true; riders: Rider[] } | { ok: false; error: Refusal };
/** The booking app's checks before it books (submitReg), with the account's own rows: the ride
 *  is still on, it is for the account's gender (a session for men only or women only, the owner,
 *  2026-10-27), the party fits, each rider is complete, the waiver is ticked, the account holds
 *  nothing on this ride yet and was not turned down for it. */
export function checkBooking(input: BookInput, s: LiveSession, acct: Pick<BookAccount, "name" | "live" | "rejected" | "gender">, cap: number = JCC_ACCOUNT_CAP): Checked {
  if (!s.open) return { ok: false, error: "closed" };
  const sg = genderRefused(s, acct.gender);
  if (sg) return { ok: false, error: sg };
  if (acct.rejected.includes(s.id)) return { ok: false, error: "rejected" };
  if ((acct.live[s.id] ?? 0) > 0) return { ok: false, error: "already" };
  const booked = acct.live[s.id] ?? 0;
  let riders = input.riders;
  if (s.community) riders = riders.slice(0, 1); // one place per member: never a party
  if (riders.length > maxRiders(s, booked, cap)) return { ok: false, error: "cap" };
  if (needsBike(s)) {
    if (hasRideGroups(s) && !rgOk(input.group)) return { ok: false, error: "invalid" };
    for (const [i, r] of riders.entries()) {
      if (!heightOk(r.height)) return { ok: false, error: "invalid" };
      if (!r.type) return { ok: false, error: "pick_type" };
      if (r.type === "Own" && !ownOffered(s)) return { ok: false, error: "pick_type" };
      if (riders.length > 1 && !(r.name || (i === 0 ? acct.name : ""))) return { ok: false, error: "invalid" };
    }
    // carbon is off every community ride but Petromin (the app turns a carried-over pick into Road)
    if (noCarbon(s)) riders = riders.map((r) => (r.type === "Road Carbon" ? { ...r, type: "Road" } : r));
  }
  if (needsWaiver(s) && !input.waiver) return { ok: false, error: "waiver" };
  return { ok: true, riders };
}

/** The rows customer_create_booking takes (entryToDB): no price - the database sets every one. */
export function bookingEntries(input: BookInput, riders: Rider[], s: LiveSession, acct: Pick<BookAccount, "name" | "house">, waiverVersion: string | null): Row[] {
  // a personal one-use code rides on rider 1's row alone (its kind read off the code here, never the browser's word)
  const tagged = promoRows(input.promo && { ...input.promo, one: codeOne(input.promo.code) }, s, riders, acct);
  const bike = needsBike(s);
  const now = new Date().toISOString();
  return riders.map((r, i) => {
    const h = parseInt(r.height, 10);
    const row: Row = {
      name: r.name || (i === 0 ? acct.name : ""),
      size: bike && heightOk(h) ? heightToSize(h, r.type) : "",
      height: bike && heightOk(h) ? h : null,
      type_preference: bike ? r.type : "None",
      paid: false,
      session_id: s.id,
      session_day: s.day,
      session_date: s.date,
      queue_num: 0,
      status: s.full ? "waitlist" : "waiting",
      registered_at: now,
      walk_in: false,
      promo_code: tagged[i] && input.promo ? input.promo.code : null,
    };
    if (s.approval) row.approval = "pending";
    // a place asked for (seatOnly): a database with 20261111030000 refuses PLACE_GONE instead of seating it on the waitlist;
    // an older one ignores the key
    if (input.seatOnly && !s.full) row.seat_only = true;
    if (waiverVersion) row.waiver_version = waiverVersion;
    if (i === 0 && hasRideGroups(s) && rgOk(input.group)) row.ride_group = input.group;
    return row;
  });
}

/** The waiver text's version (WAIVER_VERSION / SWIM_WAIVER_VERSION / ACTIVITY_WAIVER_VERSION): every rider row carries the
 *  wording it was agreed under. Bump it with the app's whenever the text changes. */
export const WAIVER_VERSION = "2026-10-v3";
export const SWIM_WAIVER_VERSION = "swim-2026-10-v3";
export const ACTIVITY_WAIVER_VERSION = "activity-2026-10-v3";
const WAIVER_VERSIONS = { bike: WAIVER_VERSION, swim: SWIM_WAIVER_VERSION, activity: ACTIVITY_WAIVER_VERSION } as const;
export const waiverVersionFor = (s: Pick<BookSession, "kind">): string | null => (needsWaiver(s) ? WAIVER_VERSIONS[waiverKind(s)] : null);

/** How many places the session has left and how many are on its waitlist, by count (queue_public). */
async function counts(sessionId: string, fetchImpl: typeof fetch): Promise<{ taken: number | null; waitlisted: number | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { taken: null, waitlisted: null };
  const wl = async () => {
    try {
      const res = await fetchImpl(`${url}/rest/v1/queue_public?select=id&session_id=eq.${sessionId}&status=eq.waitlist`, {
        method: "HEAD", headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" }, cache: "no-store", signal: AbortSignal.timeout(3000),
      });
      const m = /\/(\d+)$/.exec(res.headers.get("content-range") ?? "");
      return res.ok && m ? Number(m[1]) : null;
    } catch { return null; }
  };
  const [taken, waitlisted] = await Promise.all([placesTaken(fetchImpl, url, key, sessionId), wl()]);
  return { taken, waitlisted };
}

/** A capped waitlist that is full refuses rather than seats riders past its cap (waitlistRoom):
 *  a booking that needs a place goes to the waitlist when staff marked the ride full, or (a ride
 *  nobody approves) when the places left cannot seat every rider who needs a bike. Only those
 *  riders go on it: a rider on their own bike takes no place (submitReg's _needSeats; bug hunt
 *  2026-11-10, app12-1: a party with an own bike was refused as "waitlist full"). */
export function waitlistRefused(s: Pick<LiveSession, "full" | "approval" | "capacity" | "wlCap">, need: number, taken: number | null, waitlisted: number | null): boolean {
  if (s.wlCap == null) return false;
  const toWaitlist = need > 0 && (s.full || (!s.approval && taken != null && s.capacity - taken < need));
  return toWaitlist && waitlisted != null && s.wlCap - waitlisted < need;
}

export type Booked = { id: string; queue_num: number | null; status: string; waitlist_num: number | null; price: number | null };
export type BookResult =
  | { ok: true; booked: Booked[]; rows: Row[]; addonsSaved: boolean; session: LiveSession }
  | { ok: false; error: Refusal };

/** Books the ride: the checks, the booking (customer_create_booking), then the add-ons on the
 *  account holder's row and their stock (customer_booking_update, customer_addon_stock), the
 *  first height kept on the account (customer_set_height), and the rows as my_bookings has them. */
export async function makeBooking(acct: Session & { name: string; profile?: Row }, input: BookInput, today: string, fetchImpl: typeof fetch = fetch): Promise<BookResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, error: "generic" };
  const args = { p_id: acct.id, p_token: acct.token };
  let rowsNow: Row[] = [];
  let sessRow: Row | null = null;
  try {
    const [rows, sess] = await Promise.all([
      rpcCall<Row[]>("my_bookings", args, fetchImpl),
      // read for the account (list_sessions with its token): a session for men only or women only is the
      // database's to hand out, to that gender alone or an account holding a booking on it (2026-10-27)
      sessionRows(fetchImpl, url, key, `id=eq.${input.sessionId}`, "id,session_date,day,status,title,ride_kind,event_kind,bike_slots,open_to_all,paid_ride,capacity,needs_approval,spots,addons", Date.now(),
        { optional: [SESSION_COLS_GENDER], account: acct }),
    ]);
    if (!Array.isArray(rows.data)) {
      // my_bookings answers no rows (never an error) for a token it no longer takes, and the route checked the token
      // with customer_profile: an error here is the database's or the way's, not a sign-in that ended, unless it says so
      const ended = rows.status === 401 || rows.status === 403 || /STALE_SESSION/.test(`${rows.error?.code ?? ""} ${rows.error?.message ?? ""}`);
      return { ok: false, error: ended ? "signin" : "generic" };
    }
    rowsNow = rows.data;
    sessRow = Array.isArray(sess) && sess[0] ? (sess[0] as Row) : null;
  } catch {
    return { ok: false, error: "generic" };
  }
  const s = sessRow ? liveSession(sessRow, today) : null;
  if (!s) return { ok: false, error: "closed" };
  const profile = acct.profile ?? {};
  const a = accountFrom(acct.name, profile, rowsNow, false, []);
  // the riders per account admins set in the booking app (Settings > Business), as _group_ride_cap reads it
  const checked = checkBooking(input, s, a, bizOf(await loadSiteContent()).jccAccountCap);
  if (!checked.ok) return checked;
  // a place asked for on a session staff have marked full since the page was read: gone, and the rider chooses
  if (input.seatOnly && s.full) return { ok: false, error: "place_gone" };
  if (s.members) {
    const m = await rpcCall<boolean>("community_member", args, fetchImpl);
    if (m.data !== true) return { ok: false, error: m.status === 0 ? "generic" : "members" };
  }
  const riders = checked.riders;
  const need = needsBike(s) ? riders.filter((r) => r.type !== "Own").length : riders.length;
  if (s.wlCap != null) {
    const c = await counts(s.id, fetchImpl);
    if (waitlistRefused(s, need, c.taken, c.waitlisted)) return { ok: false, error: "waitlist_full" };
  }
  const entries = bookingEntries(input, riders, s, a, waiverVersionFor(s));
  const made = await rpcCall<Booked[]>("customer_create_booking", { ...args, p_entries: entries }, fetchImpl);
  if (made.error) return { ok: false, error: made.status === 0 ? "generic" : refusalOf(made.error) };
  const booked = Array.isArray(made.data) ? made.data : [];
  if (!booked.length) return { ok: false, error: "generic" };

  // The add-ons ride on the account holder's row; a booking that landed on the waitlist reserves
  // no stock (the app's own rule). A free ride sells none.
  let addonsSaved = true;
  const picks = s.free ? [] : input.addons.filter((x) => s.addons.includes(x.id)).map((x) => ({ id: x.id, qty: Math.min(x.qty, addonCap({ qty: 20 })) }));
  if (picks.length) {
    const w = await rpcCall<boolean>("customer_booking_update", { ...args, p_entry_id: booked[0].id, p_patch: { addons: JSON.stringify(picks) } }, fetchImpl);
    addonsSaved = !w.error && w.data === true;
    if (addonsSaved && booked[0].status !== "waitlist") {
      await rpcCall<boolean>("customer_addon_stock", { ...args, p_items: picks.map((x) => ({ id: x.id, delta: -x.qty })) }, fetchImpl);
    }
  }
  // The first height a rider gives is kept on the account, so the next booking starts from it.
  const h0 = parseInt(riders[0]?.height ?? "", 10);
  if (needsBike(s) && !a.height && heightOk(h0)) {
    await rpcCall<boolean>("customer_set_height", { ...args, p_height: h0 }, fetchImpl);
  }
  let after = await rpcCall<Row[]>("my_bookings", args, fetchImpl);
  // one more read when it failed: the confirmation draws a ticket for every row it returns (bug hunt 2026-11-10)
  if (!Array.isArray(after.data)) after = await rpcCall<Row[]>("my_bookings", args, fetchImpl);
  const ids = new Set(booked.map((b) => b.id));
  const rows = (Array.isArray(after.data) ? after.data : []).filter((r) => ids.has(S(r.id)));
  return { ok: true, booked, rows, addonsSaved, session: s };
}

/** Whether a booking on this ride is paid online (rentals 20261110150000 pay_booking_start): a paid ride that is
 *  not a race (the organiser's money, by transfer) nor a Petromin night (the company's bill or the desk). */
export const payableOnline = (s: Pick<LiveSession, "free" | "kind">) => !s.free && !["vlap", "arena", "petromin"].includes(s.kind);
