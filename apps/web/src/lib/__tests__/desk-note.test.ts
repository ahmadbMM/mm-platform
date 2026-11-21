import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as tickets.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { ticketRow, ticketSession, type TicketRow } from "../tickets";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import { DESK_NOTE_WORDS, deskNoteWord } from "@/components/booking/DeskNote.words";
import { LOCALE_CODES } from "@/i18n/locales";
import { serverLocalize } from "@/i18n/dicts";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// "Note for the desk" (the booking app's customer features round, 2026-11-19, item 9: _dntTkHtml; rentals bb133088,
// migration 20261119600300): what the rider wrote for our team with a booking, read-only in the ticket's Details. The
// website books by handing over to the booking app, which takes and changes the note, so there is no field here.
const jcc = ticketSession({ id: "2099-03-01", session_date: "2099-03-01", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null })!;
const raw = { id: "q1abcdef", session_id: jcc.id, session_date: jcc.date, session_day: "Sunday", status: "waiting", queue_num: 4, price: 75, paid: false, name: "Ann", type_preference: "Road" };
const card = (rows: TicketRow[], locale = "en") => renderToStaticMarkup(createElement(TicketCard, {
  locale, today: "2099-02-20", rows, session: jcc, name: "Circuit night", cue: null, t: serverLocalize(TICKET, locale), gather: "Gathering", start: "Start", typeName: (x: string) => x,
  links: { edit: null, manage: "https://book.example.test/?tab=bookings", place: null, bookings: "https://book.example.test/my-bookings" }, now: Date.parse("2099-02-20T10:00:00Z"),
}));

describe("the rider's note for the desk", () => {
  it("is read off the row only when the read carries the column, trimmed, at most 200 characters", () => {
    expect("riderNote" in ticketRow(raw)!).toBe(false);
    expect(ticketRow({ ...raw, rider_note: null })!.riderNote).toBeNull();
    expect(ticketRow({ ...raw, rider_note: "  " })!.riderNote).toBeNull();
    expect(ticketRow({ ...raw, rider_note: " First time on a bike " })!.riderNote).toBe("First time on a bike");
    expect(ticketRow({ ...raw, rider_note: "x".repeat(250) })!.riderNote).toHaveLength(200);
  });
  it("shows in the ticket's Details under the app's label, whichever row of the booking carries it", () => {
    const html = card([ticketRow({ ...raw, rider_note: null })!, ticketRow({ ...raw, id: "q2abcdef", name: "Sam", rider_note: "My child is nervous" })!]);
    expect(html).toContain('class="tk-more-btn"');
    expect(html).toContain('<div class="tk-dnt"><p class="tk-rt-k">Note for the desk</p><p class="tk-dnt-n"><bdi>My child is nervous</bdi></p></div>');
    // no field: the note is changed in the booking app
    expect(html).not.toMatch(/<textarea/);
  });
  it("draws nothing without a note, and writes the note as text", () => {
    expect(card([ticketRow({ ...raw, rider_note: null })!])).not.toContain("tk-dnt");
    expect(card([ticketRow(raw)!])).not.toContain("tk-dnt");
    expect(card([ticketRow({ ...raw, rider_note: "<b>hi</b>" })!])).toContain("<bdi>&lt;b&gt;hi&lt;/b&gt;</bdi>");
  });
  it("speaks the page's language, the booking app's own word for its ten", () => {
    expect(card([ticketRow({ ...raw, rider_note: "أول مرة" })!], "ar")).toContain(">ملاحظة لفريق الاستقبال</p>");
    expect(Object.keys(DESK_NOTE_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const l of LOCALE_CODES) expect(DESK_NOTE_WORDS[l], l).toMatch(/\S/);
    expect(deskNoteWord("fr")).toBe("Note pour l'accueil");
    expect(deskNoteWord("xx")).toBe("Note for the desk");
  });
});
