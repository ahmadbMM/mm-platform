import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement, type ReactNode } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { TxProvider } from "@/i18n/TxProvider";
import { storeOf, type Store } from "../store";
import { cartLines } from "../cart";
import { paySettings } from "../pay/settings";
import { payError } from "../pay/http";
import { EMPTY_ADDRESS, refusalPlace } from "../store-form";
import { DEFAULT_SLOTS, slotDays } from "../store-settings";
import {
  buyLinesOf, checkoutMoney, checkoutProblems, dateLabel, dayLabel, digitalOnly, districtOutcome, fieldCheck, firstOpen, giftCodeOf, giftCodeOk,
  goesWithCart, hasBike, hasGiftCard, nextStep, onlyChoice, promoCodeOf, stepOfField, stepState, stepsFor, tabbyQuarter, takeOf, timeLabel, type CheckoutState,
} from "../store-checkout";

// The cart, checkout and payment page's rules (store build 2026-11-15, chain w4): checkout's steps (O12-C), the checks a
// field gets as it is left (F77), what the order costs with a starter set, a code, a gift card and the wallet (F31,
// F67, F57, F72), the scheduled day (F78), the district switch (F79), what goes with a bike (F66), buy now's lines (F35),
// the address lookup (F76) and Tabby (F84). The database decides everything again; these keep the pages saying the same.
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const product = (id: string, slug: string, x: Record<string, unknown> = {}) => ({
  id, slug, category: "accessories", brand: null, name_en: slug.toUpperCase(), name_ar: null, tagline_en: null, tagline_ar: null, description_en: null, description_ar: null,
  specs: [], images: [], price: 100, compare_at: null, ship_ksa: true, sort: 0, created_at: "2026-11-01T00:00:00Z", ...x,
});
const variant = (n: number, pid: string, x: Record<string, unknown> = {}) => ({ id: U(100 + n), product_id: pid, size: null, color_en: null, color_ar: null, color_hex: null, price: null, stock: 5, sort: n, ...x });
const BIKE = U(1), HELMET = U(2), LIGHTS = U(3), CARD = U(4), GLOVES = U(5), BOTTLE = U(6);
const STORE: Store = storeOf(
  [
    product(BIKE, "da54", { category: "bikes", price: 8000, ship_ksa: false, sort: 1, goes_with: [HELMET, LIGHTS, GLOVES, CARD, BOTTLE], bundle: { items: [HELMET], price: 8300 } }),
    product(HELMET, "helmet", { price: 450, sort: 2 }),
    product(LIGHTS, "lights", { price: 120, sort: 3 }),
    product(CARD, "gift-card", { category: "gift", kind: "gift_card", sort: 4 }),
    product(GLOVES, "gloves", { price: 90, sort: 5 }),
    product(BOTTLE, "bottle", { price: 40, sort: 6 }),
  ],
  [
    variant(1, BIKE, { size: "M", stock: 2 }), variant(2, BIKE, { size: "L", stock: 1 }),
    variant(3, HELMET, { stock: 3 }), variant(4, LIGHTS, { stock: 0 }),
    variant(5, CARD, { size: "100", price: 100, stock: 999 }), variant(6, CARD, { size: "500", price: 500, stock: 999 }),
    variant(7, GLOVES, { size: "S", stock: 2 }), variant(8, GLOVES, { size: "M", stock: 2 }), variant(9, BOTTLE, { stock: 4 }),
  ],
);
const ID = (n: number) => U(100 + n);
const settings = paySettings({
  "pay.enabled": true,
  "store.delivery": { pickup: { on: true, days: "1" }, jeddah: { on: true, fee: 30, days: "1-2" }, ksa: { on: true, fee: 45, days: "3-5" }, freeOver: 1000 },
});
const lines = (items: [number, number][]) => cartLines(items.map(([n, qty]) => ({ variant: ID(n), qty })), STORE);
const contact = { name: "Sami Rider", phone: "0501112233", email: "" };
const at = (x: Partial<CheckoutState> = {}): CheckoutState => ({
  way: "pickup", contact, address: { ...EMPTY_ADDRESS }, slot: null, slots: null, today: "2026-11-15", districts: null, ...x,
});

