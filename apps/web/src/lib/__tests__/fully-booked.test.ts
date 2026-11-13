import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps, { type StepSession } from "@/components/experiences/ExperienceSteps";
import { dictOf } from "@/i18n/dicts";
import { TRANSLATED } from "@/i18n/locales";
import { eventCards, infoPlaces, nextOpen } from "../event-info";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";
import ExperiencesPage from "../../app/[locale]/experiences/page";
import EventsPage from "../../app/[locale]/events/page";

// cookies() is a request's; here it holds the account's cookie a test sets, or none.
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));
// The steps open on the event cards (useState(1)); a test draws a later step, or an open dialog, by handing the component's
// first states in order: the step, the event, the date, the kind, the dialog. Each render takes them once.
const states = vi.hoisted(() => ({ queue: [] as unknown[] }));
vi.mock("react", async (importOriginal) => {
  const R = await importOriginal<typeof import("react")>();
  return { ...R, useState: ((v: unknown) => R.useState(states.queue.length ? states.queue.shift() : v)) as typeof R.useState };
});
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// Full, no waitlist (the user, 2026-11-13: "add an option to show that a session is fully booked see you on the next
// session/saturday without hiding the session so people don't think it has cancelled"), on the website as in the booking
// app (_sessFb): a session staff closed with bike_slots._fbk is still listed, said Fully booked, with See you next Saturday
// on the Saturday ride and See you at the next session on any other, and nothing books it. Which rows are such a session,
// and the read that brings them: rides.test.ts. Here: the cards and the next date, what Experiences gives its steps and
// draws, the Events page, and the words.

const FB = { status: "closed", cancelled_at: null, draft: false, opens_at: null };
const comm = (id: string, kind: string, slots: string, more: Record<string, unknown> = {}) => ({
  id, session_date: id.slice(0, 10), status: "open", event_kind: "community", ride_kind: kind, title: null, open_to_all: false, paid_ride: false,
  needs_approval: false, hide_queue: true, capacity: 15, bike_slots: slots, location: null, meet_url: null, description: null,
  cancelled_at: null, draft: false, opens_at: null, ...more,
});
const SAT_FB = comm("2099-11-14", "saturday", '{"_time":"05:45 - 06:15","_fbk":1}', { ...FB, needs_approval: true, capacity: 40 });
const SAT = comm("2099-11-21", "saturday", '{"_time":"05:45 - 06:15"}', { needs_approval: true, capacity: 40 });
const YG_FB = comm("2099-11-15-yg", "yoga", '{"_time":"16:00 - 17:30","_fbk":1}', { ...FB, location: "SILKDEER" });
const RH_FB = comm("2099-11-16-rh", "runher", '{"_time":"06:00 - 06:30","_fbk":1}', { ...FB, capacity: 80 });
const RH = comm("2099-11-30-rh", "runher", '{"_time":"06:00 - 06:30"}', { capacity: 80 });
const VL_FB = comm("2099-11-17-vl", "vlap", '{"_time":"16:30 - 17:15","_fbk":1}', { ...FB, paid_ride: true, price: 150, capacity: 300 });
const VL = comm("2099-11-24-vl", "vlap", '{"_time":"16:30 - 17:15"}', { paid_ride: true, price: 150, capacity: 300 });
const jcc = (id: string, slots: string, more: Record<string, unknown> = {}) => ({ id, session_date: id.slice(0, 10), status: "open", event_kind: null, ride_kind: null, title: null, capacity: 40, bike_slots: slots, location: "JCC", meet_url: null, cancelled_at: null, draft: false, opens_at: null, ...more });
const JCC_FB = jcc("2099-11-18", '{"_time":"21:00 - 23:00","_fbk":1}', FB);
const JCC = jcc("2099-11-22", '{"_time":"21:00 - 23:00"}');
// staff's plain close, a night called off with the mark still on it, a draft and one on its timer: none is listed
const SHUT = jcc("2099-11-19", '{"_time":"21:00 - 23:00"}', { status: "closed" });
const OFF = jcc("2099-11-20", '{"_time":"21:00 - 23:00","_fbk":1}', { ...FB, cancelled_at: "2099-11-10T09:00:00+00:00" });
const DRAFT = jcc("2099-11-20-d", '{"_time":"21:00 - 23:00","_fbk":1}', { ...FB, draft: true });
const TIMED = jcc("2099-11-20-t", '{"_time":"21:00 - 23:00","_fbk":1}', { ...FB, opens_at: "2099-11-12T18:00:00+00:00" });
const booking = (sessionId: string, o: Record<string, unknown> = {}) => ({ id: `q-${sessionId}`, customer_id: "c1", session_id: sessionId, session_date: sessionId.slice(0, 10), session_day: "Saturday", status: "waiting", approval: null, partner: null, queue_num: 3, name: "Ann", ...o });
const ACCOUNT = "c1~a1b2c3d4e5f6a7b8c9d0";

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
/** Every element of `type` in a tree a page returned, its own children unrendered. */
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
/** A page's database: the sessions through list_sessions, the account's bookings, nothing for anything else. */
const db = (sessions: unknown[], bookings: unknown[] = []) => vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/rpc/list_sessions")) return json(sessions);
  if (url.includes("/rpc/my_bookings")) return json(bookings);
  if (url.includes("/rpc/community_member")) return json(!!jar.account);
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
type Props = Parameters<typeof ExperienceSteps>[0];
const experiences = async (sessions: unknown[], locale = "en", bookings: unknown[] = []) => {
  resetRides(); // each page reads its own sessions, never the minute's copy of the last
  vi.stubGlobal("fetch", db(sessions, bookings));
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }) });
  const props = (findAll(page, ExperienceSteps)[0] as ReactElement<Props>).props;
  return { props, dates: props.events.flatMap((e) => e.sessions) };
};
const eventsPage = async (sessions: unknown[], locale = "en") => {
  resetRides();
  vi.stubGlobal("fetch", db(sessions));
  const page = await EventsPage({ params: Promise.resolve({ locale }) });
  return renderToStaticMarkup((page.props as { children: ReactElement }).children);
};
/** The steps drawn with their first states handed in (states.queue). */
const draw = (props: Props, ...first: unknown[]) => {
  states.queue = [...first];
  try { return renderToStaticMarkup(createElement(ExperienceSteps, props)); } finally { states.queue = []; }
};
/** The date step of an event's card. */
const dateStep = (props: Props, key = "community") => draw(props, 2, props.events.find((e) => e.key === key));
/** The fully booked cards on a date step, each from its opening tag to its end (it holds no div of its own). */
const fbkCards = (html: string) => html.match(/<div class="sc-card fbk[^"]*">.*?<\/div>/g) ?? [];
const text = (html: string | undefined) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const CAL = '<svg class="mm-ic" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.6" y="5.2" width="16.8" height="15.2" rx="2.6"></rect><path d="M3.6 10.1h16.8M8.2 3.2v4M15.8 3.2v4"></path></svg>';

