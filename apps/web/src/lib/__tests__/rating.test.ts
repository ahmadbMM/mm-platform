import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingOrigin, cleanRating, formOf, isRated, pendingRating, questionKeys, ratingErrors, unratedRides } from "../rating";
import { POST as rate } from "../../app/api/account/rate/route";
import { POST as wallet } from "../../app/api/google-wallet/route";
import { resetSiteContent } from "../site";
import { createElement, type FC, type ReactElement, type ReactNode } from "react";
// The site has no @types/react-dom; this test needs one function of it.
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import RatingForm from "../../components/account/RatingForm";
import { TxProvider } from "../../i18n/TxProvider";
import de from "../../i18n/tx/de.json";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const Tx = TxProvider as FC<{ locale: string; dict: Record<string, string> | null; children?: ReactNode }>;

// The post-ride rating and the Google Wallet pass, as the account page offers them: what the
// browser sends is checked as the database checks rating_detail, the account cookie supplies the
// id and token, and the ride to rate is the one the booking app would force.
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const post = (fn: (r: Request) => Promise<Response>, path: string, body: unknown, headers: Record<string, string> = HEADERS) =>
  fn(new Request(`https://micromobility.sa${path}`, { method: "POST", headers, body: JSON.stringify(body) }));
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

const SOCIAL = { ride: 9, ride_checkin: 10, ride_staff: 9, ride_bike: 7, ride_route: 10, breakfast: 6, bf_restaurant: 9, bf_atmosphere: 9, bf_food: 5, bf_service: 9, overall: 9 };

describe("the questions", () => {
  it("asks by the kind of ride, without the bike or the breakfast when they do not apply", () => {
    expect(formOf("saturday")).toBe("social");
    for (const k of ["jcc", "petromin", "swim", "workshop", "event", "snd96", null, undefined]) expect(formOf(k)).toBe("rental");
    expect(questionKeys("rental")).toEqual(["service", "bike", "experience"]);
    expect(questionKeys("rental", { noBike: true })).toEqual(["service", "experience"]);
    expect(questionKeys("social")).toEqual(Object.keys(SOCIAL));
    expect(questionKeys("social", { noBike: true, skipBf: true })).toEqual(["ride", "ride_checkin", "ride_staff", "ride_route", "overall"]);
  });
  it("wants every score, and a reason for 8 or under", () => {
    expect(ratingErrors(["service", "experience"], { service: 9 }, {})).toEqual({ experience: "pick" });
    expect(ratingErrors(["service", "experience"], { service: 8, experience: 10 }, { service: "  " })).toEqual({ service: "why" });
    expect(ratingErrors(["service", "experience"], { service: 8, experience: 10 }, { service: "Slow desk" })).toEqual({});
  });
});

describe("cleanRating", () => {
  it("keeps a rental rating as the booking app writes one", () => {
    expect(cleanRating({ entryId: "q1abcdef", form: "rental", s: { service: 9, bike: 7, experience: 10, extra: 3 }, why: { bike: " Brakes squeaked \u0007 ", service: "ignored: a 9 has no reason" }, note: " Great night " })).toEqual({
      entryId: "q1abcdef",
      patch: { rating_bike: 7, rating_exp: 10, feedback: "Great night", rating_detail: { form: "rental", s: { service: 9, bike: 7, experience: 10 }, why: { bike: "Brakes squeaked" } } },
    });
    // on their own bike, or a pool session: no bike question
    expect(cleanRating({ entryId: "q1", form: "rental", s: { service: 10, experience: 10 }, why: {} })!.patch).toEqual({ rating_bike: null, rating_exp: 10, feedback: null, rating_detail: { form: "rental", s: { service: 10, experience: 10 }, why: {} } });
  });
  it("keeps a social ride's rating, the breakfast skipped or not", () => {
    const why = { ride_bike: "Seat too low", breakfast: "Crowded", bf_food: "Cold" };
    expect(cleanRating({ entryId: "q2", form: "social", s: SOCIAL, why })!.patch).toEqual({ rating_bike: 7, rating_exp: 9, feedback: null, rating_detail: { form: "social", s: SOCIAL, why } });
    const skipped = cleanRating({ entryId: "q2", form: "social", s: { ...SOCIAL, breakfast: 2 }, why: { ride_bike: "Seat" }, skipBf: true })!.patch.rating_detail!;
    expect(skipped.skip_bf).toBe(true);
    expect(Object.keys(skipped.s)).toEqual(["ride", "ride_checkin", "ride_staff", "ride_bike", "ride_route", "overall"]);
  });
  it("refuses a rating that is not whole", () => {
    const ok = { entryId: "q1", form: "rental", s: { service: 9, experience: 9 }, why: {} };
    expect(cleanRating(ok)).not.toBeNull();
    for (const bad of [
      null, {}, { ...ok, entryId: "q;1" }, { ...ok, form: "party" },
      { ...ok, s: { service: 9 } }, // no experience
      { ...ok, s: { service: 11, experience: 9 } }, { ...ok, s: { service: 2.5, experience: 9 } }, { ...ok, s: { service: "9", experience: 9 } },
      { ...ok, s: { service: 8, experience: 9 } }, // 8 or under with no reason
      { ...ok, s: { service: 8, experience: 9 }, why: { service: "   " } },
      { entryId: "q2", form: "social", s: { ...SOCIAL, breakfast: undefined }, why: { ride_bike: "a", bf_food: "b" } }, // breakfast not skipped, not scored
    ]) expect(cleanRating(bad)).toBeNull();
    const long = cleanRating({ ...ok, s: { service: 3, experience: 9 }, why: { service: "x".repeat(400) }, note: "y".repeat(1200) })!.patch;
    expect(long.rating_detail!.why.service).toHaveLength(300);
    expect(long.feedback).toHaveLength(1000);
  });
  it("still takes a rating from a page drawn before the detailed one", () => {
    expect(cleanRating({ entryId: "q1abcdef", exp: 9, bike: 7, tags: ["route"], note: "Thanks" })).toEqual({ entryId: "q1abcdef", patch: { rating_exp: 9, rating_bike: 7, feedback: "Thanks" } });
    expect(cleanRating({ entryId: "q1", exp: 0 })).toBeNull();
  });
});

