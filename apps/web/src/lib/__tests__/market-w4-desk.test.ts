import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement, type ReactNode } from "react";
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";
import ShopDesk, { type ShopDeskProps } from "@/components/market/w4/ShopDesk";
import { w4Get, w4Post, w4PostForm } from "@/components/market/w4/api";
import { W4_LOGO_SIDE, w4LogoCopies, w4LogoUpload } from "@/components/market/w4/logo-client";
import { T as M } from "@/components/market/Market.text";
import { T } from "@/components/market/w4.text";
import { MK_PHOTO_SIDE, MK_MY_SHOP, MK_SHOP_APPLY, MK_SMALL_SIDE, shopHref, type MkMe, type MkShopMine } from "../market/core";
import { W4_BIRTH_HREF } from "../market/w4";

// The two shop pages as they are first drawn (W4), and how their script asks the site's routes. What stands between
// an account and the form is said and no form is offered; each state of an application has its own buttons and no
// others; a read that failed says so and can be tried again. The form itself opens in the browser only (it reads
// what the browser kept), so here its place is the waiting mark. Nothing is asked of any server: fetch is a stub.

// the site's link needs the page's language around it; a plain link says the same for these checks
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, className, children }: { href: string; className?: string; children?: ReactNode }) => createElement("a", { href, className }, children),
}));
// the sign-in form is the account pages' own; here it is enough that it was drawn
vi.mock("@/components/market/MkSignIn", () => ({ default: () => createElement("div", { "data-signin": "" }) }));

const render = renderUntyped as (el: ReactElement) => string;
const LOGO = `s12/${"ab".repeat(16)}.jpg`;
const me = (over: Partial<MkMe> = {}): MkMe => ({
  on: true, adult: true, established: true, seller: { status: "ok", terms_ok: true }, terms_version: "2026-11-21", names: { short: null },
  has_whatsapp: false, shop: null,
  limits: { live: 10, live_used: 0, drafts: 10, drafts_used: 0, price_max: 500000, threads_day: 20, threads_used: 0, wa_day: 10, wa_used: 0, messages_day: 200, messages_used: 0 },
  unread: 0, commission_pct: 1, listing_days: 60, ...over,
});
const shop = (over: Partial<MkShopMine> = {}): MkShopMine => ({
  id: 12, slug: "corniche-cycles", status: "pending", decision_note: null, approved_at: null, agreement_version: "2026-11-21", live: 3, live_cap: 20,
  created_at: "2026-11-20T10:00:00+00:00", updated_at: "2026-11-20T10:00:00+00:00",
  name_en: "Corniche Cycles", name_ar: null, cr_no: "4030123456", cr_activity: "Retail sale of bicycles", vat_no: null,
  city: "jeddah", address: null, map_url: null, phone: "966126061234", whatsapp: null,
  about_en: null, about_ar: null, returns_en: null, returns_ar: null, sells: "Bikes and parts", logo: LOGO,
  ...over,
});
const desk = (p: Partial<ShopDeskProps>) => render(createElement(ShopDesk, { page: "apply", locale: "en", me: me(), shop: null, error: null, tag: "ab".repeat(12), ...p }));
const FORM_PLACE = "mk-w4-skel"; // where the form opens once the browser has it
// the page's words as its markup writes them (an apostrophe is written as a character reference)
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const written = <O extends Record<string, unknown>>(o: O): O =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? esc(v) : v && typeof v === "object" ? written(v as Record<string, unknown>) : v])) as O;
const m = written(M.en), e = m.errors, w = written(T.en);

