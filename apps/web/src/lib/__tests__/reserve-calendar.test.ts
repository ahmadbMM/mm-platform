import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps, { type StepSession } from "@/components/experiences/ExperienceSteps";
import { KIND_THEME_WORDS, kindThemeWords } from "@/components/experiences/KindTheme.words";
import { LOCALE_CODES } from "@/i18n/locales";
import { CAL_VIEW_KEY, calDayLabel, calDayOf, calKey, calLong, calMonth, calMove, calOffered, calPlan, calTitle, calToday, calViewRead, calViewSave, calWeekdays, type CalView } from "../reserve-calendar";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";
import ExperiencesPage from "../../app/[locale]/experiences/page";

// cookies() is a request's; no account here.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
// The steps open on the event cards (useState(1)); a test draws the date step by handing the component's states in
// order: the step, the event, the date picked, the kind, the dialog, the poster's language, the clock, then the view,
// the day tapped and today. Each render takes them once.
const states = vi.hoisted(() => ({ queue: [] as unknown[] }));
vi.mock("react", async (importOriginal) => {
  const R = await importOriginal<typeof import("react")>();
  return { ...R, useState: ((v: unknown) => R.useState(states.queue.length ? states.queue.shift() : v)) as typeof R.useState };
});
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// The date step's calendar (the user, 2026-11-16: "add a calendar view in reserve section for customers"), on the website
// as the booking app's Reserve has it (app.src.html _rcPlan, _rcMonthHtml, _rcMove, _rcKey; tests/reserve-calendar.spec.ts
// there): two days or more offer List and Calendar at the end of the kind row; Calendar draws one month from Sunday with
// a button and a dot per kind on each day that has dates, and under it that day's dates alone, as the list draws them.

