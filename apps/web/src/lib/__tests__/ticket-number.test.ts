import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as blood.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import { serverLocalize } from "@/i18n/dicts";
import { ticketRow, ticketSession, type TicketRow } from "../tickets";

// The circuit's booking number as large as the room beside the code allows (the booking app's 168abcc5; the user,
// 2026-11-15: "make the number of the booking in jcc booking cards bigger"): a one- or two-digit number wears n3, which the
// stylesheet sizes by the ticket head's width up to 120px, never under the old 72px (56px on a phone); the waitlist and past
// tickets keep their sizes.
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const SRC = fileURLToPath(new URL("../..", import.meta.url));
const CSS = readFileSync(join(SRC, "components/booking/booking.css"), "utf8");
const JCC = { id: "2099-11-20", session_date: "2099-11-20", day: "Friday", status: "open", title: null, ride_kind: null, event_kind: "regular",
  bike_slots: JSON.stringify({ _time: "20:00-22:00" }), open_to_all: true, paid_ride: true, capacity: 40, needs_approval: false };
const row = (n: number, o: Record<string, unknown> = {}) => ticketRow({ id: `b${n}`, session_id: JCC.id, session_date: JCC.session_date, session_day: "Friday", status: "waiting", queue_num: n, price: 75, paid: false, name: "Sara Khalid", type_preference: "Hybrid", ...o }) as TicketRow;
const card = (rows: TicketRow[], locale = "en", past = false) => renderToStaticMarkup(createElement(TicketCard, {
  locale, today: "2099-11-01", rows, session: ticketSession(JCC) ?? undefined, name: "Open Sports Day", cue: null, t: serverLocalize(TICKET, locale), gather: "Gathering", start: "Start",
  typeName: (x: string) => x, links: { edit: null, manage: "/bookings", place: null }, now: Date.parse("2099-11-01T09:00:00Z"), past,
}));
const numClass = (html: string) => /<p class="(tk-num[^"]*)"/.exec(html)?.[1];

describe("the circuit's booking number", () => {
  it("is n3 for a one- or two-digit number, big for #100 and up, mid and small for a party, in either direction", () => {
    expect(numClass(card([row(7)]))).toBe("tk-num big n3");
    expect(numClass(card([row(45)], "ar"))).toBe("tk-num big n3");
    expect(numClass(card([row(128)]))).toBe("tk-num big");
    expect(numClass(card([row(12), row(13, { id: "b13" })]))).toBe("tk-num mid");
  });
  it("is sized by the head's width, up to 120px, never under the old size, on the circuit's held tickets alone", () => {
    expect(CSS).toMatch(/\.tk-card\.ev-jcc:not\(\.tk-wl, \.tk-past\) \.tk-head \{ container-type: inline-size; --tk-qr: 156px; --tk-floor: 72px; \}/);
    expect(CSS).toMatch(/\.tk-num\.big\.n3 \{ font-size: clamp\(var\(--tk-floor\), calc\(\(100cqw - var\(--tk-qr\)\) \/ 1\.95\), 120px\); \}/);
    expect(CSS).toMatch(/\.tk-num\.big \{ font-size: clamp\(var\(--tk-floor\), calc\(\(100cqw - var\(--tk-qr\)\) \/ 2\.4\), 120px\); \}/);
    // the ride day's ticket has no code beside the number: the whole width is its own
    expect(CSS).toContain(".tk-card.ev-jcc:not(.tk-wl, .tk-past) .tk-head:not(:has(> .tk-right)) { --tk-qr: 0px; }");
    // a phone keeps its own floor and the smaller code's column
    const phone = CSS.indexOf(".tk-num.big { font-size: 56px; letter-spacing: -2px; }");
    expect(phone).toBeGreaterThan(CSS.lastIndexOf("@media (max-width: 560px)", phone));
    expect(CSS.indexOf("--tk-qr: 130px; --tk-floor: 56px;")).toBeGreaterThan(phone);
  });
  it("leaves the waitlist and a past ticket as they were", () => {
    expect(card([row(7, { status: "waitlist" })])).toContain("tk-wl");
    expect(card([row(7, { status: "done" })], "en", true)).toContain("tk-past");
  });
});
