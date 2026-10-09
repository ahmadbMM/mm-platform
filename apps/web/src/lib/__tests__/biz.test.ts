import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC, type ReactElement, type ReactNode } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { APP_FARES, BIZ_DEFAULTS, bizOf, bizWords, faresOf, loadFares, priceRows, resetFares } from "../biz";
import { priceForType, ridePrice, type BikeRow } from "../bikes";
import { resolvePage } from "../content";
import { cleanRating, ratingErrors } from "../rating";
import { resetSiteContent } from "../site";
import { siteSchema } from "../../content/pages/site";
import { experiencesSchema } from "../../content/pages/experiences";
import { fill } from "../fill";
import { POST as rate } from "../../app/api/account/rate/route";
import RatingForm from "../../components/account/RatingForm";
import { RATING_WORDS } from "../../components/account/RatingForm.words";
import { TxProvider } from "../../i18n/TxProvider";

// The business values admins change in the booking app (Settings > Business and > Pricing,
// 2026-10-09) reach the site from the same public places the booking app's rider pages read:
// site_content 'biz.public' and ride_prices. Nothing moves until an admin changes something.

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;
const Tx = TxProvider as FC<{ locale: string; dict: Record<string, string> | null; children?: ReactNode }>;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
// ride_prices on production as of 2026-10-09
const PROD_ROWS = [
  { type: "Road", price: 75, max_price: null, employee_price: null },
  { type: "Road Carbon", price: 250, max_price: null, employee_price: null },
  { type: "Mountain", price: 57.5, max_price: null, employee_price: 50 },
  { type: "Hybrid", price: 57.5, max_price: null, employee_price: 50 },
  { type: "Kids", price: 57.5, max_price: null, employee_price: 50 },
  { type: "Any", price: 57.5, max_price: 75, employee_price: 50 },
];

describe("bizOf: the public business settings", () => {
  it("is the booking app's built-in values with nothing set", () => {
    for (const c of [null, undefined, {}, { "biz.public": null }, { "biz.public": [1, 2] }, { "biz.public": "x" }]) {
      const b = bizOf(c as never);
      expect(b).toMatchObject({ ...BIZ_DEFAULTS, cancelOff: [], cancelCustom: [], addr: null, hours: null, vatNo: null });
    }
    expect(BIZ_DEFAULTS).toEqual({ groupRideMax: 2, eventSeatMax: 5, jccAccountCap: 3, rgLow: 8, defaultPrice: 57.5 });
  });
  it("takes each value the admins set when it is in the booking app's range, else the default", () => {
    const b = bizOf({ "biz.public": { group_ride_max: 4, event_seat_max: 8, jcc_account_cap: 2, rg_low: 6, default_price: 60 } });
    expect(b).toMatchObject({ groupRideMax: 4, eventSeatMax: 8, jccAccountCap: 2, rgLow: 6, defaultPrice: 60 });
    const bad = bizOf({ "biz.public": { group_ride_max: 21, event_seat_max: 0, jcc_account_cap: "4", rg_low: 10, default_price: -1 } });
    expect(bad).toMatchObject(BIZ_DEFAULTS);
  });
  it("reads the cancel reasons, the footer words and the VAT number as the booking app does", () => {
    const b = bizOf({ "biz.public": {
      cancel_off: ["sick", "other", 3], cancel_custom: [{ code: "c_rain", label: " Rain " }, { code: "bad code", label: "x" }, { code: "c_x", label: "  " }],
      addr: { en: "New St, Jeddah", ar: "شارع جديد، جدة", xx1: "no" }, hours: { en: "  " }, vat_no: "300000000000003",
    } });
    expect(b.cancelOff).toEqual(["sick"]);
    expect(b.cancelCustom).toEqual([["c_rain", "Rain"]]);
    expect(b.addr).toEqual({ en: "New St, Jeddah", ar: "شارع جديد، جدة" });
    expect(b.hours).toBeNull();
    expect(b.vatNo).toBe("300000000000003");
    expect(bizOf({ "biz.public": { vat_no: "12345" } }).vatNo).toBeNull();
  });
  it("picks a Settings text per language: its own, else English, never English on the Arabic page", () => {
    expect(bizWords({ en: "E", ar: "A" }, "ar")).toBe("A");
    expect(bizWords({ en: "E" }, "ar")).toBeNull();
    expect(bizWords({ en: "E" }, "de")).toBe("E");
    expect(bizWords({ en: "E", de: "D" }, "de")).toBe("D");
    expect(bizWords(null, "en")).toBeNull();
  });
});

