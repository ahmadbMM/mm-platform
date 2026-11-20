import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement, type ReactElement } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ShopFacts from "@/components/market/w4/ShopFacts";
import ShopState from "@/components/market/w4/ShopState";
import { T as M } from "@/components/market/Market.text";
import { T } from "@/components/market/w4.text";
import { siteSchema } from "@/content/pages/site";
import { POST as applyPost } from "../../app/api/market/shop/apply/route";
import { GET as mineGet } from "../../app/api/market/shop/mine/route";
import { pageOf } from "../links";
import { MK_RULES, type MkShopMine } from "../market/core";
import {
  W4_KEYS, W4_LOCKED, W4_MAX, w4Blank, w4BodyFields, w4CanApply, w4CanEdit, w4Changed, w4Cities, w4CrOk, w4Digits, w4DraftKey, w4DraftRead,
  w4DraftWrite, w4EditFieldsOf, w4FieldsOf, w4FooterWithRules, w4FormOf, w4Issues, w4LogoOk, w4MapOk, w4NeedAgree, w4Phone, w4PhoneLocal,
  w4PhoneShown, w4RefusalField, w4RefusalIssue, w4State, w4StatusClass, w4VatOk, w4Wa, type W4Form,
} from "../market/w4";
import { w4DraftTag, w4ShopData } from "../market/w4-server";

// The shop application and My shop (W4): what the form sends, what it refuses early, how a refusal from the database
// finds its field, the two routes, and the links that lead here. Nothing is read or written anywhere: every database
// call is a stub.

const render = renderUntyped as (el: ReactElement) => string;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
const LOGO = `s12/${"ab".repeat(16)}.jpg`;

const form = (over: Partial<W4Form> = {}): W4Form => ({
  ...w4Blank(), name_en: "Corniche Cycles", cr_no: "4030123456", cr_activity: "Retail sale of bicycles", city: "jeddah", ...over,
});
const shop = (over: Partial<MkShopMine> = {}): MkShopMine => ({
  id: 12, slug: "corniche-cycles", status: "pending", decision_note: null, approved_at: null, agreement_version: "2026-11-21", live: 0, live_cap: 20,
  created_at: "2026-11-20T10:00:00+00:00", updated_at: "2026-11-20T10:00:00+00:00",
  name_en: "Corniche Cycles", name_ar: "دراجات الكورنيش", cr_no: "4030123456", cr_activity: "Retail sale of bicycles", vat_no: "310123456700003",
  city: "jeddah", address: "Prince Sultan Road", map_url: "https://maps.app.goo.gl/abc123", phone: "966126061234", whatsapp: "966501234567",
  about_en: "Road and gravel bikes.", about_ar: null, returns_en: "Returns within 7 days, unused.", returns_ar: null, sells: "Bikes and parts", logo: LOGO,
  ...over,
});

describe("a shop's phone numbers", () => {
  it("are read from the ways people write them, and kept with the country code first", () => {
    for (const v of ["0501234567", "501234567", "+966 50 123 4567", "00966501234567", "966-50-123-4567", "٠٥٠١٢٣٤٥٦٧"]) expect(w4Phone(v), v).toBe("966501234567");
    expect(w4Phone("012 606 1234")).toBe("966126061234");
    for (const v of ["", "12345", "05012345678", "+1 415 555 0100", "abc"]) expect(w4Phone(v), v).toBeNull();
  });
  it("take only a Saudi mobile for WhatsApp", () => {
    expect(w4Wa("0501234567")).toBe("966501234567");
    expect(w4Wa("0126061234")).toBeNull();
    expect(w4Wa("")).toBeNull();
  });
  it("are shown as their owner types them in the form, and spaced on a page", () => {
    expect(w4PhoneLocal("966501234567")).toBe("0501234567");
    expect(w4PhoneLocal(null)).toBe("");
    expect(w4PhoneShown("966501234567")).toBe("+966 50 123 4567");
    expect(w4PhoneShown(null)).toBe("");
    expect(w4Digits("٤٠٣٠ ۱۲۳")).toBe("4030123");
  });
});

