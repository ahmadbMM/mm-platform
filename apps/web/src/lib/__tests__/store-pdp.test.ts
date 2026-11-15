import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { TxProvider } from "@/i18n/TxProvider";
import { localize } from "@/i18n/tx";
import { storeOf } from "../store";
import { paySettings } from "../pay/settings";
import { warrantyMonths, warrantyParts, POLICY } from "../store-policy";
import {
  buyNowLines, buyNowWithHref, clampPan, clampScale, cmText, estimate, extraChoices, extrasOf, guideOf, heightCm, keptWay, keyStep, latinRuns,
  pinchScale, requestLabel, sizeHeight, soldOutTarget, stepPhoto, swipeStep, tabbyPart, ticked, waDigits, waHref,
} from "../store-pdp";
import { T as W, warrantyWords } from "../../components/store/w3a.text";

// The product page's top half (store build 2026-11-15, chain w3a): the total beside Add and the delivery rows at the
// picked price (F25, X06), the rider height in the size buttons and the size guide (F20-F22), back in stock (F34), a
// bike's Extras (F60), Buy now with them (F35), Tabby's line (F29), WhatsApp (F32), Latin names in Arabic (O11-B), the
// gallery and its viewer (D12-C, F13, A06-A), the warranty (L09); then the page as the server draws it.
const render = renderUntyped as (el: ReactElement) => string;
const wrap = (locale: string, child: ReactNode) =>
  createElement(NextIntlClientProvider, { locale, messages: {} } as never, createElement(TxProvider, { locale, dict: null } as never, child));
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BIKE = U(1), HELMET = U(2), LIGHTS = U(3), OUT = U(4), CARD = U(5), JERSEY = U(6), OLD = U(7);
const product = (id: string, slug: string, x: Record<string, unknown> = {}) => ({
  id, slug, category: "accessories", brand: null, name_en: slug.toUpperCase(), name_ar: null, tagline_en: null, tagline_ar: null, description_en: null, description_ar: null,
  specs: [], images: [], price: 100, compare_at: null, ship_ksa: true, sort: 0, created_at: "2026-11-01T00:00:00Z", ...x,
});
const variant = (n: number, pid: string, x: Record<string, unknown> = {}) => ({ id: U(100 + n), product_id: pid, size: null, color_en: null, color_ar: null, color_hex: null, price: null, stock: 5, sort: n, ...x });
const IMG = ["/media/store/b/1.webp", "/media/store/b/2.webp", "/media/store/b/3.webp"];
const STORE = storeOf(
  [
    product(BIKE, "da54-max", {
      category: "bikes", brand: "Alvas", name_en: "DA54 MAX", name_ar: "دراجة DA54 MAX الهوائية", price: 8000, ship_ksa: false, images: IMG,
      image_meta: { [IMG[0]]: { colour: "Black", alt_en: "Rider on the black DA54 MAX" }, [IMG[1]]: { colour: "Red" } },
      sizes: [{ size: "S", height: { min: 160, max: 170 } }, { size: "M", height: { min: 171, max: 185 } }, { size: "L", height: { min: 186, max: null } }, { size: "XS", height: { min: 150, max: 159 } }],
      key_specs: [{ icon: "weight", en: "10.4 kg", ar: "10.4 كغ" }, { icon: "gears", en: "2x12 Di2" }],
      goes_with: [HELMET, OUT, CARD, LIGHTS],
    }),
    product(HELMET, "helmet", { name_en: "Aero Helmet", price: 450, images: ["/media/store/h/1.webp"] }),
    product(LIGHTS, "lights", { name_en: "Lights", price: 120, ship_ksa: true }),
    product(OUT, "sold-out", { price: 90 }),
    product(CARD, "gift-card", { category: "gift", kind: "gift_card" }),
    product(JERSEY, "jersey", { category: "apparel", price: 250, sizes: [{ size: "M", chest: { min: 92, max: 98 }, waist: { min: 80, max: 86 } }, { size: "L", chest: { min: 99, max: null } }] }),
    product(OLD, "ex-rental", { category: "bikes", condition: "certified", price: 3000, ship_ksa: false }),
  ],
  [
    variant(1, BIKE, { size: "S", color_en: "Black", stock: 2 }), variant(2, BIKE, { size: "M", color_en: "Black", stock: 0 }),
    variant(3, BIKE, { size: "M", color_en: "Red", stock: 1, price: 8100 }), variant(4, BIKE, { size: "L", color_en: "Red", stock: 0 }),
    variant(5, HELMET, { size: "M", stock: 3 }), variant(6, HELMET, { size: "L", stock: 2, price: 470 }), variant(7, HELMET, { size: "S", stock: 0 }),
    variant(8, LIGHTS, { stock: 9 }), variant(9, OUT, { stock: 0 }), variant(10, CARD, { size: "100", price: 100, stock: 999 }),
    variant(11, JERSEY, { size: "M", stock: 4 }), variant(12, JERSEY, { size: "L", stock: 4 }), variant(13, OLD, { size: "M", stock: 1 }),
  ],
);
const P = (id: string) => STORE.products.find((p) => p.id === id)!;
const SETTINGS = paySettings({ "store.delivery": { pickup: { on: true, days: "1" }, jeddah: { on: true, fee: 30, days: "1-2" }, ksa: { on: true, fee: 45, days: "3-5" }, freeOver: 500 } });

