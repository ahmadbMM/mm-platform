import { afterEach, describe, expect, it, vi } from "vitest";
import {
  categoriesIn, discountLicence, findProduct, loadStore, optionOpen, optionsOf, pickVariant, priceRange, productStock, resetStore, sar, sortProducts, specRows,
  stockState, storeOf, storeOpen, variantLabel, vatIn, type Store,
} from "../store";
import { orderExpected, orderNo, orderOf, orderSteps, paidWith, payable, reportable, unpaidCancel } from "../store-order";
import { addItem, cartCount, cartLines, parseCart, priceFrom, removeItem, setItemQty, shipsKsa, subtotalOf } from "../cart";
import { daysOf, deliveryOptions, deliveryRange, fmtRange, freeProgress, riyadhToday, workingDay } from "../store-delivery";
import { checkoutBody, digitsOnly, EMPTY_ADDRESS, formProblems, latinDigits, refusalPlace, shortAddress, storePhone } from "../store-form";
import { memoSettled } from "../memo";
import { paySettings } from "../pay/settings";

// The online store's own rules (lib/store.ts, cart.ts, store-delivery.ts, store-form.ts): what the pages show
// and what they send. The database prices and checks every order itself; these keep the pages saying the same.
const V = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const variant = (n: number, pid: string, x: Record<string, unknown> = {}) => ({ id: V(n), product_id: pid, size: null, color_en: null, color_ar: null, color_hex: null, price: null, stock: 5, sort: n, ...x });
const product = (id: string, slug: string, x: Record<string, unknown> = {}) => ({
  id, slug, category: "accessories", brand: "Garmin", name_en: slug.toUpperCase(), name_ar: null, tagline_en: null, tagline_ar: null, description_en: null, description_ar: null,
  specs: [], images: [], price: 100, compare_at: null, ship_ksa: true, sort: 0, created_at: "2026-11-01T00:00:00Z", ...x,
});

const STORE: Store = storeOf(
  [
    product("p-bike", "da54", { category: "bikes", price: 8435, ship_ksa: false, sort: 1, name_ar: "دي إيه 54", specs: [{ en: ["Frame", "Carbon"], ar: ["الإطار", "كربون"] }, { en: ["Weight", "8.4 kg"] }] }),
    product("p-helmet", "helmet", { price: 520, sort: 2, created_at: "2026-11-05T00:00:00Z" }),
    product("p-cap", "cap", { category: "apparel", price: 120, sort: 3 }),
    product("p-gone", "gone", { category: "nutrition", price: 30, sort: 4 }),
  ],
  [
    variant(1, "p-bike", { size: "M", stock: 2 }),
    variant(2, "p-bike", { size: "L", stock: 0, price: 8935 }),
    variant(3, "p-helmet", { size: "M", color_en: "Black", color_ar: "أسود", color_hex: "#111111", stock: 9 }),
    variant(4, "p-cap", { stock: 1 }),
    variant(5, "p-gone", { stock: 0 }),
  ],
);

describe("the store's rows", () => {
  it("become products with their variants; a row the pages could not draw is left out", () => {
    const s = storeOf([product("a", "ok"), product("b", "bad", { category: "service" }), product("c", "", {}), product("d", "free", { price: 0 })], [variant(9, "a", { price: "45.5" }), variant(10, "a", { price: -1 })]);
    expect(s.products.map((p) => p.slug)).toEqual(["ok"]);
    expect(s.products[0].variants.map((v) => v.price)).toEqual([45.5]);
  });
  it("keep a former price only when it is higher, images only from this site or https", () => {
    const s = storeOf([product("a", "x", { compare_at: 90, images: ["/site/store/x/1.webp", "javascript:alert(1)", "https://cdn.example/a.jpg"] }), product("b", "y", { compare_at: 150 })], []);
    expect(s.products[0].compare_at).toBeNull();
    expect(s.products[0].images).toEqual(["/site/store/x/1.webp", "https://cdn.example/a.jpg"]);
    expect(s.products[1].compare_at).toBe(150);
  });
  it("are read published and active only, and kept for a minute", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    const urls: string[] = [];
    const f = vi.fn(async (u: string) => {
      urls.push(u);
      return new Response(JSON.stringify(u.includes("store_products") ? [product("a", "x")] : [variant(1, "a")]), { status: 200 });
    }) as unknown as typeof fetch;
    const s = await loadStore(f, 1_000);
    expect(s?.products[0].variants).toHaveLength(1);
    expect(urls.find((u) => u.includes("store_products"))).toContain("published=is.true");
    expect(urls.find((u) => u.includes("store_variants"))).toContain("active=is.true");
    await loadStore(f, 30_000);
    await memoSettled();
    expect(f).toHaveBeenCalledTimes(2);
  });
  afterEach(() => { resetStore(); vi.unstubAllEnvs(); });
});