describe("a shop's business numbers and links", () => {
  it("take a ten-digit commercial registration number", () => {
    expect(w4CrOk("4030123456")).toBe(true);
    expect(w4CrOk("٤٠٣٠١٢٣٤٥٦")).toBe(true);
    for (const v of ["403012345", "40301234567", "40301234a6", ""]) expect(w4CrOk(v), v).toBe(false);
  });
  it("take a fifteen-digit VAT number that starts and ends with 3", () => {
    expect(w4VatOk("310123456700003")).toBe(true);
    for (const v of ["210123456700003", "310123456700004", "31012345670003", ""]) expect(w4VatOk(v), v).toBe(false);
  });
  it("take only the map links the database takes", () => {
    for (const v of ["https://maps.app.goo.gl/abc123", "https://goo.gl/maps/abc", "https://www.google.com/maps/place/x", "https://maps.google.com/?q=1,2"]) expect(w4MapOk(v), v).toBe(true);
    for (const v of ["http://maps.app.goo.gl/abc", "https://evil.example/maps.app.goo.gl/", "https://maps.app.goo.gl.evil.example/x", "maps.app.goo.gl/abc", "https://maps.app.goo.gl/a b", `https://maps.app.goo.gl/${"a".repeat(300)}`]) expect(w4MapOk(v), v).toBe(false);
  });
  it("take a logo only from a shop's own folder of the Marketplace's photos", () => {
    expect(w4LogoOk(LOGO)).toBe(true);
    for (const v of [`l12/${"ab".repeat(16)}.jpg`, "/media/market/logo.png", "https://example.com/logo.jpg", "", null]) expect(w4LogoOk(v)).toBe(false);
  });
});

