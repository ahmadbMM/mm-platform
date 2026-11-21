// The server's half of changing a booking on the website (lib/booking-manage.ts has the shared rules): what the
// ticket's dialogs need to know, and every change, made through the booking app's own token-checked functions with the
// id and token from the account cookie only (customer_booking_update, customer_create_booking, customer_addon_stock,
// customer_locker_reserve / _change / _cancel). Each refusal keeps the database's code, message and detail
// (lib/booking-server.ts rpcCall) and is answered as one of lib/booking-manage.ts ManageError, which the dialogs say in
// the booking app's words.
import { ACCOUNT_COOKIE, decodeSession, sameOrigin, type Session } from "./account-core";
import { cookieValue } from "./live";
import { withinLimit } from "./rate-limit";
import { maxRiders, needsBike, partyRide, refusalOf, typeOptions, type BookSession, type Refusal, type Rider } from "./booking";
import { bookingEntries, liveSession, rpcCall, waitlistRefused, waiverVersionFor, type LiveSession, type RpcAnswer } from "./booking-server";
import { bizOf, loadFares } from "./biz";
import { siteBookingWindow, notOpenYet } from "./booking-window";
import { mfHeld } from "./members-first";
import { loadRides, placesTaken, sessionRows, slotTimes, timesText, upcoming, SESSION_COLS_CLOSED, SESSION_COLS_GENDER, SESSION_COLS_PUBLIC_AT, type RideSession } from "./rides";
import { genderOk, sessionGender } from "./session-gender";
import { loadSiteContent } from "./site";
import { fmtClock, fmtDayDate } from "./tickets";
import { riyadhClock } from "./workshop-days";
import {
  activeCount, addonStep, cancelPatch, cancelReasons, checkEdit, editPlan, holderOf, ID, liveRows, lkBoard, lkOffer, lkRefusal, lkRentals,
  manageRow, moveRefusal, paidOver, rawAddons, rsTarget, sessionEnded, stockBack, LOCKER_LINE,
  type EditError, type EditRider, type EditType, type LkBoard, type LkOffer, type LkRental, type LockerBody, type ManageError, type ManageRow, type MoveRefusal, type RawAddon, type Reason,
} from "./booking-manage";

type Row = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
type Fail = { ok: false; error: ManageError; detail?: string; field?: string; i?: number; moved?: number; of?: number };
const fail = (error: ManageError, more: Omit<Fail, "ok" | "error"> = {}): Fail => ({ ok: false, error, ...more });
const nowRiyadh = () => riyadhClock(new Date());
const args = (a: Session) => ({ p_id: a.id, p_token: a.token });

/** The session row the dialogs read, for the account (list_sessions with its token: a private ride it holds a booking on
 *  comes back too), with every optional column the database has. Null when it cannot be read. */
const SESS_COLS = "id,session_date,day,status,title,ride_kind,event_kind,bike_slots,open_to_all,paid_ride,capacity,needs_approval,spots,price";
async function sessionRow(acct: Session, id: string, f: typeof fetch): Promise<Row | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !ID.test(id)) return null;
  try {
    const rows = await sessionRows(f, url, key, `id=eq.${id}`, SESS_COLS, Date.now(), { optional: [SESSION_COLS_GENDER, SESSION_COLS_CLOSED, SESSION_COLS_PUBLIC_AT, "addons"], account: acct });
    return Array.isArray(rows) && rows[0] && typeof rows[0] === "object" ? (rows[0] as Row) : null;
  } catch { return null; }
}
const closedOf = (r: Row) => (Array.isArray(r.closed_types) ? r.closed_types.filter((x): x is string => typeof x === "string") : []);
/** The account's rows (my_bookings), or null when they could not be read. */
async function myRows(acct: Session, f: typeof fetch): Promise<Row[] | null> {
  const r = await rpcCall<Row[]>("my_bookings", args(acct), f);
  return Array.isArray(r.data) ? r.data : null;
}
/** The account's profile (customer_profile), or null for a token it no longer takes. */
async function profileOf(acct: Session, f: typeof fetch): Promise<Row | null | "down"> {
  const r = await rpcCall<Row[]>("customer_profile", args(acct), f);
  if (r.status === 0 || r.status >= 500) return "down";
  return Array.isArray(r.data) && r.data[0] && typeof r.data[0] === "object" ? r.data[0] : null;
}
/** An answer from customer_booking_update: true when the row was written. */
const wrote = (r: { data: unknown; error: unknown }) => !r.error && r.data === true;
/** A database refusal that means the sign-in ended. */
const ended = (r: { status: number; error: { code?: string; message?: string } | null }) =>
  r.status === 401 || r.status === 403 || /STALE_SESSION|NOT_AUTHORIZED|42501/.test(`${r.error?.code ?? ""} ${r.error?.message ?? ""}`);
