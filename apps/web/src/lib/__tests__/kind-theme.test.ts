import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps from "@/components/experiences/ExperienceSteps";
import { KIND_THEME_WORDS, kindThemeWords } from "@/components/experiences/KindTheme.words";
import { LOCALE_CODES } from "@/i18n/locales";
import { EVENT_CARDS, eventCards, featuredFirst } from "../event-info";
import { hasKindArt, KIND_ORDER, kindMarks, kindsInOrder, rideGroupKm, rowsOfKind, sunriseHhmm, sunriseMin } from "../kind-theme";
import { resetRides, sessionName, toSession, type RideKind } from "../rides";
import { resetSiteContent } from "../site";
import { fmtClock } from "../tickets";
import ExperiencesPage from "../../app/[locale]/experiences/page";

// cookies() is a request's; no account here.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// The Experiences card, its list and the Saturday ride on the website, as the booking app has them since the owner's
// picks on its theming page (2026-11-13): the card leads with a mark per kind, its About says About and See dates, the
// list offers a switch between its kinds, the Saturday ride says when the sun rises and draws its two routes, and an
// Arabic page names a session by its Arabic name (sessions.title_ar).

describe("sunrise on the Corniche (the booking app's _sunriseMin)", () => {
  it("is 6:33 on 14 Nov 2026 and moves with the season, in Riyadh time", () => {
    expect(sunriseMin("2026-11-14")).toBe(6 * 60 + 33);
    expect(sunriseHhmm("2026-11-14")).toBe("06:33");
    expect(sunriseHhmm("2026-11-21")).toBe("06:38");
    expect(sunriseHhmm("2026-06-20")).toBe("05:40");
    expect(sunriseHhmm("2026-12-19")).toBe("06:55"); // from December the ride sets off before it
    expect(sunriseHhmm("2027-01-02")).toBe("07:01");
  });
  it("reads a date with a time after it as that date, and nothing from anything else", () => {
    expect(sunriseMin("2026-11-14T21:00")).toBe(393);
    for (const v of ["", "soon", "2026-13-45"]) expect(sunriseMin(v), v).toBeNull();
    expect(sunriseHhmm("")).toBeNull();
  });
});