describe("checkout's steps (O12-C)", () => {
  it("leave out the delivery step for gift cards alone and the address for pickup", () => {
    expect(stepsFor("digital")).toEqual(["contact", "review"]);
    expect(stepsFor("pickup")).toEqual(["contact", "delivery", "review"]);
    expect(stepsFor("jeddah")).toEqual(["contact", "delivery", "address", "review"]);
    expect(digitalOnly(lines([[5, 1], [6, 2]]))).toBe(true);
    expect(digitalOnly(lines([[5, 1], [3, 1]]))).toBe(false);
    expect(hasGiftCard(lines([[5, 1], [3, 1]]))).toBe(true);
    expect(hasBike(lines([[1, 1]]))).toBe(true);
  });
  it("open on the first step with something to fix, and Continue goes to the next one not yet done", () => {
    const empty = at({ contact: { name: "", phone: "", email: "" }, way: "jeddah" });
    const p = checkoutProblems(empty);
    expect(p.slice(0, 2)).toEqual(["name", "phone"]);
    expect(firstOpen(stepsFor("jeddah"), p)).toBe("contact");
    const signedIn = checkoutProblems(at({ way: "jeddah" }));
    expect(firstOpen(stepsFor("jeddah"), signedIn)).toBe("address"); // nothing to fix in contact or delivery
    expect(firstOpen(stepsFor("pickup"), checkoutProblems(at()))).toBe("review");
    const steps = stepsFor("jeddah");
    expect(nextStep(steps, "contact", ["contact"], signedIn)).toBe("delivery");
    // editing the contact again, with delivery done: on to the address, which still needs fixing
    expect(nextStep(steps, "contact", ["contact", "delivery"], signedIn)).toBe("address");
    expect(nextStep(steps, "address", ["contact", "delivery", "address"], [])).toBe("review");
    // contact left with a mistake through Edit: it is not drawn done, and Continue on a later step goes back to it
    const noName = checkoutProblems(at({ way: "jeddah", contact: { ...contact, name: "" }, address: { ...EMPTY_ADDRESS, district: "Al Rawdah", street: "Main St" } }));
    expect(stepState("contact", "delivery", ["contact"], noName)).toBe("todo");
    expect(stepState("contact", "delivery", ["contact"], [])).toBe("done");
    expect(stepState("delivery", "delivery", [], noName)).toBe("open");
    expect(stepState("address", "delivery", [], [])).toBe("todo");
    expect(nextStep(steps, "delivery", ["contact", "delivery"], noName)).toBe("contact");
    expect(stepOfField("slot")).toBe("delivery");
    expect(stepOfField("district_unserved")).toBe("address");
    expect(stepOfField("giftCard")).toBe("review");
  });
  it("need a scheduled day and time for Jeddah while staff schedule them (F78), listed with the delivery step", () => {
    const slots = { ...DEFAULT_SLOTS, on: true };
    const day = slotDays(slots, "2026-11-15")[0];
    const a = { ...EMPTY_ADDRESS, district: "Al Rawdah", street: "Prince Sultan" };
    expect(checkoutProblems(at({ way: "jeddah", slots, address: a }))).toEqual(["slot"]);
    expect(checkoutProblems(at({ way: "jeddah", slots, address: a, slot: { day, time: "pm" } }))).toEqual([]);
    expect(checkoutProblems(at({ way: "jeddah", slots, address: a, slot: { day, time: "night" } }))).toEqual(["slot"]);
    expect(checkoutProblems(at({ way: "ksa", slots, address: { ...a, city: "Riyadh", short: "RCMA7933" } }))).toEqual([]); // the courier is not scheduled
    expect(checkoutProblems(at({ way: "jeddah", slots, contact: { ...contact, name: "" }, address: { ...EMPTY_ADDRESS } }))).toEqual(["name", "slot", "district", "street"]);
  });
  it("switch a Jeddah district the shop does not serve to collecting it (F79), or refuse it without pickup", () => {
    const list = [{ en: "Al Rawdah", ar: "الروضة" }, { en: "Al Shati", ar: null }];
    const a = (district: string) => ({ ...EMPTY_ADDRESS, district, street: "Main St" });
    expect(checkoutProblems(at({ way: "jeddah", districts: list, address: a("  al rawdah ") }))).toEqual([]);
    expect(checkoutProblems(at({ way: "jeddah", districts: list, address: a("الروضة") }))).toEqual([]);
    expect(checkoutProblems(at({ way: "jeddah", districts: list, address: a("Obhur") }))).toEqual(["district_unserved"]);
    expect(districtOutcome(list, "jeddah", "Obhur", true)).toBe("switch");
    expect(districtOutcome(list, "jeddah", "Obhur", false)).toBe("refuse");
    expect(districtOutcome(list, "ksa", "Obhur", true)).toBe("ok");
    expect(districtOutcome(null, "jeddah", "Obhur", true)).toBe("ok");
  });
});

