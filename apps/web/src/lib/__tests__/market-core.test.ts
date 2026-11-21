import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import MkAmt from "@/components/market/MkAmt";
import MkGate from "@/components/market/MkGate";
import MkIcon from "@/components/market/MkIcon";
import MkPhoto from "@/components/market/MkPhoto";
import SellerTag from "@/components/market/SellerTag";
import { T } from "@/components/market/Market.text";
import { mkErrorText } from "@/components/market/Market.text";
import { T as W1 } from "@/components/market/w1.text";
import { T as W2 } from "@/components/market/w2.text";
import { T as W3 } from "@/components/market/w3.text";
import { T as W4 } from "@/components/market/w4.text";
import { MK_ICONS } from "@/components/market/MkIcon";
import { GET as photoGet } from "../../app/mkt/[...path]/route";
import { GET as meGet } from "../../app/api/market/me/route";
import { POST as purgePost } from "../../app/api/market/purge/route";
import { COMMUNITY, HEADER, NAV_LINKS } from "../links";
import { resetMemo } from "../memo";
import { pageCacheKey } from "../page-cache";
import { hiddenPages, marketplaceOn } from "../site";
import {
  MK_BROWSE_EMPTY, MK_CONDITIONS, MK_ERRORS, MK_HOME, MK_LIMITS_DEFAULT, MK_LIMIT_DETAILS, MK_REFUSALS, MK_SELLER_KINDS, MK_STATUSES,
  SA_CITIES, conditionKeys, inboxHref, isMkCity, isMkMediaPath, isMkPhotoName, listingHref, listingIdOf, marketSwitch, maskSerial,
  mkAmtText, mkBrowseOf, mkCatName, mkCategory, mkCategoryOf, mkCityName, mkClean, mkCommission, mkDaysLeft, mkErrorKey, mkErrorOf, mkFit,
  mkHasExif, mkHasLink, mkHasPhone, mkImageKind, mkNum, mkPhotoSrc, mkPick, mkRefusal, mkRenewable, mkSerial, mkSettings, mkSmallName,
  mkSoldShown, mkSports, mkTypesOf, mkWaDigits, mkWaHref, sellHref, sellerLabelKey, shopHref, statusKey, type MkCategory,
} from "../market/core";
import { bodyId, bodyInt, bodyText, marketGuard, mkAnswer, mkRefuse } from "../market/route";
import { loadMarketCategories, mkBrowse, mkListingGet, mkListingState, mkStorePut, purgeMarketPhotos } from "../market/server";

// The Marketplace's foundation: the plain rules of lib/market/core.ts, the shared words, the launch switch in the
// menus, the route guard, the typed database calls and the photo route. Nothing is read or written anywhere: every
// database and storage call is a stub. What the builders replace or fill (the placeholders, the sitemap and search
// hooks, their own words) is not pinned down here, so this file stays true as their parts land.

const render = renderUntyped as (el: ReactElement) => string;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const SESSION = "c1~" + "a".repeat(32);
const post = (body: unknown, o: { origin?: string | null; cookie?: string; raw?: string } = {}) =>
  new Request("https://micromobility.sa/api/market/x", {
    method: "POST",
    headers: { ...(o.origin === null ? {} : { origin: o.origin ?? "https://micromobility.sa" }), ...(o.cookie ? { cookie: o.cookie } : {}), "content-type": "application/json" },
    body: o.raw ?? JSON.stringify(body),
  });

describe("the launch switch", () => {
  it("is on only with an explicit true", () => {
    expect(marketSwitch({ "marketplace.on": true })).toBe(true);
    for (const v of [false, "true", 1, null, undefined]) expect(marketSwitch({ "marketplace.on": v })).toBe(false);
    expect(marketSwitch(null)).toBe(false);
    expect(marketplaceOn({ "marketplace.on": true })).toBe(true);
    expect(marketplaceOn(null)).toBe(false);
  });
  it("keeps the Marketplace out of the menus while it is off, and never sends its address anywhere", () => {
    expect(hiddenPages(null)).toContain("marketplace");
    expect(hiddenPages({ "marketplace.on": false })).toContain("marketplace");
    expect(hiddenPages({ "marketplace.on": true })).not.toContain("marketplace");
    // testimonials keep their own switch
    expect(hiddenPages({ "marketplace.on": true })).toContain("testimonials");
    expect(hiddenPages({ "marketplace.on": true, "testimonials.on": true })).not.toContain("testimonials");
  });
  it("has its own header link, named Marketplace and السوق, outside Community", () => {
    const l = NAV_LINKS.find((x) => x.key === "marketplace");
    expect(l).toMatchObject({ href: MK_HOME, en: "Marketplace", ar: "السوق" });
    expect(l?.external).toBeUndefined();
    expect(HEADER).toContain("marketplace");
    expect(COMMUNITY.pages).not.toContain("marketplace");
    expect(T.en.name).toBe("Marketplace");
    expect(T.ar.name).toBe("السوق");
  });
});

