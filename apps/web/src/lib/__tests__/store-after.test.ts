import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TxProvider } from "@/i18n/TxProvider";
import { localize } from "@/i18n/tx";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  discountRows, eventKey, eventNote, giftState, invoiceIssued, invoiceNumber, invoiceQr, lineHref, outToday, paidParts, refundRows, returnableLines,
  returnBody, returnLines, reviewItems, riyadhDayOf, serviceShown, slotWhen, statusKey, wholeCodes,
} from "../store-after";
import { GIFT_KEYS_KEY, giftKeyFirst, giftKeyOf, MAX_GIFT_KEYS, parseGiftKeys } from "../store-lists";
import { orderOf, type Order } from "../store-order";
import { DEFAULT_SLOTS } from "../store-settings";
import { zatcaFields } from "../zatca";
import { resetSiteContent } from "../site";
import { T as STORE_T } from "../../components/store/Store.text";
import { T as W5 } from "../../components/store/w5.text";

// After the order (the store build, 2026-11-15, chain w5): what an order's page says once it is paid. Out for delivery
// today (F96), the simplified tax invoice and its ZATCA QR (L06), refunds and where they went (X09), the gift cards it
// bought (F57), a return or exchange to ask for (F93), a review of each product (F94), the workshop (F51), each line's
// own photo and address (X08); and the routes that send a return and a review to the database.
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BIKE = U(1), HELMET = U(2), CARD = U(3);
const KEY = "a".repeat(32);
const RAW = {
  id: "o1", no: 1042, status: "delivered", fulfil: "jeddah", name: "Huda", phone: "•••• 1234", address: { city: "Jeddah", district: "Al Rawdah" },
  subtotal: 8970, discount: 270, delivery_fee: 0, total: 8700, wallet_paid: 200, gift_paid: 100, vat: 1121.74,
  created_at: "2026-11-10T08:00:00Z", paid_at: "2026-11-10T08:05:00Z", invoice_no: "INV-000042", receipt_no: 77, delivered_at: "2026-11-12T15:00:00Z",
  discounts: [{ kind: "bundle", ref: "da54", amount: 270 }],
  payment: { id: "pay", status: "paid", method: "creditcard", brand: "mada", last4: "4242", receipt_no: 77, expires_at: "", amount: 8400 },
  items: [
    { id: 7, name: "DA54", variant: "M · Black", qty: 1, unit_price: 8000, product_id: BIKE, variant_id: U(101), image: "/media/store/b/1.webp", slug: "da54" },
    { id: 8, name: "Aero Helmet", variant: "M", qty: 2, unit_price: 450, product_id: HELMET, variant_id: U(102), image: null, slug: "helmet", reviewed: true },
    { id: 9, name: "Gift card", variant: "100", qty: 1, unit_price: 100, product_id: CARD, variant_id: U(103), image: null, slug: "gift-card", gift_card: true },
  ],
  events: [{ at: "2026-11-10T08:05:00Z", status: "paid" }, { at: "2026-11-12T07:00:00Z", status: "out" }, { at: "2026-11-12T15:00:00Z", status: "delivered" }],
  returns: [], gift_cards: [{ code: "GC-ABCD-EFGH-JKLM", amount: 100, balance: 100, status: "active", expires_at: "2027-11-10T08:05:00Z" }],
  refunds: [
    { amount: 450, dest: "card", status: "done", at: "2026-11-14T10:00:00Z" }, { amount: 50, dest: "wallet", status: "done", at: "2026-11-13T10:00:00Z" },
    { amount: 30, dest: "card", status: "due", at: "2026-11-14T11:00:00Z" }, { amount: 20, dest: "gift", status: "pending", at: "2026-11-15T10:00:00Z" },
  ],
};
const order = (x: Record<string, unknown> = {}): Order => orderOf({ ...RAW, ...x }, KEY)!;

describe("an order out for delivery (F96)", () => {
  it("says today on the day it went out in Riyadh, and only while it is out", () => {
    const o = order({ status: "out", events: [{ at: "2026-11-14T21:30:00Z", status: "out" }] }); // 00:30 on the 15th in Riyadh
    expect(riyadhDayOf("2026-11-14T21:30:00Z")).toBe("2026-11-15");
    expect(outToday(o, "2026-11-15")).toBe(true);
    expect(statusKey(o, "out", "2026-11-15")).toBe("outToday");
    expect(statusKey(o, "out", "2026-11-16")).toBe("out");
    expect(statusKey(order(), "out", "2026-11-12")).toBe("out"); // delivered since: a past event is never "today"
    expect(statusKey(o, "out")).toBe("out");
  });
  it("says collected for a pickup and ready to use for a gift card alone", () => {
    expect(statusKey(order({ fulfil: "pickup" }), "delivered")).toBe("collected");
    expect(statusKey(order({ fulfil: "digital" }), "delivered")).toBe("giftReady");
    expect(statusKey(order(), "delivered")).toBe("delivered");
    expect(statusKey(order(), "preparing")).toBe("preparing");
  });
});

