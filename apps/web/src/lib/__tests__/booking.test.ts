import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addonCap, addonCatRank, addonsCost, birthOk, fromPrice, heightToSize, maxRiders, nextStep, prevStep, priceMap, promoDiscount, promoRows, refusalOf,
  regSteps, rentalTotal, riderPrices, sessionAddons, typeOptions, validateRiders, type AddonItem, type BookSession, type Rider,
} from "../booking";
import { accountFrom, asksOf, bookingEntries, checkBooking, liveSession, readInput, waitlistRefused, waiverVersionFor } from "../booking-server";
import { groupKm, waitlistCap, addonIds } from "../rides";
import { POST as book } from "../../app/api/booking/route";
import { POST as promoRoute } from "../../app/api/booking/promo/route";
import { POST as profileRoute } from "../../app/api/booking/profile/route";

// Booking on the website: the booking app's steps, caps, types, prices and checks (lib/booking.ts),
// and the route that books through customer_create_booking with the cookie's id and token.
const base: BookSession = {
  id: "2026-10-06", date: "2026-10-06", kind: "jcc", name: "", full: false, community: false, members: false, free: false, approval: false, seat: null,
  capacity: 40, left: null, wlCap: null, km: { beg: 20, int: 40 }, addons: [], meetUrl: null, location: "JCC", routeSlug: null,
  day: "Tuesday · 6 Oct 2026", near: null, time: "9 PM – 11 PM", collect: null, opens: null, description: null,
};
const sat: BookSession = { ...base, id: "2026-10-04", kind: "saturday", community: true, members: true, free: true, approval: true };
const prices = priceMap([{ type: "Road", price: 75 }, { type: "Road Carbon", price: 250 }, { type: "Mountain", price: 57.5 }, { type: "Hybrid", price: 57.5 }, { type: "Any", price: 57.5 }, { type: "Kids", price: 57.5 }]);
const r = (type: Rider["type"], height = "175", name = ""): Rider => ({ name, height, type });

describe("the steps", () => {
  it("walks Ride, Riders (a bike), the waiver (not the workshop or an event), Review", () => {
    expect(regSteps(base)).toEqual([1, 2, 2.5, 3]);
    expect(regSteps({ kind: "swim" })).toEqual([1, 2.5, 3]);
    expect(regSteps({ kind: "workshop" })).toEqual([1, 3]);
    expect(regSteps({ kind: "event" })).toEqual([1, 3]);
    expect(nextStep({ kind: "workshop" }, 1)).toBe(3);
    expect(prevStep({ kind: "workshop" }, 3)).toBe(1);
    expect(prevStep({ kind: "swim" }, 3)).toBe(2.5);
    expect(nextStep(base, 2)).toBe(2.5);
  });
});

describe("caps and types", () => {
  it("three riders an account on the circuit, drawn from what it holds there; one on a community ride", () => {
    expect(maxRiders(base, 0)).toBe(3);
    expect(maxRiders(base, 2)).toBe(1);
    expect(maxRiders(base, 5)).toBe(1);
    expect(maxRiders(sat, 0)).toBe(1);
  });
  it("offers the app's types: never Any or Gravel, own bike only on community and National Day, no carbon on community", () => {
    expect(typeOptions(base)).toEqual(["Road", "Hybrid", "Mountain", "Kids", "Road Carbon"]);
    expect(typeOptions(sat)).toEqual(["Road", "Hybrid", "Mountain", "Kids", "Own"]);
    expect(typeOptions({ community: false, kind: "snd96" })).toContain("Own");
    expect(typeOptions({ community: false, kind: "snd96" })).toContain("Road Carbon");
    // what staff hid drops out, unless that would leave nothing
    expect(typeOptions(base, ["Road Carbon"])).not.toContain("Road Carbon");
    expect(typeOptions(base, ["Road", "Hybrid", "Mountain", "Kids", "Road Carbon"])).toHaveLength(5);
  });
});