/** The stock a change moves (customer_addon_stock): negative takes, positive gives back. A failure moves nothing. */
async function moveStock(acct: Session, items: { id: string; delta: number }[], f: typeof fetch) {
  const list = items.filter((x) => x.id !== LOCKER_LINE && x.delta !== 0 && ID.test(x.id)).slice(0, 20);
  if (list.length) await rpcCall<boolean>("customer_addon_stock", { ...args(acct), p_items: list }, f);
}

// ── What the dialogs read ──────────────────────────────────────────────────────────────────────────

/** An add-on as the dialog sells it: the inventory's item (its name, brand, an https photo, today's price and stock). */
export type SoldItem = { id: string; name: string; brand: string; photo: string; price: number; qty: number; category: string; sold: boolean };
/** Everything the ticket's dialogs need, for one booking (the account's live rows on one session). */
export type ManageCtx = {
  ok: true;
  session: { id: string; date: string; kind: string; free: boolean; approval: boolean; community: boolean; bike: boolean; ended: boolean; open: boolean; seat: number | null };
  name: string;
  rows: ManageRow[];
  cap: number;
  party: boolean;
  types: EditType[];
  addons: SoldItem[];
  /** The lockers the session offers (customer_locker_offer; none on a free ride) and the account's rentals on the booking. */
  lockers: { kind: "jcc" | "pm" | ""; offer: LkOffer | null; rentals: LkRental[] };
  reasons: Reason[];
  /** The riders one account books on a circuit night (Settings > Business jcc_account_cap): the stepper's note. */
  acctCap: number;
  holder: string | null;
};

async function inventory(ids: string[], f: typeof fetch): Promise<Map<string, Row>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const clean = [...new Set(ids)].filter((x) => ID.test(x) && x !== LOCKER_LINE).slice(0, 60);
  if (!url || !key || !clean.length) return new Map();
  try {
    const res = await f(`${url}/rest/v1/inventory?select=id,name,brand,photo,price,qty,category&id=in.(${clean.join(",")})`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(4000),
    });
    const rows = res.ok ? ((await res.json()) as Row[]) : [];
    return new Map((Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.id === "string").map((r) => [r.id as string, r]));
  } catch { return new Map(); }
}
const soldItem = (r: Row, sold: boolean): SoldItem => ({
  id: S(r.id), name: S(r.name).trim() || S(r.id), brand: S(r.brand).trim(), photo: /^https:\/\//.test(S(r.photo)) ? S(r.photo) : "",
  price: N(r.price) ?? 0, qty: Math.floor(N(r.qty) ?? 0), category: S(r.category) || "Other", sold,
});

/** The session as the edit reads it: the booking's own shape (lib/booking-server.ts liveSession), its closed types, and
 *  whether it is over or still takes changes (open or full, not over: the booking app's _sessLive). */
function sessOf(r: Row, today: string, now: string): (LiveSession & { closed: string[]; ended: boolean; live: boolean; publicAt: string | null }) | null {
  const s = liveSession(r, "0000-00-00"); // a past date still reads: whether it is over is said below
  if (!s) return null;
  const done = sessionEnded(s.date, slotTimes(r.bike_slots), now);
  return { ...s, closed: closedOf(r), ended: done, live: (r.status === "open" || r.status === "full") && !done && s.date >= today, publicAt: S(r.public_at) || null };
}