describe("the simplified tax invoice (L06)", () => {
  it("is issued once paid, with the store's own invoice number", () => {
    const o = order();
    expect(invoiceIssued(o)).toBe(true);
    expect(invoiceNumber(o)).toBe("INV-000042");
    expect(order({ invoice_no: 5 }).invoice_no).toBe("INV-000005"); // the number alone, written the series' way
    expect(order({ invoice_no: 5, invoice: "INV-000005" }).invoice_no).toBe("INV-000005"); // as the database answers both (CONTRACTS.md db 2)
    expect(order({ invoice_no: "nonsense" }).invoice_no).toBeNull();
    expect(invoiceNumber(order({ invoice_no: null }))).toBe("77"); // a database that does not give one yet: the receipt number as before
    expect(invoiceIssued(order({ status: "pending", paid_at: null }))).toBe(false);
    expect(invoiceIssued(order({ status: "cancelled", paid_at: null }))).toBe(false);
  });
  it("carries ZATCA's QR: the seller, its VAT number, the time it was paid, the total with VAT and the VAT", () => {
    const qr = invoiceQr(order(), { name: "شركة التنقل الدقيق المحدودة", vat: "312555068900003" })!;
    expect(zatcaFields(qr)).toEqual({ 1: "شركة التنقل الدقيق المحدودة", 2: "312555068900003", 3: "2026-11-10T08:05:00Z", 4: "8700.00", 5: "1121.74" });
    expect(invoiceQr(order({ status: "pending", paid_at: null }), { name: "X", vat: "312555068900003" })).toBeNull();
    expect(invoiceQr(order(), { name: "X", vat: "31255506890000" })).toBeNull(); // not 15 digits
  });
  it("says what the gift card, the wallet and the card each paid, and each discount", () => {
    expect(paidParts(order())).toEqual({ gift: 100, wallet: 200, card: 8400 });
    expect(paidParts(order({ gift_paid: 0, wallet_paid: 9000 })).card).toBe(0);
    expect(discountRows(order())).toEqual([{ kind: "bundle", ref: "da54", amount: 270 }]);
    expect(discountRows(order({ discounts: [] }))).toEqual([{ kind: "other", ref: "", amount: 270 }]);
    expect(discountRows(order({ discounts: [], discount: 0 }))).toEqual([]);
  });
});

describe("refunds under the invoice (X09)", () => {
  it("list what was sent or done, oldest first, with where it went; one staff still owe is not shown", () => {
    expect(refundRows(order())).toEqual([
      { amount: 50, dest: "wallet", state: "done", at: "2026-11-13T10:00:00Z" },
      { amount: 450, dest: "card", state: "done", at: "2026-11-14T10:00:00Z" },
      { amount: 20, dest: "gift", state: "pending", at: "2026-11-15T10:00:00Z" },
    ]);
    expect(refundRows(order({ refunds: [{ amount: 5, dest: "none", status: "done", at: "" }] }))[0].dest).toBe("other");
  });
  it("word the history's refunds, returns and the database's own marks", () => {
    const o = order();
    expect(eventNote({ status: "refund", note: "120 SAR · wallet" })).toEqual({ kind: "refund", amount: 120, dest: "wallet" });
    expect(eventNote({ status: "refund", note: "99.5 SAR" })).toEqual({ kind: "refund", amount: 99.5, dest: "card" });
    expect(eventNote({ status: "refund", note: "10 SAR · gift card" })).toEqual({ kind: "refund", amount: 10, dest: "gift" });
    expect(eventNote({ status: "paid", note: "wallet" })).toEqual({ kind: "wallet" });
    for (const n of ["unpaid", "gift_card", "return", "exchange", null, "  "]) expect(eventNote({ status: "x", note: n })).toBeNull();
    expect(eventNote({ status: "cancelled", note: "Customer asked" })).toEqual({ kind: "text", text: "Customer asked" });
    expect(eventKey(o, { status: "return_requested", note: "exchange" })).toBe("exchange_requested");
    expect(eventKey(o, { status: "return_refused", note: "return" })).toBe("return_refused");
    expect(eventKey(order({ fulfil: "pickup" }), { status: "delivered", note: null })).toBe("collected");
    // every key the page can give has its words, in both languages
    for (const k of ["return_requested", "exchange_requested", "return_approved", "exchange_approved", "return_refused", "exchange_refused"]) {
      expect(W5.en.events[k]).toBeTruthy();
      expect(W5.ar.events[k]).toBeTruthy();
    }
  });
});