describe("prices", () => {
  it("are the database's ride_prices, the app's figures where a row is missing, and own bikes free", () => {
    expect(priceMap([])).toMatchObject({ Road: 75, Hybrid: 57.5, "Road Carbon": 250, Own: 0 });
    expect(priceMap([{ type: "Road", price: 80 }, { type: "Own", price: 9 }])).toMatchObject({ Road: 80, Own: 0 });
  });
  it("says the from-price on a card as _sessFromPrice", () => {
    expect(fromPrice(base, prices)).toEqual({ kind: "from", n: 57.5 });
    expect(fromPrice(sat, prices)).toEqual({ kind: "free" });
    expect(fromPrice({ ...base, kind: "event", community: true, seat: 40 }, prices)).toEqual({ kind: "seat", n: 40 });
    expect(fromPrice({ ...base, kind: "event", community: true, seat: 0 }, prices)).toEqual({ kind: "free" });
    expect(fromPrice({ ...base, kind: "workshop", community: true }, prices)).toBeNull();
  });
  it("totals the riders, a type not picked yet as a range, the account holder on the house", () => {
    expect(rentalTotal(base, [r("Road"), r("Hybrid")], prices, null)).toEqual([132.5, 132.5]);
    expect(rentalTotal(base, [r("Road"), r("")], prices, null)).toEqual([132.5, 150]);
    expect(rentalTotal(base, [r("Own")], prices, null)).toEqual([0, 0]);
    expect(rentalTotal(sat, [r("Road")], prices, null)).toEqual([0, 0]);
    const house = { name: "Sara Ali", house: "all" as const };
    expect(riderPrices(base, [r("Road"), r("Road")], prices, house).map((l) => l.kind)).toEqual(["house", "sar"]);
    // a friend's name on rider 1 is not the holder: the perk does not land
    expect(riderPrices(base, [r("Road", "175", "Omar")], prices, house)[0].kind).toBe("sar");
    expect(riderPrices(base, [r("Hybrid")], prices, { name: "Sara", house: ["Road"] })[0].kind).toBe("sar");
    expect(rentalTotal({ ...base, seat: 40 }, [r("")], prices, null)).toEqual([40, 40]);
  });
  it("takes a code off as _promoDiscount, and tags only the riders it discounts", () => {
    const pct = { code: "SARA10", kind: "pct", value: 10, appliesTo: null };
    expect(promoDiscount(pct, base, [r("Road"), r("Hybrid")], prices, null)).toBe(13.25);
    expect(promoDiscount({ ...pct, kind: "flat", value: 500 }, base, [r("Road")], prices, null)).toBe(75);
    expect(promoDiscount({ code: "C", kind: "flat", value: 100, appliesTo: "Road Carbon" }, base, [r("Road Carbon"), r("Road")], prices, null)).toBe(100);
    expect(promoDiscount(pct, sat, [r("Road")], prices, null)).toBe(0);
    expect(promoRows(pct, base, [r("Road"), r("Own"), r("Hybrid")], null)).toEqual([true, false, true]);
    expect(promoRows({ appliesTo: "Road" }, base, [r("Road"), r("Hybrid")], null)).toEqual([true, false]);
    expect(promoRows(pct, base, [r("Road")], { name: "Sara", house: "all" })).toEqual([false]);
    expect(promoRows(pct, sat, [r("Road")], null)).toEqual([false]);
  });
});

describe("add-ons", () => {
  const items: AddonItem[] = [
    { id: "h1", name: "Helmet", brand: "", photo: "", price: 30, qty: 0, category: "Helmet", nutrition: false },
    { id: "g1", name: "Gel", brand: "", photo: "", price: 12.5, qty: 4, category: "EnergyGels", nutrition: true },
    { id: "w1", name: "Water", brand: "", photo: "", price: 3, qty: 50, category: "Drinks", nutrition: false },
  ];
  it("caps a pick at the stock, ten when sold out, never past twenty", () => {
    expect(addonCap(items[1])).toBe(4);
    expect(addonCap(items[0])).toBe(10);
    expect(addonCap(items[2])).toBe(20);
    expect(addonsCost([{ id: "g1", qty: 2 }, { id: "w1", qty: 3 }], items)).toBe(34);
  });
  it("groups Equipment, Supplements, Beverages and sells none on a free ride", () => {
    expect(addonCatRank("Helmet", items)).toBe(0);
    expect(addonCatRank("EnergyGels", items)).toBe(1);
    expect(addonCatRank("Drinks", items)).toBe(2);
    expect(sessionAddons({ ...base, addons: ["h1", "g1", "zz"] }, items).map((x) => x.id)).toEqual(["g1", "h1"]);
    expect(sessionAddons({ ...sat, addons: ["g1"] }, items)).toEqual([]);
  });
});