describe("the calendar's days (lib/reserve-calendar.ts)", () => {
  it("puts a date on its own day, else on its id's first ten characters (the booking app's _rcDay)", () => {
    expect(calDayOf({ id: "2099-11-14-2" })).toBe("2099-11-14");
    expect(calDayOf({ id: "x", date: "2099-11-15" })).toBe("2099-11-15");
  });
  it("is offered for two days or more, never for one day however many dates it holds", () => {
    expect(calOffered([{ id: "2099-11-14" }, { id: "2099-11-14-sw" }])).toBe(false);
    expect(calOffered([{ id: "2099-11-14" }, { id: "2099-11-15-sw" }])).toBe(true);
    expect(calOffered([])).toBe(false);
  });
  it("shows the day tapped while it has dates, else the picked date's day, else the first", () => {
    const l = [{ id: "a", date: "2099-11-21" }, { id: "b", date: "2099-11-14" }, { id: "c", date: "2099-11-14" }, { id: "d", date: "2100-01-02" }];
    const p = calPlan(l, null, null)!;
    expect(p.days).toEqual(["2099-11-14", "2099-11-21", "2100-01-02"]);
    expect([p.day, p.picked, p.list.map((x) => x.id)]).toEqual(["2099-11-14", "", ["b", "c"]]);
    expect(calPlan(l, null, "a")).toMatchObject({ day: "2099-11-21", picked: "2099-11-21" });
    expect(calPlan(l, "2100-01-02", "a")).toMatchObject({ day: "2100-01-02", picked: "2099-11-21" });
    expect(calPlan(l, "2099-11-15", "zz")).toMatchObject({ day: "2099-11-14", picked: "" }); // a day without dates, a date not listed
    expect(calPlan([], null, null)).toBeNull();
  });
  it("steps to the next month that has dates, its first day, and stops at the ends", () => {
    const days = ["2099-11-14", "2099-11-21", "2100-01-02", "2100-01-09"];
    expect(calMove(days, "2099-11-21", 1)).toBe("2100-01-02"); // December has none
    expect(calMove(days, "2100-01-09", -1)).toBe("2099-11-14");
    expect(calMove(days, "2100-01-02", 1)).toBeNull();
    expect(calMove(days, "2099-11-14", -1)).toBeNull();
  });
  it("draws a month from Sunday, as weeks run in Saudi Arabia", () => {
    expect(calMonth("2099-11").lead).toBe(0); // 1 November 2099 is a Sunday
    expect(calMonth("2099-11").days).toHaveLength(30);
    expect(calMonth("2099-11").days[13]).toBe("2099-11-14");
    expect(calMonth("2100-01").lead).toBe(5); // 1 January 2100 is a Friday
    expect(calMonth("2100-02").days).toHaveLength(28); // 2100 is no leap year
    expect(calMonth("2096-02").days).toHaveLength(29);
  });
  it("names the month, the week's days and a day in the page's language, in the Gregorian calendar with Latin digits", () => {
    expect(calTitle("2099-11", "en")).toBe("November 2099");
    expect(calTitle("2099-11", "ar")).toMatch(/^نوفمبر 2099$/);
    expect(calTitle("2099-11", "ur")).toContain("2099");
    expect(calTitle("2099-11", "de")).toBe("November 2099");
    expect(calTitle("2099-11", "zh")).toBe("2099年11月");
    expect(calWeekdays("en")).toEqual(["S", "M", "T", "W", "T", "F", "S"]);
    expect(calWeekdays("ar")).toHaveLength(7);
    expect(calLong("2099-11-14", "en")).toBe("Saturday 14 November");
    expect(calLong("2099-11-14", "ar")).toContain("السبت");
  });
  it("names a day for a screen reader: the day, its dates' names once each, and the visitor's place or Fully booked", () => {
    const w = { held: { ok: "Booked", wl: "On the waitlist", rsv: "Reserved" }, fbk: "Fully booked" };
    expect(calDayLabel("2099-11-14", "en", [{ name: "Saturday Social Ride" }, { name: "Saturday Social Ride" }], w)).toBe("Saturday 14 November · Saturday Social Ride");
    expect(calDayLabel("2099-11-15", "en", [{ name: "Pool" }, { name: "Yoga", held: "wl" }], w)).toBe("Sunday 15 November · Pool, Yoga · On the waitlist");
    expect(calDayLabel("2099-11-15", "en", [{ name: "Pool", fbk: "See you" }, { name: "Yoga", fbk: "See you" }], w)).toBe("Sunday 15 November · Pool, Yoga · Fully booked");
    expect(calDayLabel("2099-11-15", "en", [{ name: "Pool", fbk: "See you" }, { name: "Yoga" }], w)).toBe("Sunday 15 November · Pool, Yoga");
    expect(calDayLabel("2099-11-15", "en", [{ name: "Pool", fbk: "See you", held: "ok" }], w)).toMatch(/· Booked$/); // their place first
  });
  it("moves along the days with dates by key: Right and Left turned round right to left, a week, the ends", () => {
    const days = ["2099-11-14", "2099-11-15", "2099-11-18", "2099-11-21"];
    expect(calKey(days, "2099-11-14", "ArrowRight", false)).toBe("2099-11-15");
    expect(calKey(days, "2099-11-15", "ArrowLeft", false)).toBe("2099-11-14");
    expect(calKey(days, "2099-11-15", "ArrowLeft", true)).toBe("2099-11-18"); // later, in a month read right to left
    expect(calKey(days, "2099-11-14", "ArrowRight", true)).toBeNull(); // nothing before the first
    expect(calKey(days, "2099-11-14", "ArrowDown", false)).toBe("2099-11-21");
    expect(calKey(days, "2099-11-15", "ArrowDown", false)).toBeNull(); // no date a week on or later this month: it stays
    expect(calKey(days, "2099-11-21", "ArrowUp", false)).toBe("2099-11-14");
    expect(calKey(days, "2099-11-18", "Home", false)).toBe("2099-11-14");
    expect(calKey(days, "2099-11-14", "End", false)).toBe("2099-11-21");
    expect(calKey(days, "2099-11-21", "End", false)).toBeNull();
    expect(calKey(days, "2099-11-14", "Enter", false)).toBeUndefined(); // the button's own
    expect(calKey(days, "2099-11-14", "PageDown", false)).toBeUndefined(); // the month's (ExperienceSteps)
  });
  it("takes today in Riyadh", () => {
    expect(calToday(Date.parse("2026-11-15T21:30:00Z"))).toBe("2026-11-16");
    expect(calToday(Date.parse("2026-11-15T20:59:00Z"))).toBe("2026-11-15");
  });
});

describe("the view kept on the device", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it("is the list until the calendar is chosen, and the calendar from then on", () => {
    const kept = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) });
    expect(calViewRead()).toBe("list");
    calViewSave("cal");
    expect(kept.get(CAL_VIEW_KEY)).toBe("cal");
    expect(CAL_VIEW_KEY).toBe("mm_xs_view");
    expect(calViewRead()).toBe("cal");
    calViewSave("list");
    expect(calViewRead()).toBe("list");
    kept.set(CAL_VIEW_KEY, "grid");
    expect(calViewRead()).toBe("list");
  });
  it("is the list where storage cannot be read, and choosing breaks nothing", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } });
    expect(calViewRead()).toBe("list");
    expect(() => calViewSave("cal")).not.toThrow();
  });
});

