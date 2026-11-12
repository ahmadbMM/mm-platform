import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ExperienceSteps from "@/components/experiences/ExperienceSteps";
import { dictOf } from "@/i18n/dicts";
import { LOCALE_CODES } from "@/i18n/locales";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";
import { fmtDayTile } from "../tickets";
import ExperiencesPage from "../../app/[locale]/experiences/page";

// cookies() is a request's; here it holds the account's cookie a test sets, or none.
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// Featured (the user, 2026-11-13: "create a new featured section under micromobility experiences in the booking app to
// put featured sessions and special events such as hatha yoga class", then "even created one in the main event card
// picker page"), on the website's Experiences as in the booking app: a card above the event cards for each featured
// date, and those dates first in their event's list. Which dates are featured: rides.test.ts; which have a card and
// how a list is ordered: event-info.test.ts. Here: what the page gives the steps, and what the first step draws.
const comm = (id: string, kind: string, slots: string, more: Record<string, unknown> = {}) => ({
  id, session_date: id.slice(0, 10), status: "open", event_kind: "community", ride_kind: kind, title: null, open_to_all: false, paid_ride: false,
  needs_approval: false, capacity: 15, bike_slots: slots, location: null, meet_url: null, description: null, ...more,
});
const YG = comm("2099-11-21-yg", "yoga", '{"_time":"16:00 - 17:30"}', { location: "SILKDEER", meet_url: "https://maps.app.goo.gl/TfCSEPEPxA4C5f7d7" });
const YG_OFF = { ...YG, bike_slots: '{"_time":"16:00 - 17:30","_feat":0}' };
const SAT = comm("2099-11-16", "saturday", '{"_time":"05:45 - 06:15","_feat":1}', { needs_approval: true, capacity: 40 });
const SAT_PLAIN = comm("2099-11-23", "saturday", '{"_time":"05:45 - 06:15"}', { needs_approval: true, capacity: 40 });
const SWIM = comm("2099-11-18-sw", "swim", '{"_time":"07:00 - 08:00","_feat":1}');
const SWIM2 = comm("2099-11-25-sw", "swim", '{"_time":"07:00 - 08:00","_feat":1}');
const DEFE = comm("2099-11-27-df", "defe5k", '{"_time":"19:00"}');
const PM = comm("2099-11-15-pm", "petromin", '{"_time":"19:00 - 21:00","_feat":1}', { paid_ride: true });
const JCC = { id: "2099-11-22", session_date: "2099-11-22", status: "open", event_kind: null, ride_kind: null, title: null, capacity: 40, bike_slots: '{"_time":"21:00 - 23:00","_feat":1}', location: "JCC", meet_url: null };

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
/** Every element of `type` in a tree a page returned, its own children unrendered. */
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}
/** A page's database: the sessions through list_sessions, the tags an account holds, nothing for anything else. */
const db = (sessions: unknown[], holds: string[] = []) => vi.fn(async (url: string, init?: RequestInit) => {
  if (url.includes("/rpc/list_sessions")) return json(sessions);
  for (const fn of ["community_member", "petromin_member"]) if (url.includes(`/rpc/${fn}`)) return json(holds.includes(fn));
  if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  return json([]);
});
const experiences = async (sessions: unknown[], locale = "en", holds: string[] = []) => {
  resetRides(); // each page reads its own sessions, never the minute's copy of the last
  vi.stubGlobal("fetch", db(sessions, holds));
  const page = await ExperiencesPage({ params: Promise.resolve({ locale }) });
  const steps = findAll(page, ExperienceSteps)[0] as ReactElement<Parameters<typeof ExperienceSteps>[0]>;
  return { steps, props: steps.props, html: renderToStaticMarkup(steps) };
};
/** The first step's Featured section, "" when it has none. */
const section = (html: string) => /<section class="xs-feat".*?<\/section>/.exec(html)?.[0] ?? "";
const cardsIn = (html: string) => section(html).match(/<button type="button" class="xs-feat-card[^"]*".*?<\/button>/g) ?? [];
/** A card's words as a visitor reads them, "" for a card that is not there. */
const text = (html: string | undefined) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