describe("validation", () => {
  it("checks the group, each height, each type, each name in a party, in the app's order", () => {
    expect(validateRiders(base, [r("Road")], null, "Sara")).toBeNull();
    expect(validateRiders(base, [r("Road", "99")], null, "Sara")).toEqual({ i: 0, field: "height" });
    expect(validateRiders(base, [r("Road"), r("", "160", "Omar")], null, "Sara")).toEqual({ i: 1, field: "type" });
    expect(validateRiders(base, [r("Road", "170", "Sara"), r("Road", "160")], null, "Sara")).toEqual({ i: 1, field: "name" });
    expect(validateRiders(sat, [r("Road")], null, "Sara")).toEqual({ i: -1, field: "group" });
    expect(validateRiders(sat, [r("Road")], "beg", "Sara")).toBeNull();
    expect(validateRiders({ ...base, kind: "workshop" }, [r("")], null, "Sara")).toBeNull();
  });
  it("sizes a frame as the owner's chart", () => {
    expect(heightToSize(140, "Road")).toBe("");
    expect(heightToSize(172, "Road")).toBe("S");
    expect(heightToSize(172, "Hybrid")).toBe("M");
    expect(heightToSize(195, "Mountain")).toBe("L");
    expect(heightToSize(195, "Road Carbon")).toBe("XL");
  });
  it("takes a birth date five to a hundred years back", () => {
    expect(birthOk("2000-02-29", "2026-10-03")).toBe(true);
    expect(birthOk("2001-02-29", "2026-10-03")).toBe(false);
    expect(birthOk("2022-01-01", "2026-10-03")).toBe(false);
    expect(birthOk("1900-01-01", "2026-10-03")).toBe(false);
  });
  it("reads a refusal as the app does: the code, the detail, the sentence", () => {
    expect(refusalOf({ message: "STALE_SESSION" })).toBe("signin");
    expect(refusalOf({ code: "P0001", message: "SESSION_CLOSED" })).toBe("closed");
    expect(refusalOf({ message: "FIX_FIRST" })).toBe("fix_first");
    expect(refusalOf({ code: "22023", message: "PICK_TYPE" })).toBe("pick_type");
    expect(refusalOf({ message: "x", details: "MEMBERS_ONLY" })).toBe("members");
    expect(refusalOf({ message: "One place per person on this session." })).toBe("one_per_session");
    expect(refusalOf({ message: "Up to 2 riders per booking on this ride.", details: "GROUP_CAP" })).toBe("group_cap");
    expect(refusalOf({ message: "NOT_OPEN_YET: booking for 2026-10-20 opens on 2026-10-13" })).toBe("not_open");
    expect(refusalOf({ message: "boom" })).toBe("generic");
  });
});

describe("the session's settings", () => {
  it("reads the waitlist cap, the groups' distances and the add-ons", () => {
    expect(waitlistCap('{"_wl":{"m":"count","v":5}}', 40)).toBe(5);
    expect(waitlistCap({ _wl: { m: "pct", v: 10 } }, 40)).toBe(4);
    expect(waitlistCap({ _wl: { m: "pct", v: 1 } }, 12)).toBe(1);
    expect(waitlistCap("{}", 40)).toBeNull();
    expect(groupKm('{"_km":{"beg":18}}')).toEqual({ beg: 18, int: 40 });
    expect(addonIds('["a","b","a","x y"]')).toEqual(["a", "b"]);
  });
});