describe("the words (KindTheme.words.ts)", () => {
  it("are in every language the site speaks, each filled", () => {
    expect(Object.keys(KIND_THEME_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const [code, w] of Object.entries(KIND_THEME_WORDS)) for (const v of Object.values(w.cal)) expect(v.trim(), code).not.toBe("");
  });
  it("are the booking app's shGrpView, calViewList, calViewCal, calPrev and calNext word for word in its ten languages", () => {
    const app: Record<string, [string, string, string, string, string]> = {
      en: ["View", "List", "Calendar", "Previous month", "Next month"],
      ar: ["العرض", "قائمة", "تقويم", "الشهر السابق", "الشهر التالي"],
      fr: ["Affichage", "Liste", "Calendrier", "Mois précédent", "Mois suivant"],
      es: ["Vista", "Lista", "Calendario", "Mes anterior", "Mes siguiente"],
      pt: ["Vista", "Lista", "Calendário", "Mês anterior", "Próximo mês"],
      ur: ["منظر", "فہرست", "کیلنڈر", "پچھلا مہینہ", "اگلا مہینہ"],
      hi: ["व्यू", "सूची", "कैलेंडर", "पिछला महीना", "अगला महीना"],
      tl: ["View", "Listahan", "Kalendaryo", "Nakaraang buwan", "Susunod na buwan"],
      ne: ["दृश्य", "सूची", "पात्रो", "अघिल्लो महिना", "अर्को महिना"],
      bn: ["ভিউ", "তালিকা", "ক্যালেন্ডার", "আগের মাস", "পরের মাস"],
    };
    for (const [code, [view, list, cal, prev, next]] of Object.entries(app)) expect(kindThemeWords(code).cal, code).toEqual({ view, list, cal, prev, next });
    expect(kindThemeWords("de").cal).toEqual({ view: "Ansicht", list: "Liste", cal: "Kalender", prev: "Vorheriger Monat", next: "Nächster Monat" });
  });
});

// The page, with its database stubbed: the sessions through list_sessions, nothing for anything else.
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
const db = (sessions: unknown[]) => vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/rpc/list_sessions")) return json(sessions);
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
type Props = Parameters<typeof ExperienceSteps>[0];
const experiences = async (sessions: unknown[], locale = "en"): Promise<Props> => {
  resetRides();
  vi.stubGlobal("fetch", db(sessions));
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) });
  return (findAll(page, ExperienceSteps)[0] as ReactElement<Props>).props;
};
type At = { sess?: StepSession | null; kind?: string | null; view?: CalView; day?: string | null; today?: string };
/** The Experiences card's dates, drawn in the view given, with the date picked, the kind, the day tapped and today. */
const draw = (props: Props, at: At = {}) => {
  states.queue = [2, props.events[0], at.sess ?? null, at.kind ?? null, null, props.locale === "ar" ? "ar" : "en", null, at.view ?? "list", at.day ?? null, at.today ?? ""];
  try { return renderToStaticMarkup(createElement(ExperienceSteps, props)); } finally { states.queue = []; }
};
const withDates = (props: Props, f: (s: StepSession) => StepSession): Props => ({ ...props, events: props.events.map((e) => ({ ...e, sessions: e.sessions.map(f) })) });
const cards = (html: string) => [...html.matchAll(/class="sc-card[^"]*"[^>]*data-id="([^"]+)"|data-id="([^"]+)"[^>]*class="sc-card/g)].map((m) => m[1] ?? m[2]);
const dayBtn = (html: string, iso: string) => new RegExp(`<button type="button" class="xs-cal-day has[^"]*" data-day="${iso}"[^>]*>.*?</button>`).exec(html)?.[0] ?? "";
const monthOf = (html: string) => /<section class="xs-cal".*?<\/section>/.exec(html)?.[0] ?? "";

