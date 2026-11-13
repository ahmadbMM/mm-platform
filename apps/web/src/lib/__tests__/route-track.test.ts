import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as tickets.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { cleanTrack, gpxFileName, lineKm, pointAt, routeCum, routeDist, routeDrawing, routeGpx, routePageOf, routeTrackKey, routeTrackOf, turnName, type RoutePage } from "../route-track";
import { routeItems } from "../route-names";
import { ticketRoute, ticketSession, type TicketRow } from "../tickets";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import { ROUTE_PAGE_WORDS, routePageWords } from "@/components/booking/RoutePage.words";
import { LOCALE_CODES } from "@/i18n/locales";
import { serverLocalize } from "@/i18n/dicts";
import AccountPage from "../../app/[locale]/account/[[...part]]/page";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// The route's own page on My Account's ticket (the booking app's new features F11, 2026-11-13: route-page.js _rtpKey,
// _rtpClean, _rtpSvg, _rtpGpx, and _rtBtn on the ticket). The expected keys, drawings and GPX text below are what the
// booking app's own functions give for the same input (route-page.js run on these values, 2026-11-13).
const STORED = {
  v: 1,
  pts: [[21.5, 39.1], [21.51, 39.1], [21.51, 39.12], ["21.52", 39.12], [91, 0], null],
  turns: [{ km: 2.5, en: "Roundabout <A&B>", ar: "الدوار" }, { km: 1, en: "  King   Road ", ar: "" }, { km: -1, en: "x" }, { km: 3, en: "", ar: "" }],
};
const PTS: [number, number][] = [[21.5, 39.1], [21.51, 39.1], [21.51, 39.12], [21.52, 39.12]];
// the Routes page's list as staff save it (content/pages/routes.ts)
const ROUTES_CONTENT = { "routes.routes.items": [{ slug: { en: "obhur-coast", ar: "obhur-coast" }, name: { en: "Obhur coast", ar: "شاطئ أبحر" }, km: 32.5, level: { en: "Easy", ar: "سهل" }, surface: { en: "Road", ar: "طريق" }, href: { href: "https://maps.app.goo.gl/o" } }] };

describe("where a route's line is stored (_rtpKey)", () => {
  it("writes every character but a letter or digit as its code, as the booking app does", () => {
    expect(routeTrackKey("obhur-coast")).toBe("route.track.obhur_2d_coast");
    expect(routeTrackKey("a.b")).toBe("route.track.a_2e_b");
    expect(routeTrackKey("corniche-north-to-south-loop-with-extra-km")).toBe("route.track.corniche_2d_north_2d_to_2d_south_2d_loop_2d_with_2d_extra_2d_km");
    expect(routeTrackKey("x".repeat(68))).toBe(`route.track.${"x".repeat(68)}`); // 80 characters: still the slug
  });
  it("keeps a slug too long for the table under two short sums of itself", () => {
    expect(routeTrackKey("x".repeat(69))).toBe("route.track.h.b4c32d78ba1fe7d");
    expect(routeTrackKey("x".repeat(69)).length).toBeLessThanOrEqual(80);
  });
});

describe("the stored route, read as stored (_rtpClean)", () => {
  it("keeps the points in range and the named turn points in order along the route", () => {
    expect(cleanTrack(STORED)).toEqual({ pts: PTS, turns: [{ km: 1, en: "King Road", ar: "" }, { km: 2.5, en: "Roundabout <A&B>", ar: "الدوار" }] });
  });
  it("keeps turn points without a line, a line without turn points, and nothing else", () => {
    expect(cleanTrack({ pts: [[21.5, 39.1]], turns: [{ km: 0, ar: "البداية" }] })).toEqual({ pts: [], turns: [{ km: 0, en: "", ar: "البداية" }] });
    expect(cleanTrack({ pts: PTS })).toEqual({ pts: PTS, turns: [] });
    for (const v of [null, "x", 5, {}, { pts: [[21.5, 39.1]] }, { turns: [{ km: 1 }] }, { pts: "x", turns: {} }]) expect(cleanTrack(v), JSON.stringify(v)).toBeNull();
  });
  it("keeps at most 30 turn points and names of 60 characters", () => {
    const t = cleanTrack({ turns: Array.from({ length: 40 }, (_, i) => ({ km: 40 - i, en: `T${i} ${"y".repeat(80)}` })) })!;
    expect(t.turns).toHaveLength(30);
    expect(t.turns[0].km).toBe(1);
    expect(t.turns[0].en).toHaveLength(60);
  });
  it("is found in the site's content by the route's slug", () => {
    expect(routeTrackOf({ "route.track.obhur_2d_coast": STORED }, "obhur-coast")?.pts).toEqual(PTS);
    expect(routeTrackOf({ "route.track.obhur-coast": STORED }, "obhur-coast")).toBeNull();
    expect(routeTrackOf({}, "obhur-coast")).toBeNull();
    expect(routeTrackOf(null, "obhur-coast")).toBeNull();
    expect(routeTrackOf({ "route.track.constructor": STORED }, "toString")).toBeNull();
  });
});

