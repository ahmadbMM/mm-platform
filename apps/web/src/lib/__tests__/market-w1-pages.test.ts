import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error -- the repo carries no types for react-dom; only renderToStaticMarkup is used, typed below
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";

// The site's links need next-intl's provider, which a bare render does not have: a plain <a> stands in for them.
vi.mock("@/i18n/navigation", () => ({
  Link: (props: { href: string; children?: ReactNode; scroll?: boolean; prefetch?: boolean }) => {
    const rest: Record<string, unknown> = { ...props };
    for (const k of ["children", "scroll", "prefetch"]) delete rest[k]; // the router's own, not an anchor's
    return createElement("a", rest, props.children);
  },
  useRouter: () => ({ push: () => undefined }),
}));

import { T } from "@/components/market/Market.text";
import { T as W } from "@/components/market/w1.text";
import Crumbs from "@/components/market/w1/Crumbs";
import ListingCard from "@/components/market/w1/ListingCard";
import ListingView from "@/components/market/w1/ListingView";
import ShopView from "@/components/market/w1/ShopView";
import { moreListings } from "@/components/market/w1/more";
import { mkCategory, type MkBrowse, type MkCard, type MkCategory, type MkListing, type MkListingMine, type MkShop } from "../market/core";
import { marketPaths, marketSearch } from "../market/hooks";
import { W1_NONE } from "../market/w1";
import { browseKept, indexKept } from "../market/w1-server";
import { resetMemo } from "../memo";

// Browsing the Marketplace (W1): the reads kept a minute, the sitemap's and the search's entries, "Show more", and
// what the card, a listing's page and a shop's page draw - read as the markup a server would send.
const render = renderUntyped as (el: ReactElement) => string;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const SRC = fileURLToPath(new URL("../..", import.meta.url));
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const cat = (slug: string, parent: string | null, name_en: string, name_ar: string): MkCategory =>
  mkCategory({ slug, parent, name_en, name_ar, sort: 10, tier: "open", needs_serial: false, min_photos: 1, facts: [] }) as MkCategory;
const CATS = [cat("cycling", null, "Cycling", "الدراجات الهوائية"), cat("running", null, "Running", "الجري"), cat("cycling-bike-road", "cycling", "Road bikes", "دراجات الطريق")];
const card = (patch: Partial<MkCard> = {}): MkCard => ({
  id: 12, title: "Trek Domane SL 5", price: 9500, negotiable: false, condition: "good", city: "jeddah", category: "cycling-bike-road", sport: "cycling", size: "54",
  photo: "l12/0123456789abcdef0123456789abcdef.jpg", status: "live", seller_kind: "private", shop: null, checked: false, published_at: "2026-11-20T09:00:00+00:00", ...patch,
});
const listing = (patch: Partial<MkListing> = {}): MkListing => ({
  id: 12, status: "live", title: "Trek Domane SL 5", description: "A road bike, ridden two seasons.", condition: "good", faults: "A scratch on the top tube.", price: 9500, negotiable: true,
  city: "jeddah", category: "cycling-bike-road", sport: "cycling", facts: { brand: "Trek", year: 2021, frame_size: "54", for_whom: "men" }, serial_masked: "•••X42", declarations: {},
  photos: ["l12/0123456789abcdef0123456789abcdef.jpg", "l12/fedcba9876543210fedcba9876543210.jpg"], seller: { kind: "private", name: null, shop: null }, checked_at: null,
  published_at: "2026-11-20T09:00:00+00:00", sold_at: null, mine: false, own: null, thread_id: null, reported: false, can_message: true, ...patch,
});
const mine = (patch: Partial<MkListingMine> = {}): MkListingMine => ({
  id: 12, status: "hidden", seller_kind: "private", category: "cycling-bike-road", sport: "cycling", title: "Trek Domane SL 5", description: "A road bike.", condition: "good", faults: null,
  price: 9500, negotiable: true, city: "jeddah", facts: {}, serial: "WTU123X42", declarations: {}, photos: [], name_mode: "none", display_name: null, hold_reason: null,
  hidden_reason: "The photos show another bike.", published_at: "2026-11-20T09:00:00+00:00", expires_at: "2027-01-19T09:00:00+00:00", sold_at: null, sold_price: null,
  commission_pct: null, commission_due: null, commission_received: false, checked_at: null, renewable: false, threads: 0, unread: 0, created_at: "2026-11-20T09:00:00+00:00",
  updated_at: "2026-11-20T09:00:00+00:00", ...patch,
});
const SHOP: MkShop = { slug: "wheel-house", name_en: "Wheel House Cycles", name_ar: "بيت العجلات", logo: null, cr_no: "4030123456", cr_activity: "Retail sale of bicycles", vat_no: "310123456700003",
  city: "jeddah", address: "Prince Sultan Road", map_url: "https://maps.app.goo.gl/abc", about_en: "A family bike shop.", about_ar: null, returns_en: "Seven days, unused.", returns_ar: null,
  sells: "Road bikes", approved_at: "2026-11-01T10:00:00+00:00" };
