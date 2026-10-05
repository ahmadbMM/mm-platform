import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kindNames, loadRides, readSessions, resetRides, rideKind, routeSlugOf, sessionName, sessionRows, slotTimes, toSession, upcoming, type RideSession, collectTime } from "../rides";
import { memoSettled } from "../memo";

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
    expect(rideKind({ event_kind: "community", ride_kind: "event" })).toBe("event"); // a ticketed event (2026-09-28)
    expect(rideKind({ event_kind: null, ride_kind: "event" })).toBe("jcc");
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
    expect(toSession(row({}))).toEqual({ id: "2026-09-27", date: "2026-09-27", full: false, title: null, kind: "jcc", members: false, free: false, times: ["21:00", "23:00"], gather: false, noCarbon: false, description: null, price: null, seats: null, routeSlug: null, collect: "20:15", approval: false, capacity: null, left: null,
      spots: null, addons: [], wlCap: null, km: { beg: 20, int: 40 }, meetUrl: null, location: null });
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
  it("reads a ticketed event: its blurb, its seat price only when it is a paid ride, its seats, who may book", () => {
    const ev = { id: "2026-10-05-ev", event_kind: "community", ride_kind: "event", title: "Bike maintenance 101", description: "  Two hours on brakes, gears and flats.  ", price: 50, paid_ride: true, open_to_all: true, capacity: 40, bike_slots: '{"_time":"19:00 - 21:00"}' };
    expect(toSession(row(ev))).toMatchObject({ kind: "event", title: "Bike maintenance 101", description: "Two hours on brakes, gears and flats.", price: 50, seats: 40, members: false, free: false, gather: false });
    // a free event: the database charges nothing whatever the price column says (_fare_now)
    expect(toSession(row({ ...ev, paid_ride: false }))).toMatchObject({ free: true, price: null, seats: 40 });
    // a members' event, and one with no seats or blurb set
    expect(toSession(row({ ...ev, open_to_all: false }))).toMatchObject({ members: true });
    expect(toSession(row({ ...ev, capacity: null, description: "", price: "50" }))).toMatchObject({ seats: null, description: null, price: 50 });
    // seats and a price mean nothing on a ride
    expect(toSession(row({ capacity: 150, price: 75, paid_ride: true }))).toMatchObject({ kind: "jcc", price: null, seats: null });
  });
  it("carries the route a ride follows, when the slug is one the Routes page could hold", () => {
    expect(toSession(row({ route_slug: "obhur-coast" }))?.routeSlug).toBe("obhur-coast");
    for (const bad of ["Obhur Coast", "-x", "a--b", "", null, 42, "x".repeat(61)]) expect(routeSlugOf(bad), String(bad)).toBeNull();
  });
  it("shows a full session, and leaves out closed, deleted and Petromin ones", () => {
    expect(toSession(row({ status: "full" }))?.full).toBe(true);
    for (const status of ["closed", "deleted", null]) expect(toSession(row({ status }))).toBeNull();
    expect(toSession(row({ event_kind: "community", ride_kind: "petromin" }))).toBeNull();
    expect(toSession(row({ session_date: "27/09/2026" }))).toBeNull();
  });
});

describe("when bikes go out", () => {
  it("is the session's own time, or 45 minutes before the start, as the booking app's", () => {
    expect(collectTime('{"_time":"21:00 - 23:00","_collect":"20:15"}')).toBe("20:15");
    expect(collectTime('{"_time":"21:00 - 23:00"}')).toBe("20:15");
    expect(collectTime({ _time: "6:30 - 8:00" })).toBe("05:45");
    expect(collectTime({ _time: "00:20 - 02:00" })).toBe("00:00");
    expect(collectTime("{}")).toBeNull();
    expect(collectTime("not json")).toBeNull();
  });
  it("is said only on a ride with bikes that does not gather", () => {
    expect(toSession(row({ bike_slots: '{"_time":"21:00 - 23:00"}' }))!.collect).toBe("20:15");
    expect(toSession(row({ event_kind: "community", ride_kind: "saturday", bike_slots: '{"_time":"05:45 - 06:15"}' }))!.collect).toBeNull();
    expect(toSession(row({ event_kind: "community", ride_kind: "swim", bike_slots: '{"_time":"18:00 - 19:00"}' }))!.collect).toBeNull();
  });
});

