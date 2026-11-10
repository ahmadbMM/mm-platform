// The booking app's ticket, as the website shows it on My Account: the same card, the same rules
// (renderBookingTicket, bookingRef, downloadBookingICS in the rentals app), read from the rows the
// account's own my_bookings returns. Plain logic here, so it can be tested; the card is
// components/booking/TicketCard.tsx.
import { intlOf } from "@/i18n/locales";
import { fill as fillAt } from "@/i18n/tx";
import { fill as fillNamed } from "./fill";
import { collectTime, oneTime, rideKind, routeSlugOf, slotTimes, wlCollectSlot, type RideKind } from "./rides";
import { riyadhClock } from "./workshop-days";
import { vlCat, vlConfig, vlEntry, type VlConfig, type VlEntry } from "./vlap";
import { AH_VENUE, ahConfig, ahEntry, ahHold, isArenaId, type AhConfig, type AhEntry } from "./arena";
import { isBloodId } from "./blood";
import { sessionGender, type SessionGender } from "./session-gender";

export type TicketStatus = "waiting" | "waitlist" | "active" | "done";
/** An add-on line on a booking (the booking app's entryAddons): the inventory item, how many, and
 *  `p`, the price each was sold at when the database stamped it (rentals 20261004120000), else null. */
export type TicketAddon = { id: string; qty: number; p: number | null };
export type TicketRow = {
  id: string; sessionId: string; date: string; day: string; queueNum: number | null; status: TicketStatus;
  /** The Blood Donation event: a visitor, and their club or community (lib/blood.ts). */
  bloodVisitor?: boolean; bloodClub?: string;
  /** When staff marked the rider as the ride's lead (queue_entries.led_at, rentals 20261106130000), else none. */
  ledAt?: string;
  waitlistNum: number | null; approval: string | null; price: number; paid: boolean; name: string; type: string;
  /** How the desk or the wallet took it, and how much of it the wallet holds (rentals 20261103140000). */
  payMethod?: string | null; walletPaid?: number;
  /** Paid online (2026-11-10, rentals 20261110150000): how much the card paid, and until when the place is held
   *  while the rider pays (ISO; null when not held). */
  cardAmount?: number | null; payHold?: string | null;
  /** The desk's check-in and return (ISO), the minutes it timed on the bike, and the bike handed over. */
  checkedInAt: string | null; checkedOutAt: string | null; rideDuration: number | null; bikeId: string | null;
  /** The add-ons bought with the booking. */
  addonLines: TicketAddon[];
  /** The distance a Run for Her runner picked (queue_entries.run_km: 3 or 5 km), else null. Never
   *  a bike type: `type` stays the row's own ('None' on a run). */
  runKm: number | null;
  /** The Saturday ride's group (queue_entries.ride_group): 'beg' or 'int', else none. */
  rideGroup?: "beg" | "int" | null;
  /** A partner's place on the ride (queue_entries.partner, rentals 20261017120000: 'defe'), else none.
   *  partner_book makes it approved at once: a confirmed place, its code out, whatever the list says. */
  partner?: string | null;
  /** A Victory Lap athlete's place (queue_entries.vl, rentals 20261017210000; lib/vlap.ts): the race,
   *  division, T-shirt, 5 km time and team; null on every other booking (Arena Heros' too). */
  vl?: VlEntry | null;
  /** An Arena Heros athlete's place (queue_entries.vl on a session '<date>-ah', rentals 20261028200000;
   *  lib/arena.ts): the race, the division and the team's code (AH-XXXX); absent on every other booking. */
  ah?: AhEntry | null;
  /** The DEFE 5KM Run (2026-10-18): whether the runner told us they registered for the race on Defe's registration page
   *  (queue_entries.race_reg, rentals 20261018150000): 'yes', 'no', or null before they answer (and on
   *  every other booking, and on a database without the column). */
  raceReg?: "yes" | "no" | null;
  /** Victory Lap (2026-10-23, rentals 20261023160000; lib/vl-ticket.ts): whether the athlete already has a
   *  ticket ('have') or buys one by bank transfer ('buy'), null before they answer; undefined when the
   *  database has no such column yet (the question then steps aside). */
  vlTicket?: "have" | "buy" | null;
  /** When the transfer receipt came in (queue_entries.vl_receipt_at, ISO), else null. */
  vlReceiptAt?: string | null;
  /** The promo code the row was booked with (queue_entries.promo_code) and the Saturday ride code (ride_code, rentals
   *  20261108120000), else null: the ticket names each with its kind (codeKindOf; the booking app's _codeRowHtml, 2026-11-08). */
  promoCode?: string | null; rideCode?: string | null;
};
/** The kinds of code a booking used (the booking app's _codeKindOf): the friend's referral discount (RW-), the referrer's
 *  free ride (RF-) and bonus (RB-), the blood donation free ride (BD-), a volunteer's free ride for an event worked (VL-,
 *  rentals 20261109120000, on the blood donors' rules), a code staff made, and a Saturday ride code. */
