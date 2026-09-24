import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hiddenPages, hiddenPageTarget, isComingSoon, loadSiteContent, pageOn, resetSiteContent, siteText, switchedPageOf } from "../site";

// micromobility.sa reads what staff set in the staff page (public.site_content). The rules
// that keep it safe: a minute's cache, the last good copy through a failed read, the site's
// own wording when nothing is set, and Coming Soon unless Home exists AND staff opened it.

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
  });

  it("keeps the last good copy when a read fails", async () => {
    await loadSiteContent(rows([{ key: "site.coming_soon", value: true }]) as unknown as typeof fetch, 0);
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect(await loadSiteContent(down as unknown as typeof fetch, 70_000)).toEqual({ "site.coming_soon": true });
    const refused = vi.fn(async () => new Response("{}", { status: 402 }));
    expect(await loadSiteContent(refused as unknown as typeof fetch, 140_000)).toEqual({ "site.coming_soon": true });
  });

  it("answers null when it never read anything", async () => {
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect(await loadSiteContent(down as unknown as typeof fetch, 0)).toBeNull();
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
    expect(hiddenPages(on)).toEqual(["experiences", "workshop", "business", "help", "ambassadors", "about", "events", "gallery", "routes", "journal"]);
  });
  it("knows which addresses belong to a switched page", () => {
    expect(switchedPageOf("/en/club")).toBe("club");
    expect(switchedPageOf("/ar/help/")).toBe("help");
    expect(switchedPageOf("/en/experiences/extra")).toBe("experiences");
    for (const p of ["/", "/en", "/ar/", "/en/preview", "/en/login", "/en/clubs", "/club", "/b/42"]) expect(switchedPageOf(p)).toBeNull();
  });
  it("sends a switched-off page to that language's Home", () => {
    expect(hiddenPageTarget("/ar/help", on)).toBe("/ar");
    expect(hiddenPageTarget("/en/experiences", null)).toBe("/en");
    expect(hiddenPageTarget("/en/club", on)).toBeNull();
    expect(hiddenPageTarget("/en", on)).toBeNull();
    expect(hiddenPageTarget("/en/preview", on)).toBeNull();
  });
});