describe("the ride to rate", () => {
  const row = (id: string, date: string, extra: Record<string, unknown> = {}) => ({ id, session_id: `s-${date}`, session_date: date, status: "done", queue_num: 1, type_preference: "Road", ...extra });
  it("counts a night rated once any of its rows is", () => {
    expect(isRated({ rating_exp: 8 })).toBe(true);
    expect(isRated({ rating_bike: 3, rating_exp: null })).toBe(true);
    expect(isRated({ rating_detail: { form: "rental" } })).toBe(true);
    expect(isRated({ rating_exp: null, rating_bike: null, rating_detail: null })).toBe(false);
  });
  it("forces the oldest unrated ride from the day it went live, one per night, on its first rider", () => {
    const rows = [
      row("old", "2026-09-26"),
      row("p2", "2026-10-04", { queue_num: 5, type_preference: "Own" }), row("p1", "2026-10-04", { queue_num: 4, type_preference: "Own" }),
      row("r1", "2026-10-03", { rating_exp: 9 }), row("r2", "2026-10-03", { queue_num: 2 }),
      row("w", "2026-10-05", { status: "waiting" }),
      row("future", "2026-10-09"),
    ];
    expect(pendingRating(rows, "2026-10-08")).toEqual({ entryId: "p1", sessionId: "s-2026-10-04", date: "2026-10-04", ownBike: true });
    expect(unratedRides(rows, "2026-10-08").map((r) => r.entryId)).toEqual(["old", "p1"]);
    expect(pendingRating([row("old", "2026-09-26")], "2026-10-08")).toBeNull();
    expect(pendingRating([row("a", "2026-10-04"), row("b", "2026-10-04", { type_preference: "Own", queue_num: 2 })], "2026-10-08")!.ownBike).toBe(false);
  });
});

describe("api/account/rate", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("writes the rating through customer_booking_update with the cookie's id and token", async () => {
    const f = vi.fn(async () => json(true));
    vi.stubGlobal("fetch", f);
    const res = await post(rate, "/api/account/rate", { entryId: "q1abcdef", form: "rental", s: { service: 9, bike: 6, experience: 9 }, why: { bike: "Gears slipped" }, note: "Thanks" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/customer_booking_update");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_entry_id: "q1abcdef", p_patch: {
      rating_bike: 6, rating_exp: 9, feedback: "Thanks", rating_detail: { form: "rental", s: { service: 9, bike: 6, experience: 9 }, why: { bike: "Gears slipped" } },
    } });
  });
  it("refuses another site, a missing cookie and a malformed rating without touching the database", async () => {
    const f = vi.fn(async () => json(true));
    vi.stubGlobal("fetch", f);
    const ok = { entryId: "q1", form: "rental", s: { service: 9, experience: 9 } };
    expect((await post(rate, "/api/account/rate", ok, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post(rate, "/api/account/rate", ok, { origin: HEADERS.origin })).status).toBe(401);
    expect((await post(rate, "/api/account/rate", { ...ok, s: { service: 4, experience: 9 } })).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
    vi.stubGlobal("fetch", vi.fn(async () => json(false)));
    expect((await post(rate, "/api/account/rate", ok)).status).toBe(409);
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "token mismatch" }, 400)));
    expect(await (await post(rate, "/api/account/rate", ok)).json()).toEqual({ ok: false, error: "signin" });
  });
});