const view = (l: MkListing, similar: MkCard[] = []) =>
  render(createElement(ListingView, { l, cats: CATS, locale: "en", t: T.en, w: W.en, signedIn: false, companyWa: "966500000000", similar }));
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("the reads the pages share", () => {
  type Call = { url: string; body: Record<string, unknown> | null };
  let calls: Call[] = [];
  const stub = (answer: (c: Call) => Response) => {
    calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const c = { url: String(url), body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null };
      calls.push(c);
      return answer(c);
    }));
  };
  const rpc = (fn: string) => calls.filter((c) => c.url.endsWith(`/rpc/${fn}`));
  const page: MkBrowse = { items: [card()], next: "c_24", sports: ["cycling"], categories: [] };
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    resetMemo("market:");
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetMemo("market:"); });

  it("keep the first page of a common search a minute, and never a search someone typed", async () => {
    stub(() => json(page));
    expect(await browseKept({ sport: "cycling" })).toMatchObject({ ok: true, data: { next: "c_24" } });
    await browseKept({ sport: "cycling" });
    expect(rpc("market_browse")).toHaveLength(1);
    await browseKept({ sport: "running" });
    expect(rpc("market_browse")).toHaveLength(2);
    await browseKept({ q: "trek" });
    await browseKept({ q: "trek" });
    await browseKept({ sport: "cycling", after: "c_24" });
    expect(rpc("market_browse")).toHaveLength(5);
    expect(rpc("market_browse")[2].body).toEqual({ p: { q: "trek" } });
  });
  it("say why a kept read failed: a database without the marketplace is not an error to try again", async () => {
    stub(() => json({ code: "PGRST202", message: "Could not find the function public.market_browse" }, 404));
    expect(await browseKept({})).toMatchObject({ ok: false, error: "absent", status: 404 });
    resetMemo("market:");
    stub(() => json({ message: "boom" }, 500));
    expect(await browseKept({})).toMatchObject({ ok: false, error: "generic" });
    resetMemo("market:");
    stub(() => json(page));
    expect(await browseKept({})).toMatchObject({ ok: true });
  });
  it("list the Marketplace's addresses and search entries from one read of market_index", async () => {
    stub(() => json({ listings: [{ id: 12, title: "Trek Domane" }], shops: [{ slug: "wheel-house", name_en: "Wheel House Cycles", name_ar: "بيت العجلات" }] }));
    expect(await marketPaths(null)).toEqual(["/marketplace", "/marketplace/rules", "/marketplace/shop/wheel-house", "/marketplace/12"]);
    expect(await marketSearch("ar")).toEqual([
      { title: "بيت العجلات", text: "متجر في السوق", href: "/marketplace/shop/wheel-house", words: expect.stringContaining("wheel house cycles") },
      { title: "Trek Domane", text: "إعلان في السوق", href: "/marketplace/12", words: "trek domane" },
    ]);
    expect((await marketSearch("en"))[1].text).toBe("Marketplace listing");
    expect(rpc("market_index")).toHaveLength(1);
    expect(rpc("market_index")[0].body).toEqual({});
  });
  it("leave the two fixed pages in the sitemap and nothing in the search when the database does not answer", async () => {
    stub(() => json({ message: "boom" }, 500));
    expect(await indexKept()).toBeNull();
    expect(await marketPaths(null)).toEqual(["/marketplace", "/marketplace/rules"]);
    expect(await marketSearch("en")).toEqual([]);
  });

  describe("Show more", () => {
    const cats = [{ slug: "cycling", parent: null, name_en: "Cycling", name_ar: "الدراجات", sort: 1, tier: "open", needs_serial: false, min_photos: 1, facts: [] }];
    const answer = (c: Call) => (c.url.includes("/rest/v1/market_categories") ? json(cats) : json({ items: [card({ id: 30 })], next: null, sports: ["cycling"], categories: [] }));
    it("asks for the next page of the same search, each value checked", async () => {
      stub(answer);
      const r = await moreListings({ filters: { sport: "cycling", seller: "shop", min: "900", max: 100, q: "  trek ", city: "atlantis", sort: "price_desc" }, shop: null, after: "c_24" });
      expect(r).toEqual({ ok: true, items: [expect.objectContaining({ id: 30 })], next: null });
      expect(rpc("market_browse")[0].body).toEqual({ p: { sport: "cycling", kind: "shop", price_min: 100, price_max: 900, q: "trek", sort: "price_desc", after: "c_24" } });
    });
    it("asks for nothing without a cursor, and never for anything the page could not ask", async () => {
      stub(answer);
      for (const bad of [null, {}, { after: "" }, { after: 5 }, { after: "x".repeat(401) }, "after=c_24"]) expect(await moreListings(bad)).toEqual({ ok: false, error: "invalid", detail: "" });
      expect(rpc("market_browse")).toHaveLength(0);
      await moreListings({ filters: { sport: "nope", p_id: "c1", limit: 500, shop: "other" }, after: "c_24", limit: 500, p_token: "t" });
      expect(rpc("market_browse")[0].body).toEqual({ p: { after: "c_24" } });
    });
    it("on a shop's page asks for that shop's listings by sport, and nothing else", async () => {
      stub(answer);
      await moreListings({ filters: { sport: "cycling", seller: "private", q: "trek", min: 5 }, shop: "wheel-house", after: "c_24" });
      expect(rpc("market_browse")[0].body).toEqual({ p: { sport: "cycling", shop: "wheel-house", after: "c_24" } });
      await moreListings({ filters: W1_NONE, shop: "Not A Slug", after: "c_24" });
      expect(rpc("market_browse")[1].body).toEqual({ p: { after: "c_24" } });
    });
    it("answers a refusal as its error id, never the database's words", async () => {
      stub((c) => (c.url.includes("/rest/v1/market_categories") ? json(cats) : json({ message: "relation \"market_listings\" does not exist" }, 500)));
      expect(await moreListings({ filters: {}, after: "c_24" })).toEqual({ ok: false, error: "generic", detail: "" });
    });
  });
});

