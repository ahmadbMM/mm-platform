import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as tickets.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { RH_AHEAD_MS, RH_BIZ, RH_KINDS, RH_MSG, helpKinds, helpPos, helpRows, helpWaHref, helpWindow, rideHelp } from "../ride-help";
import { ticketRow, ticketSession, type TicketRow, type TicketSession } from "../tickets";
import { resolvePage } from "../content";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import { RIDE_HELP_WORDS, rideHelpWords } from "@/components/booking/RideHelp.words";
import { helpSchema } from "@/content/pages/help";
import { LOCALE_CODES } from "@/i18n/locales";
import { serverLocalize } from "@/i18n/dicts";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// "Need help?" on My Account's ticket (the booking app's help on the ride, 2026-11-16: _rhRows, _rhHtml, _rhOpen, _rhWaHref,
// RH_MSG), and the Help page's "Rides & bookings" tab whose answers the booking app's Account > Help shares.
const H = 3600e3;
const jcc = ticketSession({ id: "2099-03-01", session_date: "2099-03-01", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null })!;
const late = ticketSession({ id: "2099-03-03", session_date: "2099-03-03", bike_slots: '{"_time":"22:00 - 01:00"}' })!;
const sat = ticketSession({ id: "2099-03-04-sr", session_date: "2099-03-04", event_kind: "community", ride_kind: null, needs_approval: false, hide_queue: false, bike_slots: '{"_time":"06:00 - 06:30"}' })!;
const yoga = ticketSession({ id: "2099-03-05-yg", session_date: "2099-03-05", event_kind: "community", ride_kind: "yoga", needs_approval: false, bike_slots: '{"_time":"18:00 - 19:00"}' })!;
const blood = ticketSession({ id: "2099-03-06-bd", session_date: "2099-03-06", event_kind: "community", ride_kind: "blood", needs_approval: false, bike_slots: '{"_time":"16:00 - 22:00"}' })!;
// 20:00 and 02:00 in Riyadh around the night of 1 March 2099: an hour before 9 PM, 3 hours after 11 PM
const FROM = Date.parse("2099-03-01T17:00:00Z"), UNTIL = Date.parse("2099-03-01T23:00:00Z");
const entry = (s: TicketSession, o: Record<string, unknown> = {}) =>
  ticketRow({ id: "q1abcdef", session_id: s.id, session_date: s.date, session_day: "Sunday", status: "waiting", queue_num: 4, price: 75, paid: true, name: "Ann Rider", type_preference: "Road", ...o })!;
const text = (href: string) => decodeURIComponent(href.slice(`https://wa.me/${RH_BIZ}?text=`.length));

describe("when it shows (_rhRows)", () => {
  it("opens an hour before the first time and closes 3 hours after the last", () => {
    expect(helpWindow(jcc)).toEqual({ from: FROM, until: UNTIL });
    expect(helpWindow(late)).toEqual({ from: Date.parse("2099-03-03T18:00:00Z"), until: Date.parse("2099-03-04T01:00:00Z") }); // ends past midnight
    expect(helpWindow(sat).from).toBe(Date.parse("2099-03-04T02:00:00Z")); // a ride that gathers: an hour before the gathering
    expect(helpWindow({ ...jcc, times: null })).toEqual({ from: Date.parse("2099-03-01T05:00:00Z"), until: Date.parse("2099-03-01T11:00:00Z") }); // 9 to 11
  });
  it("takes a booking that holds a place, booked, checked in or back, inside the window only", () => {
    for (const status of ["waiting", "active", "done"]) expect(helpRows([entry(jcc, { status })], jcc, FROM)).toHaveLength(1);
    expect(helpRows([entry(jcc, { status: "waitlist" })], jcc, FROM)).toEqual([]);
    expect(helpRows([entry(jcc)], jcc, FROM - 1)).toEqual([]);
    expect(helpRows([entry(jcc)], jcc, UNTIL - 1)).toHaveLength(1);
    expect(helpRows([entry(jcc)], jcc, UNTIL)).toEqual([]);
    expect(helpRows([entry(jcc)], undefined, FROM)).toEqual([]);
    expect(helpRows([entry(blood)], blood, Date.parse("2099-03-06T14:00:00Z"))).toEqual([]); // never a blood donation
    expect(helpRows([entry(yoga)], yoga, Date.parse("2099-03-05T15:00:00Z"))).toHaveLength(1);
  });
  it("hands the ticket a window that opens within the day, and nothing further off or over", () => {
    expect(rideHelp([entry(jcc)], jcc, FROM)).toEqual({ from: FROM, until: UNTIL, kinds: ["lost", "hurt", "bike", "other"] });
    expect(rideHelp([entry(jcc)], jcc, FROM - RH_AHEAD_MS)?.from).toBe(FROM);
    expect(rideHelp([entry(jcc)], jcc, FROM - RH_AHEAD_MS - 1)).toBeNull();
    expect(rideHelp([entry(jcc)], jcc, UNTIL)).toBeNull();
    expect(rideHelp([entry(jcc, { status: "waitlist" })], jcc, FROM)).toBeNull();
    expect(rideHelp([entry(jcc, { status: "waitlist" }), entry(jcc, { id: "q2abcdef" })], jcc, FROM)).not.toBeNull();
    expect(rideHelp([entry(blood)], blood, Date.parse("2099-03-06T14:00:00Z"))).toBeNull();
    expect(rideHelp([entry(jcc)], undefined, FROM)).toBeNull();
  });
  it("offers the bike choice only on a session with bikes", () => {
    expect(helpKinds(jcc)).toEqual(["lost", "hurt", "bike", "other"]);
    expect(helpKinds(yoga)).toEqual(["lost", "hurt", "other"]);
    expect([...RH_KINDS]).toEqual(["lost", "hurt", "bike", "other"]);
  });
});