describe("the lines and the gift cards", () => {
  it("keep each line's own address (X08), a gift card's being the gift card page", () => {
    const [bike, , card] = order().items;
    expect(lineHref(bike)).toBe("/store/da54");
    expect(lineHref(card)).toBe("/store/gift-card");
    expect(lineHref({ slug: null, gift_card: false })).toBeNull();
    expect(bike.image).toBe("/media/store/b/1.webp");
  });
  it("say whether a bought gift card can still be spent: its expiry a year on, cancelled, used up (F57)", () => {
    const g = order().gift_cards[0];
    expect(g.expires_at).toBe("2027-11-10T08:05:00Z");
    expect(giftState(g, Date.parse("2026-11-15T00:00:00Z"))).toBe("active");
    expect(giftState(g, Date.parse("2027-11-10T08:05:00Z"))).toBe("expired");
    expect(giftState({ ...g, status: "void" }, 0)).toBe("void");
    expect(giftState({ ...g, balance: 0 }, 0)).toBe("spent");
    expect(giftState({ ...g, expires_at: null }, Date.parse("2040-01-01"))).toBe("active");
  });
  it("give a scheduled delivery its day and hours (F78), only for Jeddah", () => {
    expect(slotWhen(order({ slot: { day: "2026-11-16", time: "am" } }), null)).toEqual({ day: "2026-11-16", from: "09:00", to: "13:00" });
    expect(slotWhen(order({ slot: { day: "2026-11-16", time: "eve" } }), { ...DEFAULT_SLOTS, on: true, times: [{ id: "eve", from: "18:00", to: "22:00" }] }))
      .toEqual({ day: "2026-11-16", from: "18:00", to: "22:00" });
    expect(slotWhen(order({ slot: { day: "2026-11-16", time: "zz" } }), null)).toEqual({ day: "2026-11-16", from: null, to: null });
    expect(slotWhen(order({ fulfil: "ksa", slot: { day: "2026-11-16", time: "am" } }), null)).toBeNull();
    expect(slotWhen(order(), null)).toBeNull();
  });
  it("offer the workshop on a paid order of goods while its page is on (F51)", () => {
    expect(serviceShown(order(), [])).toBe(true);
    expect(serviceShown(order(), ["workshop"])).toBe(false);
    expect(serviceShown(order({ fulfil: "digital" }), [])).toBe(false);
    expect(serviceShown(order({ status: "pending" }), [])).toBe(false);
    expect(serviceShown(order({ status: "cancelled" }), [])).toBe(false);
  });
});

describe("a return or an exchange (F93)", () => {
  it("names the lines that are not gift cards, each up to what a return did not take back yet", () => {
    const o = order({ returns: [{ id: "r1", kind: "return", status: "approved", items: [{ item_id: 8, qty: 1 }], reason: "wrong_size", created_at: "" },
      { id: "r2", kind: "exchange", status: "approved", items: [{ item_id: 7, qty: 1 }], reason: "wrong_size", created_at: "" }] });
    expect(returnableLines(o).map((l) => [l.id, l.max])).toEqual([[7, 1], [8, 1]]);
    expect(returnableLines(order({ items: [RAW.items[2]] }))).toEqual([]);
  });
  it("sends a kind, the lines and a reason, the quantities kept within what each line can take", () => {
    const o = order();
    const a = { no: o.no, key: o.key, lines: returnableLines(o) };
    const pick = { kind: "return" as const, items: { 7: 1, 8: 5, 9: 1 }, reason: "damaged" as const, note: "  the box was crushed " };
    expect(returnBody(a, pick)).toEqual({ no: 1042, key: KEY, kind: "return", items: [{ item: 7, qty: 1 }, { item: 8, qty: 2 }], reason: "damaged", note: "the box was crushed" });
    expect(returnBody(a, { ...pick, reason: null })).toBeNull();
    expect(returnBody(a, { ...pick, kind: null })).toBeNull();
    expect(returnBody(a, { ...pick, items: { 7: 0 } })).toBeNull();
    expect(returnBody({ ...a, key: null }, pick)).toBeNull();
  });
  it("shows which kind is asked for even when only one is left (after the 7 days, an exchange)", () => {
    const src = readFileSync(fileURLToPath(new URL("../../components/store/OrderAfter.tsx", import.meta.url)), "utf8");
    expect(src).toContain("{kinds.length > 0 && (\n              <fieldset className=\"st-ways-pick st-ret-kind\">");
    expect(src).not.toContain("kinds.length > 1 &&");
  });
  it("lists a request's lines in words", () => {
    expect(returnLines(order(), { items: [{ item_id: 7, qty: 1 }, { item_id: 99, qty: 1 }] })).toEqual(["DA54 · M · Black × 1"]);
  });
});