describe("a listing's card", () => {
  const draw = (c: MkCard, locale = "en") => render(createElement(ListingCard, { c, t: locale === "ar" ? T.ar : T.en, w: locale === "ar" ? W.ar : W.en, locale }));
  it("shows the photo, the title, the price, the size, the condition, the city and who is selling", () => {
    const html = draw(card({ negotiable: true, checked: true }));
    expect(html).toContain('href="/marketplace/12"');
    expect(html).toContain("/mkt/l12/0123456789abcdef0123456789abcdef.jpg?w=480");
    for (const text of ["Trek Domane SL 5", "9,500", "Negotiable", "Good", "Jeddah", "Private seller", "Checked by our team"]) expect(html).toContain(text);
    expect(html).toContain('Size <bdi dir="ltr">54</bdi>');
    expect(html).toContain('dir="auto"');
  });
  it("names the shop on a shop's card, and never a person", () => {
    const html = draw(card({ seller_kind: "shop", shop: { slug: "wheel-house", name_en: "Wheel House Cycles", name_ar: "بيت العجلات", logo: null } }));
    expect(html).toContain("Wheel House Cycles");
    expect(html).toContain("Sold by a shop");
    expect(draw(card({ seller_kind: "shop", shop: { slug: "wheel-house", name_en: "Wheel House Cycles", name_ar: "بيت العجلات", logo: null } }), "ar")).toContain("بيت العجلات");
    // a private seller's card has no name to show, whatever the answer carried
    const leaked = draw({ ...card(), seller: { name: "Sara A." }, display_name: "Sara A." } as unknown as MkCard);
    expect(leaked).not.toContain("Sara");
  });
  it("marks a reserved listing, draws the no-photo mark, and escapes what the seller wrote", () => {
    expect(draw(card({ status: "reserved" }))).toContain("Reserved");
    expect(draw(card())).not.toContain("Reserved");
    expect(draw(card({ photo: null }))).toContain('aria-label="No photo"');
    const html = draw(card({ title: "<img src=x onerror=alert(1)>", size: null }));
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    expect(html).not.toContain("Size");
  });
});