describe("a product", () => {
  const bike = findProduct(STORE, "da54")!, helmet = findProduct(STORE, "helmet")!, cap = findProduct(STORE, "cap")!, gone = findProduct(STORE, "gone")!;
  it("costs its variants' prices, a variant without one the product's", () => {
    expect(priceRange(bike)).toEqual({ lo: 8435, hi: 8935 });
    expect(priceFrom(bike)).toBe(true);
    expect(priceFrom(helmet)).toBe(false);
  });
  it("is sold out at 0, low at 1 to 3", () => {
    expect(stockState(0)).toEqual({ kind: "out" });
    expect(stockState(3)).toEqual({ kind: "low", left: 3 });
    expect(stockState(4)).toEqual({ kind: "in" });
    expect(productStock(bike)).toEqual({ kind: "low", left: 2 });
    expect(productStock(cap)).toEqual({ kind: "low", left: 1 });
    expect(productStock(gone)).toEqual({ kind: "out" });
  });
  it("names its variant and specifications in the page's language", () => {
    expect(variantLabel(helmet.variants[0], "en")).toBe("M · Black");
    expect(variantLabel(helmet.variants[0], "ar")).toBe("M · أسود");
    expect(variantLabel(cap.variants[0], "en")).toBe("");
    expect(specRows(bike, "ar")).toEqual([["الإطار", "كربون"], ["Weight", "8.4 kg"]]);
    expect(specRows(bike, "fr")).toEqual([["Frame", "Carbon"], ["Weight", "8.4 kg"]]);
  });
  it("sorts as asked, sold-out ones last except in staff's order", () => {
    expect(sortProducts(STORE.products, "featured").map((p) => p.slug)).toEqual(["da54", "helmet", "cap", "gone"]);
    expect(sortProducts(STORE.products, "price-asc").map((p) => p.slug)).toEqual(["cap", "helmet", "da54", "gone"]);
    expect(sortProducts(STORE.products, "price-desc").map((p) => p.slug)).toEqual(["da54", "helmet", "cap", "gone"]);
    expect(sortProducts(STORE.products, "new")[0].slug).toBe("helmet");
    expect(categoriesIn(STORE)).toEqual(["bikes", "accessories", "apparel", "nutrition"]);
  });
});

describe("amounts", () => {
  it("are written with the riyal sign, grouped, cents only when there are any, isolated left to right", () => {
    expect(sar(15304)).toBe("\u2066\u20c1 15,304\u2069");
    expect(sar(45.5)).toBe("\u2066\u20c1 45.50\u2069");
    expect(vatIn(115)).toBe(15);
    expect(vatIn(8435)).toBe(1100.22);
  });
});

describe("the switch", () => {
  it("opens the store only when staff opened it and payments are on", () => {
    expect(storeOpen({ "store.open": true, "pay.enabled": true })).toBe(true);
    expect(storeOpen({ "store.open": true })).toBe(false);
    expect(storeOpen({ "pay.enabled": true })).toBe(false);
    expect(storeOpen(null)).toBe(false);
  });
  it("shows a former price only with a discount licence", () => {
    expect(discountLicence({})).toBeNull();
    expect(discountLicence({ "store.discountLicence": "  " })).toBeNull();
    expect(discountLicence({ "store.discountLicence": " 12345 " })).toBe("12345");
  });
});