describe("the application page", () => {
  it("opens on the form for an account with no shop", () => {
    const html = desk({});
    expect(html).toContain(`<h1 tabindex="-1">${w.applyTitle}</h1>`);
    expect(html).toContain(FORM_PLACE);
    expect(html).not.toContain(w.state.none);
  });
  it("says what stands in the way, and offers no form: no birth date, under 18, a paused account", () => {
    const birth = desk({ me: me({ adult: null }) });
    expect(birth).toContain(e.birth);
    expect(birth).toContain(`href="${W4_BIRTH_HREF}"`);
    expect(birth).toContain(w.addBirth);
    expect(birth).not.toContain(FORM_PLACE);
    const young = desk({ me: me({ adult: false }) });
    expect(young).toContain(e.adult);
    expect(young).not.toContain(W4_BIRTH_HREF);
    expect(young).not.toContain(FORM_PLACE);
    const paused = desk({ me: me({ seller: { status: "suspended", terms_ok: true } }) });
    expect(paused).toContain(e.suspended);
    expect(paused).not.toContain(FORM_PLACE);
    // ?edit=1 does not get past any of them
    expect(desk({ me: me({ adult: null }), shop: shop(), edit: true })).not.toContain(FORM_PLACE);
  });
  it("shows a waiting application by its state, with the way to change it and the way to My shop", () => {
    const html = desk({ shop: shop() });
    expect(html).toContain('data-mk-shop-state="pending"');
    expect(html).toContain(w.state.pending);
    expect(html).toContain(w.change);
    expect(html).toContain(`href="${MK_MY_SHOP}"`);
    expect(html).not.toContain(FORM_PLACE);
    expect(html).not.toContain(w.editAgain);
    // asked to change it: the form
    expect(desk({ shop: shop(), edit: true })).toContain(FORM_PLACE);
  });
  it("shows an application that was not approved with staff's reason and the way to send it again", () => {
    const html = desk({ shop: shop({ status: "rejected", decision_note: "The registration has <expired>." }) });
    expect(html).toContain(w.state.rejected);
    expect(html).toContain("The registration has &lt;expired&gt;.");
    expect(html).toContain(w.editAgain);
    expect(html).not.toContain(w.change);
    expect(desk({ shop: shop({ status: "rejected" }), edit: true })).toContain(FORM_PLACE);
  });
  it("never opens the application's form for a shop that is open or paused, whatever the address asks", () => {
    for (const status of ["approved", "suspended"] as const) {
      const html = desk({ shop: shop({ status }), edit: true });
      expect(html, status).not.toContain(FORM_PLACE);
      expect(html, status).toContain(w.state[status]);
      expect(html, status).toContain(`href="${MK_MY_SHOP}"`);
      expect(html, status).not.toContain(w.change);
      expect(html, status).not.toContain(w.editAgain);
    }
  });
  it("leaves the buttons that change an application out for an account that may not send one", () => {
    const html = desk({ me: me({ seller: { status: "suspended", terms_ok: true } }), shop: shop() });
    expect(html).toContain(w.state.pending);
    expect(html).toContain(e.suspended);
    expect(html).not.toContain(w.change);
  });
});