describe("a listing's page", () => {
  it("draws the trail, the photos, the price, the facts, the faults, the description and the masked serial number", () => {
    const html = view(listing());
    expect(html).toContain('aria-label="Breadcrumb"');
    for (const href of ['href="/marketplace"', 'href="/marketplace?sport=cycling"', 'href="/marketplace?type=cycling-bike-road"']) expect(html).toContain(href);
    for (const text of ["9,500", "Negotiable", "Known faults", "A scratch on the top tube.", "Cycling · Road bikes", "Brand", "Trek", "Year", "2021", "Frame size", "Made for", "Men",
      "Frame or serial number", "•••X42", "Description", "A road bike, ridden two seasons.", "Photo 1 of 2", "Enlarge photo", "Share", "Report"]) expect(html).toContain(text);
    expect(html).not.toContain("WTU123X42");
  });
  it("says who is selling: the label, the chosen name or none, a shop's name linking to its page, and the check's date", () => {
    const none = view(listing());
    expect(none).toContain("Private seller");
    expect(none).not.toContain("mk-w1-seller-name");
    const named = view(listing({ seller: { kind: "private", name: "Sara A.", shop: null }, checked_at: "2026-11-18T09:00:00+00:00" }));
    expect(named).toContain("Sara A.");
    expect(named).toContain("Checked by our team on 18 Nov 2026");
    const shop = view(listing({ seller: { kind: "shop", name: null, shop: { slug: "wheel-house", name_en: "Wheel House Cycles", name_ar: null, logo: null } } }));
    expect(shop).toContain('href="/marketplace/shop/wheel-house"');
    expect(shop).toContain("Sold by a shop");
    expect(view(listing({ seller: { kind: "company", name: null, shop: null } }))).toContain("Sold by MicroMobility");
  });
  it("offers the way to reach the seller twice at most, in the page, and never once it is sold", () => {
    const html = view(listing());
    expect(count(html, 'data-mk-placeholder="contact"')).toBe(2);
    expect(count(view(listing({ status: "reserved" })), 'data-mk-placeholder="contact"')).toBe(2);
    expect(view(listing({ status: "reserved" }))).toContain("Reserved");
    const sold = view(listing({ status: "sold", can_message: false, sold_at: "2026-11-19T09:00:00+00:00" }));
    expect(sold).toContain("Sold");
    expect(count(sold, 'data-mk-placeholder="contact"')).toBe(0);
    // MicroMobility's own listing, sold: its WhatsApp button goes too
    expect(count(view(listing({ status: "sold", can_message: false, seller: { kind: "company", name: null, shop: null } })), 'data-mk-placeholder="contact"')).toBe(0);
  });
  it("shows its seller the state nobody else is shown, staff's reason and the way to their listings", () => {
    const hidden = view(listing({ status: "hidden", mine: true, can_message: false, own: mine() }));
    for (const text of ["This is your listing", "Removed by our team", "Reason", "The photos show another bike.", 'href="/marketplace/mine"']) expect(hidden).toContain(text);
    expect(hidden).not.toContain('href="/marketplace/sell/12"');
    expect(hidden).not.toContain('data-mk-placeholder="report"');
    expect(count(hidden, 'data-mk-placeholder="contact"')).toBe(0);
    const live = view(listing({ mine: true, can_message: false, own: mine({ status: "live", hidden_reason: null }) }));
    for (const text of ["On sale", "On sale until 19 Jan 2027", 'href="/marketplace/sell/12"']) expect(live).toContain(text);
    expect(view(listing({ status: "expired", mine: true, can_message: false, own: mine({ status: "expired" }) }))).toContain("Expired");
    expect(view(listing())).not.toContain("This is your listing");
  });
  it("lists the seller's declarations for an e-bike, and similar items when there are any", () => {
    const html = view(listing({ declarations: { complete: true, unmodified: true, speed_25: true, charger: false } }), [card({ id: 40, title: "Another road bike" })]);
    for (const text of ["Declared by the seller", "Complete device", "Not modified", "Top assisted speed 25 km/h or less", "Similar items", "Another road bike"]) expect(html).toContain(text);
    expect(html).not.toContain("Original charger included");
    expect(view(listing())).not.toContain("Similar items");
  });
  it("escapes everything the seller wrote", () => {
    const html = view(listing({ title: "<script>alert(1)</script>", description: "<b onclick=x>bold</b>", faults: "</p><iframe>", facts: { brand: "<i>x</i>" } }));
    for (const raw of ["<script>alert(1)", "<b onclick", "<iframe>", "<i>x</i>"]) expect(html).not.toContain(raw);
  });
});

