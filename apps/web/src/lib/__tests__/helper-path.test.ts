import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as ride-record.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { HP_LADDER, HP_STEPS, helperPathOf } from "../helper-path";
import { resetRides } from "../rides";
import { resetSiteContent } from "../site";
import { LOCALES } from "@/i18n/locales";
import { HELPER_WORDS, helperWords } from "@/components/account/HelperPath.words";
import HelperPath, { helperLine } from "@/components/account/HelperPath";
import RideRecord from "@/components/account/RideRecord";
import { T as RECORD } from "@/components/account/RideRecord.text";
import AccountPage from "../../app/[locale]/account/[[...part]]/page";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

// cookies() is a request's; here it holds the account's cookie a test sets, or none (as blood.test.ts).
const jar = vi.hoisted(() => ({ account: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_acct" && jar.account ? { name: n, value: jar.account } : undefined) }) }));

// The Helper path on My Account, as the booking app's (new features build F23, 2026-11-13; helper-path.js, _hpMineLoad;
// rentals 20261114082300 customer_helper_path): a community member's own step (rider, helper, trainee ride leader, ride
// leader), their helper days and the helper-day ladder, as a card on Badges and a line on Stats. A rider who is not a
// member, a refused token, a database without the function or a failed read: nothing.

describe("what the card shows (helperPathOf, the booking app's _hpOwn)", () => {
  it("is a member's own step and whole helper days", () => {
    expect(helperPathOf({ ok: true, member: true, step: 2, days: 7 })).toEqual({ step: 2, days: 7 });
    expect(helperPathOf({ ok: true, member: true, step: 0, days: 0 })).toEqual({ step: 0, days: 0 });
    expect(helperPathOf({ ok: true, member: true })).toEqual({ step: 0, days: 0 }); // a member holding no path title is a rider
    expect(helperPathOf({ ok: true, member: true, step: 9, days: 3.7 })).toEqual({ step: 3, days: 3 });
    expect(helperPathOf({ ok: true, member: true, step: -1, days: -2 })).toEqual({ step: 0, days: 0 });
    expect(helperPathOf({ ok: true, member: true, step: "1", days: "12" })).toEqual({ step: 1, days: 12 });
    expect(helperPathOf({ ok: true, member: true, step: "x", days: null })).toEqual({ step: 0, days: 0 });
  });
  it("is nothing for a rider who is not a member, a refused token or no answer", () => {
    for (const v of [{ ok: true, member: false }, { ok: false, error: "denied" }, { ok: "true", member: true }, { ok: true, member: "true" }, null, undefined, "x", [], [{ ok: true, member: true }]]) {
      expect(helperPathOf(v), JSON.stringify(v)).toBeNull();
    }
  });
  it("climbs rider, helper, trainee ride leader, ride leader; the ladder at 1, 5, 10 and 25 days", () => {
    expect(HP_STEPS).toEqual(["s0", "s1", "s2", "s3"]);
    expect(HP_LADDER).toEqual([[1, "b1", "green"], [5, "b5", "teal"], [10, "b10", "purple"], [25, "b25", "gold"]]);
  });
});

describe("the Helper path's words", () => {
  it("are there in every language the site speaks, and the booking app's own in the ten it shares", () => {
    expect(Object.keys(HELPER_WORDS).sort()).toEqual(LOCALES.map((l) => l.code).sort());
    for (const { code } of LOCALES) {
      for (const [k, v] of Object.entries(HELPER_WORDS[code])) expect(v.trim(), `${code}.${k}`).not.toBe("");
      expect(HELPER_WORDS[code].next, code).toContain("{0}");
      expect(HELPER_WORDS[code].line, code).toContain("{0}");
    }
    expect(helperWords("en")).toEqual({ title: "Helper path", s0: "Rider", s1: "Helper", s2: "Trainee ride leader", s3: "Ride leader", next: "Next step: {0}", days: "Helper days", line: "Helper days: {0}", b1: "1 helper day", b5: "5 helper days", b10: "10 helper days", b25: "25 helper days" });
    expect(helperWords("ar")).toMatchObject({ title: "مسار المساعد", s0: "راكب", s1: "مساعد", s2: "قائد جولة متدرّب", s3: "قائد الجولة", b1: "يوم مساعدة واحد" });
    expect(helperWords("fr").s2).toBe("Chef de sortie en formation");
    expect(helperWords("bn").b25).toBe("সহায়তার 25 দিন");
    expect(helperWords("tl").s3).toBe("Ride leader");
    expect(helperWords("xx")).toBe(HELPER_WORDS.en);
  });
  it("hold no emoji and write digits in Latin", () => {
    const all = JSON.stringify(HELPER_WORDS);
    expect(/\p{Extended_Pictographic}/u.test(all)).toBe(false);
    expect(all).not.toMatch(/[०-९০-৯٠-٩۰-۹]/);
  });
});

describe("the card on Badges", () => {
  it("ticks the steps passed, marks the member's own, names the next and draws the helper-day ladder", () => {
    const html = renderToStaticMarkup(createElement(HelperPath, { locale: "en", path: { step: 1, days: 7 } }));
    expect(html).toContain('<p class="myr-h">Helper path</p>');
    const steps = [...html.matchAll(/<li class="hp-step([^"]*)"( aria-current="step")?><i aria-hidden="true">(<svg[^]*?<\/svg>)?<\/i><span>([^<]+)<\/span><\/li>/g)].map((m) => [m[1].trim(), !!m[2], !!m[3], m[4]]);
    expect(steps).toEqual([["done", false, true, "Rider"], ["on", true, false, "Helper"], ["", false, false, "Trainee ride leader"], ["", false, false, "Ride leader"]]);
    expect(html).toContain('<p class="hp-next">Next step: Trainee ride leader</p>');
    expect(html).toContain('<p class="hp-days"><span class="hp-days-n">7</span><span class="hp-days-w">Helper days</span></p>');
    const tiles = [...html.matchAll(/<li class="mr-badge( locked)?">(?:<span class="mr-badge-p"><bdi>([^<]+)<\/bdi><\/span>)?<svg class="bdg-m bdc-(\w+)[^]*?<span class="mr-badge-nm">([^<]+)<\/span><\/li>/g)].map((m) => [!!m[1], m[2] ?? "", m[3], m[4]]);
    expect(tiles).toEqual([[false, "", "green", "1 helper day"], [false, "", "teal", "5 helper days"], [true, "7/10", "purple", "10 helper days"], [true, "7/25", "gold", "25 helper days"]]);
  });
  it("names no next step at the top, and every tile is earned at 25 days", () => {
    const html = renderToStaticMarkup(createElement(HelperPath, { locale: "en", path: { step: 3, days: 30 } }));
    expect(html).not.toContain("hp-next");
    expect(html).toContain('aria-current="step"><i aria-hidden="true"></i><span>Ride leader</span>');
    expect(html.match(/class="hp-step done"/g)).toHaveLength(3);
    expect(html).not.toContain("locked");
  });
  it("starts a new member as a rider, with the whole ladder still to earn", () => {
    const html = renderToStaticMarkup(createElement(HelperPath, { locale: "ar", path: { step: 0, days: 0 } }));
    expect(html).toContain('<li class="hp-step on" aria-current="step"><i aria-hidden="true"></i><span>راكب</span></li>');
    expect(html).toContain(">الخطوة التالية: مساعد</p>");
    expect(html.match(/mr-badge locked/g)).toHaveLength(4);
    expect(html).toContain("<bdi>0/1</bdi>");
  });
});

describe("the helper days line on Stats", () => {
  const props = { locale: "en", badges: [], t: RECORD.en, typeName: (x: string) => x, dur: { h: "{h} h", hm: "{h} h {m} min", m: "{m} min" }, part: "stats" as const };
  it("is said once there are helper days, in the reader's language", () => {
    expect(helperLine("en", null)).toBeNull();
    expect(helperLine("en", { step: 2, days: 0 })).toBeNull();
    expect(helperLine("en", { step: 0, days: 3 })).toBe("Helper days: 3");
    expect(helperLine("fr", { step: 0, days: 3 })).toBe("Jours d’aide : 3");
    expect(helperLine("ar", { step: 0, days: 12 })).toBe("أيام المساعدة: 12");
  });
  it("sits under Rides led in Your rides, its people glyph beside it", () => {
    const html = renderToStaticMarkup(createElement(RideRecord, { ...props, stats: null, led: 2, helper: "Helper days: 3" }));
    expect(html.indexOf("Rides led: 2")).toBeGreaterThan(0);
    expect(html.indexOf("<span>Helper days: 3</span>")).toBeGreaterThan(html.indexOf("Rides led: 2"));
    expect(html).toContain('<circle cx="9" cy="8.6" r="3.1"></circle>');
    // helper days and no ride yet: Your rides says them; neither: nothing, as before
    expect(renderToStaticMarkup(createElement(RideRecord, { ...props, stats: null, led: 0, helper: "Helper days: 3" }))).toContain("<span>Helper days: 3</span>");
    expect(renderToStaticMarkup(createElement(RideRecord, { ...props, stats: null, led: 0, helper: null }))).toBe("");
    expect(renderToStaticMarkup(createElement(RideRecord, { ...props, stats: null, led: 2 }))).not.toContain("Helper days");
  });
});

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const absent = () => json({ code: "PGRST202", message: "Could not find the function" }, 404);
/** Every element of `type` in a tree a page returned, its own children unrendered. */
function findAll(n: unknown, type: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(n)) { for (const x of n) findAll(x, type, out); return out; }
  if (!isValidElement(n)) return out;
  if (n.type === type) out.push(n);
  findAll((n.props as { children?: unknown }).children, type, out);
  return out;
}

beforeEach(() => {
  jar.account = "";
  resetRides(); resetSiteContent();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("My Account reads the Helper path for the member alone", () => {
  const rows = [{ id: "a", session_id: "2026-10-04", session_date: "2026-10-04", session_day: "Sunday", name: "Spec Rider", status: "done", paid: true, price: 75, type_preference: "Road", queue_num: 1 }];
  const account = async (part: string, helper: () => Response) => {
    jar.account = "c1~a1b2c3d4e5f6a7b8c9d0";
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/rpc/customer_profile")) return json([{ name: "Spec Rider", email: "rider@example.test", phone: "+966500000000" }]);
      if (url.includes("/rpc/my_bookings")) return json(rows);
      if (url.includes("/rpc/list_sessions")) return json([{ id: "2026-10-04", session_date: "2026-10-04", status: "closed", event_kind: null, ride_kind: null }]);
      if (url.includes("/rpc/customer_helper_path")) { expect(JSON.parse(String(init?.body))).toEqual({ p_id: "c1", p_token: "a1b2c3d4e5f6a7b8c9d0" }); return helper(); }
      return json([]);
    });
    vi.stubGlobal("fetch", f);
    const page = await AccountPage({ params: Promise.resolve({ locale: "en", part: part === "account" ? undefined : [part] }), searchParams: Promise.resolve({}) });
    return { page, asked: f.mock.calls.some((c) => String(c[0]).includes("/rpc/customer_helper_path")) };
  };
  const member = () => json({ ok: true, member: true, step: 1, days: 4 });
  it("puts the card on Badges, after the badges", async () => {
    const { page, asked } = await account("badges", member);
    expect(asked).toBe(true);
    const cards = findAll(page, HelperPath);
    expect(cards).toHaveLength(1);
    expect((cards[0].props as { path: unknown }).path).toEqual({ step: 1, days: 4 });
    const section = findAll(page, "section").find((s) => (s.props as { "aria-label"?: string })["aria-label"] === "Badges") as ReactElement<{ children: unknown[] }>;
    const kids = (section.props.children as unknown[]).filter(Boolean) as ReactElement[];
    expect(kids.map((k) => k.type)).toEqual([RideRecord, HelperPath]);
  });
  it("says the helper days under Rides led on Stats", async () => {
    const { page } = await account("stats", member);
    expect((findAll(page, RideRecord)[0].props as { helper: string | null }).helper).toBe("Helper days: 4");
    expect(findAll(page, HelperPath)).toHaveLength(0);
  });
  it("draws nothing for a rider who is not a member, a refused token, a database without the function or a failed read", async () => {
    for (const r of [() => json({ ok: true, member: false }), () => json({ ok: false, error: "denied" }), absent, () => json({ message: "down" }, 503)]) {
      expect(findAll((await account("badges", r)).page, HelperPath)).toHaveLength(0);
      expect((findAll((await account("stats", r)).page, RideRecord)[0].props as { helper: string | null }).helper).toBeNull();
    }
  });
  it("is not asked on Account", async () => {
    expect((await account("account", member)).asked).toBe(false);
  });
});