export async function manageContext(acct: Session, sessionId: string, f: typeof fetch = fetch): Promise<ManageCtx | Fail> {
  const now = nowRiyadh(), today = now.slice(0, 10);
  const [prof, rowsAll, sr, content] = await Promise.all([profileOf(acct, f), myRows(acct, f), sessionRow(acct, sessionId, f), loadSiteContent()]);
  if (prof === "down") return fail("generic");
  if (!prof) return fail("signin");
  if (!rowsAll) return fail("generic");
  const rows = liveRows(rowsAll, sessionId);
  if (!rows.length) return fail("gone");
  const s = sr ? sessOf(sr, today, now) : null;
  if (!s) return fail("generic");
  const biz = bizOf(content);
  const name = S(prof.name);
  const bike = needsBike(s);
  const shape = { community: s.community, kind: s.kind } as Pick<BookSession, "community" | "kind">;
  const cap = Math.max(maxRiders(shape, activeCount(rowsAll, sessionId), biz.jccAccountCap, biz.eventSeatMax, biz.groupRideMax), rows.length);
  // the party's size changes on a ride that takes one (a Petromin night, an event, the Farm House Night) or one nobody
  // approves outside the community rides; a community ride is one place per member (changeRegQty)
  const party = !(s.community && !partyRide(shape));
  const hidden = S(prof.hidden_types).split(",").map((x) => x.trim()).filter(Boolean);
  let types: EditType[] = [];
  if (bike) {
    const fares = await loadFares(f);
    const offered: string[] = typeOptions({ community: s.community, kind: s.kind, closedTypes: [] }, hidden);
    const every: string[] = typeOptions({ community: s.community, kind: s.kind, closedTypes: [] }, []);
    // a type staff hid from the account stays for the row that holds it (_regTyKept)
    for (const r of rows) if (every.includes(r.type) && !offered.includes(r.type)) offered.push(r.type);
    types = offered.map((t) => ({ type: t, closed: s.closed.includes(t), price: s.free || s.seat != null || t === "Own" ? null : fares.price[t] ?? null }));
  }
  // the add-ons the session sells (none on a free ride or one staff approve), and what the rows hold that it no longer does
  const sells = !s.free && !s.approval ? s.addons : [];
  const held = [...new Set(rows.flatMap((r) => r.addons.map((a) => a.id)))].filter((x) => x !== LOCKER_LINE && !sells.includes(x));
  const [inv, offerRaw] = await Promise.all([
    inventory([...sells, ...held], f),
    rpcCall<unknown>("customer_locker_offer", { p_session: sessionId }, f),
  ]);
  const addons = [...sells.map((id) => inv.get(id)).filter((x): x is Row => !!x).map((r) => soldItem(r, true))
    .sort((a, b) => (a.qty > 0 ? 0 : 1) - (b.qty > 0 ? 0 : 1)), ...held.map((id) => inv.get(id)).filter((x): x is Row => !!x).map((r) => soldItem(r, false))];
  const offer = lkOffer(offerRaw.data);
  let rentals: LkRental[] = [];
  const ids = new Set(rowsAll.filter((r) => (S(r.session_id) || S(r.session_date).slice(0, 10)) === sessionId).map((r) => S(r.id)));
  if (offer || rows.some((r) => r.addons.some((a) => a.id === LOCKER_LINE))) {
    const lk = await rpcCall<unknown>("customer_lockers", args(acct), f);
    rentals = lkRentals(lk.data).filter((x) => x.bookingId && ids.has(x.bookingId));
  }
  return {
    ok: true,
    session: { id: s.id, date: s.date, kind: s.kind, free: s.free, approval: s.approval, community: s.community, bike, ended: s.ended, open: s.live, seat: s.seat },
    name, rows, cap, party, types, addons,
    lockers: { kind: offer && !s.free ? offer.kind : "", offer: s.free ? null : offer, rentals },
    reasons: cancelReasons(biz.cancelOff, biz.cancelCustom),
    acctCap: biz.jccAccountCap,
    holder: s.kind === "farm" ? holderOf(rows, name) : null,
  };
}

// ── Cancel ─────────────────────────────────────────────────────────────────────────────────────────

/** Cancels the whole booking (cancelBooking): every live row of the account on the session of `booking`, each with the
 *  reason and Other's words, then the add-ons of the rows that held their place go back to stock. A paid ride that is
 *  over is refused before anything is sent. */
export async function cancelBooking(acct: Session, body: { booking: string; reason: string; note: string | null }, f: typeof fetch = fetch): Promise<{ ok: true; cancelled: number } | Fail> {
  const now = nowRiyadh();
  const [rowsAll, content] = await Promise.all([myRows(acct, f), loadSiteContent()]);
  if (!rowsAll) return fail("generic");
  const one = rowsAll.map(manageRow).find((r) => r?.id === body.booking);
  if (!one) return (await profileOf(acct, f)) ? fail("gone") : fail("signin");
  const group = liveRows(rowsAll, one.sessionId);
  const biz = bizOf(content);
  if (!cancelReasons(biz.cancelOff, biz.cancelCustom).some((r) => r.code === body.reason)) return fail("invalid");
  if (group.some((r) => r.paid || r.walletPaid > 0)) {
    const sr = await sessionRow(acct, one.sessionId, f);
    const over = sessionEnded(sr ? S(sr.session_date) : one.date, sr ? slotTimes(sr.bike_slots) : null, now);
    if (paidOver(group, over)) return fail("over");
  }
  const patch = cancelPatch(body.reason, body.note);
  const res = await Promise.all(group.map((r) => rpcCall<boolean>("customer_booking_update", { ...args(acct), p_entry_id: r.id, p_patch: patch }, f)));
  const done = group.filter((_, i) => wrote(res[i]));
  await moveStock(acct, stockBack(done), f);
  if (done.length < group.length) {
    const bad = res.find((r) => !wrote(r));
    return fail(bad && ended(bad) ? "signin" : "generic", { moved: done.length, of: group.length });
  }
  return { ok: true, cancelled: done.length };
}