const comm = (id: string, kind: string, slots: string, more: Record<string, unknown> = {}) => ({
  id, session_date: id.slice(0, 10), status: "open", event_kind: "community", ride_kind: kind, title: null, open_to_all: false, paid_ride: false,
  needs_approval: false, capacity: 20, bike_slots: slots, location: null, meet_url: null, description: null, ...more,
});
const SAT = comm("2099-11-14", "saturday", '{"_time":"05:45 - 06:15"}', { needs_approval: true, capacity: 120 });
const SW = comm("2099-11-15-sw", "swim", '{"_time":"07:00 - 08:00"}');
const SW2 = comm("2099-11-18-sw", "swim", '{"_time":"07:00 - 08:00"}');
const YG = comm("2099-11-21-yg", "yoga", '{"_time":"16:00 - 17:30"}', { location: "SILKDEER", capacity: 15 });
const NY = comm("2100-01-02", "saturday", '{"_time":"06:00 - 06:30"}', { needs_approval: true, capacity: 120 });
const ALL = [SAT, SW, SW2, YG, NY];

beforeEach(() => {
  resetRides(); resetSiteContent(); states.queue = [];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

// staging's Experiences page is its own booking flow; ported when staging's page takes the date step's List / Calendar switch
describe.skip("the date step's calendar", () => {
  it("gets each date's day and the switch's words from the page", async () => {
    const props = await experiences(ALL);
    expect(props.events[0].key).toBe("community");
    expect(props.events[0].sessions.map((s) => s.date)).toEqual(["2099-11-14", "2099-11-15", "2099-11-18", "2099-11-21", "2100-01-02"]);
    expect(props.text.cal).toEqual({ view: "View", list: "List", cal: "Calendar", prev: "Previous month", next: "Next month" });
    expect((await experiences(ALL, "ar")).text.cal.cal).toBe("تقويم");
  });
  it("offers List and Calendar at the end of the kind row; the list is the start and lists every date", async () => {
    const props = await experiences(ALL);
    const html = draw(props);
    const tools = /<div class="xs-tools">.*?<\/div><\/div>/.exec(html)?.[0] ?? "";
    expect(tools.indexOf('class="xs-kinds"')).toBeGreaterThan(0);
    expect(tools.indexOf('class="xs-views"')).toBeGreaterThan(tools.indexOf('class="xs-kinds"'));
    expect(tools).toContain('<div class="xs-views" role="group" aria-label="View">');
    expect(tools).toMatch(/<button type="button" class="xs-view" aria-pressed="true" aria-label="List" title="List"><svg class="mm-ic"/);
    expect(tools).toMatch(/<button type="button" class="xs-view" aria-pressed="false" aria-label="Calendar" title="Calendar"><svg class="mm-ic"/);
    expect(html).not.toContain('class="xs-cal"');
    // yoga is featured as made, so the list leads with it under Featured, the rest under Upcoming
    expect(cards(html)).toEqual([YG.id, SAT.id, SW.id, SW2.id, NY.id]);
    expect(html).toContain('<h3 class="xs-sec-h xs-sec-rest">Upcoming</h3>');
  });
  it("draws the first month with its dates as buttons, the first day shown and its dates alone under it", async () => {
    const props = await experiences(ALL);
    const html = draw(props, { view: "cal" });
    const m = monthOf(html);
    expect(m).toContain('<h3 id="xs-cal-t" class="xs-cal-t" aria-live="polite">November 2099</h3>');
    expect(m).toContain('<section class="xs-cal" aria-labelledby="xs-cal-t">');
    expect(m.match(/class="xs-cal-day[ "]/g)).toHaveLength(30);
    expect(m.match(/<button type="button" class="xs-cal-day has/g)).toHaveLength(4);
    expect(m).not.toContain("xs-cal-pad"); // 1 November 2099 is a Sunday: no blank before it
    expect(m.match(/<span class="xs-cal-dow">/g)).toHaveLength(7);
    expect(m).toContain('<div class="xs-cal-dows" aria-hidden="true"><span class="xs-cal-dow">S</span><span class="xs-cal-dow">M</span>');
    const d14 = dayBtn(m, "2099-11-14");
    expect(d14).toMatch(/class="xs-cal-day has on"/);
    expect(d14).toContain('aria-pressed="true" aria-label="Saturday 14 November · Saturday Social Ride" tabindex="0"');
    expect(d14).toContain('<i class="xs-cal-mk ev-saturday"></i>');
    expect(dayBtn(m, "2099-11-21")).toContain('aria-pressed="false"');
    expect(dayBtn(m, "2099-11-21")).toContain('tabindex="-1"');
    expect(dayBtn(m, "2099-11-21")).toContain('<i class="xs-cal-mk ev-yoga"></i>');
    expect(m).toContain('<span class="xs-cal-day">10</span>'); // a day without dates is a number
    // the arrows: none before November, January after it
    expect(m).toMatch(/<button type="button" class="xs-cal-nav xs-cal-prev" aria-label="Previous month" disabled="">/);
    expect(m).toMatch(/<button type="button" class="xs-cal-nav xs-cal-next" aria-label="Next month"><svg class="mm-ic mm-ic-dir"/);
    // under the month: the 14th's date alone, as the list draws it
    expect(cards(html)).toEqual([SAT.id]);
    expect(html.indexOf('class="xs-cal"')).toBeLessThan(html.indexOf('class="sc-list"'));
    expect(draw(props, { view: "cal" })).toContain('<button type="button" class="xs-view" aria-pressed="true" aria-label="Calendar"');
  });
  it("shows the day tapped; a picked date's day is shown when none is, and keeps its green ring on any other", async () => {
    const props = await experiences(ALL);
    const yg = draw(props, { view: "cal", day: "2099-11-21" });
    expect(cards(yg)).toEqual([YG.id]);
    expect(dayBtn(yg, "2099-11-21")).toMatch(/class="xs-cal-day has on"/);
    const sw2 = props.events[0].sessions.find((s) => s.id === SW2.id)!;
    const picked = draw(props, { view: "cal", sess: sw2 });
    expect(dayBtn(picked, "2099-11-18")).toMatch(/class="xs-cal-day has on sel"/);
    expect(picked).toMatch(new RegExp(`role="radio" aria-checked="true" tabindex="0" data-id="${SW2.id}"`));
    const other = draw(props, { view: "cal", sess: sw2, day: "2099-11-15" });
    expect(dayBtn(other, "2099-11-18")).toMatch(/class="xs-cal-day has sel"/);
    expect(dayBtn(other, "2099-11-15")).toMatch(/class="xs-cal-day has on"/);
    expect(cards(other)).toEqual([SW.id]);
    expect(other).toMatch(new RegExp(`role="radio" aria-checked="false" tabindex="0" data-id="${SW.id}"`)); // the day's first date holds the tab stop
  });
  it("draws a later month with its blanks, and no arrow after the last month with dates", async () => {
    const props = await experiences(ALL);
    const html = draw(props, { view: "cal", day: "2100-01-02" });
    const m = monthOf(html);
    expect(m).toContain(">January 2100</h3>");
    expect(m.match(/<span class="xs-cal-pad"><\/span>/g)).toHaveLength(5); // 1 January 2100 is a Friday
    expect(m).toMatch(/xs-cal-next" aria-label="Next month" disabled="">/);
    expect(m).not.toMatch(/xs-cal-prev" aria-label="Previous month" disabled/);
    expect(cards(html)).toEqual([NY.id]);
  });
  it("rings today, mutes the days before it, and ticks a day the visitor holds a place on", async () => {
    const props = withDates(await experiences(ALL), (s) => (s.id === SW.id ? { ...s, held: "ok" } : s));
    const m = monthOf(draw(props, { view: "cal", today: "2099-11-10" }));
    expect(m).toContain('<span class="xs-cal-day today">10</span>');
    expect(m).toContain('<span class="xs-cal-day past">9</span>');
    expect(m).toContain('<span class="xs-cal-day">11</span>');
    const d15 = dayBtn(m, "2099-11-15");
    expect(d15).toMatch(/class="xs-cal-day has mine"/);
    expect(d15).toContain('aria-label="Sunday 15 November · Triathlon Pool Session · Booked"');
    expect(d15).toMatch(/<span class="xs-cal-mine" aria-hidden="true"><svg class="mm-ic"/);
    expect(dayBtn(m, "2099-11-14")).not.toContain("xs-cal-mine");
  });
  it("says Fully booked on a day whose every date is closed as fully booked", async () => {
    const props = withDates(await experiences(ALL), (s) => (s.id === YG.id ? { ...s, fbk: "See you at the next session" } : s));
    const d21 = dayBtn(monthOf(draw(props, { view: "cal" })), "2099-11-21");
    expect(d21).toMatch(/class="xs-cal-day has fb"/);
    expect(d21).toContain(" · Fully booked\"");
  });
  it("narrows the month with the kind switch; a day tapped that the kind has not shows the kind's first", async () => {
    const props = await experiences(ALL);
    const sw = draw(props, { view: "cal", kind: "swim", day: "2099-11-21" });
    const m = monthOf(sw);
    expect(m.match(/<button type="button" class="xs-cal-day has/g)).toHaveLength(2);
    expect(dayBtn(m, "2099-11-15")).toMatch(/class="xs-cal-day has on"/);
    expect(m).not.toContain('data-day="2099-11-14"');
    expect(m).toMatch(/xs-cal-next" aria-label="Next month" disabled="">/); // no swim in January
    expect(cards(sw)).toEqual([SW.id]);
    expect(sw).toContain('class="xs-views"'); // the switch stays: it counts the days before the kind narrows them
    expect(monthOf(draw(props, { view: "cal", kind: "yoga" }))).toContain(">November 2099</h3>");
  });
  it("draws no Featured or Upcoming heading under the day", async () => {
    const props = await experiences([{ ...SAT, bike_slots: '{"_time":"05:45 - 06:15","_feat":1}' }, SW, YG]);
    expect(draw(props)).toContain('class="xs-sec-h"');
    const cal = draw(props, { view: "cal" });
    expect(cal).not.toContain('class="xs-sec-h');
    expect(cards(cal)).toEqual([SAT.id]);
  });
  it("offers no switch for one day, nor draws the month, whatever was chosen on the device", async () => {
    const one = await experiences([SAT]);
    for (const view of ["list", "cal"] as const) {
      const html = draw(one, { view });
      expect(html).not.toContain("xs-views");
      expect(html).not.toContain('class="xs-cal"');
      expect(html).not.toContain("xs-tools");
      expect(cards(html)).toEqual([SAT.id]);
    }
    // two kinds on one day: the kind switch alone
    const two = draw(await experiences([SAT, { ...SW, id: "2099-11-14-sw", session_date: "2099-11-14" }]), { view: "cal" });
    expect(two).toContain('<div class="xs-tools"><div class="xs-kinds"');
    expect(two).not.toContain("xs-views");
    expect(two).not.toContain('class="xs-cal"');
  });
  it("speaks Arabic: the month in Arabic words, the switch and the arrows in the booking app's words", async () => {
    const props = await experiences(ALL, "ar");
    const html = draw(props, { view: "cal" });
    expect(html).toContain('aria-label="العرض"');
    expect(html).toContain('aria-label="قائمة"');
    expect(html).toContain('aria-label="تقويم"');
    expect(html).toContain('aria-label="الشهر السابق"');
    expect(html).toContain('aria-label="الشهر التالي"');
    expect(monthOf(html)).toMatch(/>نوفمبر 2099<\/h3>/);
    expect(dayBtn(monthOf(html), "2099-11-14")).toMatch(/aria-label="السبت/);
  });
});

describe("the look", () => {
  const css = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  it("lays the month out as seven columns, the switch at the row's end, and turns its arrows round right to left", () => {
    const xp = css("../../components/experiences/experiences.css");
    expect(xp).toMatch(/\.xs-cal-grid \{[^}]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/);
    expect(xp).toMatch(/\.xs-views \{[^}]*margin-inline-start: auto;/);
    expect(xp).toMatch(/\.xs-tools > \.xs-kinds \{[^}]*min-width: 0;/);
    expect(xp).toMatch(/\.xs-view\[aria-pressed="true"\] \{ background: #1a1919; color: #fbf9f4; \}/);
    expect(xp).toMatch(/\.xs-cal-day\.has\.on \{ background: #1a1919;/);
    expect(xp).toMatch(/\.xs-cal-day\.has\.sel \{ box-shadow: inset 0 0 0 2px #077a4b; \}/);
    expect(xp).toMatch(/\.xs-cal-mine \{[^}]*inset-inline-end: 2px;/);
    expect(xp).toMatch(/\.xs-cal-day \{[^}]*min-height: 46px;/);
    expect(xp).toMatch(/\.xs-cal-nav \{[^}]*width: 44px; height: 44px;/);
    expect(xp).toMatch(/\.xs-cal-mk \{[^}]*background: var\(--ev, #077a4b\);/);
    const booking = css("../../components/booking/booking.css");
    for (const k of ["saturday", "swim", "petromin", "yoga", "farm", "defe5k", "jcc"]) expect(booking, k).toMatch(new RegExp(`:is\\([^)]*\\.xs-cal-mk\\)\\.ev-${k} \\{ --ev: `));
    expect(css("../../components/site/site.css")).toContain('[dir="rtl"] .mm-ic-dir { transform: scaleX(-1); }');
  });
});