describe("the application form", () => {
  it("asks for the trade name, the registration and its activity, the city and the agreement, and nothing else", () => {
    expect(w4Issues(w4Blank(), { needAgree: true, agree: false }).map((i) => `${i.field}:${i.key}`)).toEqual([
      "name_en:required", "cr_no:required", "cr_activity:required", "city:city", "agreement:agree",
    ]);
    expect(w4Issues(form(), { needAgree: true, agree: true })).toEqual([]);
  });
  it("says what is wrong with a value, one thing a field, in the page's order", () => {
    const f = form({ name_en: "A", cr_no: "12345", vat_no: "123", map_url: "https://example.com/map", phone: "12", whatsapp: "0126061234", city: "atlantis" });
    expect(w4Issues(f).map((i) => `${i.field}:${i.key}`)).toEqual(["name_en:short", "cr_no:cr", "vat_no:vat", "city:city", "map_url:map", "phone:phone", "whatsapp:whatsapp"]);
  });
  it("refuses a link or a phone number in the shop's sentences, as the database does", () => {
    expect(w4Issues(form({ about_en: "See www.corniche.example for more" })).map((i) => `${i.field}:${i.key}`)).toEqual(["about_en:link"]);
    expect(w4Issues(form({ sells: "Bikes. Call 0501234567" })).map((i) => `${i.field}:${i.key}`)).toEqual(["sells:phone_text"]);
    expect(w4Issues(form({ returns_ar: "اتصل على ٠٥٠١٢٣٤٥٦٧" })).map((i) => `${i.field}:${i.key}`)).toEqual(["returns_ar:phone_text"]);
    // the address and the registered activity are not sentences the database reads for them
    expect(w4Issues(form({ address: "Building 123456789, Prince Sultan Road" }))).toEqual([]);
  });
  it("refuses a text longer than its column", () => {
    expect(w4Issues(form({ about_en: "a".repeat(601) })).map((i) => `${i.field}:${i.key}`)).toEqual(["about_en:long"]);
    expect(w4Issues(form({ about_en: "a".repeat(600) }))).toEqual([]);
    expect(W4_MAX.sells).toBe(300);
  });
  it("does not judge what an approved shop's owner cannot change", () => {
    expect(W4_LOCKED).toEqual(["name_en", "cr_no", "cr_activity", "vat_no", "city"]);
    const f = form({ name_en: "", cr_no: "", cr_activity: "", city: "", vat_no: "1" });
    expect(w4Issues(f, { locked: true })).toEqual([]);
    expect(w4Issues({ ...f, whatsapp: "12" }, { locked: true }).map((i) => i.field)).toEqual(["whatsapp"]);
  });
  it("sends cleaned values, numbers as digits with the country code, and null for what is empty", () => {
    const sent = w4FieldsOf(form({ name_en: "  Corniche   Cycles ", cr_no: "٤٠٣٠١٢٣٤٥٦", vat_no: "", phone: "012 606 1234", whatsapp: "050 123 4567", about_en: "Road\nand gravel", logo: LOGO }), "2026-11-21");
    expect(sent).toEqual({
      name_en: "Corniche Cycles", name_ar: null, cr_no: "4030123456", cr_activity: "Retail sale of bicycles", vat_no: null, city: "jeddah",
      address: null, map_url: null, phone: "966126061234", whatsapp: "966501234567", about_en: "Road and gravel", about_ar: null,
      returns_en: null, returns_ar: null, sells: null, logo: LOGO, agreement: "2026-11-21",
    });
    expect(w4FieldsOf(form({ logo: "https://example.com/x.jpg" }), "v").logo).toBeNull();
  });
  it("sends an approved shop's locked values exactly as the database has them", () => {
    const s = shop({ status: "approved", vat_no: null });
    const sent = w4EditFieldsOf(s, { ...w4FormOf(s), name_en: "Another Name", cr_no: "1111111111", city: "riyadh", vat_no: "310123456700003", about_ar: "دراجات" }, "2026-11-21");
    expect(sent).toMatchObject({ name_en: "Corniche Cycles", cr_no: "4030123456", cr_activity: "Retail sale of bicycles", vat_no: null, city: "jeddah", about_ar: "دراجات" });
  });
  it("opens with a shop's own values, and knows when something was changed", () => {
    const s = shop();
    const f = w4FormOf(s);
    expect(f).toMatchObject({ name_en: "Corniche Cycles", name_ar: "دراجات الكورنيش", phone: "0126061234", whatsapp: "0501234567", vat_no: "310123456700003", logo: LOGO, about_ar: "" });
    expect(Object.keys(f).sort()).toEqual([...W4_KEYS].sort());
    expect(w4FormOf(null)).toEqual(w4Blank());
    expect(w4Changed(f, { ...f })).toBe(false);
    expect(w4Changed(f, { ...f, phone: "+966 12 606 1234" })).toBe(false);
    expect(w4Changed(f, { ...f, sells: "Bikes" })).toBe(true);
  });
  it("lists the cities in the reader's alphabet", () => {
    expect(w4Cities("en")[0]).toEqual({ key: "jeddah", name: "Jeddah" });
    expect(w4Cities("ar")[0]).toEqual({ key: "jeddah", name: "جدة" });
    expect(w4Cities("fr")[0].name).toBe("Jeddah");
    expect(w4Cities("en")).toHaveLength(31);
  });
});

