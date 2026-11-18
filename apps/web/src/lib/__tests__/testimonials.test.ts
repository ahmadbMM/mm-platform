import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import {
  TM_EMPTY, TM_PHOTO_MAX, isAbout, sinceText, starFills, testimonialsOn, tmAboutOfKind, tmAboutParam, tmAvg, tmError, tmFit, tmFitQuality,
  tmHref, tmMine, tmName, tmPageParam, tmPhotoBytes, tmPhotoSrc, tmPills, tmPublic, tmRefusal, tmSendArgs, tmSitemapPaths, tmStarsFromScore,
  tmStatusWord, tmStripItems, tmTotal,
} from "../testimonials";
import { readFeatured, readTestimonials } from "../testimonials-server";
import { hiddenPages, resetSiteContent } from "../site";
import { resetMemo } from "../memo";
import { pageCacheKey } from "../page-cache";
import { askBack } from "../ask";
import { COMMUNITY, NAV_LINKS } from "../links";
import proxy from "../../proxy";
import { GET as mineGET } from "../../app/api/testimonials/mine/route";
import { POST as sendPOST } from "../../app/api/testimonials/send/route";
import { POST as deletePOST } from "../../app/api/testimonials/delete/route";
import { GET as photoGET } from "../../app/api/testimonials/photo/[id]/route";
import TestimonialCard from "../../components/testimonials/TestimonialCard";
import ReviewsStrip from "../../components/home/ReviewsStrip";
import { T } from "../../components/testimonials/Testimonials.text";
import { localize } from "../../i18n/tx";
import { dictOf } from "../../i18n/dicts";

// Testimonials on the website (the booking app's migration 20261119120000_testimonials.sql is the database's side): the
// answers read safely, the "since" line, the name or "A MicroMobility rider", the average, the launch switch's reach
// (header, sitemap, Home's strip), the rider's routes and the photo route. There is no database here: every answer is
// the contract's, stubbed.
const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const W = T.en;
const SITE = "https://micromobility.sa";
const ACCT = "mm_acct=cust1~tok_0123456789abcdef";

const PUBLIC = {
  on: true, count: 3, rated: 2, avg: 4.5, by_about: { saturday: 2, session: 1 },
  items: [
    { id: 7, about: "saturday", stars: 5, body: "Best Saturday mornings in Jeddah, every single week.", lang: "en", name: "Sara A.", since: { year: 2025, rides: 12 }, photo: true, featured: true, published_at: "2026-11-18T10:00:00Z" },
    { id: "8", about: "session", stars: 4, body: "تجربة رائعة على الحلبة مع فريق محترف جداً", lang: "ar", name: null, since: null, photo: false, featured: false, published_at: "2026-11-17T10:00:00Z" },
    { id: 9, about: "nope", stars: 5, body: "an unknown kind is left out", name: null },
    { id: 10, about: "event", stars: null, body: "Staff added this one from a WhatsApp message.", name: "Omar", since: { year: 2024, rides: 1 }, photo: false },
    "junk",
  ],
};