export type CodeKind = "promo" | "rw" | "rf" | "rb" | "bd" | "vl" | "sat";
export function codeKindOf(code: string): Exclude<CodeKind, "sat"> {
  const p = code.slice(0, 3).toUpperCase();
  return p === "RW-" ? "rw" : p === "RF-" ? "rf" : p === "RB-" ? "rb" : p === "BD-" ? "bd" : p === "VL-" ? "vl" : "promo";
}
/** A row's codes, as the ticket shows them: [kind, code]. */
export function rowCodes(r: Pick<TicketRow, "promoCode" | "rideCode">): [CodeKind, string][] {
  const out: [CodeKind, string][] = [];
  if (r.promoCode) out.push([codeKindOf(r.promoCode), r.promoCode]);
  if (r.rideCode) out.push(["sat", r.rideCode]);
  return out;
}
/** The distances a Run for Her runner picks from (the booking app's RUN_KMS). */
export const RUN_KMS: readonly number[] = [3, 5];
export type TicketSession = {
  id: string; date: string; kind: RideKind; title: string | null;
  /** A ride staff approve (community, needs_approval not false): no queue number, and no code until the list is out. */
  approval: boolean;
  /** Its rider list is published (hide_queue false). */
  published: boolean;
  times: [string, string] | null;
  /** The two times are "gathering - start" (the rides that gather: Saturday, National Day, and Run
   *  for Her), not a window; the pool and the workshop are a plain start - end, as in the booking app. */
  gathers: boolean;
  /** Bikes are handed out from this time (the circuit's _collect). */
  collect: string | null;
  /** The waitlist's own collection time staff set (rides.ts wlCollectSlot): "HH:MM", "" for none, absent when unset. */
  wlCollect?: string;
  meetUrl: string | null;
  free: boolean;
  /** Nothing to pay, as the booking app's _isFreeRide counts it for a ride ridden: any community
   *  ride not marked paid, National Day among them. */
  freeRide: boolean;
  /** The ride has bikes to hand out (not the pool, not the workshop, not a ticketed event, not Run
   *  for Her: the booking app's KIND_TRAITS). */
  bikes: boolean;
  /** The route the ride follows (an item's slug on the Routes page), or null. */
  routeSlug: string | null;
  /** Where staff said the ride is (sessions.location): "JCC", "JYC" (the Jeddah Yacht Club, where
   *  Run for Her meets), a place's name, or null (the circuit). */
  location: string | null;
  /** The Saturday ride's breakfast stop (sessions.breakfast_*): its name, in Arabic too when the venue
   *  booked it on the vendor portal, its map link, and the venue's offer for riders in English and
   *  Arabic (rentals migration 20261004130000). Null when the ride has none. */
  breakfast: { name: string; nameAr: string | null; url: string | null; offerEn: string | null; offerAr: string | null } | null;
  /** When riders are told where the ride meets and has breakfast (sessions.reveal_at, ISO), or null
   *  (spotHeld). */
  revealAt: string | null;
  /** Victory Lap's settings (sessions.vl, lib/vlap.ts: the races open, how to pay, what goes to Kamin
   *  Sports); null on every other kind. A read without the column has every race open and no words of
   *  staff's own. */
  vl?: VlConfig | null;
  /** Arena Heros' settings (sessions.vl, lib/arena.ts: the races and divisions open, staff's words for how to
   *  pay and for what goes to the organisers); null on every other kind. */
  ah?: AhConfig | null;
  /** The session's own price in SAR (sessions.price: Victory Lap's per athlete, the amount its ticket
   *  asks to transfer), else null. */
  price?: number | null;
  /** Men only, women only or mixed (null): sessions.gender_only (the owner, 2026-10-27; lib/session-gender.ts),
   *  which the ticket's chip names. A read without the column reads as mixed. */
  gender?: SessionGender | null;
};

type Row = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

/** A my_bookings row as the ticket reads it, or null for a status it never shows. */
export function ticketRow(r: Row): TicketRow | null {
  const status = r.status === "waiting" || r.status === "waitlist" || r.status === "active" || r.status === "done" ? r.status : null;
  const date = S(r.session_date);
  if (!status || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  // assigned_bike_id holds one id, or a JSON list of them for a rider handed more than one
  let bike = S(r.assigned_bike_id).trim();
  if (bike.startsWith("[")) { try { const a = JSON.parse(bike) as unknown; bike = Array.isArray(a) && typeof a[0] === "string" ? a[0] : ""; } catch { bike = ""; } }
  const km = N(r.run_km); // a distance the booking app would take (_runKmOk), else none
  // an Arena Heros place keeps its race, division and team in the same column as Victory Lap's: told apart by
  // its session's id ('<date>-ah'), as my_bookings gives the row without its session's kind
  const ah = isArenaId(S(r.session_id)) ? ahEntry(r.vl) : undefined;
  return {
    id: S(r.id), sessionId: S(r.session_id) || date, date, day: S(r.session_day), queueNum: N(r.queue_num), status,
    waitlistNum: N(r.waitlist_num), approval: S(r.approval) || null, price: N(r.price) ?? 0, paid: r.paid === true, payMethod: S(r.pay_method) || null, walletPaid: N(r.wallet_paid) ?? 0,
    cardAmount: N(r.card_amount), payHold: S(r.pay_hold_until) || null,
    name: S(r.name), type: S(r.type_preference),
    // the Blood Donation event: a visitor, and the club or community they gave (rentals 20261105140000, 20261105150000)
    ...(r.blood_role === "visitor" ? { bloodVisitor: true } : {}), ...(S(r.blood_club) ? { bloodClub: S(r.blood_club) } : {}),
    ...(S(r.led_at) ? { ledAt: S(r.led_at) } : {}), // the ride's lead, as staff marked it on Bookings (2026-11-06)
    checkedInAt: S(r.checked_in_at) || null, checkedOutAt: S(r.checked_out_at) || null, rideDuration: N(r.ride_duration), bikeId: bike || null,
    addonLines: entryAddons(r.addons),
    runKm: km !== null && RUN_KMS.includes(km) ? km : null,
    rideGroup: r.ride_group === "beg" || r.ride_group === "int" ? r.ride_group : null,
    partner: typeof r.partner === "string" && /^[a-z0-9]{2,20}$/.test(r.partner) ? r.partner : null,
    vl: ah === undefined ? vlEntry(r.vl) : null,
    ...(ah !== undefined ? { ah } : {}),
    raceReg: r.race_reg === "yes" || r.race_reg === "no" ? r.race_reg : null,
    ...("vl_ticket" in r ? { vlTicket: r.vl_ticket === "have" || r.vl_ticket === "buy" ? r.vl_ticket : null, vlReceiptAt: S(r.vl_receipt_at) || null } : {}),
    // the codes it was booked with (2026-11-08): letters, digits and dashes as the database keeps them, else none
    promoCode: /^[A-Za-z0-9_-]{1,40}$/.test(S(r.promo_code)) ? S(r.promo_code) : null,
    rideCode: /^[A-Za-z0-9_-]{1,40}$/.test(S(r.ride_code)) ? S(r.ride_code) : null,
  };
}

/** A booking's add-ons, as the booking app reads them (entryAddons): a JSON list, or its text, of
 *  {id, qty, p?} - or of bare ids, the old way - each line at least one; lines of the same item
 *  sold at the same price are one line. */
export function entryAddons(v: unknown): TicketAddon[] {
  let raw: unknown = v;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
  const out: TicketAddon[] = [];
  for (const a of Array.isArray(raw) ? raw : []) {
    const o = a && typeof a === "object" ? (a as Record<string, unknown>) : null;
    const id = o ? S(o.id) : S(a);
    if (!id) continue;
    const qty = o ? Math.max(1, Number(o.qty) || 1) : 1;
    const p = o && typeof o.p === "number" && Number.isFinite(o.p) ? o.p : null;
    const same = out.find((x) => x.id === id && x.p === p);
    if (same) same.qty += qty;
    else out.push({ id, qty, p });
  }
  return out;
}

/** An inventory item as the ticket names an add-on: its name, and today's price (null when the
 *  item could not be read). */
export type AddonItem = { name: string; price: number | null };
/** One add-on as the ticket lists it (the booking app's addonLineItems): whose it is, its name, how
 *  many, and the line's amount - the price it was sold at, else the item's price today; null when
 *  neither is known (the inventory could not be read), and then the ticket shows no total. */
export type AddonLine = { rowId: string; rider: string; name: string; qty: number; amount: number | null; locker: boolean };
const r2 = (n: number) => Math.round(n * 100) / 100;
export function addonLines(rows: Pick<TicketRow, "id" | "name" | "addonLines">[], items: Map<string, AddonItem> | null): AddonLine[] {
  return rows.flatMap((r) => r.addonLines.map((a) => {
    const it = items?.get(a.id);
    const each = a.p ?? it?.price ?? null;
    const locker = a.id === LOCKER_LINE; // the card names it (lockerText): it is no inventory item
    return { rowId: r.id, rider: r.name, name: locker ? "" : it?.name || a.id, qty: a.qty, amount: each === null ? null : r2(each * a.qty), locker };
  }));
}

// A locker (the booking app's lockers, rentals 20261109120000): the database writes its fee on the booking as an
// add-on line {"id":"locker"}, so the total already counts it; customer_lockers says the period and, once staff gave
// one at the desk, the locker's number. The periods: 18-20 and 21-23 (or both) on a JCC night, 19-21 on a Petromin night.
export const LOCKER_LINE = "locker";
export type TicketLocker = { period: string; code: string | null; status: string };
const LOCKER_TIMES: Record<string, [string, string]> = { early: ["18:00", "20:00"], late: ["21:00", "23:00"], both: ["18:00", "23:00"], pm: ["19:00", "21:00"] }; // both: one span, 6 PM - 11 PM (the owner, 2026-11-09)
/** customer_lockers' rows by booking, the ones not cancelled; an empty map when the answer is not a list. */
export function lockersOf(data: unknown): Map<string, TicketLocker> {
  const out = new Map<string, TicketLocker>();
  if (!Array.isArray(data)) return out;
  for (const x of data) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.booking_id !== "string" || typeof o.period !== "string" || o.status === "cancelled") continue;
    out.set(o.booking_id, { period: o.period, code: typeof o.code === "string" && o.code ? o.code : null, status: String(o.status ?? "") });
  }
  return out;
}
/** The rider's own lockers with no booking behind them (customer_lockers; the lockers page, or staff renting one to the
 *  account), today on, reserved or in use, soonest first: on that evening's ride ticket and in My Account's Your lockers,
 *  as the booking app's My bookings (_lkOwnHtml) and ticket (_lkTkHtml) show them (2026-11-09). */