describe("the checks as a field is left (F77)", () => {
  it("say what is wrong with a mobile number", () => {
    expect(fieldCheck("phone", "050 111 2233", "pickup")).toBeNull();
    expect(fieldCheck("phone", "٠٥٠١١١٢٢٣٣", "pickup")).toBeNull();
    expect(fieldCheck("phone", "", "pickup")).toEqual({ code: "phone" });
    expect(fieldCheck("phone", "05abc", "pickup")).toEqual({ code: "phone_chars" });
    expect(fieldCheck("phone", "0401112233", "pickup")).toEqual({ code: "phone_start" });
    expect(fieldCheck("phone", "401112233", "pickup")).toEqual({ code: "phone_start" });
    expect(fieldCheck("phone", "050111223", "pickup")).toEqual({ code: "phone_len", n: 9 });
    expect(fieldCheck("phone", "+96650111", "pickup")).toEqual({ code: "phone" });
  });
  it("say what is wrong with an email, which may be left empty", () => {
    expect(fieldCheck("email", "", "pickup")).toBeNull();
    expect(fieldCheck("email", "sami@example.com", "pickup")).toBeNull();
    expect(fieldCheck("email", "sami example.com", "pickup")).toEqual({ code: "email_space" });
    expect(fieldCheck("email", "sami.example.com", "pickup")).toEqual({ code: "email_at" });
    expect(fieldCheck("email", "sami@example", "pickup")).toEqual({ code: "email_domain" });
    expect(fieldCheck("email", "@example.com", "pickup")).toEqual({ code: "email" });
  });
  it("count the numbers of a postal code and an additional number, and read the short address's two halves", () => {
    expect(fieldCheck("postal", "", "jeddah")).toBeNull();
    expect(fieldCheck("postal", "234", "jeddah")).toEqual({ code: "postal_len", n: 3 });
    expect(fieldCheck("extra", "73831", "jeddah")).toEqual({ code: "extra_len", n: 5 });
    expect(fieldCheck("short", "", "jeddah")).toBeNull();
    expect(fieldCheck("short", "", "ksa")).toEqual({ code: "short" });
    expect(fieldCheck("short", "RCMA7933", "ksa")).toBeNull();
    expect(fieldCheck("short", "RCM7933", "ksa")).toEqual({ code: "short_letters" });
    expect(fieldCheck("short", "RCMA793", "ksa")).toEqual({ code: "short_digits" });
    expect(fieldCheck("district", "", "jeddah")).toEqual({ code: "district" });
    expect(fieldCheck("district", "", "pickup")).toBeNull();
    expect(fieldCheck("city", "", "jeddah")).toBeNull();
    expect(fieldCheck("city", "", "ksa")).toEqual({ code: "city" });
    expect(fieldCheck("name", " S ", "pickup")).toEqual({ code: "name" });
  });
});

describe("what the order costs", () => {
  it("takes a starter set's saving and a code only beside the licence, the fee on what is left (F31, F67)", () => {
    const l = lines([[1, 1], [3, 1]]); // the bike and its set's helmet: 8450, the set 8300
    const no = checkoutMoney({ lines: l, settings, way: "jeddah", licence: null, code: 500 });
    expect([no.subtotal, no.setOff, no.codeOff, no.fee, no.total]).toEqual([8450, 0, 0, 0, 8450]);
    const yes = checkoutMoney({ lines: l, settings, way: "jeddah", licence: "LIC-1", code: 500 });
    expect([yes.setOff, yes.codeOff, yes.discount, yes.total]).toEqual([150, 500, 650, 7800]);
    // under the free-delivery line once the discounts are taken
    const small = checkoutMoney({ lines: lines([[3, 2]]), settings, way: "jeddah", licence: "LIC-1", code: 50 });
    expect([small.subtotal, small.fee, small.total]).toEqual([900, 30, 880]);
    expect(checkoutMoney({ lines: lines([[3, 2]]), settings, way: "ksa", licence: "LIC-1", code: 9999 }).codeOff).toBe(900);
    expect(checkoutMoney({ lines: lines([[5, 1]]), settings, way: "digital", licence: null }).fee).toBe(0);
  });
  it("lets a gift card pay first and the wallet the rest, never leaving the card less than 1 SAR (F57, F72)", () => {
    expect(takeOf(100, 450)).toBe(100);
    expect(takeOf(449.5, 450)).toBe(449);
    expect(takeOf(900, 450)).toBe(450);
    expect(takeOf(null, 450)).toBe(0);
    const m = checkoutMoney({ lines: lines([[3, 1]]), settings, way: "pickup", licence: null, gift: 200, wallet: 1000 });
    expect([m.total, m.gift, m.wallet, m.due]).toEqual([450, 200, 250, 0]);
    const m2 = checkoutMoney({ lines: lines([[3, 1]]), settings, way: "pickup", licence: null, gift: 449.5, wallet: 0 });
    expect([m2.gift, m2.due]).toEqual([449, 1]);
  });
});

