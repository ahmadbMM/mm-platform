import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as tickets.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { SFY_AFTER_MS, safetyEntry, safetyHref } from "../safety-feedback";
import { ticketRow, ticketSession, type TicketRow, type TicketSession } from "../tickets";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import { SAFETY_WORDS } from "@/components/booking/SafetyFeedback.words";
import { LOCALE_CODES } from "@/i18n/locales";
import { serverLocalize } from "@/i18n/dicts";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// "Safety feedback" on My Account's bookings (the booking app's _sfyBtn, 2026-11-21): from the session's end until 7 days
// after, on a booking that held a place, linking to the booking app's /account/safety?b=<entry>.
const jcc = ticketSession({ id: "2099-03-01", session_date: "2099-03-01", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null })!;
const late = ticketSession({ id: "2099-03-08", session_date: "2099-03-08", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"23:30 - 00:15"}', meet_url: null, paid_ride: null })!;
const entry = (s: TicketSession, o: Record<string, unknown> = {}) =>
  ticketRow({ id: "q1abcdef", session_id: s.id, session_date: s.date, session_day: "Sunday", status: "done", queue_num: 4, price: 75, paid: true, name: "Ann", type_preference: "Road", ...o })!;
// 23:00 in Riyadh on 1 March 2099, the circuit night's end
const END = Date.parse("2099-03-01T20:00:00Z");
const BOOK = "https://experiences.micromobility.sa/";

describe("when the link shows (safetyEntry)", () => {
  it("shows from the end until 7 days after, not before", () => {
    const rows = [entry(jcc)];
    expect(safetyEntry(rows, jcc, END - 1)).toBeNull();
    expect(safetyEntry(rows, jcc, END)).toBe("q1abcdef");
    expect(safetyEntry(rows, jcc, END + SFY_AFTER_MS - 1)).toBe("q1abcdef");
    expect(safetyEntry(rows, jcc, END + SFY_AFTER_MS)).toBeNull();
  });
  it("reads an end before the start as the next day's", () => {
    const end = Date.parse("2099-03-08T21:15:00Z"); // 00:15 on 9 March in Riyadh
    expect(safetyEntry([entry(late)], late, end - 1)).toBeNull();
    expect(safetyEntry([entry(late)], late, end)).toBe("q1abcdef");
  });
  it("names a row that held a place: never a waitlist, a cancelled place or a no-show, nor a session the page does not know", () => {
    for (const st of ["waiting", "active", "done"]) expect(safetyEntry([entry(jcc, { status: st })], jcc, END + 1)).toBe("q1abcdef");
    for (const st of ["waitlist", "cancelled", "no_show"]) expect(safetyEntry([{ id: "x", status: st } as TicketRow], jcc, END + 1)).toBeNull();
    expect(safetyEntry([{ id: "w", status: "waitlist" } as TicketRow, entry(jcc, { id: "q2" })], jcc, END + 1)).toBe("q2");
    expect(safetyEntry([entry(jcc)], undefined, END + 1)).toBeNull();
  });
  it("links to the booking app's page in the visitor's language", () => {
    expect(safetyHref("q1abcdef", BOOK, "fr")).toBe("https://experiences.micromobility.sa/account/safety?b=q1abcdef&lang=fr");
    expect(safetyHref("a b&c", BOOK, "ar")).toBe("https://experiences.micromobility.sa/account/safety?b=a+b%26c&lang=ar");
  });
});

describe("the ticket's link", () => {
  const card = (safety: string | null, locale = "en") => renderToStaticMarkup(createElement(TicketCard, {
    locale, today: "2099-03-01", rows: [entry(jcc)], session: jcc, name: "Circuit night", cue: null, t: serverLocalize(TICKET, locale), gather: "Gathering", start: "Start", typeName: (x: string) => x,
    links: { edit: null, manage: "https://book.example.test/?tab=bookings", place: null, safety }, now: END + 1, past: true,
  }));
  it("is drawn with its words when the page hands it one, and not otherwise", () => {
    const href = safetyHref("q1abcdef", BOOK, "en");
    const html = card(href);
    expect(html).toContain(`<div class="tk-actions tk-sfy"><a class="tk-btn" href="${href.replace(/&/g, "&amp;")}">`);
    expect(html).toContain("Safety feedback</a>");
    expect(card(null)).not.toContain("tk-sfy");
    expect(card(safetyHref("q1abcdef", BOOK, "ar"), "ar")).toContain("ملاحظات السلامة</a>");
  });
  it("has words in every language the site speaks", () => {
    for (const l of LOCALE_CODES) expect(SAFETY_WORDS[l as keyof typeof SAFETY_WORDS]?.btn, l).toBeTruthy();
  });
});