describe("the server's checks", () => {
  const row = { id: "2026-10-06", session_date: "2026-10-06", day: "Tuesday", status: "open", capacity: 40, bike_slots: '{"_time":"21:00 - 23:00"}' };
  const live = liveSession(row, "2026-10-03")!;
  const acct = { name: "Sara Ali", live: {}, rejected: [] as string[], house: null };
  it("reads the session fresh: past, closed and Petromin nights are not open", () => {
    expect(live).toMatchObject({ kind: "jcc", open: true, capacity: 40, approval: false, free: false });
    expect(liveSession(row, "2026-10-07")!.open).toBe(false);
    expect(liveSession({ ...row, status: "closed" }, "2026-10-03")!.open).toBe(false);
    expect(liveSession({ ...row, event_kind: "community", ride_kind: "petromin" }, "2026-10-03")!.open).toBe(false);
    expect(liveSession({ ...row, event_kind: "community", ride_kind: "saturday", spots: 25 }, "2026-10-03")).toMatchObject({ approval: true, members: true, free: true, capacity: 25 });
    expect(liveSession({ ...row, event_kind: "community", ride_kind: "event", paid_ride: true, price: "40", open_to_all: true }, "2026-10-03")).toMatchObject({ seat: 40, members: false });
  });
  it("cleans the body: names, types, add-ons and the code; never a price", () => {
    expect(readInput({ sessionId: "a;b", riders: [r("Road")] })).toBeNull();
    expect(readInput({ sessionId: "s1", riders: [{ name: "x", height: "170", type: "Gravel" }] })).toBeNull();
    expect(readInput({ sessionId: "s1", riders: [{ name: "Al-Amin", height: 170, type: "Road", price: 0 }], addons: [{ id: "a", qty: 2 }, { id: "a", qty: 1 }, { id: "b", qty: 99 }], promo: { code: "X 1" }, waiver: true }))
      .toEqual({ sessionId: "s1", riders: [{ name: "Al Amin", height: "170", type: "Road" }], group: null, addons: [{ id: "a", qty: 2 }], promo: null, waiver: true });
  });
  it("refuses what the app refuses: a closed ride, one turned down, one already held, a party past the cap, no type, no waiver", () => {
    const input = (riders: Rider[], waiver = true) => ({ sessionId: live.id, riders, group: null, addons: [], promo: null, waiver });
    expect(checkBooking(input([r("Road")]), live, acct)).toEqual({ ok: true, riders: [r("Road")] });
    expect(checkBooking(input([r("Road")]), { ...live, open: false }, acct)).toEqual({ ok: false, error: "closed" });
    expect(checkBooking(input([r("Road")]), live, { ...acct, rejected: [live.id] })).toEqual({ ok: false, error: "rejected" });
    expect(checkBooking(input([r("Road")]), live, { ...acct, live: { [live.id]: 1 } })).toEqual({ ok: false, error: "already" });
    expect(checkBooking(input([r("Road", "170", "A"), r("Road", "170", "B"), r("Road", "170", "C"), r("Road", "170", "D")]), live, acct)).toEqual({ ok: false, error: "cap" });
    expect(checkBooking(input([r("")]), live, acct)).toEqual({ ok: false, error: "pick_type" });
    expect(checkBooking(input([r("Own")]), live, acct)).toEqual({ ok: false, error: "pick_type" });
    expect(checkBooking(input([r("Road")], false), live, acct)).toEqual({ ok: false, error: "waiver" });
    const satLive = liveSession({ ...row, event_kind: "community", ride_kind: "saturday" }, "2026-10-03")!;
    // a community ride is one rider; carbon there becomes Road; the group is required
    expect(checkBooking({ ...input([r("Road Carbon"), r("Road")]), group: "int" }, satLive, acct)).toEqual({ ok: true, riders: [r("Road")] });
    expect(checkBooking(input([r("Road")]), satLive, acct)).toEqual({ ok: false, error: "invalid" });
  });
  it("builds the rows customer_create_booking takes, with no price and the code only where it discounts", () => {
    const input = { sessionId: live.id, riders: [r("Road", "180"), r("Own", "120", "Kid")], group: null, addons: [], promo: { code: "SARA10", appliesTo: null }, waiver: true };
    const rows = bookingEntries(input, input.riders, live, acct, waiverVersionFor(live));
    expect(rows[0]).toMatchObject({ name: "Sara Ali", size: "L", height: 180, type_preference: "Road", status: "waiting", promo_code: "SARA10", waiver_version: "2026-10-v2", session_day: "Tuesday" });
    expect(rows[1]).toMatchObject({ name: "Kid", size: "", type_preference: "Own", promo_code: null });
    expect(rows[0]).not.toHaveProperty("price");
    expect(rows[0]).not.toHaveProperty("approval");
    const ws = liveSession({ ...row, event_kind: "community", ride_kind: "workshop", open_to_all: true }, "2026-10-03")!;
    expect(bookingEntries({ ...input, promo: null }, [r("")], ws, acct, waiverVersionFor(ws))[0]).toMatchObject({ type_preference: "None", height: null, approval: "pending" });
    expect(waiverVersionFor({ kind: "swim" })).toBe("swim-2026-10-v2");
  });
  it("refuses a capped waitlist that is full, and only then", () => {
    const s = { full: false, approval: false, capacity: 10, wlCap: 2 };
    expect(waitlistRefused(s, 1, 1, 9, 2)).toBe(false); // a place left
    expect(waitlistRefused(s, 2, 2, 9, 1)).toBe(true); // two need a bike, one place, one waitlist spot
    expect(waitlistRefused({ ...s, full: true }, 1, 1, 0, 1)).toBe(false);
    expect(waitlistRefused({ ...s, wlCap: null }, 1, 1, 10, 50)).toBe(false);
  });
  it("reads the account: live rows, a ride turned down, the house, the profile page", () => {
    const rows = [
      { session_id: "a", status: "waiting" }, { session_id: "a", status: "waitlist" }, { session_id: "b", status: "cancelled", approval: "rejected" },
      ...Array.from({ length: 7 }, (_, i) => ({ session_id: `d${i}`, status: "done" })),
    ];
    const a = accountFrom("Sara", { height: 172, hidden_types: "Road Carbon, Kids", default_pay: "house:Road,Hybrid" }, rows, true, null);
    expect(a).toMatchObject({ height: 172, hidden: ["Road Carbon", "Kids"], house: ["Road", "Hybrid"], member: true, rejected: ["b"], live: { a: 2 }, asks: [], profileGate: "profile" });
    expect(accountFrom("Sara", { birth_date: "1990-01-01", nationality: "Saudi Arabia", default_pay: "house" }, rows, false, []).profileGate).toBe("none");
    expect(asksOf(["birth_date", "nationality"], {})).toEqual({ asks: [], communityOnly: true });
    expect(asksOf(["email", "birth_date"], {})).toEqual({ asks: ["email", "birth_date"], communityOnly: false });
    expect(accountFrom("Sara", {}, [], false, ["nationality"]).profileGate).toBe("community");
  });
});

