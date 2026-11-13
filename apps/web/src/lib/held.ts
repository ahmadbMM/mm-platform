// A date the signed-in visitor already holds (the owner's pick 4 from the Featured follow-ups, 2026-11-13; the booking
// app's _heldSt): Experiences says so on the date's card in its event's list and on its Featured card, where the date's
// places would be said. The rule is the ticket's own cue (lib/tickets.ts ticketCue), so a card never tells a verdict
// before the ticket does. Plain logic here, so it can be tested: the page reads the account's bookings
// (app/[locale]/experiences/page.tsx, lib/account.ts accountBookings) and the cards draw the mark
// (components/experiences/ExperienceSteps.tsx).
import { ticketRow, type TicketRow } from "./tickets";

/** What the visitor holds on a date: "ok" Booked; "wl" On the waitlist, when every rider of theirs waits; "rsv"
 *  Reserved, on a ride staff approve until its list is out and every rider of theirs is approved. */
export type Held = "ok" | "wl" | "rsv";

/** The account's live bookings by session, from my_bookings' rows as the ticket reads them (ticketRow): waiting, on the
 *  waitlist or checked in. A finished, cancelled or no-show booking holds nothing, and a row that cannot be read is
 *  left out. */
export function heldRows(rows: unknown): Map<string, TicketRow[]> {
  const by = new Map<string, TicketRow[]>();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== "object") continue;
    const t = ticketRow(r as Record<string, unknown>);
    if (!t || t.status === "done") continue;
    by.set(t.sessionId, [...(by.get(t.sessionId) ?? []), t]);
  }
  return by;
}

/** What the account holds on a session, or null when it holds nothing there. `rows`: its own bookings on that session
 *  (heldRows). `s`: whether staff approve the date (a community date with needs_approval not false) and whether its
 *  rider list is out (sessions.hide_queue false), as the ticket's session has them (TicketSession) and the page's
 *  (lib/rides.ts RideSession). A list not known to be out reads as not out: Reserved. */
export function heldState(rows: Pick<TicketRow, "status" | "approval" | "partner">[], s: { approval?: boolean; published?: boolean }): Held | null {
  const live = rows.filter((r) => r.status === "waiting" || r.status === "waitlist" || r.status === "active");
  if (!live.length) return null;
  if (live.some((r) => r.status === "active")) return "ok";
  const wl = live.every((r) => r.status === "waitlist");
  const partner = live.every((r) => !!r.partner); // a partner's booking is confirmed as made
  if (s.approval && !partner) {
    if (!s.published) return "rsv"; // before the list is out nobody is told a verdict
    if (wl) return "wl";
    return live.every((r) => r.approval === "approved") ? "ok" : "rsv";
  }
  return wl ? "wl" : "ok";
}