export type OwnLocker = { id: string; day: string; period: string; code: string | null; name: string; status: string; pay: string | null; paid: boolean };
export function ownLockersOf(data: unknown, today: string): OwnLocker[] {
  if (!Array.isArray(data)) return [];
  const out: OwnLocker[] = [];
  for (const x of data) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (o.booking_id != null || typeof o.id !== "string" || typeof o.period !== "string") continue;
    const day = String(o.day ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today || (o.status !== "reserved" && o.status !== "in_use")) continue;
    out.push({ id: o.id, day, period: o.period, code: typeof o.code === "string" && o.code ? o.code : null, name: typeof o.name === "string" ? o.name : "",
      status: String(o.status), pay: typeof o.pay === "string" ? o.pay : null, paid: o.paid === true });
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}
/** "Locker · 9 PM - 11 PM · P7", as the booking app's ticket says it: the word, the period once known, the number once given. */
export function lockerText(word: string, lk: TicketLocker | undefined, locale: string): string {
  if (!lk) return word;
  const span = (p: string) => (LOCKER_TIMES[p] ? `${fmtClock(LOCKER_TIMES[p][0], locale)} - ${fmtClock(LOCKER_TIMES[p][1], locale)}` : "");
  return [word, span(lk.period), lk.code].filter(Boolean).join(" · ");
}

/** What the add-ons come to, or null when a line's amount is not known: the total then cannot be said. */
export function addonsCost(lines: AddonLine[]): number | null {
  let sum = 0;
  for (const l of lines) {
    if (l.amount === null) return null;
    sum += l.amount;
  }
  return r2(sum);
}

/** One ticket: a session's rows, or on Victory Lap one of the account's two places there - its Singles
 *  and its Doubles are two tickets (the booking app's key, sessionId|s or sessionId|d). `key` tells them apart. */
type Group = { key: string; sessionId: string; date: string; rows: TicketRow[] };
const groupKey = (r: Pick<TicketRow, "sessionId" | "vl">) => (r.vl ? `${r.sessionId}|${vlCat(r.vl)}` : r.sessionId);
const grouped = (list: TicketRow[]): Group[] => {
  const by = new Map<string, Group>();
  for (const r of list) {
    const key = groupKey(r);
    const g = by.get(key) ?? { key, sessionId: r.sessionId, date: r.date, rows: [] };
    g.rows.push(r);
    by.set(key, g);
  }
  for (const g of by.values()) g.rows.sort((a, b) => (a.queueNum ?? 0) - (b.queueNum ?? 0));
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
};

/** The account's live bookings still ahead (today, Riyadh, and later), one list per session,
 *  soonest first - the booking app's Current & upcoming (_bookingAhead): a rider still on the bike
 *  from yesterday's night (a ride past midnight, a bike not yet returned) keeps the ticket too. */