describe("the estimated total and the delivery rows (F25, X06)", () => {
  it("adds the item times its quantity, the extras ticked and the picked way's fee", () => {
    const e = estimate(SETTINGS, { unit: 120, lo: 120, qty: 2, extras: [50], shipKsa: true, picked: "jeddah" });
    expect(e.subtotal).toBe(290);
    expect(e.way?.id).toBe("jeddah");
    expect(e.total).toBe(320);
  });
  it("reaches free delivery at the price of what is picked, not the cheapest", () => {
    const cheap = estimate(SETTINGS, { unit: null, lo: 450, qty: 1, extras: [], shipKsa: true, picked: "jeddah" });
    expect(cheap.options.find((o) => o.id === "jeddah")?.fee).toBe(30);
    expect(cheap.total).toBeNull(); // no price until a size is picked when sizes cost different amounts
    const dear = estimate(SETTINGS, { unit: 510, lo: 450, qty: 1, extras: [], shipKsa: true, picked: "jeddah" });
    expect(dear.options.find((o) => o.id === "jeddah")?.fee).toBe(0);
    expect(dear.total).toBe(510);
    expect(estimate(SETTINGS, { unit: 450, lo: 450, qty: 1, extras: [60], shipKsa: true, picked: "ksa" }).total).toBe(510);
  });
  it("takes the first way offered when the one kept is not (a bike never goes by courier)", () => {
    const e = estimate(SETTINGS, { unit: 8000, lo: 8000, qty: 1, extras: [], shipKsa: false, picked: "ksa" });
    expect(e.options.map((o) => o.id)).toEqual(["pickup", "jeddah"]);
    expect(e.way?.id).toBe("pickup");
    expect(keptWay("jeddah")).toBe("jeddah");
    expect(keptWay("digital")).toBeNull();
    expect(keptWay(null)).toBeNull();
  });
});

describe("sizes: the rider height (F20), the guide (F21) and its height field (F22)", () => {
  it("words a height range, an open top and an open bottom", () => {
    expect(sizeHeight(P(BIKE), "M")).toEqual({ kind: "range", min: 171, max: 185 });
    expect(sizeHeight(P(BIKE), "L")).toEqual({ kind: "from", min: 186 });
    expect(cmText({ min: null, max: 160 })).toEqual({ kind: "upto", max: 160 });
    expect(cmText(null)).toBeNull();
    const w = localize(W, "en", null);
    expect(w.cmRange(165, 174)).toBe("165-174 cm");
    expect(localize(W, "ar", null).cmFrom(190)).toBe("\u2066190+\u2069 سم"); // kept left to right inside the Arabic
  });
  it("lists the guide's rows in the product's size order, for the sizes it comes in only, with the columns staff filled", () => {
    expect(guideOf(P(BIKE))).toMatchObject({ cols: ["height"], rows: [{ size: "S" }, { size: "M" }, { size: "L" }] });
    expect(guideOf(P(JERSEY))).toMatchObject({ cols: ["chest", "waist"], rows: [{ size: "M" }, { size: "L" }] });
    expect(guideOf(P(HELMET))).toBeNull();
  });
  it("reads a typed height in any digits, 50 to 230 cm", () => {
    expect(heightCm("178")).toBe(178);
    expect(heightCm("١٧٨")).toBe(178);
    expect(heightCm("178 cm")).toBe(178);
    expect(heightCm("17")).toBeNull();
    expect(heightCm("2300")).toBeNull();
    expect(heightCm("")).toBeNull();
  });
});