describe("a shop's page", () => {
  const draw = (list: MkBrowse | null, patch: Partial<MkShop> = {}, sport: string | null = null) =>
    render(createElement(ShopView, { shop: { ...SHOP, ...patch }, cats: CATS, filters: { ...W1_NONE, sport }, list, fail: list ? null : { error: "generic", detail: "" }, locale: "en", t: T.en, w: W.en, signedIn: false }));
  const some: MkBrowse = { items: [card({ seller_kind: "shop", shop: SHOP })], next: null, sports: ["cycling", "running"], categories: [] };
  it("shows the business's own details: its registration and VAT numbers, its address and its return terms", () => {
    const html = draw(some);
    for (const text of ["Wheel House Cycles", "Jeddah", "About the shop", "A family bike shop.", "Commercial registration", "4030123456", "Registered activity", "VAT number", "310123456700003",
      "Prince Sultan Road", "Return terms", "Seven days, unused.", "What it sells", "On sale from this shop", "Sell an item"]) expect(html).toContain(text);
    expect(draw(some, { vat_no: null, about_en: null, returns_en: null })).not.toMatch(/VAT number|About the shop|Return terms/);
  });
  it("never carries the shop's phone or WhatsApp: they are asked for on a tap", () => {
    const html = draw(some, { ...({ phone: "966500000001", whatsapp: "966500000002" } as Partial<MkShop>) });
    expect(html).not.toMatch(/96650000000[12]/);
  });
  it("filters its listings by sport when it sells in more than one, and says when it has none", () => {
    const html = draw(some);
    expect(html).toContain('href="/marketplace/shop/wheel-house?sport=running"');
    expect(draw({ ...some, sports: ["cycling"] })).not.toContain("?sport=");
    expect(draw({ items: [], next: null, sports: [], categories: [] })).toContain("This shop has nothing on sale right now.");
    expect(draw({ items: [], next: null, sports: ["cycling", "running"], categories: [] }, {}, "running")).toContain("All listings");
    expect(draw(null)).toContain("The listings could not be loaded.");
  });
});

describe("the trail", () => {
  it("links every step but the page itself", () => {
    const html = render(createElement(Crumbs, { items: [{ href: "/marketplace", label: "Marketplace" }], current: "Trek <Domane>", label: "Breadcrumb" }));
    expect(html).toContain('<a href="/marketplace">Marketplace</a>');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Trek &lt;Domane&gt;");
  });
});