describe("the cart", () => {
  it("keeps only what can be a line: a variant id and 1 to 10 of it, one line each, 20 at most", () => {
    expect(parseCart("not json")).toEqual([]);
    expect(parseCart(JSON.stringify([{ variant: V(1), qty: 2 }, { variant: V(1), qty: 9 }, { variant: "x", qty: 1 }, { variant: V(2), qty: 0 }, { variant: V(3), qty: 40 }]))).toEqual([
      { variant: V(1), qty: 10 }, { variant: V(3), qty: 10 },
    ]);
    expect(parseCart(Array.from({ length: 25 }, (_, i) => ({ variant: V(i + 1), qty: 1 })))).toHaveLength(20);
  });
  it("adds, changes and removes lines", () => {
    let c = addItem([], V(1), 2)!;
    c = addItem(c, V(3), 1)!;
    expect(c.map((l) => l.variant)).toEqual([V(3), V(1)]);
    c = addItem(c, V(1), 20)!;
    expect(c.find((l) => l.variant === V(1))?.qty).toBe(10);
    expect(cartCount(setItemQty(c, V(3), 4))).toBe(14);
    expect(removeItem(c, V(3))).toEqual([{ variant: V(1), qty: 10 }]);
    expect(addItem(Array.from({ length: 20 }, (_, i) => ({ variant: V(i + 100), qty: 1 })), V(1), 1)).toBeNull();
  });
  it("is priced with the store; a line that cannot be ordered is marked and costs nothing", () => {
    const lines = cartLines([{ variant: V(1), qty: 1 }, { variant: V(2), qty: 1 }, { variant: V(4), qty: 2 }, { variant: V(99), qty: 1 }, { variant: V(3), qty: 2 }], STORE);
    expect(lines.map((l) => l.issue)).toEqual([null, "out", "short", "gone", null]);
    expect(lines.map((l) => l.unit)).toEqual([8435, 8935, 120, 0, 520]);
    expect(subtotalOf(lines)).toBe(8435 + 1040);
    expect(shipsKsa(lines)).toBe(false);
    expect(shipsKsa(lines.filter((l) => l.product?.ship_ksa))).toBe(true);
  });
});

describe("delivery", () => {
  const s = paySettings({ "store.delivery": { pickup: { on: true }, jeddah: { on: true, fee: 30, days: "1-2" }, ksa: { on: true, fee: 45, days: "4-7" }, freeOver: 500 } });
  it("offers pickup, Jeddah and the courier at their fees, free over the threshold, and no courier for a bike", () => {
    expect(deliveryOptions(s, { subtotal: 120, shipKsa: true })).toEqual([{ id: "pickup", fee: 0, days: null }, { id: "jeddah", fee: 30, days: "1-2" }, { id: "ksa", fee: 45, days: "4-7" }]);
    expect(deliveryOptions(s, { subtotal: 500, shipKsa: true }).map((o) => o.fee)).toEqual([0, 0, 0]);
    expect(deliveryOptions(s, { subtotal: 8435, shipKsa: false }).map((o) => o.id)).toEqual(["pickup", "jeddah"]);
    const off = paySettings({ "store.delivery": { jeddah: { on: false }, ksa: { on: true, fee: 45 } } });
    expect(deliveryOptions(off, { subtotal: 10, shipKsa: true }).map((o) => o.id)).toEqual(["pickup", "ksa"]);
  });
  it("says how far the cart is from free delivery", () => {
    expect(freeProgress(s, 380)).toEqual({ left: 120, pct: 76, over: 500 });
    expect(freeProgress(s, 620)).toEqual({ left: 0, pct: 100, over: 500 });
    expect(freeProgress(paySettings({}), 100)).toBeNull();
  });
  it("counts the days in Riyadh without Fridays", () => {
    expect(daysOf("1-2")).toEqual([1, 2]);
    expect(daysOf("4 – 7")).toEqual([4, 7]);
    expect(daysOf("3")).toEqual([3, 3]);
    expect(daysOf("soon")).toBeNull();
    expect(daysOf("5-2")).toBeNull();
    // 2026-11-10 is a Tuesday, the 13th a Friday
    expect(deliveryRange("1-2", "2026-11-10")).toEqual({ from: "2026-11-11", to: "2026-11-12" });
    expect(deliveryRange("4-7", "2026-11-10")).toEqual({ from: "2026-11-15", to: "2026-11-18" });
    expect(deliveryRange("1-2", "2026-11-12")).toEqual({ from: "2026-11-14", to: "2026-11-15" });
    expect(workingDay("2026-11-13", 0)).toBe("2026-11-14"); // placed on a Friday: Saturday is day 0
    expect(deliveryRange("1-2", "2026-11-13")).toEqual({ from: "2026-11-15", to: "2026-11-16" });
    expect(deliveryRange(null, "2026-11-10")).toBeNull();
    expect(riyadhToday(new Date("2026-11-10T21:30:00Z"))).toBe("2026-11-11");
  });
  it("writes the dates with the month once", () => {
    expect(fmtRange({ from: "2026-11-15", to: "2026-11-18" }, "en-GB")).toBe("Sun 15 – Wed 18 Nov");
    expect(fmtRange({ from: "2026-11-29", to: "2026-12-02" }, "en-GB")).toBe("Sun 29 Nov – Wed 2 Dec");
    expect(fmtRange({ from: "2026-11-15", to: "2026-11-15" }, "en-GB")).toBe("Sun 15 Nov");
  });
});