describe("upcoming", () => {
  const s = (date: string, times: [string, string] | null, id = date): RideSession => ({ id, date, full: false, title: null, kind: "jcc", members: false, free: false, times, gather: false, noCarbon: false, description: null, price: null, seats: null, routeSlug: null, collect: null });
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
    expect(f).toHaveBeenCalledTimes(3); // the prices, the sessions, and the open night's places
    expect(await loadRides(f as unknown as typeof fetch, at + 61_000)).toBe(a); // past the minute: served as it is, refreshed behind
    await memoSettled();
    expect(f).toHaveBeenCalledTimes(6);
  });

  it("counts the places left on an open night nobody approves, as a number only", async () => {
    const taken = (n: number) => new Response(null, { status: 200, headers: { "content-range": `0-0/${n}` } });
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") return taken(url.includes("session_id=eq.2026-09-27") ? 148 : 0);
      if (url.includes("ride_prices")) return json(PRICES);
      return json([row({ capacity: 150 }), row({ id: "2026-09-28", session_date: "2026-09-28" }), row({ id: "full", session_date: "2026-09-29", status: "full" }),
        row({ id: "sat", session_date: "2026-09-30", event_kind: "community", ride_kind: "saturday" })]);
    });
    const r = await loadRides(f as unknown as typeof fetch, Date.parse("2026-09-24T21:30:00Z"));
    expect(Object.fromEntries(r!.sessions.map((x) => [x.id, x.left]))).toEqual({ "2026-09-27": 2, "2026-09-28": 12, full: null, sat: null });
    const head = f.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "HEAD").map((c) => c[0] as string);
    expect(head).toHaveLength(2);
    expect(head[0]).toMatch(/queue_public\?select=id&session_id=eq\.2026-09-27&status=not\.in\.\(cancelled,removed,noshow\)&or=\(type_preference\.is\.null,type_preference\.neq\.Own\)/);
    await memoSettled();
  });

  it("keeps the last good copy of each through a failed read", async () => {
    const a = await loadRides(ok() as unknown as typeof fetch, 0);
    const half = vi.fn(async (url: string) => (url.includes("ride_prices") ? json({ message: "down" }, 503) : json([])));
    expect(await loadRides(half as unknown as typeof fetch, 70_000)).toBe(a); // served as it was while the refresh runs
    await memoSettled();
    const b = await loadRides(half as unknown as typeof fetch, 80_000);
    expect(b?.prices).toHaveLength(2); // the prices' read failed: kept
    expect(b?.sessions).toEqual([]); // the sessions' read answered: taken
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect(await loadRides(down as unknown as typeof fetch, 140_000)).toBe(b);
    await memoSettled();
    expect((await loadRides(down as unknown as typeof fetch, 150_000))?.prices).toHaveLength(2);
  });

  it("answers null when it never read anything", async () => {
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect(await loadRides(down as unknown as typeof fetch, 0)).toBeNull();
  });
});

