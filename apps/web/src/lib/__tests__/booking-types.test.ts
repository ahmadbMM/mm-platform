import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { typesFull } from "../booking-server";
import { toSession, typePlacesOf } from "../rides";
import { GET as account } from "../../app/api/booking/account/route";

// The booking steps on the website (the user, 2026-11-19): a bike type whose own places are taken says Full (the booking
// app's type caps, the database's _type_full_guard), and the account is read for the steps with the cookie's id and token.
const head = (n: number) => new Response(null, { status: 200, headers: { "content-range": `*/${n}` } });
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("each type's own places", () => {
  it("are read from the session's settings, a count or a count per size, never from a fleet picked bike by bike", () => {
    expect(typePlacesOf('{"_time":"20:00-22:00","Road":10,"Hybrid":{"S":3,"M":4}}')).toEqual({ Road: 10, Hybrid: 7 });
    expect(typePlacesOf({ _bikes: ["b1"], Road: 10 })).toBeNull();
    expect(typePlacesOf('{"_time":"20:00-22:00"}')).toBeNull();
    const s = toSession({ id: "2099-01-01", session_date: "2099-01-01", status: "open", bike_slots: '{"Road":10}', out_bikes: '{"Road":2}', event_kind: "regular", capacity: 40 })!;
    expect(s).toMatchObject({ typePlaces: { Road: 10 }, outBy: { Road: 2 } });
    // a ride staff approve counts no type
    expect(toSession({ id: "2099-01-02", session_date: "2099-01-02", status: "open", bike_slots: '{"Road":10}', event_kind: "community", ride_kind: "saturday" })!.typePlaces).toBeUndefined();
  });
  it("are full once the bookings and the bikes out take them all, and only while another type is still open", async () => {
    const f = vi.fn(async (url: string) => head(String(url).includes("type_preference=eq.Road") ? 8 : 1));
    expect(await typesFull({ id: "s1", typePlaces: { Road: 10, Hybrid: 5 }, outBy: { Road: 2 } }, f as unknown as typeof fetch)).toEqual(["Road"]);
    expect(String(f.mock.calls[0][0])).toContain("status=not.in.(cancelled,removed,noshow)");
    // every type full: the ride is its waitlist for all of them, so none is shut
    const all = vi.fn(async () => head(99));
    expect(await typesFull({ id: "s1", typePlaces: { Road: 10, Hybrid: 5 } }, all as unknown as typeof fetch)).toEqual([]);
    // a session staff marked full, or a count not read: nothing shut here (the database still refuses)
    expect(await typesFull({ id: "s1", typePlaces: { Road: 1 }, full: true }, all as unknown as typeof fetch)).toEqual([]);
    const down = vi.fn(async () => { throw new Error("down"); });
    expect(await typesFull({ id: "s1", typePlaces: { Road: 1, Hybrid: 1 } }, down as unknown as typeof fetch)).toEqual([]);
  });
});

describe("GET /api/booking/account", () => {
  const req = (cookie?: string) => new Request("https://micromobility.sa/api/booking/account", { headers: cookie ? { cookie } : {} });
  it("is signed out without the cookie, or with a token the booking app no longer takes", async () => {
    expect(await (await account(req())).json()).toEqual({ ok: true, signedIn: false });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    expect(await (await account(req("mm_acct=c1~0123456789abcdef"))).json()).toEqual({ ok: true, signedIn: false });
  });
  it("reads the account with the cookie's id and token, and says a failed read as such", async () => {
    const calls: { fn: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const fn = /\/rpc\/([a-z_]+)/.exec(String(url))?.[1] ?? "";
      calls.push({ fn, body: JSON.parse(String(init?.body ?? "{}")) });
      const answer: Record<string, unknown> = {
        customer_profile: [{ id: "c1", name: "Sara Ali", height: 168, gender: "female", nationality: "Saudi Arabia", birth_date: "1994-03-02" }],
        my_bookings: [{ id: "q1", session_id: "s1", status: "waiting" }], community_member: true, customer_fix_fields: [],
      };
      return new Response(JSON.stringify(answer[fn] ?? null), { status: 200 });
    }));
    const b = await (await account(req("mm_acct=c1~0123456789abcdef"))).json();
    expect(b).toMatchObject({ ok: true, signedIn: true, acct: { name: "Sara Ali", height: 168, member: true, live: { s1: 1 }, gender: "female", profileGate: "none" } });
    expect(calls.every((c) => c.body.p_id === "c1" && c.body.p_token === "0123456789abcdef")).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    expect((await account(req("mm_acct=c1~0123456789abcdef"))).status).toBe(502);
  });
});
