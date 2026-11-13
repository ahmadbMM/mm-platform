import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps, { type StepSession } from "@/components/experiences/ExperienceSteps";
import { KIND_THEME_WORDS } from "@/components/experiences/KindTheme.words";
import { LOCALE_CODES } from "@/i18n/locales";
import { heldRows, heldState, type Held } from "../held";
import { rowsOfKind } from "../kind-theme";
import { loadRides, resetRides, toSession } from "../rides";
import { memoSettled } from "../memo";
import { resetSiteContent } from "../site";
import { fmtDayDate, fmtDayNoYear, ticketCue, ticketSession, type TicketRow } from "../tickets";
import ExperiencesPage from "../../app/[locale]/experiences/page";

// cookies() is a request's; here it holds the account's cookie a test sets, or none.
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// The owner's picks 4 and 7 from the Featured follow-ups (2026-11-13), on the website's Experiences as in the booking
// app: a date the signed-in visitor already holds says Booked, On the waitlist or Reserved where its places would be
// said (the booking app's _heldSt), and a date card says its day without the year while that is this year's (its
// _dayNoYear). Here: the rule, what the page reads and gives the steps, what a Featured card draws, the words, the look.

const row = (o: Partial<TicketRow> = {}): Pick<TicketRow, "status" | "approval" | "partner"> => ({ status: "waiting", approval: null, partner: null, ...o });
const PLAIN = { approval: false, published: false }; // a date nobody approves: a circuit night, the pool, yoga
const HELD_BACK = { approval: true, published: false }; // a ride staff approve, its list not out
const OUT = { approval: true, published: true }; // and with its list out

describe("what an account holds on a date (the booking app's _heldSt)", () => {
  it("holds nothing without a live booking there", () => {
    expect(heldState([], PLAIN)).toBeNull();
    expect(heldState([], OUT)).toBeNull();
    expect(heldState([row({ status: "done" })], PLAIN)).toBeNull();
    expect(heldState([row({ status: "done", approval: "approved" })], OUT)).toBeNull();
  });
  it("is Booked on a date nobody approves, and On the waitlist when every rider of theirs waits", () => {
    expect(heldState([row()], PLAIN)).toBe("ok");
    expect(heldState([row({ status: "waitlist" })], PLAIN)).toBe("wl");
    expect(heldState([row({ status: "waitlist" }), row({ status: "waitlist" })], PLAIN)).toBe("wl");
    expect(heldState([row(), row({ status: "waitlist" })], PLAIN)).toBe("ok"); // one of theirs has a place
    expect(heldState([row({ approval: "pending" })], PLAIN)).toBe("ok"); // nobody approves it: its mark is not asked
    expect(heldState([row({ status: "done" }), row({ status: "waitlist" })], PLAIN)).toBe("wl"); // a finished row holds nothing
  });
  it("is Booked once a rider of theirs is checked in, whatever the date", () => {
    for (const s of [PLAIN, HELD_BACK, OUT]) {
      expect(heldState([row({ status: "active" })], s)).toBe("ok");
      expect(heldState([row({ status: "waitlist" }), row({ status: "active" })], s)).toBe("ok");
    }
  });
  it("is Reserved on a ride staff approve until its list is out: nobody is told a verdict before that", () => {
    expect(heldState([row()], HELD_BACK)).toBe("rsv");
    expect(heldState([row({ approval: "approved" })], HELD_BACK)).toBe("rsv");
    expect(heldState([row({ status: "waitlist" })], HELD_BACK)).toBe("rsv");
    expect(heldState([row({ approval: "pending" }), row({ status: "waitlist" })], HELD_BACK)).toBe("rsv");
    // a list not known to be out (a session read without the column, an older copy) reads as not out
    expect(heldState([row({ approval: "approved" })], { approval: true })).toBe("rsv");
  });
  it("says the verdict once the list is out: Booked when every rider of theirs is approved, On the waitlist when all wait, else Reserved", () => {
    expect(heldState([row({ approval: "approved" })], OUT)).toBe("ok");
    expect(heldState([row({ approval: "approved" }), row({ approval: "approved" })], OUT)).toBe("ok");
    expect(heldState([row({ approval: "pending" })], OUT)).toBe("rsv");
    expect(heldState([row()], OUT)).toBe("rsv");
    expect(heldState([row({ approval: "approved" }), row({ approval: "pending" })], OUT)).toBe("rsv");
    expect(heldState([row({ status: "waitlist" })], OUT)).toBe("wl");
    expect(heldState([row({ status: "waitlist", approval: "approved" }), row({ status: "waitlist" })], OUT)).toBe("wl");
    expect(heldState([row({ approval: "approved" }), row({ status: "waitlist" })], OUT)).toBe("rsv"); // one waits, unapproved
  });
  it("takes a partner's booking as confirmed when made, list out or not", () => {
    expect(heldState([row({ partner: "defe" })], HELD_BACK)).toBe("ok");
    expect(heldState([row({ partner: "defe" }), row({ partner: "defe" })], OUT)).toBe("ok");
    expect(heldState([row({ partner: "defe", status: "waitlist" })], HELD_BACK)).toBe("wl");
    // not when one of theirs is no partner's: the ride's own rule
    expect(heldState([row({ partner: "defe" }), row()], HELD_BACK)).toBe("rsv");
  });
  it("says what the ticket's cue says for a rider (lib/tickets.ts ticketCue)", () => {
    const sat = { id: "2099-03-04", session_date: "2099-03-04", event_kind: "community", ride_kind: "saturday", needs_approval: true, hide_queue: true, bike_slots: '{"_time":"05:45 - 06:15"}' };
    const full = (o: Partial<TicketRow>): TicketRow => ({ id: "q1", sessionId: sat.id, date: sat.session_date, day: "Wednesday", queueNum: 4, status: "waiting", waitlistNum: null, approval: null, price: 0, paid: false, name: "Ann", type: "Road", checkedInAt: null, checkedOutAt: null, rideDuration: null, bikeId: null, addonLines: [], runKm: null, ...o });
    const cueOf: Record<string, Held> = { confirmed: "ok", underReview: "rsv", pending: "rsv", waitlist: "wl" };
    for (const hide of [true, false]) {
      const s = ticketSession({ ...sat, hide_queue: hide })!;
      for (const r of [full({}), full({ approval: "approved" }), full({ approval: "pending" }), full({ status: "waitlist" }), full({ partner: "defe" })]) {
        expect(heldState([r], s), `${hide} ${r.status} ${r.approval} ${r.partner}`).toBe(cueOf[ticketCue([r], s, null) ?? ""]);
      }
    }
  });
});

