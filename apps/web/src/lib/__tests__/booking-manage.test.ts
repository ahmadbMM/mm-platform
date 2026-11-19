import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addonStep, cancelBody, cancelPatch, cancelReasons, checkEdit, cleanRiderName, editBody, editPlan, holderOf, liveRows, lkBoard, lkDoors, lkOffer, lkRefusal,
  lkRentals, lkTaken, lockerBody, manageRow, moveRefusal, paidLock, paidOver, rawAddons, riderNameOk, rsTarget, sessionEnded, sizeFor, stockBack, titleCase,
  type EditType, type ManageRow,
} from "../booking-manage";
import { POST as cancelPOST } from "../../app/api/booking/cancel/route";
import { POST as updatePOST } from "../../app/api/booking/update/route";
import { POST as addonsPOST } from "../../app/api/booking/addons/route";
import { POST as lockerPOST } from "../../app/api/booking/locker/route";
import { POST as movePOST } from "../../app/api/booking/move/route";
import { POST as managePOST } from "../../app/api/booking/manage/route";
import { MANAGE_WORDS } from "@/components/booking/Manage.words";
import { LOCALE_CODES } from "@/i18n/locales";
import { riyadhClock } from "../workshop-days";

// Changing a booking on the website (lib/booking-manage.ts, lib/booking-manage-server.ts, app/api/booking/*): the booking
// app's rules for Cancel, Edit, the add-ons, Reschedule and the lockers, and the routes that call its functions with the
// account cookie's id and token. Every database answer here is a stub.

type Row = Record<string, unknown>;
const row = (o: Row = {}): Row => ({ id: "e1", session_id: "s1", session_date: "2099-03-01", status: "waiting", queue_num: 4, name: "Sara Khalid", type_preference: "Hybrid", height: 168, size: "S", price: 75, paid: false, ...o });
const live = (o: Row = {}) => manageRow(row(o)) as ManageRow;

