import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { firstName, inBirthdayWeek, riyadhDay } from "../birthday";
import { GET } from "../../app/api/account/birthday/route";

// The birthday week (the user, 2026-11-15): confetti and a "Happy birthday, {name}!" line in the three days either side
// of a signed-in account's birthday, as the booking app plays it (tests/birthday-confetti.spec.ts there).

describe("the birthday week", () => {
  it("is the three days either side of the birthday, Saudi dates", () => {
    expect(inBirthdayWeek("1990-11-18", "2026-11-15")).toBe(true); // three days before
    expect(inBirthdayWeek("1990-11-19", "2026-11-15")).toBe(false); // four days before
    expect(inBirthdayWeek("1990-11-12", "2026-11-15")).toBe(true); // three days after
    expect(inBirthdayWeek("1990-11-11", "2026-11-15")).toBe(false); // four days after
    expect(inBirthdayWeek("1990-11-15", "2026-11-15")).toBe(true);
  });
  it("crosses a year's end and keeps 29 February on 28 February in a common year", () => {
    expect(inBirthdayWeek("1990-01-02", "2026-12-30")).toBe(true);
    expect(inBirthdayWeek("1990-12-30", "2027-01-02")).toBe(true);
    expect(inBirthdayWeek("2000-02-29", "2027-03-03")).toBe(true);
    expect(inBirthdayWeek("2000-02-29", "2027-03-04")).toBe(false);
    expect(inBirthdayWeek("2000-02-29", "2027-02-25")).toBe(true); // three days before the 28th
    expect(inBirthdayWeek("2000-02-29", "2028-02-25")).toBe(false); // a leap year has its own 29th, four days on
  });
  it("is nothing without a date", () => {
    for (const b of [null, undefined, "", "soon", "1990-13-01", "1990-00-10"]) expect(inBirthdayWeek(b, "2026-11-15")).toBe(false);
  });
  it("wishes the first name, and counts the day in Riyadh", () => {
    expect(firstName("  Rana   Al Rider ")).toBe("Rana");
    expect(firstName("")).toBe("");
    expect(firstName(null)).toBe("");
    expect(riyadhDay(new Date("2026-11-15T20:59:00Z"))).toBe("2026-11-15");
    expect(riyadhDay(new Date("2026-11-15T21:00:00Z"))).toBe("2026-11-16");
  });
});

const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}` };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

describe("api/account/birthday", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T09:00:00Z")); // noon in Riyadh
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const get = (headers: Record<string, string> = HEADERS) => GET(new Request("https://micromobility.sa/api/account/birthday", { headers }));
  const db = (answer: Response) => vi.fn(async () => answer.clone());

  it("says the week is on with the first name, never the birth date, read with the account's id and token", async () => {
    const fx = db(json([{ name: "Rana Rider", birth_date: "1994-11-17", email: "r@x.test" }]));
    vi.stubGlobal("fetch", fx);
    const r = await get();
    expect(r.headers.get("cache-control")).toBe("no-store, private");
    expect(await r.json()).toEqual({ signedIn: true, on: true, day: "2026-11-15", first: "Rana" });
    const [url, init] = fx.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.split("/rpc/")[1]).toBe("customer_profile");
    expect(JSON.parse(String(init.body))).toEqual({ p_id: "c1", p_token: TOKEN });
  });
  it("is off outside the week, without a date or a name, and when the database cannot be read", async () => {
    vi.stubGlobal("fetch", db(json([{ name: "Rana Rider", birth_date: "1994-11-19" }])));
    expect(await (await get()).json()).toEqual({ signedIn: true, on: false, day: "2026-11-15" });
    vi.stubGlobal("fetch", db(json([{ name: "Rana Rider", birth_date: null }])));
    expect(await (await get()).json()).toEqual({ signedIn: true, on: false, day: "2026-11-15" });
    vi.stubGlobal("fetch", db(json([{ name: "", birth_date: "1994-11-15" }])));
    expect(await (await get()).json()).toEqual({ signedIn: true, on: false, day: "2026-11-15" });
    vi.stubGlobal("fetch", db(json({ message: "down" }, 503)));
    expect(await (await get()).json()).toEqual({ signedIn: true, on: false, day: "2026-11-15", error: "unread" });
  });
  it("is signed out for a spent token, and asks nothing signed out", async () => {
    vi.stubGlobal("fetch", db(json([])));
    expect(await (await get()).json()).toEqual({ signedIn: false });
    const fy = db(json([]));
    vi.stubGlobal("fetch", fy);
    expect(await (await get({})).json()).toEqual({ signedIn: false });
    expect(fy).not.toHaveBeenCalled();
  });
});
