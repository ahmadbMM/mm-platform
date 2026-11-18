import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  NO_FILTER, XP_EVENT_OF, XP_HERE, addDays, chipHas, dayGroups, dirLink, factLines, filterFromQuery, filterQuery, icsFeed, kindsOf, lenText, mapEmbed,
  minutesBetween, paceChips, pinFromUrl, pinOf, ratingsOf, seriesPlan, tempAt, thisWeek, thisWeekend, timesOf, waLink, waNumber, weekday, whenText, xpFilter,
  type XpItem,
} from "../sx-B5";
import { feedKind, ogImageOf, xpItems, xpSettings, type XpCtx } from "../sx-B5-server";
import { resetRides, toSession } from "../rides";
import { resetSiteContent } from "../site";
import { resetMemo } from "../memo";
import { priceMap } from "../booking";
import { PAGES } from "@/content";
import { xpSchema } from "@/content/pages/xp";
import { T } from "@/components/experiences/sx-B5.text";
import XpList from "@/components/experiences/XpList";
import BookingFlow from "@/components/experiences/BookingFlow";
import ExperiencesPage from "../../app/[locale]/experiences/page";
import { GET as feedGET } from "../../app/api/xp/cal/[kind]/route";

// The Experiences build of 2026-11-18 (the user: "do all" of the store and Experiences research), its list and its
// session pages (builder B5): the plain logic (lib/sx-B5.ts), what the server makes of a session (lib/sx-B5-server.ts),
// the page in its two modes, the public calendar feed, and the owner's rules the files must keep.

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
const src = (p: string) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), "utf8");
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
const item = (o: Partial<XpItem>): XpItem => ({
  id: "x", date: "2099-11-21", kind: "saturday", ev: "community", name: "Saturday Social Ride", near: null, day: "Saturday · 21 Nov", tile: { wd: "Sat", dn: "21", mo: "Nov" },
  start: "6:30 AM", gather: "6 AM", end: null, hm: "06:00", len: null, place: null, price: { k: "free" }, status: null, act: { k: "none" }, featured: false, gender: null,
  kids: false, members: true, sunrise: null, temp: null, pace: [], lang: null, facts: [], route: null, desc: null, ...o,
});