beforeEach(() => {
  resetRides(); resetSiteContent();
  jar.account = ""; states.queue = [];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the event cards and the next date (lib/event-info.ts)", () => {
  const d = (id: string, kind: "runher" | "jcc" | "saturday", fbk = false) => ({ id, kind, fbk });
  it("never brings back a card that shows only while it has dates: it needs one that may be booked (_runHerLive)", () => {
    const keys = (all: ReturnType<typeof d>[]) => eventCards(all, { member: true, petromin: false }).map((c) => c.card.key);
    expect(keys([d("rh", "runher", true)])).toEqual(["community", "jcc"]);
    expect(keys([d("rh", "runher", true), d("rh2", "runher")])).toEqual(["community", "runher", "jcc"]);
    // and lists the full date under the card that shows, in its place
    expect(eventCards([d("rh", "runher", true), d("rh2", "runher")], { member: true, petromin: false }).find((c) => c.card.key === "runher")!.sessions.map((s) => s.id)).toEqual(["rh", "rh2"]);
    // the cards that always show list it too
    expect(eventCards([d("j", "jcc", true), d("s", "saturday", true)], { member: false, petromin: false }).map((c) => [c.card.key, c.sessions.map((s) => s.id)])).toEqual([["community", ["s"]], ["jcc", ["j"]]]);
  });
  it("takes the first date that may be booked as the next one (_infoNextOf)", () => {
    expect(nextOpen([d("a", "jcc", true), d("b", "jcc"), d("c", "jcc")])?.id).toBe("b");
    expect(nextOpen([d("a", "jcc", true)])).toBeUndefined();
    expect(nextOpen([])).toBeUndefined();
    const before: { id: string; fbk?: boolean }[] = [{ id: "x" }]; // a copy from before the field: may be booked
    expect(nextOpen(before)).toEqual({ id: "x" });
  });
  it("says Fully booked for its places, on a ride staff approve too, and what it said before on any other date", () => {
    const t = { waitlist: "Waitlist", left1: "{0} spot left", leftN: "{0} spots left", fbk: "Fully booked" };
    expect(infoPlaces({ fbk: true, approval: true, full: false, left: null }, t)).toBe("Fully booked");
    expect(infoPlaces({ fbk: true, approval: false, full: false, left: null, kind: "vlap" }, t)).toBe("Fully booked");
    expect(infoPlaces({ fbk: false, approval: false, full: false, left: 2 }, t)).toBe("2 spots left");
    expect(infoPlaces({ approval: false, full: true, left: null }, t)).toBe("Waitlist");
    expect(infoPlaces({ approval: true, full: false, left: null }, t)).toBeNull();
  });
});