describe("the checkout form", () => {
  it("reads a Saudi mobile however it is typed", () => {
    for (const p of ["0512345678", "512345678", "+966512345678", "00966512345678", "966 51 234 5678", "٠٥١٢٣٤٥٦٧٨", "05 1234 5678"]) expect(storePhone(p), p).toBe("966512345678");
    for (const p of ["0412345678", "12345", "+971512345678", ""]) expect(storePhone(p), p).toBeNull();
  });
  it("writes the short address in capitals with Latin digits", () => {
    expect(shortAddress("rcma ٧٩٣٣")).toBe("RCMA7933");
    expect(digitsOnly("٢٣٢١٨x", 5)).toBe("23218");
    expect(latinDigits("\u200e۱۲")).toBe("12");
  });
  it("names what is missing: the courier needs the city and the short address", () => {
    const contact = { name: "Sara Ali", phone: "0512345678", email: "" };
    expect(formProblems({ fulfil: "pickup", contact, address: EMPTY_ADDRESS })).toEqual([]);
    expect(formProblems({ fulfil: "pickup", contact: { name: "S", phone: "123", email: "x@" }, address: EMPTY_ADDRESS })).toEqual(["name", "phone", "email"]);
    expect(formProblems({ fulfil: "jeddah", contact, address: { ...EMPTY_ADDRESS, district: "Al Rawdah", street: "Prince Sultan" } })).toEqual([]);
    expect(formProblems({ fulfil: "ksa", contact, address: { ...EMPTY_ADDRESS, district: "A", street: "B", postal: "123" } })).toEqual(["city", "postal", "short"]);
    expect(formProblems({ fulfil: "ksa", contact, address: { ...EMPTY_ADDRESS, city: "Riyadh", district: "A", street: "B", short: "RCMA7933" } })).toEqual([]);
  });
  it("sends no price, and Jeddah as a Jeddah delivery's city", () => {
    const b = checkoutBody({ items: [{ variant: V(1), qty: 2 }], fulfil: "jeddah", contact: { name: " Sara  Ali ", phone: "0512345678", email: "" },
      address: { ...EMPTY_ADDRESS, city: "Makkah", district: "Al Rawdah", street: "X" }, note: " ", wallet: false, lang: "ar" });
    expect(b).toEqual({ items: [{ variant: V(1), qty: 2 }], fulfil: "jeddah", contact: { name: "Sara Ali", phone: "0512345678", email: undefined },
      address: { city: "Jeddah", district: "Al Rawdah", street: "X", building: undefined, postal: undefined, extra: undefined, short: undefined }, note: undefined, wallet: false, lang: "ar" });
    expect(JSON.stringify(b)).not.toMatch(/price|total/);
    expect(checkoutBody({ items: [], fulfil: "pickup", contact: { name: "A B", phone: "", email: "" }, address: EMPTY_ADDRESS, note: "", wallet: true, lang: "en" }).address).toBeUndefined();
  });
  it("puts a refusal where it belongs", () => {
    expect(refusalPlace("stock")).toEqual({ line: true });
    expect(refusalPlace("phone")).toEqual({ field: "phone" });
    expect(refusalPlace("address")).toEqual({ field: "address" });
    expect(refusalPlace("busy")).toEqual({});
  });
});