export function ticketGroups(rows: Row[], today: string): Group[] {
  const t = new Date(`${today}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  const yesterday = Number.isNaN(t.getTime()) ? today : t.toISOString().slice(0, 10);
  return grouped(rows.map(ticketRow).filter((r): r is TicketRow => !!r && r.status !== "done" && r.date >= (r.status === "active" ? yesterday : today)));
}

/** The account's finished bookings on the Blood Donation event from before today, one list per session (a session's
 *  id says it, lib/blood.ts). The website lists no past bookings, but a donor's free ride stays good for a month after
 *  the event and its code is on the ticket: My Account keeps such a ticket as a past card while the code is good. */
export function bloodDone(rows: Row[], today: string): Group[] {
  return grouped(rows.map(ticketRow).filter((r): r is TicketRow => !!r && r.status === "done" && r.date < today && isBloodId(r.sessionId)));
}

/** Tonight's rides already over (every row of the night done, nothing still ahead on it): the
 *  booking app keeps them on the page as a past card that says the ride is done, with the night's
 *  steps, until the day ends, marked paid or not (2026-11-10: a done ride not yet paid used to vanish until the desk
 *  marked it paid; its rows say what is still to pay). */
export function doneToday(rows: Row[], today: string): Group[] {
  const all = rows.map(ticketRow).filter((r): r is TicketRow => !!r && r.date === today);
  const live = new Set(all.filter((r) => r.status !== "done").map(groupKey));
  return grouped(all.filter((r) => r.status === "done" && !live.has(groupKey(r))));
}

/** A cancelled booking, as My Account lists it under the tickets (the booking app's _mrCxRow): its session, its day, and
 *  who cancelled it (queue_entries.cancelled_by: 'staff', 'customer', or '' when nobody knows). */
export type CancelledGroup = { key: string; sessionId: string; date: string; by: "staff" | "customer" | "" };
/** The account's cancelled bookings whose day has not gone, one per ticket, soonest first (the booking app's _mrCancelled,
 *  2026-11-10): with no email or SMS the page is the rider's only record, and a booking cancelled by the rider, or by
 *  staff (a whole session cancelled with its refunds among them), used to vanish without a word. A ticket that still
 *  has a live row (a party with one rider cancelled) is a ticket, not this. A rider turned down for a ride staff
 *  approve (approval 'rejected') is never told by this row. */
export function cancelledGroups(rows: Row[], today: string): CancelledGroup[] {
  const live = new Set(rows.map(ticketRow).filter((r): r is TicketRow => !!r).map(groupKey));
  const by = new Map<string, CancelledGroup & { who: Set<string> }>();
  for (const r of rows) {
    const date = S(r.session_date);
    if (r.status !== "cancelled" || r.approval === "rejected" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) continue;
    const sessionId = S(r.session_id) || date;
    // Victory Lap's Singles and Doubles are two tickets (groupKey); an Arena Heros place reads its own column
    const key = groupKey({ sessionId, vl: isArenaId(sessionId) ? null : vlEntry(r.vl) });
    if (live.has(key)) continue;
    const g = by.get(key) ?? { key, sessionId, date, by: "" as const, who: new Set<string>() };
    g.who.add(S(r.cancelled_by));
    by.set(key, g);
  }
  return [...by.values()]
    .map(({ who, ...g }) => ({ ...g, by: who.has("staff") ? "staff" as const : who.has("customer") ? "customer" as const : "" as const }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

/** A ride that counts as ridden (_rideCompleted): done, and paid, on a free community ride, or on
 *  the rider's own bike, which is never paid for (the booking app, 2026-10-05). */
export function rideCompleted(r: Pick<TicketRow, "status" | "paid"> & { type?: string }, free: boolean): boolean {
  return r.status === "done" && (r.paid || free || r.type === "Own");
}

/** A sessions row as the ticket reads it. */
export function ticketSession(r: Row): TicketSession | null {
  if (typeof r.id !== "string" || typeof r.session_date !== "string") return null;
  const kind = rideKind(r);
  const community = r.event_kind === "community";
  // the session's own time, or 45 minutes before the start (sessionCollectTime)
  const collect = collectTime(r.bike_slots);
  const wlCollect = wlCollectSlot(r.bike_slots);
  const meet = S(r.meet_url);
  return {
    id: r.id, date: r.session_date, kind, title: S(r.title).trim() || null,
    approval: community && r.needs_approval !== false,
    published: community && r.hide_queue === false,
    times: slotTimes(r.bike_slots),
    gathers: kind === "saturday" || kind === "snd96" || kind === "runher" || kind === "vlap",
    collect,
    ...(wlCollect !== undefined ? { wlCollect } : {}),
    meetUrl: /^https:\/\//i.test(meet) ? meet : null,
    free: community && kind !== "snd96" && r.paid_ride !== true,
    freeRide: community && r.paid_ride !== true,
    bikes: kind !== "swim" && kind !== "workshop" && kind !== "event" && kind !== "runher" && kind !== "vlap" && kind !== "defe5k" && kind !== "arena" && kind !== "blood",
    routeSlug: routeSlugOf(r.route_slug),
    location: S(r.location).trim() || null,
    breakfast: S(r.breakfast_name).trim()
      ? {
        name: S(r.breakfast_name).trim(),
        nameAr: S(r.breakfast_name_ar).trim() || null,
        url: /^https:\/\//i.test(S(r.breakfast_url)) ? S(r.breakfast_url) : null,
        offerEn: S(r.breakfast_offer_en).trim() || null,
        offerAr: S(r.breakfast_offer_ar).trim() || null,
      }
      : null,
    revealAt: Number.isFinite(Date.parse(S(r.reveal_at))) ? S(r.reveal_at) : null,
    vl: kind === "vlap" ? vlConfig(r.vl) : null,
    ah: kind === "arena" ? ahConfig(r.vl) : null,
    price: N(r.price),
    gender: sessionGender(r.gender_only),
  };
}

/** The Saturday ride's breakfast spot, and Run for Her's (the owner, 2026-10-14), told at a time staff choose (the owner, 2026-10-06, then "show the
 *  meeting point immediately only hide the breakfast spot and location"; the booking app's _spotHeld): until
 *  sessions.reveal_at, list_sessions gives the session with its breakfast stop, place and route blank and its
 *  meeting point as it is (rentals 20261006150000, 170000), so the site says when the breakfast spot is told. A
 *  session that came with it has been told. One read before the time and drawn after it (a copy kept for a minute)
 *  still says when, for REVEAL_GRACE_MS at most. */
export const REVEAL_GRACE_MS = 6 * 3600e3;
export function spotHeld(s: { revealAt?: string | null; location?: string | null; breakfast?: unknown } | undefined, now: number = Date.now()): boolean {
  const r = s?.revealAt ? Date.parse(s.revealAt) : NaN;
  if (!s || !Number.isFinite(r)) return false;
  if (s.location || s.breakfast) return false;
  return r > now || now - r < REVEAL_GRACE_MS;
}
/** Held, and the session came without its meeting point (a database before rentals 20261006170000, or none set
 *  yet; the booking app's _meetHeld): it meets at a point, unnamed, never the circuit. Not Run for Her, which
 *  always meets at the Jeddah Yacht Club (venueOf). */
export const meetHeld = (s: { kind?: string; revealAt?: string | null; meetUrl?: string | null; location?: string | null; breakfast?: unknown } | undefined, now: number = Date.now()): boolean =>
  spotHeld(s, now) && !s?.meetUrl && s?.kind !== "runher";

/** When they are told, in Riyadh time (the booking app's _revealWhen): "Tomorrow · 8 PM", "Friday · 9 Oct
 *  2026 · 8:30 PM", with the page's own words for today and tomorrow. "" without a time. */
export function revealWhen(iso: string | null | undefined, locale: string, today: string, words: { today: string; tomorrow: string }): string {
  const ms = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return "";
  const k = riyadhClock(new Date(ms)), date = k.slice(0, 10), w = dayWord(date, today);
  return `${w === "today" ? words.today : w === "tomorrow" ? words.tomorrow : fmtDayDate(date, locale)} · ${fmtClock(k.slice(11, 16), locale)}`;
}

/** The rides with a breakfast stop: the Saturday ride, and Run for Her (the owner, 2026-10-14). */
export const hasBreakfast = (kind: string | null | undefined): boolean => kind === "saturday" || kind === "runher";

/** The breakfast stop as a rider reads it: the Arabic name on the Arabic page, and the offer in
 *  Arabic there and in English in every other language (the booking app's _commInfoHtml). */
export function breakfastFor(s: TicketSession | undefined, locale: string): { name: string; url: string | null; offer: string | null } | null {
  const b = s?.breakfast;
  if (!b || !hasBreakfast(s?.kind)) return null;
  const ar = locale === "ar";
  return { name: (ar && b.nameAr) || b.name, url: b.url, offer: (ar ? b.offerAr || b.offerEn : b.offerEn || b.offerAr) || null };
}

/** What the ticket's code says: "MMC-<queue number>-<id>", or "MMC-<id>" on a ride staff approve
 *  (or one this site cannot see), which never shows a queue number. The staff scanner reads both. */
export function bookingRef(r: Pick<TicketRow, "id" | "queueNum">, s: TicketSession | undefined): string {
  const ref = r.id.slice(0, 6).replace(/[^\w-]/g, "");
  if (!s || s.approval) return ["MMC", ref].filter(Boolean).join("-");
  return ["MMC", r.queueNum != null ? String(r.queueNum) : "", ref].filter(Boolean).join("-");
}

/** The Saturday Social Ride's booking number (the owner, 2026-10-25; the booking app's _satNumOk): once
 *  staff publish the list, riders on it (approved, not waitlisted, not a partner's place) see the number
 *  staff see at the desk. Before Publish, to anyone not on the list, and on every other ride staff
 *  approve, it stays hidden. The code keeps carrying the ref alone (bookingRef). */
export function satNumOk(rows: TicketRow[], s: TicketSession | undefined): boolean {
  return !!s && s.kind === "saturday" && s.approval && s.published && rows.length > 0
    && rows.every((r) => r.approval === "approved" && !r.partner && r.status !== "waitlist");
}

/** A ride staff approve hands out no code until the rider is through: the list published, every
 *  rider on it approved. Every other ride's code is its ticket from the moment it is booked, and so
 *  is a partner's place (Defe, 2026-10-17): confirmed when booked, before the list is out. */
export function codeReady(rows: TicketRow[], s: TicketSession | undefined): boolean {
  if (s?.kind === "arena" && ahHold(rows)) return false; // no code until the place is paid (2026-11-02)
  if (!s || !s.approval) return true;
  if (partnerPlace(rows)) return true;
  return s.published && rows.every((r) => r.approval === "approved");
}

/** The partner every row of a booking was booked with (partner_book: 'defe'), else null. */
export function partnerPlace(rows: Pick<TicketRow, "partner" | "status">[]): string | null {
  const p = rows[0]?.partner;
  return p && rows.every((r) => r.partner === p && r.status !== "waitlist") ? p : null;
}

/** The line under the ticket's header, as the booking app words it. `ahead` is whether anyone
 *  still waiting on the night holds a lower number (null when unknown: the line is left out). */
export type Cue = "confirmed" | "underReview" | "pending" | "waitlist" | "onBike" | "next" | "inQueue" | null;
export function ticketCue(rows: TicketRow[], s: TicketSession | undefined, ahead: boolean | null): Cue {
  const st = rows.some((r) => r.status === "active") ? "active" : rows[0]?.status;
  if (s?.approval && (st === "waiting" || st === "waitlist")) {
    if (st === "waiting" && partnerPlace(rows)) return "confirmed"; // a partner's place: confirmed at once
    if (!s.published) return "underReview";
    if (st === "waitlist") return "waitlist";
    return rows.every((r) => r.approval === "approved") ? "confirmed" : "pending";
  }
  // checked in on a ride without bikes (the pool, the workshop, an event, Run for Her): never "On the
  // bike now" (the booking app says tkStIn there)
  if (st === "active") return s && !s.bikes ? null : "onBike";
  if (st === "waiting" && s && !s.approval && ahead !== null) return ahead ? "inQueue" : "next";
  return null;
}

/** A waitlisted rider's collection time, after the riders holding a place (the booking app's _wlCollectTime): the
 *  time staff set on the session (the owner, 2026-11-10), else on a circuit night a quarter of an hour after the start
 *  (the owner, 2026-11-03). Null on every other ride, and on a circuit night whose box staff emptied. */
export function wlCollectTime(s: TicketSession | undefined): string | null {
  if (s?.kind !== "jcc" && s?.kind !== "petromin") return null; // the rides with a bike collection time
  if (s.wlCollect !== undefined) return s.wlCollect || null;
  if (s.kind !== "jcc" || !s.times) return null;
  const m = Number(s.times[0].slice(0, 2)) * 60 + Number(s.times[0].slice(3)) + 15;
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** How the card is drawn (the booking app's tk-live / tk-wl): a place held - booked or checked in,
 *  its code out - is the night ticket, dark with neon; a waitlist place stays paper with a dashed
 *  edge; a reservation staff have not confirmed stays paper. The National Day card keeps its own. */
export function ticketLook(rows: TicketRow[], s: TicketSession | undefined): "live" | "wl" | "" {
  if (s?.kind === "snd96") return "";
  if (rows.length && rows.every((r) => r.status === "waitlist")) return "wl";
  const st = rows.some((r) => r.status === "active") ? "active" : rows[0]?.status;
  return codeReady(rows, s) && (st === "waiting" || st === "active") ? "live" : "";
}

/** "today" or "tomorrow" for a ride day (both Riyadh dates, YYYY-MM-DD), else null: _dayWord. */
export function dayWord(date: string, today: string): "today" | "tomorrow" | null {
  if (date === today) return "today";
  const t = new Date(`${today}T12:00:00Z`);
  if (Number.isNaN(t.getTime())) return null;
  t.setUTCDate(t.getUTCDate() + 1);
  return date === t.toISOString().slice(0, 10) ? "tomorrow" : null;
}

/** Where the ride is, by name (_venueName): a ride staff approve that meets at a map link is its
 *  meeting point; a night on the circuit (no place, or "JCC") the Jeddah Corniche Circuit; "JYC" the
 *  Jeddah Yacht Club, where Run for Her meets (VENUE_KEY) - Run for Her always, its place held back or
 *  not (the owner, 2026-10-14), never the circuit; any other place as staff wrote it. Arena Heros is at
 *  its venue (Gymnation, Tahlia Street) when staff named no place, never the circuit (2026-10-28), and the Blood
 *  Donation event at the circuit (the booking app's _sessLoc, 2026-11-03). */
export type Venue = { kind: "meet" } | { kind: "circuit" } | { kind: "jyc" } | { kind: "gym" } | { kind: "text"; text: string };
export function venueOf(s: (Pick<TicketSession, "approval" | "meetUrl" | "location"> & { kind?: string }) | undefined): Venue {
  if (s?.approval && s.meetUrl) return { kind: "meet" };
  const loc = s?.location || (s?.kind === "runher" ? "JYC" : s?.kind === "arena" ? AH_VENUE : s?.kind === "blood" ? "JCC" : "");
  return !loc || loc === "JCC" ? { kind: "circuit" } : loc === "JYC" ? { kind: "jyc" } : loc === AH_VENUE ? { kind: "gym" } : { kind: "text", text: loc };
}

/** The venue in the page's words (the ticket's meetingPoint, venueCircuit, venueJyc and venueGymnation; Gymnation,
 *  Tahlia Street as staff wrote it when the page has no words for it). */
export function venueText(v: Venue, t: { meetingPoint: string; venueCircuit: string; venueJyc: string; venueGymnation?: string }): string {
  return v.kind === "meet" ? t.meetingPoint : v.kind === "circuit" ? t.venueCircuit : v.kind === "jyc" ? t.venueJyc : v.kind === "gym" ? t.venueGymnation || AH_VENUE : v.text;
}

/** A ride that meets at a point staff set (sessions.meet_url) rather than at the circuit (_meetsAt):
 *  the rides staff approve, and the runs (Run for Her, the DEFE 5KM Run: the booking app's _isRun). The
 *  ticket's place button opens that point and says so ("Meeting point"), and the calendar file puts it
 *  as the place. */
export const meetsAt = (s: Pick<TicketSession, "approval" | "kind"> | undefined): boolean => !!s && (s.approval || s.kind === "runher" || s.kind === "defe5k");

/** The map a ticket's place button opens (My Account): a ride that meets at a point (meetsAt) opens that point;
 *  Arena Heros (2026-10-28), at a venue of its own, opens the venue's map staff set (sessions.meet_url), or none
 *  without one, never the circuit; every other ride, and a session that did not load, the circuit's directions
 *  (`circuit`). On Arena Heros the button says "Get directions": it is the venue, not a meeting point. The Blood
 *  Donation event (2026-11-03) opens the map on its row (sessions.meet_url), else the circuit's directions: it is at
 *  the circuit whichever, so never "Meeting point". */
export function placeLink(s: (Pick<TicketSession, "approval" | "kind" | "meetUrl"> & { location?: string | null }) | undefined, circuit: string | null): string | null {
  if (s && meetsAt(s)) return s.meetUrl;
  if (s?.kind === "arena") return s.meetUrl;
  if (s?.kind === "blood") return s.meetUrl ?? circuit;
  // Any other named place is searched by its name (the booking app's _dirBtnHtml, 2026-11-10): every booking away from
  // the circuit used to open the circuit's directions.
  const loc = s?.location?.trim();
  if (loc && loc !== "JCC") return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ICS_PLACES.get(loc) ?? loc)}`;
  return circuit;
}

/** The booth at the circuit, where riders collect their bikes (the booking app's _BOOTH_PINS.JCC): a ticket's Directions
 *  opens it as a Google Maps directions link, which the phone hands to its Maps app; on an iPhone or iPad the rider is
 *  offered Apple Maps beside it (TicketDir, 2026-11-10). It was the circuit's own map link, which led to the gate. */
export const BOOTH_PIN = "21.624565,39.106812";
export const BOOTH_DIR = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(BOOTH_PIN)}`;
export const BOOTH_APPLE = `https://maps.apple.com/?daddr=${encodeURIComponent(BOOTH_PIN)}&dirflg=d`;