describe("the house rules, read from the files", () => {
  const dir = "components/market/w1";
  const own = [...readdirSync(join(SRC, dir)).map((f) => `${dir}/${f}`), "components/market/w1.css", "components/market/w1.text.ts", "lib/market/w1.ts", "lib/market/w1-seo.ts",
    "lib/market/w1-gallery.ts", "lib/market/w1-server.ts", "lib/market/hooks.ts", "app/[locale]/marketplace/page.tsx", "app/[locale]/marketplace/[id]/page.tsx",
    "app/[locale]/marketplace/[id]/not-found.tsx", "app/[locale]/marketplace/shop/[slug]/page.tsx"];
  const css = read("components/market/w1.css");
  // the rules without their comments
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("nothing is built on the store or on payments", () => {
    for (const f of own) expect(read(f), f).not.toMatch(/components\/store|lib\/store|lib\/pay|from "[^"]*\/pay\//);
  });
  it("no pictographs anywhere: every mark is drawn", () => {
    for (const f of own) expect(read(f), f).not.toMatch(/[☀-➿\u{1F000}-\u{1FAFF}]/u);
  });
  it("nothing is pinned to the bottom of the screen, and the only fixed layer is the photo viewer", () => {
    expect(rules).not.toMatch(/(?:^|[\s;{])bottom\s*:/);
    expect(rules).not.toMatch(/inset-block-end\s*:\s*0/);
    const fixed = rules.split("}").filter((r) => /position:\s*fixed/.test(r));
    expect(fixed).toHaveLength(1);
    expect(fixed[0]).toContain(".mk-w1-view");
    for (const r of rules.split("}").filter((x) => /position:\s*sticky/.test(x))) expect(r).toMatch(/inset-block-start:\s*76px/);
  });
  it("the styles are this builder's own classes, mirror in Arabic and name a token for every colour", () => {
    expect(rules).not.toMatch(/(?:margin|padding|border)-(?:left|right)\b/);
    expect(rules).not.toMatch(/(?:^|[\s;{])(?:left|right)\s*:/);
    // a side is named only where the page's own direction is (a short text someone wrote, started on the page's side)
    for (const r of rules.split("}").filter((x) => /text-align:\s*(?:left|right)|inset\(/.test(x))) expect(r.trim()).toMatch(/^(?:\[dir="(?:ltr|rtl)"\]|\.mk-w1-meta \{)/);
    // a colour is a token, or the cards' own white
    expect(rules.replace(/#fff\b/g, "")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    for (const m of rules.matchAll(/\.(mk-[a-z0-9-]+)/g)) {
      expect(m[1], m[1]).toMatch(/^mk-w1-|^mk-(?:card|box|btn|btn2|chips?|field|pop-title|user|ic|tags|tag|amt|photo)$/);
    }
  });
  it("every tap target the styles size is 44px or more", () => {
    for (const m of rules.matchAll(/min-height:\s*(\d+)px/g)) if (Number(m[1]) > 8) expect(Number(m[1])).toBeGreaterThanOrEqual(44);
    expect(rules).toMatch(/\.mk-w1-gal-arrow\s*\{[^}]*width:\s*44px;\s*height:\s*44px/);
    expect(rules).toMatch(/\.mk-w1-view-btn\s*\{[^}]*width:\s*48px;\s*height:\s*48px/);
  });
  it("a listing that is not answered is not found, a failed read is an error, and its page is never the site as seller", () => {
    const page = read("app/[locale]/marketplace/[id]/page.tsx");
    expect(page).toMatch(/if \(n === null\) notFound\(\)/);
    expect(page).toMatch(/if \(l === null\) notFound\(\)/);
    expect(page).toMatch(/throw new Error/);
    expect(page).toContain("mkListingGet(id, await mkSession())");
    expect(page).toContain("w1ProductData");
    expect(page).toMatch(/noindex: !w1Indexable/);
    expect(read("app/[locale]/marketplace/[id]/not-found.tsx")).toContain("<Gone />");
    const shop = read("app/[locale]/marketplace/shop/[slug]/page.tsx");
    expect(shop).toMatch(/if \(shop === null\) notFound\(\)/);
    expect(shop).toMatch(/noindex: !marketplaceOn\(content\)/);
    expect(read("app/[locale]/marketplace/page.tsx")).toMatch(/noindex: !marketplaceOn\(content\)/);
  });
  it("the list grows by its button only, and the further filters open in the one pop-up or beside the grid", () => {
    const results = read("components/market/w1/Results.tsx");
    expect(results).not.toMatch(/IntersectionObserver|onScroll|addEventListener\("scroll"/);
    expect(results).toContain("moreListings");
    const browse = read("components/market/w1/Browse.tsx");
    expect(browse).toContain("<MkModal");
    expect(browse).toContain('"(min-width: 1000px)"');
    expect(browse).toMatch(/aria-expanded=\{open\}/);
  });
  it("Arabic and English say the same things", () => {
    const keys = (v: unknown, at = ""): string[] => (v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => keys(x, `${at}.${k}`)) : [at]);
    expect(keys(W.ar)).toEqual(keys(W.en));
    for (const k of keys(W.en)) {
      const pick = (o: unknown) => k.slice(1).split(".").reduce<unknown>((a, p) => (a as Record<string, unknown>)[p], o);
      const en = pick(W.en), ar = pick(W.ar);
      expect(typeof ar, k).toBe(typeof en);
      if (typeof ar === "string" && k !== ".sellers.company") expect(ar, k).toMatch(/[؀-ۿ]/);
    }
    expect(W.en.photoOf(2, 5)).toBe("Photo 2 of 5");
    expect(W.ar.photoOf(2, 5)).toBe("الصورة 2 من 5");
    expect(W.ar.filtersOn(3)).toContain("3");
  });
});
