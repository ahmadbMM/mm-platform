// The booking app's ticket, as the website shows it on My Account: the same card, the same rules
// (renderBookingTicket, bookingRef, downloadBookingICS in the rentals app), read from the rows the
// account's own my_bookings returns. Plain logic here, so it can be tested; the card is
// components/booking/TicketCard.tsx.
import { intlOf } from "@/i18n/locales";
import { rideKind, routeSlugOf, slotTimes, type RideKind } from "./rides";

export type TicketStatus = "waiting" | "waitlist" | "active";
export type TicketRow = {
  id: string; sessionId: string; date: string; day: string; queueNum: number | null; status: TicketStatus;
  waitlistNum: number | null; approval: string | null; price: number; paid: boolean; name: string; type: string;
};
export type TicketSession = {
  id: string; date: string; kind: RideKind; title: string | null;
  /** A ride staff approve (community, needs_approval not false): no queue number, and no code until the list is out. */
  approval: boolean;
  /** Its rider list is published (hide_queue false). */
  published: boolean;
  times: [string, string] | null;
  /** The two times are "gathering - start" (the rides that gather: Saturday, National Day), not a
   *  window; the pool and the workshop are a plain start - end, as in the booking app. */
  gathers: boolean;
  /** Bikes are handed out from this time (the circuit's _collect). */
  collect: string | null;
  meetUrl: string | null;
  free: boolean;
  /** The ride has bikes to hand out (not the pool, not the workshop, not a ticketed event). */
  bikes: boolean;
  /** The route the ride follows (an item's slug on the Routes page), or null. */
  routeSlug: string | null;
  /** Where staff said the ride is (sessions.location): "JCC", a place's name, or null (the circuit). */
  location: string | null;
};

type Row = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

/** The account's live bookings still ahead (today, Riyadh, and later), one list per session,
 *  soonest first - the booking app's Current & upcoming. */
export function ticketGroups(rows: Row[], today: string): { sessionId: string; date: string; rows: TicketRow[] }[] {
  const by = new Map<string, { sessionId: string; date: string; rows: TicketRow[] }>();
  for (const r of rows) {
    const status = r.status === "waiting" || r.status === "waitlist" || r.status === "active" ? r.status : null;
    const date = S(r.session_date);
    if (!status || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) continue;
    const sessionId = S(r.session_id) || date;
    const g = by.get(sessionId) ?? { sessionId, date, rows: [] };
    g.rows.push({
      id: S(r.id), sessionId, date, day: S(r.session_day), queueNum: N(r.queue_num), status,
      waitlistNum: N(r.waitlist_num), approval: S(r.approval) || null, price: N(r.price) ?? 0, paid: r.paid === true,
      name: S(r.name), type: S(r.type_preference),
    });
    by.set(sessionId, g);
  }
  for (const g of by.values()) g.rows.sort((a, b) => (a.queueNum ?? 0) - (b.queueNum ?? 0));
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));
}

/** A sessions row as the ticket reads it. */
export function ticketSession(r: Row): TicketSession | null {
  if (typeof r.id !== "string" || typeof r.session_date !== "string") return null;
  const kind = rideKind(r);
  const community = r.event_kind === "community";
  let collect: string | null = null;
  try {
    const o = typeof r.bike_slots === "string" ? JSON.parse(r.bike_slots) : r.bike_slots;
    const c = o && typeof o === "object" ? (o as Record<string, unknown>)._collect : null;
    if (typeof c === "string" && /^\d{1,2}:\d{2}$/.test(c.trim())) collect = c.trim().padStart(5, "0");
  } catch { /* no collect time */ }
  const meet = S(r.meet_url);
  return {
    id: r.id, date: r.session_date, kind, title: S(r.title).trim() || null,
    approval: community && r.needs_approval !== false,
    published: community && r.hide_queue === false,
    times: slotTimes(r.bike_slots),
    gathers: kind === "saturday" || kind === "snd96",
    collect,
    meetUrl: /^https:\/\//i.test(meet) ? meet : null,
    free: community && kind !== "snd96" && r.paid_ride !== true,
    bikes: kind !== "swim" && kind !== "workshop" && kind !== "event",
    routeSlug: routeSlugOf(r.route_slug),
    location: S(r.location).trim() || null,
  };
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
 *  meeting point; a night on the circuit (no place, or "JCC") the Jeddah Corniche Circuit; any
 *  other place as staff wrote it. */
export function venueOf(s: TicketSession | undefined): { kind: "meet" } | { kind: "circuit" } | { kind: "text"; text: string } {
  if (s?.approval && s.meetUrl) return { kind: "meet" };
  const loc = s?.location ?? "";
  return !loc || loc === "JCC" ? { kind: "circuit" } : { kind: "text", text: loc };
}

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

/** The calendar file the booking app's Add to Calendar gives (downloadBookingICS): a window, or
 *  on a ride that gathers, from the gathering to two hours after the start; a window that runs
 *  past midnight ends on the next day. */
export function icsFor(s: TicketSession, summary: string, place: string, now: Date = new Date()): string {
  const date = s.date.replace(/-/g, "");
  const pad = (n: number) => String(n).padStart(2, "0");
  let st = "090000", en = "110000", enDate = date;
  if (s.times) {
    const [a, b] = s.times.map((t) => t.split(":").map(Number));
    st = `${pad(a[0])}${pad(a[1])}00`;
    const sMin = a[0] * 60 + a[1];
    let eMin = (b[0] + (s.gathers ? 2 : 0)) * 60 + b[1];
    if (eMin <= sMin) eMin += 1440;
    const dayOff = Math.floor(eMin / 1440);
    eMin %= 1440;
    en = `${pad(Math.floor(eMin / 60))}${pad(eMin % 60)}00`;
    if (dayOff) enDate = new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8) + dayOff)).toISOString().slice(0, 10).replace(/-/g, "");
  }
  const esc = (v: string) => v.replace(/[\\,;]/g, (x) => `\\${x}`).replace(/\n/g, "\\n");
  const stamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MicroMobility//Corniche Circuit//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${s.id}-${now.getTime()}@micromobility`, `DTSTAMP:${stamp}`,
    // Floating local times, as the booking app writes them: the ride is at that hour in Jeddah.
    `DTSTART:${date}T${st}`, `DTEND:${enDate}T${en}`,
    `SUMMARY:${esc(summary)}`, `LOCATION:${esc(place || "Jeddah Corniche Circuit")}`,
    `DESCRIPTION:${esc("Your MicroMobility bike rental booking. Arrive 10 minutes early and show your ticket at the desk.")}`,
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:MicroMobility ride reminder", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
