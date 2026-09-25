import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kindNames, loadRides, resetRides, rideKind, sessionName, slotTimes, toSession, upcoming, type RideSession } from "../rides";

// /experiences shows the booking system's own prices and sessions. The rules mirror the booking
// app and the database, so the page never promises a ride someone cannot book.

const row = (o: Record<string, unknown>) => ({ id: "2026-09-27", session_date: "2026-09-27", status: "open", title: null, ride_kind: null, event_kind: null, bike_slots: '{"_time":"21:00 - 23:00","_total":150,"_collect":"20:15"}', open_to_all: false, paid_ride: false, ...o });

describe("rideKind", () => {
  it("reads the kind the way the booking app does", () => {
    expect(rideKind({ event_kind: null, ride_kind: null })).toBe("jcc");
    expect(rideKind({ event_kind: "community", ride_kind: "snd96" })).toBe("snd96");
    expect(rideKind({ event_kind: null, ride_kind: "snd96" })).toBe("snd96");
    expect(rideKind({ event_kind: "community", ride_kind: "swim" })).toBe("swim");
    expect(rideKind({ event_kind: "community", ride_kind: "workshop" })).toBe("workshop");
    expect(rideKind({ event_kind: "community", ride_kind: "petromin" })).toBe("petromin");
    expect(rideKind({ event_kind: "community", ride_kind: "saturday" })).toBe("saturday");
    expect(rideKind({ event_kind: "community", ride_kind: null })).toBe("saturday");
    // a kind that is not a community event is a circuit night, whatever it says
    expect(rideKind({ event_kind: null, ride_kind: "swim" })).toBe("jcc");
  });
});

describe("slotTimes", () => {
  it("reads the two times from the session settings", () => {
    expect(slotTimes('{"_time":"21:00 - 23:00"}')).toEqual(["21:00", "23:00"]);
    expect(slotTimes({ _time: "9:00-11:30" })).toEqual(["09:00", "11:30"]);
  });
  it("answers null for anything else", () => {
    for (const v of [null, undefined, "", "not json", "{}", '{"_time":"evening"}', 42]) expect(slotTimes(v)).toBeNull();
  });
});

describe("toSession", () => {
  it("shows a circuit night as open to all and paid", () => {
    expect(toSession(row({}))).toEqual({ id: "2026-09-27", date: "2026-09-27", full: false, title: null, kind: "jcc", members: false, free: false, times: ["21:00", "23:00"], gather: false, noCarbon: false });
  });
  it("marks a community ride members-only and free, unless the session says otherwise", () => {
    const sat = toSession(row({ event_kind: "community", ride_kind: "saturday", title: "Saturday Social Ride", bike_slots: '{"_time":"05:45 - 06:15"}' }));
    expect(sat).toMatchObject({ kind: "saturday", members: true, free: true, gather: true, title: "Saturday Social Ride", times: ["05:45", "06:15"], noCarbon: true });
    expect(toSession(row({ event_kind: "community", ride_kind: "workshop", open_to_all: true }))).toMatchObject({ members: false, free: true, gather: false });
    expect(toSession(row({ event_kind: "community", ride_kind: "saturday", paid_ride: true }))).toMatchObject({ members: true, free: false });
  });
  it("treats the National Day ride as a paid ride that gathers, members-only only where the row says so", () => {
    expect(toSession(row({ ride_kind: "snd96" }))).toMatchObject({ kind: "snd96", members: false, free: false, gather: true });
    // the database's members gate reads event_kind alone
    expect(toSession(row({ ride_kind: "snd96", event_kind: "community" }))).toMatchObject({ members: true, free: false });
  });
  it("shows a full session, and leaves out closed, deleted and Petromin ones", () => {
    expect(toSession(row({ status: "full" }))?.full).toBe(true);
    for (const status of ["closed", "deleted", null]) expect(toSession(row({ status }))).toBeNull();
    expect(toSession(row({ event_kind: "community", ride_kind: "petromin" }))).toBeNull();
    expect(toSession(row({ session_date: "27/09/2026" }))).toBeNull();
  });
});