describe("My shop", () => {
  const mine = (p: Partial<ShopDeskProps>) => desk({ page: "mine", ...p });
  it("says there is no shop yet and leads to the application", () => {
    const html = mine({});
    expect(html).toContain(`<h1 tabindex="-1">${w.myShop}</h1>`);
    expect(html).toContain(w.state.none);
    expect(html).toContain(`href="${MK_SHOP_APPLY}"`);
    expect(html).not.toContain(FORM_PLACE);
    // an account that may not apply is told why, and is not led to the form
    const birth = mine({ me: me({ adult: null }) });
    expect(birth).toContain(w.state.none);
    expect(birth).toContain(e.birth);
    expect(birth).not.toContain(`href="${MK_SHOP_APPLY}"`);
  });
  it("gives an open shop its page, its own listings on sale and the way to edit its details", () => {
    const html = mine({ shop: shop({ status: "approved" }) });
    expect(html).toContain(w.state.approved);
    expect(html).toContain(`href="${shopHref("corniche-cycles")}"`);
    expect(html).toContain(w.edit);
    expect(html).toContain(`<span>${w.onSale}</span><bdi>3 of 20</bdi>`);
    expect(html).toContain('<bdi dir="ltr" class="mk-w4-num">4030123456</bdi>');
    expect(html).toContain("+966 12 606 1234");
    // an edit does not start by itself, and the application's own buttons are not an open shop's
    expect(html).not.toContain(FORM_PLACE);
    expect(html).not.toContain(w.change);
  });
  it("sends a waiting or refused application back to the application page to be changed", () => {
    const waiting = mine({ shop: shop() });
    expect(waiting).toContain(`href="${MK_SHOP_APPLY}?edit=1"`);
    expect(waiting).toContain(w.change);
    expect(waiting).not.toContain(w.onSale);
    expect(waiting).not.toContain(shopHref("corniche-cycles"));
    const refused = mine({ shop: shop({ status: "rejected", decision_note: "Send the registration again." }) });
    expect(refused).toContain(`href="${MK_SHOP_APPLY}?edit=1"`);
    expect(refused).toContain(w.editAgain);
    expect(refused).toContain("Send the registration again.");
  });
  it("shows a paused shop its reason and nothing to change", () => {
    const html = mine({ shop: shop({ status: "suspended", decision_note: "Counterfeit goods were listed." }) });
    expect(html).toContain(w.state.suspended);
    expect(html).toContain("Counterfeit goods were listed.");
    for (const no of [w.edit, w.change, w.editAgain, w.openPage, w.onSale]) expect(html, no).not.toContain(no);
    // an open shop of a paused account keeps its page's link and loses the edit
    const paused = mine({ me: me({ seller: { status: "suspended", terms_ok: true } }), shop: shop({ status: "approved" }) });
    expect(paused).toContain(w.openPage);
    expect(paused).not.toContain(w.edit);
    expect(paused).toContain(e.suspended);
  });
});

describe("a read that failed", () => {
  it("says so with the way to try again, on either page", () => {
    for (const page of ["apply", "mine"] as const) {
      const html = desk({ page, me: null, error: { error: "generic", detail: "" } });
      expect(html, page).toContain(e.generic);
      expect(html, page).toContain(m.retry);
      // no shop is known of, so neither the form nor "no shop yet" is drawn
      expect(html, page).not.toContain(FORM_PLACE);
      expect(html, page).not.toContain(w.state.none);
    }
    expect(desk({ me: null, error: { error: "busy", detail: "" } })).toContain(e.busy);
  });
  it("offers nothing to try while the database has no Marketplace, and the sign-in when the session is not accepted", () => {
    const absent = desk({ me: null, error: { error: "absent", detail: "" } });
    expect(absent).toContain(e.absent);
    expect(absent).not.toContain(m.retry);
    const out = desk({ me: null, error: { error: "signin", detail: "" } });
    expect(out).toContain("data-signin");
    expect(out).not.toContain(e.signin);
  });
});

