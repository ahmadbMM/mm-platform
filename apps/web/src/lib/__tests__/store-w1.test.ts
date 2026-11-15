import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The store build's site-wide pieces (2026-11-15, chain w1): the footer's payment strip, Policies column, trust line and
// legal line, the Returns and Complaints pages, the store in the sitemap and the header's search, and the /bikes
// catalogue's link to the store. cookies() is a request's; here it holds no preview cookie.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import proxy, { POLICY_PAGE } from "../../proxy";
import { searchIndex } from "../../app/[locale]/search-index";
import { footerColumns, isPolicyHref, keptTrust, legalParts, policyLinks, POLICY_LINKS, returnsAnswers, waNumber, whatsappHref, withoutPolicyLinks } from "../policies";
import { bikesState } from "../../components/bikes/catalog-data";
import { resetCatalog } from "../catalog";
import { resetFares } from "../biz";
import { productFacts, storeLinksByModel, storePaths, storeSearchItems } from "../store-site";
import { storeOf, type Store } from "../store-core";
import { resetStore } from "../store";
import { resetSiteContent } from "../site";
import { storeLegal } from "../store-settings";
import { PAY_MARKS } from "../../components/pay/PayMarks";
import { T as W1 } from "../../components/store/w1.text";
import { T as STORE_T } from "../../components/store/Store.text";
import { siteSchema } from "../../content/pages/site";
import { helpSchema } from "../../content/pages/help";
import { resolvePage } from "../content-core";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const variant = (n: number, pid: string, x: Record<string, unknown> = {}) => ({ id: U(100 + n), product_id: pid, size: null, color_en: null, color_ar: null, color_hex: null, price: null, stock: 5, sort: n, ...x });
const product = (id: string, slug: string, x: Record<string, unknown> = {}) => ({
  id, slug, category: "accessories", brand: null, name_en: slug.toUpperCase(), name_ar: null, tagline_en: null, tagline_ar: null, description_en: null, description_ar: null,
  specs: [], images: [], price: 100, compare_at: null, ship_ksa: true, sort: 0, created_at: "2026-11-01T00:00:00Z", ...x,
});
const BIKE = U(1), HELMET = U(2), CARD = U(3), OLD = U(4), JERSEY = U(5);
const MODEL = "aaaaaaaa-0000-4000-8000-000000000001", MODEL2 = "aaaaaaaa-0000-4000-8000-000000000002";
const STORE: Store = storeOf(
  [
    product(BIKE, "da54", { category: "bikes", brand: "Alvas", name_ar: "دراجة دي أي 54", price: 8000, sort: 1, catalog_model: MODEL }),
    product(HELMET, "helmet", { price: 450, sort: 2, tagline_en: "Light road helmet", tagline_ar: "خوذة طريق خفيفة" }),
    product(CARD, "gift-card", { category: "gift", kind: "gift_card", sort: 4, catalog_model: MODEL2 }),
    product(OLD, "da54-pre-owned", { category: "bikes", condition: "certified", sort: 3, catalog_model: MODEL }),
    product(JERSEY, "jersey", { category: "apparel", price: 300, sort: 5 }),
  ],
  [
    variant(1, BIKE, { size: "S", stock: 2 }), variant(2, BIKE, { size: "M", stock: 1, price: 8100 }),
    variant(3, HELMET, { stock: 0 }), variant(4, CARD, { size: "100", price: 100, stock: 999 }), variant(5, CARD, { size: "500", price: 500, stock: 999 }),
    variant(6, OLD, { size: "M", stock: 1 }), variant(7, JERSEY, { size: "M", stock: 9 }),
  ],
);
const WORDS_EN = { ...STORE_T.en };

