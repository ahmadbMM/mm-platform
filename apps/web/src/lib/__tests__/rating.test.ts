import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingOrigin, cleanRating, isRated, tagsRefused, withoutTags } from "../rating";
import { POST as rate } from "../../app/api/account/rate/route";
import { POST as wallet } from "../../app/api/google-wallet/route";
import { resetSiteContent } from "../site";

// The post-ride rating and the Google Wallet pass, as the account page offers them: what the
// browser sends is checked, the account cookie supplies the id and token, and a database from
// before the rating_tags migration still takes the scores.
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const post = (fn: (r: Request) => Promise<Response>, path: string, body: unknown, headers: Record<string, string> = HEADERS) =>
  fn(new Request(`https://micromobility.sa${path}`, { method: "POST", headers, body: JSON.stringify(body) }));
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

describe("cleanRating", () => {
  it("keeps a rating as the booking app writes one, and nothing else", () => {
    expect(cleanRating({ entryId: "q1abcdef", exp: 9, bike: 7, tags: ["route", "fun", "route", "car"], note: " Great night \u0007 " })).toEqual({
      entryId: "q1abcdef", patch: { rating_exp: 9, rating_bike: 7, feedback: "Great night", rating_tags: ["route", "fun"] },
    });
    // the pool has no bike, a note is optional, tags may be none
    expect(cleanRating({ entryId: "q1", exp: 10 })).toEqual({ entryId: "q1", patch: { rating_exp: 10 } });
    expect(cleanRating({ entryId: "q1", exp: 10, bike: 0, tags: [], note: "" })).toEqual({ entryId: "q1", patch: { rating_exp: 10 } });
    for (const bad of [null, {}, { entryId: "q1" }, { entryId: "q1", exp: 11 }, { entryId: "q1", exp: 2.5 }, { entryId: "q;1", exp: 5 }, { entryId: "q1", exp: "5" }]) expect(cleanRating(bad)).toBeNull();
    expect(cleanRating({ entryId: "q1", exp: 5, note: "x".repeat(600) })!.patch.feedback).toHaveLength(500);
  });
  it("can drop the tags for an older database, and knows when it must", () => {
    expect(withoutTags({ rating_exp: 8, rating_bike: 6, rating_tags: ["pace"] })).toEqual({ rating_exp: 8, rating_bike: 6 });
    expect(tagsRefused('column "rating_tags" does not exist')).toBe(true);
    expect(tagsRefused("token")).toBe(false);
    expect(isRated({ rating_exp: 8 })).toBe(true);
    expect(isRated({ rating_bike: 3, rating_exp: null })).toBe(true);
    expect(isRated({ rating_exp: null, rating_bike: null })).toBe(false);
  });
});

describe("api/account/rate", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("writes the rating through customer_booking_update with the cookie's id and token", async () => {
    const f = vi.fn(async () => json(true));
    vi.stubGlobal("fetch", f);
    const res = await post(rate, "/api/account/rate", { entryId: "q1abcdef", exp: 9, bike: 7, tags: ["staff"], note: "Thanks" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/customer_booking_update");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN, p_entry_id: "q1abcdef", p_patch: { rating_exp: 9, rating_bike: 7, feedback: "Thanks", rating_tags: ["staff"] } });
  });
  it("writes again without the tags when the database does not know them yet", async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) => (String(init?.body).includes("rating_tags") ? json({ code: "42703", message: 'column "rating_tags" of relation "queue_entries" does not exist' }, 400) : json(true)));
    vi.stubGlobal("fetch", f);
    const res = await post(rate, "/api/account/rate", { entryId: "q1abcdef", exp: 9, tags: ["fun"] });
    expect(await res.json()).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((f.mock.calls[1] as unknown as [string, RequestInit])[1].body)).p_patch).toEqual({ rating_exp: 9 });
  });
  it("refuses another site, a missing cookie and a malformed rating without touching the database", async () => {
    const f = vi.fn(async () => json(true));
    vi.stubGlobal("fetch", f);
    expect((await post(rate, "/api/account/rate", { entryId: "q1", exp: 5 }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post(rate, "/api/account/rate", { entryId: "q1", exp: 5 }, { origin: HEADERS.origin })).status).toBe(401);
    expect((await post(rate, "/api/account/rate", { entryId: "q1", exp: 0 })).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
    vi.stubGlobal("fetch", vi.fn(async () => json(false)));
    expect((await post(rate, "/api/account/rate", { entryId: "q1", exp: 5 })).status).toBe(409);
  });
});

describe("api/google-wallet", () => {
  beforeEach(() => { resetSiteContent(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("knows the booking app's origin, as staff set it", () => {
    expect(bookingOrigin(null)).toBe("https://micromobilityrentals.pages.dev");
    expect(bookingOrigin({ "site.links.booking": { href: "https://book.micromobility.sa/?x=1" } })).toBe("https://book.micromobility.sa");
    expect(bookingOrigin({ "site.links.booking": { href: "javascript:alert(1)" } })).toBe("https://micromobilityrentals.pages.dev");
  });
  it("asks the booking app for the pass with the cookie's id and token and hands the save link back", async () => {
    const f = vi.fn(async (url: string) => (url.includes("site_content") ? json([{ key: "site.links.booking", value: { href: "https://book.micromobility.sa/" } }]) : json({ ok: true, url: "https://pay.google.com/gp/v/save/eyJ" })));
    vi.stubGlobal("fetch", f);
    const res = await post(wallet, "/api/google-wallet", { bookingId: "q1abcdef", groupIds: ["q1abcdef", "q2abcdef", "bad;id"] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, url: "https://pay.google.com/gp/v/save/eyJ" });
    const call = f.mock.calls.find((c) => String(c[0]).includes("/api/google-wallet")) as unknown as [string, RequestInit];
    expect(call[0]).toBe("https://book.micromobility.sa/api/google-wallet");
    expect(JSON.parse(String(call[1].body))).toEqual({ customerId: "c1", token: TOKEN, bookingId: "q1abcdef", groupIds: ["q1abcdef", "q2abcdef"] });
  });
  it("passes a 501 (not set up) and a 409 (not confirmed) on, and never a link elsewhere", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("site_content") ? json([]) : json({ ok: false, skipped: "google wallet not configured" }, 501))));
    expect((await post(wallet, "/api/google-wallet", { bookingId: "q1abcdef" })).status).toBe(501);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("site_content") ? json([]) : json({ ok: false, error: "not confirmed" }, 409))));
    const nc = await post(wallet, "/api/google-wallet", { bookingId: "q1abcdef" });
    expect(nc.status).toBe(409);
    expect(await nc.json()).toEqual({ ok: false, error: "not confirmed" });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("site_content") ? json([]) : json({ ok: true, url: "https://evil.example/save" }))));
    expect(await (await post(wallet, "/api/google-wallet", { bookingId: "q1abcdef" })).json()).toEqual({ ok: false });
  });
  it("refuses another site, a missing cookie and a bad id", async () => {
    const f = vi.fn(async () => json({}));
    vi.stubGlobal("fetch", f);
    expect((await post(wallet, "/api/google-wallet", { bookingId: "q1" }, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post(wallet, "/api/google-wallet", { bookingId: "q1" }, { origin: HEADERS.origin })).status).toBe(401);
    expect((await post(wallet, "/api/google-wallet", { bookingId: "q 1" })).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
});
