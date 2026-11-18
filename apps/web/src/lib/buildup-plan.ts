import { rideKind, type RideKind } from "./rides";
import { sessionGender, type SessionGender } from "./session-gender";

// The Build-up plan in a member's area on /club, as the booking app's Community tab draws it (member-hub.js _bupHtml,
// rentals 239b4538 and 36051d1a, 2026-11-18; the user: "When a member books a big event (T100, Victory Lap and the like),
// the tab counts down the Saturdays left and suggests which ones to book. It ticks each one off once they've ridden it.
// It builds on Plan my Saturdays."). Staff mark the event with the session forms' Build-up plan switch (bike_slots._bup,
// never on a Saturday ride; no column, no migration). For the member's nearest place held on a marked date still to come
// (waiting or checked in; never waitlisted or cancelled), one card: the event's name and date, the Saturdays to go (from
// today, today too on a Saturday, to the day before it), then one row per Saturday from the later of the booking's day
// and eight weeks before the event (the last eight at most): Done with a tick (a Saturday ride finished, or checked in on
// a day gone), the date dimmed (gone, not ridden), Booked, On the waitlist, Book (a ride the member may book now: open,
// not full, its booking window open, for their gender; members book it even while members book first, as the app's
// _bwOpen(s, 1) lets them), Fully booked, Cancelled (every session that day called off), the date alone, dimmed (every
// ride that day is for the other gender, so none will open to this member; bug hunt 2026-11-18, cf-platform1-2) or Not
// open yet (nothing for them that day yet, or not open yet). With no
// Saturday left before the event there is no card, so it never says 0 and is gone on the event's own day. The card's
// words never call the event a ride: it may be a run or a race.
// Plain logic, so it can be tested; lib/member-hub-server.ts reads the member's bookings (my_bookings) and the sessions
// (list_sessions for the account) and hands them in.

const S = (v: unknown) => (typeof v === "string" ? v : "");
const DAY = /^\d{4}-\d\d-\d\d$/;
const ymd = (v: unknown) => S(v).slice(0, 10);