describe("the application kept in the browser", () => {
  const now = Date.UTC(2026, 10, 20);
  it("is kept under the account's own name for it", () => {
    expect(w4DraftKey("0123456789abcdef01234567")).toBe("mk-w4-shop:0123456789abcdef01234567");
    expect(w4DraftKey("../etc")).toBe("mk-w4-shop:x");
  });
  it("comes back as typed, without the logo, laid over the shop as the database has it", () => {
    const typed = form({ sells: "Bikes", phone: "050", logo: LOGO });
    const back = w4DraftRead(w4DraftWrite(typed, now), w4Blank(), { now: now + 1000 });
    expect(back).toEqual({ ...typed, logo: "" });
    const over = w4DraftRead(w4DraftWrite(form({ name_en: "New Name" }), now), w4FormOf(shop()), { now });
    expect(over.name_en).toBe("New Name");
    expect(over.logo).toBe(LOGO);
  });
  it("is dropped after thirty days, and when it cannot be read", () => {
    const base = w4Blank();
    expect(w4DraftRead(w4DraftWrite(form(), now), base, { now: now + 31 * 86_400_000 })).toBe(base);
    for (const raw of [null, "", "not json", "[]", JSON.stringify({ at: now }), JSON.stringify({ at: "x", form: {} })]) expect(w4DraftRead(raw, base, { now })).toBe(base);
  });
  it("takes only the form's own text, a city of the list, and never a locked value of an approved shop", () => {
    const raw = JSON.stringify({ at: now, form: { name_en: "Typed", city: "atlantis", sells: 5, extra: "x", about_en: "a".repeat(5000), cr_no: "9999999999", address: "Typed road" } });
    const open = w4DraftRead(raw, form(), { now });
    expect(open).toMatchObject({ name_en: "Typed", city: "jeddah", sells: "", about_en: "", cr_no: "9999999999", address: "Typed road" });
    expect("extra" in open).toBe(false);
    const locked = w4DraftRead(raw, form(), { now, locked: true });
    expect(locked).toMatchObject({ name_en: "Corniche Cycles", cr_no: "4030123456", address: "Typed road" });
  });
  it("gets its name from the session, so another account on the same phone never reads it", async () => {
    const a = await w4DraftTag({ id: "c1", token: "a".repeat(32) });
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(await w4DraftTag({ id: "c1", token: "a".repeat(32) })).toBe(a);
    expect(await w4DraftTag({ id: "c2", token: "a".repeat(32) })).not.toBe(a);
    expect(await w4DraftTag({ id: "c1", token: "b".repeat(32) })).not.toBe(a);
    expect(a).not.toContain("c1");
  });
});

describe("a refusal about the application", () => {
  it("finds the field the database named", () => {
    expect(w4RefusalField("input", "cr_no")).toBe("cr_no");
    expect(w4RefusalField("link", "about_en")).toBe("about_en");
    expect(w4RefusalField("phone", "sells")).toBe("sells");
    expect(w4RefusalField("dup", "cr")).toBe("cr_no");
    expect(w4RefusalField("terms", "")).toBe("agreement");
    expect(w4RefusalField("input", "locked")).toBeNull();
    expect(w4RefusalField("limit", "shop")).toBeNull();
    expect(w4RefusalField("input", "constructor")).toBeNull();
  });
  it("reads in the form's own words where the form has them", () => {
    expect(w4RefusalIssue("input", "cr_no")).toBe("cr");
    expect(w4RefusalIssue("input", "vat_no")).toBe("vat");
    expect(w4RefusalIssue("input", "map_url")).toBe("map");
    expect(w4RefusalIssue("input", "whatsapp")).toBe("whatsapp");
    expect(w4RefusalIssue("link", "about_en")).toBe("link");
    expect(w4RefusalIssue("phone", "sells")).toBe("phone_text");
    expect(w4RefusalIssue("limit", "shop")).toBeNull();
    for (const k of ["required", "short", "long", "cr", "vat", "city", "map", "phone", "whatsapp"]) {
      expect(T.en.need[k], k).toBeTruthy();
      expect(T.ar.need[k], k).toBeTruthy();
    }
  });
});

