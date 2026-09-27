import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanPositions, cookieValue, liveAnswer } from "../live";
import { GET } from "../../app/api/live/route";

// The live ride map: what live_positions_for's answer means, the rows in it, and the route that
// hands them to the map with the account cookie's id and token.

describe("cleanPositions", () => {
  it("keeps one well-formed row per role, the leader first", () => {
    const rows = cleanPositions([
      { role: "sweeper", lat: 21.6, lng: 39.1, heading: 90, speed: 6.2, at: "2026-09-27T18:00:00Z" },
      { role: "leader", lat: 21.5, lng: 39.1, heading: null, speed: null, at: "2026-09-27T18:00:05Z" },
      { role: "leader", lat: 0, lng: 0, at: "again" }, // a second leader is ignored
      { role: "car", lat: 1, lng: 1 }, { role: "leader", lat: 95, lng: 0 }, { role: "leader", lat: "21.5", lng: 39 }, null, "x",
    ]);
    expect(rows.map((r) => r.role)).toEqual(["leader", "sweeper"]);
    expect(rows[0]).toEqual({ role: "leader", lat: 21.5, lng: 39.1, heading: null, speed: null, at: "2026-09-27T18:00:05Z" });
    expect(rows[1].speed).toBe(6.2);
    expect(cleanPositions(null)).toEqual([]);
  });
});

describe("liveAnswer", () => {
  it("reads the function's answer, and knows a database that does not have it yet", () => {
    expect(liveAnswer({ status: 200, data: { ok: true, positions: [{ role: "leader", lat: 1, lng: 2 }], now: "t" }, message: "" })).toEqual({ ok: true, positions: [{ role: "leader", lat: 1, lng: 2, heading: null, speed: null, at: "" }], now: "t" });
    expect(liveAnswer({ status: 200, data: { ok: false, error: "not_booked" }, message: "" })).toEqual({ ok: false, error: "not_booked" });
    expect(liveAnswer({ status: 200, data: { ok: false, error: "denied" }, message: "" })).toEqual({ ok: false, error: "signin" });
    expect(liveAnswer({ status: 404, data: null, message: "Could not find the function public.live_positions_for(p_id, p_session_id, p_token) in the schema cache" })).toEqual({ ok: false, error: "unavailable" });
    expect(liveAnswer({ status: 400, data: null, message: "PGRST202: ..." })).toEqual({ ok: false, error: "unavailable" });
    expect(liveAnswer({ status: 0, data: null, message: "" })).toEqual({ ok: false, error: "network" });
    expect(liveAnswer({ status: 503, data: null, message: "" })).toEqual({ ok: false, error: "network" });
    expect(liveAnswer({ status: 200, data: "nonsense", message: "" })).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("cookieValue", () => {
  it("reads one cookie out of the header", () => {
    expect(cookieValue("a=1; mm_acct=c1~tok; b=2", "mm_acct")).toBe("c1~tok");
    expect(cookieValue("mm_acct=c1~tok", "mm_acct")).toBe("c1~tok");
    expect(cookieValue("xmm_acct=no; other=1", "mm_acct")).toBeNull();
    expect(cookieValue(null, "mm_acct")).toBeNull();
  });
});

describe("api/live", () => {
  const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
  const call = (q: string, cookie?: string) => GET(new Request(`https://micromobility.sa/api/live${q}`, { headers: cookie ? { cookie } : {} }));
  const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("asks live_positions_for with the cookie's id and token and hands the rows on", async () => {
    const f = answer({ ok: true, positions: [{ role: "leader", lat: 21.5, lng: 39.1, heading: 12, speed: 5, at: "2026-09-27T18:00:00Z" }], now: "2026-09-27T18:00:03Z" });
    vi.stubGlobal("fetch", f);
    const res = await call("?session=2026-09-27", `NEXT_LOCALE=en; mm_acct=c1~${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, positions: [{ role: "leader", lat: 21.5, lng: 39.1, heading: 12, speed: 5, at: "2026-09-27T18:00:00Z" }], now: "2026-09-27T18:00:03Z" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/live_positions_for");
    expect(JSON.parse(String(init.body))).toEqual({ p_session_id: "2026-09-27", p_id: "c1", p_token: TOKEN });
  });
  it("answers signin without a good cookie, not_booked for a bad id, and never asks the database for either", async () => {
    const f = answer({ ok: true, positions: [] });
    vi.stubGlobal("fetch", f);
    expect((await call("?session=2026-09-27")).status).toBe(401);
    expect(await (await call("?session=2026-09-27", "mm_acct=broken")).json()).toEqual({ ok: false, error: "signin" });
    const bad = await call("?session=2026-09-27;drop", `mm_acct=c1~${TOKEN}`);
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ ok: false, error: "not_booked" });
    expect(f).not.toHaveBeenCalled();
  });
  it("says the map is not available yet when the database has no such function", async () => {
    vi.stubGlobal("fetch", answer({ code: "PGRST202", message: "Could not find the function" }, 404));
    const res = await call("?session=2026-09-27", `mm_acct=c1~${TOKEN}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, error: "unavailable" });
  });
});