beforeEach(() => {
  resetRides(); resetSiteContent();
  jar.account = "";
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("what the page gives the steps", () => {
  it("names the featured dates in order, each with its card, and marks them among their event's dates", async () => {
    const { props } = await experiences([YG, SAT, SAT_PLAIN, SWIM, JCC]);
    expect(props.featured).toEqual([{ ev: "community", id: "2099-11-16" }, { ev: "community", id: "2099-11-18-sw" }, { ev: "community", id: "2099-11-21-yg" }]);
    const dates = props.events.find((e) => e.key === "community")!.sessions;
    // the page keeps the dates soonest first; the steps put the featured ones first (lib/event-info.ts featuredFirst)
    expect(dates.map((s) => [s.id, !!s.feat])).toEqual([["2099-11-16", true], ["2099-11-18-sw", true], ["2099-11-21-yg", true], ["2099-11-23", false]]);
    // a circuit night is never featured, whatever its settings say
    expect(props.events.find((e) => e.key === "jcc")!.sessions.map((s) => s.feat)).toEqual([undefined]);
  });
  it("gives a featured date its day as a tile, and yoga how long it runs", async () => {
    const dates = (await experiences([YG, SAT, SWIM])).props.events.find((e) => e.key === "community")!.sessions;
    expect(dates.find((s) => s.kind === "yoga")!.feat).toEqual({ wd: "Sat", dn: "21", mo: "Nov", len: "90 min" });
    expect(dates.find((s) => s.kind === "saturday")!.feat).toEqual({ wd: "Mon", dn: "16", mo: "Nov", len: null });
    expect(dates.find((s) => s.kind === "swim")!.feat).toEqual({ wd: "Wed", dn: "18", mo: "Nov", len: null });
    expect(fmtDayTile("2099-11-21", "ar")).toEqual({ wd: "السبت", dn: "21", mo: "نوفمبر" });
    // a day that cannot be read: its number as stored, else nothing
    expect(fmtDayTile("2099-13-45", "en")).toEqual({ wd: "", dn: "45", mo: "" });
    expect(fmtDayTile("not a date", "en")).toEqual({ wd: "", dn: "", mo: "" });
  });
  it("features a special event as it is made, until staff switch it off", async () => {
    expect((await experiences([YG, DEFE])).props.featured).toEqual([{ ev: "community", id: "2099-11-21-yg" }, { ev: "community", id: "2099-11-27-df" }]);
    const off = await experiences([YG_OFF, SAT_PLAIN]);
    expect(off.props.featured).toEqual([]);
    expect(off.props.events.find((e) => e.key === "community")!.sessions.every((s) => !s.feat)).toBe(true);
  });
  it("shows four cards at most, the soonest", async () => {
    const { props } = await experiences([YG, SAT, SWIM, SWIM2, DEFE]);
    expect(props.featured!.map((f) => f.id)).toEqual(["2099-11-16", "2099-11-18-sw", "2099-11-21-yg", "2099-11-25-sw"]);
    // the fifth is still featured in its event's list
    expect(props.events.find((e) => e.key === "community")!.sessions.filter((s) => s.feat).length).toBe(5);
  });
  it("shows a members' date's card to every visitor, as the community card lists that date to every visitor", async () => {
    const visitor = await experiences([YG]);
    expect(visitor.props.member).toBe(false);
    expect(visitor.props.events.find((e) => e.key === "community")!.sessions.map((s) => [s.id, s.members])).toEqual([["2099-11-21-yg", true]]);
    expect(visitor.props.featured).toEqual([{ ev: "community", id: "2099-11-21-yg" }]);
    jar.account = "c1~a1b2c3d4e5f6a7b8c9d0";
    const member = await experiences([YG], "en", ["community_member"]);
    expect(member.props.member).toBe(true);
    expect(member.props.featured).toEqual([{ ev: "community", id: "2099-11-21-yg" }]);
  });
  it("shows a featured Petromin night's card to a Petromin tag holder alone, under Petromin Days, where its date is listed", async () => {
    for (const holds of [[], ["community_member"]]) {
      jar.account = holds.length ? "c1~a1b2c3d4e5f6a7b8c9d0" : "";
      const { props } = await experiences([PM, SAT], "en", holds);
      expect(props.events.map((e) => e.key), String(holds)).toEqual(["community", "jcc"]); // MicroMobility Experiences leads (kind-theme.test.ts)
      expect(props.featured, String(holds)).toEqual([{ ev: "community", id: "2099-11-16" }]);
    }
    jar.account = "c1~a1b2c3d4e5f6a7b8c9d0";
    const holder = await experiences([PM, SAT], "en", ["petromin_member"]);
    expect(holder.props.events.map((e) => e.key)).toEqual(["community", "petromin", "jcc"]);
    expect(holder.props.featured).toEqual([{ ev: "petromin", id: "2099-11-15-pm" }, { ev: "community", id: "2099-11-16" }]);
    expect(holder.props.events[1].sessions.map((s) => !!s.feat)).toEqual([true]); // Petromin Days, after MicroMobility Experiences
  });
});

describe("the words", () => {
  // the booking app's featTitle and featRest, word for word in the ten languages it speaks
  const APP: Record<string, [string, string]> = {
    en: ["Featured", "Upcoming"], ar: ["مميّزة", "المواعيد القادمة"], fr: ["À la une", "À venir"], es: ["Destacados", "Próximas fechas"], pt: ["Destaques", "Próximas datas"],
    ur: ["نمایاں", "آنے والی تاریخیں"], hi: ["ख़ास", "आने वाली तारीखें"], tl: ["Tampok", "Mga paparating"], ne: ["विशेष", "आगामी मितिहरू"], bn: ["বিশেষ", "আসন্ন তারিখ"],
  };
  it("are the booking app's in the languages it speaks", async () => {
    for (const [locale, [featured, upcoming]] of Object.entries(APP)) {
      const { props } = await experiences([YG], locale);
      expect([props.text.featured, props.text.upcoming], locale).toEqual([featured, upcoming]);
    }
  });
  it("are said in every one of the site's languages, short as a heading is", () => {
    expect(LOCALE_CODES.length).toBe(16);
    for (const locale of LOCALE_CODES) {
      if (locale === "en" || locale === "ar") continue;
      const d = dictOf(locale)!;
      for (const en of ["Featured", "Upcoming"]) {
        expect(d[en], `${locale} ${en}`).toBeTruthy();
        expect(d[en], `${locale} ${en}`).not.toBe(en);
        expect(d[en].length, `${locale} ${en}`).toBeLessThanOrEqual(24);
      }
    }
  });
});

describe("the first step's Featured section", () => {
  it("is not there with nothing featured: the step as it was", async () => {
    const { html } = await experiences([YG_OFF, SAT_PLAIN, JCC]);
    expect(html).not.toContain("xs-feat");
    expect(html).not.toContain("Featured");
    expect(html).toContain('id="xs-h1"');
  });
  it("stands above the event cards, under a star on its disc and the word, with one card that fills the row", async () => {
    const { html } = await experiences([YG, SAT_PLAIN, JCC]);
    const s = section(html);
    expect(s).toMatch(/^<section class="xs-feat" aria-labelledby="xs-feat-h"><h2 id="xs-feat-h" class="xs-feat-h" tabindex="-1"><span class="xs-star" aria-hidden="true"><svg [^>]*><path [^>]*><\/path><\/svg><\/span><span>Featured<\/span><\/h2>/);
    expect(html.indexOf('class="xs-feat"')).toBeLessThan(html.indexOf('id="xs-h1"'));
    expect(html.indexOf('class="xs-feat"')).toBeLessThan(html.indexOf('class="xs-events"'));
    expect(cardsIn(html).length).toBe(1);
    expect(s).toContain('<div class="xs-feat-grid">'); // one card: no rail
    // drawn, never an emoji
    expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("draws yoga's card in its own colours: the day, its name, its time and length, where, and who leads it", async () => {
    const [card] = cardsIn((await experiences([YG])).html);
    expect(card).toMatch(/^<button type="button" class="xs-feat-card ev-yoga xs-feat-yg">/);
    expect(card).toContain('class="sc-yg-scene"');
    expect(card).toContain('<span class="xs-feat-day"><span class="xs-feat-wd">Sat</span><b>21</b><span>Nov</span></span>');
    expect(card).toContain('<span class="xs-feat-name sc-yg-title">Hatha Yoga for Cyclists</span>');
    expect(text(card)).toBe("Sat 21 Nov Hatha Yoga for Cyclists 4 PM – 5:30 PM 90 min SILKDEER with Jassim Alsaady");
    expect(card).toContain('<span class="xs-feat-with"><bdi>with Jassim Alsaady</bdi></span>');
    expect(card).not.toContain("sc-spots"); // places to book: nothing to say
  });
  it("draws any other date's card in its kind's colour: the day, its name, its time, where and its price word", async () => {
    const cards = cardsIn((await experiences([SAT, SWIM])).html);
    expect(cards.length).toBe(2);
    expect(cards[0]).toMatch(/^<button type="button" class="xs-feat-card ev-saturday">/);
    expect(text(cards[0])).toBe("Mon 16 Nov Saturday Social Ride Gathering 5:45 AM Start 6:15 AM Jeddah Corniche Circuit Complimentary");
    expect(cards[1]).toMatch(/^<button type="button" class="xs-feat-card ev-swim">/);
    expect(text(cards[1])).toBe("Wed 18 Nov Triathlon Pool Session 7 AM – 8 AM Jeddah Corniche Circuit Complimentary");
    for (const c of cards) expect(c).not.toContain("sc-yg");
  });
  it("puts each part of a line in a wrapper that takes the page's direction, the words in a bdi inside it", async () => {
    // the rule before a part and its room are the wrapper's (experiences.css .xs-feat-mi > span): on a bdi they would
    // follow the words' own direction, and a Latin venue on the Arabic page lost its start
    const [card] = cardsIn((await experiences([YG], "ar")).html);
    expect(card).toContain('<span class="xs-feat-mi"><span><bdi>SILKDEER</bdi></span><span class="xs-feat-with"><bdi>مع جاسم الساعدي</bdi></span></span>');
    expect(card).not.toMatch(/<span class="xs-feat-mi">(?:(?!<\/span><\/span>).)*?<bdi>[^<]*<\/bdi><bdi>/);
    expect(card).toContain('<span class="xs-feat-wd">السبت</span><b>21</b><span>نوفمبر</span>');
    const css = readFileSync(new URL("../../components/experiences/experiences.css", import.meta.url), "utf8");
    expect(css).toContain(".xs-feat-mi > span { position: relative; min-width: 0; padding-inline-start: 17px;");
    expect(css).toContain(".xs-feat-mi > span::before {");
    expect(css).not.toMatch(/xs-feat[^{}]*bdi[^{}]*\{/);
  });
  it("is one row that scrolls sideways once there are two, and says Waitlist on a full date", async () => {
    const { html } = await experiences([SAT, { ...YG, status: "full" }]);
    expect(section(html)).toContain('<div class="xs-feat-grid xs-feat-rail">');
    const cards = cardsIn(html);
    expect(cards.length).toBe(2);
    expect(cards[0]).not.toContain("sc-spots");
    expect(cards[1]).toContain('<span class="sc-spots full">Waitlist</span>');
  });
  it("shows no more than four cards", async () => {
    expect(cardsIn((await experiences([YG, SAT, SWIM, SWIM2, DEFE])).html).length).toBe(4);
  });
  it("has no card for a Petromin night but for a Petromin tag holder", async () => {
    expect(cardsIn((await experiences([PM])).html)).toEqual([]);
    jar.account = "c1~a1b2c3d4e5f6a7b8c9d0";
    const cards = cardsIn((await experiences([PM], "en", ["petromin_member"])).html);
    expect(cards.length).toBe(1);
    expect(cards[0]).toMatch(/^<button type="button" class="xs-feat-card ev-petromin">/);
    expect(text(cards[0])).toMatch(/^Sun 15 Nov Petromin 7 PM – 9 PM Jeddah Corniche Circuit/);
  });
});

describe("Featured's look", () => {
  const css = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const xp = css("../../components/experiences/experiences.css"), booking = css("../../components/booking/booking.css");
  it("wears the star on a neon disc, ink on neon, in the site's tokens", () => {
    expect(xp).toMatch(/\.xs-star \{[^}]*background: var\(--mm-green-neon\); color: var\(--mm-black\);/);
    const tokens = css("../../../../../packages/design-tokens/tokens.css");
    for (const t of ["--mm-green-neon: #03FF89", "--mm-black: #1A1919", "--mm-white: #FFFFFF", "--mm-n600: #57605A", "--mm-n400: #8A938C"]) expect(tokens, t).toContain(t);
  });
  it("draws the day as a calendar leaf: the weekday in white on a band of the kind's colour", () => {
    expect(xp).toMatch(/\.xs-feat-day \.xs-feat-wd \{[^}]*color: var\(--mm-white\); background: var\(--ev\);/);
    // each kind's colour reaches the card (booking.css), the Saturday ride's the card's own default
    expect(xp).toMatch(/\.xs-feat-card \{ --ev: #077a4b;/);
    // (the Saturday ride's, the pool's and a Petromin night's are their kind's colour set, booking.css --k-*, 2026-11-13)
    for (const k of ["saturday", "swim", "petromin", "defe5k", "yoga"]) expect(booking, k).toMatch(new RegExp(`:is\\(\\.sc-card, \\.sc-wrap, \\.xs-info, \\.xs-feat-card\\)\\.ev-${k} \\{ --ev: (?:#[0-9a-f]{6}|var\\(--k-(?:sat|pool|pm)\\)); \\}`));
  });
  it("gives white on each kind's band a contrast of 4.5:1 or more", () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    // a kind's colour set (booking.css --k-*) read as its hex
    const hexOf = (v: string) => (v.startsWith("var(") ? new RegExp(`${v.slice(4, -1)}: (#[0-9A-Fa-f]{6});`).exec(booking)![1] : v);
    const bands = ["#077a4b", ...["saturday", "swim", "petromin", "defe5k", "yoga"].map((k) => hexOf(new RegExp(`\\.xs-feat-card\\)\\.ev-${k} \\{ --ev: (#[0-9a-f]{6}|var\\(--k-[a-z]+\\));`).exec(booking)![1])), "#b4532f"];
    expect(bands.slice(1, 4)).toEqual(["#077A4B", "#0D7D8F", "#A33B2E"]);
    for (const hex of bands) expect(1.05 / (lum(hex) + 0.05), hex).toBeGreaterThanOrEqual(4.5);
  });
  it("keeps yoga's card in the Sunset Hatha tokens, its glow mirrored where the page reads from the right", () => {
    expect(xp).toMatch(/\.xs-feat-card\.xs-feat-yg \{ color: var\(--yg-ink\); background-color: var\(--yg-cream\);/);
    expect(xp).toMatch(/\[dir="rtl"\] \.xs-feat-card\.xs-feat-yg \{ background-image: radial-gradient\(110% 130% at 0% 100%/);
    expect(xp).toMatch(/\.xs-feat-yg \.xs-feat-day \.xs-feat-wd \{ color: var\(--mm-white\); background: var\(--yg-clay\); \}/);
    expect(xp).toMatch(/\.xs-feat-yg \.xs-feat-with \{[^}]*color: var\(--yg-sage-ink\);/);
  });
  it("is a grid whose single card keeps a column's width, and on a phone one row that scrolls sideways with the next card at the edge", () => {
    expect(xp).toContain(".xs-feat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));");
    const phone = /@media \(max-width: 767px\) \{\s*\.xs-feat \{[^}]*\}[\s\S]*?\n\}/.exec(xp)?.[0] ?? "";
    expect(phone).toMatch(/\.xs-feat-grid\.xs-feat-rail \{ display: flex;[^}]*overflow-x: auto;[^}]*scroll-snap-type: x mandatory;/);
    expect(phone).toContain(".xs-feat-rail > .xs-feat-card { flex: 0 0 86%; scroll-snap-align: start; }");
    // only the rail is narrowed: one card on a phone is the grid's single column, the row's whole width
    expect(phone).not.toMatch(/\.xs-feat-grid \{/);
  });
  it("uses the page's sides, never left or right, so Arabic and Urdu mirror", () => {
    const block = xp.slice(xp.indexOf("/* ── Featured"), xp.indexOf("/* A phone names only the step it is on"));
    expect(block.length).toBeGreaterThan(1000);
    expect(block).not.toMatch(/\b(?:margin|padding|border)-(?:left|right)\b|[^-]\b(?:left|right): /);
    expect(block).toContain("text-align: start");
  });
});