describe("the cart", () => {
  it("offers two products that go with the bike, in stock and not in the cart, never a gift card (F66)", () => {
    const l = lines([[1, 1], [9, 1]]);
    expect(goesWithCart(STORE.products, l).map((p) => p.slug)).toEqual(["helmet", "gloves"]); // lights sold out, the bottle in the cart
    expect(goesWithCart(STORE.products, lines([[3, 1]]))).toEqual([]); // no bike
    expect(goesWithCart(STORE.products, lines([[1, 1], [3, 1]])).map((p) => p.slug)).toEqual(["gloves", "bottle"]);
    // the helmet just added from the row stays in it, saying Added
    expect(goesWithCart(STORE.products, lines([[1, 1], [3, 1]]), 2, [HELMET]).map((p) => p.slug)).toEqual(["helmet", "gloves"]);
    const P = (slug: string) => STORE.products.find((p) => p.slug === slug)!;
    expect(onlyChoice(P("helmet"))?.id).toBe(ID(3));
    expect(onlyChoice(P("gloves"))).toBeNull(); // two sizes: chosen on its page
    expect(onlyChoice(P("lights"))).toBeNull(); // sold out
  });
  it("reads buy now's line with its extras, each once (F35)", () => {
    expect(buyLinesOf({ buy: ID(1).toUpperCase(), qty: "2", with: `${ID(3)},${ID(3)},${ID(1)},junk,${ID(9)}` }))
      .toEqual([{ variant: ID(1), qty: 2 }, { variant: ID(3), qty: 1 }, { variant: ID(9), qty: 1 }]);
    expect(buyLinesOf(new URLSearchParams(`buy=${ID(1)}&qty=40`))).toEqual([{ variant: ID(1), qty: 1 }]);
    expect(buyLinesOf({ buy: "nope" })).toEqual([]);
  });
  it("writes codes the way the database keeps them", () => {
    expect(giftCodeOf("gc abcd efgh jkmn")).toBe("GC-ABCD-EFGH-JKMN");
    expect(giftCodeOf("ABCDEFGHJKMN")).toBe("GC-ABCD-EFGH-JKMN");
    expect(giftCodeOk("GC-ABCD-EFGH-JKMN")).toBe(true);
    expect(giftCodeOk("GC-ABCD-EFGH-JKM0")).toBe(false); // no 0, O, 1 or I in a code
    expect(promoCodeOf(" ride 10 ")).toBe("RIDE10");
    expect(tabbyQuarter(1001)).toBe(250.25);
  });
});

describe("dates and times in the page's language", () => {
  it("write a delivery day, a slot's hours and an expiry date with Latin digits in Arabic too", () => {
    expect(dayLabel("2026-11-21", "en-GB")).toBe("Sat 21 Nov");
    expect(timeLabel({ id: "am", from: "09:00", to: "13:00" }, "en-GB")).toMatch(/^0?9:00 – 13:00$/);
    const ar = timeLabel({ id: "pm", from: "16:00", to: "21:00" }, "ar-SA-u-nu-latn-ca-gregory");
    expect(ar).toMatch(/4:00.*9:00/);
    expect(ar).not.toMatch(/[٠-٩]/);
    expect(dateLabel("2027-11-15T09:00:00Z", "en-GB")).toBe("15 Nov 2027");
    expect(dateLabel("nonsense", "en-GB")).toBe("");
  });
});