describe("choosing a variant", () => {
  const p = storeOf([product("p", "jersey")], [
    variant(1, "p", { size: "S", color_en: "Green", stock: 2 }), variant(2, "p", { size: "M", color_en: "Green", stock: 0 }),
    variant(3, "p", { size: "M", color_en: "Black", stock: 4 }),
  ]).products[0];
  it("offers the sizes and colours the variants come in, and names one only when both are picked", () => {
    expect(optionsOf(p).sizes).toEqual(["S", "M"]);
    expect(optionsOf(p).colours.map((c) => c.key)).toEqual(["Green", "Black"]);
    expect(pickVariant(p, "M", null)).toBeNull();
    expect(pickVariant(p, "M", "Black")?.id).toBe(V(3));
  });
  it("closes a choice nobody can have with the other one as it stands", () => {
    expect(optionOpen(p, "size", "M", "Green")).toBe(false);
    expect(optionOpen(p, "size", "M", null)).toBe(true);
    expect(optionOpen(p, "colour", "Black", "S")).toBe(false);
  });
});

describe("an order's page", () => {
  const raw = {
    id: "o1", no: 1001, status: "shipped", fulfil: "ksa", name: "Sara", phone: "•••• 5678", address: { city: "Riyadh", district: "Olaya" },
    subtotal: "500.00", delivery_fee: 0, total: 500, wallet_paid: 100, vat: 65.22, courier: "SMSA", tracking_no: "123", paid_at: "2026-11-10T09:00:00Z",
    created_at: "2026-11-10T08:55:00Z", payment: { id: "p1", status: "paid", method: "creditcard", brand: "mada", last4: "1234", receipt_no: 77, expires_at: "2026-11-10T09:10:00Z", amount: 400 },
    items: [{ name: "Helmet", variant: "M", qty: 1, unit_price: 500, variant_id: V(3), image: null, slug: "helmet" }], events: [{ at: "2026-11-10T09:00:00Z", status: "paid", note: null }],
  };
  it("reads the database's answer", () => {
    const o = orderOf(raw, "k".repeat(32))!;
    expect(o.subtotal).toBe(500);
    expect(o.key).toBe("k".repeat(32));
    expect(orderOf({ ...raw, status: "lost" })).toBeNull();
    expect(orderNo(o.no)).toBe("MM-1001");
  });
  it("knows its steps, pickup or delivery", () => {
    expect(orderSteps({ status: "shipped", fulfil: "ksa" })).toEqual({ steps: ["paid", "preparing", "shipped", "delivered"], at: 2 });
    expect(orderSteps({ status: "pending", fulfil: "pickup" })).toEqual({ steps: ["paid", "preparing", "ready", "collected"], at: -1 });
    expect(orderSteps({ status: "cancelled", fulfil: "pickup" }).at).toBeNull();
  });
  it("offers payment while the hold lasts, a mistake report for a day, and says how it was paid", () => {
    const o = orderOf(raw)!;
    const pending = { ...o, status: "pending" as const, payment: { ...o.payment!, status: "initiated" } };
    expect(payable(pending, Date.parse("2026-11-10T09:05:00Z"))).toBe(true);
    expect(payable(pending, Date.parse("2026-11-10T09:11:00Z"))).toBe(false);
    expect(reportable(o, Date.parse("2026-11-11T08:00:00Z"))).toBe(true);
    expect(reportable(o, Date.parse("2026-11-11T09:00:00Z"))).toBe(false);
    expect(paidWith(o.payment)).toBe("mada •••• 1234");
    expect(paidWith({ ...o.payment!, method: "applepay", brand: "visa" })).toBe("Apple Pay · Visa •••• 1234");
    expect(paidWith({ ...o.payment!, status: "initiated" })).toBeNull();
    expect(unpaidCancel({ ...o, status: "cancelled", paid_at: null })).toBe(true);
  });
  it("is expected from the day it was paid, without Fridays", () => {
    const s = paySettings({ "store.delivery": { ksa: { on: true, fee: 45, days: "4-7" } } });
    expect(orderExpected(orderOf(raw)!, s)).toEqual({ from: "2026-11-15", to: "2026-11-18" });
    expect(orderExpected({ ...orderOf(raw)!, fulfil: "pickup" }, s)).toBeNull();
    expect(orderExpected({ ...orderOf(raw)!, status: "delivered" }, s)).toBeNull();
  });
});
