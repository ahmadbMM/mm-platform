import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TxProvider } from "@/i18n/TxProvider";
import { localize } from "@/i18n/tx";
import { orderOf } from "../store-order";
import { T as STORE_T } from "../../components/store/Store.text";
import { T as W5 } from "../../components/store/w5.text";
import { T as SX } from "../../components/store/sx-B3.text";
import type { CartLine } from "../cart";
import type { StoreProduct } from "../store-core";
import { deliverySlots, seasonTimes, slotDays, slotOk, slotTimes } from "../store-settings";
import {
  boxValue, buyerOf, cartEstimate, companyBody, companyProblems, EMPTY_COMPANY, EMPTY_SX, extrasOf, hasExtras, LINE_PX, mapsHref, orderExtrasOf,
  pinOf, pinOk, quoteOf, reserveHeights, reserveOf, roundPin, sessionChoices, smallOnly, sxDraftOf, sxExtras, sxPlace, sxProblems, sxRefusal,
  sxSettings, vatOk, type SxSettings,
} from "../sx-b3";
import { handoverOf, handoverPickOf, inSeason, openDays, pickOpen, ramadanOf } from "../sx-b3-handover";

// The cart, checkout and quote link of the build of 2026-11-18 (builder B3): the rules in lib/sx-b3.ts and
// lib/sx-b3-handover.ts, and the pages that draw them, read as text.
const src = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

describe("the cart's place kept before it is read (P10, SM10-B)", () => {
  it("reads the line count and the heights drawn for that count only", () => {
    expect(reserveOf("3", "3.812.640")).toEqual({ n: 3, narrow: 812, wide: 640 });
    expect(reserveOf("2", "3.812.640")).toEqual({ n: 2, narrow: 0, wide: 0 }); // drawn for 3 lines: not this cart's
    expect(reserveOf(undefined, undefined)).toEqual({ n: 0, narrow: 0, wide: 0 });
    expect(reserveOf("x", "a.b.c")).toEqual({ n: 0, narrow: 0, wide: 0 });
    expect(reserveOf("99", undefined).n).toBe(20);
  });
  it("keeps the other width's height while the count is the same, and drops it when it is not", () => {
    expect(boxValue("3.812.640", 3, false, 790.4)).toBe("3.790.640");
    expect(boxValue("3.812.640", 3, true, 700)).toBe("3.812.700");
    expect(boxValue("2.812.640", 3, true, 700)).toBe("3.0.700");
    expect(boxValue(undefined, 1, false, 500)).toBe("1.500.0");
  });
  it("estimates from the lines when never drawn: one template, 155 px a line", () => {
    expect(LINE_PX).toBe(155);
    expect(cartEstimate(0, false)).toBe(140);
    expect(cartEstimate(2, false)).toBeGreaterThan(cartEstimate(1, false));
    expect(reserveHeights({ n: 2, narrow: 0, wide: 700 }, "cart")).toEqual({ narrow: cartEstimate(2, false), wide: 700 });
  });
  it("is drawn by the cart and checkout pages from the cookies, and the cart writes its count", () => {
    expect(src("app/[locale]/store/cart/page.tsx")).toContain("reserveOf(jar.get(CART_N_COOKIE)?.value, jar.get(boxCookie(\"cart\"))?.value)");
    expect(src("components/store/useCart.ts")).toContain("keepCartCount(next.length)");
    expect(src("components/store/CheckoutForm.tsx")).toContain("<ReserveBox reserve={props.sx.reserve} />");
    expect(src("components/store/store.css")).toContain(".st-cart-wait { min-height: var(--sx3-n, 50vh); }");
  });
});