describe("the kinds' order (the booking app's COMM_MARKS)", () => {
  const s = (kind: string) => ({ kind });
  it("is the Saturday ride, the pool, Petromin, yoga and the DEFE run", () => {
    expect([...KIND_ORDER]).toEqual(["saturday", "swim", "petromin", "yoga", "defe5k"]);
  });
  it("puts a list's kinds in that order, each once, any other kind after them as it comes", () => {
    expect(kindsInOrder([s("yoga"), s("event"), s("swim"), s("saturday"), s("swim"), s("workshop"), s("defe5k")])).toEqual(["saturday", "swim", "yoga", "defe5k", "event", "workshop"]);
    expect(kindsInOrder([])).toEqual([]);
  });
  it("gives the card a mark for each kind of that order it has a date for, and none for another kind", () => {
    expect(kindMarks([s("defe5k"), s("saturday"), s("event"), s("yoga"), s("saturday")])).toEqual(["saturday", "yoga", "defe5k"]);
    expect(kindMarks([s("event")])).toEqual([]);
  });
  it("narrows the rows to the kind picked, and leaves them all for none, a kind not on the list or a list of one kind", () => {
    const rows = [{ id: "a", kind: "saturday" }, { id: "b", kind: "swim" }, { id: "c", kind: "saturday" }];
    expect(rowsOfKind(rows, "saturday").map((x) => x.id)).toEqual(["a", "c"]);
    expect(rowsOfKind(rows, "swim").map((x) => x.id)).toEqual(["b"]);
    expect(rowsOfKind(rows, null).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(rowsOfKind(rows, "yoga").map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(rowsOfKind([rows[0], rows[2]], "swim").map((x) => x.id)).toEqual(["a", "c"]);
  });
  it("narrows the dates first, then lists the featured ones of those first (the booking app's renderRegister)", () => {
    const rows = [{ id: "sat1", kind: "saturday" }, { id: "yg", kind: "yoga", feat: true }, { id: "sw", kind: "swim", feat: true }, { id: "sat2", kind: "saturday" }];
    const listed = (pick: string | null) => ((d) => [d.featured.map((x) => x.id), d.rest.map((x) => x.id)])(featuredFirst(rowsOfKind(rows, pick), (s) => !!s.feat));
    expect(listed(null)).toEqual([["yg", "sw"], ["sat1", "sat2"]]);
    expect(listed("swim")).toEqual([["sw"], []]);
    expect(listed("saturday")).toEqual([[], ["sat1", "sat2"]]); // nothing featured among them: no headings
  });
  it("draws the Saturday ride, the pool and a Petromin night, nothing else", () => {
    expect(["saturday", "swim", "petromin", "yoga", "defe5k", "jcc", "event"].filter(hasKindArt)).toEqual(["saturday", "swim", "petromin"]);
  });
});

describe("the Saturday ride's two distances (bike_slots._km, the booking app's _rgKm)", () => {
  it("are the session's own, else the usual 20 and 40 km", () => {
    expect(rideGroupKm('{"_time":"06:00 - 06:30","_km":{"beg":25,"int":45.5}}')).toEqual({ beg: 25, int: 45.5 });
    expect(rideGroupKm({ _km: { beg: "22" } })).toEqual({ beg: 22, int: 40 });
    expect(rideGroupKm('{"_time":"06:00 - 06:30"}')).toEqual({ beg: 20, int: 40 });
    expect(rideGroupKm({ _km: { beg: 0, int: 900 } })).toEqual({ beg: 20, int: 40 });
    expect(rideGroupKm("not json")).toEqual({ beg: 20, int: 40 });
    expect(rideGroupKm(null)).toEqual({ beg: 20, int: 40 });
  });
  it("ride along on a Saturday session alone", () => {
    const row = { id: "2099-11-14", session_date: "2099-11-14", status: "open", event_kind: "community", bike_slots: '{"_time":"06:00 - 06:30","_km":{"beg":18}}' };
    expect(toSession(row)?.groupKm).toEqual({ beg: 18, int: 40 });
    expect(toSession({ ...row, ride_kind: "swim" })?.groupKm).toBeUndefined();
  });
});

describe("a session's Arabic name (sessions.title_ar)", () => {
  const row = { id: "2099-11-19-sw", session_date: "2099-11-19", status: "open", event_kind: "community", ride_kind: "swim", title: "Triathlon Pool Session", bike_slots: '{"_time":"18:00 - 19:30"}' };
  const en = { jcc: "Open Sports Day", saturday: "Saturday Social Ride", swim: "Triathlon Pool Session" } as Record<RideKind, string>;
  const ar = { jcc: "يوم الرياضة المفتوح", saturday: "جولة السبت الاجتماعية", swim: "جلسة مسبح الترايثلون" } as Record<RideKind, string>;
  it("is read when the read asked for it, trimmed and at most 60 characters, and blank reads as none", () => {
    expect(toSession({ ...row, title_ar: "  جلسة المسبح  " })?.titleAr).toBe("جلسة المسبح");
    expect(toSession({ ...row, title_ar: "ب".repeat(80) })?.titleAr).toHaveLength(60);
    expect(toSession({ ...row, title_ar: "  " })?.titleAr).toBeNull();
    expect(toSession({ ...row, title_ar: null })?.titleAr).toBeNull();
    expect(toSession(row)).not.toHaveProperty("titleAr");
  });
  it("names the session on an Arabic page; every other language keeps the typed name, and a circuit night its own", () => {
    const s = { kind: "swim" as const, title: "Pool night", titleAr: "ليلة المسبح" };
    expect(sessionName(s, ar, en, true, true)).toBe("ليلة المسبح");
    expect(sessionName(s, en, en, false, false)).toBe("Pool night");
    expect(sessionName(s, ar, en, true, false)).toBe("Pool night"); // Urdu, French...: the typed name
    expect(sessionName({ ...s, titleAr: null }, ar, en, true, true)).toBe("Pool night");
    expect(sessionName({ kind: "swim", title: "Triathlon Pool Session", titleAr: null }, ar, en, true, true)).toBe("جلسة مسبح الترايثلون");
    expect(sessionName({ kind: "swim", title: null, titleAr: null }, ar, en, true, true)).toBe("جلسة مسبح الترايثلون");
    expect(sessionName({ kind: "jcc", title: null, titleAr: "ليلة" }, ar, en, true, true)).toBe("يوم الرياضة المفتوح");
  });
});

describe("the card's place", () => {
  it("is first among the event cards, whatever else is on the books", () => {
    expect(EVENT_CARDS[0]).toEqual({ key: "community", p: "comm", always: true });
    const all = [{ kind: "petromin" as const }, { kind: "vlap" as const }, { kind: "jcc" as const }, { kind: "saturday" as const }];
    expect(eventCards(all, { member: true, petromin: true }).map((c) => c.card.key)).toEqual(["community", "petromin", "vlap", "jcc"]);
  });
});

describe("the words (KindTheme.words.ts)", () => {
  it("are in every language the site speaks, each filled, with {0} in the sunrise line", () => {
    expect(Object.keys(KIND_THEME_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const [code, w] of Object.entries(KIND_THEME_WORDS)) {
      for (const v of [w.about, w.seeDates, w.sunrise, w.sunriseAt, w.show, w.all, w.kinds.saturday, w.kinds.swim, w.kinds.petromin, w.chooseDate, w.intPlace]) expect(v.trim(), code).not.toBe("");
      expect(w.sunriseAt, code).toContain("{0}");
    }
  });
  it("are the booking app's own in its languages", () => {
    expect(kindThemeWords("en")).toMatchObject({ about: "About", seeDates: "See dates", sunrise: "Sunrise", sunriseAt: "Sunrise {0}", show: "Show", all: "All", chooseDate: "Choose a date", kinds: { saturday: "Saturday", swim: "Pool", petromin: "Petromin" } });
    expect(kindThemeWords("ar")).toMatchObject({ about: "نبذة", seeDates: "عرض المواعيد", sunrise: "الشروق", sunriseAt: "الشروق {0}", show: "عرض", all: "الكل", chooseDate: "اختر موعدًا", kinds: { saturday: "السبت", swim: "المسبح", petromin: "بترومين" } });
    expect(kindThemeWords("ur").about).toBe("تعارف");
    expect(kindThemeWords("hi").kinds.petromin).toBe("पेट्रोमिन");
    expect(kindThemeWords("xx")).toBe(KIND_THEME_WORDS.en);
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
type Steps = ReactElement<Parameters<typeof ExperienceSteps>[0]>;
const experiences = async (sessions: unknown[], locale = "en"): Promise<Steps> => {
  resetRides(); // each call reads its own sessions (the rides are kept for a minute)
  vi.stubGlobal("fetch", db(sessions));
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) });
  return findAll(page, ExperienceSteps)[0] as Steps;
};
const comm = { event_kind: "community", status: "open", open_to_all: false, paid_ride: false, needs_approval: true, capacity: 40 };
const SAT = { ...comm, id: "2099-11-14", session_date: "2099-11-14", ride_kind: "saturday", title: null, bike_slots: '{"_time":"06:00 - 06:30","_km":{"beg":22}}' };
const SAT2 = { ...SAT, id: "2099-11-21", session_date: "2099-11-21", bike_slots: '{"_time":"06:00 - 06:30"}' };
const POOL = { ...comm, id: "2099-11-19-sw", session_date: "2099-11-19", ride_kind: "swim", title: "Triathlon Pool Session", title_ar: "جلسة المسبح الليلية", bike_slots: '{"_time":"18:00 - 19:30"}' };
const YG = { ...comm, id: "2099-11-20-yg", session_date: "2099-11-20", ride_kind: "yoga", needs_approval: false, capacity: 15, bike_slots: '{"_time":"16:00 - 17:30"}', location: "SILKDEER" };
const JCC = { id: "2099-11-16", session_date: "2099-11-16", status: "open", event_kind: null, ride_kind: null, title: null, capacity: 40, bike_slots: '{"_time":"21:00 - 23:00"}', location: "JCC" };

beforeEach(() => {
  resetRides(); resetSiteContent();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

// staging: Experiences is its own booking flow (BookingFlow), not main's ExperienceSteps page, which these read; they run on main (the Arabic name on staging's page: experiences-notes.test.ts)
describe.skip("Experiences' card, list and Saturday ride", () => {
  it("leads with the card, marked with the kinds it has dates for in their order and named by them", async () => {
    const steps = await experiences([JCC, YG, POOL, SAT, SAT2]);
    expect(steps.props.events.map((e) => e.key)).toEqual(["community", "jcc"]);
    const c = steps.props.events[0];
    expect(c.marks).toEqual({ kinds: ["saturday", "swim", "yoga"], label: "Saturday Social Ride · Triathlon Pool Session · Hatha Yoga for Cyclists" });
    expect(steps.props.events[1].marks).toBeUndefined();
    // a card with nothing of that order on its books has no marks
    expect((await experiences([JCC])).props.events.find((e) => e.key === "community")?.marks).toBeUndefined();
  });
  it("draws the card without the lockup, with its marks named for a screen reader and its About saying About", async () => {
    const steps = await experiences([JCC, SAT, POOL]);
    const html = renderToStaticMarkup(createElement(ExperienceSteps, { ...steps.props, member: true }));
    const card = html.slice(html.indexOf('class="xs-event ev-community"'), html.indexOf("</button>", html.indexOf('class="xs-event ev-community"')));
    expect(card).not.toContain("<img");
    expect(card).toContain('<span class="xs-marks" role="img" aria-label="Saturday Social Ride · Triathlon Pool Session">');
    expect(card.match(/class="xs-mk ev-(\w+)"/g)).toEqual(['class="xs-mk ev-saturday"', 'class="xs-mk ev-swim"']);
    expect(html).toContain('aria-label="About · Micromobility Experiences">About</button>');
    expect(html).toContain(">About this event</button>"); // the circuit's card keeps its words
    expect(html.indexOf("ev-community")).toBeLessThan(html.indexOf("ev-jcc"));
  });
  it("gives the browser the words of the card, the switch and the Saturday ride in the page's language", async () => {
    const en = (await experiences([SAT, POOL])).props.text;
    expect(en.info).toMatchObject({ about: "About this event", aboutShort: "About", seeDates: "See dates", sunrise: "Sunrise", bookEvent: "Book this event" });
    expect(en.chooseDate).toBe("Choose a date");
    expect(en.kinds).toEqual({ show: "Show", all: "All", names: { saturday: "Saturday", swim: "Pool" } });
    const ar = (await experiences([SAT, POOL, YG], "ar")).props.text;
    expect(ar.info).toMatchObject({ aboutShort: "نبذة", seeDates: "عرض المواعيد", sunrise: "الشروق" });
    expect(ar.kinds).toEqual({ show: "عرض", all: "الكل", names: { saturday: "السبت", swim: "المسبح", yoga: "هاثا يوغا لراكبي الدراجات" } });
    expect(ar.chooseDate).toBe("اختر موعدًا");
    const de = (await experiences([SAT], "de")).props.text;
    expect([de.info.aboutShort, de.info.seeDates, de.kinds.all, de.kinds.names.saturday]).toEqual(["Überblick", "Termine ansehen", "Alle", "Samstag"]);
  });
  it("never sends the Blood Donation event's name to the browser without its date", async () => {
    const t = (await experiences([SAT, POOL])).props.text;
    expect(Object.keys(t.kinds.names)).not.toContain("blood");
  });
  it("says when the sun rises on the Saturday ride's row and in its Details, and draws its routes with its distances", async () => {
    const steps = await experiences([SAT, SAT2, POOL]);
    const [s1, pool, s2] = steps.props.events[0].sessions;
    const at = fmtClock(sunriseHhmm("2099-11-14")!, "en");
    expect(at).toMatch(/^\d{1,2}:\d{2} AM$/);
    expect(s1.meta).toEqual([`Sunrise ${at}`]);
    expect(s1.info.sunrise).toBe(at);
    expect(s1.info.route).toEqual({ beg: "22 km", int: "40 km", start: "Meeting point", begPlace: "Jeddah Yacht Club", intPlace: "Marine Sciences roundabout" });
    expect(s2.info.route).toMatchObject({ beg: "20 km", int: "40 km" });
    expect(pool.meta).toEqual([]);
    expect(pool.info.sunrise).toBeUndefined();
    expect(pool.info.route).toBeUndefined();
    const ar = (await experiences([SAT], "ar")).props.events[0].sessions[0];
    expect(ar.meta?.[0]).toBe(`الشروق ${fmtClock(sunriseHhmm("2099-11-14")!, "ar")}`);
    expect(ar.info.route).toEqual({ beg: "22 كم", int: "40 كم", start: "نقطة التجمع", begPlace: "نادي جدة لليخوت", intPlace: "دوار علوم البحار" });
  });
  it("asks list_sessions for the Arabic name and names a session by it on the Arabic page alone", async () => {
    const f = db([SAT, POOL]);
    resetRides();
    vi.stubGlobal("fetch", f);
    const page = await ExperiencesPage({ params: Promise.resolve({ locale: "ar" }), searchParams: Promise.resolve({}) });
    const ar = (findAll(page, ExperienceSteps)[0] as Steps).props.events[0].sessions;
    expect(f.mock.calls.some(([u]) => String(u).includes("/rpc/list_sessions") && /select=[^&]*\btitle_ar\b/.test(String(u)))).toBe(true);
    expect(ar.map((s) => s.name)).toEqual(["جولة السبت الاجتماعية", "جلسة المسبح الليلية"]);
    expect((await experiences([SAT, POOL], "en")).props.events[0].sessions.map((s) => s.name)).toEqual(["Saturday Social Ride", "Triathlon Pool Session"]);
    expect((await experiences([SAT, POOL], "ur")).props.events[0].sessions[1].name).not.toBe("جلسة المسبح الليلية");
  });
  it("reads as before on a database without the column: the read is asked again without it", async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/rpc/list_sessions")) {
        if (/select=[^&]*\btitle_ar\b/.test(url)) return json({ code: "42703", message: "column sessions.title_ar does not exist" }, 400);
        return json([SAT, { ...POOL, title_ar: undefined }]);
      }
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
      return json([]);
    });
    vi.stubGlobal("fetch", f);
    const page = await ExperiencesPage({ params: Promise.resolve({ locale: "ar" }), searchParams: Promise.resolve({}) });
    const ar = (findAll(page, ExperienceSteps)[0] as Steps).props.events[0].sessions;
    expect(ar.map((s) => s.name)).toEqual(["جولة السبت الاجتماعية", "جلسة مسبح الترايثلون"]); // the kind's Arabic name, as before
  });
});

describe("the look", () => {
  const css = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  it("has one colour set per kind, and the kind's colour on its date card and dialog", () => {
    const booking = css("../../components/booking/booking.css");
    for (const t of ["--k-sat: #077A4B", "--k-sat-tint: #E6F2EC", "--k-sat-ink: #077A4B", "--k-pool: #0D7D8F", "--k-pool-tint: #E3F2F4", "--k-pool-ink: #0A6573", "--k-pm: #A33B2E", "--k-pm-tint: #F8E8E5", "--k-pm-ink: #A33B2E"]) expect(booking, t).toContain(t);
    expect(booking).toContain(":is(.sc-card, .sc-wrap, .xs-info, .xs-feat-card).ev-saturday { --ev: var(--k-sat); }"); // the Featured card too
    expect(booking).toContain(":is(.sc-card, .sc-wrap, .xs-info, .xs-feat-card).ev-swim { --ev: var(--k-pool); }"); // the Featured card too
    expect(booking).toContain(":is(.sc-card, .sc-wrap, .xs-info, .xs-feat-card).ev-petromin { --ev: var(--k-pm); }"); // the Featured card too
  });
  it("draws the tile, the marks, the switch, the motifs, the band and the Details' drawing, turned round right to left", () => {
    const xp = css("../../components/experiences/experiences.css");
    for (const sel of [".xs-event.ev-community", '[dir="rtl"] .xs-event.ev-community', ".xs-mk", ".xs-band", '[dir="rtl"] .xs-band', ".xs-kind[aria-pressed=\"true\"]", ".k-tile", ".sc-card > .sc-motif", ".xs-info > .xs-info-art", '[dir="rtl"] .k-art { transform: scaleX(-1); }', ".sr-route"]) expect(xp, sel).toContain(sel);
    for (const t of ["--art-dawn:", "--art-pool:", "--art-pm:", "--motif-sat: linear-gradient(to bottom, #E2AEAF 0 50%, #A7B2C8 50% 100%)", "--motif-pool:", "--motif-pm:"]) expect(xp, t).toContain(t);
    expect(xp).toContain("url(/site/mm-pattern.svg)");
    expect(css("../../../public/site/mm-pattern.svg")).toMatch(/<svg[^>]*viewBox="0 0 912 816"[^>]*fill="#03FF89"/);
  });
});