describe("a booking's live rows", () => {
  it("reads my_bookings' rows, the add-on lines as stored, and keeps only the waiting and the waitlisted", () => {
    expect(rawAddons('[{"id":"gel","qty":2,"p":12},"water",{"id":"bar","qty":0}]')).toEqual([{ id: "gel", qty: 2, p: 12 }, { id: "water", qty: 1 }, { id: "bar", qty: 1 }]);
    expect(rawAddons("not json")).toEqual([]);
    expect(manageRow(row({ status: "active" }))).toBeNull();
    expect(manageRow(row({ status: "cancelled" }))).toBeNull();
    expect(live({ promo_code: "SARA10", wallet_paid: "20", pay_method: "wallet" })).toMatchObject({ promo: "SARA10", walletPaid: 20, payMethod: "wallet", size: "S" });
  });
  it("orders them by queue number, then id, one order for the form and its save (_modEntries)", () => {
    const rows = [row({ id: "b", queue_num: 7 }), row({ id: "a", queue_num: 7 }), row({ id: "c", queue_num: 3 }), row({ id: "x", session_id: "s2" }), row({ id: "d", status: "done" })];
    expect(liveRows(rows, "s1").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
  it("says when a session is over, as _sessEnded does", () => {
    expect(sessionEnded("2026-11-18", ["20:00", "22:00"], "2026-11-19T10:00")).toBe(true);
    expect(sessionEnded("2026-11-19", ["20:00", "22:00"], "2026-11-19T21:59")).toBe(false);
    expect(sessionEnded("2026-11-19", ["20:00", "22:00"], "2026-11-19T22:00")).toBe(true);
    // an end before its start is the next day: the night is still on after midnight
    expect(sessionEnded("2026-11-18", ["21:00", "00:30"], "2026-11-19T00:10")).toBe(false);
    expect(sessionEnded("2026-11-18", ["21:00", "00:30"], "2026-11-19T00:30")).toBe(true);
    expect(sessionEnded("2026-11-20", null, "2026-11-19T23:00")).toBe(false);
    expect(sessionEnded("2026-11-19", null, "2026-11-19T11:00")).toBe(true); // 9-11 when it has no window
  });
});

describe("Cancel", () => {
  it("lists the reasons as Settings keeps them: the built-in ones less the hidden, the admins' own, Other last", () => {
    expect(cancelReasons().map((r) => r.code)).toEqual(["plans", "work", "unwell", "weather", "wrong_date", "transport", "group", "price", "other"]);
    const r = cancelReasons(["price", "other", "work"], [["c_holiday", " On holiday "], ["c_bad1", "x"], ["c_x", "  "]]);
    expect(r.map((x) => x.code)).toEqual(["plans", "unwell", "weather", "wrong_date", "transport", "group", "c_holiday", "other"]);
    expect(r.find((x) => x.code === "c_holiday")?.label).toBe("On holiday");
  });
  it("reads its body: a reason's code, and Other only with its words", () => {
    expect(cancelBody({ booking: "e1", reason: "plans", note: "ignored" })).toEqual({ booking: "e1", reason: "plans", note: null });
    expect(cancelBody({ booking: "e1", reason: "other", note: "  My   flight  " })).toEqual({ booking: "e1", reason: "other", note: "My flight" });
    expect(cancelBody({ booking: "e1", reason: "other", note: "   " })).toBeNull();
    expect(cancelBody({ booking: "e 1", reason: "plans" })).toBeNull();
    expect(cancelBody({ booking: "e1", reason: "Plans!" })).toBeNull();
    expect(cancelBody({ booking: "e1", reason: "other", note: "x".repeat(400) })?.note).toHaveLength(300);
  });
  it("writes the reason on the cancel itself, frees the bike, and gives back the add-ons of the rows that held a place", () => {
    expect(cancelPatch("other", "Flight")).toEqual({ status: "cancelled", assigned_bike_id: null, cancel_reason: "other", cancel_note: "Flight" });
    expect(cancelPatch("plans", null)).toEqual({ status: "cancelled", assigned_bike_id: null, cancel_reason: "plans" });
    const rows = [live({ addons: '[{"id":"gel","qty":2},{"id":"locker","qty":1,"p":10}]' }), live({ id: "e2", status: "waitlist", addons: '[{"id":"gel","qty":1}]' }), live({ id: "e3", addons: '[{"id":"gel","qty":1},{"id":"bar","qty":1}]' })];
    expect(stockBack(rows)).toEqual([{ id: "gel", delta: 3 }, { id: "bar", delta: 1 }]);
  });
  it("refuses a paid ride that is over, never an unpaid one", () => {
    expect(paidOver([live({ paid: true })], true)).toBe(true);
    expect(paidOver([live({ wallet_paid: 20 })], true)).toBe(true);
    expect(paidOver([live({ paid: true })], false)).toBe(false);
    expect(paidOver([live()], true)).toBe(false);
  });
});

describe("Edit", () => {
  const types: EditType[] = ["Road", "Hybrid", "Mountain", "Kids", "Road Carbon"].map((t) => ({ type: t, price: t === "Road" ? 75 : t === "Road Carbon" ? 250 : 57.5, closed: t === "Mountain" }));
  const fare = (t: string) => types.find((x) => x.type === t)?.price ?? null;
  const two = [live({ type_preference: "Hybrid" }), live({ id: "e2", name: "Omar Khalid", type_preference: "Mountain", height: 180, size: "L" })];
  const base = { existing: two, bike: true, cap: 3, types, fare, waiver: false };
  it("checks heights, types (no Any, a closed one only for the rider who holds it, Kids to 144 cm), added names, the cap and the waiver", () => {
    const ok = [{ name: "", height: "168", type: "Hybrid" }, { name: "", height: "180", type: "Mountain" }];
    expect(checkEdit({ ...base, riders: ok })).toBeNull();
    expect(checkEdit({ ...base, riders: [ok[0], { ...ok[1], height: "99" }] })).toEqual({ i: 1, field: "height" });
    expect(checkEdit({ ...base, riders: [{ ...ok[0], height: "١٧٠" }, ok[1]] })).toBeNull(); // Arabic-Indic digits
    expect(checkEdit({ ...base, riders: [{ ...ok[0], type: "Any" }, ok[1]] })).toEqual({ i: 0, field: "type" });
    expect(checkEdit({ ...base, riders: [{ ...ok[0], type: "Mountain" }, ok[1]] })).toEqual({ i: 0, field: "closed" });
    expect(checkEdit({ ...base, riders: [{ ...ok[0], type: "Kids" }, ok[1]] })).toEqual({ i: 0, field: "kids" });
    expect(checkEdit({ ...base, riders: [...ok, { name: "Lina", height: "140", type: "Kids" }], waiver: true })).toEqual({ i: 2, field: "name" });
    expect(checkEdit({ ...base, riders: [...ok, { name: "Lina Khalid", height: "140", type: "Kids" }] })).toEqual({ i: -1, field: "waiver" });
    expect(checkEdit({ ...base, riders: [...ok, { name: "Lina Khalid", height: "140", type: "Kids" }], waiver: true })).toBeNull();
    expect(checkEdit({ ...base, riders: [...ok, ok[0], ok[0]], waiver: true })).toEqual({ i: -1, field: "cap" });
  });
  it("refuses a paid row onto a dearer bike (errPaidTypeDesk), not one on the house nor a cheaper one", () => {
    const paid = [live({ paid: true, type_preference: "Hybrid", price: 57.5 })];
    const r = (type: string) => [{ name: "", height: "168", type }];
    expect(checkEdit({ ...base, existing: paid, riders: r("Road") })).toEqual({ i: 0, field: "paid" });
    expect(checkEdit({ ...base, existing: [live({ paid: true, type_preference: "Road", price: 75 })], riders: r("Hybrid") })).toBeNull();
    expect(checkEdit({ ...base, existing: [live({ paid: true, price: 0 })], riders: r("Road Carbon") })).toBeNull();
  });
  it("writes only what changed, cancels the riders past the new count and books the riders added", () => {
    const p = editPlan(two, [{ name: "", height: "175", type: "Hybrid" }, { name: "", height: "180", type: "Road" }, { name: "lina-al  khalid", height: "١٤٠", type: "Kids" }], true);
    expect(p.patches).toEqual([
      { id: "e1", patch: { height: 175, size: "M" }, ownSwitch: false, paidSwitch: false, typeSwitch: false },
      // 180 cm is an L on a Road bike as on the Mountain bike it had: only the type changes
      { id: "e2", patch: { type_preference: "Road" }, ownSwitch: false, paidSwitch: false, typeSwitch: true },
    ]);
    expect(p.added).toEqual([{ name: "Lina Al Khalid", height: "140", type: "Kids" }]);
    expect(p.removed).toEqual([]);
    expect(editPlan(two, [{ name: "", height: "168", type: "Hybrid" }], true).removed.map((r) => r.id)).toEqual(["e2"]);
    expect(editPlan(two, [{ name: "", height: "168", type: "Hybrid" }, { name: "", height: "180", type: "Mountain" }], true).patches).toEqual([]);
  });
  it("cleans names as the database takes them, and reads the body", () => {
    expect(cleanRiderName("  mary-jane_o'neil 3 ")).toBe("mary jane oneil");
    expect(titleCase("لينا khalid")).toBe("لينا Khalid");
    expect(riderNameOk("Ali K")).toBe(false);
    expect(riderNameOk("Md. Rahman")).toBe(true);
    expect(sizeFor(140, "Kids")).toBe("");
    expect(editBody({ session: "s1", key: ["e1"], riders: [{ name: "x", height: "170", type: "Road" }], waiver: true })).toEqual({ session: "s1", key: ["e1"], riders: [{ name: "x", height: "170", type: "Road" }], waiver: true });
    expect(editBody({ session: "s1", key: [], riders: [{}] })).toBeNull();
    expect(editBody({ session: "s1", key: ["e 1"], riders: [{}] })).toBeNull();
    expect(holderOf([live({ id: "a", name: "Omar" }), live({ id: "b", name: " sara khalid" })], "Sara Khalid")).toBe("b");
  });
});

describe("add-ons", () => {
  const item = { price: 12, qty: 5 };
  const r = live();
  it("adds a unit on a line at today's price, never on an older one, and takes one off the last line", () => {
    expect(addonStep([{ id: "gel", qty: 1, p: 12 }], "gel", 1, { item, sold: true, row: r, active: false })).toEqual({ lines: [{ id: "gel", qty: 2, p: 12 }] });
    expect(addonStep([{ id: "gel", qty: 1, p: 10 }], "gel", 1, { item, sold: true, row: r, active: false })).toEqual({ lines: [{ id: "gel", qty: 1, p: 10 }, { id: "gel", qty: 1 }] });
    expect(addonStep([{ id: "gel", qty: 1, p: 10 }, { id: "gel", qty: 1 }], "gel", -1, { item, sold: true, row: r, active: false })).toEqual({ lines: [{ id: "gel", qty: 1, p: 10 }] });
  });
  it("refuses what the app refuses", () => {
    const o = { item, sold: true, row: r, active: false };
    expect(addonStep([], "gel", 1, { ...o, item: { price: 12, qty: 0 } })).toEqual({ error: "out" });
    expect(addonStep([], "gel", 1, { ...o, sold: false })).toEqual({ error: "off" });
    expect(addonStep([], "gel", 1, { ...o, row: live({ paid: true, pay_method: "desk" }) })).toEqual({ error: "paid" });
    expect(addonStep([], "gel", 1, { ...o, row: live({ paid: true, pay_method: "wallet" }) })).toHaveProperty("lines");
    expect(addonStep([{ id: "gel", qty: 20 }], "gel", 1, o)).toEqual({ error: "max" });
    expect(addonStep([{ id: "gel", qty: 1 }], "gel", -1, { ...o, active: true })).toEqual({ error: "handed" });
    expect(addonStep([], "gel", -1, o)).toEqual({ error: "none" });
    expect(paidLock(live({ paid: true, price: 0 }))).toBe(false); // on the house
  });
});

describe("Reschedule", () => {
  const ok = { ended: false, notOpen: false, mfHeld: false, genderOk: true, community: false };
  it("offers only another open circuit night nobody approves, open to this rider", () => {
    const s = { id: "s2", kind: "jcc", full: false, date: "2099-03-02" };
    expect(rsTarget(s, "s1", ok)).toBe(true);
    expect(rsTarget(s, "s2", ok)).toBe(false);
    expect(rsTarget({ ...s, full: true }, "s1", ok)).toBe(false);
    expect(rsTarget({ ...s, kind: "saturday" }, "s1", ok)).toBe(false);
    for (const k of ["ended", "notOpen", "mfHeld", "community"] as const) expect(rsTarget(s, "s1", { ...ok, [k]: true })).toBe(false);
    expect(rsTarget(s, "s1", { ...ok, genderOk: false })).toBe(false);
  });
  it("words the server's refusals as _rsRefused does", () => {
    expect(moveRefusal({ message: "PAID_MOVE" })).toBe("paid_move");
    expect(moveRefusal({ message: "NOT_OPEN_YET: booking for 2099-03-02 opens on 2099-02-25" })).toBe("not_open");
    expect(moveRefusal({ message: "MEMBERS_FIRST", details: "2099-03-01T15:00:00Z" })).toBe("members_first");
    expect(moveRefusal({ code: "P0001", message: "x", details: "MEMBERS_ONLY" })).toBe("members");
    expect(moveRefusal({ message: "TYPE_CLOSED" })).toBe("type_closed");
    expect(moveRefusal({ message: "TYPE_FULL" })).toBe("type_full");
    expect(moveRefusal(null)).toBe("generic");
  });
});

describe("lockers", () => {
  const board = lkBoard({ kind: "jcc", units: [1, 2, 3, 5, 7].map((n) => ({ code: String(n), out: n === 5 })), taken: { e: ["2"], l: ["2", "7"] } })!;
  it("reads the offer and the cabinet, the gaps where a number is missing, and what is taken for a time", () => {
    expect(lkOffer({ kind: "" })).toBeNull();
    expect(lkOffer({ kind: "jcc", one: 10, both: 15, left: { early: 3 }, ended: { late: true } })).toMatchObject({ kind: "jcc", one: 10, both: 15, left: { early: 3, late: 0 }, ended: { late: true, early: false } });
    expect(lkDoors(board).map((d) => d?.code ?? null)).toEqual(["1", "2", "3", null, "5", null, "7"]);
    expect([...lkTaken(board, "early")]).toEqual(["2"]);
    expect([...lkTaken(board, "both")].sort()).toEqual(["2", "7"]);
    // a change keeps the rental's own door free for it
    expect([...lkTaken(board, "late", { period: "late", code: "7" })]).toEqual(["2"]);
    expect(lkBoard({ kind: "" })).toBeNull();
  });
  it("says the server's refusals (_lkRiderSay), reads the rentals and the route's bodies", () => {
    expect(lkRefusal({ message: "LOCKERS_FULL" })).toBe("full");
    expect(lkRefusal({ message: "LOCKER_TAKEN: 7" })).toBe("taken");
    expect(lkRefusal({ message: "LOCKER_OUT: 5" })).toBe("taken");
    expect(lkRefusal({ message: "LOCKER_NOT_OPEN" })).toBe("not_open");
    expect(lkRentals([{ id: "r1", booking_id: "e1", day: "2099-03-01", period: "late", code: "7", status: "reserved", price: 10, bill_paid: true }, { id: "r2", period: "late", status: "cancelled" }]))
      .toEqual([{ id: "r1", bookingId: "e1", day: "2099-03-01", period: "late", code: "7", status: "reserved", price: 10, billPaid: true }]);
    expect(lockerBody({ action: "reserve", ids: ["e1", "e2"], period: "early", codes: ["1", "3"] })).toEqual({ action: "reserve", ids: ["e1", "e2"], period: "early", codes: ["1", "3"] });
    expect(lockerBody({ action: "reserve", ids: ["e1"], period: "early", codes: ["1", "3"] })).toBeNull(); // a door per row
    expect(lockerBody({ action: "reserve", ids: ["e1"], period: "noon" })).toBeNull();
    expect(lockerBody({ action: "change", rental: "0b0e8c1e-5a7d-4f6e-9b1a-1c2d3e4f5a60", period: "both", code: "5" })).toMatchObject({ action: "change", code: "5" });
    expect(lockerBody({ action: "change", rental: "r1", period: "both", code: "5" })).toBeNull();
    expect(lockerBody({ action: "board", session: "s1", day: "2099-03-01" })).toEqual({ action: "board", session: "s1", day: "2099-03-01" });
  });
});

describe("the words", () => {
  it("has every text in every language the site speaks, the placeholders kept, no tick or emoji", () => {
    const en = MANAGE_WORDS.en;
    for (const l of LOCALE_CODES) {
      const w = MANAGE_WORDS[l as keyof typeof MANAGE_WORDS];
      expect(Object.keys(w).sort(), l).toEqual(Object.keys(en).sort());
      for (const [k, v] of Object.entries(w)) {
        expect(v.trim(), `${l}.${k}`).not.toBe("");
        expect((v.match(/\{\d\}/g) ?? []).sort(), `${l}.${k}`).toEqual((en[k as keyof typeof en].match(/\{\d\}/g) ?? []).sort());
        expect(v, `${l}.${k}`).not.toMatch(/[☀-➿\u{1F000}-\u{1FFFF}]/u);
      }
    }
    expect(MANAGE_WORDS.ar.crTitle).toBe("ما سبب الإلغاء؟");
  });
});

// ── The routes ──────────────────────────────────────────────────────────────────────────────────────

const TOKEN = "a1b2c3d4e5f6a7b8c9d0";
const HEADERS = { origin: "https://micromobility.sa", cookie: `mm_acct=c1~${TOKEN}`, "content-type": "application/json" };
const req = (path: string, body: unknown, headers: Record<string, string> = HEADERS) =>
  new Request(`https://micromobility.sa/api/booking/${path}`, { method: "POST", headers, body: JSON.stringify(body) });
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const day = (n: number) => { const d = new Date(`${riyadhClock(new Date()).slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
type Call = { fn: string; body: Record<string, unknown> };
/** A database stub: each function's answer by name (a value, or a Response), the inventory, the rest empty. */
function db(answers: Record<string, unknown | ((b: Record<string, unknown>) => unknown)>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const m = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(url);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (m) {
      calls.push({ fn: m[1], body });
      if (!(m[1] in answers)) return json({ code: "PGRST202", message: "none" }, 404);
      const a = answers[m[1]];
      const v = typeof a === "function" ? (a as (b: Record<string, unknown>) => unknown)(body) : a;
      return v instanceof Response ? v : json(v);
    }
    if (url.includes("/rest/v1/inventory")) return json(answers.inventory ?? []);
    return json([]);
  }));
  return calls;
}
const SESSION = { id: "s1", session_date: day(3), day: "Monday", status: "open", ride_kind: null, event_kind: "regular", bike_slots: '{"_time":"20:00 - 22:00"}', open_to_all: true, paid_ride: true, capacity: 12, needs_approval: false, addons: '["gel","bar"]' };
const PROFILE = [{ name: "Sara Khalid", hidden_types: null, gender: "female" }];

describe("the routes", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("refuse another site, a missing cookie and a body they cannot read, without touching the database", async () => {
    const calls = db({});
    for (const [post, path, ok] of [[cancelPOST, "cancel", { booking: "e1", reason: "plans" }], [updatePOST, "update", { session: "s1", drop: "e2" }], [addonsPOST, "addons", { booking: "e1", item: "gel", delta: 1 }],
      [lockerPOST, "locker", { action: "cancel", ids: ["e1"] }], [movePOST, "move", { from: "s1", to: "s2" }], [managePOST, "manage", { session: "s1" }]] as const) {
      expect((await post(req(path, ok, { ...HEADERS, origin: "https://evil.example" }))).status, path).toBe(403);
      expect(await (await post(req(path, ok, { origin: HEADERS.origin }))).json(), path).toEqual({ ok: false, error: "signin" });
      expect((await post(req(path, { nonsense: true }))).status, path).toBe(400);
    }
    expect(await (await addonsPOST(req("addons", { booking: "e1", item: "gel", delta: 2 }))).json()).toEqual({ ok: false, error: "invalid" });
    expect(await (await addonsPOST(req("addons", { booking: "e1", item: "locker", delta: 1 }))).json()).toEqual({ ok: false, error: "invalid" });
    expect(calls).toEqual([]);
  });

  it("cancel: every live row of the booking with the reason, then the add-ons of the rows that held a place back to stock", async () => {
    const calls = db({
      my_bookings: [row({ session_date: day(3), addons: '[{"id":"gel","qty":2}]' }), row({ id: "e2", queue_num: 5, session_date: day(3), status: "waitlist", addons: '[{"id":"bar","qty":1}]' }), row({ id: "e3", session_id: "s9" })],
      customer_booking_update: true, customer_addon_stock: true,
    });
    const res = await cancelPOST(req("cancel", { booking: "e2", reason: "other", note: "Flight" }));
    expect([res.status, await res.json()]).toEqual([200, { ok: true, cancelled: 2 }]);
    const upd = calls.filter((c) => c.fn === "customer_booking_update");
    expect(upd.map((c) => c.body)).toEqual(["e1", "e2"].map((id) => ({ p_id: "c1", p_token: TOKEN, p_entry_id: id, p_patch: { status: "cancelled", assigned_bike_id: null, cancel_reason: "other", cancel_note: "Flight" } })));
    expect(calls.find((c) => c.fn === "customer_addon_stock")?.body).toEqual({ p_id: "c1", p_token: TOKEN, p_items: [{ id: "gel", delta: 2 }] });
  });

  it("cancel: a reason Settings does not keep is refused, a paid ride that is over too, and a booking with nothing live is gone", async () => {
    db({ my_bookings: [row()], customer_booking_update: true });
    expect((await cancelPOST(req("cancel", { booking: "e1", reason: "c_nope" }))).status).toBe(400);
    const calls = db({ my_bookings: [row({ paid: true, session_date: day(-1) })], list_sessions: [{ ...SESSION, session_date: day(-1) }], customer_booking_update: true });
    expect(await (await cancelPOST(req("cancel", { booking: "e1", reason: "plans" }))).json()).toEqual({ ok: false, error: "over" });
    expect(calls.some((c) => c.fn === "customer_booking_update")).toBe(false);
    db({ my_bookings: [row({ status: "done" })], customer_profile: PROFILE });
    expect(await (await cancelPOST(req("cancel", { booking: "e1", reason: "plans" }))).json()).toEqual({ ok: false, error: "gone" });
  });

  it("update: a booking changed since the form was filled is refused before anything is written", async () => {
    const calls = db({ customer_profile: PROFILE, my_bookings: [row(), row({ id: "e2", queue_num: 5 })], list_sessions: [SESSION] });
    const res = await updatePOST(req("update", { session: "s1", key: ["e1"], riders: [{ name: "", height: "170", type: "Hybrid" }], waiver: false }));
    expect([res.status, await res.json()]).toEqual([409, { ok: false, error: "changed" }]);
    expect(calls.some((c) => c.fn === "customer_booking_update")).toBe(false);
  });

  it("update: the kept rows' changes, the riders removed and the riders added, each through the app's own door", async () => {
    const calls = db({
      customer_profile: PROFILE, my_bookings: [row({ session_date: day(3) }), row({ id: "e2", queue_num: 5, name: "Omar Khalid", type_preference: "Road", height: 180, size: "L", session_date: day(3), addons: '[{"id":"gel","qty":1}]' })],
      list_sessions: [SESSION], customer_booking_update: true, customer_create_booking: [{ id: "n1", status: "waiting", queue_num: 9 }], customer_addon_stock: true,
    });
    const res = await updatePOST(req("update", { session: "s1", key: ["e1", "e2"], riders: [{ name: "", height: "180", type: "Hybrid" }, { name: "", height: "180", type: "Road" }, { name: "lina khalid", height: "140", type: "Kids" }], waiver: true }));
    expect([res.status, await res.json()]).toEqual([200, { ok: true, added: 1, waitlisted: false }]);
    expect(calls.filter((c) => c.fn === "customer_booking_update").map((c) => c.body.p_patch)).toEqual([{ height: 180, size: "M" }]);
    const made = calls.find((c) => c.fn === "customer_create_booking")!.body.p_entries as Row[];
    expect(made).toEqual([expect.objectContaining({ name: "Lina Khalid", height: 140, size: "", type_preference: "Kids", session_id: "s1", status: "waiting", waiver_version: "2026-11-v4" })]);
    // without the waiver's tick a rider added is refused
    db({ customer_profile: PROFILE, my_bookings: [row({ session_date: day(3) })], list_sessions: [SESSION] });
    expect(await (await updatePOST(req("update", { session: "s1", key: ["e1"], riders: [{ name: "", height: "170", type: "Hybrid" }, { name: "Lina Khalid", height: "140", type: "Kids" }], waiver: false }))).json()).toEqual({ ok: false, error: "waiver" });
    // Any is never a rider's
    db({ customer_profile: PROFILE, my_bookings: [row({ session_date: day(3) })], list_sessions: [SESSION] });
    expect(await (await updatePOST(req("update", { session: "s1", key: ["e1"], riders: [{ name: "", height: "170", type: "Any" }], waiver: false }))).json()).toMatchObject({ ok: false, error: "invalid", field: "type", i: 0 });
  });

  it("update {drop}: a family member off the Farm House Night, never the holder", async () => {
    const rows = [row({ name: "Sara Khalid" }), row({ id: "e2", queue_num: 5, name: "Lina Khalid" })];
    let calls = db({ customer_profile: PROFILE, my_bookings: rows, customer_booking_update: true });
    expect(await (await updatePOST(req("update", { session: "s1", drop: "e2" }))).json()).toEqual({ ok: true, name: "Lina Khalid" });
    expect(calls.find((c) => c.fn === "customer_booking_update")?.body.p_patch).toEqual({ status: "cancelled", assigned_bike_id: null });
    calls = db({ customer_profile: PROFILE, my_bookings: rows, customer_booking_update: true });
    expect((await updatePOST(req("update", { session: "s1", drop: "e1" }))).status).toBe(400);
    expect(calls.some((c) => c.fn === "customer_booking_update")).toBe(false);
  });

  it("addons: one step saved, then the stock moved by one; none on a waitlisted row", async () => {
    let calls = db({ my_bookings: [row({ addons: '[{"id":"gel","qty":1,"p":12}]' })], list_sessions: [SESSION], inventory: [{ id: "bar", price: 15, qty: 4 }], customer_booking_update: true, customer_addon_stock: true });
    expect(await (await addonsPOST(req("addons", { booking: "e1", item: "bar", delta: 1 }))).json()).toEqual({ ok: true, lines: [{ id: "gel", qty: 1, p: 12 }, { id: "bar", qty: 1 }] });
    expect(calls.find((c) => c.fn === "customer_booking_update")?.body.p_patch).toEqual({ addons: '[{"id":"gel","qty":1,"p":12},{"id":"bar","qty":1}]' });
    expect(calls.find((c) => c.fn === "customer_addon_stock")?.body.p_items).toEqual([{ id: "bar", delta: -1 }]);
    calls = db({ my_bookings: [row({ status: "waitlist" })], list_sessions: [SESSION], inventory: [{ id: "bar", price: 15, qty: 4 }], customer_booking_update: true });
    expect((await addonsPOST(req("addons", { booking: "e1", item: "bar", delta: 1 }))).status).toBe(200);
    expect(calls.some((c) => c.fn === "customer_addon_stock")).toBe(false);
    db({ my_bookings: [row()], list_sessions: [SESSION], inventory: [{ id: "bar", price: 15, qty: 0 }] });
    expect(await (await addonsPOST(req("addons", { booking: "e1", item: "bar", delta: 1 }))).json()).toEqual({ ok: false, error: "out" });
    db({ my_bookings: [row()], list_sessions: [{ ...SESSION, event_kind: "community", ride_kind: "saturday", paid_ride: false }] });
    expect(await (await addonsPOST(req("addons", { booking: "e1", item: "bar", delta: 1 }))).json()).toEqual({ ok: false, error: "off" });
  });

  it("locker: a door taken in the last moments is reserved again with none picked; a refusal in the app's words", async () => {
    let n = 0;
    const calls = db({ customer_locker_reserve: () => (++n === 1 ? json({ code: "P0001", message: "LOCKER_TAKEN: 7" }, 400) : { ok: true, lockers: [{ booking_id: "e1", code: "12" }] }) });
    expect(await (await lockerPOST(req("locker", { action: "reserve", ids: ["e1"], period: "late", codes: ["7"] }))).json()).toEqual({ ok: true, swap: true, lockers: [{ bookingId: "e1", code: "12" }] });
    expect(calls.map((c) => c.body)).toEqual([
      { p_id: "c1", p_token: TOKEN, p_booking_ids: ["e1"], p_period: "late", p_codes: ["7"] },
      { p_id: "c1", p_token: TOKEN, p_booking_ids: ["e1"], p_period: "late" },
    ]);
    db({ customer_locker_reserve: json({ code: "P0001", message: "LOCKERS_FULL" }, 400) });
    expect(await (await lockerPOST(req("locker", { action: "reserve", ids: ["e1"], period: "late" }))).json()).toEqual({ ok: false, error: "lk_full" });
    db({ customer_locker_cancel: json({ code: "42501", message: "NOT_AUTHORIZED" }, 401) });
    expect((await lockerPOST(req("locker", { action: "cancel", ids: ["e1"] }))).status).toBe(401);
    db({ customer_locker_offer: { kind: "jcc", one: 10, both: 15, left: { early: 1 } }, locker_board: { kind: "jcc", units: [{ code: "1", out: false }], taken: { e: [], l: [] } } });
    expect(await (await lockerPOST(req("locker", { action: "board", session: "s1", day: "2099-03-01" }))).json()).toMatchObject({ ok: true, offer: { kind: "jcc", one: 10 }, board: { units: [{ code: "1", out: false }] } });
  });

  it("move: each rider through customer_booking_update, then the stock follows where each landed", async () => {
    const to = { ...SESSION, id: "s2", session_date: day(5), day: "Wednesday" };
    let moved = 0;
    const rows = () => [row({ session_date: day(3), status: "waitlist", addons: '[{"id":"gel","qty":1}]' }), row({ id: "e2", queue_num: 5, session_date: day(3) })]
      .map((r, i) => (i < moved ? { ...r, session_id: "s2", session_date: day(5), status: "waiting" } : r));
    const calls: Call[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const fn = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(url)?.[1] ?? "";
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      calls.push({ fn, body });
      // the session read answers by its id (list_sessions?...id=eq.<id>)
      if (fn === "list_sessions") return json([url.includes("id=eq.s2") ? to : SESSION]);
      if (fn === "customer_profile") return json(PROFILE);
      if (fn === "my_bookings") return json(rows());
      if (fn === "customer_booking_update") { moved += 1; return json(true); }
      if (fn === "customer_addon_stock") return json(true);
      return fn ? json({ code: "PGRST202" }, 404) : json([]);
    }));
    const res = await movePOST(req("move", { from: "s1", to: "s2" }));
    expect([res.status, await res.json()]).toEqual([200, { ok: true, waitlisted: false }]);
    expect(calls.filter((c) => c.fn === "customer_booking_update").map((c) => [c.body.p_entry_id, c.body.p_patch])).toEqual([
      ["e1", { session_id: "s2", session_day: "Wednesday", session_date: day(5), status: "waiting" }], ["e2", { session_id: "s2", session_day: "Wednesday", session_date: day(5), status: "waiting" }],
    ]);
    // the waitlisted rider who came off the waitlist takes their gel
    expect(calls.find((c) => c.fn === "customer_addon_stock")?.body.p_items).toEqual([{ id: "gel", delta: -1 }]);
  });

  it("move: a paid booking onto another fare, a type closed there and a ride that is over are refused before anything moves", async () => {
    const run = async (mine: Row[], target: Row) => {
      const calls: Call[] = [];
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const fn = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(url)?.[1] ?? "";
        calls.push({ fn, body: init?.body ? JSON.parse(String(init.body)) : {} });
        if (fn === "list_sessions") return json([url.includes("id=eq.s2") ? target : SESSION]);
        if (fn === "customer_profile") return json(PROFILE);
        if (fn === "my_bookings") return json(mine);
        if (url.includes("/ride_prices")) return json([{ type: "Hybrid", price: 57.5 }, { type: "Road", price: 75 }]);
        return fn ? json({ code: "PGRST202" }, 404) : json([]);
      }));
      const r = await (await movePOST(req("move", { from: "s1", to: "s2" }))).json();
      expect(calls.some((c) => c.fn === "customer_booking_update")).toBe(false);
      return r;
    };
    const to = { ...SESSION, id: "s2", session_date: day(5) };
    expect(await run([row({ session_date: day(3) })], { ...to, closed_types: ["Hybrid"] })).toEqual({ ok: false, error: "type_closed" });
    expect(await run([row({ session_date: day(3), paid: true, price: 57.5 })], { ...to, event_kind: "community", ride_kind: "saturday", needs_approval: true })).toEqual({ ok: false, error: "closed" });
    expect(await run([row({ session_date: day(3) })], { ...to, status: "full" })).toEqual({ ok: false, error: "closed" });
    expect(await run([row({ session_date: day(3) })], { ...to, session_date: day(-1) })).toEqual({ ok: false, error: "closed" });
  });

  it("manage: what the dialogs read, and the waiver in the page's language when asked", async () => {
    db({
      customer_profile: [{ name: "Sara Khalid", hidden_types: "Road Carbon" }], my_bookings: [row({ session_date: day(3), addons: '[{"id":"gel","qty":1}]' })],
      list_sessions: [{ ...SESSION, closed_types: ["Kids"] }], inventory: [{ id: "gel", name: "Gel", price: 12, qty: 0, photo: "data:image/png;base64,AAA" }, { id: "bar", name: "Bar", price: 15, qty: 4, photo: "https://x.supabase.co/p.png" }],
      customer_locker_offer: { kind: "jcc", one: 10, both: 15, left: {}, ended: {} }, customer_lockers: [{ id: "r1", booking_id: "e1", day: day(3), period: "late", code: "7", status: "reserved", price: 10 }],
    });
    const c = await (await managePOST(req("manage", { session: "s1" }))).json();
    expect(c).toMatchObject({ ok: true, name: "Sara Khalid", cap: 3, party: true, acctCap: 3, holder: null, session: { id: "s1", bike: true, open: true, free: false, ended: false } });
    expect(c.types.map((t: { type: string }) => t.type)).toEqual(["Road", "Hybrid", "Mountain", "Kids"]); // no Any, no Road Carbon hidden from the account
    expect(c.types.find((t: { type: string }) => t.type === "Kids")).toMatchObject({ closed: true });
    expect(c.addons.map((a: { id: string; photo: string }) => [a.id, a.photo])).toEqual([["bar", "https://x.supabase.co/p.png"], ["gel", ""]]); // in stock first, https photos only
    expect(c.lockers).toMatchObject({ kind: "jcc", rentals: [{ id: "r1", bookingId: "e1", code: "7" }] });
    expect(c.reasons).toHaveLength(9);
    expect(c.waiver).toBeUndefined();
    const w = await (await managePOST(req("manage", { session: "s1", waiver: true, locale: "ar" }))).json();
    expect(w.waiver).toMatchObject({ version: "2026-11-v4" });
    expect(w.waiver.title).toMatch(/[\u0600-\u06FF]/);
  });
});