describe("the account's bookings, by session (my_bookings' rows as the ticket reads them)", () => {
  const b = (o: Record<string, unknown>) => ({ id: "q1", session_id: "2099-11-16", session_date: "2099-11-16", status: "waiting", approval: null, ...o });
  it("keeps the live ones: waiting, on the waitlist and checked in", () => {
    const by = heldRows([b({}), b({ id: "q2", status: "waitlist" }), b({ id: "q3", session_id: "2099-11-21-yg", session_date: "2099-11-21", status: "active" }),
      b({ id: "q4", status: "done" }), b({ id: "q5", status: "cancelled" }), b({ id: "q6", status: "noshow" }), b({ id: "q7", status: "removed" })]);
    expect([...by.keys()]).toEqual(["2099-11-16", "2099-11-21-yg"]);
    expect(by.get("2099-11-16")!.map((r) => [r.id, r.status])).toEqual([["q1", "waiting"], ["q2", "waitlist"]]);
    expect(by.get("2099-11-21-yg")!.map((r) => r.status)).toEqual(["active"]);
  });
  it("reads the approval and the partner the rule asks for", () => {
    const [r] = heldRows([b({ approval: "approved", partner: "defe" })]).get("2099-11-16")!;
    expect([r.approval, r.partner]).toEqual(["approved", "defe"]);
  });
  it("holds nothing when the answer is no list, and leaves out a row it cannot read", () => {
    for (const v of [null, undefined, "", 0, {}, { message: "BAD_TOKEN" }]) expect(heldRows(v).size).toBe(0);
    expect(heldRows([null, 3, "x", [], {}, b({ session_date: "soon" }), b({ status: 1 })]).size).toBe(0);
  });
});