describe("the cart's lines and checkout's button (SM10-B, SM10-C, P14, P15, P16)", () => {
  it("draws every line in one template with drawn Save and Remove, Apple Pay before Checkout, and a total row on a phone", () => {
    const cart = src("components/store/CartView.tsx");
    expect(cart).toContain('<SxIcon name="bookmark"');
    expect(cart).toContain('<SxIcon name="trash"');
    expect(cart).not.toContain('className="st-remove"');
    expect(cart.indexOf("<ApplePayButton")).toBeLessThan(cart.indexOf("{go}"));
    expect(cart).toContain('className="sx3-top"');
    expect(src("components/store/sx-B3.css")).toMatch(/@media \(min-width: 900px\) \{ \.sx3-top \{ display: none; \} \}/);
  });
  it("keeps the amount on Place order in one piece and drops the accepted-cards line", () => {
    const form = src("components/store/CheckoutForm.tsx");
    expect(form).toContain('<Amt className="sx3-amt">{sar(money.due)}</Amt>');
    expect(form).not.toContain("payT.methods");
    expect(form).toContain("t.oblige"); // the consent line stays (P15)
    expect(src("components/store/sx-B3.css")).toContain(".st-place .sx3-amt { white-space: nowrap; }");
    expect(src("components/pay/PayMarks.tsx")).toContain('{label && <span className="py-marks-t">{label}</span>}');
  });
});

describe("handover slots (N13) and Ramadan's evenings (N36)", () => {
  const ans = { on: true, minutes: 20, days: [
    { day: "2026-11-23", slots: [{ at: "16:00", to: "16:20", open: false }, { at: "16:20", to: "16:40", open: true }] },
    { day: "2026-11-24", slots: [{ at: "21:00", to: "21:20", open: false }] },
    { day: "bad", slots: [{ at: "16:00", to: "16:20", open: true }] },
  ] };
  it("reads the database's answer, anything malformed as off", () => {
    const h = handoverOf(ans);
    expect(h.on).toBe(true);
    expect(h.days.map((d) => d.day)).toEqual(["2026-11-23", "2026-11-24"]);
    expect(handoverOf({ on: false }).on).toBe(false);
    expect(handoverOf(null).on).toBe(false);
    expect(handoverOf({ on: true, days: [] }).on).toBe(false);
    expect(openDays(h).map((d) => d.day)).toEqual(["2026-11-23"]);
  });
  it("keeps a pick only while it is offered and free", () => {
    const h = handoverOf(ans);
    expect(pickOpen(h, { day: "2026-11-23", at: "16:20" })?.to).toBe("16:40");
    expect(pickOpen(h, { day: "2026-11-23", at: "16:00" })).toBeNull();
    expect(pickOpen(h, null)).toBeNull();
    expect(handoverPickOf({ day: "2026-11-23", at: "16:20" })).toEqual({ day: "2026-11-23", at: "16:20" });
    expect(handoverPickOf({ day: "2026-11-23", at: "25:00" })).toBeNull();
  });
  it("reads store.ramadan: on, its days, 45 at most, a window or hours", () => {
    const r = ramadanOf({ "store.ramadan": { on: true, from: "2027-02-08", to: "2027-03-09", times: [{ id: "r1", from: "21:00", to: "01:00" }], hours: [{ from: "21:00", to: "01:00" }] } });
    expect(r?.times).toEqual([{ id: "r1", from: "21:00", to: "01:00" }]);
    expect(inSeason(r, "2027-02-08")).toBe(true);
    expect(inSeason(r, "2027-03-10")).toBe(false);
    expect(ramadanOf({ "store.ramadan": { on: false, from: "2027-02-08", to: "2027-03-09", times: [{ id: "r1", from: "21:00", to: "01:00" }] } })).toBeNull();
    expect(ramadanOf({ "store.ramadan": { on: true, from: "2027-01-01", to: "2027-03-09", times: [{ id: "r1", from: "21:00", to: "01:00" }] } })).toBeNull();
    expect(ramadanOf({ "store.ramadan": { on: true, from: "2027-02-08", to: "2027-03-09", times: [{ id: "r1", from: "21:00", to: "21:00" }] } })).toBeNull();
  });
  it("lets a Jeddah delivery window run past midnight, and offers Ramadan's windows only on its days", () => {
    const usual = { on: true, ahead: 6, lead: 0, skip: [5], times: [{ id: "am", from: "09:00", to: "13:00" }, { id: "eve", from: "21:00", to: "01:00" }] };
    expect(deliverySlots({ "store.slots": usual })?.times.map((t) => t.id)).toEqual(["am", "eve"]);
    const s = deliverySlots({ "store.slots": usual, "store.ramadan": { on: true, from: "2026-11-24", to: "2026-11-25", times: [{ id: "r1", from: "21:30", to: "01:30" }, { id: "am", from: "10:00", to: "12:00" }] } });
    expect(s?.season).toEqual({ from: "2026-11-24", to: "2026-11-25", ids: ["r1"] });
    expect(seasonTimes(s!, "2026-11-24").map((t) => t.id)).toEqual(["r1"]);
    expect(seasonTimes(s!, "2026-11-23").map((t) => t.id)).toEqual(["am", "eve"]);
    expect(slotTimes(s!, "2026-11-24", "2026-11-24T22:00").map((t) => t.id)).toEqual([]);
    expect(slotOk(s!, "2026-11-23", { day: "2026-11-24", time: "r1" })).toBe(true);
    expect(slotOk(s!, "2026-11-23", { day: "2026-11-24", time: "am" })).toBe(false);
    expect(slotOk(s!, "2026-11-23", { day: "2026-11-23", time: "r1" })).toBe(false);
    expect(slotDays(s!, "2026-11-23")).toContain("2026-11-24");
  });
  it("shares one route and one key with the buy box", () => {
    expect(src("app/api/store/handover/route.ts")).toContain("handoverSlots(sxSettings(content).handover");
    expect(src("components/store/sx-b3-data.ts")).toContain('rpcServer<unknown>("store_handover_slots", { p_day: day })');
    expect(src("lib/sx-b3-handover.ts")).toContain('export const HANDOVER_KEY = "mm-handover"');
  });
});

