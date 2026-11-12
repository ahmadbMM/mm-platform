import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps from "@/components/experiences/ExperienceSteps";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";
import { isYoga, YOGA_MARK } from "../yoga";
import ExperiencesPage from "../../app/[locale]/experiences/page";
import EventsPage from "../../app/[locale]/events/page";

// cookies() is a request's; no account here.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// Yoga (the user, 2026-11-12: "create a session under micromobility experiences, yoga for the community ... try to theme
// it in the best way possible"): Hatha Yoga for Cyclists with Jassim Alsaady, a date inside MicroMobility Experiences, as
// the booking app's session script makes it (supabase/checks/yoga-session-2026-11-21.sql), on Experiences and Events.
const MAP = "https://maps.app.goo.gl/TfCSEPEPxA4C5f7d7";
const YG = {
  id: "2099-11-21-yg", session_date: "2099-11-21", day: "Saturday", status: "open", event_kind: "community", ride_kind: "yoga", title: null,
  open_to_all: false, paid_ride: false, needs_approval: false, hide_queue: true, price: null, capacity: 15, spots: 15, bike_slots: '{"_time":"16:00 - 17:30"}',
  location: "SILKDEER", meet_url: MAP, description: null,
};
const SAT = { id: "2099-11-28", session_date: "2099-11-28", day: "Saturday", status: "open", event_kind: "community", ride_kind: "saturday", title: null, open_to_all: false, paid_ride: false, needs_approval: true, capacity: 40, bike_slots: '{"_time":"05:45 - 06:15"}', location: null, meet_url: null };
const JCC = { id: "2099-11-22", session_date: "2099-11-22", day: "Sunday", status: "open", event_kind: null, ride_kind: null, title: null, capacity: 40, bike_slots: '{"_time":"21:00 - 23:00"}', location: "JCC", meet_url: null };

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
/** Every element of `type` in a tree a page returned, its own children unrendered. */
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
/** A page's database: the sessions through list_sessions, nothing for anything else. */
const db = (sessions: unknown[]) => vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/rpc/list_sessions")) return json(sessions);
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
const experiences = async (sessions: unknown[], locale = "en") => {
  vi.stubGlobal("fetch", db(sessions));
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }) });
  return findAll(page, ExperienceSteps)[0] as ReactElement<Parameters<typeof ExperienceSteps>[0]>;
};
const eventsPage = async (sessions: unknown[], locale = "en") => {
  vi.stubGlobal("fetch", db(sessions));
  const page = await EventsPage({ params: Promise.resolve({ locale }) });
  return renderToStaticMarkup((page.props as { children: ReactElement }).children);
};