describe("addresses", () => {
  it("are under /marketplace", () => {
    expect(listingHref(42)).toBe("/marketplace/42");
    expect(shopHref("pedal-house")).toBe("/marketplace/shop/pedal-house");
    expect(sellHref()).toBe("/marketplace/sell");
    expect(sellHref(7)).toBe("/marketplace/sell/7");
    expect(inboxHref()).toBe("/marketplace/inbox");
    expect(inboxHref(3)).toBe("/marketplace/inbox/3");
  });
  it("read a listing's number from its address, and nothing else", () => {
    expect(listingIdOf("123")).toBe(123);
    for (const v of ["0", "012", "-1", "1.5", "12a", "sell", "", undefined, 12]) expect(listingIdOf(v)).toBeNull();
  });
  it("are kept at the edge only where every visitor sees the same page", () => {
    const get = (p: string) => new Request(`https://micromobility.sa${p}`);
    expect(pageCacheKey(get("/marketplace?lang=en"), "v")).not.toBeNull();
    expect(pageCacheKey(get("/marketplace/rules?lang=ar"), "v")).not.toBeNull();
    expect(pageCacheKey(get("/marketplace/shop/pedal-house?lang=en"), "v")).not.toBeNull();
    for (const p of ["/marketplace/123", "/marketplace/sell", "/marketplace/sell/9", "/marketplace/mine", "/marketplace/inbox", "/marketplace/inbox/4", "/marketplace/my-shop", "/marketplace/shops/apply", "/mkt/l1/" + "a".repeat(32) + ".jpg"]) {
      expect(pageCacheKey(get(`${p}?lang=en`), "v"), p).toBeNull();
    }
  });
});

describe("settings", () => {
  it("fall back to the defaults the database uses", () => {
    const s = mkSettings(null);
    expect(s).toMatchObject({ on: false, commissionPct: 1, listingDays: 60, autoHoldReports: 3, termsVersion: "2026-11-21", commissionHow: { en: "", ar: "" } });
    expect(s.limits).toEqual(MK_LIMITS_DEFAULT);
    expect(MK_LIMITS_DEFAULT).toMatchObject({ new_days: 14, new: { live: 2, price_max: 3000, threads_day: 5, wa_day: 0 }, established: { live: 10, threads_day: 20, wa_day: 10 }, shop: { live_first: 20, first_days: 14, live: 200 }, messages_day: 200 });
  });
  it("read what staff set, and ignore a value that is not of its shape", () => {
    const s = mkSettings({
      "marketplace.on": true, "marketplace.commission_pct": 1.5, "marketplace.commission_how": { en: "Pay at the hub", ar: "ادفع في المقر" },
      "marketplace.limits": { new: { live: 1, price_max: "many" }, messages_day: 50 }, "marketplace.listing_days": 30, "marketplace.auto_hold_reports": 99, "marketplace.terms_version": "2027-01-01",
    });
    expect(s).toMatchObject({ on: true, commissionPct: 1.5, commissionHow: { en: "Pay at the hub", ar: "ادفع في المقر" }, listingDays: 30, autoHoldReports: 3, termsVersion: "2027-01-01" });
    expect(s.limits.new).toEqual({ live: 1, price_max: 3000, threads_day: 5, wa_day: 0 });
    expect(s.limits.messages_day).toBe(50);
    expect(mkSettings({ "marketplace.commission_pct": 0 }).commissionPct).toBe(0);
    expect(mkSettings({ "marketplace.commission_pct": -1 }).commissionPct).toBe(1);
  });
});

describe("cities", () => {
  it("are keyed, with Jeddah first and 'another city' last, each named in English and Arabic", () => {
    expect(SA_CITIES[0].key).toBe("jeddah");
    expect(SA_CITIES.at(-1)?.key).toBe("other");
    expect(new Set(SA_CITIES.map((c) => c.key)).size).toBe(SA_CITIES.length);
    for (const c of SA_CITIES) {
      expect(c.key).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(c.en.trim() && c.ar.trim()).toBeTruthy();
      expect(c.ar).toMatch(/[؀-ۿ]/);
    }
    expect(isMkCity("riyadh")).toBe(true);
    expect(isMkCity("Riyadh")).toBe(false);
  });
  it("read in Arabic on Arabic and Urdu pages, in English elsewhere", () => {
    expect(mkCityName("jeddah", "ar")).toBe("جدة");
    expect(mkCityName("jeddah", "ur")).toBe("جدة");
    expect(mkCityName("jeddah", "de")).toBe("Jeddah");
    expect(mkCityName("atlantis", "en")).toBe("atlantis");
  });
});