describe("the line's arithmetic", () => {
  it("measures it as the booking app does", () => {
    expect(routeDist([21.5, 39.1], [21.5, 39.1])).toBe(0);
    expect(routeDist([21.5, 39.1], [21.51, 39.1])).toBeCloseTo(1111.95, 1);
    expect(lineKm(PTS)).toBeCloseTo(4.2929164389212735, 10);
    expect(lineKm([PTS[0]])).toBe(0);
    expect(routeCum(PTS)).toHaveLength(4);
  });
  it("finds the point a distance along it, the ends for anything before or after", () => {
    const cum = routeCum(PTS);
    expect(pointAt(PTS, cum, 0)).toEqual(PTS[0]);
    expect(pointAt(PTS, cum, -5)).toEqual(PTS[0]);
    expect(pointAt(PTS, cum, 1e9)).toEqual(PTS[3]);
    const p = pointAt(PTS, cum, cum[1] / 2)!;
    expect(p[0]).toBeCloseTo(21.505, 6);
    expect(p[1]).toBe(39.1);
    expect(pointAt([], [], 10)).toBeNull();
  });
  it("draws it north up, 320 wide and 120 to 300 high, the start and each turn point where it falls (_rtpSvg)", () => {
    expect(routeDrawing(PTS, [1, 2.5])).toEqual({ w: 320, h: 300, d: "M37.2 282L37.2 150L282.8 150L282.8 18", start: [37.2, 282], marks: [[37.2, 163.3], [202, 150]] });
    expect(routeDrawing([[21.5, 39.1], [21.5, 39.2]], [])).toEqual({ w: 320, h: 120, d: "M18 60L302 60", start: [18, 60], marks: [] });
    expect(routeDrawing([[21.5, 39.1], [21.6, 39.1]], [5])).toMatchObject({ h: 300, d: "M160 282L160 18", marks: [[160, 163.3]] }); // north is up
    expect(routeDrawing([PTS[0]], [1])).toBeNull();
  });
});

describe("the GPX file (_rtpGpx)", () => {
  const turns = [{ km: 1, name: "King Road" }, { km: 2.5, name: "Roundabout <A&B>" }];
  it("is the line as one track and the turn points as waypoints on it, word for word as the booking app writes it", () => {
    expect(routeGpx('Obhur "coast" & back', PTS, turns)).toBe([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="MicroMobility" xmlns="http://www.topografix.com/GPX/1/1">',
      "<metadata><name>Obhur &quot;coast&quot; &amp; back</name></metadata>",
      '<wpt lat="21.50899" lon="39.10000"><name>1. King Road</name></wpt>',
      '<wpt lat="21.51000" lon="39.11342"><name>2. Roundabout &lt;A&amp;B&gt;</name></wpt>',
      "<trk><name>Obhur &quot;coast&quot; &amp; back</name><trkseg>",
      '<trkpt lat="21.50000" lon="39.10000"/>', '<trkpt lat="21.51000" lon="39.10000"/>', '<trkpt lat="21.51000" lon="39.12000"/>', '<trkpt lat="21.52000" lon="39.12000"/>',
      "</trkseg></trk>", "</gpx>", "",
    ].join("\n"));
  });
  it("names the turn points in the page's language and drops characters XML cannot hold", () => {
    expect(routeGpx("Obhur", PTS, [{ km: 2.5, name: "الدوار" }])).toContain("<name>1. الدوار</name>");
    expect(routeGpx("A\u0001B", PTS, [])).toContain("<metadata><name>AB</name></metadata>");
    expect(turnName({ en: "Roundabout", ar: "الدوار" }, "ar")).toBe("الدوار");
    expect(turnName({ en: "", ar: "الدوار" }, "en")).toBe("الدوار");
    expect(turnName({ en: "Roundabout", ar: "" }, "ar")).toBe("Roundabout");
    expect(turnName({ en: "Roundabout", ar: "الدوار" }, "ur")).toBe("Roundabout");
  });
  it("is saved under the route's slug", () => {
    expect(gpxFileName("obhur-coast")).toBe("obhur-coast.gpx");
    expect(gpxFileName("--")).toBe("route.gpx");
  });
});