describe("an application's state", () => {
  it("decides what its owner may do", () => {
    expect(w4State(null)).toBe("none");
    expect(w4State(shop({ status: "rejected" }))).toBe("rejected");
    expect(w4State({ status: "weird" as never })).toBe("none");
    expect(["none", "pending", "rejected", "approved", "suspended"].map((s) => w4CanApply(s as never))).toEqual([true, true, true, false, false]);
    expect(["none", "pending", "rejected", "approved", "suspended"].map((s) => w4CanEdit(s as never))).toEqual([false, false, false, true, false]);
    expect((["pending", "approved", "rejected", "suspended"] as const).map(w4StatusClass)).toEqual(["held", "live", "hidden", "hidden"]);
  });
  it("asks for the agreement on every application, and on an approved shop's edit only after the rules changed", () => {
    expect(w4NeedAgree(null, "2026-11-21")).toBe(true);
    expect(w4NeedAgree(shop({ status: "rejected" }), "2026-11-21")).toBe(true);
    expect(w4NeedAgree(shop({ status: "approved" }), "2026-11-21")).toBe(false);
    expect(w4NeedAgree(shop({ status: "approved" }), "2027-01-01")).toBe(true);
  });
  it("has one sentence and one chip for each state, in English and Arabic", () => {
    for (const s of ["none", "pending", "approved", "rejected", "suspended"]) { expect(T.en.state[s], s).toBeTruthy(); expect(T.ar.state[s], s).toBeTruthy(); }
    for (const s of ["pending", "approved", "rejected", "suspended"]) { expect(T.en.chip[s], s).toBeTruthy(); expect(T.ar.chip[s], s).toBeTruthy(); }
    expect(Object.keys(T.en.field).sort()).toEqual([...W4_KEYS].sort());
    expect(Object.keys(T.ar.field).sort()).toEqual([...W4_KEYS].sort());
  });
  it("shows staff's reason on a refusal, as written and escaped, and never on an open shop", () => {
    const refused = render(createElement(ShopState, { shop: shop({ status: "rejected", decision_note: "The <b>registration</b> has expired." }), w: T.en }));
    expect(refused).toContain("Your application was not approved.");
    expect(refused).toContain("Reason");
    expect(refused).toContain("The &lt;b&gt;registration&lt;/b&gt; has expired.");
    expect(refused).toContain('dir="auto"');
    expect(refused).toContain("mk-status-hidden");
    const open = render(createElement(ShopState, { shop: shop({ status: "approved", decision_note: "internal" }), w: T.en }));
    expect(open).toContain("Your shop is open.");
    expect(open).not.toContain("internal");
    const sent = render(createElement(ShopState, { shop: shop(), w: T.ar, title: T.ar.sentTitle }));
    expect(sent).toContain("أُرسل الطلب");
    expect(sent).toContain("طلبك لدى فريقنا.");
  });
  it("lists the details as sent, user text in its own direction and numbers left to right", () => {
    const html = render(createElement(ShopFacts, { shop: shop({ about_en: "<i>Road</i> bikes" }), locale: "en", t: M.en, w: T.en }));
    expect(html).toContain("Corniche Cycles");
    expect(html).toContain("دراجات الكورنيش");
    expect(html).toContain("&lt;i&gt;Road&lt;/i&gt; bikes");
    expect(html).toContain('<bdi dir="ltr" class="mk-w4-num">4030123456</bdi>');
    expect(html).toContain("+966 50 123 4567");
    expect(html).toContain('href="https://maps.app.goo.gl/abc123"');
    expect(html).toContain("/mkt/s12/");
    expect(html).not.toContain("Return terms in Arabic");
    // a map link that is not one of the kinds allowed is never an address to follow
    expect(render(createElement(ShopFacts, { shop: shop({ map_url: "javascript:alert(1)" }), locale: "en", t: M.en, w: T.en }))).not.toContain("javascript:");
    expect(render(createElement(ShopFacts, { shop: shop({ logo: null }), locale: "ar", t: M.ar, w: T.ar }))).toContain("mk-w4-id-mark");
  });
});