describe("a quote's link (N23)", () => {
  const raw = { state: "open", no: 12, items: [{ variant: "00000000-0000-4000-8000-0000000000A1", qty: 1 }, { variant: "nope", qty: 1 }],
    fulfil: "pickup", slot: null, handover: { day: "2026-11-24", at: "21:00" }, name: "Sara", phone: "966551234567", expires_at: "2026-11-25T10:00:00Z", order_no: null };
  it("reads the quote: its lines only while open, the mobile as 05X, the slot", () => {
    const q = quoteOf(raw)!;
    expect(q.items).toEqual([{ variant: "00000000-0000-4000-8000-0000000000a1", qty: 1 }]);
    expect(q.phone).toBe("0551234567");
    expect(q.handover).toEqual({ day: "2026-11-24", at: "21:00" });
    expect(quoteOf({ ...raw, state: "used", order_no: 77 })).toMatchObject({ state: "used", items: [], orderNo: 77 });
    expect(quoteOf({ ...raw, state: "gone" })).toBeNull();
    expect(quoteOf({ ...raw, no: 0 })).toBeNull();
  });
  it("is never kept at the edge, and opens the same checkout as /store/checkout", () => {
    expect(src("lib/page-cache.ts")).toContain("store\\/(?:cart|checkout|order|track|q)");
    const page = src("app/[locale]/store/q/[token]/page.tsx");
    expect(page).toContain('payRpc<unknown>("store_quote_get", { p_token: token })');
    expect(page).toContain("<CheckoutView");
    expect(page).toContain("noindex: true");
    expect(src("app/[locale]/store/checkout/page.tsx")).toContain("<CheckoutView");
  });
});