/** Today's code drawn large under the number (the booking app's _bigQr, 2026-11-10): on the ride's day the code is what
 *  the desk needs, so a held place, a rider checked in and a waitlisted one (who brings the same code when a place opens)
 *  show it at 224px; before the day the corner size is enough, the scanner refuses any other day. The page keeps the
 *  phone awake while one is on it (TicketWake). */
export function todayCode(rows: TicketRow[], s: TicketSession | undefined, today: string, past = false): boolean {
  const st = rows.some((r) => r.status === "active") ? "active" : rows[0]?.status;
  return !past && rows[0]?.date === today && codeReady(rows, s) && (st === "waiting" || st === "active" || st === "waitlist");
}

/** What a ticket's Share sends as its link (the booking app's _tkShareUrl): the booking app's page for the same date
 *  (/reserve?ev=&session=), or its front page for a ride that is not booked from a list everyone sees (a members' ride,
 *  a Petromin night, the donation event: `ev` 'community', 'petromin', 'blood' or none). Null when the app's address
 *  cannot be read. */
export function shareLink(app: string, ev: string | undefined, sessionId: string): string | null {
  try {
    if (!ev || ev === "community" || ev === "petromin" || ev === "blood") return new URL("/", app).toString();
    const u = new URL("/reserve", app);
    u.searchParams.set("ev", ev);
    u.searchParams.set("session", sessionId);
    return u.toString();
  } catch { return null; }
}