describe("back in stock (F34)", () => {
  it("names the sold-out size with the colour picked, else its first variant; a product without choices its own", () => {
    expect(soldOutTarget(P(BIKE), "size", "M", "Black")?.id).toBe(U(102));
    expect(soldOutTarget(P(BIKE), "size", "L", null)?.id).toBe(U(104));
    expect(soldOutTarget(P(BIKE), "colour", "Red", "L")?.id).toBe(U(104));
    expect(soldOutTarget(P(OUT), null, null, null)?.id).toBe(U(109));
    expect(soldOutTarget(P(BIKE), "size", "XXL", null)).toBeNull();
    expect(requestLabel(P(BIKE).variants[1])).toBe("M · Black");
    expect(requestLabel(P(OUT).variants[0])).toBe("");
  });
});

describe("a bike's Extras (F60) and Buy now with them (F35)", () => {
  const related = [P(HELMET), P(OUT), P(CARD), P(LIGHTS)];
  it("offers the Goes-with products that can be bought now, in staff's order: no sold-out one, no gift card", () => {
    expect(extrasOf(related).map((x) => x.slug)).toEqual(["helmet", "lights"]);
    expect(extraChoices(P(HELMET)).map((v) => v.size)).toEqual(["M", "L"]);
  });
  it("puts each extra ticked in the cart once, at the price of its choice; a choice that is gone is left out", () => {
    const x = extrasOf(related);
    expect(ticked(x, { [HELMET]: U(106), [LIGHTS]: U(108) }).map((l) => [l.variant, l.price])).toEqual([[U(106), 470], [U(108), 120]]);
    expect(ticked(x, { [HELMET]: U(107), [LIGHTS]: null })).toEqual([]);
  });
  it("checks out the bike and its extras straight away, and reads them back", () => {
    const href = buyNowWithHref(U(101).toUpperCase(), 2, [U(106), U(108), U(106), U(101), "junk"]);
    expect(href).toBe(`/store/checkout?buy=${U(101)}&qty=2&with=${U(106)},${U(108)}`);
    expect(buyNowLines(new URLSearchParams(href.split("?")[1]))).toEqual([{ variant: U(101), qty: 2 }, { variant: U(106), qty: 1 }, { variant: U(108), qty: 1 }]);
    expect(buyNowWithHref(U(101), 1)).toBe(`/store/checkout?buy=${U(101)}&qty=1`);
    expect(buyNowLines({ buy: "nope" })).toEqual([]);
    const many = Array.from({ length: 12 }, (_, i) => U(200 + i));
    expect(buyNowLines({ buy: U(101), qty: "99", with: many.join(",") })).toHaveLength(9);
    expect(buyNowLines({ buy: U(101), qty: "99" })[0].qty).toBe(1);
  });
});

describe("Tabby, WhatsApp and Latin names (F29, F32, O11-B)", () => {
  it("splits a price in Tabby's four, rounded up to the halala", () => {
    expect(tabbyPart(8435)).toBe(2108.75);
    expect(tabbyPart(100.01)).toBe(25.01);
  });
  it("finds the WhatsApp number in the site's link, else its phone", () => {
    expect(waDigits("https://wa.me/966566668818", "+966 12 000 0000")).toBe("966566668818");
    expect(waDigits("", "+966 56 666 8818")).toBe("966566668818");
    expect(waDigits("https://instagram.com/x", "")).toBe("");
    expect(waHref("966566668818", "Hi: DA54 & co")).toBe("https://wa.me/966566668818?text=Hi%3A%20DA54%20%26%20co");
    expect(waHref("", "x")).toBe("");
  });
  it("cuts Latin runs out of Arabic text, a number alone left in the sentence", () => {
    expect(latinRuns("دراجة ALVAS DA54 MAX الجديدة")).toEqual([
      { text: "دراجة ", latin: false }, { text: "ALVAS DA54 MAX", latin: true }, { text: " الجديدة", latin: false },
    ]);
    expect(latinRuns("ضمان 7 أيام")).toEqual([{ text: "ضمان 7 أيام", latin: false }]);
    expect(latinRuns("Dura-Ace Di2 2×12.")).toEqual([{ text: "Dura-Ace Di2 2×12", latin: true }, { text: ".", latin: false }]);
    expect(latinRuns("(Camp) خوذة")).toEqual([{ text: "(", latin: false }, { text: "Camp", latin: true }, { text: ") خوذة", latin: false }]);
  });
});