describe("what Experiences gives its steps", () => {
  it("lists a date closed as fully booked in its event's dates, with where to go next, and no other closed one", async () => {
    const { props, dates } = await experiences([SAT_FB, YG_FB, SAT, JCC_FB, JCC, SHUT, OFF, DRAFT, TIMED]);
    expect(dates.map((s) => s.id).sort()).toEqual([SAT_FB.id, YG_FB.id, SAT.id, JCC_FB.id, JCC.id].sort());
    const by = Object.fromEntries(dates.map((s) => [s.id, s]));
    expect(by[SAT_FB.id]).toMatchObject({ fbk: "See you next Saturday", full: false, opens: null, left: null });
    expect(by[YG_FB.id]).toMatchObject({ fbk: "See you at the next session", full: false });
    expect(by[JCC_FB.id]).toMatchObject({ fbk: "See you at the next session", full: false, left: null });
    for (const id of [SAT_FB.id, YG_FB.id, JCC_FB.id]) expect(by[id].info.places, id).toBe("Fully booked"); // a ride staff approve too
    for (const id of [SAT.id, JCC.id]) expect("fbk" in by[id], id).toBe(false);
    expect(props.text.fbk).toBe("Fully booked");
  });
  it("shows no card for an event whose only dates are fully booked, and lists them under one that shows", async () => {
    const only = (await experiences([RH_FB, JCC])).props;
    expect(only.events.map((e) => e.key)).toEqual(["community", "jcc"]);
    expect(JSON.stringify(only)).not.toContain(RH_FB.id);
    const both = (await experiences([RH_FB, RH, JCC])).props;
    expect(both.events.find((e) => e.key === "runher")!.sessions.map((s) => [s.id, s.fbk ?? null])).toEqual([[RH_FB.id, "See you at the next session"], [RH.id, null]]);
  });
  it("says the soonest date that may be booked on Victory Lap's card, never the fully booked one", async () => {
    const vl = (await experiences([VL_FB, VL])).props.events.find((e) => e.key === "vlap")!;
    expect(vl.sessions.map((s) => s.id)).toEqual([VL_FB.id, VL.id]);
    expect(vl.line?.[0]).toBe("24 Nov");
  });
});