describe("sessionRows", () => {
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  beforeEach(() => resetRides());
  it("asks for the new columns, and asks again without them when the database does not have them yet", async () => {
    // PostgREST refuses the whole read (400, 42703) for a column that does not exist
    const f = vi.fn(async (url: string) => (url.includes("route_slug") ? json({ code: "42703", message: "column sessions.route_slug does not exist" }, 400) : json([{ id: "a" }])));
    expect(await sessionRows(f as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a", undefined, 1000)).toEqual([{ id: "a" }]);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[0][0]).toContain("select=id,session_date,status,title,ride_kind,event_kind,bike_slots,open_to_all,paid_ride,capacity,needs_approval,spots,addons,meet_url,location,description,price,route_slug&id=eq.a");
    expect(f.mock.calls[1][0]).toContain("select=id,session_date,status,title,ride_kind,event_kind,bike_slots,open_to_all,paid_ride,capacity,needs_approval,spots,addons,meet_url,location&id=eq.a");
    // for the next ten minutes the old columns are asked for straight away; then the new ones are tried again
    expect(await sessionRows(f as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a", undefined, 2000)).toEqual([{ id: "a" }]);
    expect(f).toHaveBeenCalledTimes(3);
    expect(f.mock.calls[2][0]).not.toContain("route_slug");
    await sessionRows(f as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a", undefined, 1000 + 11 * 60_000);
    expect(f.mock.calls[3][0]).toContain("route_slug");
  });
  it("takes the new columns when the database has them, and passes any other failure on", async () => {
    const ok = vi.fn(async () => json([{ id: "a", route_slug: "obhur-coast" }]));
    expect(await sessionRows(ok as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a")).toEqual([{ id: "a", route_slug: "obhur-coast" }]);
    expect(ok).toHaveBeenCalledTimes(1);
    const down = vi.fn(async () => json({ message: "down" }, 503));
    await expect(sessionRows(down as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a")).rejects.toThrow("503");
    expect(down).toHaveBeenCalledTimes(1);
  });

  const BF = "breakfast_name_ar,breakfast_offer_en,breakfast_offer_ar";
  const missingCol = (name: string) => json({ code: "42703", details: null, hint: null, message: `column sessions.${name} does not exist` }, 400);
  const urls = (f: { mock: { calls: unknown[][] } }) => f.mock.calls.map((c) => String(c[0]));

  it("leaves out only the group of columns the database does not have, and only that group for ten minutes", async () => {
    // the breakfast stop's columns are not there yet; the 2026-09-28 ones are
    const f = vi.fn(async (url: string) => (url.includes("breakfast_name_ar") ? missingCol("breakfast_name_ar") : json([{ id: "a" }])));
    expect(await sessionRows(f as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a", "id", 1000, { optional: [BF] })).toEqual([{ id: "a" }]);
    expect(urls(f)).toEqual([
      `https://x.supabase.co/rest/v1/sessions?select=id,description,price,route_slug,${BF}&id=eq.a`,
      "https://x.supabase.co/rest/v1/sessions?select=id,description,price,route_slug&id=eq.a",
    ]);
    // every other read keeps the prices, descriptions and routes (the Experiences page's among them)
    await sessionRows(f as unknown as typeof fetch, "https://x.supabase.co", "anon", "status=eq.open", undefined, 2000);
    expect(urls(f)[2]).toContain("description,price,route_slug&status=eq.open");
    // the breakfast columns are left out straight away for ten minutes, then asked for again
    await sessionRows(f as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a", "id", 3000, { optional: [BF] });
    expect(urls(f)[3]).toBe("https://x.supabase.co/rest/v1/sessions?select=id,description,price,route_slug&id=eq.a");
    await sessionRows(f as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a", "id", 1000 + 11 * 60_000, { optional: [BF] });
    expect(urls(f)[4]).toContain(BF);
  });

  it("leaves out one group after the other when neither is there", async () => {
    const f = vi.fn(async (url: string) => (url.includes("description") ? missingCol("description") : url.includes("breakfast") ? missingCol("breakfast_offer_en") : json([])));
    expect(await sessionRows(f as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a", "id", 1000, { optional: [BF] })).toEqual([]);
    expect(urls(f)).toEqual([
      `https://x.supabase.co/rest/v1/sessions?select=id,description,price,route_slug,${BF}&id=eq.a`,
      `https://x.supabase.co/rest/v1/sessions?select=id,${BF}&id=eq.a`,
      "https://x.supabase.co/rest/v1/sessions?select=id&id=eq.a",
    ]);
  });

  it("never leaves a column out for any other refusal", async () => {
    // a 400 that is not a missing column (a filter PostgREST cannot read) is passed on, and nothing is left out after it
    const bad = vi.fn(async () => json({ code: "PGRST100", message: "failed to parse filter" }, 400));
    await expect(sessionRows(bad as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a", undefined, 1000)).rejects.toThrow("400");
    expect(bad).toHaveBeenCalledTimes(1);
    // a column missing from the columns that have always been asked for is passed on too
    const base = vi.fn(async () => missingCol("hide_queue"));
    await expect(sessionRows(base as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a", "id,hide_queue", 1000)).rejects.toThrow("400");
    expect(base).toHaveBeenCalledTimes(1);
    const ok = vi.fn(async () => json([]));
    await sessionRows(ok as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a", undefined, 2000);
    expect(urls(ok)[0]).toContain("route_slug");
  });

  it("asks once more without the optional columns when the refusal does not say which is missing, keeping nothing out after", async () => {
    const f = vi.fn(async (url: string) => (url.includes("route_slug") ? json({ code: "42703", message: "undefined column" }, 400) : json([{ id: "a" }])));
    expect(await sessionRows(f as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a", "id", 1000)).toEqual([{ id: "a" }]);
    expect(urls(f)).toEqual(["https://x.supabase.co/rest/v1/sessions?select=id,description,price,route_slug&id=eq.a", "https://x.supabase.co/rest/v1/sessions?select=id&id=eq.a"]);
    await sessionRows(f as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=eq.a", "id", 2000);
    expect(urls(f)[2]).toContain("route_slug");
  });

  it("reads for a signed-in account through list_sessions, the columns going the same way", async () => {
    const f = vi.fn(async (url: string) => (url.includes("breakfast_name_ar") ? json({ code: "42703", message: "column list_sessions.breakfast_name_ar does not exist" }, 400) : json([{ id: "p" }])));
    const rows = await sessionRows(f as unknown as typeof fetch, "https://x.supabase.co", "anon", "id=in.(p)", "id", 1000, { optional: [BF], account: { id: "c1", token: "tok" } });
    expect(rows).toEqual([{ id: "p" }]);
    expect(urls(f)).toEqual([
      `https://x.supabase.co/rest/v1/rpc/list_sessions?select=id,description,price,route_slug,${BF}&id=in.(p)`,
      "https://x.supabase.co/rest/v1/rpc/list_sessions?select=id,description,price,route_slug&id=in.(p)",
    ]);
  });
});

describe("readSessions", () => {
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
  const read = (f: unknown, account?: { id: string; token: string } | null) => readSessions(f as typeof fetch, "https://x.supabase.co", "anon", "select=id&id=in.(a,b)", account);

  it("reads a signed-in account's sessions through list_sessions with its id and token (a private ride too)", async () => {
    const f = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => json([{ id: "a" }, { id: "b" }]));
    expect(await read(f, { id: "c1", token: "tok" })).toEqual([{ id: "a" }, { id: "b" }]);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://x.supabase.co/rest/v1/rpc/list_sessions?select=id&id=in.(a,b)");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ p_id: "c1", p_token: "tok" });
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
  });

  it("reads the table with the public key without an account, or on a database without the function", async () => {
    const plain = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => json([{ id: "a" }]));
    await read(plain, null);
    expect(plain.mock.calls.map((c) => [c[0], c[1]?.method])).toEqual([["https://x.supabase.co/rest/v1/sessions?select=id&id=in.(a,b)", undefined]]);
    const old = vi.fn(async (url: string) => (url.includes("/rpc/") ? json({ code: "PGRST202", message: "Could not find the function public.list_sessions(p_id, p_token)" }, 404) : json([{ id: "a" }])));
    expect(await read(old, { id: "c1", token: "tok" })).toEqual([{ id: "a" }]);
    expect(old).toHaveBeenCalledTimes(2);
  });

  it("passes any other failure on, never falling back to a read that cannot see a private ride", async () => {
    const down = vi.fn(async () => json({ message: "down" }, 503));
    await expect(read(down, { id: "c1", token: "tok" })).rejects.toThrow("503");
    expect(down).toHaveBeenCalledTimes(1);
  });
});

describe("sessionName", () => {
  const en = kindNames({ jccName: "Evening Circuit Session", satName: "Saturday Social Ride", swimName: "Triathlon Pool Session", workshopName: "T100 Triathlon Prep", snd96Name: "National Day Ride", eventName: "Event" });
  const ar = kindNames({ jccName: "جلسة الحلبة المسائية", satName: "جولة السبت الاجتماعية", swimName: "جلسة المسبح", workshopName: "T100", snd96Name: "اليوم الوطني" });
  it("names a circuit night by its fixed name and any other session by its title, else its kind", () => {
    expect(sessionName({ kind: "jcc", title: "Special night" }, en, en, false)).toBe("Evening Circuit Session");
    expect(sessionName({ kind: "saturday", title: "Founders ride" }, en, en, false)).toBe("Founders ride");
    expect(sessionName({ kind: "swim", title: null }, en, en, false)).toBe("Triathlon Pool Session");
    expect(sessionName({ kind: "event", title: "Bike maintenance 101" }, en, en, false)).toBe("Bike maintenance 101");
    expect(sessionName({ kind: "event", title: null }, en, en, false)).toBe("Event");
  });
  it("reads a title that is just the kind's English name in Arabic on the Arabic page", () => {
    expect(sessionName({ kind: "saturday", title: "saturday social ride" }, ar, en, true)).toBe("جولة السبت الاجتماعية");
    expect(sessionName({ kind: "saturday", title: "Founders ride" }, ar, en, true)).toBe("Founders ride");
  });
});