describe("the gallery and its viewer (D12-C, F13, A06-A)", () => {
  it("steps along the photos without wrapping", () => {
    expect(stepPhoto(0, 3, -1)).toBe(0);
    expect(stepPhoto(1, 3, 1)).toBe(2);
    expect(stepPhoto(2, 3, 1)).toBe(2);
    expect(stepPhoto(0, 0, 1)).toBe(0);
  });
  it("pinches from 1 to 4 times, and never moves a photo's edge into the frame", () => {
    expect(pinchScale(1, 100, 250)).toBe(2.5);
    expect(pinchScale(2, 100, 400)).toBe(4);
    expect(pinchScale(2, 100, 20)).toBe(1);
    expect(pinchScale(2, 0, 50)).toBe(2);
    expect(clampScale(NaN)).toBe(1);
    expect(clampPan(500, -500, 2, 400, 300)).toEqual({ x: 200, y: -150 });
    expect(clampPan(30, 40, 1, 400, 300)).toEqual({ x: 0, y: 0 });
  });
  it("shows the next photo from the side the page reads from", () => {
    expect(swipeStep(-120, 10, false)).toBe(1);
    expect(swipeStep(-120, 10, true)).toBe(-1);
    expect(swipeStep(120, 0, true)).toBe(1);
    expect(swipeStep(20, 0, false)).toBe(0);
    expect(swipeStep(-80, 200, false)).toBe(0); // a scroll down, not a swipe
    expect(keyStep("ArrowRight", false)).toBe(1);
    expect(keyStep("ArrowLeft", true)).toBe(1);
    expect(keyStep("Enter", true)).toBe(0);
  });
});

describe("the warranty row (L09)", () => {
  it("says the law's 2 years new, 1 year certified pre-owned, or staff's longer term", () => {
    const en = localize(W, "en", null), ar = localize(W, "ar", null);
    const words = (t: typeof en, months: number) => { const p = warrantyParts(months); return warrantyWords(t, p.years, p.months); };
    expect(words(en, warrantyMonths(P(BIKE)))).toBe("2 years");
    expect(words(en, warrantyMonths(P(OLD)))).toBe("1 year");
    expect(words(en, 30)).toBe("2 years and 6 months");
    expect(words(ar, 24)).toBe("سنتان");
    expect(words(ar, 12)).toBe("سنة واحدة");
    expect(words(ar, 36)).toBe("3 سنوات");
  });
});

describe("the back-in-stock route (POST /api/store/stock-request)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  const setup = (status: number, answer: unknown) => {
    calls.length = 0;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("MOYASAR_PUBLISHABLE_KEY", "pk_test_x"); vi.stubEnv("MOYASAR_SECRET_KEY", "sk_test_x"); vi.stubEnv("PAY_SERVER_KEY", "k".repeat(40));
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ fn: String(url).replace(/^.*\/rpc\//, ""), body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify(answer), { status });
    }));
  };
  const post = async (body: unknown, origin = "https://micromobility.sa") => {
    const { POST } = await import("../../app/api/store/stock-request/route");
    const r = await POST(new Request("https://micromobility.sa/api/store/stock-request", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }));
    return { status: r.status, body: (await r.json()) as Record<string, unknown> };
  };
  it("keeps the name and the mobile for staff, the mobile as the database keeps it", async () => {
    setup(200, { id: U(900) });
    expect(await post({ variant: U(102).toUpperCase(), name: "  Sami   Rider ", phone: "٠٥٠١١١٢٢٣٣", lang: "ar" })).toEqual({ status: 200, body: { ok: true } });
    expect(calls[0]).toEqual({ fn: "store_stock_request", body: { p_key: "k".repeat(40), p_variant: U(102), p_name: "Sami Rider", p_phone: "966501112233", p_lang: "ar" } });
  });
  it("refuses a missing name or a mobile that is not Saudi before asking, and says the database's refusal", async () => {
    setup(200, { id: U(900) });
    expect((await post({ variant: U(102), name: "S", phone: "0501112233" })).body.error).toBe("name");
    expect((await post({ variant: U(102), name: "Sami", phone: "12345" })).body.error).toBe("phone");
    expect((await post({ variant: "x", name: "Sami", phone: "0501112233" })).body.error).toBe("invalid");
    expect(calls).toHaveLength(0);
    expect((await post({ variant: U(102), name: "Sami", phone: "0501112233" }, "https://evil.example")).status).toBe(403);
    setup(400, { message: "STORE_GONE" });
    expect(await post({ variant: U(102), name: "Sami", phone: "0501112233" })).toEqual({ status: 409, body: { ok: false, error: "gone" } });
    setup(400, { message: "STORE_BUSY" });
    expect((await post({ variant: U(102), name: "Sami", phone: "0501112233" })).status).toBe(429);
  });
});