describe("a review of what was bought (F94)", () => {
  it("is asked once delivered, once per product not yet reviewed, never of a gift card", () => {
    expect(reviewItems(order())).toEqual([{ product: BIKE, name: "DA54", image: "/media/store/b/1.webp" }]);
    expect(reviewItems(order({ status: "out" }))).toEqual([]);
  });
});

// ── The page as the server draws it ───────────────────────────────────────────────────────────

const render = renderUntyped as (el: ReactElement) => string;
// the return pop-up refreshes the page once a request is sent (useRouter): a router for it to find
const ROUTER = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
const wrap = (locale: string, child: ReactNode) =>
  createElement(AppRouterContext.Provider, { value: ROUTER } as never,
    createElement(NextIntlClientProvider, { locale, messages: {} } as never, createElement(TxProvider, { locale, dict: null } as never, child)));
const SELLER = { trade: "Micromobility", legal: "Micromobility Company Ltd.", legalBeside: "شركة التنقل الدقيق المحدودة", vat: "312555068900003", cr: "1009107240",
  address: "Thu Al-Nurayn St, Al Sharafeyah, Jeddah", qrName: "شركة التنقل الدقيق المحدودة" };
async function page(o: Order, locale: string, x: Record<string, unknown> = {}) {
  const { default: OrderView } = await import("@/components/store/OrderView");
  return render(wrap(locale, createElement(OrderView, {
    o, t: localize(STORE_T, locale, null), w: localize(W5, locale, null), beside: locale === "ar" ? { lang: "en", t: STORE_T.en, w: W5.en } : { lang: "ar", t: STORE_T.ar, w: W5.ar },
    locale, seller: SELLER, now: Date.parse("2026-11-25T10:00:00Z"), today: "2026-11-25", whatsapp: "966566668818", showroom: "Al Sharafeyah",
    expected: null, slot: null, signup: null, returnsHref: "/returns", policy: "Return within 7 days or exchange within 15 days of receiving it.", hidden: [], ...x,
  })));
}

