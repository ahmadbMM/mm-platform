// The booking app's ticket, as the website shows it on My Account: the same card, the same rules
// (renderBookingTicket, bookingRef, downloadBookingICS in the rentals app), read from the rows the
// account's own my_bookings returns. Plain logic here, so it can be tested; the card is
// components/booking/TicketCard.tsx.
import { intlOf } from "@/i18n/locales";
import { fill as fillAt } from "@/i18n/tx";
import { fill as fillNamed } from "./fill";
import { collectTime, rideKind, routeSlugOf, slotTimes, type RideKind } from "./rides";

export type TicketStatus = "waiting" | "waitlist" | "active" | "done";
/** An add-on line on a booking (the booking app's entryAddons): the inventory item, how many, and
 *  `p`, the price each was sold at when the database stamped it (rentals 20261004120000), else null. */
export type TicketAddon = { id: string; qty: number; p: number | null };
export type TicketRow = {
  id: string; sessionId: string; date: string; day: string; queueNum: number | null; status: TicketStatus;
  waitlistNum: number | null; approval: string | null; price: number; paid: boolean; name: string; type: string;
  /** The desk's check-in and return (ISO), the minutes it timed on the bike, and the bike handed over. */
  checkedInAt: string | null; checkedOutAt: string | null; rideDuration: number | null; bikeId: string | null;
  /** The add-ons bought with the booking. */
  addonLines: TicketAddon[];
  /** The distance a Run for Her runner picked (queue_entries.run_km: 3 or 5 km), else null. Never
   *  a bike type: `type` stays the row's own ('None' on a run). */
  runKm: number | null;
};
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
  return {
    id: S(r.id), sessionId: S(r.session_id) || date, date, day: S(r.session_day), queueNum: N(r.queue_num), status,
    waitlistNum: N(r.waitlist_num), approval: S(r.approval) || null, price: N(r.price) ?? 0, paid: r.paid === true,
    name: S(r.name), type: S(r.type_preference),
    checkedInAt: S(r.checked_in_at) || null, checkedOutAt: S(r.checked_out_at) || null, rideDuration: N(r.ride_duration), bikeId: bike || null,
    addonLines: entryAddons(r.addons),
    runKm: km !== null && RUN_KMS.includes(km) ? km : null,
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
export type AddonLine = { rowId: string; rider: string; name: string; qty: number; amount: number | null };
const r2 = (n: number) => Math.round(n * 100) / 100;
export function addonLines(rows: Pick<TicketRow, "id" | "name" | "addonLines">[], items: Map<string, AddonItem> | null): AddonLine[] {
  return rows.flatMap((r) => r.addonLines.map((a) => {
    const it = items?.get(a.id);
    const each = a.p ?? it?.price ?? null;
    return { rowId: r.id, rider: r.name, name: it?.name || a.id, qty: a.qty, amount: each === null ? null : r2(each * a.qty) };
  }));
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

type Group = { sessionId: string; date: string; rows: TicketRow[] };
const grouped = (list: TicketRow[]): Group[] => {
  const by = new Map<string, Group>();
  for (const r of list) {
    const g = by.get(r.sessionId) ?? { sessionId: r.sessionId, date: r.date, rows: [] };
    g.rows.push(r);
    by.set(r.sessionId, g);
  }
  for (const g of by.values()) g.rows.sort((a, b) => (a.queueNum ?? 0) - (b.queueNum ?? 0));
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));
};

/** The account's live bookings still ahead (today, Riyadh, and later), one list per session,
 *  soonest first - the booking app's Current & upcoming. */
export function ticketGroups(rows: Row[], today: string): Group[] {
  return grouped(rows.map(ticketRow).filter((r): r is TicketRow => !!r && r.status !== "done" && r.date >= today));
}

/** Tonight's rides already over (every row of the night done, nothing still ahead on it): the
 *  booking app keeps them on the page as a past card that says the ride is done, with the night's
 *  steps, until the day ends. Whether each counts as ridden (rideCompleted) needs the session. */
export function doneToday(rows: Row[], today: string): Group[] {
  const all = rows.map(ticketRow).filter((r): r is TicketRow => !!r && r.date === today);
  const live = new Set(all.filter((r) => r.status !== "done").map((r) => r.sessionId));
  return grouped(all.filter((r) => r.status === "done" && !live.has(r.sessionId)));
}

/** A ride that counts as ridden (_rideCompleted): done, and paid or on a free community ride. */
export function rideCompleted(r: Pick<TicketRow, "status" | "paid">, free: boolean): boolean {
  return r.status === "done" && (r.paid || free);
}

/** A sessions row as the ticket reads it. */
export function ticketSession(r: Row): TicketSession | null {
  if (typeof r.id !== "string" || typeof r.session_date !== "string") return null;
  const kind = rideKind(r);
  const community = r.event_kind === "community";
  // the session's own time, or 45 minutes before the start (sessionCollectTime)
  const collect = collectTime(r.bike_slots);
  const meet = S(r.meet_url);
  return {
    id: r.id, date: r.session_date, kind, title: S(r.title).trim() || null,
    approval: community && r.needs_approval !== false,
    published: community && r.hide_queue === false,
    times: slotTimes(r.bike_slots),
    gathers: kind === "saturday" || kind === "snd96" || kind === "runher",
    collect,
    meetUrl: /^https:\/\//i.test(meet) ? meet : null,
    free: community && kind !== "snd96" && r.paid_ride !== true,
    freeRide: community && r.paid_ride !== true,
    bikes: kind !== "swim" && kind !== "workshop" && kind !== "event" && kind !== "runher",
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
  };
}