describe("the public list", () => {
  it("is read safely: unknown kinds and junk are left out, ids as numbers, an anonymous one carries no since line", () => {
    const l = tmPublic(PUBLIC);
    expect(l.on).toBe(true);
    expect(l.count).toBe(3);
    expect(l.avg).toBe(4.5);
    expect(l.byAbout).toEqual({ saturday: 2, session: 1 });
    expect(l.items.map((x) => x.id)).toEqual([7, 8, 10]);
    expect(l.items[1]).toMatchObject({ name: null, since: null, stars: 4, about: "session" });
    expect(l.items[2]).toMatchObject({ stars: null, name: "Omar", since: { year: 2024, rides: 1 } });
    expect(tmPublic(null)).toEqual(TM_EMPTY);
    expect(tmPublic({ avg: "4.86", count: "5" })).toMatchObject({ avg: 4.9, count: 5, items: [] });
    expect(tmPublic({ avg: 9 }).avg).toBeNull();
  });
  it("the pills: only kinds with any, in the form's order, and none when fewer than two have any", () => {
    expect(tmPills(tmPublic(PUBLIC))).toEqual(["saturday", "session"]);
    expect(tmPills(tmPublic({ by_about: { event: 4 } }))).toEqual([]);
    expect(tmPills(tmPublic({ by_about: { other: 1, learn: 2, workshop: 0 } }))).toEqual(["learn", "other"]);
  });
  it("pages 60 at a time, by the filter's own total", () => {
    const l = tmPublic(PUBLIC);
    expect(tmTotal(l, null)).toBe(3);
    expect(tmTotal(l, "saturday")).toBe(2);
    expect(tmTotal(l, "learn")).toBe(0);
    expect(tmHref(null)).toBe("/testimonials");
    expect(tmHref("saturday")).toBe("/testimonials?about=saturday");
    expect(tmHref("event", 3)).toBe("/testimonials?about=event&page=3");
    expect(tmHref(null, 2)).toBe("/testimonials?page=2");
    expect(tmPageParam("2")).toBe(2);
    for (const bad of [undefined, "", "0", "-1", "x", "99999", "1.5"]) expect(tmPageParam(bad), String(bad)).toBe(1);
    expect(tmAboutParam("learn")).toBe("learn");
    expect(tmAboutParam(["event", "x"])).toBe("event");
    expect(tmAboutParam("Saturday")).toBeNull();
  });
});

describe("the since line, the name and the stars", () => {
  it("says the rides only when there are any, one ride as one", () => {
    expect(sinceText({ year: 2025, rides: 12 }, W)).toBe("Rider since 2025 · 12 rides");
    expect(sinceText({ year: 2025, rides: 1 }, W)).toBe("Rider since 2025 · 1 ride");
    expect(sinceText({ year: 2025, rides: 0 }, W)).toBe("Rider since 2025");
    expect(sinceText(null, W)).toBeNull();
    expect(sinceText({ year: 2026, rides: 3 }, T.ar)).toBe("درّاج منذ 2026 · عدد الجولات: 3");
  });
  it("names the rider as they chose, or A MicroMobility rider", () => {
    expect(tmName({ name: "Sara A." }, W.anon)).toBe("Sara A.");
    expect(tmName({ name: null }, W.anon)).toBe("A MicroMobility rider");
    expect(tmName({ name: "  " }, T.ar.anon)).toBe("درّاج من MicroMobility");
  });
  it("writes the average with one decimal, Latin digits, the language's own decimal mark", () => {
    expect(tmAvg(4.9, "en")).toBe("4.9");
    expect(tmAvg(5, "en")).toBe("5.0");
    expect(tmAvg(4.9, "de")).toBe("4,9");
    expect(tmAvg(4.9, "fr")).toBe("4,9");
    for (const l of ["ar", "ur", "hi", "bn", "ne"]) expect(tmAvg(4.7, l), l).toMatch(/^4[.,٫]7$/);
    expect(W.avgOf("4.9", 23)).toBe("4.9 from 23 testimonials");
    expect(W.avgOfOne("5.0")).toBe("5.0 from 1 testimonial");
  });
  it("draws full, half and empty stars", () => {
    expect(starFills(5)).toEqual(["full", "full", "full", "full", "full"]);
    expect(starFills(4.5)).toEqual(["full", "full", "full", "full", "half"]);
    expect(starFills(4.2)).toEqual(["full", "full", "full", "full", "none"]);
    expect(starFills(4.8)).toEqual(["full", "full", "full", "full", "full"]);
    expect(starFills(1)).toEqual(["full", "none", "none", "none", "none"]);
  });
  it("halves a rating's score into stars, as the database does for an old comment", () => {
    expect(tmStarsFromScore(10)).toBe(5);
    expect(tmStarsFromScore(9)).toBe(5);
    expect(tmStarsFromScore(8)).toBe(4);
    expect(tmStarsFromScore(1)).toBe(1);
  });
  it("tells what a booking was, as the database's _tm_about", () => {
    expect(tmAboutOfKind("saturday")).toBe("saturday");
    expect(tmAboutOfKind("workshop")).toBe("workshop");
    expect(tmAboutOfKind("jcc")).toBe("session");
    for (const k of ["petromin", "runher", "event", "swim", "farm"]) expect(tmAboutOfKind(k), k).toBe("event");
    expect(tmAboutOfKind(null)).toBe("other");
    expect(isAbout("other")).toBe(true);
  });
});

