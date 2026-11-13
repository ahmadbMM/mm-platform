import { describe, expect, it, vi } from "vitest";
import { BROWSER_CACHE, NO_PAGE_CACHE, PAGE_STALE, firstVisitKey, pageCacheKey, pageLang, plainCanonical, servePage } from "../page-cache";

// The edge page cache (lib/page-cache.ts): which requests may be answered from a copy, and how.
const SITE = "https://micromobility.sa";
const get = (path: string, cookie = "", method = "GET") => new Request(SITE + path, { method, headers: cookie ? { cookie } : {} });

describe("pageCacheKey", () => {
  it("keys a page by its address, its language and the deploy", () => {
    expect(pageCacheKey(get("/club?lang=ar"), "v1")).toBe("https://page-cache.micromobility.sa/club?lang=ar&v=v1");
    expect(pageCacheKey(get("/club", "NEXT_LOCALE=de"), "v1")).toBe("https://page-cache.micromobility.sa/club?lang=de&v=v1");
    expect(pageCacheKey(get("/club?lang=ar", "NEXT_LOCALE=de"), "v1")).toContain("lang=ar"); // the address wins, as it does on the page
    expect(pageCacheKey(get("/club?lang=ar"), "v2")).toContain("v=v2");
  });
  it("never guesses a language: a first visit is rendered", () => {
    expect(pageCacheKey(get("/club"), "v1")).toBeNull();
    expect(pageCacheKey(get("/club", "NEXT_LOCALE=xx"), "v1")).toBeNull();
    expect(pageCacheKey(get("/club?lang=xx"), "v1")).toBeNull();
  });
  it("leaves signed-in visitors, staff previews and other queries alone", () => {
    expect(pageCacheKey(get("/club?lang=en", "mm_acct=abc"), "v1")).toBeNull();
    expect(pageCacheKey(get("/?lang=en", "NEXT_LOCALE=en; mm_preview=tok"), "v1")).toBeNull();
    expect(pageCacheKey(get("/club?lang=en&tag=x"), "v1")).toBeNull();
    expect(pageCacheKey(get("/club?lang=en", "", "POST"), "v1")).toBeNull();
  });
  it("ignores tracking parameters: a shared link is the same page, under the same key", () => {
    expect(pageCacheKey(get("/club?lang=en&utm_source=ig&utm_medium=story"), "v1")).toBe("https://page-cache.micromobility.sa/club?lang=en&v=v1");
    expect(pageCacheKey(get("/club?fbclid=abc", "NEXT_LOCALE=ar"), "v1")).toBe("https://page-cache.micromobility.sa/club?lang=ar&v=v1");
    for (const q of ["gclid=1", "igshid=2", "mc_cid=3&mc_eid=4", "UTM_CAMPAIGN=x"]) expect(pageCacheKey(get(`/club?lang=en&${q}`), "v1"), q).toBe("https://page-cache.micromobility.sa/club?lang=en&v=v1");
    expect(pageCacheKey(get("/club?lang=en&utm=x"), "v1")).toBeNull(); // not one of them
  });
  it("never keeps the account page, the API, media, bike tag pages, forms or files", () => {
    for (const p of ["/account", "/api/account", "/media/home/x.jpg", "/b/42", "/bikes/42", "/bikes/000042/", "/petromin", "/community/registration", "/preview", "/en/club", "/robots.txt", "/_next/static/x.js"]) {
      expect(pageCacheKey(get(`${p}${p.includes("?") ? "&" : "?"}lang=en`), "v1"), p).toBeNull();
    }
  });
  it("never keeps an Ask page: the list, a page of questions or its big screen, in any language, signed in or not", () => {
    for (const p of ["/ask", "/ask/", "/ask/farm-ideas", "/ask/farm-ideas/", "/ask/farm-ideas/screen"]) {
      expect(pageCacheKey(get(`${p}?lang=en`), "v1"), p).toBeNull();
      expect(pageCacheKey(get(p, "NEXT_LOCALE=ar"), "v1"), p).toBeNull();
      expect(firstVisitKey(get(p), "v1"), p).toBeNull();
      expect(plainCanonical(get(p)), p).toBeNull();
    }
    expect(pageCacheKey(get("/ask/farm-ideas/screen?k=abcdef&lang=en"), "v1")).toBeNull();
    // a page whose name only starts the same way is a page like any other
    expect(pageCacheKey(get("/asking?lang=en"), "v1")).toBe("https://page-cache.micromobility.sa/asking?lang=en&v=v1");
  });
  it("a malformed cookie is read as written, never a 500 on every page", () => {
    expect(() => pageCacheKey(get("/club", "NEXT_LOCALE=%E0"), "v1")).not.toThrow();
    expect(pageCacheKey(get("/club", "NEXT_LOCALE=%E0"), "v1")).toBeNull(); // not a language: rendered
    expect(pageCacheKey(get("/club?lang=en", "mm_acct=%"), "v1")).toBeNull(); // still a signed-in visitor
    expect(pageCacheKey(get("/club", "NEXT_LOCALE=de; x=%"), "v1")).toBe("https://page-cache.micromobility.sa/club?lang=de&v=v1");
  });
  it("keeps the bike catalogue's pages, which only a staff edit changes", () => {
    for (const p of ["/bikes", "/bikes/road", "/bikes/road/carbon", "/bikes/road/carbon/alvas-da54"]) {
      expect(pageCacheKey(get(`${p}?lang=en`), "v1"), p).toBe(`https://page-cache.micromobility.sa${p}?lang=en&v=v1`);
    }
  });
});