describe("days as Saudi calendars count them", () => {
  it("starts the week on Sunday and takes Friday and Saturday as the weekend", () => {
    expect(weekday("2026-11-18")).toBe(3); // a Wednesday
    expect(thisWeek("2026-11-18")).toEqual(["2026-11-18", "2026-11-21"]);
    expect(thisWeekend("2026-11-18")).toEqual(["2026-11-20", "2026-11-21"]);
    expect(thisWeekend("2026-11-20")).toEqual(["2026-11-20", "2026-11-21"]); // Friday: today and tomorrow
    expect(thisWeekend("2026-11-21")).toEqual(["2026-11-21", "2026-11-21"]);
    expect(thisWeek("2026-11-22")).toEqual(["2026-11-22", "2026-11-28"]); // Sunday: a new week
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("the chips (EF26)", () => {
  const list = [
    item({ id: "a", date: "2026-11-18", kind: "jcc", kids: true }),
    item({ id: "b", date: "2026-11-20", kind: "swim", gender: "female" }),
    item({ id: "c", date: "2026-11-21", kind: "saturday" }),
    item({ id: "d", date: "2026-11-25", kind: "saturday" }),
  ];
  it("narrow by kind, by today, this week, this weekend, women only and kids, together", () => {
    const ids = (f: Partial<typeof NO_FILTER>) => xpFilter(list, { ...NO_FILTER, ...f }, "2026-11-18").map((s) => s.id);
    expect(ids({})).toEqual(["a", "b", "c", "d"]);
    expect(ids({ kind: "saturday" })).toEqual(["c", "d"]);
    expect(ids({ when: "today" })).toEqual(["a"]);
    expect(ids({ when: "week" })).toEqual(["a", "b", "c"]);
    expect(ids({ when: "weekend" })).toEqual(["b", "c"]);
    expect(ids({ women: true })).toEqual(["b"]);
    expect(ids({ kids: true })).toEqual(["a"]);
    expect(ids({ kind: "saturday", when: "weekend" })).toEqual(["c"]);
    expect(chipHas(list, { ...NO_FILTER, kids: true, women: true }, "2026-11-18")).toBe(false);
  });
  it("are kept in the address and read back, refusing anything else", () => {
    const f = { kind: "swim", when: "weekend" as const, women: true, kids: false };
    expect(filterQuery(f)).toBe("?k=swim&w=weekend&women=1");
    expect(filterFromQuery(new URLSearchParams("k=swim&w=weekend&women=1"))).toEqual(f);
    expect(filterFromQuery({ k: "<script>", w: "month", kids: "yes" })).toEqual(NO_FILTER);
    expect(filterQuery(NO_FILTER)).toBe("");
  });
  it("name the kinds in the page's order, unknown kinds after", () => {
    expect(kindsOf([{ kind: "swim" }, { kind: "zzz" }, { kind: "saturday" }, { kind: "swim" }], ["saturday", "jcc", "swim"])).toEqual(["saturday", "swim", "zzz"]);
  });
});

describe("days and series (EF07, EF27)", () => {
  it("groups the sessions under their days, each day's by its start", () => {
    const g = dayGroups([item({ id: "b", date: "2099-11-22", hm: "18:00" }), item({ id: "a", date: "2099-11-21", hm: "20:00" }), item({ id: "c", date: "2099-11-21", hm: "06:00" })]);
    expect(g.map((d) => [d.date, d.items.map((s) => s.id)])).toEqual([["2099-11-21", ["c", "a"]], ["2099-11-22", ["b"]]]);
  });
  it("folds a kind with three dates or more into one series with its next two, never a featured date", () => {
    const sat = (id: string, date: string, featured = false) => item({ id, date, featured });
    const p = seriesPlan([sat("s3", "2099-12-05"), sat("s1", "2099-11-21"), sat("s2", "2099-11-28"), sat("f", "2099-12-12", true), item({ id: "j", kind: "jcc", date: "2099-11-22" })]);
    expect(p.series).toHaveLength(1);
    expect(p.series[0].next.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(p.series[0].weekday).toBe(6); // every Saturday
    expect(p.rest.map((s) => s.id)).toEqual(["j", "f"]);
    expect(seriesPlan([sat("a", "2099-11-21"), sat("b", "2099-11-28")]).series).toHaveLength(0);
  });
});

describe("times (EF04, EF32)", () => {
  const none = { gather: 0, minutes: 0 };
  it("reads a start and an end, a gathering and a start, one time alone, and a night past midnight", () => {
    expect(timesOf(["20:00", "23:00"], false, none)).toEqual({ gather: null, start: "20:00", end: "23:00", len: 180 });
    expect(timesOf(["20:00", "23:00"], false, { gather: 15, minutes: 0 })).toMatchObject({ gather: "19:45" });
    expect(timesOf(["06:00", "06:30"], true, none)).toEqual({ gather: "06:00", start: "06:30", end: null, len: null });
    expect(timesOf(["06:00", "06:30"], true, { gather: 0, minutes: 120 })).toEqual({ gather: "06:00", start: "06:30", end: "08:30", len: 120 });
    expect(timesOf(["19:00", "19:00"], false, none)).toEqual({ gather: null, start: "19:00", end: null, len: null });
    expect(minutesBetween("22:00", "01:00")).toBe(180);
    expect(timesOf(null, false, none).start).toBeNull();
  });
  it("says how long in hours and minutes, the number and its unit together", () => {
    const t = T.en;
    expect(lenText(120, t)).toBe("2 h");
    expect(lenText(90, t)).toBe("90 min");
    expect(lenText(150, t)).toBe("2 h 30 min");
    expect(lenText(45, t)).toBe("45 min");
    expect(whenText({ gather: "6 AM", start: "6:30 AM", end: "8:30 AM", len: 120 }, { gatherWord: "Gathering", startWord: "Start" }, t)).toBe("Gathering 6 AM · Start 6:30 AM – 8:30 AM · 2 h");
    expect(whenText({ gather: null, start: "9 PM", end: "11 PM", len: 120 }, { gatherWord: "", startWord: "" }, t)).toBe("9 PM – 11 PM · 2 h");
  });
});

describe("facts staff write, places, WhatsApp, weather and ratings", () => {
  it("reads one fact per line and pace parts, at most eight and four", () => {
    expect(factLines("- Water\n\n• Closed shoes \n")).toEqual(["Water", "Closed shoes"]);
    expect(factLines(Array.from({ length: 12 }, (_, i) => `L${i}`).join("\n"))).toHaveLength(8);
    expect(paceChips("Easy · 22-25 km/h | No-drop")).toEqual(["Easy", "22-25 km/h", "No-drop"]);
    expect(paceChips("")).toEqual([]);
  });
  it("reads a map pin, from staff or from a Google Maps link, and never a short link", () => {
    expect(pinOf("21.624565, 39.106812")).toEqual([21.624565, 39.106812]);
    expect(pinOf("91,10")).toBeNull();
    expect(pinOf("Jeddah")).toBeNull();
    expect(pinFromUrl("https://www.google.com/maps/search/?api=1&query=21.5,39.1")).toEqual([21.5, 39.1]);
    expect(pinFromUrl("https://www.google.com/maps/place/X/@21.6245,39.1068,17z")).toEqual([21.6245, 39.1068]);
    expect(pinFromUrl("https://maps.app.goo.gl/abc")).toBeNull();
    expect(mapEmbed("21.5,39.1", "ar")).toBe("https://www.google.com/maps?q=21.5%2C39.1&z=16&hl=ar&output=embed");
    expect(dirLink("Jeddah Yacht Club")).toBe("https://www.google.com/maps/dir/?api=1&destination=Jeddah%20Yacht%20Club");
  });
  it("finds the WhatsApp number in the site's link and fills the message in", () => {
    expect(waNumber("https://wa.me/966500000000")).toBe("966500000000");
    expect(waNumber("https://api.whatsapp.com/send?phone=966500000000")).toBe("966500000000");
    expect(waNumber("https://instagram.com/x")).toBeNull();
    expect(waNumber("")).toBeNull();
    expect(waLink("966500000000", "Hello & bye")).toBe("https://wa.me/966500000000?text=Hello%20%26%20bye");
  });
  it("takes the forecast's temperature nearest the start, within three hours, else none", () => {
    const fc = { properties: { timeseries: [
      { time: "2099-11-21T03:00:00Z", data: { instant: { details: { air_temperature: 24.6 } } } },
      { time: "2099-11-21T09:00:00Z", data: { instant: { details: { air_temperature: 31.2 } } } },
    ] } };
    expect(tempAt(fc, Date.parse("2099-11-21T03:30:00Z"))).toBe(25);
    expect(tempAt(fc, Date.parse("2099-11-22T03:30:00Z"))).toBeNull();
    expect(tempAt(null, 0)).toBeNull();
  });
  it("shows a kind's average only from the fewest ratings staff set, never under five, and nothing that does not read", () => {
    const r = ratingsOf([{ kind: "saturday", avg: 4.84, n: 25 }, { kind: "jcc", avg: 4.1, n: 7 }, { kind: "swim", avg: 9, n: 40 }, { kind: "<x>", avg: 5, n: 50 }], 20);
    expect([...r]).toEqual([["saturday", { avg: 4.8, n: 25 }]]);
    expect(ratingsOf([{ kind: "jcc", avg: 4.1, n: 4 }], 1).size).toBe(0);
    expect(ratingsOf({ error: "x" }, 5).size).toBe(0);
  });
});

describe("a kind's calendar (EF16)", () => {
  it("is a public calendar: each date's name, times in UTC, place and page, and nothing about anyone", () => {
    const ics = icsFeed({ name: "Saturday · MicroMobility", host: "micromobility.sa", now: Date.parse("2099-01-01T00:00:00Z"), items: [
      { id: "2099-11-21", date: "2099-11-21", name: "Saturday Social Ride, with breakfast; long name ".repeat(3), gather: "06:00", start: "06:30", end: "08:30", place: "Jeddah Corniche Circuit", url: "https://micromobility.sa/experiences/s/2099-11-21" },
      { id: "2099-11-22", date: "2099-11-22", name: "Night", gather: null, start: "23:00", end: "01:00", place: null, url: "https://micromobility.sa/experiences/s/2099-11-22" },
    ] });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20991121T030000Z\r\nDTEND:20991121T053000Z");
    expect(ics).toContain("DTSTART:20991122T200000Z\r\nDTEND:20991122T220000Z"); // ends after midnight
    expect(ics).toContain("UID:2099-11-21@micromobility.sa");
    expect(ics).toContain("\\, with breakfast\\; long");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(ics).not.toMatch(/ATTENDEE|ORGANIZER|EMAIL|TEL/);
  });
  it("is offered for every kind but those only some visitors see", () => {
    expect(feedKind("saturday")).toBe(true);
    expect(feedKind("petromin")).toBe(false);
    expect(feedKind("farm")).toBe(false);
    expect(feedKind("../x")).toBe(false);
  });
});

// ── What the server makes of a session ────────────────────────────────────────────────────────

const row = (o: Record<string, unknown>) => ({
  status: "open", title: null, ride_kind: null, event_kind: "community", bike_slots: "{}", open_to_all: false, paid_ride: false, capacity: 30, needs_approval: true,
  spots: 30, addons: [], meet_url: null, location: null, description: null, price: null, route_slug: null, gender_only: null, closed_types: [], ...o,
});
const SAT = row({ id: "2099-11-21", session_date: "2099-11-21", bike_slots: '{"_time":"06:00 - 06:30"}', location: "JCC" });
const JCC = row({ id: "2099-11-20", session_date: "2099-11-20", event_kind: "jcc", bike_slots: '{"_time":"20:00 - 23:00"}', needs_approval: false, open_to_all: true });
const POOL = row({ id: "2099-11-19-sw", session_date: "2099-11-19", ride_kind: "swim", bike_slots: '{"_time":"17:00 - 18:30"}', gender_only: "female", location: "Sharafeyah Branch", open_to_all: true, needs_approval: false });
const RUN = row({ id: "2099-11-22-rh", session_date: "2099-11-22", ride_kind: "runher", bike_slots: '{"_time":"06:00 - 06:30"}' });
const FULL = row({ id: "2099-11-23-sw", session_date: "2099-11-23", status: "closed", ride_kind: "swim", bike_slots: '{"_time":"17:00 - 18:30","_fbk":1}', open_to_all: true, needs_approval: false, cancelled_at: null, draft: false, opens_at: null });
const ctx = (o: Partial<XpCtx> = {}): XpCtx => ({
  locale: "en", content: null, now: "2099-11-18T10:00", nowMs: Date.parse("2099-11-18T07:00:00Z"), member: false, satLink: false, prices: priceMap([]), window: null,
  appBase: "https://experiences.micromobility.sa", bookBase: "/experiences", facts: xpSettings(null, "en").facts, ...o,
});
const items = (rows: Record<string, unknown>[], o: Partial<XpCtx> = {}) => xpItems(rows.map((r) => toSession(r as never, false, true)!).filter(Boolean), ctx(o));

describe("a session as its row and page say it", () => {
  it("books here what the site has steps for, hands the rest over, and never books a date that is fully booked", () => {
    const [sat, jcc, pool, run, full] = items([SAT, JCC, POOL, RUN, FULL]);
    expect(sat.act).toEqual({ k: "book", href: "/experiences?ev=community&session=2099-11-21#book" });
    expect(jcc.act).toEqual({ k: "book", href: "/experiences?ev=jcc&session=2099-11-20#book" });
    expect(pool.act.k).toBe("book");
    expect(run.act.k).toBe("out");
    expect(run.act.k === "out" && run.act.href).toContain("ev=runher");
    expect(full).toMatchObject({ act: { k: "none" }, status: { k: "fbk" } });
    expect(items([SAT], { satLink: true })[0].act).toEqual({ k: "out", href: "/saturday?lang=en" });
  });
  it("says free rides are free, the cheapest bike from, and who may come", () => {
    const [sat, jcc, pool] = items([SAT, JCC, POOL]);
    expect(sat.price).toEqual({ k: "free" });
    expect(jcc.price?.k).toBe("from");
    expect(sat.facts.find((f) => f.k === "who")?.v).toEqual(["Community members", "Ages 5 and up"]);
    expect(pool.facts.find((f) => f.k === "who")?.v).toEqual(["Women only"]);
    expect(pool.gender).toBe("female");
    // the helmet comes with every ride, never sold or rented
    expect(jcc.facts.find((f) => f.k === "included")?.v[0]).toMatch(/helmet/i);
    expect(pool.facts.find((f) => f.k === "included")).toBeUndefined();
    expect(jcc.kids).toBe(true);
    expect(pool.kids).toBe(false);
  });
  it("puts the circuit at the booth, with its map and Directions, and a named place by its name", () => {
    const [jcc, pool] = items([JCC, POOL]);
    expect(jcc.place).toMatchObject({ name: "Jeddah Corniche Circuit", map: expect.stringContaining("output=embed") });
    expect(jcc.place?.dir).toContain("21.624565");
    expect(pool.place?.name).toBe("Sharafeyah Branch");
  });
  it("says the Saturday ride's sunrise and draws its routes, and the gathering before the start", () => {
    const [sat] = items([SAT]);
    expect(sat.sunrise).toMatch(/^Sunrise \d/);
    expect(sat.route).toMatchObject({ beg: "20 km", int: "40 km" });
    expect(sat).toMatchObject({ gather: "6 AM", start: "6:30 AM", len: null });
  });
  it("uses the facts staff wrote, and leaves out what they did not", () => {
    const content = { "xp.saturday.minutes": 120, "xp.saturday.pace": { en: "Easy · No-drop", ar: "سهل" }, "xp.saturday.bring": { en: "Water", ar: "ماء" } };
    const [sat] = items([SAT], { content, facts: xpSettings(content, "en").facts });
    expect(sat).toMatchObject({ len: 120, end: "8:30 AM", pace: ["Easy", "No-drop"] });
    expect(sat.facts.find((f) => f.k === "bring")?.v).toEqual(["Water"]);
    expect(items([SAT])[0].facts.find((f) => f.k === "bring")).toBeUndefined();
  });
  it("shares each kind's picture, and none of its own for the kinds only some visitors see", () => {
    expect(ogImageOf("saturday")).toBe("/site/experiences/og/saturday.jpg");
    expect(ogImageOf("farm")).toBeUndefined();
    expect(ogImageOf("petromin")).toBeUndefined();
    for (const k of ["saturday", "jcc", "swim", "workshop", "event", "snd96", "runher", "defe5k", "vlap", "arena", "blood", "yoga", "testride"]) {
      expect(readFileSync(fileURLToPath(new URL(`../../../public/site/experiences/og/${k}.jpg`, import.meta.url))).length, k).toBeLessThan(60_000);
    }
  });
  it("keeps the booking's event map and the kinds booked here in step with the page's own", () => {
    const page = src("app/[locale]/experiences/page.tsx");
    for (const [k, ev] of Object.entries(XP_EVENT_OF)) if (k !== "testride") expect(page, k).toMatch(new RegExp(`\\b${k}: "${ev}"`));
    expect(page).toContain(`new Set<RideKind>([${[...XP_HERE].map((k) => `"${k}"`).join(", ")}])`);
  });
});

// ── The page and the feed ────────────────────────────────────────────────────────────────────

const db = (sessions: unknown[]) => vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/rpc/list_sessions")) return json(sessions);
  if (url.includes("/rest/v1/site_content")) return json([{ key: "site.coming_soon", value: false }, { key: "page.experiences.visible", value: true }]);
  if (url.includes("/rpc/xp_kind_ratings")) return json([{ kind: "saturday", avg: 4.9, n: 30 }]);
  if (url.includes("api.met.no")) return json({ properties: { timeseries: [] } });
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  resetRides(); resetSiteContent(); resetMemo();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("/experiences", () => {
  it("opens on the list of every session, the booking steps only from a date", async () => {
    vi.stubGlobal("fetch", db([SAT, JCC, POOL]));
    const page = await ExperiencesPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) });
    expect(findAll(page, BookingFlow)).toHaveLength(0);
    const list = findAll(page, XpList)[0] as ReactElement<Parameters<typeof XpList>[0]>;
    expect(list.props.items.map((s) => s.id).sort()).toEqual(["2099-11-19-sw", "2099-11-20", "2099-11-21"]);
    expect(list.props.x.rating).toEqual({ saturday: { avg: 4.9, n: 30 } });
    resetRides();
    const flow = await ExperiencesPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ ev: "community", session: "2099-11-21" }) });
    expect(findAll(flow, XpList)).toHaveLength(0);
    expect((findAll(flow, BookingFlow)[0] as ReactElement<{ exit?: string }>).props.exit).toBe("/experiences");
  });
  it("names no Blood Donation or Farm House Night to a page without one of their dates", async () => {
    vi.stubGlobal("fetch", db([SAT, JCC]));
    const page = await ExperiencesPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) });
    expect(JSON.stringify(page)).not.toMatch(/Blood Donation|Give blood|Farm House|Nawar/);
  });
  it("lists a test ride only while staff switch test rides on", async () => {
    const TR = row({ id: "2099-11-24-tr", session_date: "2099-11-24", ride_kind: "testride", bike_slots: '{"_time":"16:00 - 18:00"}', open_to_all: true });
    vi.stubGlobal("fetch", db([SAT, TR]));
    const off = await ExperiencesPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) });
    const ids = (p: unknown) => (findAll(p, XpList)[0] as ReactElement<Parameters<typeof XpList>[0]>).props.items.map((s) => [s.id, s.kind]);
    expect(ids(off)).toEqual([["2099-11-21", "saturday"]]);
    expect(toSession(TR as never)?.testRide).toBe(true);
  });
});