// ── The routes ─────────────────────────────────────────────────────────────────────────────
const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const post = (fn: (r: Request) => Promise<Response>, path: string, body: unknown, headers: Record<string, string> = HEADERS) =>
  fn(new Request(`https://micromobility.sa${path}`, { method: "POST", headers, body: JSON.stringify(body) }));
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const future = (() => { const d = new Date(Date.now() + 5 * 864e5); return d.toISOString().slice(0, 10); })();
const SESSION = { id: future, session_date: future, day: "Tuesday", status: "open", capacity: 40, bike_slots: '{"_time":"21:00 - 23:00"}', event_kind: null, ride_kind: null, needs_approval: false, addons: '["g1"]' };

type Call = { fn: string; body: Record<string, unknown> };
function db(over: Record<string, (body: Record<string, unknown>) => Response> = {}, session: Record<string, unknown> = SESSION) {
  const calls: Call[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/rest/v1/sessions")) return json([session]);
    if (u.includes("/rest/v1/queue_public")) return new Response(null, { status: 200, headers: { "content-range": "0-0/3" } });
    if (u.includes("booking-confirm")) return json({ ok: false });
    const fn = /\/rpc\/([a-z_]+)/.exec(u)?.[1] ?? "";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    calls.push({ fn, body });
    if (over[fn]) return over[fn](body);
    if (fn === "customer_profile") return json([{ id: "c1", name: "Sara Ali", height: null }]);
    if (fn === "my_bookings") return json(calls.some((c) => c.fn === "customer_create_booking")
      ? [{ id: "q1", session_id: future, session_date: future, status: "waiting", queue_num: 7, price: 75, paid: false, name: "Sara Ali", type_preference: "Road" }] : []);
    if (fn === "customer_create_booking") return json([{ id: "q1", queue_num: 7, status: "waiting", waitlist_num: null, price: 75 }]);
    if (fn === "community_member") return json(true);
    return json(true);
  });
  vi.stubGlobal("fetch", f);
  return calls;
}