// ── The DEFE 5KM Run (the owner, 2026-10-18; the booking app's _defeRegHtml) ─────────────────────
/** Where the race itself is entered: Defe's own registration page (the booking app's DEFE_RACE_URL, word for word;
 *  the owner, 2026-10-18). */
export const DEFE_RACE_URL = "https://in.njuko.com/defe5k?utm_id=97760_v0_s00_e0_tv5";
/** The discount code members use there: 50% off, for the first 50 members (the booking app's DEFE_RACE_CODE). */
export const DEFE_RACE_CODE = "MICRO50";
/** The DEFE 5KM Run, by the session's kind. */
export const isDefe = (s: Pick<TicketSession, "kind"> | undefined): boolean => s?.kind === "defe5k";
/** Whether a booked Defe place still asks "Have you registered for the race?": a live row (waiting, on the
 *  waitlist or checked in, never done; cancelled and no-show rows are never on a ticket) on the DEFE 5KM
 *  Run whose day has not passed (Riyadh). The place is booked whatever the answer. */
export const raceRegAsked = (r: Pick<TicketRow, "status" | "date"> | undefined, s: Pick<TicketSession, "kind"> | undefined, today: string): boolean =>
  !!r && isDefe(s) && r.status !== "done" && r.date >= today;

// ── The ride night on the ticket (the booking app's 2026-10-01 round, 91816da) ─────────────

