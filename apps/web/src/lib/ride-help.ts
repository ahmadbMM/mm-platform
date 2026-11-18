import { ksaAt, type TicketRow, type TicketSession } from "./tickets";
import { BRP_AFTER_MS, reportEnd } from "./bike-report";

// "Need help?" on My Account's ticket (the booking app's help on the ride, 2026-11-16: _rhRows, _rhHtml, _rhOpen,
// _rhWaHref, RH_MSG, RH_BIZ). A booking that holds a place (booked, checked in or back) has the button from an hour before
// the session's first time until 3 hours after its last; never on a waitlist, nor on the Blood Donation event. It opens a
// centred pop-up (TicketHelp): what is wrong as real radios (no bike choice on a session without bikes), WhatsApp us on the
// business line with a message that names the rider, the session and, once the phone gives it, where the rider is; Call
// us; the ambulance (997). Nothing is stored or sent by the site: the location goes only into the message the rider
// chooses to send. The team reads English and Arabic, so the message is in Arabic on an Arabic page and in English on
// every other.

/** The business line (the booking app's RH_BIZ; the site's own contact number, content/pages/site.ts). */
export const RH_BIZ = "966566668818";
/** How long before the session's first time the button shows. */
export const RH_BEFORE_MS = 3600e3;
/** How long after the session's last time it still shows (as "Report a bike problem"). */
export const RH_AFTER_MS = BRP_AFTER_MS;

/** What is wrong, in the pop-up's order. */
export const RH_KINDS = ["lost", "hurt", "bike", "other"] as const;
export type RhKind = (typeof RH_KINDS)[number];

/** The message's first line by what was picked, and the word before the map link (the booking app's RH_MSG). */
export const RH_MSG: Record<"en" | "ar", Record<RhKind | "loc", string>> = {
  en: { lost: "I can't find the group.", hurt: "I'm hurt or unwell.", bike: "My bike broke down.", other: "I need help.", loc: "My location" },
  ar: { lost: "لا أجد المجموعة.", hurt: "أنا مصاب أو لست بخير.", bike: "تعطلت دراجتي.", other: "أحتاج مساعدة.", loc: "موقعي" },
};

/** When the button shows, as epoch milliseconds: from an hour before the session's first time (the gathering on a ride
 *  that gathers, else the start; 9 o'clock on a session without times) until 3 hours after its last (reportEnd: an end
 *  before its start is the next day's). */
export function helpWindow(s: Pick<TicketSession, "date" | "times">): { from: number; until: number } {
  return { from: ksaAt(s.date, s.times ? s.times[0] : "09:00") - RH_BEFORE_MS, until: reportEnd(s) + RH_AFTER_MS };
}

/** The booking's rows that may ask now (the booking app's _rhRows): booked, checked in or done; none on a session not
 *  known to the page, on the Blood Donation event, or outside the window. */
export function helpRows(rows: TicketRow[], s: TicketSession | undefined, now: number): TicketRow[] {
  if (!s || s.kind === "blood") return [];
  const w = helpWindow(s);
  if (!(now >= w.from && now < w.until)) return [];
  return rows.filter((r) => r.status === "waiting" || r.status === "active" || r.status === "done");
}

/** How far ahead of its window a ticket carries the button, for the browser to show when the window opens. */
export const RH_AHEAD_MS = 864e5;
/** What the ticket hands the button (TicketCard): the window and the choices, or null for none. The page is drawn once, so
 *  a booking whose window opens within the next day carries it too, and the browser shows it when the window opens
 *  (TicketHelp); one whose window is over, or more than a day away, carries nothing. */
export function rideHelp(rows: TicketRow[], s: TicketSession | undefined, now: number): { from: number; until: number; kinds: RhKind[] } | null {
  if (!s || s.kind === "blood") return null;
  const w = helpWindow(s);
  if (!(now < w.until && w.from - now <= RH_AHEAD_MS)) return null;
  if (!rows.some((r) => r.status === "waiting" || r.status === "active" || r.status === "done")) return null;
  return { ...w, kinds: helpKinds(s) };
}

/** The choices the pop-up offers: "My bike broke down" only on a session with bikes (the booking app's _needsBike). */
export const helpKinds = (s: Pick<TicketSession, "bikes">): RhKind[] => RH_KINDS.filter((k) => k !== "bike" || s.bikes);

/** Where the rider is, as the message carries it: 5 decimals (about a metre), or null for a reading it cannot take. */
export function helpPos(c: { latitude: number; longitude: number } | null | undefined): { lat: number; lng: number } | null {
  if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return null;
  return { lat: Number(c.latitude.toFixed(5)), lng: Number(c.longitude.toFixed(5)) };
}

/** The WhatsApp link (the booking app's _rhWaHref): line 1 what is wrong ("I need help." when nothing, or Something else,
 *  is picked), line 2 the rider and the session ("<account> · <event> · <date> · <time>"), line 3 the map link once the
 *  location is known; in Arabic on an Arabic page, in English on every other. */
export function helpWaHref(m: { k: RhKind | ""; who: string; line: string; pos: { lat: number; lng: number } | null }, locale: string): string {
  const W = RH_MSG[locale === "ar" ? "ar" : "en"];
  const x = [m.k && m.k !== "other" ? W[m.k] : W.other, [m.who, m.line].filter(Boolean).join(" · ")];
  if (m.pos) x.push(`${W.loc}: https://maps.google.com/?q=${m.pos.lat},${m.pos.lng}`);
  return `https://wa.me/${RH_BIZ}?text=${encodeURIComponent(x.join("\n"))}`;
}