// ── Edit ───────────────────────────────────────────────────────────────────────────────────────────

/** A booking refusal (lib/booking.ts refusalOf) as the edit says it. */
function editRefusal(r: Refusal): ManageError {
  const m: Partial<Record<Refusal, ManageError>> = {
    signin: "signin", closed: "closed", waiver: "waiver", waiver_outdated: "waiver_outdated", fix_first: "fix_first", waitlist_full: "waitlist_full",
    type_closed: "type_closed", type_full: "type_full", members_first: "members_first", group_cap: "cap", cap: "cap", not_open: "not_open",
    members: "members", place_gone: "type_full",
  };
  return m[r] ?? "generic";
}
const fieldError = (e: EditError): Fail =>
  e.field === "paid" ? fail("paid_type", { i: e.i }) : e.field === "waiver" ? fail("waiver") : e.field === "cap" ? fail("cap") : e.field === "closed" ? fail("type_closed", { i: e.i }) : fail("invalid", { field: e.field, i: e.i });

/** Saves the edit (submitModifyBooking): the rows kept get their new height, size and type, the rows past the new count
 *  are cancelled, the riders added are booked (customer_create_booking, under the session's waiver), and the removed
 *  rows that held their place give their add-ons back. A booking that changed since the form was filled is refused
 *  (changed), before anything is sent. */