describe("the order's page", () => {
  it("draws the simplified tax invoice with its number, the seller's address and numbers, the QR and the Arabic beside the English", async () => {
    const html = await page(order(), "en");
    expect(html).toContain("Simplified tax invoice");
    expect(html).toContain("فاتورة ضريبية مبسطة");
    expect(html).toContain("INV-000042");
    expect(html).toContain("رقم الفاتورة");
    expect(html).toContain("Thu Al-Nurayn St");
    expect(html).toContain("312555068900003");
    expect(html).toMatch(/<span class="st-zqr"><svg role="img" aria-label="The invoice&#x27;s ZATCA QR code"/);
    expect(html).toContain("Paid with a gift card");
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    // day 13 after it was delivered: past the 7 days to return, within the 15 to exchange
    expect(html).toContain("Return an item");
    expect(await page(order(), "en", { now: Date.parse("2026-11-28T10:00:00Z") })).not.toContain("Return an item");
    const ar = await page(order(), "ar");
    expect(ar).toContain("Simplified tax invoice"); // English beside the Arabic
    expect(ar).toContain("الإجمالي شامل الضريبة");
  });
  it("calls an unpaid order a summary: no invoice number, no QR, no second language", async () => {
    const html = await page(order({ status: "pending", paid_at: null, invoice_no: null, receipt_no: null, payment: null }), "en");
    expect(html).toContain("Order summary");
    expect(html).not.toContain("st-zqr");
    expect(html).not.toContain("فاتورة");
  });
  it("lists every refund under the invoice, where it went and whether it is done (X09)", async () => {
    const html = await page(order(), "en");
    expect(html).toContain("Refund to your card");
    expect(html).toContain("Refund to your wallet");
    expect(html).toContain("Refund to your gift card");
    expect(html).toContain("On its way");
  });
  it("shows the gift cards it bought with their code, expiry and Print gift card (F57)", async () => {
    const html = await page(order(), "en");
    expect(html).toContain("GC-ABCD-EFGH-JKLM");
    expect(html).toMatch(/Valid until 10 Nov 2027/);
    expect(html).toContain("Print gift card");
    expect(html).toContain('id="st-ogc-1"');
    // its own class names: the gift card page's (w4: .st-gc, .st-gc-card in the same store.css) never style it
    expect(html).toContain('class="st-ogc g-active"');
    expect(html).not.toMatch(/class="[^"]*\bst-gc/);
  });
  it("shows a masked code as the database gave it, with its amount, balance and expiry, and nothing to copy or print", async () => {
    const masked = (x: Record<string, unknown> = {}) =>
      order({ gift_cards: [{ code: "GC-••••-••••-JKLM", masked: true, amount: 100, balance: 60, status: "active", expires_at: "2027-11-10T08:05:00Z", ...x }] });
    const html = await page(masked(), "en");
    expect(html).toContain("GC-••••-••••-JKLM");
    expect(html).not.toContain("GC-ABCD-EFGH-JKLM");
    expect(html).toMatch(/Valid until 10 Nov 2027/);
    expect(html).toMatch(/<p class="st-ogc-bal">[^<]*<[^>]+>[^<]*60/); // what is left on it
    expect(html).not.toContain("Print gift card");
    expect(html).not.toContain('class="st-ogc-acts"');
    expect(html).toContain('class="st-ogc g-active"');
    expect(await page(masked({ status: "void" }), "en")).toContain("GC-••••-••••-JKLM"); // a cancelled card says so, masked
    // the whole code (the account that placed it read it so): Copy and Print gift card
    const whole = await page(order(), "en");
    expect(whole).toContain('class="st-ogc-acts"');
    expect(whole).toContain("Print gift card");
  });
  it("says the booked delivery day only while the order is still to come (F78)", async () => {
    const o = (status: string) => order({ status, slot: { day: "2026-11-27", time: "am" }, delivered_at: null, events: [] });
    const slot = "Thu 27 Nov, 09:00–13:00";
    for (const st of ["pending", "paid", "preparing", "shipped"]) expect(await page(o(st), "en", { slot }), st).toContain(`Delivery on ${slot}`);
    for (const st of ["delivered", "cancelled", "refunded"]) expect(await page(o(st), "en", { slot }), st).not.toContain("Delivery on");
  });
  it("keeps a code and a Latin model name in their own order inside Arabic words", async () => {
    const ar = await page(order({ discounts: [{ kind: "promo", ref: "WELCOME-10", amount: 270 }], promo_code: "WELCOME-10" }), "ar");
    expect(ar).toContain("الرمز \u2066WELCOME-10\u2069");
    expect(ar).toContain("Code \u2066WELCOME-10\u2069"); // the English beside it, the same
    const o = order({ returns: [{ id: "r1", kind: "return", status: "open", items: [{ item_id: 7, qty: 1 }], reason: "wrong_size", created_at: "2026-11-13T10:00:00Z" }] });
    expect(await page(o, "ar")).toContain("<bdi>DA54 · M · Black × 1</bdi> · المقاس غير مناسب");
  });
  it("asks for a review of each product once delivered, with five drawn stars and a text box (F94)", async () => {
    const html = await page(order(), "en");
    expect(html).toContain("How was it?");
    expect(html.match(new RegExp(`name="st-rv-${BIKE}"`, "g"))).toHaveLength(5); // the whole id: no two products share a group
    expect(html).toContain("5 out of 5");
    expect(html).toContain("Send review");
    expect(await page(order({ status: "out" }), "en")).not.toContain("How was it?");
  });
  it("says out for delivery today on its day (F96), and offers the workshop (F51)", async () => {
    const o = order({ status: "out", delivered_at: null, events: [{ at: "2026-11-25T06:00:00Z", status: "out" }] });
    const html = await page(o, "en");
    expect(html).toContain("Out for delivery today");
    expect(html).toContain('href="/workshop"');
    expect(html).toContain("Book a Service");
    expect(await page(o, "en", { today: "2026-11-26" })).not.toContain("Out for delivery today");
    expect(await page(o, "en", { hidden: ["workshop"] })).not.toContain('href="/workshop"');
  });
  it("lists the returns asked for, and links the Returns page whatever the Help page's switch", async () => {
    const o = order({ returns: [{ id: "r1", kind: "exchange", status: "open", items: [{ item_id: 7, qty: 1 }], reason: "wrong_size", created_at: "2026-11-13T10:00:00Z" }] });
    const html = await page(o, "en");
    expect(html).toContain("Exchange requested on 13 Nov 2026");
    expect(html).toContain("<bdi>DA54 · M · Black × 1</bdi> · Wrong size");
    expect(html).toContain('href="/returns"');
    expect(html).not.toContain("Return an item"); // a request is open
  });
});

// ── The routes ───────────────────────────────────────────────────────────────────────────────