/** A moment of the ride's day in Riyadh, as epoch milliseconds (_ksaAt). */
export function ksaAt(date: string, hhmm: string | null): number {
  const m = hhmm ? /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim()) : null;
  return m ? Date.parse(`${date}T00:00:00+03:00`) + (Number(m[1]) * 60 + Number(m[2])) * 6e4 : NaN;
}

/** What today's ticket counts down to (_cdAttr): the gathering then the start on a ride that
 *  gathers; else bike collection (a ride with bikes) then the start. */
export type CdKey = "collect" | "gather" | "start";
export function countdownMoments(s: TicketSession | undefined, date: string): [number, CdKey][] {
  if (!s?.times) return [];
  const out: [number, CdKey][] = s.gathers
    ? [[ksaAt(date, s.times[0]), "gather"], [ksaAt(date, s.times[1]), "start"]]
    : [...(s.bikes ? [[ksaAt(date, s.collect), "collect"] as [number, CdKey]] : []), [ksaAt(date, s.times[0]), "start"]];
  return out.filter((x) => Number.isFinite(x[0]));
}

/** The countdown's line at `now`: the first moment still ahead and the minutes to it (at least
 *  1), or null once the start has passed (_cdLine). */
export function countdownAt(moments: [number, CdKey][], now: number): { key: CdKey; min: number } | null {
  for (const [at, key] of moments) if (at > now) return { key, min: Math.max(1, Math.ceil((at - now) / 6e4)) };
  return null;
}

/** The countdown's words: "Starts in {0}" and the like, and the hours and minutes ("{h} h {m} min"). */
export type CountdownText = { collect: string; gather: string; start: string; h: string; hm: string; m: string };

/** The countdown's line at `now` in the page's words, or "" once the start has passed. Plain logic:
 *  the ticket (a server component) asks it whether to draw the countdown, the countdown (in the
 *  browser) redraws it - so it lives here, not in the client component, which the server cannot call. */
export function cdLine(moments: [number, CdKey][], now: number, t: CountdownText): string {
  const c = countdownAt(moments, now);
  if (!c) return "";
  const h = Math.floor(c.min / 60), m = c.min % 60;
  const d = h ? (m ? fillNamed(t.hm, { h, m }) : fillNamed(t.h, { h })) : fillNamed(t.m, { m });
  return fillAt(t[c.key], d);
}

/** Where the rider is on the ride's day (_tkStages): Booked, Checked in, On the bike (only where
 *  there are bikes), Done, read off the rows as the desk wrote them. `sub` is the check-in time,
 *  the bike's name while out, or the return time (Riyadh clock). */