describe("a card", () => {
  const w = localize(T, "en", null);
  it("shows the stars drawn, the words in their own direction, the name, the since line, the photo and the kind", () => {
    const [c] = tmPublic(PUBLIC).items;
    const html = renderToStaticMarkup(createElement(TestimonialCard, { c, w }));
    expect(html).toContain('role="img" aria-label="5 out of 5 stars"');
    expect(html).toContain("<svg");
    expect(html).toContain('<blockquote dir="auto">Best Saturday mornings');
    expect(html).toContain("Sara A.");
    expect(html).toContain("Rider since 2025 · 12 rides");
    expect(html).toContain(`src="${tmPhotoSrc(7)}"`);
    expect(html).toContain("Saturday community ride");
    expect(html).not.toMatch(/[☀-➿\u{1F300}-\u{1FAFF}]/u); // no emoji, no star character
  });
  it("an anonymous one: A MicroMobility rider, no since line, no photo; words escaped", () => {
    const c = tmPublic({ items: [{ id: 3, about: "other", stars: 3, body: "<script>alert(1)</script> twenty chars", name: null, since: { year: 2025, rides: 4 } }] }).items[0];
    const html = renderToStaticMarkup(createElement(TestimonialCard, { c, w }));
    expect(html).toContain("A MicroMobility rider");
    expect(html).not.toContain("Rider since");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("the launch switch", () => {
  it("is on only with an explicit true", () => {
    expect(testimonialsOn({ "testimonials.on": true })).toBe(true);
    for (const v of [false, "true", 1, null, undefined, { on: true }]) expect(testimonialsOn({ "testimonials.on": v }), String(v)).toBe(false);
    expect(testimonialsOn(null)).toBe(false);
  });
  it("hides the header's link (and the search's, the footer's, My Account's shortcut) while off", () => {
    const on = { "testimonials.on": true, "page.club.visible": true };
    expect(hiddenPages(on)).not.toContain("testimonials");
    expect(hiddenPages({ ...on, "testimonials.on": false })).toContain("testimonials");
    expect(hiddenPages(null)).toContain("testimonials");
    expect(NAV_LINKS.find((l) => l.key === "testimonials")?.href).toBe("/testimonials");
    expect(COMMUNITY.pages).toContain("testimonials");
  });
  it("puts the page in the sitemap only while on, never the page where one is written", () => {
    expect(tmSitemapPaths({ "testimonials.on": true })).toEqual(["/testimonials"]);
    expect(tmSitemapPaths({ "testimonials.on": false })).toEqual([]);
    expect(tmSitemapPaths(null)).toEqual([]);
  });
  it("keeps the public page at the edge like any page, never the page where one is written", () => {
    const req = (p: string) => new Request(`${SITE}${p}`, { headers: { cookie: "NEXT_LOCALE=en" } });
    expect(pageCacheKey(req("/testimonials"), "v1")).toContain("/testimonials?lang=en");
    expect(pageCacheKey(req("/testimonials/write"), "v1")).toBeNull();
  });
  it("feeds Home's strip from the featured ones after staff's own reviews, drawn with stars; staff's own as before", () => {
    const cards = tmPublic(PUBLIC).items;
    const items = tmStripItems(cards, W);
    expect(items[0]).toEqual({ name: "Sara A.", role: "Rider since 2025 · 12 rides", quote: cards[0].body, stars: 5, starsLabel: "5 out of 5 stars", own: true });
    expect(items[1]).toMatchObject({ name: "A MicroMobility rider", role: "Session or rental", stars: 4 });
    const staff = { name: "Lina", role: "Road rider", quote: "Great shop." };
    const strip = (reviews: Parameters<typeof ReviewsStrip>[0]["reviews"]) =>
      renderToStaticMarkup(createElement(ReviewsStrip, { reviews, dir: "ltr" })); // the page's language: English with no provider
    const before = strip([staff]);
    expect(before).not.toContain("tm-stars");
    expect(before).not.toContain('dir="auto"');
    const both = strip([staff, ...items]);
    expect(both.indexOf("Lina")).toBeLessThan(both.indexOf("Sara A."));
    expect(both).toContain('aria-label="5 out of 5 stars"');
    expect(both).toContain('<blockquote dir="auto">“Best Saturday mornings');
  });
});

describe("the rider's own", () => {
  it("testimonial_mine is read safely; the one-time ask is the booking app's and is not carried", () => {
    const m = tmMine({
      ok: true, on: false, names: { full: "Sara Ahmed Ali", short: "Sara A." }, since: { year: 2025, rides: 3 },
      items: [
        { id: 4, about: "learn", stars: 5, body: "Learned in two lessons, the coaches were patient.", name_mode: "short", display_name: "Sara A.", status: "rejected", photo: false, source: "web", created_at: "2026-11-18T10:00:00Z" },
        { id: 5, about: "learn", status: "weird" },
      ],
      ask: { entry_id: "e1", body: "x" },
    });
    expect(m).toEqual({
      on: false, names: { full: "Sara Ahmed Ali", short: "Sara A." }, since: { year: 2025, rides: 3 },
      items: [{ id: 4, about: "learn", stars: 5, body: "Learned in two lessons, the coaches were patient.", nameMode: "short", displayName: "Sara A.", status: "rejected", photo: false, source: "web", entryId: null, createdAt: "2026-11-18T10:00:00Z", publishedAt: null }],
    });
    expect(tmMine({ ok: false, error: "signin" })).toBeNull();
    expect(tmRefusal({ ok: false, error: "signin" })).toBe("signin");
    expect(tmRefusal({ ok: false, error: "weird" })).toBe("generic");
    expect(tmRefusal({ ok: true })).toBeNull();
    expect(tmMine({ ok: true, names: { full: null, short: "" } })?.names).toEqual({ full: null, short: null });
  });
  it("says rejected and hidden alike: Not published", () => {
    expect(tmStatusWord("pending")).toBe("waiting");
    expect(tmStatusWord("published")).toBe("published");
    expect(tmStatusWord("rejected")).toBe("not");
    expect(tmStatusWord("hidden")).toBe("not");
  });
  it("has words for every code the database and the site can answer, in English and Arabic", () => {
    for (const code of ["signin", "consent", "invalid", "body", "link", "stars", "about", "name", "photo", "entry", "dup", "limit", "throttled", "gone", "busy", "absent", "generic"]) {
      expect(tmError(code)).toBe(code);
      expect(T.en.errors[code], code).toBeTruthy();
      expect(T.ar.errors[code], code).toBeTruthy();
    }
    expect(tmError("origin")).toBe("generic");
  });
});

describe("a send, read before it goes to the database", () => {
  const web = { body: "Twenty characters and then some more.", stars: 5, about: "saturday", nameMode: "short", consent: true, photo: null, source: "web", lang: "ar" };
  it("takes the form's and the rating's sends, with the tick as sent", () => {
    expect(tmSendArgs(web)).toEqual({ p_body: web.body, p_stars: 5, p_about: "saturday", p_name_mode: "short", p_consent: true, p_photo: null, p_source: "web", p_entry: null, p_lang: "ar" });
    expect(tmSendArgs({ ...web, consent: "yes" })?.p_consent).toBe(false);
    expect(tmSendArgs({ ...web, entry: "e1" })?.p_entry).toBeNull(); // a form's send names no booking
    expect(tmSendArgs({ ...web, source: "rating", entry: "e_42" })).toMatchObject({ p_source: "rating", p_entry: "e_42" });
    expect(tmSendArgs({ ...web, lang: "english" })?.p_lang).toBe("en");
    expect(tmSendArgs({ ...web, stars: null })?.p_stars).toBeNull(); // the database answers "stars"
  });
  it("refuses what cannot be a send", () => {
    for (const bad of [
      null, [], { ...web, body: 5 }, { ...web, body: "x".repeat(4001) }, { ...web, stars: 4.5 }, { ...web, stars: "5" },
      { ...web, source: "app" }, { ...web, source: "staff" }, { ...web, source: "rating" }, { ...web, source: "rating", entry: "bad id!" },
      { ...web, photo: "x".repeat(TM_PHOTO_MAX + 1) }, { ...web, photo: 7 }, { ...web, about: 3 }, { ...web, nameMode: null },
    ]) expect(tmSendArgs(bad), JSON.stringify(bad)?.slice(0, 60)).toBeNull();
  });
});

describe("the photo", () => {
  // a 1x1 PNG
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  it("is decoded from a JPEG, PNG or WebP data: URL, nothing else", () => {
    const p = tmPhotoBytes(`data:image/png;base64,${PNG}`);
    expect(p?.type).toBe("image/png");
    expect(Array.from(p!.bytes.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]); // "PNG"
    for (const bad of [null, "", `data:image/svg+xml;base64,${PNG}`, "data:image/png;base64,***", `data:text/html;base64,${PNG}`, `data:image/jpeg;base64,${"A".repeat(TM_PHOTO_MAX)}`]) {
      expect(tmPhotoBytes(bad)).toBeNull();
    }
  });
  it("is made down to 1200 px on its longest side, never up, then the quality stepped down until it fits", () => {
    expect(tmFit(4000, 3000)).toEqual({ w: 1200, h: 900 });
    expect(tmFit(1080, 1920)).toEqual({ w: 675, h: 1200 });
    expect(tmFit(800, 600)).toEqual({ w: 800, h: 600 });
    const sizes: number[] = [];
    const draw = (q: number) => { sizes.push(q); return `data:image/jpeg;base64,${"A".repeat(Math.round(q * 1_000_000))}`; };
    const u = tmFitQuality(draw);
    expect(u!.length).toBeLessThanOrEqual(TM_PHOTO_MAX);
    expect(sizes[0]).toBe(0.82);
    expect(sizes.length).toBeGreaterThan(1);
    expect(tmFitQuality(() => `data:image/jpeg;base64,${"A".repeat(TM_PHOTO_MAX)}`)).toBeNull();
    expect(tmFitQuality(() => "data:image/png;base64,AAAA")).toBeNull();
  });
});

describe("the routes", () => {
  beforeEach(() => {
    resetSiteContent(); resetMemo("tm:");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => { resetSiteContent(); resetMemo("tm:"); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const rpc = (answer: (fn: string, body: Record<string, unknown>) => Response) => vi.fn(async (url: string, init?: RequestInit) => {
    const fn = String(url).split("/rpc/")[1] ?? "";
    return answer(fn, JSON.parse(String(init?.body ?? "{}")));
  });
  const post = (path: string, body: unknown, o: { origin?: string; cookie?: string } = {}) =>
    new Request(`${SITE}${path}`, { method: "POST", headers: { origin: o.origin ?? SITE, "content-type": "application/json", ...(o.cookie === "" ? {} : { cookie: o.cookie ?? ACCT }) }, body: JSON.stringify(body) });

  it("mine: signed out without asking; signed in, testimonial_mine with the cookie's id and token", async () => {
    const f = rpc(() => json({ ok: true, on: true, names: { full: "Sara Ahmed", short: "Sara A." }, since: null, items: [] }));
    vi.stubGlobal("fetch", f);
    const out = await mineGET(new Request(`${SITE}/api/testimonials/mine`));
    expect(out.status).toBe(401);
    expect(await out.json()).toEqual({ ok: false, error: "signin" });
    expect(f).not.toHaveBeenCalled();
    const res = await mineGET(new Request(`${SITE}/api/testimonials/mine`, { headers: { cookie: ACCT } }));
    expect(await res.json()).toEqual({ ok: true, on: true, names: { full: "Sara Ahmed", short: "Sara A." }, since: null, items: [] });
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(String(f.mock.calls[0][0])).toBe("https://example.supabase.co/rest/v1/rpc/testimonial_mine");
    expect(JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))).toEqual({ p_id: "cust1", p_token: "tok_0123456789abcdef" });
  });
  it("mine: a session refused, a database without the function, no answer", async () => {
    vi.stubGlobal("fetch", rpc(() => json({ ok: false, error: "signin" })));
    expect(await (await mineGET(new Request(`${SITE}/x`, { headers: { cookie: ACCT } }))).json()).toEqual({ ok: false, error: "signin" });
    vi.stubGlobal("fetch", rpc(() => json({ code: "PGRST202", message: "Could not find the function public.testimonial_mine" }, 404)));
    expect(await (await mineGET(new Request(`${SITE}/x`, { headers: { cookie: ACCT } }))).json()).toEqual({ ok: false, error: "absent" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await (await mineGET(new Request(`${SITE}/x`, { headers: { cookie: ACCT } }))).json()).toEqual({ ok: false, error: "generic" });
  });
  it("send: this site's pages only, signed in, a send it can read; the database's answer and codes as they are", async () => {
    const f = rpc(() => json({ ok: true, id: 12, status: "pending", body: "Cleaned words for the test.", display_name: "Sara A." }));
    vi.stubGlobal("fetch", f);
    const body = { body: "Cleaned words for the test.", stars: 5, about: "saturday", nameMode: "short", consent: true, source: "web", lang: "en" };
    expect((await sendPOST(post("/api/testimonials/send", body, { origin: "https://evil.example" }))).status).toBe(403);
    expect(await (await sendPOST(post("/api/testimonials/send", body, { cookie: "" }))).json()).toEqual({ ok: false, error: "signin" });
    expect(await (await sendPOST(post("/api/testimonials/send", { ...body, source: "app" }))).json()).toEqual({ ok: false, error: "invalid" });
    expect(f).not.toHaveBeenCalled();
    const ok = await sendPOST(post("/api/testimonials/send", body));
    expect(await ok.json()).toEqual({ ok: true, id: 12, status: "pending", body: "Cleaned words for the test.", display_name: "Sara A." });
    expect(String(f.mock.calls[0][0])).toContain("/rpc/testimonial_send");
    expect(JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))).toEqual({
      p_id: "cust1", p_token: "tok_0123456789abcdef", p_body: body.body, p_stars: 5, p_about: "saturday", p_name_mode: "short", p_consent: true,
      p_photo: null, p_source: "web", p_entry: null, p_lang: "en",
    });
    for (const code of ["consent", "body", "link", "stars", "about", "name", "photo", "entry", "dup", "limit", "throttled"]) {
      vi.stubGlobal("fetch", rpc(() => json({ ok: false, error: code })));
      const r = await sendPOST(post("/api/testimonials/send", body));
      expect(r.status, code).toBe(409);
      expect(await r.json()).toEqual({ ok: false, error: code });
    }
    vi.stubGlobal("fetch", rpc(() => json({ ok: false, error: "signin" })));
    expect((await sendPOST(post("/api/testimonials/send", body))).status).toBe(401);
  });
  it("send: a body past the photo's size is refused unread", async () => {
    const f = rpc(() => json({ ok: true }));
    vi.stubGlobal("fetch", f);
    const big = { body: "words words words words", stars: 5, about: "other", nameMode: "anon", consent: true, source: "web", photo: `data:image/jpeg;base64,${"A".repeat(700_000)}` };
    const r = await sendPOST(post("/api/testimonials/send", big));
    expect(r.status).toBe(413);
    expect(f).not.toHaveBeenCalled();
  });
  it("delete: by id, gone when not theirs", async () => {
    const f = rpc((fn, b) => json(b.p_tid === 4 ? { ok: true } : { ok: false, error: "gone" }));
    vi.stubGlobal("fetch", f);
    expect(await (await deletePOST(post("/api/testimonials/delete", { id: 4 }))).json()).toEqual({ ok: true });
    expect(await (await deletePOST(post("/api/testimonials/delete", { id: 5 }))).json()).toEqual({ ok: false, error: "gone" });
    expect(await (await deletePOST(post("/api/testimonials/delete", { id: "4" }))).json()).toEqual({ ok: false, error: "invalid" });
    expect(String(f.mock.calls[0][0])).toContain("/rpc/testimonial_delete");
    expect(JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))).toEqual({ p_id: "cust1", p_token: "tok_0123456789abcdef", p_tid: 4 });
  });
  it("photo: the picture itself with its type and the media's cache; 404 when null or not a number; 504 when the database is down", async () => {
    const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const f = rpc((fn, b) => json(b.p_tid === 7 ? `data:image/png;base64,${PNG}` : null));
    vi.stubGlobal("fetch", f);
    const get = (id: string) => photoGET(new Request(`${SITE}/api/testimonials/photo/${id}`), { params: Promise.resolve({ id }) });
    const ok = await get("7");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("cache-control")).toBe("public, max-age=3600, stale-while-revalidate=3600");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await ok.arrayBuffer()).slice(1, 4)).toEqual(new Uint8Array([0x50, 0x4e, 0x47]));
    expect(JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))).toEqual({ p_tid: 7 });
    expect((await get("8")).status).toBe(404);
    const calls = f.mock.calls.length;
    for (const bad of ["x", "0", "-1", "1e3", "12345678901234567"]) expect((await get(bad)).status, bad).toBe(404);
    expect(f.mock.calls.length).toBe(calls);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const down = await get("7");
    expect(down.status).toBe(504);
    expect(down.headers.get("cache-control")).toBe("no-store");
  });
  it("the public reads: the page's filter and offset, the featured ones; a database without the function is none published", async () => {
    const f = rpc((fn, b) => json(b.p_featured ? { ...PUBLIC, items: PUBLIC.items.slice(0, 1) } : PUBLIC));
    vi.stubGlobal("fetch", f);
    const l = await readTestimonials("saturday", 60);
    expect(l.items.length).toBe(3);
    expect(JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))).toEqual({ p_about: "saturday", p_featured: false, p_limit: 60, p_offset: 60 });
    await readTestimonials("saturday", 60); // kept a minute
    expect(f).toHaveBeenCalledTimes(1);
    expect((await readFeatured()).map((x) => x.id)).toEqual([7]);
    expect(JSON.parse(String((f.mock.calls[1][1] as RequestInit).body))).toEqual({ p_featured: true });
    resetMemo("tm:");
    vi.stubGlobal("fetch", rpc(() => json({ code: "PGRST202", message: "Could not find the function" }, 404)));
    expect(await readTestimonials(null, 0)).toEqual(TM_EMPTY);
    expect(await readFeatured()).toEqual([]);
  });
});