describe("the date step", () => {
  it("draws a fully booked date as no choice: no button and no radio, its day and time, Fully booked in the full red, where to go next", async () => {
    const html = dateStep((await experiences([SAT_FB, SAT])).props);
    const [card, ...more] = fbkCards(html);
    expect(more).toEqual([]);
    expect(card).toMatch(/^<div class="sc-card fbk ev-saturday has-motif">/);
    expect(card).toContain('<span class="sc-spots full fbk">Fully booked</span>');
    expect(card).toContain(`<span class="sc-meta sc-fbk-l">${CAL}<bdi>See you next Saturday</bdi></span>`);
    expect(text(card)).toMatch(/^Saturday Social Ride Saturday · 14 Nov 2099 Fully booked Gathering 5:45 AM · Start 6:15 AM See you next Saturday$/);
    for (const no of ["role=", "tabindex", "aria-checked", "<button", "disabled", " closed", "sc-card fbk ev-saturday full"]) expect(card, no).not.toContain(no);
    // the date that may be booked is a radio as before, and holds the group's tab stop
    expect(html).toMatch(new RegExp(`<button type="button" class="sc-card ev-saturday has-motif" role="radio" aria-checked="false" tabindex="0" data-id="${SAT.id}"`));
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
  });
  it("draws the plain card on any kind, never the kind's own: yoga says See you at the next session", async () => {
    const html = dateStep((await experiences([YG_FB, SAT])).props);
    const [card] = fbkCards(html);
    expect(card).toMatch(/^<div class="sc-card fbk ev-yoga">/);
    expect(card).not.toContain("sc-yoga");
    expect(text(card)).toMatch(/Fully booked .*See you at the next session$/);
  });
  it("keeps its Details beside it, which say Fully booked for its places and offer no Choose this date", async () => {
    const { props } = await experiences([JCC_FB, JCC]);
    const html = dateStep(props, "jcc");
    expect(html).toMatch(new RegExp(`<div class="sc-wrap ev-jcc has-about"><div class="sc-card fbk ev-jcc">.*?</div><button type="button" class="sc-about"`));
    const ev = props.events.find((e) => e.key === "jcc")!;
    const fb = ev.sessions.find((s) => s.id === JCC_FB.id)!, open = ev.sessions.find((s) => s.id === JCC.id)!;
    const dialog = (s: StepSession) => /<dialog .*<\/dialog>/.exec(draw(props, 2, ev, null, null, { ev, s }))?.[0] ?? "";
    expect(text(dialog(fb))).toContain("Places Fully booked");
    expect(dialog(fb)).not.toContain("xs-info-go");
    expect(dialog(open)).toContain('<button type="button" class="xs-info-go">Choose this date</button>');
  });
  it("names the next date that may be booked in the community card's About", async () => {
    const { props } = await experiences([SAT_FB, SAT]);
    const ev = props.events.find((e) => e.key === "community")!;
    const about = text(/<dialog .*<\/dialog>/.exec(draw(props, 1, null, null, null, { ev, s: null }))?.[0]);
    expect(about).toContain("Next date Saturday Social Ride · Saturday · 21 Nov 2099");
    expect(about).not.toContain("14 Nov");
  });
  it("says the visitor's own place instead, with no line under it, on a date they hold", async () => {
    jar.account = ACCOUNT;
    const html = dateStep((await experiences([JCC_FB, SAT], "en", [booking(JCC_FB.id)])).props, "jcc");
    const [card] = fbkCards(html);
    expect(card).toContain('<span class="sc-spots held" data-held="ok">');
    expect(text(card)).toMatch(/Booked/);
    for (const no of ["Fully booked", "See you", "sc-fbk-l"]) expect(card, no).not.toContain(no);
  });
  it("says Fully booked over when it opens, the waitlist and the places left", async () => {
    const { props } = await experiences([JCC_FB]);
    const with_ = (o: Partial<StepSession>) => dateStep({ ...props, events: props.events.map((e) => ({ ...e, sessions: e.sessions.map((s) => ({ ...s, ...o })) })) }, "jcc");
    for (const o of [{ opens: "Booking opens Sunday · 9 PM", opensAt: null }, { full: true }, { left: 2 }] as Partial<StepSession>[]) {
      const [card = ""] = fbkCards(with_(o));
      expect(card.match(/class="sc-spots[^"]*"/g), JSON.stringify(o)).toEqual(['class="sc-spots full fbk"']);
    }
  });
  it("says it in Arabic, the line in its own direction", async () => {
    const [card] = fbkCards(dateStep((await experiences([SAT_FB, SAT], "ar")).props));
    expect(card).toContain('<span class="sc-spots full fbk">محجوز بالكامل</span>');
    expect(card).toContain(`${CAL}<bdi>نراك السبت القادم</bdi>`);
  });
});

describe("a Featured card of a fully booked date", () => {
  it("says Fully booked where its places would be said, and stays a card that opens its event's dates", async () => {
    const html = draw((await experiences([YG_FB, SAT])).props);
    const card = /<button type="button" class="xs-feat-card[^"]*".*?<\/button>/.exec(/<section class="xs-feat".*?<\/section>/.exec(html)?.[0] ?? "")?.[0] ?? "";
    expect(card).toMatch(/^<button type="button" class="xs-feat-card ev-yoga xs-feat-yg">/);
    expect(card).toContain('<span class="sc-spots full fbk">Fully booked</span>');
    expect(card).not.toContain("disabled");
    expect(card).not.toContain("See you"); // the booking app's Featured card says the state alone
  });
});