describe("the route's body", () => {
  const fields = w4FieldsOf(form({ logo: LOGO }), "2026-11-21");
  it("passes an application's own keys and nothing else", () => {
    expect(w4BodyFields(fields)).toEqual(fields);
    const more = w4BodyFields({ ...fields, status: "approved", owner_id: "c9", slug: "mine" }) as Record<string, unknown>;
    expect(Object.keys(more).sort()).toEqual(Object.keys(fields).sort());
    expect(w4BodyFields({ ...fields, vat_no: "" })?.vat_no).toBeNull();
  });
  it("refuses what is not an application before any database call", () => {
    for (const bad of [null, [], "x", {}, { ...fields, name_en: "" }, { ...fields, cr_no: null }, { ...fields, cr_activity: 5 }, { ...fields, city: "atlantis" },
      { ...fields, about_en: "a".repeat(3000) }, { ...fields, logo: "https://example.com/a.jpg" }, { ...fields, logo: `l1/${"ab".repeat(16)}.jpg` },
      { ...fields, agreement: "" }, { ...fields, agreement: "a b" }, { ...fields, agreement: undefined }, { ...fields, phone: 966501234567 }]) {
      expect(w4BodyFields(bad), JSON.stringify(bad)?.slice(0, 80)).toBeNull();
    }
  });
});