describe("what the ticket's route page shows (routePageOf)", () => {
  const jcc = ticketSession({ id: "j1", session_date: "2099-03-01", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null })!;
  const routes = new Map([["obhur-coast", { name: "Obhur coast", km: 32.5, level: "Easy", surface: "Road", href: "https://maps.app.goo.gl/o" }]]);
  const content = { "route.track.obhur_2d_coast": STORED };
  it("is the Routes page's route with its stored line and turn points", () => {
    expect(routePageOf({ ...jcc, routeSlug: "obhur-coast" }, routes, content, "en")).toEqual({
      slug: "obhur-coast", name: "Obhur coast", km: 32.5, level: "Easy", surface: "Road", href: "https://maps.app.goo.gl/o",
      pts: PTS, turns: [{ km: 1, name: "King Road" }, { km: 2.5, name: "Roundabout <A&B>" }],
    });
    expect(routePageOf({ ...jcc, routeSlug: "obhur-coast" }, routes, content, "ar")?.turns[1].name).toBe("الدوار");
  });
  it("reads the Routes page's items as routeItems resolves them, in the page's language", () => {
    expect(routePageOf({ routeSlug: "obhur-coast" }, routeItems(ROUTES_CONTENT, "ar"), content, "ar")).toMatchObject({ name: "شاطئ أبحر", level: "سهل", surface: "طريق", href: "https://maps.app.goo.gl/o" });
  });
  it("measures the line when the Routes page gives no distance, and keeps a map link only when it is https", () => {
    const bare = new Map([["obhur-coast", { name: "Obhur coast", km: 0, level: "", surface: "", href: "http://maps.example/o" }]]);
    const p = routePageOf({ ...jcc, routeSlug: "obhur-coast" }, bare, content, "en")!;
    expect(p.km).toBeCloseTo(4.2929, 4);
    expect(p.href).toBeNull();
  });
  it("is nothing without a route, a route the Routes page no longer lists, or nothing stored for it", () => {
    expect(routePageOf(jcc, routes, content, "en")).toBeNull();
    expect(routePageOf(undefined, routes, content, "en")).toBeNull();
    expect(routePageOf({ ...jcc, routeSlug: "gone" }, routes, { "route.track.gone": STORED }, "en")).toBeNull();
    expect(routePageOf({ ...jcc, routeSlug: "obhur-coast" }, routes, {}, "en")).toBeNull();
    expect(routePageOf({ ...jcc, routeSlug: "obhur-coast" }, routes, null, "en")).toBeNull();
    expect(routePageOf({ ...jcc, routeSlug: "obhur-coast" }, routes, { "route.track.obhur_2d_coast": { v: 1, pts: [], turns: [] } }, "en")).toBeNull();
  });
});

describe("its words", () => {
  it("are in every language, the booking app's own in English and Arabic", () => {
    expect(Object.keys(ROUTE_PAGE_WORDS).sort()).toEqual([...LOCALE_CODES].sort());
    for (const l of LOCALE_CODES) for (const k of ["open", "dist", "surface", "level", "turns", "gpx", "lineAlt"] as const) expect(ROUTE_PAGE_WORDS[l][k], `${l}.${k}`).toMatch(/\S/);
    expect(routePageWords("en")).toEqual({ open: "Route details", dist: "Distance", surface: "Surface", level: "Level", turns: "Turn points", gpx: "Save GPX file", lineAlt: "The route as a line, north at the top" });
    expect(routePageWords("ar").open).toBe("تفاصيل المسار");
    expect(routePageWords("fr").open).toBe("Détails du parcours");
    expect(routePageWords("xx")).toBe(ROUTE_PAGE_WORDS.en);
    for (const l of LOCALE_CODES) expect(ROUTE_PAGE_WORDS[l].gpx, l).toContain("GPX");
  });
});