describe("the WhatsApp message (_rhWaHref)", () => {
  const m = { who: "Ann Rider", line: "Circuit night · 1 Mar 2099 · 9 PM – 11 PM", pos: null };
  it("says what is wrong, who and which session, on the business line", () => {
    const href = helpWaHref({ ...m, k: "lost" }, "en");
    expect(href).toBe(`https://wa.me/966566668818?text=${encodeURIComponent("I can't find the group.\nAnn Rider · Circuit night · 1 Mar 2099 · 9 PM – 11 PM")}`);
    expect(text(helpWaHref({ ...m, k: "" }, "en"))).toBe("I need help.\nAnn Rider · Circuit night · 1 Mar 2099 · 9 PM – 11 PM");
    expect(text(helpWaHref({ ...m, k: "other" }, "en")).split("\n")[0]).toBe("I need help.");
    expect(text(helpWaHref({ ...m, k: "hurt" }, "en")).split("\n")[0]).toBe("I'm hurt or unwell.");
    expect(text(helpWaHref({ ...m, k: "bike" }, "en")).split("\n")[0]).toBe("My bike broke down.");
    expect(text(helpWaHref({ k: "", who: "", line: "", pos: null }, "en"))).toBe("I need help.\n");
  });
  it("adds where the rider is once known, to 5 decimals", () => {
    const pos = helpPos({ latitude: 21.5428734, longitude: 39.1728119 });
    expect(pos).toEqual({ lat: 21.54287, lng: 39.17281 });
    expect(text(helpWaHref({ ...m, k: "lost", pos }, "en")).split("\n")).toEqual(["I can't find the group.", "Ann Rider · Circuit night · 1 Mar 2099 · 9 PM – 11 PM", "My location: https://maps.google.com/?q=21.54287,39.17281"]);
    expect(helpPos({ latitude: NaN, longitude: 39 })).toBeNull();
    expect(helpPos(null)).toBeNull();
  });
  it("is in Arabic on an Arabic page and in English on every other", () => {
    const pos = { lat: 21.5, lng: 39.2 };
    expect(text(helpWaHref({ ...m, k: "hurt", pos }, "ar")).split("\n")).toEqual(["أنا مصاب أو لست بخير.", m.who + " · " + m.line, "موقعي: https://maps.google.com/?q=21.5,39.2"]);
    expect(text(helpWaHref({ ...m, k: "", pos: null }, "ar")).split("\n")[0]).toBe(RH_MSG.ar.other);
    for (const l of ["fr", "ur", "zh", "de"]) expect(text(helpWaHref({ ...m, k: "bike", pos }, l)).split("\n")[0], l).toBe("My bike broke down.");
  });
});