describe("how the shop screens ask the site's routes", () => {
  type Seen = { url: string; init: RequestInit };
  let seen: Seen[] = [];
  const answer = (make: (s: Seen) => Response | Promise<Response>) => {
    seen = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => { const s = { url: String(url), init }; seen.push(s); return make(s); }));
  };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("hand back a route's answer as it is, and its refusal by id and detail", async () => {
    answer(() => json({ ok: true, shop: { id: 12 } }));
    expect(await w4Post<{ shop: { id: number } }>("/api/market/shop/apply", { fields: { name_en: "A" } })).toEqual({ ok: true, shop: { id: 12 } });
    expect(seen[0].url).toBe("/api/market/shop/apply");
    expect(seen[0].init).toMatchObject({ method: "POST", credentials: "same-origin", body: JSON.stringify({ fields: { name_en: "A" } }) });
    answer(() => json({ ok: false, error: "dup", detail: "cr" }, 409));
    expect(await w4Post("/api/market/shop/apply", {})).toEqual({ ok: false, error: "dup", detail: "cr" });
    answer(() => json({ ok: false, error: "signin" }, 401));
    expect(await w4Get("/api/market/shop/mine")).toEqual({ ok: false, error: "signin", detail: "" });
    expect(seen[0].init).toMatchObject({ cache: "no-store", credentials: "same-origin" });
    expect(seen[0].init.method).toBeUndefined();
  });
  it("read anything else as the one refusal a screen always has words for", async () => {
    answer(() => new Response("<html>502</html>", { status: 502 }));
    expect(await w4Get("/api/market/me")).toEqual({ ok: false, error: "generic", detail: "" });
    answer(() => json({ shop: {} }));
    expect(await w4Get("/api/market/shop/mine")).toEqual({ ok: false, error: "generic", detail: "" });
    answer(() => json({ ok: false, error: 5 }));
    expect(await w4Get("/api/market/shop/mine")).toEqual({ ok: false, error: "generic", detail: "" });
    answer(() => { throw new TypeError("Failed to fetch"); });
    expect(await w4Post("/api/market/shop/apply", {})).toEqual({ ok: false, error: "generic", detail: "" });
  });
  it("send a logo's two copies as a form, and never set its content type by hand", async () => {
    answer(() => json({ ok: true, name: LOGO }));
    const form = new FormData();
    form.set("for", "shop");
    expect(await w4PostForm<{ name: string }>("/api/market/photo", form)).toEqual({ ok: true, name: LOGO });
    expect(seen[0].init.body).toBe(form);
    expect(seen[0].init.headers).toBeUndefined();
  });
  it("send a logo to the photo route as the account's own shop's: for=shop, no number, the full copy and the small one", async () => {
    answer(() => json({ ok: true, name: LOGO }));
    const full = new Blob(["full"], { type: "image/jpeg" }), small = new Blob(["s"], { type: "image/jpeg" });
    expect(await w4LogoUpload({ full, small })).toEqual({ ok: true, name: LOGO });
    expect(seen[0].url).toBe("/api/market/photo");
    expect(seen[0].init.method).toBe("POST");
    const sent = seen[0].init.body as FormData;
    expect([...sent.keys()].sort()).toEqual(["for", "full", "ref", "small"]);
    expect(sent.get("for")).toBe("shop");
    expect(sent.get("ref")).toBe("");
    expect((sent.get("full") as File).size).toBe(4);
    expect((sent.get("small") as File).size).toBe(1);
    // a refusal comes back as the route said it, for the form to say beside the logo
    answer(() => json({ ok: false, error: "limit", detail: "photos" }, 429));
    expect(await w4LogoUpload({ full, small })).toEqual({ ok: false, error: "limit", detail: "photos" });
    // a logo is shown small: its full copy stays inside the photo route's limit, and above the small copy's side
    expect(W4_LOGO_SIDE).toBeLessThanOrEqual(MK_PHOTO_SIDE);
    expect(W4_LOGO_SIDE).toBeGreaterThanOrEqual(MK_SMALL_SIDE);
  });
  it("read a file that is no picture as nothing to send, and never throw", async () => {
    expect(await w4LogoCopies(new Blob([]))).toBeNull();
    // nothing here can draw a picture: the same answer a broken file gets in a browser
    expect(await w4LogoCopies(new Blob(["not a picture"], { type: "image/png" }))).toBeNull();
  });
  it("work in a browser without AbortSignal.timeout, and give up by a timer of their own", async () => {
    // a phone a few years old: the function is not there at all
    const had = Object.getOwnPropertyDescriptor(AbortSignal, "timeout");
    Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true, writable: true });
    try {
      answer(() => json({ ok: true, shop: null }));
      expect(await w4Get("/api/market/shop/mine")).toEqual({ ok: true, shop: null });
      expect(seen[0].init.signal).toBeInstanceOf(AbortSignal);
      expect(seen[0].init.signal?.aborted).toBe(false);
    } finally {
      if (had) Object.defineProperty(AbortSignal, "timeout", had);
    }
    // no answer: the request is stopped when its time is up, and the screen is told
    vi.useFakeTimers();
    answer((s) => new Promise<Response>((_, no) => { s.init.signal?.addEventListener("abort", () => no(new DOMException("stopped", "AbortError"))); }));
    const asked = w4Get("/api/market/shop/mine");
    await vi.advanceTimersByTimeAsync(19_000);
    expect(seen[0].init.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(seen[0].init.signal?.aborted).toBe(true);
    expect(await asked).toEqual({ ok: false, error: "generic", detail: "" });
  });
});