export async function editBooking(acct: Session, body: { session: string; key: string[]; riders: EditRider[]; waiver: boolean }, f: typeof fetch = fetch): Promise<{ ok: true; added: number; waitlisted: boolean } | Fail> {
  const now = nowRiyadh(), today = now.slice(0, 10);
  const [prof, rowsAll, sr, content] = await Promise.all([profileOf(acct, f), myRows(acct, f), sessionRow(acct, body.session, f), loadSiteContent()]);
  if (prof === "down" || !rowsAll) return fail("generic");
  if (!prof) return fail("signin");
  const existing = liveRows(rowsAll, body.session);
  if (!existing.length) return fail("gone");
  if (existing.map((r) => r.id).join(",") !== body.key.join(",")) return fail("changed");
  const s = sr ? sessOf(sr, today, now) : null;
  if (!s) return fail("generic");
  if (!s.live) return fail("closed");
  // a run, a race, the donor and a ride staff approve are never edited (their tickets offer no Edit)
  if (s.approval || ["runher", "defe5k", "vlap", "arena", "blood", "farm"].includes(s.kind)) return fail("invalid");
  const biz = bizOf(content);
  const bike = needsBike(s);
  const shape = { community: s.community, kind: s.kind } as Pick<BookSession, "community" | "kind">;
  const cap = Math.max(maxRiders(shape, activeCount(rowsAll, body.session), biz.jccAccountCap, biz.eventSeatMax, biz.groupRideMax), existing.length);
  const party = !(s.community && !partyRide(shape)); // a community ride is one place per member (changeRegQty)
  if (!party && body.riders.length !== existing.length) return fail("cap");
  const hidden = S(prof.hidden_types).split(",").map((x) => x.trim()).filter(Boolean);
  const fares = bike ? await loadFares(f) : null;
  const offered: string[] = bike ? typeOptions({ community: s.community, kind: s.kind, closedTypes: [] }, hidden) : [];
  const types: EditType[] = offered.map((t) => ({ type: t, closed: s.closed.includes(t), price: null }));
  const fare = (t: string) => (s.free ? 0 : s.seat != null ? s.seat : t === "Own" ? 0 : fares?.price[t] ?? null);
  const bad = checkEdit({ existing, riders: body.riders, bike, cap, types, fare, waiver: body.waiver });
  if (bad) return fieldError(bad);
  const plan = editPlan(existing, body.riders, bike);
  // riders added meet the waitlist cap as a first booking's do: on a full night they land on the waitlist, and a capped
  // one without room for all of them refuses rather than seating riders past the cap
  if (plan.added.length && s.wlCap != null) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const seats = bike ? plan.added.filter((r) => r.type !== "Own").length : plan.added.length;
    if (url && key && seats > 0) {
      const [taken, wl] = await Promise.all([placesTaken(f, url, key, s.id, s.kind === "petromin"), waitlistCount(s.id, f)]);
      if (waitlistRefused(s, seats, taken, wl)) return fail("waitlist_full");
    }
  }
  // the writes, as the app sends them: the rows kept, the rows removed, then the riders added (one call for the set)
  const pRes = await Promise.all(plan.patches.map((p) => rpcCall<boolean>("customer_booking_update", { ...args(acct), p_entry_id: p.id, p_patch: p.patch }, f)));
  const rRes = await Promise.all(plan.removed.map((r) => rpcCall<boolean>("customer_booking_update", { ...args(acct), p_entry_id: r.id, p_patch: { status: "cancelled", assigned_bike_id: null } }, f)));
  let made: { status: number; data: { id: string; status: string }[] | null; error: { code?: string; message?: string; details?: string } | null } | null = null;
  if (plan.added.length) {
    const riders: Rider[] = plan.added.map((r) => ({ name: r.name, height: r.height, type: (bike ? r.type : "") as Rider["type"] }));
    const entries = bookingEntries({ sessionId: s.id, riders, group: null, addons: [], promo: null, waiver: true, payNow: false, wallet: false, seatOnly: false }, riders, s, { name: S(prof.name), house: null }, waiverVersionFor(s));
    made = await rpcCall<{ id: string; status: string }[]>("customer_create_booking", { ...args(acct), p_entries: entries }, f);
  }
  // the removed rows whose cancel landed and that held their place give their add-ons back
  await moveStock(acct, stockBack(plan.removed.filter((_, i) => wrote(rRes[i]))), f);
  const pBad = pRes.findIndex((r) => !wrote(r));
  if (pBad >= 0) {
    const r = pRes[pBad], p = plan.patches[pBad];
    if (r.error) return fail(ended(r) ? "signin" : editRefusal(refusalOf(r.error)));
    // a bare refusal: an own bike switched to ours with none left for it, a paid row onto a dearer bike, a type with no working bike
    return fail(p.ownSwitch ? "own_full" : p.paidSwitch ? "paid_type" : p.typeSwitch ? "type_full" : "generic", { i: existing.findIndex((x) => x.id === p.id) });
  }
  const rBad = rRes.find((r) => !wrote(r));
  if (rBad) return fail(ended(rBad) ? "signin" : "generic");
  if (made && made.error) return fail(made.status === 0 ? "generic" : editRefusal(refusalOf(made.error)), { detail: S(made.error.details) || undefined });
  const added = Array.isArray(made?.data) ? made.data : [];
  return { ok: true, added: added.length, waitlisted: added.some((x) => x && x.status === "waitlist") };
}
async function waitlistCount(sessionId: string, f: typeof fetch): Promise<number | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await f(`${url}/rest/v1/queue_public?select=id&session_id=eq.${sessionId}&status=eq.waitlist`, {
      method: "HEAD", headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" }, cache: "no-store", signal: AbortSignal.timeout(3000),
    });
    const m = /\/(\d+)$/.exec(res.headers.get("content-range") ?? "");
    return res.ok && m ? Number(m[1]) : null;
  } catch { return null; }
}

/** The Farm House Night's Edit (_fhDrop): one family member off the booking, never the holder alone (Cancel takes the
 *  whole booking). It works on a night closed in the app, as there. */
export async function dropFamily(acct: Session, body: { session: string; drop: string }, f: typeof fetch = fetch): Promise<{ ok: true; name: string } | Fail> {
  const [prof, rowsAll] = await Promise.all([profileOf(acct, f), myRows(acct, f)]);
  if (prof === "down" || !rowsAll) return fail("generic");
  if (!prof) return fail("signin");
  const rows = liveRows(rowsAll, body.session);
  const row = rows.find((r) => r.id === body.drop);
  if (!row || rows.length < 2) return fail("gone");
  if (row.id === holderOf(rows, S(prof.name))) return fail("invalid");
  const r = await rpcCall<boolean>("customer_booking_update", { ...args(acct), p_entry_id: row.id, p_patch: { status: "cancelled", assigned_bike_id: null } }, f);
  if (!wrote(r)) return fail(ended(r) ? "signin" : "generic");
  await moveStock(acct, stockBack([row]), f);
  return { ok: true, name: row.name };
}