beforeEach(() => {
  resetRides(); resetSiteContent();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("yoga on Experiences", () => {
  it("is a date inside MicroMobility Experiences (the community card), never a card of its own", async () => {
    const steps = await experiences([YG, SAT, JCC]);
    expect(steps.props.events.map((e) => e.key)).toEqual(["jcc", "community"]);
    const comm = steps.props.events.find((e) => e.key === "community")!;
    expect(comm.sessions.map((s) => s.id)).toEqual(["2099-11-21-yg", "2099-11-28"]);
    expect(comm.sessions.filter(isYoga).map((s) => s.id)).toEqual(["2099-11-21-yg"]);
  });
  it("gives its card its name, its start and end, how long and where, and who leads it, members only, free, no bike price", async () => {
    const s = (await experiences([YG])).props.events.find((e) => e.key === "community")!.sessions[0];
    expect(s).toMatchObject({ kind: "yoga", name: "Hatha Yoga for Cyclists", members: true, free: true, paid: false, event: false, meta: [], route: null, breakfast: null, opens: null });
    expect(s.yoga).toEqual({ meta: ["4 PM – 5:30 PM", "90 min", "SILKDEER"], with: "with Jassim Alsaady" });
    expect(s.when).toEqual({ gather: false, a: "4 PM", b: "5:30 PM" });
    expect(s.defe).toBeUndefined();
  });
  it("gives its Details its own text with its times, SILKDEER and its map, and who leads it, how long, the level and what to bring", async () => {
    const i = (await experiences([YG])).props.events.find((e) => e.key === "community")!.sessions[0].info;
    expect(i.text).toContain("with Jassim Alsaady: mindful movement");
    expect(i.text).toContain(" 4 PM to 5:30 PM. ");
    expect(i).toMatchObject({ who: "Community members", price: "Complimentary", collect: null, place: "SILKDEER", map: MAP, distance: null, extra: null });
    expect(i.more).toEqual([
      { k: "Led by", v: "Jassim Alsaady" }, { k: "Length", v: "90 min" },
      { k: "Level", v: "All levels, no yoga experience needed" }, { k: "Bring", v: "Your yoga mat, and wear comfortable clothing" },
    ]);
  });
  it("says it in Arabic in the booking app's words", async () => {
    const s = (await experiences([YG], "ar")).props.events.find((e) => e.key === "community")!.sessions[0];
    expect(s.name).toBe("هاثا يوغا لراكبي الدراجات");
    expect(s.yoga?.with).toBe("مع جاسم الساعدي");
    expect(s.yoga?.meta[1]).toBe("90 دقيقة");
    expect(s.info.more?.map((x) => x.k)).toEqual(["يقدّمها", "المدة", "المستوى", "أحضر معك"]);
    expect(s.info.text).toContain("هاثا يوغا");
  });
  it("says its words in a language the booking app does not speak (German)", async () => {
    const s = (await experiences([YG], "de")).props.events.find((e) => e.key === "community")!.sessions[0];
    for (const v of [s.name, s.yoga?.with, s.yoga?.meta[1], ...(s.info.more ?? []).flatMap((x) => [x.k, x.v]), s.info.text]) {
      expect(v, String(v)).toBeTruthy();
      expect(v, String(v)).not.toMatch(/^(Led by|Length|Level|Bring|with Jassim Alsaady|90 min)$/);
    }
  });
});

describe("yoga on Events", () => {
  it("is listed in its clay with how long it runs and where, booked on the community card", async () => {
    const html = await eventsPage([YG, JCC]);
    expect(html).toContain("Hatha Yoga for Cyclists");
    expect(html).toContain("--kind:#b4532f");
    expect(html).toContain("<span>90 min</span>");
    expect(html).toContain("<span><bdi>SILKDEER</bdi></span>");
    expect(html).toContain("ev=community&amp;session=2099-11-21-yg");
  });
});

describe("yoga's look", () => {
  const css = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  it("draws its date card, summary and ticket in the booking app's Sunset Hatha tokens, the name in Marcellus", () => {
    const booking = css("../../components/booking/booking.css"), xp = css("../../components/experiences/experiences.css");
    for (const t of ["--yg-clay: #B4532F", "--yg-clay-dk: #93401F", "--yg-sage: #6E8266", "--yg-sage-ink: #55684E", "--yg-ink: #3B2A20", "--yg-ink-2: #6B5446", "--yg-sand: #F8F0E5", "--yg-cream: #FFFBF5", "--yg-glow: 236, 150, 96"]) expect(booking, t).toContain(t);
    for (const sel of [".sc-card.sc-yoga", '[dir="rtl"] .sc-card.sc-yoga', ".sc-yg-scene", ".sc-yg-title", ".tk-card.ev-yoga", '[dir="rtl"] .tk-card.ev-yoga', ".tk-yg-know", ".tk-logo.tk-logo-yoga"]) expect(booking, sel).toContain(sel);
    for (const sel of [".xs .xs-go.ev-yoga", ".xs-info.ev-yoga .xs-info-go", ".xs-logo.xs-yoga-logo"]) expect(xp, sel).toContain(sel);
    // the face the titles ask for is the one the layout loads
    expect(css("../../app/[locale]/layout.tsx")).toMatch(/Marcellus\(\{[^}]*variable: "--cs-font-yg"/);
    expect(booking).toMatch(/\.sc-yg-title \{ font-family: var\(--cs-font-yg\)/);
    expect(booking).toMatch(/html:is\(\[lang="ar"\], \[lang="ur"\]\) \.sc-yg-title \{ font-family: var\(--cs-font-ar\)/);
  });
  it("has the booking app's mark", () => {
    expect(YOGA_MARK).toBe("/site/yoga-mark.svg");
    const svg = readFileSync(new URL("../../../public/site/yoga-mark.svg", import.meta.url), "utf8");
    expect(svg).toMatch(/^<svg[^>]*viewBox="0 0 64 40"/);
    for (const c of ["#B4532F", "#6E8266", "#3B2A20"]) expect(svg, c).toContain(c);
  });
});