describe("its words", () => {
  it("are in every language, the booking app's own in English and Arabic", () => {
    expect(Object.keys(RIDE_HELP_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const l of LOCALE_CODES) for (const k of ["btn", "wa", "call", "amb", "loc", "close", ...RH_KINDS] as const) expect(RIDE_HELP_WORDS[l][k], `${l}.${k}`).toMatch(/\S/);
    for (const l of LOCALE_CODES) expect(RIDE_HELP_WORDS[l].amb, l).toContain("997");
    expect(rideHelpWords("en")).toEqual({ btn: "Need help?", lost: "I can't find the group", hurt: "I'm hurt or unwell", bike: "My bike broke down", other: "Something else", wa: "WhatsApp us", call: "Call us", amb: "Ambulance 997", loc: "with your location", close: "Close" });
    expect(rideHelpWords("ar")).toMatchObject({ btn: "تحتاج مساعدة؟", lost: "لا أجد المجموعة", amb: "الإسعاف 997", wa: "راسلنا واتساب" });
    expect(rideHelpWords("xx")).toBe(RIDE_HELP_WORDS.en);
  });
});

describe("on the ticket", () => {
  const card = (rows: TicketRow[], now: number, o: { locale?: string; past?: boolean; session?: TicketSession; account?: string | null } = {}) => renderToStaticMarkup(createElement(TicketCard, {
    locale: o.locale ?? "en", today: (o.session ?? jcc).date, rows, session: o.session ?? jcc, name: "Circuit night", cue: null, t: serverLocalize(TICKET, o.locale ?? "en"), gather: "Gathering", start: "Start", typeName: (x: string) => x,
    links: { edit: null, manage: "https://book.example.test/?tab=bookings", place: null }, now, past: o.past, account: o.account === undefined ? "Lina Account" : o.account,
  }));
  const hrefOf = (html: string) => (/class="tk-rh-wa" href="([^"]+)"/.exec(html)?.[1] ?? "").replace(/&amp;/g, "&");
  it("shows the button in the window, with a centred pop-up of real radios, WhatsApp us, Call us, the ambulance and Close", () => {
    const html = card([entry(jcc)], FROM + H);
    expect(html).toMatch(/<div class="tk-rh"><button type="button" class="tk-btn"><svg[^>]*>.*?<\/svg><span>Need help\?<\/span><\/button><dialog class="tk-dlg tk-rh-dlg"/);
    expect(html).toMatch(/<h2 id="[^"]+" class="tk-dlg-t">Need help\?<\/h2>/);
    expect(html.match(/<input type="radio"/g)).toHaveLength(4);
    expect(html).not.toMatch(/<input type="radio"[^>]* checked/); // nothing picked at first
    for (const w of ["I can&#x27;t find the group", "I&#x27;m hurt or unwell", "My bike broke down", "Something else"]) expect(html).toContain(`<span>${w}</span>`);
    expect(html).toMatch(/class="tk-rh-wa" href="https:\/\/wa\.me\/966566668818\?text=[^"]+" target="_blank" rel="noopener noreferrer">/);
    expect(html).toMatch(/<span class="tk-rh-loc" hidden="">.*?<span class="tk-rh-sr">with your location<\/span><\/span>/);
    expect(html).toMatch(/<a class="tk-rh-call" href="tel:\+966566668818">.*?<span>Call us<\/span><\/a>/);
    expect(html).toMatch(/<a class="tk-rh-amb" href="tel:997">.*?<span>Ambulance 997<\/span><\/a>/);
    expect(html).toContain('<button type="button" class="tk-rh-close">Close</button>');
    expect(text(hrefOf(html))).toMatch(/^I need help\.\nLina Account · Circuit night · 1 Mar 2099 · 9\sPM – 11\sPM$/);
  });
  it("names the account first, and the booking's first rider when the account's name is not given", () => {
    expect(text(hrefOf(card([entry(jcc)], FROM))).split("\n")[1]).toMatch(/^Lina Account · Circuit night · /);
    expect(text(hrefOf(card([entry(jcc)], FROM, { account: null }))).split("\n")[1]).toMatch(/^Ann Rider · Circuit night · /);
  });
  it("stands above the bike report, and on tonight's past card", () => {
    const html = card([entry(jcc, { status: "active", assigned_bike_id: "b1", bike_report_at: null })], FROM + H);
    expect(html.indexOf('class="tk-rh"')).toBeGreaterThan(-1);
    expect(html.indexOf('class="tk-rh"')).toBeLessThan(html.indexOf('class="tk-brp"'));
    expect(card([entry(jcc, { status: "done" })], UNTIL - H, { past: true })).toContain('class="tk-rh"');
  });
  it("is not there before the window, after it, on a waitlist or at a blood donation", () => {
    expect(card([entry(jcc)], FROM - 1)).not.toContain("tk-rh");
    expect(card([entry(jcc)], UNTIL)).not.toContain("tk-rh");
    expect(card([entry(jcc, { status: "waitlist" })], FROM + H)).not.toContain("tk-rh");
    expect(card([entry(blood)], Date.parse("2099-03-06T14:00:00Z"), { session: blood })).not.toContain("tk-rh");
  });
  it("offers no bike choice on a session without bikes", () => {
    const html = card([entry(yoga)], Date.parse("2099-03-05T15:00:00Z"), { session: yoga });
    expect(html).toContain("Need help?");
    expect(html.match(/<input type="radio"/g)).toHaveLength(3);
    expect(html).not.toContain("My bike broke down");
  });
  it("speaks the page's language, and writes the message in Arabic on an Arabic page, in English on any other", () => {
    const ar = card([entry(jcc)], FROM, { locale: "ar" });
    expect(ar).toContain("<span>تحتاج مساعدة؟</span>");
    expect(ar).toContain("<span>الإسعاف 997</span>");
    expect(text(hrefOf(ar)).split("\n")[0]).toBe("أحتاج مساعدة.");
    const ur = card([entry(jcc)], FROM, { locale: "ur" });
    expect(ur).toContain("<span>مدد چاہیے؟</span>");
    expect(text(hrefOf(ur)).split("\n")[0]).toBe("I need help.");
  });
});

describe("the Help page's Rides & bookings answer", () => {
  it("names the ticket's button in every language", () => {
    for (const l of LOCALE_CODES) {
      const a = (resolvePage(helpSchema, null, l).topics.rides as { a: string }[])[4].a;
      expect(a, l).toContain(rideHelpWords(l).btn);
    }
  });
});