describe("categories", () => {
  const rows = [
    { slug: "cycling", parent: null, name_en: "Cycling", name_ar: "الدراجات", sort: 10, tier: "open", needs_serial: false, min_photos: 1, facts: [] },
    { slug: "cycling-helmets", parent: "cycling", name_en: "Helmets", name_ar: "خوذات", sort: 130, tier: "new_only", needs_serial: false, min_photos: 2, facts: ["brand", "size", "nonsense"] },
    { slug: "cycling-bike-road", parent: "cycling", name_en: "Road bikes", name_ar: "دراجات الطريق", sort: 20, tier: "open", needs_serial: true, min_photos: 3, facts: ["brand", "model", "year", "frame_size", "wheel_size"] },
    { slug: "running", parent: null, name_en: "Running", name_ar: "", sort: 20, tier: "weird", needs_serial: "yes", min_photos: 99, facts: null },
    { slug: "Bad Slug", name_en: "x" }, { slug: "noname" }, null,
  ];
  const cats = rows.map(mkCategory).filter((c): c is MkCategory => c !== null);
  it("are read safely", () => {
    expect(cats.map((c) => c.slug)).toEqual(["cycling", "cycling-helmets", "cycling-bike-road", "running"]);
    expect(mkCategoryOf(cats, "cycling-helmets")).toMatchObject({ tier: "new_only", min_photos: 2, facts: ["brand", "size"] });
    expect(mkCategoryOf(cats, "running")).toMatchObject({ tier: "open", needs_serial: false, min_photos: 1, facts: [], name_ar: "Running" });
    expect(mkCategoryOf(cats, "nope")).toBeNull();
  });
  it("are two levels, in staff's order, named in the reader's alphabet", () => {
    expect(mkSports(cats).map((c) => c.slug)).toEqual(["cycling", "running"]);
    expect(mkTypesOf(cats, "cycling").map((c) => c.slug)).toEqual(["cycling-bike-road", "cycling-helmets"]);
    expect(mkCatName(cats[1], "ar")).toBe("خوذات");
    expect(mkCatName(cats[1], "fr")).toBe("Helmets");
    expect(mkPick("ar", "Pedal House", "بيت الدواسة")).toBe("بيت الدواسة");
    expect(mkPick("ar", "Pedal House", " ")).toBe("Pedal House");
    expect(mkPick("en", "Pedal House", "بيت الدواسة")).toBe("Pedal House");
  });
});

describe("the shared words", () => {
  it("have every condition, its definition, every seller label and every state, in English and Arabic", () => {
    for (const t of [T.en, T.ar]) {
      for (const c of MK_CONDITIONS) { const k = conditionKeys(c); expect(t[k.label].trim() && t[k.def].trim(), c).toBeTruthy(); }
      for (const k of MK_SELLER_KINDS) expect(t[sellerLabelKey(k)].trim(), k).toBeTruthy();
      for (const s of MK_STATUSES) expect(t[statusKey(s)].trim(), s).toBeTruthy();
      expect(t.checkedOn("20 Nov 2026")).toContain("20 Nov 2026");
      expect(t.safety.trim()).toBeTruthy();
    }
    expect(conditionKeys("parts")).toEqual({ label: "cond_parts", def: "cond_parts_def" });
    expect(T.en.cond_parts).toBe("For parts or not working");
    expect([T.en.seller_private, T.en.seller_company]).toEqual(["Private seller", "Sold by MicroMobility"]);
  });
  it("say every refusal a route can answer, in English and Arabic, with the same keys", () => {
    expect(Object.keys(T.ar).sort()).toEqual(Object.keys(T.en).sort());
    expect(Object.keys(T.ar.errors).sort()).toEqual(Object.keys(T.en.errors).sort());
    for (const e of MK_ERRORS) {
      const key = mkErrorKey(e);
      expect(T.en.errors[key], key).toBeTruthy();
      expect(T.ar.errors[key], key).toBeTruthy();
    }
    for (const d of MK_LIMIT_DETAILS) expect(T.en.errors[mkErrorKey("limit", d)] && T.ar.errors[mkErrorKey("limit", d)], d).toBeTruthy();
    expect(mkErrorText(T.en, mkErrorKey("limit", "live"))).toBe(T.en.errors.limit_live);
    expect(mkErrorText(T.en, "no-such-key")).toBe(T.en.errors.generic);
  });
  it("carry no emoji, name MicroMobility as written and no other company", () => {
    const all = JSON.stringify([T.en, T.ar, { e: T.en.checkedOn("x"), a: T.ar.checkedOn("x") }]);
    expect(all).not.toMatch(/[\u{1F000}-\u{1FAFF}☀-➿]/u);
    expect(all).not.toMatch(/Micromobility|micromobility|مايكروموبيليتي/);
  });
  it("give each builder a words file of its own, with the same keys in English and Arabic", () => {
    const keys = (v: unknown): string[] => (v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [k, ...keys(x).map((y) => `${k}.${y}`)]).sort() : []);
    for (const w of [W1, W2, W3, W4]) expect(keys(w.ar)).toEqual(keys(w.en));
  });
  it("draw every mark from the one set", () => {
    expect(MK_ICONS).toEqual(expect.arrayContaining(["close", "back", "next", "search", "filter", "pin", "shop", "user", "shield", "flag", "chat", "whatsapp", "camera", "tick", "plus"]));
  });
});