describe("buying for a company (N34)", () => {
  const ok = { name: "Acme Trading", vat: "300000000000003", cr: "", building: "1234", street: "King Road", district: "Rawdah", city: "Jeddah", postal: "23434" };
  it("asks for a valid VAT number and the national address a standard tax invoice carries", () => {
    expect(vatOk("300000000000003")).toBe(true);
    expect(vatOk("200000000000003")).toBe(false);
    expect(vatOk("30000000000003")).toBe(false);
    expect(companyProblems(ok)).toEqual([]);
    expect(companyProblems(EMPTY_COMPANY)).toEqual(["coName", "coVat", "coBuilding", "coStreet", "coDistrict", "coCity", "coPostal"]);
    expect(companyProblems({ ...ok, cr: "123" })).toEqual(["coCr"]);
    expect(companyBody({ ...ok, name: "  Acme   Trading " })).toEqual({ name: "Acme Trading", vat: ok.vat, cr: undefined,
      address: { building: "1234", street: "King Road", district: "Rawdah", city: "Jeddah", postal: "23434" } });
  });
  it("names the buyer on the invoice only for a whole company", () => {
    expect(buyerOf({ company: { name: "Acme", vat: "300000000000003", address: { building: "1234", street: "King Road", city: "Jeddah", postal: "23434" } } }))
      .toEqual({ name: "Acme", vat: "300000000000003", cr: "", address: "1234 King Road, Jeddah, 23434" });
    expect(buyerOf({ company: { name: "Acme", vat: "123" } })).toBeNull();
    expect(buyerOf({})).toBeNull();
    const view = src("components/store/OrderView.tsx");
    expect(view).toContain("buyer && sx ? sx.x.taxInvoice : w.taxInvoice");
    expect(view).toContain("sx.x.buyerVat");
  });
});

describe("the map pin (N07)", () => {
  it("takes a point in and around Jeddah, to five decimals", () => {
    expect(pinOk({ lat: 21.54, lng: 39.17 })).toBe(true);
    expect(pinOk({ lat: 24.7, lng: 46.7 })).toBe(false);
    expect(pinOf({ lat: 21.543312345, lng: 39.172809 })).toEqual({ lat: 21.54331, lng: 39.17281 });
    expect(pinOf({ lat: "x" })).toBeNull();
    expect(roundPin({ lat: 21.000004, lng: 39.000006 })).toEqual({ lat: 21, lng: 39.00001 });
    expect(mapsHref({ lat: 21.5, lng: 39.2 })).toBe("https://www.google.com/maps/search/?api=1&query=21.5,39.2");
  });
  it("loads MapLibre at the live map's version, which the Content-Security-Policy allows", () => {
    const v = (f: string) => src(f).match(/const MAPLIBRE = "([^"]+)"/)?.[1];
    expect(v("components/store/PinMap.tsx")).toBe(v("components/live/LiveMap.tsx"));
  });
});

describe("a session, still learning, and what checkout sends (N15, N17)", () => {
  const p = (x: Partial<StoreProduct>) => ({ id: "p", ship_ksa: true, category: "accessories", kind: "item", ...x }) as StoreProduct;
  const line = (x: Partial<StoreProduct>) => ({ item: { variant: "v", qty: 1 }, product: p(x), variant: null, unit: 1, total: 1, issue: null }) as unknown as CartLine;
  it("hands over small things only: no bike, no gift card, nothing a courier may not carry", () => {
    expect(smallOnly([line({})])).toBe(true);
    expect(smallOnly([line({}), line({ category: "bikes" })])).toBe(false);
    expect(smallOnly([line({ ship_ksa: false })])).toBe(false);
    expect(smallOnly([line({ kind: "gift_card" })])).toBe(false);
    expect(smallOnly([])).toBe(false);
  });
  it("offers the rider's own seated bookings in the window, one per session, soonest first, never a waitlist place", () => {
    const rows = [
      { id: "e1", session_id: "s1", session_date: "2026-11-28", status: "active" },
      { id: "e1b", session_id: "s1", session_date: "2026-11-28", status: "active" },
      { id: "e2", session_id: "s2", session_date: "2026-11-25", status: "waitlist" },
      { id: "e3", session_id: "s3", session_date: "2026-11-26", status: "active" },
      { id: "e4", session_id: "s4", session_date: "2026-12-30", status: "active" },
      { id: "e5", session_id: "s5", session_date: "2026-11-22", status: "active" },
    ];
    expect(sessionChoices(rows, "2026-11-23", "2026-12-12").map((c) => c.entry)).toEqual(["e3", "e1"]);
  });
  const on: SxSettings = { company: true, pin: true, learning: true, session: { on: true, days: 21 }, handover: true, giftWallet: false };
  const base = { d: EMPTY_SX, way: "pickup" as const, bike: true, small: false, quote: null, on, learnOpen: true, sessions: [{ entry: "e1" }], handoverOpen: true, seasonSlot: false };
  it("sends each part only where it applies", () => {
    expect(sxExtras(base)).toEqual({});
    expect(sxExtras({ ...base, d: { ...EMPTY_SX, handover: { day: "2026-11-23", at: "16:00" }, learning: true } }))
      .toEqual({ handover: { day: "2026-11-23", at: "16:00" }, learning: true });
    expect(sxExtras({ ...base, bike: false, small: true, d: { ...EMPTY_SX, session: "e1", handover: { day: "2026-11-23", at: "16:00" }, learning: true } }))
      .toEqual({ session: "e1" });
    expect(sxExtras({ ...base, way: "jeddah", d: { ...EMPTY_SX, pin: { lat: 21.5, lng: 39.2 }, session: "e1" }, seasonSlot: true }))
      .toEqual({ pin: { lat: 21.5, lng: 39.2 }, season: true });
    expect(sxExtras({ ...base, learnOpen: false, d: { ...EMPTY_SX, learning: true } })).toEqual({});
    expect(sxExtras({ ...base, quote: "a".repeat(32), d: { ...EMPTY_SX, buying: true } }).company?.vat).toBe("");
    expect(sxProblems({ ...EMPTY_SX, buying: true }, true)).toContain("coVat");
    expect(sxProblems({ ...EMPTY_SX, buying: true }, false)).toEqual([]);
  });
  it("reads a kept draft safely, with the buy box's slot when it had none", () => {
    expect(sxDraftOf(null, { day: "2026-11-23", at: "16:00" }).handover).toEqual({ day: "2026-11-23", at: "16:00" });
    expect(sxDraftOf({ buying: true, company: { name: "A", vat: 3 }, pin: { lat: 99, lng: 1 }, learning: "yes" })).toMatchObject({ buying: true, pin: null, learning: false });
  });
});