describe("servePage", () => {
  const html = (body = "<html>page</html>", headers: Record<string, string> = {}) =>
    new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "set-cookie": "NEXT_LOCALE=ar; Path=/", "cache-control": "private, no-store", ...headers } });
  const fakeCache = () => {
    const m = new Map<string, Response>();
    return { m, match: async (k: string) => m.get(k)?.clone(), put: async (k: string, r: Response) => { m.set(k, r); }, delete: async (k: string) => m.delete(k) };
  };
  const ctx = () => { const waits: Promise<unknown>[] = []; return { waits, waitUntil: (p: Promise<unknown>) => { waits.push(p); } }; };

  it("renders once, then answers from the copy - without anyone's cookies, asked again by the browser but kept for Back", async () => {
    const cache = fakeCache();
    const handler = { fetch: vi.fn(async () => html()) };
    const c1 = ctx();
    const first = await servePage(get("/club?lang=ar"), { CF_VERSION_METADATA: { id: "v1" } }, c1, handler, cache);
    expect(first.headers.get("cache-control")).toBe(BROWSER_CACHE);
    expect(BROWSER_CACHE).not.toContain("no-store"); // no-store kept every page out of the back/forward cache
    expect(first.headers.get("set-cookie")).toContain("NEXT_LOCALE=ar"); // the visitor's own answer keeps its cookie
    expect(await first.text()).toBe("<html>page</html>");
    await Promise.all(c1.waits);
    const stored = [...cache.m.values()][0];
    expect(stored.headers.get("set-cookie")).toBeNull();
    expect(stored.headers.get("cache-control")).toBe(`public, max-age=${PAGE_STALE}`); // kept for a stale answer; fresh for a minute
    const again = await servePage(get("/club?lang=ar"), { CF_VERSION_METADATA: { id: "v1" } }, ctx(), handler, cache);
    expect(handler.fetch).toHaveBeenCalledTimes(1);
    expect(again.headers.get("x-mm-page-cache")).toBe("hit");
    expect(again.headers.get("cache-control")).toBe(BROWSER_CACHE);
    expect(again.headers.get("set-cookie")).toContain("NEXT_LOCALE=ar"); // ?lang= still becomes the visitor's language
  });
  it("keeps nothing but a whole HTML page, and is off with PAGE_CACHE=off", async () => {
    const cache = fakeCache();
    const redirect = { fetch: vi.fn(async () => new Response(null, { status: 307, headers: { location: "/" } })) };
    const c = ctx();
    await servePage(get("/club?lang=ar"), {}, c, redirect, cache);
    await Promise.all(c.waits);
    expect(cache.m.size).toBe(0);
    const handler = { fetch: vi.fn(async () => html()) };
    await servePage(get("/club?lang=ar"), { PAGE_CACHE: "off" }, ctx(), handler, cache);
    expect(cache.m.size).toBe(0);
  });
  it("leaves a page it may not keep as it was drawn: a signed-in visitor's keeps no-store", async () => {
    const handler = { fetch: vi.fn(async () => html()) };
    const res = await servePage(get("/club?lang=ar", "mm_acct=a~b"), {}, ctx(), handler, fakeCache());
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
  // 2026-11-09 08:00 UTC = 11:00 in Jeddah
  const T0 = Date.UTC(2026, 10, 9, 8, 0, 0);
  const env = { CF_VERSION_METADATA: { id: "v1" } };
  it("after its minute, answers from the copy at once and draws a fresh one behind it, one at a time", async () => {
    const cache = fakeCache();
    let n = 0;
    const handler = { fetch: vi.fn(async () => html(`<html lang="ar">page ${++n}</html>`)) };
    const c1 = ctx();
    await servePage(get("/club?lang=ar"), env, c1, handler, cache, T0);
    await Promise.all(c1.waits);
    const c2 = ctx();
    const later = await servePage(get("/club?lang=ar"), env, c2, handler, cache, T0 + 20 * 60 * 1000);
    expect(later.headers.get("x-mm-page-cache")).toBe("stale");
    expect(await later.text()).toBe('<html lang="ar">page 1</html>'); // no wait for a page to be drawn
    expect(later.headers.get("x-mm-stored")).toBeNull();
    const c3 = ctx();
    await servePage(get("/club?lang=ar"), env, c3, handler, cache, T0 + 20 * 60 * 1000); // a second visitor meanwhile
    await Promise.all([...c2.waits, ...c3.waits]);
    expect(handler.fetch).toHaveBeenCalledTimes(2); // one fresh drawing, not two
    const next = await servePage(get("/club?lang=ar"), env, ctx(), handler, cache, Date.now());
    expect(next.headers.get("x-mm-page-cache")).toBe("hit");
    expect(await next.text()).toBe('<html lang="ar">page 2</html>');
  });
  it("never answers with a copy older than six hours, or one drawn before midnight in Jeddah", async () => {
    const draw = async (stored: number, now: number) => {
      const cache = fakeCache();
      const handler = { fetch: vi.fn(async () => html()) };
      const c = ctx();
      await servePage(get("/club?lang=en"), env, c, handler, cache, stored);
      await Promise.all(c.waits);
      const res = await servePage(get("/club?lang=en"), env, ctx(), handler, cache, now);
      return { state: res.headers.get("x-mm-page-cache"), drawn: handler.fetch.mock.calls.length };
    };
    expect(await draw(T0, T0 + 5 * 3600 * 1000)).toEqual({ state: "stale", drawn: 2 }); // 16:00, same day: the copy, and a fresh one drawn behind it
    expect(await draw(T0, T0 + 7 * 3600 * 1000)).toEqual({ state: null, drawn: 2 }); // seven hours on
    const beforeMidnight = Date.UTC(2026, 10, 9, 20, 50); // 23:50 in Jeddah
    expect(await draw(beforeMidnight, beforeMidnight + 20 * 60 * 1000)).toEqual({ state: null, drawn: 2 }); // 00:10 the next day
  });
  it("lets a page taken down go from the next visit (switched off, Coming Soon, a hidden article), and keeps the copy through a database blip", async () => {
    const after = async (answer: () => Response) => {
      const cache = fakeCache();
      let n = 0;
      const handler = { fetch: vi.fn(async () => (++n === 1 ? html() : answer())) };
      const visit = async (at: number) => { const c = ctx(); const res = await servePage(get("/events?lang=en"), env, c, handler, cache, at); await Promise.all(c.waits); return res; };
      await visit(T0);
      const stale = await visit(T0 + 20 * 60 * 1000); // the old page at once; the fresh answer drawn behind it
      const next = await visit(T0 + 21 * 60 * 1000);
      return { first: stale.headers.get("x-mm-page-cache"), next: next.headers.get("x-mm-page-cache"), status: next.status };
    };
    const home = (headers: Record<string, string> = {}) => () => new Response(null, { status: 307, headers: { location: `${SITE}/`, ...headers } });
    expect(await after(home())).toEqual({ first: "stale", next: null, status: 307 }); // switched off, or Coming Soon: Home
    expect(await after(() => new Response("<html>not found</html>", { status: 404, headers: { "content-type": "text/html" } }))).toEqual({ first: "stale", next: null, status: 404 });
    expect(await after(() => new Response("down", { status: 503 }))).toEqual({ first: "stale", next: "stale", status: 200 });
    expect(await after(home({ [NO_PAGE_CACHE]: "1" }))).toEqual({ first: "stale", next: "stale", status: 200 }); // drawn without the site's state
  });
  it("answers a first visit from the copy in the language the site drew for the same browser languages, never a guessed one", async () => {
    const cache = fakeCache();
    const handler = { fetch: vi.fn(async (r: Request) => html(`<html lang="${/^ar/.test(r.headers.get("accept-language") || "") ? "ar" : "en"}" dir="ltr">club</html>`)) };
    const visit = (al: string) => new Request(SITE + "/club?utm_source=ig", { headers: { "accept-language": al } });
    const c1 = ctx();
    const firstAr = await servePage(visit("ar-SA,ar;q=0.9"), env, c1, handler, cache, T0);
    expect(firstAr.headers.get("x-mm-page-cache")).toBeNull(); // a header never seen: drawn
    await Promise.all(c1.waits);
    const again = await servePage(visit("ar-SA,ar;q=0.9"), env, ctx(), handler, cache, T0 + 1000);
    expect(again.headers.get("x-mm-page-cache")).toBe("hit");
    expect(await again.text()).toContain('lang="ar"');
    expect(again.headers.get("set-cookie")).toBeNull(); // the language stays the browser's, as when drawn
    // the same page for a visitor whose cookie says Arabic
    expect((await servePage(get("/club", "NEXT_LOCALE=ar"), env, ctx(), handler, cache, T0 + 1000)).headers.get("x-mm-page-cache")).toBe("hit");
    // other browser languages are drawn, then learnt in their turn
    const other = await servePage(visit("fr-FR"), env, ctx(), handler, cache, T0 + 1000);
    expect(other.headers.get("x-mm-page-cache")).toBeNull();
    expect(handler.fetch).toHaveBeenCalledTimes(2);
  });
  it("learns nothing from a page whose language cannot be read, and knows a page's language from its html tag", async () => {
    const cache = fakeCache();
    const handler = { fetch: vi.fn(async () => html("<html>no language</html>")) };
    const c = ctx();
    await servePage(new Request(SITE + "/club", { headers: { "accept-language": "de" } }), env, c, handler, cache, T0);
    await Promise.all(c.waits);
    expect(cache.m.size).toBe(0);
    expect(pageLang('<!DOCTYPE html><html lang="zh-Hans" dir="ltr" class="x">')).toBe("zh");
    expect(pageLang('<html dir="rtl" lang="ur">')).toBe("ur");
    expect(pageLang("<html>")).toBeNull();
    expect(firstVisitKey(get("/club", "NEXT_LOCALE=ar"), "v1")).toBeNull(); // not a first visit
    expect(firstVisitKey(get("/account"), "v1")).toBeNull();
    expect(firstVisitKey(get("/club", "mm_acct=x"), "v1")).toBeNull();
    expect(firstVisitKey(get("/club?tag=x"), "v1")).toBeNull();
  });
  it("never keeps a page drawn without the site's state (the proxy marks it)", async () => {
    const cache = fakeCache();
    const handler = { fetch: vi.fn(async () => html("<html>coming soon</html>", { [NO_PAGE_CACHE]: "1" })) };
    const c = ctx();
    await servePage(get("/?lang=en"), {}, c, handler, cache);
    await Promise.all(c.waits);
    expect(cache.m.size).toBe(0);
  });
});

describe("plainCanonical", () => {
  it("names a page's plain address as its canonical one when no language is asked for", () => {
    expect(plainCanonical(get("/"))).toBe("https://micromobility.sa/");
    expect(plainCanonical(get("/business"))).toBe("https://micromobility.sa/business");
    expect(plainCanonical(get("/business/"))).toBe("https://micromobility.sa/business");
    expect(plainCanonical(get("/club?utm_source=instagram"))).toBe("https://micromobility.sa/club");
  });
  it("leaves a language's address, the account, the API and files as the page wrote them", () => {
    for (const p of ["/?lang=ar", "/club?lang=en", "/account", "/account/stats", "/api/health", "/media/home/x.jpg", "/robots.txt", "/preview"]) {
      expect(plainCanonical(get(p)), p).toBeNull();
    }
  });
});