describe("whether a ride's list is out (sessions.hide_queue, the booking app's _commPublished)", () => {
  const AT = Date.parse("2026-10-27T09:00:00Z");
  const base = { id: "2026-10-31", session_date: "2026-10-31", status: "open", title: null, event_kind: "community", ride_kind: "saturday", bike_slots: '{"_time":"05:45 - 06:15"}', open_to_all: false, paid_ride: false, needs_approval: true };
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  beforeEach(() => {
    resetRides();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("is read on a community date alone, out only when hide_queue is false", () => {
    expect(toSession({ ...base, hide_queue: false })!.published).toBe(true);
    for (const v of [true, null, undefined, "false", 0]) expect(toSession({ ...base, hide_queue: v })!.published, String(v)).toBe(false);
    expect(toSession({ ...base, event_kind: null, ride_kind: null, hide_queue: false })!.published).toBe(false); // a circuit night
    expect(toSession({ ...base, ride_kind: "snd96", hide_queue: false })!.published).toBe(false); // never the National Day ride
    expect("published" in toSession(base)!).toBe(false); // a read that did not ask for the column
  });
  it("is asked of the public read as a group of its own, and the sessions are read on without it when the database refuses the column", async () => {
    const f = vi.fn(async (url: string) => (url.includes("ride_prices") ? json([])
      : url.includes("hide_queue") ? json({ code: "42703", message: "column list_sessions.hide_queue does not exist" }, 400) : json([base])));
    const r = await loadRides(f as unknown as typeof fetch, AT);
    const reads = f.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/rpc/list_sessions?"));
    expect(reads).toHaveLength(2);
    expect(reads[0]).toContain(",title_ar,out_bikes,hide_queue&session_date=gte.2026-10-27");
    expect(reads[1]).toContain(",title_ar,out_bikes&session_date=gte.2026-10-27");
    expect(r!.sessions.map((s) => [s.id, s.approval, s.published])).toEqual([["2026-10-31", true, undefined]]);
    await memoSettled();
  });
});

describe("the day without its year (the booking app's _dayNoYear)", () => {
  it("leaves the year out when it is this year's in Riyadh", () => {
    expect(fmtDayNoYear("2026-11-14", "en", "2026-11-13")).toBe("Saturday · 14 Nov");
    expect(fmtDayNoYear("2026-12-31", "en", "2026-01-01")).toBe("Thursday · 31 Dec");
    expect(fmtDayNoYear("2026-11-14", "ar", "2026-11-13")).toBe("السبت · 14 نوفمبر");
    expect(fmtDayNoYear("2026-11-14", "ar", "2026-11-13")).not.toMatch(/2026/);
    for (const locale of LOCALE_CODES) expect(fmtDayNoYear("2026-11-14", locale, "2026-11-13"), locale).not.toMatch(/2026|٢٠٢٦/);
  });
  it("keeps the year when it is another: a January date seen in December says its year", () => {
    expect(fmtDayNoYear("2027-01-02", "en", "2026-12-28")).toBe("Saturday · 2 Jan 2027");
    expect(fmtDayNoYear("2027-01-02", "en", "2026-12-28")).toBe(fmtDayDate("2027-01-02", "en"));
    expect(fmtDayNoYear("2025-12-31", "en", "2026-01-01")).toBe(fmtDayDate("2025-12-31", "en"));
    for (const locale of LOCALE_CODES) expect(fmtDayNoYear("2027-01-02", locale, "2026-12-28"), locale).toBe(fmtDayDate("2027-01-02", locale));
    // a today that cannot be read keeps the year, and a date that cannot be read is given as stored
    expect(fmtDayNoYear("2026-11-14", "en", "")).toBe("Saturday · 14 Nov 2026");
    expect(fmtDayNoYear("not a date", "en", "2026-11-13")).toBe("not a date");
  });
  it("leaves a ticket's and every record's day as it was", () => {
    expect(fmtDayDate("2026-11-14", "en")).toBe("Saturday · 14 Nov 2026");
    expect(fmtDayDate("2099-03-01", "en")).toBe("Sunday · 1 Mar 2099");
  });
});

// The page, with its database stubbed: the sessions through list_sessions, the account's bookings through my_bookings,
// the tags it holds, nothing for anything else.
const comm = (id: string, kind: string, slots: string, more: Record<string, unknown> = {}) => ({
  id, session_date: id.slice(0, 10), status: "open", event_kind: "community", ride_kind: kind, title: null, open_to_all: false, paid_ride: false,
  needs_approval: false, hide_queue: true, capacity: 15, bike_slots: slots, location: null, meet_url: null, description: null, ...more,
});
const YG = comm("2099-11-21-yg", "yoga", '{"_time":"16:00 - 17:30"}', { location: "SILKDEER" });
const SAT = comm("2099-11-16", "saturday", '{"_time":"05:45 - 06:15","_feat":1}', { needs_approval: true, capacity: 40 });
const SAT_OUT = { ...SAT, hide_queue: false };
const SWIM = comm("2099-11-18-sw", "swim", '{"_time":"07:00 - 08:00"}');
const NEXT_YEAR = comm("2100-01-02", "saturday", '{"_time":"05:45 - 06:15"}', { needs_approval: true, capacity: 40 });
const JCC = { id: "2099-11-22", session_date: "2099-11-22", status: "open", event_kind: null, ride_kind: null, title: null, capacity: 40, bike_slots: '{"_time":"21:00 - 23:00"}', location: "JCC", meet_url: null };
const booking = (sessionId: string, o: Record<string, unknown> = {}) => ({ id: `q-${sessionId}`, customer_id: "c1", session_id: sessionId, session_date: sessionId.slice(0, 10), session_day: "Saturday", status: "waiting", approval: null, partner: null, queue_num: 3, name: "Ann", ...o });
const ACCOUNT = "c1~a1b2c3d4e5f6a7b8c9d0";

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
/** `bookings`: my_bookings' answer, a status for a refusal, or "down" for no answer at all. */
const db = (sessions: unknown[], bookings: unknown = []) => vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/rpc/list_sessions")) return json(sessions);
  if (url.includes("/rpc/my_bookings")) {
    if (bookings === "down") throw new TypeError("fetch failed");
    return typeof bookings === "number" ? json({ code: "P0001", message: "BAD_TOKEN" }, bookings) : json(bookings);
  }
  if (url.includes("/rpc/community_member")) return json(!!jar.account);
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
type Steps = ReactElement<Parameters<typeof ExperienceSteps>[0]>;
const experiences = async (sessions: unknown[], bookings: unknown = [], locale = "en") => {
  resetRides(); // each page reads its own sessions, never the minute's copy of the last
  const f = db(sessions, bookings);
  vi.stubGlobal("fetch", f);
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) });
  const steps = findAll(page, ExperienceSteps)[0] as Steps;
  const dates = steps.props.events.flatMap((e) => e.sessions);
  return { f, steps, props: steps.props, dates, held: Object.fromEntries(dates.filter((s) => s.held).map((s) => [s.id, s.held])), html: renderToStaticMarkup(steps) };
};
const asked = (f: ReturnType<typeof db>, fn: string) => f.mock.calls.filter(([u]) => String(u).includes(`/rpc/${fn}`));
const section = (html: string) => /<section class="xs-feat".*?<\/section>/.exec(html)?.[0] ?? "";
const cardsIn = (html: string) => section(html).match(/<button type="button" class="xs-feat-card[^"]*".*?<\/button>/g) ?? [];
const text = (html: string | undefined) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const TICK = '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg>';