/** The breakfast stop as a rider reads it: the Arabic name on the Arabic page, and the offer in
 *  Arabic there and in English in every other language (the booking app's _commInfoHtml). */
export function breakfastFor(s: TicketSession | undefined, locale: string): { name: string; url: string | null; offer: string | null } | null {
  const b = s?.breakfast;
  if (!b || s?.kind !== "saturday") return null;
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

/** A ride staff approve hands out no code until the rider is through: the list published, every
 *  rider on it approved. Every other ride's code is its ticket from the moment it is booked. */
export function codeReady(rows: TicketRow[], s: TicketSession | undefined): boolean {
  if (!s || !s.approval) return true;
  return s.published && rows.every((r) => r.approval === "approved");
}

/** The line under the ticket's header, as the booking app words it. `ahead` is whether anyone
 *  still waiting on the night holds a lower number (null when unknown: the line is left out). */
export type Cue = "confirmed" | "underReview" | "pending" | "waitlist" | "onBike" | "next" | "inQueue" | null;
export function ticketCue(rows: TicketRow[], s: TicketSession | undefined, ahead: boolean | null): Cue {
  const st = rows.some((r) => r.status === "active") ? "active" : rows[0]?.status;
  if (s?.approval && (st === "waiting" || st === "waitlist")) {
    if (!s.published) return "underReview";
    if (st === "waitlist") return "waitlist";
    return rows.every((r) => r.approval === "approved") ? "confirmed" : "pending";
  }
  if (st === "active") return "onBike";
  if (st === "waiting" && s && !s.approval && ahead !== null) return ahead ? "inQueue" : "next";
  return null;
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
 *  Jeddah Yacht Club, where Run for Her meets (VENUE_KEY); any other place as staff wrote it. */
export type Venue = { kind: "meet" } | { kind: "circuit" } | { kind: "jyc" } | { kind: "text"; text: string };
export function venueOf(s: Pick<TicketSession, "approval" | "meetUrl" | "location"> | undefined): Venue {
  if (s?.approval && s.meetUrl) return { kind: "meet" };
  const loc = s?.location ?? "";
  return !loc || loc === "JCC" ? { kind: "circuit" } : loc === "JYC" ? { kind: "jyc" } : { kind: "text", text: loc };
}

/** The venue in the page's words (the ticket's meetingPoint, venueCircuit and venueJyc). */
export function venueText(v: Venue, t: { meetingPoint: string; venueCircuit: string; venueJyc: string }): string {
  return v.kind === "meet" ? t.meetingPoint : v.kind === "circuit" ? t.venueCircuit : v.kind === "jyc" ? t.venueJyc : v.text;
}

/** A ride that meets at a point staff set (sessions.meet_url) rather than at the circuit (_meetsAt):
 *  the rides staff approve, and Run for Her. The ticket's place button opens that point and says
 *  so ("Meeting point"), and the calendar file puts it as the place. */
export const meetsAt = (s: Pick<TicketSession, "approval" | "kind"> | undefined): boolean => !!s && (s.approval || s.kind === "runher");

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
export function ticketRoute(s: TicketSession | undefined, routes: Map<string, RouteItem>): TicketRoute | null {
  if (!s || !s.bikes) return null;
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
 *  none, which icsFor writes as the circuit. */
const ICS_PLACES = new Map([["JCC", "Jeddah Corniche Circuit"], ["Sharafeyah Branch", "Sharafeyah, Jeddah"], ["JYC", "Jeddah Yacht Club"]]);
export function icsPlace(s: TicketSession): string {
  if (meetsAt(s) && s.meetUrl) return s.meetUrl;
  return s.location ? ICS_PLACES.get(s.location) ?? s.location : "";
}

/** The ride's start and end, in minutes from the start of its day (Riyadh), as the booking app's
 *  calendar file has them: its window, or on a ride that gathers, from the gathering to two hours
 *  after the start; an end past midnight is on the next day (over 1440). Null without times. */
function rideWindow(s: Pick<TicketSession, "times" | "gathers">): [number, number] | null {
  if (!s.times) return null;
  const [a, b] = s.times.map((t) => t.split(":").map(Number));
  const sMin = a[0] * 60 + a[1];
  let eMin = (b[0] + (s.gathers ? 2 : 0)) * 60 + b[1];
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
 *  past midnight ends on the next day. */
export function icsFor(s: TicketSession, summary: string, place: string, now: Date = new Date()): string {
  const date = s.date.replace(/-/g, "");
  const [sMin, eMin] = rideWindow(s) ?? [540, 660];
  // The ride's hour is Jeddah's: written without a zone, a calendar read it in the phone's own (a
  // phone set to London put a 21:00 ride at 21:00 London). So the times go out in UTC, as the booking
  // app's do since 2026-10-04 (KSA is UTC+3 all year); minutes past 1440 land on the next day.
  const utc = (min: number) => new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8), 0, min - 180)).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const esc = (v: string) => v.replace(/[\\,;]/g, (x) => `\\${x}`).replace(/\n/g, "\\n");
  const stamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const words = icsWords(s);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MicroMobility//Corniche Circuit//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${s.id}-${now.getTime()}@micromobility`, `DTSTAMP:${stamp}`,
    `DTSTART:${utc(sMin)}`, `DTEND:${utc(eMin)}`,
    `SUMMARY:${esc(summary)}`, `LOCATION:${esc(place || "Jeddah Corniche Circuit")}`,
    `DESCRIPTION:${esc(words.desc)}`,
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${esc(words.alarm)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