describe("the addresses", () => {
  beforeEach(() => resetSiteContent());
  afterEach(() => resetSiteContent());
  it("open by their link whatever the site's state (here Coming Soon: no database)", async () => {
    for (const p of ["/testimonials", "/testimonials/", "/testimonials/write", "/testimonials?about=saturday&page=2"]) {
      const res = await proxy(new NextRequest(SITE + p));
      expect(res.status, p).toBe(200);
      expect(new URL(res.headers.get("x-middleware-rewrite") || "").pathname, p).toBe(`/en${p.replace(/\?.*$/, "").replace(/\/$/, "")}`);
    }
    const other = await proxy(new NextRequest(`${SITE}/testimonials/other`));
    expect(other.status).toBe(307);
  });
  it("a new account made from the write page lands back on it", () => {
    expect(askBack("/testimonials/write")).toBe("/testimonials/write");
    expect(askBack(encodeURIComponent("/testimonials/write"))).toBe("/testimonials/write");
    expect(askBack("/testimonials")).toBeNull();
    expect(askBack("/testimonials/write/x")).toBeNull();
  });
});

describe("the words", () => {
  it("every language reads the form's words, with no emoji", () => {
    for (const l of ["en", "ar", "de", "ja", "ur"]) {
      const w = localize(T, l, dictOf(l));
      expect(w.consent).toContain("MicroMobility");
      expect(w.sinceMany(2025, 7)).toContain("2025");
      expect(w.sinceMany(2025, 7)).toContain("7");
      expect(JSON.stringify(w)).not.toMatch(/[☀-➿\u{1F300}-\u{1FAFF}]/u);
    }
  });
});