describe("the payment marks (X05)", () => {
  it("are exactly what checkout takes, mada first and Apple Pay's own mark second, with no tabby", () => {
    expect(PAY_MARKS.map((m) => m.id)).toEqual(["mada", "applepay", "visa", "mastercard", "stcpay"]);
    for (const m of PAY_MARKS) {
      const file = here(`../../../public${m.src}`);
      expect(existsSync(file), m.src).toBe(true);
      const svg = readFileSync(file, "utf8");
      expect(svg, m.src).toMatch(/<svg[\s>]/);
      expect(svg, m.src).not.toMatch(/<script|\bon[a-z]+=/i);
    }
  });
  it("leave the footer to the code: staff no longer keep a list of marks or the \"Prepay at Showroom\" mark", () => {
    const fields = siteSchema.sections.find((s) => s.id === "footer")!.fields.map((f) => f.id as string);
    expect(fields).not.toContain("payments");
    expect(fields).not.toContain("showroom");
    const footer = readFileSync(here("../../components/site/SiteFooter.tsx"), "utf8");
    expect(footer).toMatch(/PAY_MARKS\.map/);
    expect(footer).not.toMatch(/tabby\.svg|tx\("Prepay/);
  });
});

describe("the footer's Policies column (L12)", () => {
  it("lists Terms, Privacy, Returns and Complaints, without the Terms while that page is switched off", () => {
    expect(POLICY_LINKS.map((l) => l.href)).toEqual(["/terms", "/privacy", "/returns", "/complaints"]);
    expect(policyLinks([]).map((l) => l.key)).toEqual(["terms", "privacy", "returns", "complaints"]);
    expect(policyLinks(["terms", "help"]).map((l) => l.key)).toEqual(["privacy", "returns", "complaints"]);
    for (const k of ["terms", "privacy", "returns", "complaints"] as const) expect(W1.en[k] && W1.ar[k], k).toBeTruthy();
  });
  it("takes the same links out of the other columns, in any spelling, and leaves the rest", () => {
    for (const h of ["/terms", "/privacy", "/returns", "/complaints", "/help#returns", "/ar/terms", "/en/privacy/", "https://micromobility.sa/returns", "/terms#store"]) expect(isPolicyHref(h), h).toBe(true);
    for (const h of ["/help", "/help#delivery", "/termsx", "/about", "https://example.com/terms", "/store/returns"]) expect(isPolicyHref(h), h).toBe(false);
    expect(withoutPolicyLinks([{ label: "Help", href: "/help" }, { label: "Returns", href: "/help#returns" }, { label: "Privacy", href: "/privacy" }]))
      .toEqual([{ label: "Help", href: "/help" }]);
  });
  it("comes after staff's columns, which keep their other links, a column without a title too; a column left empty is not drawn", () => {
    const policies = { title: "Policies", links: [{ label: "Returns", href: "/returns" }] };
    const staff = [
      { title: "", links: [{ label: "Help", href: "/help" }, { label: "Terms", href: "/terms" }] },
      { title: "Legal", links: [{ label: "Privacy", href: "/privacy" }] },
      { title: "Shop", links: [{ label: "Store", href: "/store" }, { label: "Off", href: "/club" }] },
    ];
    const cols = footerColumns(staff, policies, (links) => links.filter((l) => l.href !== "/club"));
    expect(cols).toEqual([
      { title: "", links: [{ label: "Help", href: "/help" }] },
      { title: "Shop", links: [{ label: "Store", href: "/store" }] },
      policies,
    ]);
  });
  it("starts the Company column without those links, so the Website editor shows what the footer draws", () => {
    const company = resolvePage(siteSchema, null, "en").footer.company as { href: string }[];
    expect(company.length).toBeGreaterThan(0);
    expect(company.some((l) => isPolicyHref(l.href))).toBe(false);
  });
});

describe("the trust line (X03, X04)", () => {
  it("drops Maroof and any returns promise, in English or Arabic, even from a list staff saved", () => {
    const en = ["Maroof verified", "VAT reg. 15%", "Secure SSL checkout", "7-day returns", ""];
    expect(keptTrust(en, en)).toEqual(["VAT reg. 15%", "Secure SSL checkout"]);
    const ar = ["موثّق في معروف", "رقم ضريبي 15%", "دفع آمن SSL", "إرجاع خلال 7 أيام", ""];
    expect(keptTrust(ar, en)).toEqual(["رقم ضريبي 15%", "دفع آمن SSL"]);
    // a translated language: matched by the English beside it
    expect(keptTrust(["Vérifié", "TVA 15 %", "Paiement SSL", "Retours sous 7 jours"], en)).toEqual(["TVA 15 %", "Paiement SSL"]);
  });
  it("starts with neither in the schema", () => {
    const trust = (resolvePage(siteSchema, null, "en").footer.trust as { text: string }[]).map((t) => t.text);
    expect(trust).toEqual(["VAT reg. 15%", "Secure SSL checkout"]);
    expect(keptTrust(trust, trust)).toEqual(trust);
  });
});

describe("the legal line (L01)", () => {
  const w = { cr: "CR", ecr: "E-store CR No.", vat: "VAT No.", unified: "Unified No." };
  it("reads legal name · CR · e-store CR · VAT no., then the unified number and the address the line had", () => {
    const legal = storeLegal({ "site.legal.ecr": { en: "4030000000", ar: "4030000000" } }, "en");
    expect(legalParts(legal, { unified: "7041881512", address: "Riyadh 12692" }, w)).toEqual([
      "Micromobility Company Ltd.", "CR 1009107240", "E-store CR No. 4030000000", "VAT No. 312555068900003", "Unified No. 7041881512", "Riyadh 12692",
    ]);
  });
  it("shows nothing for a value that is not set", () => {
    const legal = storeLegal({ "site.legal.cr": { en: "", ar: "" } }, "ar");
    const parts = legalParts(legal, { unified: "", address: " " }, w);
    expect(parts).toEqual(["شركة التنقل الدقيق المحدودة", "VAT No. 312555068900003"]);
    expect(parts.join(" · ")).not.toMatch(/E-store|CR /);
  });
});

describe("the Returns and Complaints pages", () => {
  it("read the Help page's Returns answers, whether or not Help is switched on, dropping a half-written one", () => {
    const rows = resolvePage(helpSchema, { "page.help.visible": false }, "en").topics.returns;
    const answers = returnsAnswers(rows);
    expect(answers.length).toBeGreaterThan(2);
    expect(answers[0].a).toMatch(/7 days/);
    expect(returnsAnswers([{ q: "Only a question", a: " " }, { q: "Q", a: "A" }, "junk"])).toEqual([{ q: "Q", a: "A" }]);
  });
  it("reach WhatsApp through the link staff set, else the phone, and show that link's own number", () => {
    expect(whatsappHref("https://wa.me/966500000001", "+966566668818")).toBe("https://wa.me/966500000001");
    expect(whatsappHref("", "+966 56 666 8818")).toBe("https://wa.me/966566668818");
    expect(whatsappHref("javascript:alert(1)", "")).toBe("");
    expect(waNumber("https://wa.me/966500000001")).toBe("+966500000001");
    expect(waNumber("https://wa.me/966500000001?text=hi")).toBe("+966500000001");
    expect(waNumber("https://chat.whatsapp.com/abc")).toBe("");
  });
  it("say the answer time staff set, in a working day or several, and in Arabic with its own plural", () => {
    expect(W1.en.answerInN(3)).toBe("We answer every complaint within 3 working days, in Arabic or English.");
    expect(W1.ar.answerInN(2)).toContain("يومي عمل");
    expect(W1.ar.answerInN(5)).toContain("5 أيام عمل");
    expect(W1.ar.answerInN(14)).toContain("14 يوم عمل");
  });
  it("are pages of their own that a site-wide switch never hides", () => {
    for (const p of ["returns", "complaints"]) {
      const src = readFileSync(here(`../../app/[locale]/${p}/page.tsx`), "utf8");
      expect(src, p).toMatch(/pageState\(\)/); // not pageState("<page>"): no switch of its own
      expect(src, p).toMatch(/LearnAlone/);
    }
    expect(readFileSync(here("../../app/[locale]/returns/page.tsx"), "utf8")).toMatch(/ReturnsPolicy/);
    expect(readFileSync(here("../../components/site/ReturnsPolicy.tsx"), "utf8")).toMatch(/POLICY/);
  });
});

describe("the proxy", () => {
  const call = (path: string) => proxy(new NextRequest("https://micromobility.sa" + path));
  const rewrittenTo = (res: Response) => new URL(res.headers.get("x-middleware-rewrite") || "").pathname;
  beforeEach(() => resetSiteContent());
  it("opens the Returns and Complaints pages whatever the site's state, as the Privacy Notice", async () => {
    for (const p of ["/returns", "/returns/", "/complaints"]) {
      const res = await call(p);
      expect(res.status, p).toBe(200);
    }
    expect(rewrittenTo(await call("/returns"))).toBe("/en/returns");
    expect(rewrittenTo(await call("/complaints?lang=ar"))).toBe("/ar/complaints");
    for (const p of ["/returns/x", "/returnsx", "/complaints.html"]) expect(POLICY_PAGE.test(p), p).toBe(false);
    expect((await call("/returns/more")).status).not.toBe(200);
    // the old /ar/ address goes on to the page in Arabic, as every page's does, never to Coming Soon
    const old = await call("/ar/complaints");
    expect(new URL(old.headers.get("location") || "").pathname).toBe("/complaints");
  });
});

describe("the store across the site (X11, O06-B, F12)", () => {
  it("lists the store, its category pages and every product's page in the sitemap, the gift card page once", () => {
    expect(storePaths(STORE)).toEqual([
      "/store", "/store/category/bikes", "/store/category/accessories", "/store/category/apparel", "/store/category/gift",
      "/store/da54", "/store/helmet", "/store/da54-pre-owned", "/store/gift-card", "/store/jersey",
    ]);
    expect(storePaths({ products: [] })).toEqual(["/store"]);
  });
  it("gives each product's price and stock as the store's card writes them", () => {
    const by = (slug: string) => STORE.products.find((p) => p.slug === slug)!;
    expect(productFacts(by("da54"), WORDS_EN)).toEqual({ price: "From ⁦⃁ 8,000⁩", stock: "Only 3 left", out: false });
    expect(productFacts(by("helmet"), WORDS_EN)).toEqual({ price: "⁦⃁ 450⁩", stock: "Sold out", out: true });
    expect(productFacts(by("jersey"), WORDS_EN).stock).toBe("In stock");
  });
  it("puts the category pages and the products in the search, found by both languages' names and the brand", () => {
    const items = storeSearchItems(STORE, "ar", STORE_T.ar);
    const bikes = items.find((x) => x.href === "/store/category/bikes")!;
    expect(bikes.title).toBe(STORE_T.ar.cats.bikes);
    expect(bikes.text).toBe(STORE_T.ar.countN(2));
    expect(bikes.price).toBeUndefined();
    const da54 = items.find((x) => x.href === "/store/da54")!;
    expect(da54.title).toBe("دراجة دي أي 54");
    expect(da54.text).toBe("Alvas");
    expect(da54.words).toMatch(/DA54/);
    expect(da54.words).toMatch(/bike/);
    expect(da54.stock).toBe(STORE_T.ar.left(3));
    expect(items.filter((x) => x.href === "/store/gift-card")).toHaveLength(1);
    expect(items.find((x) => x.href === "/store/category/apparel")!.text).toBe(STORE_T.ar.count1);
  });
  it("links a /bikes model to the first product in staff's order that sells it, never a gift card", () => {
    const links = storeLinksByModel(STORE);
    expect(links.get(MODEL)).toBe("/store/da54");
    expect(links.has(MODEL2)).toBe(false);
    expect(links.size).toBe(1);
  });
});

describe("the header's search", () => {
  const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
  const db = (storeOn: boolean) => vi.fn(async (url: string) => {
    if (url.includes("/site_content?") && url.includes("key=not.like.journal")) {
      return json([{ key: "site.coming_soon", value: false }, { key: "store.open", value: storeOn }, { key: "pay.enabled", value: true }]);
    }
    if (url.includes("/store_products?")) return json([product(BIKE, "da54", { category: "bikes", price: 8000, sort: 1 })]);
    if (url.includes("/store_variants?")) return json([variant(1, BIKE, { size: "M", stock: 2 })]);
    return json([]);
  });
  beforeEach(() => {
    resetSiteContent();
    resetStore();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("finds the store's products, with price and stock, while the store is open", async () => {
    vi.stubGlobal("fetch", db(true));
    const items = await searchIndex("en");
    const da54 = items.find((x) => x.href === "/store/da54");
    expect(da54).toMatchObject({ title: "DA54", price: "⁦⃁ 8,000⁩", stock: "Only 2 left" });
    expect(items.some((x) => x.href === "/store/category/bikes")).toBe(true);
  });
  it("finds none of them while the store forwards to the Salla shop", async () => {
    vi.stubGlobal("fetch", db(false));
    expect((await searchIndex("fr")).some((x) => x.href.startsWith("/store"))).toBe(false);
  });
});

describe("the /bikes catalogue's store link (F12)", () => {
  const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
  const asked: string[] = [];
  const db = (storeOn: boolean) => vi.fn(async (url: string) => {
    asked.push(url);
    if (url.includes("/site_content?") && url.includes("key=not.like.journal")) {
      return json([{ key: "site.coming_soon", value: false }, { key: "store.open", value: storeOn }, { key: "pay.enabled", value: true }]);
    }
    if (url.includes("/store_products?")) return json([product(BIKE, "da54", { category: "bikes", price: 8000, sort: 1, catalog_model: MODEL })]);
    if (url.includes("/store_variants?")) return json([variant(1, BIKE, { size: "M", stock: 2 })]);
    return json([]);
  });
  beforeEach(() => {
    asked.length = 0;
    resetSiteContent();
    resetStore();
    resetCatalog();
    resetFares();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("never reads the store's tables while the store forwards to the Salla shop (production has none)", async () => {
    vi.stubGlobal("fetch", db(false));
    const s = await bikesState("en");
    expect(s.shop.size).toBe(0);
    expect(asked.some((u) => u.includes("/store_products") || u.includes("/store_variants"))).toBe(false);
  });
  it("links each model a product sells while the store is open", async () => {
    vi.stubGlobal("fetch", db(true));
    const s = await bikesState("en");
    expect(s.shop.get(MODEL)).toBe("/store/da54");
  });
  it("is read only while the site's own store is open, and drawn on the cards and the model page", () => {
    const data = readFileSync(here("../../components/bikes/catalog-data.ts"), "utf8");
    expect(data).toMatch(/storeOpen\(state\.content\) \? storeLinksByModel\(store\)/);
    expect(readFileSync(here("../../components/bikes/ModelCard.tsx"), "utf8")).toMatch(/seeInStore/);
    expect(readFileSync(here("../../components/bikes/ModelPage.tsx"), "utf8")).toMatch(/seeInStore/);
    for (const f of ["../../app/[locale]/bikes/page.tsx", "../../components/bikes/CategoryPage.tsx", "../../components/bikes/ModelPage.tsx"]) {
      expect(readFileSync(here(f), "utf8"), f).toMatch(/shop=\{s\.shop\.get\(m\.id\)\}/);
    }
  });
});