describe("the top of a product's page as the server draws it", () => {
  const props = (p: ReturnType<typeof P>, locale: string, x: Record<string, unknown> = {}) => ({
    p, locale, licence: null, today: "2026-11-15", related: [P(HELMET), P(OUT), P(LIGHTS)], settings: SETTINGS,
    whens: { pickup: "Mon 16 Nov", jeddah: "Mon 16 – Tue 17 Nov", ksa: null }, showroom: "Al Sharafeyah",
    policy: [{ q: "Is there anything that can't be returned?", a: "Items made for you." }], whatsapp: "966566668818", tabby: false, applePay: false,
    href: "https://micromobility.sa/store/da54-max", ...x,
  });
  const draw = async (p: ReturnType<typeof P>, locale: string, x: Record<string, unknown> = {}) => {
    const { default: ProductTop } = await import("@/components/store/ProductTop");
    return render(wrap(locale, createElement(ProductTop, props(p, locale, x))));
  };
  it("gives a bike numbered steps with the rider height in each size, its extras, the buy box and the delivery box", async () => {
    const html = await draw(P(BIKE), "en");
    expect(html).toContain('<b>S</b><small>160-170 cm</small>');
    expect(html).toContain("186+ cm");
    expect(html).toContain("Size guide");
    expect(html).toMatch(/st-step-n[^>]*>1<\/span><span>Size/);
    expect(html).toMatch(/st-step-n[^>]*>3<\/span>Extras/);
    expect(html).toContain("Aero Helmet");
    expect(html).not.toContain("SOLD-OUT"); // a sold-out add-on is not offered
    expect(html).toContain("10.4 kg");
    expect(html).toContain("Summary");
    expect(html).toContain("Buy now");
    expect(html).toContain("Collect fully built");
    expect(html).toContain("Delivered ready to ride in Jeddah");
    expect(html).toContain("Ready Mon 16 Nov");
    expect(html).toContain(POLICY.en.returnSentence);
    expect(html).toContain('aria-haspopup="dialog">Returns policy</button>'); // always there, whatever the Help page's switch
    expect(html).toContain("Warranty</b><em>2 years</em>");
    expect(html).toContain("Ask about this bike");
    expect(html).toContain("https://wa.me/966566668818?text=");
    expect(html).not.toContain("tabby.svg");
    expect(html).not.toContain("st-applepay");
    expect(html).not.toContain("Bikes are delivered in Jeddah or collected from the showroom.");
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("draws the colour's photo as its chip and the photos of the colour picked first", async () => {
    const html = await draw(P(BIKE), "en");
    expect(html).toMatch(/title="Black"[^>]*><img src="\/media\/store\/b\/1\.webp\?w=640"/);
    expect(html).toContain('alt="Rider on the black DA54 MAX"');
    expect(html.indexOf("/media/store/b/2.webp?w=1280")).toBe(-1); // the red photo is not among the black ones
  });
  it("shows Tabby's line under the price only while it is switched on, and a certified bike's 1-year warranty", async () => {
    expect(await draw(P(HELMET), "en", { tabby: true })).toMatch(/or 4 payments of .*112\.5.* with<\/span><img src="\/site\/payments\/tabby\.svg" alt="tabby"/);
    expect(await draw(P(OLD), "en")).toContain("Warranty</b><em>1 year</em>");
  });
  it("gives gear the plain pickers, and a jersey's sizes without a height", async () => {
    const html = await draw(P(JERSEY), "en");
    expect(html).not.toContain("st-step-n");
    expect(html).toContain("Size guide");
    expect(html).toContain("Ask about this product");
    expect(html).toContain("Collect from our showroom");
  });
  it("keeps a Latin model name in its own order inside Arabic", async () => {
    const html = await draw(P(BIKE), "ar");
    expect(html).toContain("<h1>دراجة <bdi>DA54 MAX</bdi> الهوائية</h1>");
    expect(html).toContain("<bdi>Alvas</bdi>");
    expect(html).toContain("استلمها مركّبة بالكامل");
    expect(html).toContain(POLICY.ar.returnSentence);
  });
  it("sends a gift card's address to the gift card page and notes the product as looked at", () => {
    const src = readFileSync(fileURLToPath(new URL("../../app/[locale]/store/[slug]/page.tsx", import.meta.url)), "utf8");
    expect(src).toContain('if (p.kind === "gift_card") redirect(productHref(p));');
    expect(src).toContain("<RecordView slug={p.slug} />");
    expect(src).toContain("categoryHref(p.category)");
  });
});