describe("on the ticket", () => {
  const jcc = ticketSession({ id: "j1", session_date: "2099-03-01", event_kind: null, ride_kind: null, needs_approval: null, hide_queue: null, bike_slots: '{"_time":"21:00 - 23:00","_collect":"20:15"}', meet_url: null, paid_ride: null })!;
  const routed = { ...jcc, routeSlug: "obhur-coast" };
  const routes = new Map([["obhur-coast", { name: "Obhur coast", km: 32.5, level: "Easy", surface: "Road", href: "https://maps.app.goo.gl/o" }]]);
  const page = (locale = "en") => routePageOf(routed, routes, { "route.track.obhur_2d_coast": STORED }, locale);
  const row = (o: Partial<TicketRow> = {}): TicketRow => ({ id: "q1abcdef", sessionId: "j1", date: "2099-03-01", day: "Sunday", queueNum: 4, status: "waiting", waitlistNum: null, approval: null, price: 75, paid: false, name: "Ann", type: "Road", checkedInAt: null, checkedOutAt: null, rideDuration: null, bikeId: null, addonLines: [], runKm: null, ...o });
  const card = (o: { locale?: string; past?: boolean; session?: typeof jcc; routePage?: RoutePage | null } = {}) => {
    const s = o.session ?? routed;
    return renderToStaticMarkup(createElement(TicketCard, {
      locale: o.locale ?? "en", today: "2099-03-01", rows: [row(o.past ? { status: "done" } : {})], session: s, name: "Obhur ride", cue: null, t: serverLocalize(TICKET, o.locale ?? "en"),
      gather: "Gathering", start: "Start", typeName: (x: string) => x, links: { edit: null, manage: "https://book.example.test/?tab=bookings", place: null },
      route: ticketRoute(s, routes), routePage: o.routePage === undefined ? page(o.locale) : o.routePage, now: Date.parse("2099-03-01T09:00:00Z"), past: o.past,
    }));
  };
  it("offers Route details in the route's block behind Details, after the map link", () => {
    const html = card();
    expect(html).toMatch(/<a class="tk-rt-a" href="https:\/\/maps.app.goo.gl\/o"[^>]*>Open the map<\/a><button type="button" class="tk-rt-a tk-rt-open">Route details<\/button><dialog class="tk-dlg tk-rtp-dlg"/);
    expect(html.indexOf("tk-more-body")).toBeLessThan(html.indexOf("tk-rt-open"));
    expect(card({ past: true })).toContain(">Route details</button>"); // tonight's ridden card too
  });
  it("opens a centred pop-up: the name, the line north up, the facts, the turn points, Save GPX file, Open the map and Close", () => {
    const html = card();
    const dlg = html.slice(html.indexOf("<dialog"), html.indexOf("</dialog>"));
    expect(dlg).toContain('<p class="tk-rtp-k">Route</p>');
    expect(dlg).toMatch(/<h2 id="[^"]+-t" class="tk-dlg-t"><bdi>Obhur coast<\/bdi><\/h2>/);
    expect(dlg).toMatch(/<svg class="tk-rtp-map" viewBox="0 0 320 300" direction="ltr" role="img" aria-label="The route as a line, north at the top" focusable="false"><path d="M37.2 282L37.2 150L282.8 150L282.8 18"><\/path><circle class="tk-rtp-st" cx="37.2" cy="282" r="5.5"><\/circle>/);
    expect(dlg).toContain('<text x="37.2" y="166.8" text-anchor="middle">1</text>');
    expect(dlg).toContain('<text x="202" y="153.5" text-anchor="middle">2</text>');
    expect(dlg).toContain("<dt>Distance</dt><dd><bdi>32.5 km</bdi></dd>");
    expect(dlg).toContain("<dt>Surface</dt><dd>Road</dd>");
    expect(dlg).toContain("<dt>Level</dt><dd>Easy</dd>");
    expect(dlg).toMatch(/<h3 class="tk-rtp-h" id="[^"]+-h">Turn points<\/h3>/);
    expect(dlg).toContain('<li><span class="tk-rtp-n" aria-hidden="true">1</span><span class="tk-rtp-tname" dir="auto">King Road</span><bdi class="tk-rtp-km">1 km</bdi></li>');
    expect(dlg).toContain('<span class="tk-rtp-tname" dir="auto">Roundabout &lt;A&amp;B&gt;</span><bdi class="tk-rtp-km">2.5 km</bdi>');
    expect(dlg).toMatch(/<div class="tk-dlg-acts"><button type="button" class="tk-rtp-gpx">Save GPX file<\/button><a class="tk-dlg-a" href="https:\/\/maps.app.goo.gl\/o" target="_blank" rel="noopener">Open the map<\/a><button type="button" class="tk-rtp-close">Close<\/button><\/div>/);
    expect(dlg).not.toMatch(/elevation|climb/i);
  });
  it("leaves out what is not stored: no drawing or GPX without a line, no list without turn points", () => {
    const turnsOnly = routePageOf(routed, routes, { "route.track.obhur_2d_coast": { turns: [{ km: 3, en: "Bridge" }] } }, "en");
    const html = card({ routePage: turnsOnly });
    expect(html).toContain(">Route details</button>");
    expect(html).not.toContain("tk-rtp-map");
    expect(html).not.toContain("Save GPX file");
    expect(html).toContain(">Bridge</span>");
    const lineOnly = routePageOf(routed, routes, { "route.track.obhur_2d_coast": { pts: PTS } }, "en");
    expect(card({ routePage: lineOnly })).not.toContain("Turn points");
  });
  it("is not there without a stored route, on the circuit's own drawing, or on a session without bikes", () => {
    expect(card({ routePage: null })).not.toContain("tk-rt-open");
    expect(card({ session: jcc })).not.toContain("tk-rt-open"); // the circuit: ticketRoute draws its track
    expect(card({ session: { ...routed, bikes: false } })).not.toContain("tk-rt-open");
  });
  it("speaks the page's language, the turn points named in Arabic for Arabic", () => {
    const ar = card({ locale: "ar" });
    expect(ar).toContain(">تفاصيل المسار</button>");
    expect(ar).toContain('aria-label="المسار مرسومًا كخط، والشمال في الأعلى"');
    expect(ar).toContain("<dt>المسافة</dt><dd><bdi>32.5 كم</bdi></dd>");
    expect(ar).toContain(">الدوار</span>");
    expect(ar).toContain(">حفظ ملف GPX</button>");
    expect(card({ locale: "de" })).toContain(">Streckendetails</button>");
  });
});