describe("the Events page", () => {
  it("lists a session closed as fully booked, never faded, Fully booked among its tags, where to go next under them, and no Book", async () => {
    const html = await eventsPage([JCC_FB, JCC, SAT_FB, SHUT, OFF, DRAFT, TIMED]);
    // each row, from its own tag (never the list's, pg-events) to its body's end and its Book when it has one
    const rows = html.match(/<div class="pg-event(?: [^"]*)?" style="[^"]*">.*?<\/div><\/div>(?:<a [^>]*>.*?<\/a>)?/g) ?? [];
    expect(rows).toHaveLength(3);
    const row = (id: string) => rows.find((r) => r.includes(`session=${id}`)) ?? "";
    const fb = rows.filter((r) => r.includes("is-fbk"));
    expect(fb).toHaveLength(2);
    for (const r of fb) {
      expect(r).toMatch(/^<div class="pg-event is-fbk"/);
      expect(r).toContain('<em class="fbk">Fully booked</em>');
      expect(r).not.toContain("<a ");
      expect(r).not.toContain("is-closed");
    }
    expect(text(fb.find((r) => r.includes("Saturday Social Ride")))).toMatch(/Fully booked See you next Saturday$/);
    expect(text(fb.find((r) => !r.includes("Saturday Social Ride")))).toMatch(/Fully booked See you at the next session$/);
    expect(fb[0]).toContain(`<p class="pg-event-fbk">${CAL}<span>`);
    // the night that may be booked keeps its Book
    expect(row(JCC.id)).toMatch(/<a href="[^"]*session=2099-11-22[^"]*">Book/);
    // and the circuit night's full date reads as sold out to search engines
    expect(html).toContain("https://schema.org/SoldOut");
  });
  it("says it in Arabic", async () => {
    const html = await eventsPage([SAT_FB], "ar");
    expect(html).toContain('<em class="fbk">محجوز بالكامل</em>');
    expect(html).toContain(`<p class="pg-event-fbk">${CAL}<span>نراك السبت القادم</span></p>`);
  });
});

describe("the words", () => {
  // the booking app's sessFbk, sessFbkSat and sessFbkNext, word for word in the languages it speaks
  const APP: Record<string, [string, string, string]> = {
    es: ["Completa", "Nos vemos el próximo sábado", "Nos vemos en la próxima sesión"], fr: ["Complète", "À samedi prochain", "À la prochaine séance"],
    pt: ["Lotada", "Até o próximo sábado", "Até a próxima sessão"], tl: ["Puno na", "Kita-kits sa susunod na Sabado", "Kita-kits sa susunod na session"],
    hi: ["पूरी तरह भरा", "अगले शनिवार मिलते हैं", "अगले सत्र में मिलते हैं"], ne: ["पूरै भरियो", "अर्को शनिबार भेटौँला", "अर्को सत्रमा भेटौँला"],
    bn: ["পুরোপুরি বুক", "আগামী শনিবার দেখা হবে", "পরের সেশনে দেখা হবে"], ur: ["مکمل بھرا", "اگلے ہفتے کی رائیڈ پر ملتے ہیں", "اگلے سیشن میں ملتے ہیں"],
  };
  const EN = ["Fully booked", "See you next Saturday", "See you at the next session"] as const;
  it("are the booking app's in the languages it speaks", async () => {
    for (const [code, want] of Object.entries(APP)) expect(EN.map((k) => dictOf(code)![k]), code).toEqual(want);
    const ar = (await experiences([SAT_FB, YG_FB], "ar")).dates;
    expect(ar.map((s) => s.fbk).sort()).toEqual(["نراك السبت القادم", "نراك في الجلسة القادمة"].sort());
  });
  it("are said in every language the site translates, short, with no emoji", () => {
    for (const code of TRANSLATED) {
      for (const k of EN) {
        const v = dictOf(code)![k];
        expect(v?.trim(), `${code} ${k}`).toBeTruthy();
        expect(v.length, `${code} ${v}`).toBeLessThanOrEqual(40);
        expect(v, code).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });
});

describe("the look", () => {
  const booking = readFileSync(new URL("../../components/booking/booking.css", import.meta.url), "utf8");
  const pages = readFileSync(new URL("../../components/pages/pages.css", import.meta.url), "utf8");
  it("never greys or fades it, and takes away the pointer and the hover glow of a choice", () => {
    const fbk = booking.match(/\.sc-card\.fbk[^{]*\{[^}]*\}/g) ?? [];
    expect(fbk).toEqual([".sc-card.fbk { cursor: default; }", ".sc-card.fbk:hover { border-color: rgba(26, 25, 25, .14); box-shadow: none; }"]);
    expect(booking).toContain(".sc-spots.full { color: #a33b2e; }");
    expect(pages).toContain(".pg-event-meta em.fbk { background: rgba(163, 59, 46, .1); color: #a33b2e; }");
    expect(`${booking}\n${pages}`).not.toMatch(/(?:\.fbk|is-fbk)[^{]*\{[^}]*opacity/);
  });
});