export type Stage = { key: "booked" | "in" | "bike" | "done"; on: boolean; sub: string };
export function ticketStages(rows: TicketRow[], bikes: boolean, bikeName: string | null, locale: string): { stages: Stage[]; cur: number } {
  const inn = rows.some((r) => r.status === "active" || r.status === "done");
  const done = rows.length > 0 && rows.every((r) => r.status === "done");
  const ins = rows.map((r) => r.checkedInAt).filter((x): x is string => !!x).sort();
  const outs = rows.map((r) => r.checkedOutAt).filter((x): x is string => !!x).sort();
  const hm = (iso: string | undefined) => {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat(locale === "en" ? "en-US" : intlOf(locale), { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
    } catch { return ""; }
  };
  const handed = rows.some((r) => !!r.bikeId); // a bike the public key cannot name still counts
  const stages: Stage[] = [
    { key: "booked", on: true, sub: "" },
    { key: "in", on: inn, sub: hm(ins[0]) },
    ...(bikes ? [{ key: "bike" as const, on: done || (inn && handed), sub: bikeName && !done ? bikeName : "" }] : []),
    { key: "done", on: done, sub: done ? hm(outs[outs.length - 1]) : "" },
  ];
  return { stages, cur: stages.reduce((c, x, i) => (x.on ? i : c), 0) };
}

/** The route a ride follows, for its ticket (_rideRoute): a route on the Routes page by its slug,
 *  or, for a bike ride on the circuit with none of its own, the Jeddah Corniche Circuit itself
 *  (6.174 km a lap, drawn on the ticket). Nothing for a ride without bikes, or one that meets at
 *  a map link without a route. */
export type RouteItem = { name: string; km: number; level: string; surface: string; href: string };
export type TicketRoute = { name: string | null; km: number; lap: boolean; note: string | null; href: string | null; track: boolean };
export function ticketRoute(s: TicketSession | undefined, routes: Map<string, RouteItem>, now: number = Date.now()): TicketRoute | null {
  if (!s || !s.bikes || spotHeld(s, now)) return null; // where it goes is told with the breakfast spot
  if (s.routeSlug) {
    const r = routes.get(s.routeSlug);
    if (!r) return null;
    return { name: r.name, km: r.km > 0 ? r.km : 0, lap: false, note: [r.level, r.surface].filter(Boolean).join(" · ") || null, href: /^https:\/\//i.test(r.href) ? r.href : null, track: false };
  }
  if (s.approval && s.meetUrl) return null;
  if (s.location && s.location !== "JCC") return null;
  return { name: null, km: 6.174, lap: true, note: null, href: null, track: true };
}

/** "6.17" - a distance as the ticket writes it (_kmTxt). */
export const kmText = (km: number) => String(Math.round(km * 100) / 100);

/** "#4", "#4 – #5" or "#4, #7". */
export function queueNumbers(rows: TicketRow[]): string {
  const nums = rows.map((r) => r.queueNum).filter((n): n is number => n != null);
  if (!nums.length) return "";
  if (nums.length === 1) return `#${nums[0]}`;
  const consecutive = nums.every((q, i) => i === 0 || q === nums[i - 1] + 1);
  return consecutive ? `#${nums[0]} – #${nums[nums.length - 1]}` : nums.map((q) => `#${q}`).join(", ");
}

/** A time of day as the rider reads it: "9 PM" / "5:45 AM" in English, as the booking app writes
 *  it; every other language in its own clock (Latin digits, as everywhere on the site). */
export function fmtClock(hhmm: string, locale: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const d = new Date(Date.UTC(2000, 0, 1, Number(m[1]), Number(m[2])));
  const en = locale === "en";
  try {
    return new Intl.DateTimeFormat(en ? "en-US" : intlOf(locale), {
      hour: "numeric", minute: en && m[2] === "00" ? undefined : "2-digit", timeZone: "UTC", ...(en ? { hour12: true } : {}),
    }).format(d);
  } catch { return hhmm; }
}

/** "Sunday · 26 Sept 2026", the booking app's day and date. */
export function fmtDayDate(iso: string, locale: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { ...o, timeZone: "UTC" }).format(d);
  return `${f({ weekday: "long" })} · ${f({ day: "numeric", month: "short", year: "numeric" })}`;
}

/** Where the calendar file says the ride is (downloadBookingICS's LOCATION): a ride that meets at a
 *  map link (meetsAt: one staff approve, or Run for Her), that link; else the place staff wrote, with
 *  the three the booking app spells out for a calendar ("JCC", "Sharafeyah Branch", "JYC"); "" for
 *  none, which icsFor writes as the circuit; Run for Her without its place (held back) the Jeddah Yacht Club. */
const ICS_PLACES = new Map([["JCC", "Jeddah Corniche Circuit"], ["Sharafeyah Branch", "Sharafeyah, Jeddah"], ["JYC", "Jeddah Yacht Club"]]);
export function icsPlace(s: TicketSession): string {
  if (meetsAt(s) && s.meetUrl) return s.meetUrl;
  const loc = s.location || (s.kind === "runher" ? "JYC" : s.kind === "arena" ? AH_VENUE : s.kind === "blood" ? "JCC" : "");
  return loc ? ICS_PLACES.get(loc) ?? loc : "";
}

/** The ride's start and end, in minutes from the start of its day (Riyadh), as the booking app's
 *  calendar file has them: its window, or on a ride that gathers, from the gathering to two hours
 *  after the start; an end past midnight is on the next day (over 1440). A session with a start time
 *  alone (the DEFE 5KM Run) runs two hours from it. Null without times. */
function rideWindow(s: Pick<TicketSession, "times" | "gathers">): [number, number] | null {
  if (!s.times) return null;
  const [a, b] = s.times.map((t) => t.split(":").map(Number));
  const sMin = a[0] * 60 + a[1];
  let eMin = (b[0] + (s.gathers || oneTime(s.times) ? 2 : 0)) * 60 + b[1];
  if (eMin <= sMin) eMin += 1440;
  return [sMin, eMin];
}

/** When the ride is over (epoch milliseconds): its end as the calendar file has it, or the end of
 *  its day when it has no times. The live map stops asking a while after it. */
export function rideEndsAt(s: Pick<TicketSession, "date" | "times" | "gathers">): number {
  const w = rideWindow(s);
  return Date.parse(`${s.date}T00:00:00+03:00`) + (w ? w[1] : 1440) * 6e4;
}

/** What the calendar file says the booking is: a bike rental only where bikes are handed out (the
 *  booking app's icsDesc*, 2026-10-05: every entry said "bike rental", the swim and the workshop
 *  included). Run for Her, which gathers and has no bike, is met at its meeting point; the pool, the
 *  workshop and an event are a booking to turn up for. */
function icsWords(s: Pick<TicketSession, "bikes" | "gathers">): { desc: string; alarm: string } {
  if (s.bikes) return { desc: "Your MicroMobility bike rental booking. Arrive 10 minutes early and show your ticket at the desk.", alarm: "MicroMobility ride reminder" };
  return {
    desc: s.gathers
      ? "Your MicroMobility booking. Be at the meeting point by the gathering time and show your ticket there."
      : "Your MicroMobility booking. Arrive 10 minutes early and show your ticket when you arrive.",
    alarm: "MicroMobility booking reminder",
  };
}

/** The calendar file the booking app's Add to Calendar gives (downloadBookingICS): a window, or
 *  on a ride that gathers, from the gathering to two hours after the start; a window that runs
 *  past midnight ends on the next day. One event per booking that stays one event (the booking app's _icsBody,
 *  2026-11-10): its UID is the booking's (it was the session's and the moment, so every tap added another copy and no
 *  change could find the first), SEQUENCE grows with every file, so a calendar that knows the event keeps the newer one,
 *  and URL leads back to the booking app's My Bookings (`booking.url`). */
export function icsFor(s: TicketSession, summary: string, place: string, now: Date = new Date(), booking: { id?: string; url?: string | null } = {}): string {
  const date = s.date.replace(/-/g, "");
  const [sMin, eMin] = rideWindow(s) ?? [540, 660];
  // The ride's hour is Jeddah's: written without a zone, a calendar read it in the phone's own (a
  // phone set to London put a 21:00 ride at 21:00 London). So the times go out in UTC, as the booking
  // app's do since 2026-10-04 (KSA is UTC+3 all year); minutes past 1440 land on the next day.
  const utc = (min: number) => new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8), 0, min - 180)).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const esc = (v: string) => v.replace(/[\\,;]/g, (x) => `\\${x}`).replace(/\n/g, "\\n");
  const stamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const words = icsWords(s);
  // the breakfast spot told later: the entry says when; a held ride without its meeting point has no place rather than the circuit
  const told = spotHeld(s, now.getTime()) ? `\n\nBreakfast spot: announced ${revealWhen(s.revealAt, "en", riyadhClock(now).slice(0, 10), { today: "Today", tomorrow: "Tomorrow" })}` : "";
  const noPlace = meetHeld(s, now.getTime());
  const bid = (booking.id ?? "").replace(/[^\w-]/g, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MicroMobility//Bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${bid ? `booking-${bid}` : `session-${s.id.replace(/[^\w-]/g, "")}`}@micromobility.sa`, `SEQUENCE:${Math.floor(now.getTime() / 1000)}`, `DTSTAMP:${stamp}`,
    `DTSTART:${utc(sMin)}`, `DTEND:${utc(eMin)}`,
    `SUMMARY:${esc(summary)}`, ...(noPlace ? [] : [`LOCATION:${esc(place || "Jeddah Corniche Circuit")}`]),
    `DESCRIPTION:${esc(words.desc + told)}`,
    ...(booking.url && /^https:\/\//i.test(booking.url) ? [`URL:${booking.url}`] : []),
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${esc(words.alarm)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