beforeEach(() => {
  resetRides(); resetSiteContent();
  jar.account = "";
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

// staging: Experiences is its own booking flow (BookingFlow), not main's ExperienceSteps page, which these read; they run on main
describe.skip("what the page reads", () => {
  it("costs a visitor who is not signed in no read: nobody's bookings are asked for, and no date is held", async () => {
    const { f, dates, held, html } = await experiences([YG, SAT, SWIM, JCC], [booking(YG.id)]);
    expect(asked(f, "my_bookings")).toEqual([]);
    expect(dates.length).toBe(4);
    expect(held).toEqual({});
    expect(dates.every((s) => !("held" in s))).toBe(true);
    expect(html).not.toContain("data-held");
  });
  it("asks for the account's bookings once, with the cookie's own id and token", async () => {
    jar.account = ACCOUNT;
    const { f, held } = await experiences([YG, SAT, SWIM, JCC], [booking(YG.id)]);
    const calls = asked(f, "my_bookings");
    expect(calls.length).toBe(1);
    expect(String(calls[0][0])).toBe("https://example.supabase.co/rest/v1/rpc/my_bookings");
    expect(JSON.parse(String((calls[0][1] as RequestInit).body))).toEqual({ p_id: "c1", p_token: "a1b2c3d4e5f6a7b8c9d0" });
    expect(held).toEqual({ [YG.id]: "ok" });
  });
  it("draws the page as for anyone when the bookings cannot be read: a refusal, no answer, an answer that is no list", async () => {
    jar.account = ACCOUNT;
    const plain = (await experiences([YG, SAT, SWIM, JCC])).html;
    for (const bookings of [401, 500, "down", { message: "x" }, null]) {
      const { held, html, dates } = await experiences([YG, SAT, SWIM, JCC], bookings);
      expect(held, String(bookings)).toEqual({});
      expect(dates.length, String(bookings)).toBe(4);
      expect(html, String(bookings)).toBe(plain);
    }
    expect(plain).not.toContain("data-held");
  });
});

// staging: Experiences is its own booking flow (BookingFlow), not main's ExperienceSteps page, which these read; they run on main
describe.skip("what the page gives the steps", () => {
  beforeEach(() => { jar.account = ACCOUNT; });

  it("marks each date the account holds, and no other: a finished or cancelled booking and one on a date off the page hold nothing", async () => {
    const { held, dates } = await experiences([YG, SAT, SWIM, JCC], [
      booking(YG.id), booking(JCC.id, { status: "active" }), booking(SWIM.id, { status: "done" }), booking(SAT.id, { status: "cancelled" }),
      booking("2099-12-01", {}), booking("2020-01-01", { status: "waitlist" }),
    ]);
    expect(held).toEqual({ [YG.id]: "ok", [JCC.id]: "ok" });
    expect(dates.filter((s) => "held" in s).map((s) => s.id).sort()).toEqual([JCC.id, YG.id].sort());
  });
  it("says On the waitlist when every rider of theirs waits", async () => {
    expect((await experiences([{ ...YG, status: "full" }, JCC], [booking(YG.id, { status: "waitlist" }), booking(JCC.id), booking(JCC.id, { id: "q2", status: "waitlist" })])).held).toEqual({ [YG.id]: "wl", [JCC.id]: "ok" });
  });
  it("says Reserved on a ride staff approve until its list is out, then the verdict", async () => {
    expect((await experiences([SAT], [booking(SAT.id, { approval: "approved" })])).held).toEqual({ [SAT.id]: "rsv" });
    expect((await experiences([SAT_OUT], [booking(SAT.id, { approval: "approved" })])).held).toEqual({ [SAT.id]: "ok" });
    expect((await experiences([SAT_OUT], [booking(SAT.id, { approval: "pending" })])).held).toEqual({ [SAT.id]: "rsv" });
    expect((await experiences([SAT_OUT], [booking(SAT.id, { status: "waitlist" })])).held).toEqual({ [SAT.id]: "wl" });
    expect((await experiences([SAT], [booking(SAT.id, { status: "waitlist" })])).held).toEqual({ [SAT.id]: "rsv" });
    expect((await experiences([SAT], [booking(SAT.id, { partner: "defe" })])).held).toEqual({ [SAT.id]: "ok" }); // a partner's place
    // a session that came without the column (an older copy, a database that refuses it): the list reads as not out
    const bare = Object.fromEntries(Object.entries(SAT_OUT).filter(([k]) => k !== "hide_queue"));
    expect((await experiences([bare], [booking(SAT.id, { approval: "approved" })])).held).toEqual({ [SAT.id]: "rsv" });
  });
  it("gives the browser the date's state and nothing of the booking itself", async () => {
    const { steps } = await experiences([SAT_OUT], [booking(SAT.id, { approval: "approved", name: "Ann Rider", phone: "0500000000" })]);
    const sent = JSON.stringify(steps.props);
    expect(sent).toContain('"held":"ok"');
    for (const secret of ["Ann Rider", "0500000000", `q-${SAT.id}`, "a1b2c3d4e5f6a7b8c9d0", "published", "hide_queue"]) expect(sent, secret).not.toContain(secret);
  });
  it("keeps the mark on a date when the kind switch narrows the list: the rows are the same dates", async () => {
    const { props } = await experiences([YG, SAT, SWIM], [booking(SWIM.id), booking(SAT.id)]);
    const all = props.events.find((e) => e.key === "community")!.sessions;
    expect(rowsOfKind(all, "swim").map((s) => [s.id, s.held])).toEqual([[SWIM.id, "ok"]]);
    expect(rowsOfKind(all, "saturday").map((s) => [s.id, s.held])).toEqual([[SAT.id, "rsv"]]);
    expect(rowsOfKind(all, "swim")[0]).toBe(all.find((s) => s.id === SWIM.id));
    expect(rowsOfKind(all, null).map((s) => s.held)).toEqual(all.map((s) => s.held));
  });
});

describe("the words", () => {
  // the booking app's tkStBooked, wlOnList and statusReserved, word for word in the ten languages it speaks
  const APP: Record<string, [string, string, string]> = {
    en: ["Booked", "On the waitlist", "Reserved"], ar: ["محجوز", "على قائمة الانتظار", "محجوز"], es: ["Reservado", "En lista de espera", "Reservada"],
    fr: ["Réservé", "Sur liste d’attente", "Réservé"], pt: ["Reservado", "Na lista de espera", "Reservada"], hi: ["बुक", "प्रतीक्षा सूची में", "आरक्षित"],
    ur: ["بک شدہ", "ویٹ لسٹ پر", "ریزرو"], bn: ["বুক করা", "ওয়েটিং লিস্টে", "রিজার্ভ করা"], ne: ["बुक भयो", "प्रतीक्षा सूचीमा", "आरक्षित"], tl: ["Naka-book", "Nasa waitlist", "Naka-reserve"],
  };
  // staging: Experiences is its own booking flow (BookingFlow), not main's ExperienceSteps page, which these read; they run on main
  it.skip("are the booking app's in the languages it speaks", async () => {
    for (const [locale, [ok, wl, rsv]] of Object.entries(APP)) {
      const { props } = await experiences([YG], [], locale);
      expect(props.text.held, locale).toEqual({ ok, wl, rsv });
    }
  });
  it("are said in every one of the site's languages, short as a mark is, with no emoji", () => {
    expect(Object.keys(KIND_THEME_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const [code, w] of Object.entries(KIND_THEME_WORDS)) {
      for (const v of [w.held.ok, w.held.wl, w.held.rsv]) {
        expect(v.trim(), code).not.toBe("");
        expect(v, code).toBe(v.trim());
        expect(v.length, `${code} ${v}`).toBeLessThanOrEqual(24);
        expect(v, code).not.toMatch(/\p{Extended_Pictographic}/u);
      }
      expect(w.held.ok, code).not.toBe(w.held.wl);
      if (code !== "en") expect([w.held.ok, w.held.wl, w.held.rsv], code).not.toEqual(APP.en);
    }
  });
});

// staging: Experiences is its own booking flow (BookingFlow), not main's ExperienceSteps page, which these read; they run on main
describe.skip("a Featured card of a date the visitor holds", () => {
  beforeEach(() => { jar.account = ACCOUNT; });

  it("says Booked with a drawn tick before it, where its places would be said", async () => {
    const [card] = cardsIn((await experiences([YG], [booking(YG.id)])).html);
    expect(card).toContain(`<span class="sc-spots held" data-held="ok">${TICK}<span>Booked</span></span>`);
    expect(text(card)).toBe("Sat 21 Nov Hatha Yoga for Cyclists 4 PM – 5:30 PM 90 min SILKDEER with Jassim Alsaady Booked");
    // inside the card's foot, after where and who; drawn, never an emoji; the card opens what it opened
    expect(card).toMatch(/<span class="xs-feat-foot"><span class="xs-feat-meta">.*<\/span><span class="sc-spots held" data-held="ok">/);
    expect(card).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(card).toMatch(/^<button type="button" class="xs-feat-card ev-yoga xs-feat-yg">/);
    expect(card).not.toContain("disabled");
  });
  it("says On the waitlist in place of Waitlist on a full date, and Reserved on a ride staff approve, neither with a tick", async () => {
    const [wl] = cardsIn((await experiences([{ ...YG, status: "full" }], [booking(YG.id, { status: "waitlist" })])).html);
    expect(wl).toContain('<span class="sc-spots held low" data-held="wl"><span>On the waitlist</span></span>');
    expect(wl).not.toContain('class="sc-spots full"');
    expect(text(wl)).not.toMatch(/Waitlist/);
    expect(wl).not.toContain("<path d=\"m5 12.5");
    const [rsv] = cardsIn((await experiences([SAT], [booking(SAT.id)])).html);
    expect(rsv).toContain('<span class="sc-spots held low" data-held="rsv"><span>Reserved</span></span>');
    expect(text(rsv)).toMatch(/Complimentary Reserved$/);
  });
  it("has one mark a card: the visitor's own wins over the waitlist, the places left and when it opens", async () => {
    const { props } = await experiences([YG], [booking(YG.id)]);
    const with_ = (o: Partial<StepSession>) => renderToStaticMarkup(createElement(ExperienceSteps, { ...props, events: props.events.map((e) => ({ ...e, sessions: e.sessions.map((s) => ({ ...s, ...o })) })) }));
    for (const o of [{ full: true }, { left: 2 }, { opens: "Booking opens Sunday · 9 PM", opensAt: null }] as Partial<StepSession>[]) {
      const card = cardsIn(with_(o))[0] ?? "";
      expect(card.match(/class="sc-spots[^"]*"/g), JSON.stringify(o)).toEqual(['class="sc-spots held"']);
      expect(text(card)).toMatch(/Booked$/);
      // and without a place of their own the card says what it said
      const was = cardsIn(with_({ ...o, held: undefined }))[0] ?? "";
      expect(was.match(/class="sc-spots[^"]*"/g), JSON.stringify(o)).toEqual([o.full ? 'class="sc-spots full"' : o.left ? 'class="sc-spots low"' : 'class="sc-spots closed"']);
    }
  });
  it("puts the tick before the word in reading order on an Arabic page, the word in a span, never a bdi", async () => {
    const [card] = cardsIn((await experiences([YG], [booking(YG.id)], "ar")).html);
    expect(card).toContain(`<span class="sc-spots held" data-held="ok">${TICK}<span>محجوز</span></span>`);
    const [ur] = cardsIn((await experiences([{ ...YG, status: "full" }], [booking(YG.id, { status: "waitlist" })], "ur")).html);
    expect(ur).toContain('<span class="sc-spots held low" data-held="wl"><span>ویٹ لسٹ پر</span></span>');
    for (const c of [card, ur]) expect(c).not.toMatch(/class="sc-spots held[^"]*"[^>]*>(?:(?!<\/span><\/span>).)*<bdi/);
  });
});

// staging: Experiences is its own booking flow (BookingFlow), not main's ExperienceSteps page, which these read; they run on main
describe.skip("a date card's day", () => {
  it("comes without its year while that is this year's in Riyadh, and with it for a date in another", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2099-11-10T06:00:00Z"));
    const { dates } = await experiences([SAT, YG, NEXT_YEAR]);
    expect(dates.map((s) => [s.id, s.day])).toEqual([["2099-11-16", "Monday · 16 Nov"], ["2099-11-21-yg", "Saturday · 21 Nov"], ["2100-01-02", "Saturday · 2 Jan 2100"]]);
    expect((await experiences([SAT], [], "ar")).dates[0].day).toBe("الاثنين · 16 نوفمبر");
  });
  it("turns with the year in Riyadh, three hours before it does in UTC", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2099-12-31T20:59:00Z")); // 23:59 on 31 Dec in Riyadh
    expect((await experiences([NEXT_YEAR])).dates[0].day).toBe("Saturday · 2 Jan 2100");
    vi.setSystemTime(new Date("2099-12-31T21:00:00Z")); // midnight: 1 Jan 2100 in Riyadh
    expect((await experiences([NEXT_YEAR])).dates[0].day).toBe("Saturday · 2 Jan");
    await memoSettled(); // the minute that passed set the page's own texts to be read again behind it
  });
});

// staging: the mark is main's ExperienceSteps page's; the booking flow draws none, its cards have their own amber
// (.sc-spots.low) and it lists no DEFE run, so booking.css has no DEFE card to read the mark on
describe.skip("the mark's look", () => {
  const css = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const booking_ = css("../../components/booking/booking.css"), xp = css("../../components/experiences/experiences.css");
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const over = (fg: number[], a: number, bg: number[]) => fg.map((v, i) => v * a + bg[i] * (1 - a));
  const lum = (c: number[]) => {
    const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const one = (re: RegExp, src = booking_) => { const m = re.exec(src); expect(m, String(re)).not.toBeNull(); return m![1]; };
  // the page's own colours, read from its stylesheet: the good state's green, the few places' amber, yoga's deeper amber
  const green = one(/\n\.sc-spots \{[^}]*color: (#[0-9a-f]{6});/), amber = one(/\n\.sc-spots\.low \{ color: (#[0-9a-f]{6}); \}/);
  const ygAmber = one(/\.sc-card\.sc-yoga \.sc-spots\.held\.low, \.xs-feat-card\.xs-feat-yg \.sc-spots\.held\.low \{ color: (#[0-9a-f]{6}); \}/);

  it("is the good state's green for Booked on every kind's card, and the few places' amber for the other two", () => {
    expect([green, amber]).toEqual(["#06603b", "#7a5a10"]);
    // the tick stands where the dot would; On the waitlist and Reserved keep the dot
    expect(booking_).toContain(".sc-spots.held:not(.low)::before { content: none; }");
    expect(booking_).toContain(".sc-spots.held svg { flex: none; }");
    // no kind's own colour takes the mark: the blood drive's, Defe's and yoga's leave it alone
    for (const k of [".sc-card.ev-blood", ".sc-card.sc-defe", ".sc-card.sc-yoga"]) expect(booking_, k).toContain(`${k} .sc-spots:not(.full):not(.low):not(.closed):not(.held) {`);
    expect(booking_).not.toMatch(/\.sc-spots:not\(\.full\):not\(\.low\):not\(\.closed\) \{/);
    // at a narrow Featured card's foot long words wrap rather than run out of the card
    expect(xp).toContain(".xs-feat-foot .sc-spots.held { max-width: 100%; white-space: normal; }");
  });
  it("uses the page's sides, never left or right, and puts nothing on a bdi", () => {
    const rules = [...booking_.matchAll(/^[^\n{}]*\.held[^\n{}]*\{[^}]*\}/gm), ...xp.matchAll(/^[^\n{}]*\.held[^\n{}]*\{[^}]*\}/gm)].map((m) => m[0]);
    expect(rules.length).toBeGreaterThanOrEqual(8);
    for (const r of rules) {
      expect(r).not.toMatch(/\b(?:margin|padding|border)-(?:left|right)\b|[^-]\b(?:left|right)\b/);
      expect(r).not.toMatch(/bdi/);
    }
  });
  it("reads 4.5:1 or more on every card it can land on", () => {
    const white = rgb("#ffffff");
    // an ordinary card, and a Featured card: white
    expect(one(/\n\.sc-card \{[^}]*\n\s*background: (#fff);/)).toBe("#fff");
    expect(xp).toMatch(/\.xs-feat-card \{[^}]*background: var\(--mm-white\);/);
    for (const c of [green, amber]) expect(ratio(rgb(c), white), c).toBeGreaterThanOrEqual(4.5);
    // Defe's card: white, or its hover's, under the blush at its strongest
    const blush = one(/\.sc-card\.sc-defe \{[^}]*radial-gradient\([^)]*?rgba\((\d+, \d+, \d+), \.3\) 0%/).split(", ").map(Number);
    const defeHover = one(/\.sc-card\.sc-defe:hover \{ background-color: (#[0-9a-f]{6});/);
    for (const base of ["#ffffff", defeHover]) for (const c of [green, amber]) expect(ratio(rgb(c), over(blush, 0.3, rgb(base))), `${c} on Defe ${base}`).toBeGreaterThanOrEqual(4.5);
    // yoga's date card and its Featured card: cream (or the hover's, or the chosen date's), under the glow at its
    // strongest and the drawn sun on top of it, which sit under the foot's far end
    const glow = one(/--yg-glow: (\d+, \d+, \d+);/).split(", ").map(Number), cream = one(/--yg-cream: (#[0-9A-Fa-f]{6});/);
    expect(booking_).toMatch(/\.sc-card\.sc-yoga \{[^}]*rgba\(var\(--yg-glow\), \.3\) 0%/);
    expect(xp).toMatch(/\.xs-feat-card\.xs-feat-yg \{[^}]*rgba\(var\(--yg-glow\), \.3\) 0%/);
    const sun = Number(one(/\.sc-yg-sun \{ fill: rgba\(var\(--yg-glow\), (\.\d+)\); \}/));
    const hovers = [one(/\.sc-card\.sc-yoga:hover \{ background-color: (#[0-9a-f]{6});/), one(/\.sc-card\.sc-yoga\[aria-checked="true"\] \{ background-color: (#[0-9a-f]{6});/), one(/\.xs-feat-card\.xs-feat-yg:hover \{ background-color: (#[0-9a-f]{6});/, xp)];
    for (const base of [cream, ...hovers]) {
      const worst = over(glow, sun, over(glow, 0.3, rgb(base)));
      for (const c of [green, ygAmber]) expect(ratio(rgb(c), worst), `${c} on yoga ${base}`).toBeGreaterThanOrEqual(4.5);
    }
    // which is why yoga's amber is a shade deeper: the page's own falls short there
    expect(ratio(rgb(amber), over(glow, sun, over(glow, 0.3, rgb(cream))))).toBeLessThan(4.5);
  });
});