describe("faresOf: the fares as the booking app works them out", () => {
  it("is the booking app's built-in fares with no rows, and the same for production's rows today", () => {
    expect(faresOf(null)).toEqual(APP_FARES);
    expect(faresOf([])).toEqual(APP_FARES);
    expect(faresOf(PROD_ROWS)).toEqual(APP_FARES);
  });
  it("follows a fare an admin changes, its highest fare and the employees' fare", () => {
    const f = faresOf([{ type: "Road", price: 80, max_price: 95 }, { type: "Hybrid", price: 60, employee_price: null }, { type: "Kids", price: 40, employee_price: 45 }, { type: "Own", price: 9 }]);
    expect(f.price).toMatchObject({ Road: 80, Hybrid: 60, Kids: 40, Own: 0 });
    expect(f.max).toMatchObject({ Road: 95, Hybrid: 60, Kids: 40, Any: 80 }); // Any: the dearest everyday type
    expect(f.employee).toEqual({ Mountain: 50, Kids: 45, Any: 50 }); // Hybrid's null: the standard fare
    // a max under the fare is the fare
    expect(faresOf([{ type: "Road", price: 80, max_price: 70 }]).max.Road).toBe(80);
  });
  it("keeps only rows with a type and a fare", () => {
    expect(priceRows([{ type: "Road", price: 75 }, { type: "Bad", price: "free" }, { price: 3 }, null, { type: "Kids", price: 50, max_price: "x", employee_price: 45 }]))
      .toEqual([{ type: "Road", price: 75 }, { type: "Kids", price: 50, max_price: null, employee_price: 45 }]);
    expect(priceRows({})).toBeNull();
  });
});