describe("api/booking", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const body = { sessionId: future, riders: [{ name: "", height: "180", type: "Road" }], group: null, addons: [{ id: "g1", qty: 2 }], promo: null, waiver: true };

  it("only takes this site's pages, signed in", async () => {
    db();
    expect((await post(book, "/api/booking", body, { ...HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect((await post(book, "/api/booking", body, { origin: HEADERS.origin, "content-type": "application/json" })).status).toBe(401);
    expect((await post(book, "/api/booking", { sessionId: "x;y" })).status).toBe(400);
  });
  it("books through customer_create_booking with the cookie's id and token, then the add-ons, the height and the tickets", async () => {
    const calls = db();
    const res = await post(book, "/api/booking", { ...body, p_id: "someone-else" });
    const b = await res.json();
    expect(res.status).toBe(200);
    expect(b.ok).toBe(true);
    expect(b.tickets).toHaveLength(1);
    expect(b.tickets[0]).toMatchObject({ id: "q1", queueNum: 7, status: "waiting" });
    const made = calls.find((c) => c.fn === "customer_create_booking")!;
    expect(made.body).toMatchObject({ p_id: "c1", p_token: TOKEN });
    const entries = made.body.p_entries as Record<string, unknown>[];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: "Sara Ali", type_preference: "Road", size: "L", height: 180, waiver_version: "2026-10-v2" });
    expect(entries[0]).not.toHaveProperty("price");
    expect(calls.find((c) => c.fn === "customer_booking_update")!.body).toMatchObject({ p_entry_id: "q1", p_patch: { addons: '[{"id":"g1","qty":2}]' } });
    expect(calls.find((c) => c.fn === "customer_addon_stock")!.body).toMatchObject({ p_items: [{ id: "g1", delta: -2 }] });
    expect(calls.find((c) => c.fn === "customer_set_height")!.body).toMatchObject({ p_height: 180 });
  });
  it("says each refusal in the app's terms", async () => {
    db({ customer_create_booking: () => json({ code: "P0001", message: "This ride is for community members only.", details: "MEMBERS_ONLY" }, 400) });
    expect(await (await post(book, "/api/booking", body)).json()).toEqual({ ok: false, error: "members" });
    db({ customer_create_booking: () => json({ code: "P0001", message: "FIX_FIRST" }, 400) });
    expect((await (await post(book, "/api/booking", body)).json()).error).toBe("fix_first");
    db({ customer_create_booking: () => json({ code: "P0001", message: "STALE_SESSION" }, 400) });
    const stale = await post(book, "/api/booking", body);
    expect(stale.status).toBe(401);
    db({ customer_profile: () => json([]) });
    expect((await (await post(book, "/api/booking", body)).json()).error).toBe("signin");
    db({ my_bookings: () => json([{ id: "q0", session_id: future, status: "waiting" }]) });
    expect((await (await post(book, "/api/booking", body)).json()).error).toBe("already");
    db({}, { ...SESSION, status: "closed" });
    expect((await (await post(book, "/api/booking", body)).json()).error).toBe("closed");
    db({}, { ...SESSION, event_kind: "community", ride_kind: "saturday", needs_approval: true });
    db({ community_member: () => json(false) }, { ...SESSION, event_kind: "community", ride_kind: "saturday", needs_approval: true });
    expect((await (await post(book, "/api/booking", { ...body, group: "beg" })).json()).error).toBe("members");
    db({}, { ...SESSION, status: "full", bike_slots: '{"_time":"21:00 - 23:00","_wl":{"m":"count","v":3}}' });
    expect((await (await post(book, "/api/booking", body)).json()).error).toBe("waitlist_full");
  });
  it("puts no add-ons on a free ride and takes no stock for a waitlisted booking", async () => {
    let calls = db({}, { ...SESSION, event_kind: "community", ride_kind: "saturday", needs_approval: true, open_to_all: true });
    await post(book, "/api/booking", { ...body, group: "beg" });
    expect(calls.some((c) => c.fn === "customer_booking_update")).toBe(false);
    calls = db({ customer_create_booking: () => json([{ id: "q1", queue_num: 7, status: "waitlist", waitlist_num: 2, price: 75 }]) });
    await post(book, "/api/booking", body);
    expect(calls.some((c) => c.fn === "customer_booking_update")).toBe(true);
    expect(calls.some((c) => c.fn === "customer_addon_stock")).toBe(false);
  });
});

describe("api/booking/promo and /profile", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("looks a personal code up with the cookie's id and token", async () => {
    const calls = db({ promo_lookup: () => json({ ok: true, code: "MINE", kind: "flat", value: 20, applies_to: null }) });
    const b = await (await post(promoRoute, "/api/booking/promo", { code: "mine" })).json();
    expect(b).toEqual({ ok: true, code: "MINE", kind: "flat", value: 20, applies_to: null });
    expect(calls[0].body).toEqual({ p_code: "mine", p_id: "c1", p_token: TOKEN });
    db({ promo_lookup: () => json({ ok: false, reason: "expired" }) });
    expect(await (await post(promoRoute, "/api/booking/promo", { code: "old" })).json()).toEqual({ ok: false, reason: "expired" });
  });
  it("saves the two details through customer_set_birth_nat, a community member's through customer_fix_save", async () => {
    let calls = db();
    expect((await post(profileRoute, "/api/booking/profile", { birth: "1990-05-01", nationality: "Saudi Arabia" })).status).toBe(200);
    expect(calls[0]).toEqual({ fn: "customer_set_birth_nat", body: { p_id: "c1", p_token: TOKEN, p_birth_date: "1990-05-01", p_nationality: "Saudi Arabia" } });
    calls = db({ customer_fix_save: () => json([]) });
    expect((await post(profileRoute, "/api/booking/profile", { birth: "1990-05-01", nationality: "Egypt", community: true })).status).toBe(200);
    expect(calls[0].fn).toBe("customer_fix_save");
    expect((await post(profileRoute, "/api/booking/profile", { birth: "2024-05-01", nationality: "Egypt" })).status).toBe(400);
  });
});