/** A day n days after `d` ("YYYY-MM-DD"). */
export function dayPlus(d: string, n: number): string {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** The Saturdays from `from` to `to`, both included (the app's _bupSats). */
export function saturdays(from: string, to: string): string[] {
  if (!DAY.test(from) || !DAY.test(to)) return [];
  const out: string[] = [];
  for (let d = dayPlus(from, (13 - new Date(`${from}T12:00:00Z`).getUTCDay()) % 7); d <= to; d = dayPlus(d, 7)) out.push(d);
  return out;
}

/** A timestamp's day in Riyadh (the app's _ksaYmd), "" for none. */
export function ksaDay(at: unknown): string {
  const ms = Date.parse(S(at));
  return Number.isFinite(ms) ? new Date(ms + 108e5).toISOString().slice(0, 10) : "";
}

/** One of the member's own bookings (a my_bookings row), as the card reads it. */
export type BupBooking = { sessionId: string; status: string; registeredAt: string };
export const bupBookings = (rows: unknown[]): BupBooking[] => rows
  .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
  .map((r) => ({ sessionId: S(r.session_id), status: S(r.status), registeredAt: S(r.registered_at) }))
  .filter((b) => !!b.sessionId);

/** A session as the card reads it (a list_sessions row). */
export type BupSession = {
  id: string; date: string; kind: RideKind; status: string; title: string | null; titleAr: string | null;
  bup: boolean; fbk: boolean; cancelled: boolean; draft: boolean; gender: SessionGender | null;
};
function slots(v: unknown): Record<string, unknown> {
  let o: unknown = v;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  return o && typeof o === "object" ? (o as Record<string, unknown>) : {};
}
export function bupSession(r: Record<string, unknown>): BupSession | null {
  const date = ymd(r.session_date);
  if (!S(r.id) || !DAY.test(date)) return null;
  const sl = slots(r.bike_slots), t = S(r.title).trim(), ta = S(r.title_ar).trim();
  return {
    id: S(r.id), date, kind: rideKind(r), status: S(r.status), title: t || null, titleAr: ta || null,
    bup: !!sl._bup, fbk: !!sl._fbk, cancelled: r.cancelled_at != null && r.cancelled_at !== "", draft: r.draft === true,
    gender: sessionGender(r.gender_only),
  };
}

/** The event the card is for: the member's nearest place held (waiting or checked in) on a session staff marked, still
 *  to come and not called off, never a Saturday ride (the lowest id on a tie of days). Null: no card. */
export function bupEvent(bookings: BupBooking[], sessions: Map<string, BupSession>, today: string): BupSession | null {
  let ev: BupSession | null = null;
  for (const b of bookings) {
    if (b.status !== "waiting" && b.status !== "active") continue;
    const s = sessions.get(b.sessionId);
    if (!s || s.date <= today || s.cancelled || s.kind === "saturday" || !s.bup) continue;
    if (!ev || s.date < ev.date || (s.date === ev.date && s.id < ev.id)) ev = s;
  }
  return ev;
}

/** The first Saturday the card lists: the later of the booking's day (the member's first row on the event, in Riyadh)
 *  and eight weeks before the event. */
export function bupFrom(bookings: BupBooking[], ev: BupSession): string {
  const made = bookings.filter((b) => b.sessionId === ev.id).map((b) => ksaDay(b.registeredAt)).filter((d) => DAY.test(d)).sort()[0] ?? "";
  const eight = dayPlus(ev.date, -56);
  return made > eight ? made : eight;
}

export type BupState = "done" | "past" | "held" | "wl" | "book" | "full" | "cancel" | "none" | "soon";
/** A Saturday's row: its day, what it says, and the session Book opens. */
export type BupRow = { date: string; state: BupState; book?: string };
export type BupPlan = { ev: BupSession; togo: number; rows: BupRow[] };

/** The card, or null when there is none. `sessions` holds the member's booked sessions and the Saturday rides from the
 *  first row's day to the day before the event; `gender` the member's (null: none on file); `open(s)`: the booking
 *  window has opened on that ride. */
export function buildupPlan(bookings: BupBooking[], sessions: Map<string, BupSession>, today: string,
  gender: SessionGender | null, open: (s: BupSession) => boolean): BupPlan | null {
  if (!DAY.test(today)) return null;
  const ev = bupEvent(bookings, sessions, today);
  if (!ev) return null;
  const last = dayPlus(ev.date, -1), togo = saturdays(today, last).length;
  if (!togo) return null; // no Saturday left before the event: no card, never a count of 0
  const days = saturdays(bupFrom(bookings, ev), last).slice(-8);
  const mine = new Map<string, BupBooking[]>(), sats = new Map<string, BupSession[]>();
  for (const b of bookings) {
    const s = sessions.get(b.sessionId);
    if (s && s.kind === "saturday") mine.set(s.date, [...(mine.get(s.date) ?? []), b]);
  }
  for (const s of sessions.values()) if (s.kind === "saturday" && s.status !== "deleted" && !s.draft) sats.set(s.date, [...(sats.get(s.date) ?? []), s]);
  const sgOk = (s: BupSession) => !s.gender || s.gender === gender;
  const row = (d: string): BupRow => {
    const E = mine.get(d) ?? [], all = sats.get(d) ?? [], L = all.filter((s) => !s.cancelled), past = d < today;
    if (E.some((e) => e.status === "done" || (past && e.status === "active"))) return { date: d, state: "done" };
    if (past) return { date: d, state: "past" };
    if (E.some((e) => e.status === "waiting" || e.status === "active")) return { date: d, state: "held" };
    if (E.some((e) => e.status === "waitlist")) return { date: d, state: "wl" };
    const ok = L.find((s) => s.status === "open" && open(s) && sgOk(s));
    if (ok) return { date: d, state: "book", book: ok.id };
    if (L.some((s) => sgOk(s) && (s.status === "full" || (s.status === "closed" && s.fbk)))) return { date: d, state: "full" };
    if (L.length && !L.some(sgOk)) return { date: d, state: "none" }; // only the other gender's rides that day
    return { date: d, state: !L.length && all.length ? "cancel" : "soon" };
  };
  return { ev, togo, rows: days.map(row) };
}
