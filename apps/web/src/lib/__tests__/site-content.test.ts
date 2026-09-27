import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hiddenPages, hiddenPageTarget, isComingSoon, loadSiteContent, pageOn, resetSiteContent, siteText, switchedPageOf } from "../site";
import { memoSettled } from "../memo";

// micromobility.sa reads what staff set in the staff page (public.site_content). The rules
// that keep it safe: a minute's cache served while it is refreshed (lib/memo.ts), the last good
// copy through a failed read, the site's own wording when nothing is set, and Coming Soon unless
// Home exists AND staff opened it.

const rows = (r: { key: string; value: unknown }[]) =>
  vi.fn(async () => new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } }));

beforeEach(() => {
  resetSiteContent();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => vi.unstubAllEnvs());

describe("loadSiteContent", () => {
  it("reads every key once, with the public key, and keeps it for a minute", async () => {
    const f = rows([{ key: "coming_soon.title", value: { en: "Soon!", ar: "قريباً!" } }]);
    const a = await loadSiteContent(f as unknown as typeof fetch, 1_000);
    const b = await loadSiteContent(f as unknown as typeof fetch, 30_000);
    expect(a).toEqual({ "coming_soon.title": { en: "Soon!", ar: "قريباً!" } });
    expect(b).toBe(a);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/site_content?select=key,value&key=not.like.journal.*");
    expect((init.headers as Record<string, string>).apikey).toBe("anon");
    await loadSiteContent(f as unknown as typeof fetch, 62_000);
    expect(f).toHaveBeenCalledTimes(2);
    await memoSettled();
  });

  it("shares one read between everyone asking at once - the proxy, the metadata and the page", async () => {
    const f = rows([{ key: "site.coming_soon", value: false }]);
    const all = await Promise.all([1, 2, 3, 4].map(() => loadSiteContent(f as unknown as typeof fetch, 0)));
    expect(f).toHaveBeenCalledTimes(1);
    for (const c of all) expect(c).toBe(all[0]);
  });

  it("after the minute, serves the copy it has and refreshes it behind the visitor", async () => {
    let title = "Soon!";
    const f = vi.fn(async () => new Response(JSON.stringify([{ key: "coming_soon.title", value: { en: title, ar: "" } }]), { status: 200, headers: { "content-type": "application/json" } }));
    const a = await loadSiteContent(f as unknown as typeof fetch, 0);
    title = "Sooner!";
    expect(await loadSiteContent(f as unknown as typeof fetch, 61_000)).toBe(a); // at once, as it was
    expect(f).toHaveBeenCalledTimes(2); // the refresh is on its way
    await memoSettled();
    expect(await loadSiteContent(f as unknown as typeof fetch, 62_000)).toEqual({ "coming_soon.title": { en: "Sooner!", ar: "" } });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("keeps the last good copy when a read fails", async () => {
    await loadSiteContent(rows([{ key: "site.coming_soon", value: true }]) as unknown as typeof fetch, 0);
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect(await loadSiteContent(down as unknown as typeof fetch, 70_000)).toEqual({ "site.coming_soon": true });
    await memoSettled();
    expect(await loadSiteContent(down as unknown as typeof fetch, 80_000)).toEqual({ "site.coming_soon": true }); // the refresh failed: the copy stays
    const refused = vi.fn(async () => new Response("{}", { status: 402 }));
    expect(await loadSiteContent(refused as unknown as typeof fetch, 140_000)).toEqual({ "site.coming_soon": true });
    await memoSettled();
    expect(await loadSiteContent(refused as unknown as typeof fetch, 150_000)).toEqual({ "site.coming_soon": true });
  });

  it("answers null when it never read anything", async () => {
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect(await loadSiteContent(down as unknown as typeof fetch, 0)).toBeNull();
  });

  it("a Worker that has just started takes the edge's last good copy when the database is down", async () => {
    // Cloudflare's cache at the edge, as a Worker sees it (caches.default).
    const store = new Map<string, string>();
    vi.stubGlobal("caches", { default: {
      match: async (k: string) => (store.has(k) ? new Response(store.get(k)) : undefined),
      put: async (k: string, r: Response) => { store.set(k, await r.text()); },
    } });
    try {
      await loadSiteContent(rows([{ key: "site.coming_soon", value: false }]) as unknown as typeof fetch, 0); // written to the edge too
      resetSiteContent(); // a new instance: nothing in memory
      const down = vi.fn(async () => { throw new Error("offline"); });
      expect(await loadSiteContent(down as unknown as typeof fetch, 0)).toEqual({ "site.coming_soon": false });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("isComingSoon", () => {
  it("stays closed until Home exists, whatever staff set", () => {
    expect(isComingSoon({ "site.coming_soon": false }, false)).toBe(true);
  });
  it("opens only on an explicit false once Home exists", () => {
    expect(isComingSoon({ "site.coming_soon": false }, true)).toBe(false);
    for (const v of [true, "false", 0, null, undefined]) expect(isComingSoon({ "site.coming_soon": v }, true)).toBe(true);
    expect(isComingSoon(null, true)).toBe(true);
  });
});

describe("siteText", () => {
  const c = { "coming_soon.title": { en: "Almost there.", ar: "  " } };
  it("uses what staff set for the language", () => {
    expect(siteText(c, "coming_soon.title", "en", "Coming soon.")).toBe("Almost there.");
  });
  it("falls back to the site's own wording when a language is blank, the key is unset or nothing loaded", () => {
    expect(siteText(c, "coming_soon.title", "ar", "قريباً.")).toBe("قريباً.");
    expect(siteText(c, "coming_soon.sub", "en", "Our new website is on its way.")).toBe("Our new website is on its way.");
    expect(siteText(null, "coming_soon.title", "en", "Coming soon.")).toBe("Coming soon.");
  });
});

describe("page switches", () => {
  const on = { "page.club.visible": true, "page.help.visible": false, "page.workshop.visible": "true" };
  it("shows a page only once staff switch it on", () => {
    expect(pageOn(on, "club")).toBe(true);
    expect(pageOn(on, "help")).toBe(false);
    expect(pageOn(on, "workshop")).toBe(false); // only an explicit true, as the staff page reads it
    expect(pageOn(null, "club")).toBe(false);
    expect(hiddenPages(on)).toEqual(["experiences", "workshop", "business", "help", "ambassadors", "about", "events", "gallery", "routes", "journal", "account", "terms", "bikes"]);
  });
  it("knows which addresses belong to a switched page", () => {
    expect(switchedPageOf("/club")).toBe("club");
    expect(switchedPageOf("/help/")).toBe("help");
    expect(switchedPageOf("/experiences/extra")).toBe("experiences");
    // a fleet bike's tag page counts as the Bikes page here; the proxy lets it through first
    expect(switchedPageOf("/bikes/42")).toBe("bikes");
    // the old addresses with a language still count
    expect(switchedPageOf("/en/club")).toBe("club");
    expect(switchedPageOf("/ar/help/")).toBe("help");
    for (const p of ["/", "/en", "/ar/", "/preview", "/en/preview", "/login", "/clubs", "/english", "/b/42"]) expect(switchedPageOf(p), p).toBeNull();
  });
  it("sends a switched-off page to Home", () => {
    expect(hiddenPageTarget("/help", on)).toBe("/");
    expect(hiddenPageTarget("/experiences/extra", null)).toBe("/");
    expect(hiddenPageTarget("/club", on)).toBeNull();
    expect(hiddenPageTarget("/", on)).toBeNull();
    expect(hiddenPageTarget("/preview", on)).toBeNull();
  });
  it("keeps the language of an old /en/... or /ar/... address it turns away", () => {
    expect(hiddenPageTarget("/ar/help", on)).toBe("/ar");
    expect(hiddenPageTarget("/en/experiences", null)).toBe("/en");
    expect(hiddenPageTarget("/en/club", on)).toBeNull();
    expect(hiddenPageTarget("/en", on)).toBeNull();
  });
});
