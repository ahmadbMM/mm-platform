import { describe, expect, it, vi } from "vitest";
import { NO_PAGE_CACHE, pageCacheKey, servePage } from "../page-cache";

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
    return { m, match: async (k: string) => m.get(k)?.clone(), put: async (k: string, r: Response) => { m.set(k, r); } };
  };
  const ctx = () => { const waits: Promise<unknown>[] = []; return { waits, waitUntil: (p: Promise<unknown>) => { waits.push(p); } }; };

  it("renders once, then answers from the copy - without anyone's cookies, uncached by the browser", async () => {
    const cache = fakeCache();
    const handler = { fetch: vi.fn(async () => html()) };
    const c1 = ctx();
    const first = await servePage(get("/club?lang=ar"), { CF_VERSION_METADATA: { id: "v1" } }, c1, handler, cache);
    expect(await first.text()).toBe("<html>page</html>");
    await Promise.all(c1.waits);
    const stored = [...cache.m.values()][0];
    expect(stored.headers.get("set-cookie")).toBeNull();
    expect(stored.headers.get("cache-control")).toBe("public, max-age=60");
    const again = await servePage(get("/club?lang=ar"), { CF_VERSION_METADATA: { id: "v1" } }, ctx(), handler, cache);
    expect(handler.fetch).toHaveBeenCalledTimes(1);
    expect(again.headers.get("x-mm-page-cache")).toBe("hit");
    expect(again.headers.get("cache-control")).toBe("private, no-store");
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
  it("never keeps a page drawn without the site's state (the proxy marks it)", async () => {
    const cache = fakeCache();
    const handler = { fetch: vi.fn(async () => html("<html>coming soon</html>", { [NO_PAGE_CACHE]: "1" })) };
    const c = ctx();
    await servePage(get("/?lang=en"), {}, c, handler, cache);
    await Promise.all(c.waits);
    expect(cache.m.size).toBe(0);
  });
});