describe("the waiver wording (the booking app's 2026-10-v2)", () => {
  it("keeps every clause in English and Arabic, for the ride and the swim", async () => {
    const { T } = await import("../../components/experiences/Booking.text");
    expect(waiverVersionFor(base)).toBe("2026-10-v2");
    for (const kind of ["bike", "swim"] as const) {
      const en = T.en.waiver[kind].body;
      for (const clause of [
        "You cannot book any", "until you have read and agreed to this waiver", "entirely at my own risk", "I alone am responsible for myself, my safety",
        "personal belongings", "To the fullest extent permitted by law", "MicroMobility, its staff and its partners are not responsible",
        "including any injury, fracture, illness, loss, theft or damage", "however it is caused", "during the activity or in connection with it",
      ]) expect(en).toContain(clause);
      const ar = T.ar.waiver[kind].body;
      for (const clause of [
        "لا يمكنك حجز أي", "إلا بعد قراءة هذا الإقرار والموافقة عليه", "على مسؤوليتي الشخصية بالكامل", "وأتحمل وحدي المسؤولية عن نفسي وسلامتي",
        "ممتلكاتي الشخصية", "وإلى أقصى حد يسمح به النظام", "لا تتحمل مايكروموبيليتي ولا موظفوها ولا شركاؤها أي مسؤولية",
        "أي إصابة أو كسر أو مرض أو فقدان أو سرقة أو تلف", "أيًّا كان سببه", "أثناء النشاط أو بسببه",
      ]) expect(ar).toContain(clause);
    }
    expect(T.en.waiver.bike.body).toContain("I agree to wear a helmet");
    expect(T.en.waiver.bike.body).toContain("any damage to the rented bike caused by misuse");
    expect(T.ar.waiver.bike.body).toContain("وأتعهد بارتداء الخوذة");
    expect(T.en.waiver.swim.body).toContain("I can swim unaided");
    expect(T.en.waiver.swim.body).toContain("any medical condition that affects my ability to swim");
    expect(T.en.waiver.swim.body).toContain("stay within the supervised area");
    expect(T.ar.waiver.swim.body).toContain("قدرتي على السباحة دون مساعدة");
    expect(T.ar.waiver.swim.body).toContain("ضمن المنطقة الخاضعة للإشراف");
  });
});
