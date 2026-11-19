// "Remind me when booking opens" (the booking app's customer features round, 2026-11-19, item 2: _ormAt, _ormMay, _ormBtn,
// _ormOpen, _ormCal, _ormSet, _ormMine; rentals migration 20261119600200; the user: "On a date that isn't open yet, one tap
// adds the opening time to the rider's calendar with an alarm, and puts a row in Updates when it opens. This helps on
// Saturdays that fill fast."). A date the visitor cannot book yet only because booking has not opened for them (the booking
// window, or members book first for a visitor who is not one) carries a bell, "Remind me"; it opens a centred pop-up named
// with the opening, offering "Add to my calendar" (one event at the opening, 15 minutes, an alarm then and ten minutes
// before, back to that date in the booking app: /api/booking-opens writes it on the server from the session's row) and,
// for a signed-in visitor, "Tell me in Updates" (open_reminder_set through /api/account/remind: the database writes the
// booking app's Updates row when it opens), then "Reminder set" and "Remove reminder". The visitor's asks are read once,
// when a bell is first on screen (open_reminders_mine). Plain logic here, so it can be tested; the bell is
// components/site/RemindBell.tsx.
import { intlOf } from "@/i18n/locales";
import { fmtClock } from "./tickets";
import { SESSION_ID } from "./waiver";

/** When booking opens for this visitor (epoch ms; the booking app's _ormAt): the booking window's opening while it is
 *  ahead, and members book first's public_at for a visitor it holds; 0 when nothing holds the date at `now`. */
export function remindAt(s: { opensAt?: number | null; mf?: { at: number; held: boolean } | null }, now: number): number {
  const at = Math.max(s.opensAt ?? 0, s.mf?.held ? s.mf.at : 0);
  return at > now ? at : 0;
}

/** Who is looking: a Community member, a Petromin tag holder, one who may book Victory Lap, and whether Saturday rides are
 *  taken by code alone at micromobility.sa/saturday (saturday_link_only). */
export type RemindViewer = { member: boolean; petromin?: boolean; vlap?: boolean; satLink?: boolean };

/** Could this visitor book the date once it opens (the booking app's _ormMay and the rest of _ormBtn's test, the database's
 *  _open_remind_ok): a date still live and not full, that they hold no place on; a members-only date only for a member (a
 *  Petromin night also for its tag's holders, Victory Lap for those who may book it); never a Saturday ride while it is
 *  taken by code alone. Whether it is open yet is remindAt's. */
export function remindable(s: { kind: string; members: boolean; full?: boolean; fbk?: boolean; held?: unknown }, v: RemindViewer): boolean {
  if (s.full || s.fbk || s.held) return false;
  if (s.kind === "saturday" && v.satLink) return false;
  if (s.members && !v.member && !(s.kind === "petromin" && v.petromin) && !(s.kind === "vlap" && v.vlap)) return false;
  return true;
}

/** "Sat 21 Nov · 9 AM": when booking opens, in Riyadh, in the page's language (the pop-up's title, as the booking app's
 *  _ormOpen writes it: the short weekday, day and month, then the time; joined by the site's middle dot, which every
 *  language keeps). */
export function remindWhen(at: number, locale: string): string {
  if (!Number.isFinite(at)) return "";
  const loc = locale === "en" ? "en-GB" : intlOf(locale);
  try {
    const day = new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Riyadh" }).format(new Date(at));
    const hm = new Date(at + 3 * 3600e3).toISOString().slice(11, 16); // Riyadh has no daylight saving: UTC+3 all year
    return `${day} · ${fmtClock(hm, locale)}`;
  } catch { return ""; }
}

/** The event card a date opens under in the booking app (its _evOf, functions/api/ics.js openEv): the National Day ride and
 *  the circuit by their own, a workshop, event, run, race or blood donation by its kind, any other community session
 *  (a Petromin night too) under Experiences. */
export function remindEv(kind: string): string {
  if (kind === "jcc" || kind === "snd96") return kind;
  return ["event", "workshop", "runher", "vlap", "arena", "blood", "testride"].includes(kind) ? kind : "community";
}

const icsStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
const icsEsc = (v: string) => v.replace(/[\\,;]/g, (x) => `\\${x}`).replace(/\r?\n/g, "\\n");

/** The calendar file (the booking app's _icsBody with _ormCal's event, the same as its /api/ics kind 'o' writes): one
 *  event at the opening, 15 minutes long, named `title`, its description and URL the booking app's link to that date,
 *  an alarm at the opening and ten minutes before; UID opens-<session>, so a second file for the same date replaces the
 *  first in the calendar (SEQUENCE grows with every file). */
export function remindIcs(o: { id: string; at: number; title: string; url: string }, now: number): string {
  const id = o.id.replace(/[^\w-]/g, "");
  const ti = icsEsc(o.title);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MicroMobility//Bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:opens-${id}@micromobility.sa`, `SEQUENCE:${Math.floor(now / 1000)}`, `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(o.at)}`, `DTEND:${icsStamp(o.at + 15 * 60e3)}`,
    `SUMMARY:${ti}`, `DESCRIPTION:${icsEsc(o.url)}`, `URL:${o.url}`,
    ...["PT0M", "-PT10M"].flatMap((x) => ["BEGIN:VALARM", `TRIGGER:${x}`, "ACTION:DISPLAY", `DESCRIPTION:${ti}`, "END:VALARM"]),
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

/** The address of a date's calendar file on this site (app/api/booking-opens). */
export const remindIcsHref = (id: string, locale: string): string => `/api/booking-opens?s=${encodeURIComponent(id)}&l=${encodeURIComponent(locale)}`;

/** What a bell posts, read safely: {op: "mine"}, or {op: "set", session, on}; else null. */
export function remindBody(body: unknown): { op: "mine" } | { op: "set"; session: string; on: boolean } | null {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (b?.op === "mine") return { op: "mine" };
  if (b?.op === "set" && typeof b.session === "string" && SESSION_ID.test(b.session) && typeof b.on === "boolean") return { op: "set", session: b.session, on: b.on };
  return null;
}

export type RemindRefusal = "none" | "booked" | "open" | "limit" | "signin" | "generic";
/** open_reminder_set's answer as the route says it: ok and whether the ask stands, or why not - "none" (a date nobody
 *  could be reminded of: gone, called off, full, not the visitor's to book), "booked" (they hold a place on it), "open"
 *  (it is open for them now), "limit" (twenty asks waiting), "signin" (the token is no longer the account's) or "generic". */
export function remindAnswer(data: unknown): { ok: true; on: boolean } | { ok: false; error: RemindRefusal } {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (d?.ok === true) return { ok: true, on: d.on === true };
  const e = d?.error;
  return { ok: false, error: e === "none" || e === "booked" || e === "open" || e === "limit" ? e : e === "denied" ? "signin" : "generic" };
}

/** open_reminders_mine's answer: the session ids the visitor is waiting on, or why not ("signin", "generic"). */
export function remindMine(data: unknown): { ok: true; ids: string[] } | { ok: false; error: "signin" | "generic" } {
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (d?.ok === true && Array.isArray(d.ids)) return { ok: true, ids: d.ids.filter((x): x is string => typeof x === "string" && SESSION_ID.test(x)).slice(0, 100) };
  return { ok: false, error: d?.error === "denied" ? "signin" : "generic" };
}