describe("the server's calls (gift cards, the address lookup, Tabby)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const db = (answers: Record<string, unknown>, others: (url: string, init?: RequestInit) => Response | null = () => null) => {
    const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); vi.stubEnv("PAY_SERVER_KEY", "k".repeat(40));
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : {}, headers: (init?.headers ?? {}) as Record<string, string> });
      const other = others(url, init);
      if (other) return other;
      const fn = url.replace(/^.*\/rpc\//, "");
      const a = answers[fn];
      return a instanceof Response ? a : new Response(JSON.stringify(a ?? null), { status: 200 });
    }));
    return calls;
  };

  it("say until when a gift card holds its balance, and an expired one as such", async () => {
    const api = await import("../store-api");
    db({ store_gift_card_check: { code: "GC-ABCD-EFGH-JKMN", balance: "120.50", expires_at: "2027-11-15T09:00:00+03:00" } });
    expect(await api.giftCardCheck("gc-abcd-efgh-jkmn")).toEqual({ ok: true, data: { code: "GC-ABCD-EFGH-JKMN", balance: 120.5, expires_at: "2027-11-15T09:00:00+03:00" } });
    db({ store_gift_card_check: new Response(JSON.stringify({ message: "STORE_GIFT_EXPIRED" }), { status: 400 }) });
    expect(await api.giftCardCheck("GC-ABCD-EFGH-JKMN")).toEqual({ ok: false, error: "gift_expired", status: 409 });
    expect(payError({ status: 400, message: "STORE_GIFT_EXPIRED: 2027-01-01" })).toEqual({ error: "gift_expired", status: 409 });
    expect(refusalPlace("gift_expired")).toEqual({ field: "giftCard" });
  });

  it("meter a code's and a gift card's checks per shopper, by the address Cloudflare saw (db addition 7)", async () => {
    const api = await import("../store-api");
    vi.stubEnv("MM_SITE_KEY", "site-key");
    const calls = db({ store_promo_check: { code: "RIDE10", kind: "percent", value: 10, discount: 45, eligible: 450 }, store_gift_card_check: { code: "GC-ABCD-EFGH-JKMN", balance: 50, expires_at: null } });
    const req = new Request("https://staging.micromobility.sa/api/store/promo", { headers: { "cf-connecting-ip": "203.0.113.7" } });
    await api.promoCheck("RIDE10", [{ variant: ID(3), qty: 1 }], req);
    await api.giftCardCheck("GC-ABCD-EFGH-JKMN", req);
    for (const c of calls) expect(new Headers(c.headers).get("x-mm-visitor-ip")).toBe("203.0.113.7");
  });

  it("ask the national address service with its key, and read its answer (F76)", async () => {
    const api = await import("../store-api");
    const env = { NATIONAL_ADDRESS_KEY: "na-key" };
    const answer = { success: true, Addresses: [{ BuildingNumber: "2979", Street: "Prince Sultan Rd", District: "Al Rawdah", City: "Jeddah", PostCode: "23435", AdditionalNumber: "7383" }] };
    const calls = db({}, (url) => (url.startsWith(api.NATIONAL_ADDRESS_URL) ? new Response(JSON.stringify(answer), { status: 200 }) : null));
    expect(await api.addressLookup("RCMA7933", true, env, "ar")).toEqual({ ok: true, data: { city: "Jeddah", district: "Al Rawdah", street: "Prince Sultan Rd", building: "2979", postal: "23435", extra: "7383" } });
    expect(calls[0].url).toContain("shortaddress=RCMA7933");
    expect(calls[0].url).toContain("language=A");
    expect(calls[0].headers.api_key).toBe("na-key");
    db({}, () => new Response(JSON.stringify({ success: true, Addresses: [] }), { status: 200 }));
    expect(await api.addressLookup("RCMA7933", true, env)).toEqual({ ok: false, error: "not_found", status: 404 });
    expect(await api.addressLookup("RCMA7933", false, env)).toEqual({ ok: false, error: "lookup_off", status: 503 });
    expect(await api.addressLookup("RCMA79", true, env)).toEqual({ ok: false, error: "invalid", status: 400 });
    expect(api.nationalAddressOf({ addresses: [{ district: "Obhur", street: "Corniche", postCode: 2345 }] })).toEqual({ city: "", district: "Obhur", street: "Corniche", building: "", postal: "", extra: "" });
  });

  const TB = { TABBY_SECRET_KEY: "sk_test_x", TABBY_PUBLIC_KEY: "pk_test_x", TABBY_MERCHANT_CODE: "MM" };
  const PAY = U(77), TID = "11111111-2222-4333-8444-555555555555";
  const view = {
    id: PAY, kind: "order", ref: U(9), amount: 400, currency: "SAR", description: "Order MM-1042", status: "initiated", hold: true, expires_at: "", paid_at: null,
    method: null, brand: null, last4: null, message: null, refunded: 0, receipt_no: null, created_at: "2026-11-15T08:00:00Z", order_no: 1042, order_key: "a".repeat(32),
    delivery_fee: 30, wallet_paid: 100, gift_paid: 0, items: [{ name: "Helmet", variant: null, qty: 1, unit_price: 470, image: "/media/store/h/1.webp" }],
    buyer: { name: "Sami Rider", phone: "966501112233", email: null }, ship: { city: "Jeddah", district: "Al Rawdah", street: "Main St", postal: "23435" },
  };

  it("open Tabby's checkout for an order still to pay, with the buyer and the part the card would pay (F84)", async () => {
    const api = await import("../store-api");
    const calls = db({ pay_view: view }, (url) => (url.endsWith("/api/v2/checkout")
      ? new Response(JSON.stringify({ id: "s1", status: "created", configuration: { available_products: { installments: [{ web_url: "https://checkout.tabby.ai/x" }] } } }), { status: 200 }) : null));
    expect(await api.tabbySession(PAY, true, TB, { origin: "https://staging.micromobility.sa", lang: "ar", showroom: "Thu Al-Nurayn St" })).toEqual({ ok: true, data: { url: "https://checkout.tabby.ai/x" } });
    const s = calls.find((c) => c.url.endsWith("/checkout"))!;
    expect(s.headers.authorization).toBe("Bearer pk_test_x");
    const pay = s.body.payment as Record<string, Record<string, unknown>>;
    expect(pay.amount).toBe("400.00");
    expect(pay.buyer).toMatchObject({ name: "Sami Rider", phone: "+966501112233" });
    expect(pay.order).toMatchObject({ reference_id: PAY, shipping_amount: "30.00", discount_amount: "100.00" });
    expect(s.body).toMatchObject({ lang: "ar", merchant_code: "MM", merchant_urls: { success: `https://staging.micromobility.sa/api/pay/tabby/return?pay=${PAY}` } });
    db({ pay_view: view }, (url) => (url.endsWith("/checkout") ? new Response(JSON.stringify({ status: "rejected" }), { status: 200 }) : null));
    expect(await api.tabbySession(PAY, true, TB)).toEqual({ ok: false, error: "tabby_rejected", status: 409 });
    db({ pay_view: { ...view, status: "paid" } });
    expect(await api.tabbySession(PAY, true, TB)).toEqual({ ok: false, error: "not_open", status: 409 });
    expect(await api.tabbySession(PAY, true, { TABBY_SECRET_KEY: "s" })).toEqual({ ok: false, error: "tabby_off", status: 503 });
  });

  it("captures an approved Tabby payment of the right amount and settles it, and closes one of another amount", async () => {
    const { tabbySettle } = await import("../pay/tabby");
    const tabby = (status: string, amount = "400.00") => (url: string, init?: RequestInit) => {
      if (url.endsWith(`/payments/${TID}`)) return new Response(JSON.stringify({ id: TID, status, amount, currency: "SAR", order: { reference_id: PAY } }), { status: 200 });
      if (url.endsWith("/captures")) return new Response(JSON.stringify({ id: TID, status: "CLOSED", amount, currency: "SAR", order: { reference_id: PAY }, captures: [{ amount: JSON.parse(String(init?.body)).amount }] }), { status: 200 });
      if (url.endsWith("/close")) return new Response(JSON.stringify({ id: TID, status: "CLOSED" }), { status: 200 });
      return null;
    };
    let calls = db({ pay_settle: { ok: true, status: "paid", refund: null } }, tabby("AUTHORIZED"));
    expect(await tabbySettle(PAY, TID, "return", view as never, TB)).toEqual({ ok: true, status: "paid", error: undefined });
    const settle = calls.find((c) => c.url.endsWith("/pay_settle"))!;
    expect(settle.body).toMatchObject({ p_pay: PAY, p_provider_id: TID, p_status: "captured", p_amount_halalas: 40000, p_currency: "SAR", p_info: { provider: "tabby" }, p_source: "return" });
    expect(calls.some((c) => c.url.endsWith("/captures") && c.headers.authorization === "Bearer sk_test_x")).toBe(true);
    calls = db({ pay_settle: { ok: true, status: "initiated", refund: null } }, tabby("AUTHORIZED", "350.00"));
    expect((await tabbySettle(PAY, TID, "webhook", view as never, TB)).error).toBe("amount");
    expect(calls.some((c) => c.url.endsWith("/close"))).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/captures"))).toBe(false);
    calls = db({}, (url) => (url.endsWith(`/payments/${TID}`) ? new Response(JSON.stringify({ id: TID, status: "AUTHORIZED", amount: "400.00", currency: "SAR", order: { reference_id: U(5) } }), { status: 200 }) : null));
    expect((await tabbySettle(PAY, TID, "return", view as never, TB)).error).toBe("metadata"); // another payment's
  });

  it("never counts a Tabby payment closed without a capture as paid, and never closes one because our own read failed", async () => {
    const { tabbySettle } = await import("../pay/tabby");
    // closed by this server (another amount, or paid another way), then its webhook: nothing was taken
    let calls = db({ pay_settle: { ok: true, status: "initiated", refund: null } }, (url) =>
      (url.endsWith(`/payments/${TID}`) ? new Response(JSON.stringify({ id: TID, status: "CLOSED", amount: "400.00", currency: "SAR", order: { reference_id: PAY }, captures: [] }), { status: 200 }) : null));
    expect(await tabbySettle(PAY, TID, "webhook", view as never, TB)).toEqual({ ok: false, status: "initiated", error: "closed" });
    const settled = calls.filter((c) => c.url.endsWith("/pay_settle")).map((c) => c.body.p_status);
    expect(settled).toEqual(["failed"]);
    // a closed payment that was captured is paid by what its captures took
    calls = db({ pay_settle: { ok: true, status: "paid", refund: null } }, (url) =>
      (url.endsWith(`/payments/${TID}`) ? new Response(JSON.stringify({ id: TID, status: "CLOSED", amount: "400.00", currency: "SAR", order: { reference_id: PAY }, captures: [{ amount: "400.00" }] }), { status: 200 }) : null));
    expect((await tabbySettle(PAY, TID, "webhook", null, TB)).ok).toBe(true);
    expect(calls.find((c) => c.url.endsWith("/pay_settle"))?.body).toMatchObject({ p_status: "captured", p_amount_halalas: 40000 });
    // approved at Tabby, but our payment could not be read: left as it is for the next try, not closed
    calls = db({}, (url) =>
      (url.endsWith(`/payments/${TID}`) ? new Response(JSON.stringify({ id: TID, status: "AUTHORIZED", amount: "400.00", currency: "SAR", order: { reference_id: PAY } }), { status: 200 }) : null));
    expect((await tabbySettle(PAY, TID, "webhook", null, TB)).error).toBe("gateway");
    expect(calls.some((c) => c.url.endsWith("/close") || c.url.endsWith("/captures") || c.url.endsWith("/pay_settle"))).toBe(false);
  });

  it("sends a refund the database answers through Tabby", async () => {
    const { tabbySettle } = await import("../pay/tabby");
    const calls = db({ pay_settle: { ok: true, status: "paid", refund: { id: U(88), provider_id: TID, amount: 400 } }, pay_refund_done: { ok: true, status: "done" } }, (url) => {
      if (url.endsWith(`/payments/${TID}`)) return new Response(JSON.stringify({ id: TID, status: "CLOSED", amount: "400.00", currency: "SAR", order: { reference_id: PAY }, captures: [{ amount: "400.00" }] }), { status: 200 });
      if (url.endsWith("/refunds")) return new Response(JSON.stringify({ id: TID, refunds: [{ amount: "400.00" }] }), { status: 200 });
      return null;
    });
    await tabbySettle(PAY, TID, "webhook", { ...view, status: "expired" } as never, TB);
    expect(calls.find((c) => c.url.endsWith("/refunds"))?.body).toEqual({ amount: "400.00", reference_id: U(88) });
    expect(calls.find((c) => c.url.endsWith("/pay_refund_done"))?.body).toMatchObject({ p_refund: U(88), p_ok: true, p_refunded_halalas: 40000 });
  });
});