// ── Add-ons ────────────────────────────────────────────────────────────────────────────────────────

/** One step of a row's add-ons (_entryAddonMutate): the whole list written through customer_booking_update, then the
 *  stock moved by one (a waitlisted row holds none). */
export async function addonChange(acct: Session, body: { booking: string; item: string; delta: 1 | -1 }, f: typeof fetch = fetch): Promise<{ ok: true; lines: RawAddon[] } | Fail> {
  const rowsAll = await myRows(acct, f);
  if (!rowsAll) return fail("generic");
  const raw = rowsAll.find((r) => S(r.id) === body.booking);
  const status = S(raw?.status);
  if (!raw || !["waiting", "waitlist", "active"].includes(status)) return (await profileOf(acct, f)) ? fail("gone") : fail("signin");
  const sid = S(raw.session_id) || S(raw.session_date).slice(0, 10);
  const [sr, inv] = await Promise.all([sessionRow(acct, sid, f), inventory([body.item], f)]);
  if (!sr) return fail("generic");
  const s = liveSession(sr, "0000-00-00");
  if (!s || s.free || s.approval) return fail("off");
  const it = inv.get(body.item);
  const row = { paid: raw.paid === true, payMethod: S(raw.pay_method) || null, price: N(raw.price) ?? 0, promo: S(raw.promo_code) || null };
  const step = addonStep(rawAddons(raw.addons), body.item, body.delta, {
    item: it ? { price: N(it.price) ?? 0, qty: Math.floor(N(it.qty) ?? 0) } : null, sold: s.addons.includes(body.item), row, active: status === "active",
  });
  if ("error" in step) return fail(step.error);
  const w = await rpcCall<boolean>("customer_booking_update", { ...args(acct), p_entry_id: body.booking, p_patch: { addons: JSON.stringify(step.lines) } }, f);
  if (!wrote(w)) return fail(ended(w) ? "signin" : w.error ? "generic" : body.delta > 0 ? "paid" : "generic");
  // a waitlisted row holds no stock: its add-ons are taken when it gets a place
  if (it && status !== "waitlist") await moveStock(acct, [{ id: body.item, delta: -body.delta }], f);
  return { ok: true, lines: step.lines };
}

// ── Reschedule ─────────────────────────────────────────────────────────────────────────────────────

/** A session the booking may move to, as the dialog lists it: its day and time in the page's language, and whether it
 *  has room for every rider (the same yardstick as booking: spotsLeft). */
export type MoveTarget = { id: string; day: string; time: string; full: boolean };

async function moveContext(acct: Session, from: string, f: typeof fetch) {
  const [prof, rowsAll] = await Promise.all([profileOf(acct, f), myRows(acct, f)]);
  if (prof === "down" || !rowsAll) return fail("generic");
  if (!prof) return fail("signin");
  const moving = liveRows(rowsAll, from);
  if (!moving.length) return fail("gone");
  return { prof, rowsAll, moving };
}

/** The sessions the booking may move to (showRescheduleModal), soonest first. */
export async function moveTargets(acct: Session, from: string, locale: string, words: { gather: string; start: string }, f: typeof fetch = fetch): Promise<{ ok: true; targets: MoveTarget[] } | Fail> {
  const c = await moveContext(acct, from, f);
  if ("ok" in c) return c;
  const now = nowRiyadh(), nowMs = Date.now();
  const [fromRow, rides, content] = await Promise.all([sessionRow(acct, from, f), loadRides(f), loadSiteContent()]);
  if (!fromRow) return fail("generic");
  const fs = liveSession(fromRow, "0000-00-00");
  // the National Day ride is never moved, in or out; nor a ride staff approve
  // a booking without a bike (the pool, the workshop, an event) is never offered a bike night: its rows hold no bike type
  if (!fs || fs.kind === "snd96" || fs.approval || !needsBike(fs)) return { ok: true, targets: [] };
  const w = siteBookingWindow(content);
  const gender = sessionGender(c.prof.gender);
  const list = upcoming(rides?.sessions ?? [], now);
  const anyMf = list.some((s) => s.publicAt && Date.parse(s.publicAt) > nowMs);
  const member = anyMf ? (await rpcCall<boolean>("community_member", args(acct), f)).data === true : false;
  const targets = list.filter((s: RideSession) => rsTarget({ ...s, approval: !!s.approval }, from, {
    ended: sessionEnded(s.date, s.times, now), notOpen: notOpenYet(s.date, w, now, s.kind), mfHeld: mfHeld(s, member, nowMs),
    genderOk: genderOk(s, gender), community: s.kind !== "jcc",
  }));
  return {
    ok: true,
    targets: targets.map((s) => ({
      id: s.id, day: fmtDayDate(s.date, locale), time: timesText(s.times, s.gather, (x) => fmtClock(x, locale), words),
      full: s.left != null && s.left < c.moving.length,
    })),
  };
}