describe("the after-the-order routes", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetSiteContent(); });
  const calls: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
  const db = (status: number, answer: unknown) => {
    calls.length = 0;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); vi.stubEnv("PAY_SERVER_KEY", "k".repeat(40));
    vi.stubEnv("MOYASAR_PUBLISHABLE_KEY", "pk_test_x"); vi.stubEnv("MOYASAR_SECRET_KEY", "sk_test_x");
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")), auth: new Headers(init?.headers).get("authorization") });
      return new Response(JSON.stringify(typeof answer === "function" ? (answer as (u: string) => unknown)(url) : answer), { status });
    }));
  };
  const post = (path: string, body: unknown, headers: Record<string, string> = { origin: "https://staging.micromobility.sa" }) =>
    new Request(`https://staging.micromobility.sa${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

  it("send a return to the database with the order's number and key, and answer the order", async () => {
    const { POST } = await import("../../app/api/store/return/route");
    db(200, { ...RAW, returns: [{ id: "r1", kind: "return", status: "open", items: [{ item_id: 7, qty: 1 }], reason: "damaged", created_at: "2026-11-15T09:00:00Z" }] });
    const res = await POST(post("/api/store/return", { no: 1042, key: KEY, kind: "return", items: [{ item: 7, qty: 1 }], reason: "damaged", note: "crushed" }));
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.ok).toBe(true);
    expect(b.order.returns[0].id).toBe("r1");
    expect(calls[0].url).toMatch(/\/rpc\/store_return_request$/);
    expect(calls[0].body).toEqual({ p_key: "k".repeat(40), p_no: 1042, p_track: KEY, p_kind: "return", p_items: [{ item_id: 7, qty: 1 }], p_reason: "damaged", p_note: "crushed" });
    db(400, { message: "STORE_RETURN_WINDOW" });
    const late = await POST(post("/api/store/return", { no: 1042, key: KEY, kind: "return", items: [{ item: 7, qty: 1 }], reason: "damaged" }));
    expect([late.status, (await late.json()).error]).toEqual([409, "return_window"]);
    db(200, {});
    expect((await POST(post("/api/store/return", { no: 1042, key: "short", kind: "return", items: [], reason: "damaged" }))).status).toBe(400);
    expect((await (await POST(post("/api/store/return", { no: 1042, key: KEY, kind: "return", items: [{ item: 7, qty: 1 }], reason: "bored" }))).json()).error).toBe("return_items");
    expect((await POST(post("/api/store/return", { no: 1042, key: KEY, kind: "return", items: [], reason: "damaged" }, { origin: "https://evil.test" }))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("send a review with its stars, and answer only ok", async () => {
    const { POST } = await import("../../app/api/store/review/route");
    db(200, { id: U(60) });
    const res = await POST(post("/api/store/review", { no: 1042, key: KEY, product: BIKE, rating: 5, body: " Great bike ", lang: "en" }));
    expect(await res.json()).toEqual({ ok: true });
    expect(calls[0].url).toMatch(/\/rpc\/store_review_add$/);
    expect(calls[0].body).toEqual({ p_key: "k".repeat(40), p_no: 1042, p_track: KEY, p_product: BIKE, p_rating: 5, p_body: "Great bike", p_lang: "en" });
    db(400, { message: "STORE_REVIEW_DONE" });
    expect((await (await POST(post("/api/store/review", { no: 1042, key: KEY, product: BIKE, rating: 4 }))).json()).error).toBe("review_done");
    db(200, {});
    expect((await POST(post("/api/store/review", { no: 1042, key: KEY, product: BIKE, rating: 0 }))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("read a gift card's whole codes with the order's number, key and gift key, and nothing without all three", async () => {
    const { POST } = await import("../../app/api/store/gift-codes/route");
    const GIFT = "b".repeat(32);
    db(200, RAW);
    const res = await POST(post("/api/store/gift-codes", { no: 1042, key: KEY, gift: GIFT }));
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b).toEqual({ ok: true, cards: [{ code: "GC-ABCD-EFGH-JKLM", amount: 100, balance: 100, status: "active", expires_at: "2027-11-10T08:05:00Z", masked: false }] });
    expect(calls[0].url).toMatch(/\/rpc\/store_order_get$/);
    expect(calls[0].body).toEqual({ p_key: "k".repeat(40), p_no: 1042, p_track: KEY, p_gift: GIFT });
    // a wrong gift key: the database masks them, and so does the answer
    db(200, { ...RAW, gift_cards: [{ code: "GC-••••-••••-JKLM", masked: true, amount: 100, balance: 100, status: "active" }] });
    expect((await (await POST(post("/api/store/gift-codes", { no: 1042, key: KEY, gift: GIFT }))).json()).cards[0]).toMatchObject({ code: "GC-••••-••••-JKLM", masked: true });
    db(200, null); // no order with that number and key
    const none = await POST(post("/api/store/gift-codes", { no: 1042, key: KEY, gift: GIFT }));
    expect([none.status, (await none.json()).error]).toEqual([404, "not_found"]);
    db(200, RAW);
    for (const bad of [{ no: 1042, key: KEY }, { no: 1042, key: KEY, gift: "short" }, { no: 1042, key: "short", gift: GIFT }, { no: 0, key: KEY, gift: GIFT }]) {
      expect((await POST(post("/api/store/gift-codes", bad))).status).toBe(400);
    }
    expect((await POST(post("/api/store/gift-codes", { no: 1042, key: KEY, gift: GIFT }, { origin: "https://evil.test" }))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("give the checkout's browser the gift key of an order that buys gift cards, and no other", async () => {
    const { POST } = await import("../../app/api/store/checkout/route");
    const body = { items: [{ variant: U(103), qty: 1 }], fulfil: "digital", contact: { name: "Huda", phone: "0551234567" }, lang: "en" };
    db(200, { order: { id: "o1", no: 1042, status: "pending", total: 100 }, key: KEY, payment: { id: U(70) }, gift_key: "c".repeat(32) });
    expect(await (await POST(post("/api/store/checkout", body))).json()).toEqual({ ok: true, no: 1042, key: KEY, url: `/pay/${U(70)}`, giftKey: "c".repeat(32) });
    db(200, { order: { id: "o1", no: 1043, status: "paid", total: 100 }, key: KEY, payment: null, gift_key: null });
    expect(await (await POST(post("/api/store/checkout", body))).json()).toEqual({ ok: true, no: 1043, key: KEY, url: `/store/order/1043?k=${KEY}` });
    db(200, { order: { id: "o1", no: 1044, status: "paid", total: 100 }, key: KEY, payment: null, gift_key: "<script>" });
    expect((await (await POST(post("/api/store/checkout", body))).json()).giftKey).toBeUndefined();
  });

  it("make no SMSA label while the switch is off or without SMSA's key, and only for staff from the staff page", async () => {
    const { POST } = await import("../../app/api/store/smsa-label/route");
    const staff = { origin: "https://staff-staging.micromobility.sa", authorization: `Bearer ${"j".repeat(40)}` };
    db(200, []); // site_content: nothing set, so the switch is off
    const off = await POST(post("/api/store/smsa-label", { order: U(9) }, staff));
    expect([off.status, (await off.json()).error]).toEqual([503, "smsa_off"]);
    expect((await POST(post("/api/store/smsa-label", { order: U(9) }))).status).toBe(403); // not the staff page
    resetSiteContent();
    db(200, (url: string) => (url.includes("site_content") ? [{ key: "store.smsa.on", value: true }] : [{ id: U(9), status: "paid", fulfil: "ksa" }]));
    const noKey = await POST(post("/api/store/smsa-label", { order: U(9) }, staff));
    expect([noKey.status, (await noKey.json()).error]).toEqual([503, "smsa_off"]);
    expect(calls.find((c) => c.url.includes("store_orders"))?.auth).toBe(`Bearer ${"j".repeat(40)}`); // read with the staff session
    expect(calls.some((c) => c.url.includes("staff_store_order_set"))).toBe(false);
    resetSiteContent();
    db(200, (url: string) => (url.includes("site_content") ? [{ key: "store.smsa.on", value: true }] : [{ id: U(9), status: "paid", fulfil: "jeddah" }]));
    expect((await (await POST(post("/api/store/smsa-label", { order: U(9) }, staff))).json()).error).toBe("state");
  });
});

// ── Close my account (L13) ────────────────────────────────────────────────────────────────────

describe("closing the account (L13)", () => {
  const src = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
  it("is in My Account: the existing deletion request, asked in a centred confirmation", () => {
    const pageSrc = src("../../app/[locale]/account/[[...part]]/page.tsx");
    expect(pageSrc).toMatch(/<DeleteAccount locale=\{locale\} requestedAt=\{extras\.deletion\.requestedAt\} \/>/);
    const del = src("../../components/account/DeleteAccount.tsx");
    expect(del).toContain('"/api/account/deletion"');
    expect(del).toContain("showModal()"); // a modal <dialog>, centred (account.css: margin auto)
    expect(src("../../components/account/account.css")).toMatch(/dialog\.ac-dlg \{[^}]*margin: auto/);
    expect(src("../../app/api/account/deletion/route.ts")).toContain('"customer_deletion_request"');
  });
});

// ── Gift card codes stay with the buyer (CONTRACTS.md Additions by lead: gift card codes) ──────────

describe("gift card codes stay with the buyer", () => {
  const src = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
  it("reads a masked code as masked, whether the database says so or only masks it", () => {
    const card = { amount: 100, balance: 100, status: "active", expires_at: null };
    expect(order({ gift_cards: [{ ...card, code: "GC-••••-••••-JKLM", masked: true }] }).gift_cards[0].masked).toBe(true);
    expect(order({ gift_cards: [{ ...card, code: "GC-••••-••••-JKLM" }] }).gift_cards[0].masked).toBe(true);
    expect(order({ gift_cards: [{ ...card, code: "GC-ABCD-EFGH-JKLM", masked: false }] }).gift_cards[0].masked).toBe(false);
    expect(order().gift_cards[0].masked).toBe(false); // a database before the fix
  });
  it("shows a whole code only where the buyer's read gave the same card whole", () => {
    const m = (code: string, amount = 100) => ({ code, masked: true, amount });
    const w = (code: string, amount = 100) => ({ code, masked: false, amount });
    expect(wholeCodes([m("GC-••••-••••-JKLM"), m("GC-••••-••••-MNPQ", 50)], null)).toEqual([null, null]);
    expect(wholeCodes([m("GC-••••-••••-JKLM"), m("GC-••••-••••-MNPQ", 50)], [w("GC-ABCD-EFGH-JKLM"), w("GC-RSTU-VWXY-MNPQ", 50)]))
      .toEqual(["GC-ABCD-EFGH-JKLM", "GC-RSTU-VWXY-MNPQ"]);
    expect(wholeCodes([m("GC-••••-••••-JKLM")], [m("GC-••••-••••-JKLM")])).toEqual([null]); // a wrong gift key: masked again
    expect(wholeCodes([m("GC-••••-••••-JKLM")], [w("GC-ABCD-EFGH-ZZZZ")])).toEqual([null]); // another card
    expect(wholeCodes([m("GC-••••-••••-JKLM")], [w("GC-ABCD-EFGH-JKLM", 50)])).toEqual([null]);
    expect(wholeCodes([m("GC-••••-••••-JKLM"), m("GC-••••-••••-MNPQ")], [w("GC-ABCD-EFGH-JKLM")])).toEqual(["GC-ABCD-EFGH-JKLM", null]);
    expect(wholeCodes([w("GC-ABCD-EFGH-JKLM")], null)).toEqual(["GC-ABCD-EFGH-JKLM"]); // read whole already (the account's own)
  });
  it("keeps each order's gift key in this browser, newest first, one per order, 20 at most", () => {
    const k = (c: string) => c.repeat(32);
    expect(GIFT_KEYS_KEY).toBe("mm-gift-keys");
    expect(parseGiftKeys(JSON.stringify([{ no: 7, key: k("a") }, { no: 7, key: k("b") }, { no: 8, key: "short" }, { no: -1, key: k("c") }, { no: 9, key: k("D") }, null, "x"])))
      .toEqual([{ no: 7, key: k("a") }, { no: 9, key: k("d") }]);
    expect(parseGiftKeys("not json")).toEqual([]);
    expect(parseGiftKeys({ no: 7, key: k("a") })).toEqual([]);
    const list = giftKeyFirst(giftKeyFirst([], 7, k("a")), 8, k("b"));
    expect(list).toEqual([{ no: 8, key: k("b") }, { no: 7, key: k("a") }]);
    expect(giftKeyFirst(list, 7, k("c"))).toEqual([{ no: 7, key: k("c") }, { no: 8, key: k("b") }]);
    expect(giftKeyFirst(list, 9, "nope")).toEqual(list);
    expect(giftKeyOf(list, 7)).toBe(k("a"));
    expect(giftKeyOf(list, 10)).toBeNull();
    let many: { no: number; key: string }[] = [];
    for (let i = 1; i <= 25; i++) many = giftKeyFirst(many, i, k("e"));
    expect(many).toHaveLength(MAX_GIFT_KEYS);
    expect(many[0].no).toBe(25);
  });
  it("is kept by the checkout, asked for by the order's page, and read for the account that placed the order", () => {
    const checkout = src("../../components/store/CheckoutForm.tsx");
    expect(checkout).toContain("giftKeyKeep(b.no, b.giftKey)");
    const after = src("../../components/store/OrderAfter.tsx");
    expect(after).toContain('post("/api/store/gift-codes", { no, key: k, gift })');
    expect(after).toContain("giftKeyFor(no)");
    const pageSrc = src("../../app/[locale]/store/order/[no]/page.tsx");
    expect(pageSrc).toContain('rpcServer<unknown>("customer_orders", { p_id: acct.id, p_token: acct.token })');
    expect(pageSrc).toContain("read.gift_cards.some((g) => g.masked)");
  });
});