describe("/api/xp/cal/<kind>", () => {
  it("answers a kind's dates as a calendar, and nothing for a kind only some visitors see", async () => {
    vi.stubGlobal("fetch", db([SAT, JCC]));
    const r = await feedGET(new Request("https://micromobility.sa/api/xp/cal/saturday?lang=ar"), { params: Promise.resolve({ kind: "saturday" }) });
    expect(r.headers.get("content-type")).toContain("text/calendar");
    const body = await r.text();
    expect(body).toContain("UID:2099-11-21@micromobility.sa");
    expect(body).not.toContain("2099-11-20@");
    expect(body).toContain("/experiences/s/2099-11-21?lang=ar");
    const no = await feedGET(new Request("https://micromobility.sa/api/xp/cal/farm"), { params: Promise.resolve({ kind: "farm" }) });
    expect(no.status).toBe(404);
  });
});

// ── The owner's rules, in the files ──────────────────────────────────────────────────────────

describe("the owner's rules", () => {
  const css = src("components/experiences/sx-B5.css");
  it("pins nothing to the bottom of the screen and turns round for Arabic by logical properties alone (R2, RTL)", () => {
    expect(css).not.toMatch(/position:\s*fixed/);
    expect(css).not.toMatch(/(^|[\s;{])(margin|padding|border)-(left|right)\s*:|(^|[\s;{])(left|right)\s*:|text-align:\s*(left|right)|float:/m);
  });
  it("hovers only where a pointer hovers, and moves only for those who allow it", () => {
    const outside = css.replace(/@media \(hover: hover\) \{[^\n]*\}\s*\}?/g, "");
    expect(outside).not.toMatch(/:hover/);
    expect(css).toMatch(/prefers-reduced-motion: no-preference/);
  });
  it("draws its marks, never an emoji (R1)", () => {
    for (const f of ["components/experiences/XpList.tsx", "components/experiences/XpDetail.tsx", "components/experiences/sx-B5.text.ts", "components/experiences/sx-B5-icons.tsx"]) {
      expect(src(f), f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
  it("leaves every fact empty until staff write it, and the public editor never names the farm or the blood donation", () => {
    expect(PAGES).toContain(xpSchema);
    for (const sec of xpSchema.sections) for (const f of sec.fields) {
      if (f.type === "text" || f.type === "longtext") expect(f.def, `${sec.id}.${f.id}`).toEqual({ en: "", ar: "" });
      if (f.type === "number" && sec.id !== "general") expect(f.def).toBe(0);
    }
    expect(JSON.stringify(xpSchema)).not.toMatch(/Farm House|Nawar|Blood Donation|"farm"|"blood"/);
    const g = xpSettings(null, "en").general;
    expect(g).toEqual({ privateOn: true, calendars: true, testRides: false, weatherDays: 5, ratingMin: 20 });
  });
  it("loads the photo band as an <img> with srcset and fetchpriority high, which a phone never fetches (E09)", () => {
    const page = src("app/[locale]/experiences/page.tsx");
    expect(page).toMatch(/fetchPriority="high"/);
    expect(page).toMatch(/srcSet=\{srcSet\(heroImg\)\}/);
    expect(page).toMatch(/<source media="\(max-width: 767px\)" srcSet="data:image\/gif/);
    expect(page).not.toMatch(/backgroundImage: `linear-gradient/);
  });
  it("gives a card that goes elsewhere an arrow and no radio dot (E05)", () => {
    const flow = src("components/experiences/BookingFlow.tsx");
    expect(flow).toContain("{!out && <span className={`sc-dot");
    expect(flow).toContain('<Ic name="go" size={16} flip className="sc-go" />');
  });
  it("sets the footer's social marks four to a row (E08)", () => {
    expect(src("components/site/site.css")).toContain(".mm-foot-social { display: grid; grid-template-columns: repeat(4, max-content);");
  });
});