/** Moves the whole booking (rescheduleBooking): the checks the app makes before anything moves (the place, a type closed
 *  there, room for every rider, a paid booking onto another fare), then each rider through customer_booking_update, then
 *  the add-on stock follows where each rider landed (a rider who came off the waitlist takes theirs, one who went onto it
 *  gives theirs back). The server refuses rider by rider: the riders who moved are said ("only {0} of {1} moved"). */
export async function moveBooking(acct: Session, body: { from: string; to: string }, f: typeof fetch = fetch): Promise<{ ok: true; waitlisted: boolean } | Fail> {
  const c = await moveContext(acct, body.from, f);
  if ("ok" in c) return c;
  const now = nowRiyadh(), nowMs = Date.now();
  const [fromRow, toRow, content] = await Promise.all([sessionRow(acct, body.from, f), sessionRow(acct, body.to, f), loadSiteContent()]);
  if (!fromRow) return fail("generic");
  const fs = liveSession(fromRow, "0000-00-00");
  const ts = toRow ? liveSession(toRow, "0000-00-00") : null;
  if (!fs || fs.kind === "snd96" || fs.approval || !needsBike(fs)) return fail("invalid");
  if (paidOver(c.moving, sessionEnded(fs.date, slotTimes(fromRow.bike_slots), now))) return fail("over");
  if (!ts || !toRow) return fail("closed");
  const w = siteBookingWindow(content);
  const pub = S(toRow.public_at);
  const member = pub && Date.parse(pub) > nowMs ? (await rpcCall<boolean>("community_member", args(acct), f)).data === true : false;
  if (notOpenYet(ts.date, w, now, ts.kind)) return fail("not_open");
  if (mfHeld({ publicAt: pub || null }, member, nowMs)) return fail("members_first", { detail: pub });
  const okTarget = rsTarget({ id: ts.id, kind: ts.kind, full: ts.full || toRow.status !== "open", approval: ts.approval, date: ts.date }, body.from, {
    ended: sessionEnded(ts.date, slotTimes(toRow.bike_slots), now), notOpen: false, mfHeld: false, genderOk: genderOk(ts, sessionGender(c.prof.gender)), community: ts.community,
  });
  if (!okTarget) return fail("closed");
  // a type closed on that date is said before anything moves: the server refuses only the rider on it, which would leave
  // a party split across two dates
  const closed = closedOf(toRow);
  if (c.moving.some((r) => closed.includes(r.type))) return fail("type_closed");
  // room for every rider, as a booking counts it (an own bike takes no place)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const taken = url && key ? await placesTaken(f, url, key, ts.id) : null;
  if (taken != null && (Number(toRow.capacity) || 12) - taken < c.moving.length) return fail("no_room");
  // a paid booking keeps what it paid: onto a ride with another fare for its type it is the desk's (PAID_MOVE)
  const fares = await loadFares(f);
  const fareOn = (s: LiveSession, type: string) => (s.free ? 0 : s.seat != null ? s.seat : type === "Own" ? 0 : fares.price[type] ?? fares.price.Any ?? 0);
  if (c.moving.some((r) => r.paid && (r.price > 0 || !!r.promo) && fareOn(fs, r.type) !== fareOn(ts, r.type))) return fail("paid_move");
  // one rider after another, in their order, so the numbers there follow the booking's
  const res: RpcAnswer<boolean>[] = [];
  for (const r of c.moving) res.push(await rpcCall<boolean>("customer_booking_update", { ...args(acct), p_entry_id: r.id, p_patch: { session_id: ts.id, session_day: ts.day, session_date: ts.date, status: "waiting" } }, f));
  const after = await myRows(acct, f);
  const now2 = new Map((after ?? []).map((r) => [S(r.id), r]));
  const items: { id: string; delta: number }[] = [];
  let anyWl = false;
  for (const [i, m] of c.moving.entries()) {
    if (!wrote(res[i])) continue;
    const st = S(now2.get(m.id)?.status);
    if (st === "waitlist") anyWl = true;
    const sign = m.status === "waitlist" && st === "waiting" ? -1 : m.status === "waiting" && st === "waitlist" ? 1 : 0;
    if (sign) for (const a of m.addons) items.push({ id: a.id, delta: sign * a.qty });
  }
  await moveStock(acct, items, f);
  const bad = res.findIndex((r) => !wrote(r));
  if (bad >= 0) {
    const r = res[bad];
    const moved = res.filter(wrote).length;
    const why: MoveRefusal = r.error ? moveRefusal(r.error) : "generic";
    return fail(r.error && ended(r) ? "signin" : why === "no_room" ? "no_room" : why, { moved, of: c.moving.length });
  }
  return { ok: true, waitlisted: anyWl };
}