describe("the shop routes", () => {
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
  const SESSION = `c1~${"a".repeat(32)}`;
  const post = (body: unknown, o: { origin?: string | null; cookie?: string } = {}) => new Request("https://micromobility.sa/api/market/shop/apply", {
    method: "POST",
    headers: { ...(o.origin === null ? {} : { origin: o.origin ?? "https://micromobility.sa" }), ...(o.cookie === "" ? {} : { cookie: o.cookie ?? `mm_acct=${SESSION}` }), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const fields = w4FieldsOf(form(), "2026-11-21");
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("send an application with the account of the cookie, never one the body names", async () => {
    stub(() => json({ shop: shop() }));
    const res = await applyPost(post({ fields: { ...fields, owner_id: "c9" }, p_id: "c9", p_token: "stolen" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.json()).toMatchObject({ ok: true, shop: { id: 12, status: "pending" } });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://example.supabase.co/rest/v1/rpc/market_shop_apply");
    expect(calls[0].body).toEqual({ p_id: "c1", p_token: "a".repeat(32), p: fields });
  });
  it("answer a refusal by its id and detail, never the database's own words", async () => {
    stub(() => json({ code: "P0001", message: "MKT_DUP: cr", details: "secret", hint: "secret" }, 400));
    const res = await applyPost(post({ fields }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "dup", detail: "cr" });
    stub(() => json({ code: "P0001", message: "MKT_LIMIT: shop" }, 400));
    const limit = await applyPost(post({ fields }));
    expect(limit.status).toBe(429);
    expect(await limit.json()).toEqual({ ok: false, error: "limit", detail: "shop" });
  });
  it("refuse a body that is not an application, another site's page and a visitor, without asking the database", async () => {
    stub(() => json({ shop: shop() }));
    expect((await applyPost(post({ fields: { ...fields, city: "atlantis" } }))).status).toBe(400);
    expect((await applyPost(post({ nothing: true }))).status).toBe(400);
    expect((await applyPost(post({ fields }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await applyPost(post({ fields }, { cookie: "" }))).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it("read the account's own shop, or none", async () => {
    stub(() => json({ shop: shop({ status: "approved" }) }));
    const get = (cookie?: string) => new Request("https://micromobility.sa/api/market/shop/mine", { headers: cookie ? { cookie } : {} });
    const res = await mineGet(get(`mm_acct=${SESSION}`));
    expect(await res.json()).toMatchObject({ ok: true, shop: { slug: "corniche-cycles", status: "approved" } });
    expect(calls[0].url).toBe("https://example.supabase.co/rest/v1/rpc/market_shop_mine");
    expect(calls[0].body).toEqual({ p_id: "c1", p_token: "a".repeat(32) });
    stub(() => json({ shop: null }));
    expect(await (await mineGet(get(`mm_acct=${SESSION}`))).json()).toEqual({ ok: true, shop: null });
    expect((await mineGet(get())).status).toBe(401);
  });
  it("hand a page the account's data, or the reason it could not be read", async () => {
    stub((c) => (c.url.endsWith("/market_me") ? json({ on: true, adult: true, established: true, seller: { status: "ok", terms_ok: false }, terms_version: "2026-11-21", limits: {} }) : json({ shop: null })));
    const ok = await w4ShopData({ id: "c1", token: "a".repeat(32) });
    expect(ok).toMatchObject({ me: { adult: true, terms_version: "2026-11-21" }, shop: null, error: null });
    expect(ok.tag).toMatch(/^[0-9a-f]{24}$/);
    stub(() => json({ code: "PGRST202", message: "Could not find the function public.market_me" }, 404));
    expect(await w4ShopData({ id: "c1", token: "a".repeat(32) })).toMatchObject({ me: null, shop: null, error: { error: "absent" } });
  });
});

describe("the ways into the rules and the shop pages", () => {
  const cols = () => [{ title: "Shop", links: [{ label: "Store", href: "/store" }] }, { title: "Company", links: [{ label: "Terms & Conditions", href: "/terms" }] }];
  it("puts the rules in the footer's built-in third column, where the footer's own rule hides it while the Marketplace is off", () => {
    const footer = siteSchema.sections.find((s) => s.id === "footer");
    const company = footer?.fields.find((f) => f.id === "company") as { def: { label: { en: string; ar: string }; href: { href: string } }[]; maxItems: number } | undefined;
    const link = company?.def.find((l) => l.href.href === MK_RULES);
    expect(link?.label).toEqual({ en: M.en.rules, ar: M.ar.rules });
    expect(company && company.def.length <= company.maxItems).toBe(true);
    expect(pageOf(MK_RULES)).toBe("marketplace");
    const src = read("components/site/SiteFooter.tsx");
    expect(src).toContain('hidden.includes("marketplace") ? shown : w4FooterWithRules(shown, serverLocalize(MARKET, locale).rules)');
  });
  it("adds the link to the last column when the lists staff saved do not lead to the rules", () => {
    const out = w4FooterWithRules(cols(), "Marketplace rules");
    expect(out[1].links.at(-1)).toEqual({ label: "Marketplace rules", href: MK_RULES });
    expect(out[0].links).toHaveLength(1);
    expect(out[1].title).toBe("Company");
  });
  it("leaves the columns alone when one of their links already opens the rules, however staff worded or placed it", () => {
    for (const href of [MK_RULES, `${MK_RULES}#safety`, `${MK_RULES}/`, `${MK_RULES}?x=1`]) {
      const mine = cols();
      mine[0].links.push({ label: "Selling rules", href });
      expect(w4FooterWithRules(mine, "Marketplace rules")).toBe(mine);
    }
    expect(w4FooterWithRules([], "Marketplace rules")).toEqual([]);
    const other = cols();
    other[0].links.push({ label: "Marketplace", href: "/marketplace" });
    expect(w4FooterWithRules(other, "Marketplace rules")[1].links).toHaveLength(2);
  });
  it("gives My Account a My shop row only for an account that has applied, while the Marketplace is on", () => {
    const src = read("app/[locale]/account/[[...part]]/page.tsx");
    expect(src).toContain('!hidden.includes("marketplace") ? mkShopMine({ id: acct.id, token: acct.token }) : Promise.resolve(null)');
    expect(src).toContain('myShop && w4State(myShop) !== "none"');
    expect(src).toContain("localHref(MK_MY_SHOP, locale)");
  });
  it("keeps the gated pages out of search engines and behind the sign-in", () => {
    for (const p of ["app/[locale]/marketplace/shops/apply/page.tsx", "app/[locale]/marketplace/my-shop/page.tsx"]) {
      const src = read(p);
      expect(src, p).toContain("noindex: true");
      expect(src, p).toContain("<MkGate locale={locale} session={session}>");
      expect(src, p).toContain("<MkFrame locale={locale} at={at} narrow>");
    }
    const rules = read("app/[locale]/marketplace/rules/page.tsx");
    expect(rules).toContain("noindex: !at.on");
    expect(rules).not.toContain("mkSession");
  });
});