describe("the checkout route and the order page", () => {
  it("passes only well-formed extras, and calls store_checkout_plus only with one", () => {
    const x = extrasOf({ quote: "abc", company: { name: "Acme", vat: "300-000-000-000-003", address: { building: "12345", postal: "2343a4" } },
      pin: { lat: 21.5, lng: 39.2 }, handover: { day: "2026-11-23", at: "16:00" }, session: "e 1", learning: "true", season: true });
    expect(x.quote).toBeUndefined();
    expect(x.company).toMatchObject({ vat: "300000000000003", address: { building: "1234", postal: "23434" } });
    expect(x.session).toBeUndefined();
    expect(x.learning).toBeUndefined();
    expect(hasExtras(x)).toBe(true);
    expect(hasExtras(extrasOf({}))).toBe(false);
    const route = src("app/api/store/checkout/route.ts");
    expect(route).toContain('plus ? "store_checkout_plus" : "store_checkout"');
  });
  it("puts the database's refusals on their part", () => {
    expect(sxRefusal("STORE_HANDOVER: full")).toBe("handover");
    expect(sxRefusal("STORE_QUOTE_USED")).toBe("quote_used");
    expect(sxRefusal("STORE_STOCK: x")).toBeNull();
    expect(sxPlace("company")).toBe("coVat");
    expect(sxPlace("quote_used")).toBeNull();
  });
  it("reads an order's parts, a customer seeing only that it is pinned", () => {
    expect(orderExtrasOf({ pinned: true, handover: { day: "2026-11-23", at: "16:00", to: "16:20" }, session: { date: "2026-11-26" }, learning: true, quote_no: 4 }))
      .toEqual({ buyer: null, pinned: true, handover: { day: "2026-11-23", at: "16:00", to: "16:20" }, session: { date: "2026-11-26" }, learning: true, quoteNo: 4 });
    expect(orderExtrasOf(null)).toEqual({ buyer: null, pinned: false, handover: null, session: null, learning: false, quoteNo: null });
  });
  it("keeps every part off until its setting exists", () => {
    expect(sxSettings({})).toEqual({ company: false, pin: false, learning: false, session: { on: false, days: 21 }, handover: false, giftWallet: false });
    expect(sxSettings({ "store.company.on": true, "store.handover": { on: true }, "store.sessionHandover": { on: true, days: 7 } }))
      .toMatchObject({ company: true, handover: true, session: { on: true, days: 7 } });
  });
});