const render = renderUntyped as (el: ReactElement) => string;
const wrap = (locale: string, child: ReactNode) =>
  createElement(NextIntlClientProvider, { locale, messages: {} } as never, createElement(TxProvider, { locale, dict: null } as never, child));
const src = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

describe("the pages", () => {
  it("draw the gift card page's amounts, its year of validity and Buy now, in English and Arabic (F57)", async () => {
    const { default: GiftCardBuy } = await import("@/components/store/GiftCardBuy");
    const card = STORE.products.find((p) => p.kind === "gift_card")!;
    const en = render(wrap("en", createElement(GiftCardBuy, { p: card, locale: "en", about: [], named: false })));
    expect(en).toContain("500");
    expect(en).toContain("Valid for 1 year from purchase");
    expect(en).toContain(`/store/checkout?buy=${ID(5)}&amp;qty=1`);
    expect(en).not.toMatch(/\p{Extended_Pictographic}/u);
    const ar = render(wrap("ar", createElement(GiftCardBuy, { p: card, locale: "ar", about: [], named: false })));
    expect(ar).toContain("صالحة لمدة سنة");
    expect(ar).not.toMatch(/[٠-٩]/);
    // no line under the page's heading, and a sold-out amount is never struck through (a struck amount reads as a former price)
    expect(src("app/[locale]/store/gift-card/page.tsx")).not.toContain('className="st-lead"');
    expect(src("components/store/store.css")).not.toMatch(/\.st-gc-amts button:disabled \{[^}]*line-through/);
  });
  it("write a code taken as one left-to-right unit inside an Arabic line (F67)", async () => {
    const { CodeRow } = await import("@/components/store/CheckoutBits");
    const { T: W4 } = await import("@/components/store/w4.text");
    const { T: ST } = await import("@/components/store/Store.text");
    const promo = { hit: { code: "SUMMER-25", discount: 50 }, want: "SUMMER-25", err: "", busy: false, apply: () => {}, remove: () => {} };
    const html = render(wrap("ar", createElement(CodeRow, { promo, off: 50, t: ST.ar, w: W4.ar } as never)));
    expect(html).toContain("⁦SUMMER-25⁩");
  });
  it("mark needed fields and optional ones, with no line that only helps (F74, X12)", async () => {
    const { Field } = await import("@/components/store/CheckoutFields");
    const html = render(wrap("en", createElement("div", null,
      createElement(Field, { id: "st-name", label: "Full name", required: true, requiredLabel: "required", value: "", onValue: () => {} }),
      createElement(Field, { id: "st-email", label: "Email", optional: "(optional)", value: "", onValue: () => {} }))));
    expect(html).toMatch(/Full name<span class="st-req" aria-hidden="true">\*<\/span>/);
    expect(html).toContain('aria-required="true"');
    expect(html).toContain("(optional)");
    const store = src("components/store/Store.text.ts");
    for (const line of ["No account needed", "We call you about your order", "Find it in Absher", "Bikes go by our own Jeddah delivery only"]) expect(store).not.toContain(line);
    const w4 = src("components/store/w4.text.ts");
    expect(w4).toContain('phoneDriver: "Mobile for the driver"');
  });
  it("close finished steps into what was given, with Edit (O12-C)", async () => {
    const { Step } = await import("@/components/store/CheckoutBits");
    const { T } = await import("@/components/store/w4.text");
    const done = render(wrap("en", createElement(Step, { id: "contact", n: 1, of: 4, title: "Contact", state: "done", summary: "Sami · 0501112233", onEdit: () => {}, w: T.en } as never, createElement("input", { id: "st-name" }))));
    expect(done).toContain("Sami · 0501112233");
    expect(done).toContain('aria-label="Edit: Contact"');
    expect(done).not.toContain('id="st-name"');
    const open = render(wrap("en", createElement(Step, { id: "contact", n: 1, of: 4, title: "Contact", state: "open", onEdit: () => {}, onContinue: () => {}, w: T.en } as never, createElement("input", { id: "st-name" }))));
    expect(open).toContain('id="st-name"');
    expect(open).toContain(">Continue<");
  });
  it("say the one return sentence on the payment page, with Terms and Returns beside Place order (X03, L05, L07)", () => {
    const pay = src("components/pay/Pay.text.ts");
    expect(pay).not.toContain("returned within 7 days of delivery");
    const page = src("app/[locale]/pay/[id]/page.tsx");
    expect(page).toContain("serverLocalize(POLICY, locale).returnSentence");
    expect(page).toContain('kind === "order" ? "/returns"');
    const checkout = src("app/[locale]/store/checkout/page.tsx");
    expect(checkout).toContain('returns: "/returns"');
    const form = src("components/store/CheckoutForm.tsx");
    expect(form.indexOf("st-co-legal")).toBeLessThan(form.indexOf("st-place"));
    expect(form).toContain("t.oblige");
    // A09-B: phone and code fields type and read from the left on Arabic pages
    expect(src("components/store/store.css")).toContain('[dir="rtl"] .st-field input[dir="ltr"] { text-align: left; }');
  });
});