describe("upcoming", () => {
  const s = (date: string, times: [string, string] | null, id = date): RideSession => ({ id, date, full: false, title: null, kind: "jcc", members: false, free: false, times, gather: false, noCarbon: false });
  it("keeps what is still ahead, soonest first", () => {
    const got = upcoming([s("2026-09-29", ["21:00", "23:00"]), s("2026-09-23", ["21:00", "23:00"]), s("2026-09-27", ["21:00", "23:00"]), s("2026-09-27", ["18:00", "19:00"], "pool")], "2026-09-24T22:30");
    expect(got.map((x) => x.id)).toEqual(["pool", "2026-09-27", "2026-09-29"]);
  });
  it("drops tonight's session once it is over", () => {
    const tonight = [s("2026-09-24", ["18:00", "19:00"], "pool"), s("2026-09-24", ["21:00", "23:00"], "circuit"), s("2026-09-24", ["22:00", "01:00"], "late"), s("2026-09-24", null, "untimed")];
    expect(upcoming(tonight, "2026-09-24T18:30").map((x) => x.id)).toEqual(["untimed", "pool", "circuit", "late"]);
    expect(upcoming(tonight, "2026-09-24T22:30").map((x) => x.id)).toEqual(["untimed", "circuit", "late"]);
    expect(upcoming(tonight, "2026-09-24T23:00").map((x) => x.id)).toEqual(["untimed", "late"]);
  });
});

describe("loadRides", () => {
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  const PRICES = [{ type: "Road", price: 75 }, { type: "Hybrid", price: 57.5 }, { type: "bad", price: "free" }];
  const ok = () => vi.fn(async (url: string) => json(url.includes("ride_prices") ? PRICES : [row({}), row({ id: "p", event_kind: "community", ride_kind: "petromin" })]));

  beforeEach(() => {
    resetRides();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("asks for the prices and today's sessions on, and keeps them for a minute", async () => {
    const f = ok();
    const at = Date.parse("2026-09-24T21:30:00Z"); // 00:30 on the 25th in Riyadh
    const a = await loadRides(f as unknown as typeof fetch, at);
    expect(a?.prices).toEqual([{ type: "Road", price: 75 }, { type: "Hybrid", price: 57.5 }]);
    expect(a?.sessions.map((x) => x.id)).toEqual(["2026-09-27"]);
    const urls = f.mock.calls.map((c) => c[0] as string);
    expect(urls).toContain("https://example.supabase.co/rest/v1/ride_prices?select=type,price");
    expect(urls.find((u) => u.includes("/sessions?"))).toMatch(/session_date=gte\.2026-09-25&status=in\.\(open,full\)/);
    expect(await loadRides(f as unknown as typeof fetch, at + 30_000)).toBe(a);
    expect(f).toHaveBeenCalledTimes(2);
    await loadRides(f as unknown as typeof fetch, at + 61_000);
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("keeps the last good copy of each through a failed read", async () => {
    await loadRides(ok() as unknown as typeof fetch, 0);
    const half = vi.fn(async (url: string) => (url.includes("ride_prices") ? json({ message: "down" }, 503) : json([])));
    const b = await loadRides(half as unknown as typeof fetch, 70_000);
    expect(b?.prices).toHaveLength(2);
    expect(b?.sessions).toEqual([]);
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect((await loadRides(down as unknown as typeof fetch, 140_000))?.prices).toHaveLength(2);
  });

  it("answers null when it never read anything", async () => {
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect(await loadRides(down as unknown as typeof fetch, 0)).toBeNull();
  });
});

describe("sessionName", () => {
  const en = kindNames({ jccName: "Evening Circuit Session", satName: "Saturday Social Ride", swimName: "Triathlon Pool Session", workshopName: "T100 Triathlon Prep", snd96Name: "National Day Ride" });
  const ar = kindNames({ jccName: "جلسة الحلبة المسائية", satName: "جولة السبت الاجتماعية", swimName: "جلسة المسبح", workshopName: "T100", snd96Name: "اليوم الوطني" });
  it("names a circuit night by its fixed name and any other session by its title, else its kind", () => {
    expect(sessionName({ kind: "jcc", title: "Special night" }, en, en, false)).toBe("Evening Circuit Session");
    expect(sessionName({ kind: "saturday", title: "Founders ride" }, en, en, false)).toBe("Founders ride");
    expect(sessionName({ kind: "swim", title: null }, en, en, false)).toBe("Triathlon Pool Session");
  });
  it("reads a title that is just the kind's English name in Arabic on the Arabic page", () => {
    expect(sessionName({ kind: "saturday", title: "saturday social ride" }, ar, en, true)).toBe("جولة السبت الاجتماعية");
    expect(sessionName({ kind: "saturday", title: "Founders ride" }, ar, en, true)).toBe("Founders ride");
  });
});