describe("api/google-wallet", () => {
  beforeEach(() => { resetSiteContent(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("knows the booking app's origin, as staff set it", () => {
    expect(bookingOrigin(null)).toBe("https://micromobilityrentals.pages.dev");
    expect(bookingOrigin({ "site.links.booking": { href: "https://book.micromobility.sa/?x=1" } })).toBe("https://book.micromobility.sa");
    expect(bookingOrigin({ "site.links.booking": { href: "javascript:alert(1)" } })).toBe("https://micromobilityrentals.pages.dev");
  });
  it("asks the booking app for the pass with the cookie's id and token and hands the save link back", async () => {
    const f = vi.fn(async (url: string) => (url.includes("site_content") ? json([{ key: "site.links.booking", value: { href: "https://book.micromobility.sa/" } }]) : json({ ok: true, url: "https://pay.google.com/gp/v/save/eyJ" })));
    vi.stubGlobal("fetch", f);
    const res = await post(wallet, "/api/google-wallet", { bookingId: "q1abcdef", groupIds: ["q1abcdef", "q2abcdef", "bad;id"] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, url: "https://pay.google.com/gp/v/save/eyJ" });
    const call = f.mock.calls.find((c) => String(c[0]).includes("/api/google-wallet")) as unknown as [string, RequestInit];
    expect(call[0]).toBe("https://book.micromobility.sa/api/google-wallet");
    expect(JSON.parse(String(call[1].body))).toEqual({ customerId: "c1", token: TOKEN, bookingId: "q1abcdef", groupIds: ["q1abcdef", "q2abcdef"] });
  });
  it("passes a 501 (not set up) and a 409 (not confirmed) on, and never a link elsewhere", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("site_content") ? json([]) : json({ ok: false, skipped: "google wallet not configured" }, 501))));
    expect((await post(wallet, "/api/google-wallet", { bookingId: "q1abcdef" })).status).toBe(501);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("site_content") ? json([]) : json({ ok: false, error: "not confirmed" }, 409))));
    const nc = await post(wallet, "/api/google-wallet", { bookingId: "q1abcdef" });
    expect(nc.status).toBe(409);
    expect(await nc.json()).toEqual({ ok: false, error: "not confirmed" });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("site_content") ? json([]) : json({ ok: true, url: "https://evil.example/save" }))));
    expect(await (await post(wallet, "/api/google-wallet", { bookingId: "q1abcdef" })).json()).toEqual({ ok: false });
  });
  it("refuses another site, a missing cookie and a bad id", async () => {
    const f = vi.fn(async () => json({}));
    vi.stubGlobal("fetch", f);
    expect((await post(wallet, "/api/google-wallet", { bookingId: "q1" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post(wallet, "/api/google-wallet", { bookingId: "q1" }, { origin: HEADERS.origin })).status).toBe(401);
    expect((await post(wallet, "/api/google-wallet", { bookingId: "q 1" })).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("the breakfast box's sharing line", () => {
  const SHARE = "Your breakfast answers may be shared with the restaurant, without your name.";
  const draw = (form: "social" | "rental", locale = "en", dict: Record<string, string> | null = null) =>
    renderToStaticMarkup(createElement(Tx, { locale, dict }, createElement(RatingForm, { entryId: "q1", form, noBike: false, onRated: () => {} })));

  it("sits under the Breakfast heading of the social ride's form, once", () => {
    const html = draw("social");
    expect(html.split(SHARE)).toHaveLength(2);
    // right after the breakfast question's own label, before its scale and its sub-questions
    expect(html).toMatch(/id="rg-q1-breakfast-l">Breakfast<\/div><p class="rg-share">Your breakfast answers may be shared/);
    expect(html.indexOf(SHARE)).toBeLessThan(html.indexOf("rg-q1-bf_restaurant"));
  });
  it("is not on a rental's form", () => {
    expect(draw("rental")).not.toContain("rg-share");
  });
  it("speaks the page's language", () => {
    expect(draw("social", "ar")).toContain("قد نشارك إجاباتك عن الإفطار مع المطعم، دون ذكر اسمك.");
    expect(draw("social", "de", de)).toContain((de as Record<string, string>)[SHARE]);
    expect((de as Record<string, string>)[SHARE]).toBeTruthy();
  });
});