// ── Lockers ────────────────────────────────────────────────────────────────────────────────────────

const lkFail = (e: { status: number; error: { code?: string; message?: string } | null }): Fail => {
  if (ended(e)) return fail("signin");
  const r = lkRefusal(e.error);
  return fail(r === "full" ? "lk_full" : r === "taken" ? "lk_taken" : r === "ended" ? "lk_ended" : r === "not_open" ? "lk_not_open" : "generic");
};

/** The locker actions (the booking app's review cabinet, _lkAfterBook, the ticket's Change and Remove): the evening's
 *  cabinet and what the session offers; a reservation on bookings (a door someone took in the last moments is reserved
 *  again with none picked, and the database holds a free one: `swap`); a change of a rental's time or door; a removal. */
export async function lockerAction(acct: Session, b: LockerBody, f: typeof fetch = fetch): Promise<Row & { ok: boolean }> {
  if (b.action === "board") {
    const [o, bd] = await Promise.all([rpcCall<unknown>("customer_locker_offer", { p_session: b.session }, f), rpcCall<unknown>("locker_board", { p_day: b.day }, f)]);
    if (o.status === 0 && bd.status === 0) return fail("generic");
    const offer: LkOffer | null = lkOffer(o.data), board: LkBoard | null = lkBoard(bd.data);
    return { ok: true, offer, board };
  }
  if (b.action === "reserve") {
    const call = (codes: string[] | null) => rpcCall<Row>("customer_locker_reserve", { ...args(acct), p_booking_ids: b.ids, p_period: b.period, ...(codes ? { p_codes: codes } : {}) }, f);
    let r = await call(b.codes);
    let swap = false;
    if (r.error && b.codes && /LOCKER_TAKEN|LOCKER_OUT/.test(`${r.error.message ?? ""}`)) { swap = true; r = await call(null); }
    if (r.error || !r.data) return lkFail(r);
    const got = Array.isArray(r.data.lockers) ? (r.data.lockers as Row[]).map((x) => ({ bookingId: S(x?.booking_id), code: S(x?.code) })).filter((x) => x.bookingId) : [];
    return { ok: true, swap, lockers: got };
  }
  if (b.action === "change") {
    const r = await rpcCall<Row>("customer_locker_change", { ...args(acct), p_rental: b.rental, p_period: b.period, p_code: b.code }, f);
    if (r.error || !r.data) return lkFail(r);
    return { ok: true, code: S(r.data.code), period: S(r.data.period) };
  }
  const r = await rpcCall<Row>("customer_locker_cancel", { ...args(acct), p_booking_ids: b.ids }, f);
  if (r.error || !r.data) return lkFail(r);
  return { ok: true };
}

// ── The routes' door ───────────────────────────────────────────────────────────────────────────────

/** The answer's HTTP status: a sign-in that ended 401, another site 403, a body it cannot read 400, too many calls 429,
 *  no answer 502, and every refusal of the booking's own 409. */
const STATUS: Partial<Record<ManageError, number>> = { signin: 401, origin: 403, invalid: 400, busy: 429, generic: 502 };
export const manageJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });
export const manageAnswer = (r: { ok: boolean; error?: ManageError } & Row) => manageJson(r, r.ok ? 200 : STATUS[r.error as ManageError] ?? 409);
/** Only this site's own pages, with the account cookie (never an id or token from the body), at most the account checks'
 *  pace (lib/rate-limit.ts): the signed-in session, or the answer that refuses the call. And the body, read once. */
export async function manageGate(req: Request): Promise<{ acct: Session; body: unknown } | Response> {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return manageJson({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return manageJson({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check", undefined, acct.id))) return manageJson({ ok: false, error: "busy" }, 429);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  return { acct, body };
}