// My Account hands each ticket its route's page from the site's content (loadSiteContent), with no read of its own.
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
describe("My Account", () => {
  beforeEach(() => {
    resetRides(); resetSiteContent();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2099-03-01T09:00:00Z")); // noon in Riyadh
  });
  afterEach(() => { jar.account = ""; resetSiteContent(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const stub = (site: Record<string, unknown>) => {
    const reads: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url), fn = /\/rpc\/([a-z0-9_]+)/.exec(u)?.[1] ?? "";
      reads.push(fn || u.replace(/^https:\/\/example\.supabase\.co\/rest\/v1\//, "").split("?")[0]);
      if (fn === "customer_profile") return json([{ name: "Ann Rider", email: "ann@example.test", phone: "+966500000000" }]);
      if (fn === "my_bookings") return json([{ id: "w1abcdef", session_id: "j1", session_date: "2099-03-02", session_day: "Monday", status: "waiting", queue_num: 3, price: 75, paid: false, name: "Ann", type_preference: "Road" }]);
      if (fn === "list_sessions") return json([{ id: "j1", session_date: "2099-03-02", event_kind: null, ride_kind: null, needs_approval: false, bike_slots: '{"_time":"21:00 - 23:00"}', route_slug: "obhur-coast" }]);
      if (u.includes("/rest/v1/site_content?")) return json(Object.entries(site).map(([key, value]) => ({ key, value })));
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
      return json([]);
    }));
    return reads;
  };
  it("gives the ticket its route's stored line and turn points, read from the site's content alone", async () => {
    jar.account = "c1~a1b2c3d4e5f6a7b8c9d0";
    const reads = stub({ ...ROUTES_CONTENT, "route.track.obhur_2d_coast": STORED });
    const p = await AccountPage({ params: Promise.resolve({ locale: "en", part: undefined }), searchParams: Promise.resolve({}) });
    const cards = findAll(p, TicketCard).map((e) => e.props as { routePage?: RoutePage | null; route?: unknown });
    expect(cards).toHaveLength(1);
    expect(cards[0].route).toMatchObject({ name: "Obhur coast", km: 32.5 });
    expect(cards[0].routePage).toMatchObject({ slug: "obhur-coast", name: "Obhur coast", km: 32.5, level: "Easy", surface: "Road", pts: PTS });
    expect(reads.filter((r) => r.startsWith("site_content")).length).toBeLessThanOrEqual(1);
    expect(reads.some((r) => /route|track/.test(r))).toBe(false);
  });
  it("gives none when nothing is stored for the route", async () => {
    jar.account = "c1~a1b2c3d4e5f6a7b8c9d0";
    stub(ROUTES_CONTENT);
    const p = await AccountPage({ params: Promise.resolve({ locale: "en", part: undefined }), searchParams: Promise.resolve({}) });
    const cards = findAll(p, TicketCard).map((e) => e.props as { routePage?: RoutePage | null; route?: unknown });
    expect(cards).toHaveLength(1);
    expect(cards[0].route).toMatchObject({ name: "Obhur coast" });
    expect(cards[0].routePage).toBeNull();
  });
});