describe("the shared pieces", () => {
  const hex = "0123456789abcdef0123456789abcdef";
  it("write a price left to right, the sign for the eye and the word for a screen reader", () => {
    const html = render(createElement(MkAmt, { n: 12500, word: "SAR" }));
    expect(html).toBe('<bdi class="mk-amt" dir="ltr"><span aria-hidden="true">\u20C1</span><span class="mm-sr">SAR</span> 12,500</bdi>');
  });
  it("say who is selling, and the team's check only when staff made one", () => {
    const priv = render(createElement(SellerTag, { kind: "private", t: T.en }));
    expect(priv).toContain("Private seller");
    expect(priv).not.toContain("Checked");
    expect(render(createElement(SellerTag, { kind: "shop", t: T.ar }))).toContain("يبيعه متجر");
    const co = render(createElement(SellerTag, { kind: "company", t: T.en, checked: true, checkedOn: "20 Nov 2026" }));
    expect(co).toContain("Sold by MicroMobility");
    expect(co).toContain("Checked by our team on 20 Nov 2026");
    expect(render(createElement(SellerTag, { kind: "private", t: T.en, checked: true }))).toContain("Checked by our team<");
  });
  it("show a photo from the site's own address, or the no-photo mark", () => {
    const card = render(createElement(MkPhoto, { name: `l4/${hex}.jpg`, alt: "Road bike", small: true }));
    expect(card).toContain(`src="/mkt/l4/${hex}.jpg?w=480"`);
    expect(card).toContain('alt="Road bike"');
    expect(card).toContain('loading="lazy"');
    const full = render(createElement(MkPhoto, { name: `l4/${hex}.jpg`, alt: "Road bike", eager: true, ratio: "4/3" }));
    expect(full).toContain(`/mkt/l4/${hex}.jpg?w=480 480w`);
    expect(full).toContain("mk-photo-43");
    expect(render(createElement(MkPhoto, { name: "/media/market/a.jpg", alt: "x", small: true }))).toContain('src="/media/market/a.jpg?w=640"');
    const none = render(createElement(MkPhoto, { name: null, alt: "Road bike", noPhoto: "No photo" }));
    expect(none).not.toContain("<img");
    expect(none).toContain('aria-label="No photo"');
    expect(render(createElement(MkPhoto, { name: "https://elsewhere/a.jpg", alt: "x" }))).not.toContain("<img");
  });
  it("draw a mark for the eye alone, and turn an arrow round only when asked", () => {
    const html = render(createElement(MkIcon, { name: "next", flip: true }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("mk-ic-flip");
    expect(render(createElement(MkIcon, { name: "close" }))).not.toContain("mk-ic-flip");
  });
  it("show a gated page's own content only to a signed-in visitor", () => {
    const inside = createElement("p", null, "My listings");
    expect(render(MkGate({ locale: "en", session: { id: "c1", token: "a".repeat(32) }, children: inside }))).toBe("<p>My listings</p>");
  });
});

describe("small rules", () => {
  it("mask a serial number to its last three characters", () => {
    expect(maskSerial("WTU123X42")).toBe("•••X42");
    expect(maskSerial("  AB  ")).toBe("•••AB");
    expect(maskSerial("")).toBeNull();
    expect(maskSerial(null)).toBeNull();
  });
  it("keep a serial number as letters, digits and dashes, upper case", () => {
    expect(mkSerial(" wtu 123-x42 ")).toBe("WTU123-X42");
    expect(mkSerial("abc")).toBeNull();
    expect(mkSerial("AB_12345")).toBeNull();
    expect(mkSerial("A".repeat(41))).toBeNull();
    expect(mkSerial(12345)).toBeNull();
  });
  it("write a price as whole riyals with its thousands grouped, the sign left of it", () => {
    expect(mkNum(950)).toBe("950");
    expect(mkNum(12500)).toBe("12,500");
    expect(mkNum(500000)).toBe("500,000");
    expect(mkNum(1234.6)).toBe("1,235");
    expect(mkNum(NaN)).toBe("0");
    expect(mkAmtText(12500)).toBe("⁦⃁ 12,500⁩");
  });
  it("work out the honour commission to the nearest riyal, and none at 0%", () => {
    expect(mkCommission(2350, 1)).toBe(24); // 23.5 goes up
    expect(mkCommission(2340, 1)).toBe(23);
    expect(mkCommission(40, 1)).toBe(0);
    expect(mkCommission(50, 1)).toBe(1);
    expect(mkCommission(10000, 2.5)).toBe(250);
    expect(mkCommission(10000, 0)).toBe(0);
  });
  it("show the renew card in a listing's last week and once it has expired", () => {
    const now = Date.parse("2026-11-20T12:00:00Z");
    const at = (days: number) => new Date(now + days * 86_400_000).toISOString();
    expect(mkDaysLeft(at(10), now)).toBe(10);
    expect(mkDaysLeft(at(-1), now)).toBe(-1);
    expect(mkDaysLeft(null, now)).toBeNull();
    expect(mkRenewable({ status: "live", expires_at: at(10) }, now)).toBe(false);
    expect(mkRenewable({ status: "live", expires_at: at(6.5) }, now)).toBe(true);
    expect(mkRenewable({ status: "reserved", expires_at: at(2) }, now)).toBe(true);
    expect(mkRenewable({ status: "expired", expires_at: at(-3) }, now)).toBe(true);
    expect(mkRenewable({ status: "sold", expires_at: at(2) }, now)).toBe(false);
    expect(mkRenewable({ status: "draft", expires_at: null }, now)).toBe(false);
    expect(mkSoldShown(at(-13), now)).toBe(true);
    expect(mkSoldShown(at(-15), now)).toBe(false);
    expect(mkSoldShown(null, now)).toBe(false);
  });
  it("make a WhatsApp link from digits, with the message ready", () => {
    expect(mkWaHref("966501234567", "Hello, is the road bike still on sale?")).toBe("https://wa.me/966501234567?text=Hello%2C%20is%20the%20road%20bike%20still%20on%20sale%3F");
    expect(mkWaHref("+966 50 123 4567")).toBe("https://wa.me/966501234567");
    expect(mkWaHref("12")).toBeNull();
    expect(mkWaDigits("https://wa.me/966566668818")).toBe("966566668818");
    expect(mkWaDigits("https://wa.me/966566668818?text=hi")).toBe("966566668818");
    for (const v of ["https://example.com/966566668818", "wa.me/966566668818", "", null]) expect(mkWaDigits(v)).toBeNull();
  });
});

describe("what people write", () => {
  it("is cleaned as the database cleans it: spaces as one, no hidden characters, no pictographs", () => {
    expect(mkClean("  Road   bike\n\nsize 54\t ")).toBe("Road bike size 54");
    expect(mkClean("a​b‮c﻿d")).toBe("abcd");
    expect(mkClean("Great bike \u{1F6B2}✨!")).toBe("Great bike !");
    expect(mkClean("دراجة طريق")).toBe("دراجة طريق");
    expect(mkClean(42)).toBe("");
  });
  it("is refused with a link in it", () => {
    for (const s of ["see https://x.y", "www.example", "my-shop.com", "wa.me/9665", "haraj.sa now", "t.me"]) expect(mkHasLink(s), s).toBe(true);
    for (const s of ["Size 54. Good condition", "Shimano 105 11-speed", "v2.0 frame", "دراجة ممتازة"]) expect(mkHasLink(s), s).toBe(false);
  });
  it("is refused with a phone number in it, however its digits are written", () => {
    for (const s of ["call 0501234567", "05 0123 4567", "050-123-4567", "+966501234567", "00966 50 123 4567", "966 501234567", "٠٥٠١٢٣٤٥٦٧", "۰۵۰۱۲۳۴۵۶۷", "id 123456789"]) expect(mkHasPhone(s), s).toBe(true);
    for (const s of ["Size 54, 2023 model, 11 speed", "700x25 2023 105", "Garmin Edge 1040", "bought in 2021 for 4500", "frame 56 cm, 8.2 kg", "SN 1234-5678"]) expect(mkHasPhone(s), s).toBe(false);
  });
});

describe("photos", () => {
  const hex = "0123456789abcdef0123456789abcdef";
  it("are named by the database, or are staff's own media", () => {
    expect(isMkPhotoName(`l12/${hex}.jpg`)).toBe(true);
    expect(isMkPhotoName(`s3/${hex}.webp`)).toBe(true);
    for (const n of [`l12/${hex}.png`, `x12/${hex}.jpg`, `l12/${hex}.w480.jpg`, `l12/../${hex}.jpg`, `l/${hex}.jpg`, `l12/${hex.toUpperCase()}.jpg`, "", null]) expect(isMkPhotoName(n), String(n)).toBe(false);
    expect(isMkMediaPath("/media/market/ex-rental-road-1.jpg")).toBe(true);
    expect(isMkMediaPath("/media/market/2026/bike.webp")).toBe(true);
    // the staging seed's demo listings show catalogue photos
    expect(isMkMediaPath("/media/bikes/a.jpg")).toBe(true);
    for (const n of ["/media/market/a.svg", "/media/market/../site/a.jpg", "/media/../x.jpg", "/media/", "/mediax/a.jpg", "https://x/media/market/a.jpg", "//x/media/a.jpg"]) expect(isMkMediaPath(n), n).toBe(false);
  });
  it("are shown from the site's own address, the small copy on a card", () => {
    expect(mkSmallName(`l12/${hex}.jpg`)).toBe(`l12/${hex}.w480.jpg`);
    expect(mkPhotoSrc(`l12/${hex}.webp`)).toBe(`/mkt/l12/${hex}.webp`);
    expect(mkPhotoSrc(`l12/${hex}.webp`, true)).toBe(`/mkt/l12/${hex}.webp?w=480`);
    expect(mkPhotoSrc("/media/market/a.jpg", true)).toBe("/media/market/a.jpg?w=640");
    expect(mkPhotoSrc("https://elsewhere/a.jpg")).toBeNull();
    expect(mkPhotoSrc(null)).toBeNull();
  });
  it("are told apart by their first bytes, and a JPEG that still carries Exif is seen", () => {
    const jpeg = (segments: number[][]) => new Uint8Array([0xff, 0xd8, ...segments.flat(), 0xff, 0xda, 0, 2]);
    const app0 = [0xff, 0xe0, 0, 4, 0x4a, 0x46];
    const exif = [0xff, 0xe1, 0, 8, 0x45, 0x78, 0x69, 0x66, 0, 0];
    expect(mkImageKind(jpeg([app0]))).toBe("jpg");
    expect(mkImageKind(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe("webp");
    expect(mkImageKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(mkImageKind(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
    expect(mkHasExif(jpeg([app0]))).toBe(false);
    expect(mkHasExif(jpeg([app0, exif]))).toBe(true);
    expect(mkHasExif(jpeg([exif]))).toBe(true);
    expect(mkHasExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
  it("are made down to their longest side, never up", () => {
    expect(mkFit(4000, 3000)).toEqual({ w: 1600, h: 1200 });
    expect(mkFit(3000, 4000, 480)).toEqual({ w: 360, h: 480 });
    expect(mkFit(800, 600)).toEqual({ w: 800, h: 600 });
    expect(mkFit(0, 0)).toEqual({ w: 0, h: 0 });
  });
});

describe("refusals", () => {
  it("are read from the database's message: a code first, then what it is about", () => {
    expect(mkRefusal("MKT_LIMIT: live")).toEqual({ code: "MKT_LIMIT", detail: "live" });
    expect(mkRefusal("MKT_ADULT")).toEqual({ code: "MKT_ADULT", detail: "" });
    expect(mkRefusal("MKT_INPUT:title")).toEqual({ code: "MKT_INPUT", detail: "title" });
    expect(mkRefusal("MKT_NOT_A_CODE")).toBeNull();
    expect(mkRefusal("FORBIDDEN")).toBeNull();
    expect(mkRefusal("")).toBeNull();
  });
  it("become the site's error id and HTTP status", () => {
    expect(mkErrorOf({ status: 400, message: "MKT_LIMIT: live", code: "P0001" })).toEqual({ error: "limit", detail: "live", status: 429 });
    expect(mkErrorOf({ status: 400, message: "MKT_SIGNIN" })).toEqual({ error: "signin", detail: "", status: 401 });
    expect(mkErrorOf({ status: 400, message: "MKT_GONE" })).toEqual({ error: "gone", detail: "", status: 404 });
    expect(mkErrorOf({ status: 404, message: "Could not find the function public.market_me", code: "PGRST202" })).toEqual({ error: "absent", detail: "", status: 404 });
    expect(mkErrorOf({ status: 0, message: "" })).toEqual({ error: "generic", detail: "", status: 502 });
    expect(mkErrorOf({ status: 503, message: "MKT_LIMIT: live" })).toEqual({ error: "generic", detail: "", status: 502 });
    expect(mkErrorOf({ status: 400, message: "something else" })).toEqual({ error: "generic", detail: "", status: 502 });
  });
  it("each have one error id, and every id has its words' key", () => {
    const ids = Object.values(MK_REFUSALS).map((r) => r.error);
    expect(new Set(ids).size).toBe(ids.length);
    expect(mkErrorKey("limit", "threads")).toBe("limit_threads");
    expect(mkErrorKey("limit", "unknown")).toBe("limit");
    expect(mkErrorKey("phone")).toBe("phone");
    expect(mkErrorKey("nonsense")).toBe("generic");
  });
});

describe("the route guard", () => {
  it("lets only this site's own pages change anything, signed in, with a JSON object of a bounded size", async () => {
    const other = await marketGuard(post({ a: 1 }, { origin: "https://evil.example", cookie: `mm_acct=${SESSION}` }));
    expect(other.ok).toBe(false);
    if (!other.ok) { expect(other.res.status).toBe(403); expect(await other.res.json()).toEqual({ ok: false, error: "origin" }); }
    const none = await marketGuard(post({ a: 1 }, { origin: null, cookie: `mm_acct=${SESSION}` }));
    if (!none.ok) expect(none.res.status).toBe(403);
    const out = await marketGuard(post({ a: 1 }));
    expect(out.ok).toBe(false);
    if (!out.ok) { expect(out.res.status).toBe(401); expect(await out.res.json()).toEqual({ ok: false, error: "signin" }); }
    const big = await marketGuard(post({ a: "x".repeat(300) }, { cookie: `mm_acct=${SESSION}` }), { max: 100 });
    if (!big.ok) expect(big.res.status).toBe(413);
    expect(big.ok).toBe(false);
    for (const raw of ["[1,2]", "not json", "null"]) {
      const bad = await marketGuard(post(null, { cookie: `mm_acct=${SESSION}`, raw }));
      expect(bad.ok, raw).toBe(false);
      if (!bad.ok) { expect(bad.res.status).toBe(400); expect(await bad.res.json()).toEqual({ ok: false, error: "invalid" }); }
    }
    const good = await marketGuard(post({ id: 7, title: "Road bike" }, { cookie: `mm_acct=${SESSION}` }));
    expect(good.ok).toBe(true);
    if (good.ok) { expect(good.session).toEqual({ id: "c1", token: "a".repeat(32) }); expect(good.body).toEqual({ id: 7, title: "Road bike" }); }
  });
  it("takes a read without an Origin, and a visitor where the route says so", async () => {
    const get = (cookie?: string) => new Request("https://micromobility.sa/api/market/x", { headers: cookie ? { cookie } : {} });
    const signedOut = await marketGuard(get(), { read: true });
    expect(signedOut.ok).toBe(false);
    const visitor = await marketGuard(get(), { read: true, signin: false });
    expect(visitor).toMatchObject({ ok: true, session: null, body: {} });
    const signedIn = await marketGuard(get(`mm_acct=${SESSION}`), { read: true });
    expect(signedIn).toMatchObject({ ok: true, session: { id: "c1" } });
    const raw = await marketGuard(post({ a: 1 }, { cookie: `mm_acct=${SESSION}` }), { raw: true, kind: "market-photo" });
    expect(raw).toMatchObject({ ok: true, body: {} });
  });
  it("answers a database call as {ok: true, ...} or its refusal, never kept", async () => {
    const yes = mkAnswer({ ok: true, data: { thread_id: 4, created: true } });
    expect(yes.status).toBe(200);
    expect(yes.headers.get("cache-control")).toContain("no-store");
    expect(await yes.json()).toEqual({ ok: true, thread_id: 4, created: true });
    expect(await mkAnswer({ ok: true, data: { a: 1 } }, (d) => ({ me: d })).json()).toEqual({ ok: true, me: { a: 1 } });
    const no = mkAnswer({ ok: false, error: "limit", detail: "live", status: 429 });
    expect(no.status).toBe(429);
    expect(await no.json()).toEqual({ ok: false, error: "limit", detail: "live" });
    expect(await mkRefuse("gone", 404).json()).toEqual({ ok: false, error: "gone" });
  });
  it("reads a body's values strictly", () => {
    expect(bodyId(12)).toBe(12);
    for (const v of [0, -3, 1.5, "12", null, undefined]) expect(bodyId(v)).toBeNull();
    expect(bodyText("hello", 10)).toBe("hello");
    expect(bodyText("x".repeat(11), 10)).toBeNull();
    expect(bodyText(5, 10)).toBeNull();
    expect(bodyInt(3000, 1, 500000)).toBe(3000);
    for (const v of [0, 500001, 12.5, "9"]) expect(bodyInt(v, 1, 500000)).toBeNull();
  });
});

describe("the database calls", () => {
  type Call = { url: string; body: Record<string, unknown> | null; method: string };
  let calls: Call[] = [];
  const stub = (answer: (c: Call) => Response) => {
    calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const c = { url: String(url), body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null, method: init?.method ?? "GET" };
      calls.push(c);
      return answer(c);
    }));
  };
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    resetMemo("market:");
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const s = { id: "c1", token: "a".repeat(32) };

  it("send the account's own id and token, and read a refusal by its code", async () => {
    stub(() => json({ code: "P0001", message: "MKT_LIMIT: live" }, 400));
    const r = await mkListingState(s, 9, "renew", null);
    expect(r).toEqual({ ok: false, error: "limit", detail: "live", status: 429 });
    expect(calls[0].url).toBe("https://example.supabase.co/rest/v1/rpc/market_listing_state");
    expect(calls[0].body).toEqual({ p_id: "c1", p_token: "a".repeat(32), p_listing: 9, p_action: "renew", p_price: null });
  });
  it("read a page of the grid, leaving out what is not a card", async () => {
    stub(() => json({ items: [{ id: 3, title: "Road bike", price: 2500 }, { id: "x" }, null], next: "c_3", sports: ["cycling", 5], categories: ["cycling-bike-road"] }));
    const r = await mkBrowse({ sport: "cycling", sort: "price_asc" });
    expect(calls[0].body).toEqual({ p: { sport: "cycling", sort: "price_asc" } });
    expect(r.ok && r.data).toMatchObject({ items: [{ id: 3 }], next: "c_3", sports: ["cycling"], categories: ["cycling-bike-road"] });
    expect(mkBrowseOf(null)).toBe(MK_BROWSE_EMPTY);
  });
  it("read a listing for a visitor with no account, and nothing for one nobody may see", async () => {
    stub(() => json(null));
    expect(await mkListingGet(5, null)).toEqual({ ok: true, data: null });
    expect(calls[0].body).toEqual({ p_listing: 5, p_id: null, p_token: null });
    stub(() => json({ nonsense: true }));
    expect(await mkListingGet(5, s)).toMatchObject({ ok: false, error: "generic" });
    stub(() => json({ code: "PGRST202", message: "Could not find the function public.market_listing_get" }, 404));
    expect(await mkListingGet(5, s)).toMatchObject({ ok: false, error: "absent", status: 404 });
  });
  it("read the categories once a minute, and none from a database without them", async () => {
    stub(() => json([{ slug: "cycling", parent: null, name_en: "Cycling", name_ar: "الدراجات", sort: 1, tier: "open", needs_serial: false, min_photos: 1, facts: [] }]));
    expect((await loadMarketCategories()).map((c) => c.slug)).toEqual(["cycling"]);
    expect(calls[0].url).toContain("/rest/v1/market_categories?select=");
    expect(calls[0].url).toContain("visible=is.true");
    await loadMarketCategories();
    expect(calls.length).toBe(1);
    resetMemo("market:");
    stub(() => json({ code: "PGRST205", message: "Could not find the table" }, 404));
    expect(await loadMarketCategories()).toEqual([]);
  });
  it("store a photo only at a name the database could have issued, never over another, with the storage's secret key", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    const auths: string[] = [];
    stub(() => json({ Key: "ok" }));
    const recorded = vi.mocked(fetch);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      auths.push(new Headers(init?.headers).get("authorization") ?? "");
      return recorded(url, init);
    }));
    const hex = "0123456789abcdef0123456789abcdef";
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
    expect(await mkStorePut(`l4/${hex}.jpg`, bytes, "image/jpeg")).toBe(true);
    expect(await mkStorePut(`l4/${hex}.w480.jpg`, bytes, "image/jpeg")).toBe(true);
    expect(calls.map((c) => c.url)).toEqual([`https://example.supabase.co/storage/v1/object/market/l4/${hex}.jpg`, `https://example.supabase.co/storage/v1/object/market/l4/${hex}.w480.jpg`]);
    expect(await mkStorePut("p/anything.jpg", bytes, "image/jpeg")).toBe(false);
    expect(calls.length).toBe(2);
    expect(auths).toEqual(["Bearer service", "Bearer service"]);
    // never with the public key: without the storage's secret key nothing is stored
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await mkStorePut(`l4/${hex}.jpg`, bytes, "image/jpeg")).toBe(false);
    expect(calls.length).toBe(2);
  });
  it("remove from the storage only the photos the database named, both copies of each, with the storage's secret key", async () => {
    const hex = "0123456789abcdef0123456789abcdef";
    // without the secret key nothing is asked or removed
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    stub(() => json({ names: [`l4/${hex}.jpg`] }));
    expect(await purgeMarketPhotos()).toBe(0);
    expect(calls.length).toBe(0);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    const auths: string[] = [];
    stub((c) => (c.url.includes("/rpc/market_purge_take") ? json({ names: [`l4/${hex}.jpg`, "not/a/name.jpg"] }) : json([])));
    const recorded = vi.mocked(fetch);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      auths.push(new Headers(init?.headers).get("authorization") ?? "");
      return recorded(url, init);
    }));
    expect(await purgeMarketPhotos()).toBe(1);
    expect(auths).toEqual(["Bearer service", "Bearer service"]);
    expect(calls[1]).toMatchObject({ url: "https://example.supabase.co/storage/v1/object/market", method: "DELETE", body: { prefixes: [`l4/${hex}.jpg`, `l4/${hex}.w480.jpg`] } });
    stub(() => json({ names: [] }));
    expect(await purgeMarketPhotos()).toBe(0);
    expect(calls.length).toBe(1);
    const res = await purgePost(new Request("https://micromobility.sa/api/market/purge", { method: "POST" }));
    expect(await res.json()).toEqual({ ok: true, removed: 0 });
  });
  it("answer /api/market/me from the cookie alone for a visitor, and with market_me for an account", async () => {
    stub(() => json({ on: false, adult: true, established: true, seller: { status: "ok", terms_ok: false }, limits: { live: 10, live_used: 0 }, unread: 2 }));
    const out = await meGet(new Request("https://micromobility.sa/api/market/me"));
    expect(await out.json()).toEqual({ ok: true, signedIn: false });
    expect(calls.length).toBe(0);
    const me = await meGet(new Request("https://micromobility.sa/api/market/me", { headers: { cookie: `mm_acct=${SESSION}` } }));
    expect(await me.json()).toMatchObject({ ok: true, signedIn: true, me: { adult: true, unread: 2 } });
    expect(calls[0].body).toEqual({ p_id: "c1", p_token: "a".repeat(32) });
    stub(() => json({ code: "P0001", message: "MKT_SIGNIN" }, 400));
    const refused = await meGet(new Request("https://micromobility.sa/api/market/me", { headers: { cookie: `mm_acct=${SESSION}` } }));
    expect(refused.status).toBe(401);
    expect(await refused.json()).toEqual({ ok: false, error: "signin" });
  });
  it("serve a photo from the site's own address: the small copy when asked, itself when there is none, and nothing else", async () => {
    const hex = "0123456789abcdef0123456789abcdef";
    const ask = (path: string, q = "") => photoGet(new Request(`https://micromobility.sa/mkt/${path}${q}`), { params: Promise.resolve({ path: path.split("/") }) });
    const picture = () => new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { "content-type": "image/jpeg" } });
    stub((c) => (c.url.includes(".w480.") ? new Response("no", { status: 400 }) : picture()));
    const full = await ask(`l4/${hex}.jpg`, "?w=480");
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("image/jpeg");
    expect(full.headers.get("x-content-type-options")).toBe("nosniff");
    expect(full.headers.get("cache-control")).toContain("max-age=3600");
    expect(calls.map((c) => c.url)).toEqual([`https://example.supabase.co/storage/v1/object/public/market/l4/${hex}.w480.jpg`, `https://example.supabase.co/storage/v1/object/public/market/l4/${hex}.jpg`]);
    stub(() => picture());
    expect((await ask(`l4/${hex}.jpg`)).status).toBe(200);
    expect(calls.length).toBe(1);
    for (const bad of [`l4/${hex}.png`, `l4/${hex}.w480.jpg`, `p/${hex}.jpg`, `l4/x.jpg`]) expect((await ask(bad)).status, bad).toBe(404);
    expect(calls.length).toBe(1);
    stub(() => new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }));
    expect((await ask(`l4/${hex}.jpg`)).status).toBe(404);
    stub(() => new Response("gone", { status: 400 }));
    expect((await ask(`s2/${hex}.webp`)).status).toBe(404);
  });
});
