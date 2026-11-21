import type { TicketRow, TicketSession } from "./tickets";
import { reportEnd } from "./bike-report";
import { bookingPage } from "./links";

// "Safety feedback" on My Account's bookings (the booking app's _sfyBtn, 2026-11-21; rentals migration 20261121400000):
// a booking that held a place (booked, checked in or back; never a waitlist, a cancelled place or a no-show) carries the
// link from the moment its session ends (its window's end, an end before its start being the next day's: reportEnd) until
// 7 days after, as the database's safety_send allows. The form itself is the booking app's (/account/safety?b=<entry>,
// rider-safety.js): the site only links to it, with the booking's first such entry, and the app lets the account holder
// pick which rider on the booking it is about. The site does not read what was sent, so the link reads the same after a
// send; the app's page then shows the feedback's status.

/** How long after the session's end the link shows (the booking app's SFY_DAYS, safety_send's 'late'). */
export const SFY_DAYS = 7;
export const SFY_AFTER_MS = SFY_DAYS * 864e5;

/** The entry the link names, or null for none: the session ended, under 7 days ago, a row that held a place. */
export function safetyEntry(rows: Pick<TicketRow, "id" | "status">[], s: Pick<TicketSession, "date" | "times"> | undefined, now: number): string | null {
  if (!s) return null;
  const end = reportEnd(s);
  if (!Number.isFinite(end) || !(now >= end && now < end + SFY_AFTER_MS)) return null;
  const r = rows.find((x) => x.status === "waiting" || x.status === "active" || x.status === "done");
  return r ? r.id : null;
}

/** The booking app's page for that entry, in the visitor's language (bookingPage adds ?lang=). */
export function safetyHref(entryId: string, booking: string, locale: string): string {
  return bookingPage(`/account/safety?b=${encodeURIComponent(entryId)}`, booking, locale);
}