describe("an order's page with these parts (N34, N13, N15, N07, N17)", () => {
  const render = renderUntyped as (el: ReactElement) => string;
  const ROUTER = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
  const wrap = (locale: string, child: ReactNode) =>
    createElement(AppRouterContext.Provider, { value: ROUTER } as never,
      createElement(NextIntlClientProvider, { locale, messages: {} } as never, createElement(TxProvider, { locale, dict: null } as never, child)));
  const RAW = {
    id: "o1", no: 1042, status: "paid", fulfil: "pickup", name: "Huda", phone: "•••• 1234", subtotal: 8000, discount: 0, delivery_fee: 0, total: 8000,
    wallet_paid: 0, gift_paid: 0, vat: 1043.48, created_at: "2026-11-10T08:00:00Z", paid_at: "2026-11-10T08:05:00Z", invoice_no: "INV-000042", receipt_no: 77,
    discounts: [], payment: { id: "pay", status: "paid", method: "creditcard", brand: "mada", last4: "4242", receipt_no: 77, expires_at: "", amount: 8000 },
    items: [{ id: 7, name: "DA54", variant: "M", qty: 1, unit_price: 8000, product_id: "00000000-0000-4000-8000-000000000001", variant_id: null, image: null, slug: "da54" }],
    events: [{ at: "2026-11-10T08:05:00Z", status: "paid" }], returns: [], gift_cards: [], refunds: [],
    company: { name: "Acme Trading", vat: "300000000000003", cr: "1010101010", address: { building: "1234", street: "King Road", district: "Rawdah", city: "Jeddah", postal: "23434" } },
    handover: { day: "2026-11-23", at: "16:00", to: "16:20" }, pinned: false, learning: true,
  };
  const SELLER = { trade: "Micromobility", legal: "Micromobility Company Ltd.", legalBeside: "شركة التنقل الدقيق المحدودة", vat: "312555068900003", cr: "1009107240",
    address: "Jeddah", qrName: "شركة التنقل الدقيق المحدودة" };
  async function page(raw: Record<string, unknown>, locale: string) {
    const { default: OrderView } = await import("@/components/store/OrderView");
    const { OrderWayFacts } = await import("@/components/store/OrderPlus");
    const ex = orderExtrasOf(raw), x = localize(SX, locale, null);
    return render(wrap(locale, createElement(OrderView, {
      o: orderOf(raw, "a".repeat(32))!, t: localize(STORE_T, locale, null), w: localize(W5, locale, null),
      beside: locale === "ar" ? { lang: "en", t: STORE_T.en, w: W5.en } : { lang: "ar", t: STORE_T.ar, w: W5.ar },
      locale, seller: SELLER, now: Date.parse("2026-11-12T10:00:00Z"), today: "2026-11-12", whatsapp: "", showroom: "Al Sharafeyah",
      expected: null, slot: null, signup: null, returnsHref: "/returns", policy: "", hidden: [],
      sx: { buyer: ex.buyer, x, bx: locale === "ar" ? SX.en : SX.ar, way: createElement(OrderWayFacts, { e: ex, x, intl: "en-GB" }) },
    } as never)));
  }
  it("prints a company's order as a tax invoice naming the buyer, its VAT number and address, in both languages", async () => {
    const html = await page(RAW, "en");
    expect(html).toContain("Tax invoice");
    expect(html).not.toContain("Simplified tax invoice");
    expect(html).toContain("فاتورة ضريبية");
    expect(html).toContain("Acme Trading");
    expect(html).toContain("300000000000003");
    expect(html).toContain("1234 King Road, Rawdah, Jeddah, 23434");
    expect(html).toContain("Buyer&#x27;s VAT number");
    // the handover slot is said once, by B4's "Pickup on ..." line (after/AfterParts.tsx), not again in these facts
    expect(html).not.toContain("Mon 23 Nov · 16:00 – 16:20");
    const plain = await page({ ...RAW, company: null }, "en");
    expect(plain).toContain("Simplified tax invoice");
    expect(plain).not.toContain("Buyer&#x27;s VAT number");
  });
});