describe("loadFares", () => {
  beforeEach(() => { resetFares(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { resetFares(); vi.unstubAllEnvs(); });
  it("reads every column of ride_prices with the public key, kept for a minute", async () => {
    const f = vi.fn(async () => json([{ type: "Road", price: 90 }]));
    const a = await loadFares(f as unknown as typeof fetch, 1_000);
    expect(a.price.Road).toBe(90);
    expect(String((f.mock.calls[0] as unknown[])[0])).toBe("https://example.supabase.co/rest/v1/ride_prices?select=*");
    await loadFares(f as unknown as typeof fetch, 30_000);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("answers the booking app's built-in fares when nothing could be read", async () => {
    const f = vi.fn(async () => json({ message: "down" }, 503));
    expect(await loadFares(f as unknown as typeof fetch, 1_000)).toEqual(APP_FARES);
  });
});

describe("the bike pages quote the live fare", () => {
  const bike = (o: Partial<BikeRow>) => ({ type: "Road", rental_price: null, ...o }) as unknown as BikeRow;
  it("by type, with the built-in fares when none were read", () => {
    const f = faresOf([{ type: "Road", price: 85 }, { type: "Kids", price: 45 }]);
    expect(priceForType("Road", f)).toBe(85);
    expect(priceForType("Road")).toBe(75);
    expect(ridePrice(bike({ type: "Road", rental_price: 95 }), f)).toBe(85);
    expect(ridePrice(bike({ type: "Kids" }), f)).toBe(45);
    expect(ridePrice(bike({ type: "Own" }), f)).toBeNull();
  });
});

describe("the footer's address, hours and VAT number", () => {
  const biz = { addr: { en: "New St, Jeddah", ar: "شارع جديد" }, hours: { en: "Daily 9-5", ar: "يوميًا" }, vat_no: "300000000000003" };
  it("are Settings > Business's when set, in every page's site settings", () => {
    const en = resolvePage(siteSchema, { "biz.public": biz }, "en");
    expect([en.contact.address, en.contact.hoursText, en.legal.vat]).toEqual(["New St, Jeddah", "Daily 9-5", "300000000000003"]);
    const ar = resolvePage(siteSchema, { "biz.public": biz }, "ar");
    expect([ar.contact.address, ar.contact.hoursText]).toEqual(["شارع جديد", "يوميًا"]);
    expect(resolvePage(siteSchema, { "biz.public": biz }, "de").contact.address).toBe("New St, Jeddah");
  });
  it("leave a value typed into the website's own editor, and the built-in words with neither", () => {
    const own = resolvePage(siteSchema, { "biz.public": biz, "site.contact.address": { en: "Typed on the site", ar: "مكتوب" } }, "en");
    expect(own.contact.address).toBe("Typed on the site");
    expect(own.contact.hoursText).toBe("Daily 9-5");
    const none = resolvePage(siteSchema, {}, "en");
    expect(none.contact.address).toBe("Thu Al-Nurayn St, Al Sharafeyah, Jeddah 23218");
    expect(none.legal.vat).toBe("312555068900003");
    // a bad VAT number in Settings keeps the site's
    expect(resolvePage(siteSchema, { "biz.public": { vat_no: "1" } }, "en").legal.vat).toBe("312555068900003");
  });
});

describe("the rating's 'tell us why' follows rg_low", () => {
  it("asks for a reason at or under the setting", () => {
    expect(ratingErrors(["service"], { service: 7 }, {}, 6)).toEqual({});
    expect(ratingErrors(["service"], { service: 6 }, {}, 6)).toEqual({ service: "why" });
    expect(ratingErrors(["service"], { service: 8 }, {})).toEqual({ service: "why" }); // the default, 8
    const body = { entryId: "q1abcdef", form: "rental", s: { service: 7, experience: 9 } };
    expect(cleanRating(body)).toBeNull();
    expect(cleanRating(body, 6)).not.toBeNull();
  });
  it("is the server's check too: /api/account/rate reads rg_low from the site's content", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    resetSiteContent();
    const f = vi.fn(async (url: string) => (url.includes("site_content") ? json([{ key: "biz.public", value: { rg_low: 6 } }]) : json(true)));
    vi.stubGlobal("fetch", f);
    const res = await rate(new Request("https://micromobility.sa/api/account/rate", {
      method: "POST", headers: { origin: "https://micromobility.sa", cookie: "mm_acct=c1~a1b2c3d4e5f6a7b8c9d0", "content-type": "application/json" },
      body: JSON.stringify({ entryId: "q1abcdef", form: "rental", s: { service: 7, bike: 9, experience: 9 } }),
    }));
    expect(res.status).toBe(200);
    expect(f.mock.calls.some((c) => String(c[0]).includes("/rpc/customer_booking_update"))).toBe(true);
    resetSiteContent(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });
  it("says the setting in the form's line, in every language", () => {
    for (const [code, w] of Object.entries(RATING_WORDS)) expect(w.sub.match(/\{0\}/g), code).toHaveLength(1);
    const html = renderToStaticMarkup(createElement(Tx, { locale: "en", dict: null }, createElement(RatingForm, { entryId: "q1", form: "rental", noBike: false, rgLow: 6, onRated: () => {} })));
    expect(html).toContain("For anything 6 or under, tell us why");
  });
});

describe("the Experiences cards' rules say the caps the database enforces", () => {
  it("through {riders} and {seats}, in English and Arabic (the other languages keep them: i18n test)", () => {
    const L = (l: "en" | "ar") => resolvePage(experiencesSchema, {}, l).events as Record<string, string>;
    for (const l of ["en", "ar"] as const) {
      expect(L(l).jccNote).toContain("{riders}");
      expect(L(l).evNote).toContain("{seats}");
    }
    const b = bizOf({ "biz.public": { jcc_account_cap: 4, event_seat_max: 6 } });
    expect(fill(L("en").jccNote, { riders: b.jccAccountCap, seats: b.eventSeatMax })).toMatch(/^Up to 4 riders per account/);
    expect(fill(L("en").evNote, { riders: b.jccAccountCap, seats: b.eventSeatMax })).toContain("Up to 6 seats per booking");
    // the About texts are the booking app's too, which fills only a date's times: no cap placeholder there
    expect(L("en").jccAbout).not.toMatch(/\{riders\}/);
    expect(L("en").evAbout).not.toMatch(/\{seats\}/);
  });
});
