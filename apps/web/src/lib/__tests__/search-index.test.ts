import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The header search's server action (app/[locale]/search-index.ts) can be called by anyone, from
// anywhere: while the site is Coming Soon it answers nothing, except to staff previewing the site.
// cookies() is a request's; here it holds the staff preview cookie the test sets, or none.
const jar = vi.hoisted(() => ({ preview: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "mm_preview" && jar.preview ? { name: n, value: jar.preview } : undefined) }) }));

import { searchIndex } from "../../app/[locale]/search-index";
import { resetSiteContent } from "../site";

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
// the site's content: Coming Soon on or off, and the Help page switched on
const db = (soon: boolean) => vi.fn(async (url: string) =>
  url.includes("/rpc/is_staff") ? json(true) : url.includes("/site_content?") && url.includes("key=not.like.journal") ? json([{ key: "site.coming_soon", value: soon }, { key: "page.help.visible", value: true }]) : json([]));

beforeEach(() => {
  resetSiteContent();
  jar.preview = "";
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("the header search's index", () => {
  it("is empty while the site is Coming Soon", async () => {
    vi.stubGlobal("fetch", db(true));
    expect(await searchIndex("en")).toEqual([]);
  });
  it("holds the switched-on pages' answers once the site is open, and for staff previewing it before", async () => {
    vi.stubGlobal("fetch", db(false));
    const open = await searchIndex("en");
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((x) => x.href.startsWith("/help"))).toBe(true);
    resetSiteContent();
    vi.stubGlobal("fetch", db(true));
    jar.preview = "staff.preview.token";
    expect((await searchIndex("ar")).length).toBeGreaterThan(0);
  });
});
