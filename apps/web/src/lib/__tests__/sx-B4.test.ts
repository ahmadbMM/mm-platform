import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addMonths, afterOf, afterSettings, APP_META, arriveOpen, bikeLines, bookedSlot, carOf, checkupDays, claimLines, claimText, fold, handoverOf, hijriDay,
  hijriParts, hijriRange, icsText, orderPath, passOpen, photoPathOk, riyadhAt, riyadhDay, riyadhHm, shrinkSize, slotCalendarOpen, slotChangeOpen,
  WALLET_ART, type After,
} from "../sx-B4";
import { orderOf, type Order } from "../store-order";
import type { AfterOrder } from "../sx-B4";
import { T } from "../../components/store/sx-B4.text";

// After the sale on an order's page (builder B4, 2026-11-18): what the database's store_after_read answers, the settings
// staff keep, when each part shows, the calendar file, the Hijri date on Arabic pages, and the server's calls.
const KEY = "a".repeat(32);
const order = (x: Record<string, unknown> = {}): Order => orderOf({
  id: "o1", no: 1042, status: "delivered", fulfil: "pickup", name: "Sami", phone: "•••• 1234", subtotal: 2300, total: 2300, created_at: "2026-11-01T09:00:00Z",
  paid_at: "2026-11-01T09:05:00Z", delivered_at: "2026-11-03T15:00:00Z",
  items: [
    { id: 7, name: "Trek FX 2", variant: "M · Black", qty: 1, unit_price: 2200, product_id: "bike-1", variant_id: "v1" },
    { id: 8, name: "Bottle", variant: null, qty: 1, unit_price: 100, product_id: "acc-1", variant_id: "v2" },
  ],
  ...x,
}, KEY) as Order;

describe("store_after_read's answer", () => {
  it("is read field by field, and anything else is no extras", () => {
    const a = afterOf({
      build: { at: "2026-11-02T10:00:00Z", photos: ["/media/store-builds/1042/a.jpg", "javascript:alert(1)", "https://x.test/b.jpg", "/media/c.jpg", "/media/d.jpg"], checks: { brakes: true, gears: "yes", torque: true }, note: " Saddle set low " },
      arrival: { at: "2026-11-05T07:42:00Z", car: "white", seen: true },
      claims: [{ id: "c1", item_id: 7, state: "open", created_at: "2026-11-10T08:00:00Z", photos: 2 }, { id: "c2", item_id: 8, state: "lost" }],
      push: true, changes: 1,
    }) as After;
    expect(a.build?.photos).toEqual(["/media/store-builds/1042/a.jpg", "https://x.test/b.jpg", "/media/c.jpg"]);
    expect(a.build?.checks).toEqual({ brakes: true, gears: false, torque: true, tyres: false });
    expect(a.build?.note).toBe("Saddle set low");
    expect(a.arrival).toEqual({ at: "2026-11-05T07:42:00Z", car: "white", seen: true });
    expect(a.claims.map((c) => c.id)).toEqual(["c1"]);
    expect(a.push).toBe(true);
    expect(a.changes).toBe(1);
    expect(afterOf(null)).toBeNull();
    expect(afterOf([])).toBeNull();
    expect(afterOf({})).toEqual({ build: null, arrival: null, claims: [], push: false, changes: 0 });
  });
});

describe("the settings staff keep", () => {
  it("read as their defaults when missing or malformed: check-up on for 12 weeks, Change time 24 hours twice, push off", () => {
    expect(afterSettings(null)).toEqual({ checkup: { on: true, weeks: 12 }, change: { hours: 24, max: 2 }, push: false });
    expect(afterSettings({ "store.checkup": { on: false, weeks: 8 }, "store.slotChange": { on: false }, "store.push.on": true }))
      .toEqual({ checkup: { on: false, weeks: 8 }, change: null, push: true });
    expect(afterSettings({ "store.checkup": { weeks: 0 }, "store.slotChange": { hours: 6, max: 9 }, "store.push.on": "true" }))
      .toEqual({ checkup: { on: true, weeks: 12 }, change: { hours: 6, max: 2 }, push: false });
  });
});

describe("when each part shows", () => {
  const bikes = new Set(["bike-1"]);
  it("finds the bikes among the order's lines, never a gift card", () => {
    expect(bikeLines(order(), bikes).map((i) => i.id)).toEqual([7]);
    expect(bikeLines(order({ items: [{ id: 9, name: "Card", qty: 1, unit_price: 100, product_id: "bike-1", gift_card: true }] }), bikes)).toEqual([]);
  });

  it("puts the check-up reminder half way through its window from the day it was handed over (Riyadh)", () => {
    expect(checkupDays(order(), 12, true)).toEqual({ remind: "2026-12-15", by: "2027-01-26" });
    expect(checkupDays(order({ delivered_at: "2026-11-03T22:30:00Z" }), 12, true)?.remind).toBe("2026-12-16"); // 01:30 the next day in Riyadh
    expect(checkupDays(order({ status: "shipped" }), 12, true)).toBeNull();
    expect(checkupDays(order(), 12, false)).toBeNull();
  });

  const slot = { day: "2026-11-21", time: "am", from: "10:00", to: "13:00" };
  const handover = { day: "2026-11-21", at: "10:00", to: "10:20" };
  const now = Date.parse("2026-11-19T07:00:00Z"); // 10:00 Riyadh, two days before
  // a pickup's slot is its handover (B3's order JSON: handover {day, at, to}); a Jeddah delivery's is its slot
  const pick = (x: Record<string, unknown>): AfterOrder => ({ ...order(x), handover });
  const jed = (x: Record<string, unknown>): AfterOrder => order({ fulfil: "jeddah", slot, ...x });

  it("reads the booked slot only with its hours: a delivery's window, a pickup's handover", () => {
    expect(handoverOf({ handover })).toEqual(handover);
    expect(handoverOf({ handover: { day: "2026-11-21", at: "4pm", to: "16:20" } })).toBeNull();
    expect(handoverOf(null)).toBeNull();
    expect(bookedSlot(jed({}))).toEqual(slot);
    expect(bookedSlot(pick({ status: "ready" }))).toEqual({ day: "2026-11-21", time: "10:00", from: "10:00", to: "10:20" });
    expect(bookedSlot(order({ status: "ready", slot }))).toBeNull(); // a pickup without a handover
    expect(bookedSlot(order({ fulfil: "jeddah", slot: { day: "2026-11-21", time: "am" } }))).toBeNull();
    expect(bookedSlot(order({ fulfil: "ksa", slot }))).toBeNull();
    expect(riyadhAt("2026-11-21", "10:00")).toBe(Date.parse("2026-11-21T07:00:00Z"));
  });

  it("offers Change time until the cut-off, a set number of times, while the order is still to come", () => {
    const set = { hours: 24, max: 2 };
    expect(slotChangeOpen(pick({ status: "paid" }), now, set, 0)).toBe(true);
    expect(slotChangeOpen(jed({ status: "preparing" }), now, set, 0)).toBe(true);
    expect(slotChangeOpen(pick({ status: "paid" }), Date.parse("2026-11-20T07:30:00Z"), set, 0)).toBe(false); // 23.5 h before
    expect(slotChangeOpen(pick({ status: "paid" }), now, set, 2)).toBe(false);
    expect(slotChangeOpen(pick({ status: "paid" }), now, null, 0)).toBe(false);
    expect(slotChangeOpen(jed({ status: "shipped" }), now, set, 0)).toBe(false);
  });

  it("offers I'm here on a ready pickup's day, the pass while it is to collect, the slot's calendar while it is to come", () => {
    expect(arriveOpen(pick({ status: "ready" }), "2026-11-21")).toBe(true);
    expect(arriveOpen(pick({ status: "ready" }), "2026-11-20")).toBe(false);
    expect(arriveOpen(order({ status: "ready" }), "2026-11-20")).toBe(true); // no handover booked: any day once ready
    expect(arriveOpen(pick({ status: "preparing" }), "2026-11-21")).toBe(false);
    expect(arriveOpen(jed({ status: "ready" }), "2026-11-21")).toBe(false);
    expect(passOpen(order({ status: "paid" }))).toBe(true);
    expect(passOpen(order({ status: "delivered" }))).toBe(false);
    expect(passOpen(order({ status: "paid", fulfil: "jeddah" }))).toBe(false);
    expect(slotCalendarOpen(jed({ status: "out" }))).toBe(true);
    expect(slotCalendarOpen(pick({ status: "ready" }))).toBe(true);
    expect(slotCalendarOpen(pick({ status: "delivered" }))).toBe(false);
  });
});

describe("warranty claims", () => {
  const months = (id: string | null) => (id === "bike-1" ? 24 : 12);
  it("start from each handed-over line still covered, with no claim open on it", () => {
    const now = Date.parse("2027-06-01T09:00:00Z");
    expect(claimLines(order(), [], now, months).map((l) => [l.id, l.until])).toEqual([[7, "2028-11-03"], [8, "2027-11-03"]]);
    const open = [{ id: "c1", item_id: 7, state: "open" as const, created_at: "", photos: 0, reply: null }];
    expect(claimLines(order(), open, now, months).map((l) => l.id)).toEqual([8]);
    expect(claimLines(order(), [{ ...open[0], state: "refused" }], now, months).map((l) => l.id)).toEqual([7, 8]);
    expect(claimLines(order(), [], Date.parse("2028-01-01T09:00:00Z"), months).map((l) => l.id)).toEqual([7]);
    expect(claimLines(order({ status: "shipped" }), [], now, months)).toEqual([]);
  });
  it("count months to the same day, or the month's last", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-03", 24)).toBe("2028-11-03");
  });
  it("take 10 to 600 characters and photos only from the order's own folder", () => {
    expect(claimText("  short ")).toBeNull();
    expect(claimText("The rear brake squeals")).toBe("The rear brake squeals");
    expect(claimText("x".repeat(601))).toBeNull();
    expect(photoPathOk(1042, `o1042/${"b".repeat(32)}.jpg`)).toBe(true);
    expect(photoPathOk(1042, `o1043/${"b".repeat(32)}.jpg`)).toBe(false);
    expect(photoPathOk(1042, `o1042/../x.jpg`)).toBe(false);
  });
});

describe("I'm here and photos", () => {
  it("take a car's colour in any script, short, or none", () => {
    expect(carOf("  White   Camry ")).toBe("White Camry");
    expect(carOf("أبيض")).toBe("أبيض");
    expect(carOf("")).toBe("");
    expect(carOf(undefined)).toBe("");
    expect(carOf("<b>red</b>")).toBeNull();
    expect(carOf("x".repeat(31))).toBeNull();
  });
  it("shrink a photo to 1600 px on its long side, never enlarging it", () => {
    expect(shrinkSize(4032, 3024)).toEqual({ w: 1600, h: 1200 });
    expect(shrinkSize(3024, 4032)).toEqual({ w: 1200, h: 1600 });
    expect(shrinkSize(800, 600)).toEqual({ w: 800, h: 600 });
    expect(shrinkSize(0, 10)).toEqual({ w: 0, h: 0 });
  });
  it("say Riyadh's clock and day the same everywhere", () => {
    expect(riyadhHm("2026-11-21T07:42:10Z")).toBe("10:42");
    expect(riyadhDay("2026-11-21T22:00:00Z")).toBe("2026-11-22");
    expect(riyadhDay("2026-11-21")).toBe("2026-11-21");
    expect(riyadhDay("soon")).toBeNull();
  });
});

describe("the Hijri date beside a Gregorian one (Arabic pages only)", () => {
  it("is Umm al-Qura with the Arabic month name and Western digits", () => {
    expect(hijriDay("2026-11-21", "ar")).toBe("11 جمادى الآخرة 1448 هـ");
    expect(hijriDay("2026-11-21T22:30:00Z", "ar")).toBe("12 جمادى الآخرة 1448 هـ"); // already the 22nd in Riyadh
    expect(hijriDay("2026-11-21", "en")).toBeNull();
    expect(hijriDay(null, "ar")).toBeNull();
    expect(hijriRange("2026-11-21", "2026-11-23", "ar")).toBe("11–13 جمادى الآخرة 1448 هـ");
    expect(hijriRange("2026-11-21", "2026-11-21", "ar")).toBe("11 جمادى الآخرة 1448 هـ");
    expect(hijriRange("2026-12-08", "2026-12-12", "ar")).toMatch(/^\d{2} جمادى الآخرة – \d رجب 1448 هـ$/);
  });

  // an engine without the calendar, or one that writes it in numbers or another order, shows nothing rather than a wrong
  // date (the booking app met an iPhone that wrote en-CA dates as 10/27/2026)
  const fake = (calendar: string, parts: { type: string; value: string }[]) => () =>
    ({ resolvedOptions: () => ({ calendar }), formatToParts: () => parts }) as unknown as Intl.DateTimeFormat;
  it("hides itself whenever the engine's answer is not a sure one", () => {
    expect(hijriParts("2026-11-21", fake("gregory", [{ type: "day", value: "21" }, { type: "month", value: "نوفمبر" }, { type: "year", value: "2026" }]))).toBeNull();
    expect(hijriParts("2026-11-21", fake("islamic-umalqura", [{ type: "month", value: "6" }, { type: "day", value: "11" }, { type: "year", value: "1448" }]))).toBeNull();
    expect(hijriParts("2026-11-21", fake("islamic-umalqura", [{ type: "day", value: "١١" }, { type: "month", value: "جمادى الآخرة" }, { type: "year", value: "١٤٤٨" }]))).toBeNull();
    expect(hijriParts("2026-11-21", fake("islamic-umalqura", [{ type: "day", value: "11" }, { type: "month", value: "جمادى الآخرة" }, { type: "year", value: "2026" }]))).toBeNull();
    expect(hijriParts("2026-11-21", () => { throw new RangeError("no calendar"); })).toBeNull();
    expect(hijriParts("2026-11-21", fake("islamic-umalqura", [{ type: "day", value: "11" }, { type: "literal", value: " " }, { type: "month", value: "جمادى الآخرة" }, { type: "year", value: "1448" }])))
      .toEqual({ d: 11, m: "جمادى الآخرة", y: 1448 });
  });
});

describe("the calendar file", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  it("writes a timed window in UTC with its alarms, and a whole day with an alarm at 09:00", () => {
    const ics = icsText([
      { uid: "mm-order-1042-slot@micromobility.sa", title: "Pick up order MM-1042, MicroMobility; today", day: "2026-11-21", from: "10:00", to: "10:20",
        location: "Jeddah", text: "Order MM-1042\nhttps://micromobility.sa/store/order/1042?k=x", alarms: ["-P1D", "-PT1H", "bad"] },
      { uid: "c@micromobility.sa", title: "Check-up", day: "2026-12-15", alarms: ["PT9H"] },
    ], now);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261121T070000Z\r\nDTEND:20261121T072000Z");
    expect(ics).toContain("DTSTAMP:20261118T120000Z");
    expect(ics).toContain("SUMMARY:Pick up order MM-1042\\, MicroMobility\\; today");
    expect(ics).toContain("DESCRIPTION:Order MM-1042\\nhttps://micromobility.sa/store/order/1042?k=x");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(3);
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).not.toContain("TRIGGER:bad");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261215\r\nDTEND;VALUE=DATE:20261216");
    expect(ics).toContain("TRIGGER:PT9H");
    // a Ramadan evening's handover runs past midnight: it ends the next day (N36)
    expect(icsText([{ uid: "r@x", title: "R", day: "2027-03-01", from: "23:50", to: "00:10", alarms: [] }], now)).toContain("DTSTART:20270301T205000Z\r\nDTEND:20270301T211000Z");
  });
  it("folds a long line at 75 octets without cutting an Arabic letter", () => {
    const line = `SUMMARY:${"استلام الطلب ".repeat(12)}`;
    const folded = fold(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    const enc = new TextEncoder();
    for (const p of parts) expect(enc.encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
  });
});

describe("words and links", () => {
  it("has every English word in Arabic too", () => {
    const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v).map((x) => `${k}.${x}`) : [k])).sort();
    expect(keys(T.ar)).toEqual(keys(T.en));
    expect(T.en.claimState).toHaveProperty("in_progress");
  });
  it("links the order with its key, and names the manifest only from the pages that offer Add to Home Screen", () => {
    expect(orderPath(1042, KEY)).toBe(`/store/order/1042?k=${KEY}`);
    expect(APP_META.manifest).toBe("/app.webmanifest");
    const m = JSON.parse(readFileSync(fileURLToPath(new URL("../../../public/app.webmanifest", import.meta.url)), "utf8")) as Record<string, unknown>;
    expect(m.display).toBe("standalone");
    expect(m).not.toHaveProperty("start_url"); // the page added is the page that opens
    expect(Object.values(WALLET_ART.apple).every((v) => v === null || /^\/site\/wallet\//.test(v))).toBe(true);
    const layout = readFileSync(fileURLToPath(new URL("../../app/[locale]/layout.tsx", import.meta.url)), "utf8");
    expect(layout).not.toMatch(/manifest/); // never site-wide: a browser would put its install banner on every page
  });
});

describe("the server's calls (lib/sx-B4-api.ts)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const calls: { fn: string; body: Record<string, unknown> }[] = [];
  const db = (status: number, answer: unknown) => {
    calls.length = 0;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"); vi.stubEnv("PAY_SERVER_KEY", "k".repeat(40));
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ fn: url.replace(/^.*\/rpc\//, ""), body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify(answer), { status });
    }));
  };

  it("read the extras with the server key, and a database without them as none", async () => {
    const api = await import("../sx-B4-api");
    db(200, { push: true, changes: 1 });
    expect((await api.afterRead(1042, KEY))?.push).toBe(true);
    expect(calls[0]).toEqual({ fn: "store_after_read", body: { p_key: "k".repeat(40), p_no: 1042, p_track: KEY } });
    db(404, { code: "PGRST202", message: "Could not find the function public.store_after_read" });
    expect(await api.afterRead(1042, KEY)).toBeNull();
    db(200, {});
    expect(await api.afterRead(1042, "nope")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("say the database's refusals as the page's codes", async () => {
    const api = await import("../sx-B4-api");
    expect(api.afterError({ status: 404, message: "Could not find the function" })).toEqual({ error: "off", status: 404 });
    expect(api.afterError({ status: 400, message: "STORE_AFTER_CUTOFF" })).toEqual({ error: "cutoff", status: 409 });
    expect(api.afterError({ status: 500, message: "NOT_FOUND" })).toEqual({ error: "not_found", status: 409 });
    db(400, { message: "STORE_AFTER_SLOT_FULL: 2026-11-21 t10" });
    expect(await api.slotChange({ no: 1042, key: KEY, day: "2026-11-21", time: "t10" })).toEqual({ ok: false, error: "slot_full", status: 409 });
    expect(calls[0].body).toMatchObject({ p_no: 1042, p_track: KEY, p_day: "2026-11-21", p_time: "t10" });
  });

  it("check a claim, a car and the photos before asking", async () => {
    const api = await import("../sx-B4-api");
    db(200, { claims: [{ id: "c1", item_id: 7, state: "open", created_at: "2026-11-10T08:00:00Z" }] });
    expect(await api.claimAdd({ no: 1042, key: KEY, item: 7, text: "short", photos: [] })).toEqual({ ok: false, error: "text", status: 400 });
    expect(await api.claimAdd({ no: 1042, key: KEY, item: 7, text: "The rear brake squeals", photos: ["o1/x.jpg"] })).toEqual({ ok: false, error: "photos", status: 400 });
    expect(await api.arrive({ no: 1042, key: KEY, car: "<script>" })).toEqual({ ok: false, error: "car", status: 400 });
    expect(calls).toHaveLength(0);
    const p = `o1042/${"c".repeat(32)}.jpg`;
    const r = await api.claimAdd({ no: 1042, key: KEY, item: 7, text: "The rear brake squeals", photos: [p] });
    expect(r.ok && r.data.claims[0].id).toBe("c1");
    expect(calls[0]).toMatchObject({ fn: "store_after_claim", body: { p_item: 7, p_text: "The rear brake squeals", p_photos: [p] } });
    db(200, { arrival: { at: "2026-11-21T07:42:00Z", car: null } });
    const a = await api.arrive({ no: 1042, key: KEY, car: "" });
    expect(a.ok && a.data.arrival?.at).toBe("2026-11-21T07:42:00Z");
    expect(calls[0].body).toMatchObject({ p_car: null });
  });

  it("read the open handover slots from B3's store_handover_slots, without the server key", async () => {
    const api = await import("../sx-B4-api");
    db(200, { on: true, minutes: 20, days: [{ day: "2026-11-21", slots: [{ at: "16:00", to: "16:20", open: true }, { at: "16:20", to: "16:40", open: false }] },
      { day: "bad", slots: [] }, { day: "2026-11-22", slots: [{ at: "21:40", to: "00:00", open: true }] }] });
    expect(await api.handoverDays()).toEqual([{ day: "2026-11-21", slots: [{ at: "16:00", to: "16:20" }] }, { day: "2026-11-22", slots: [{ at: "21:40", to: "00:00" }] }]);
    expect(calls[0]).toEqual({ fn: "store_handover_slots", body: {} });
    db(200, { on: false });
    expect(await api.handoverDays()).toBeNull();
    db(404, {});
    expect(await api.handoverDays()).toBeNull();
  });
});

describe("the order page's source", () => {
  const src = (p: string) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), "utf8");
  it("draws after the sale in its places and keeps the generic service link only without the free check-up", () => {
    const v = src("components/store/OrderView.tsx");
    for (const part of ["after?.head", "after?.way", "after?.build", "after?.claim", "after?.acts", "!after?.noService"]) expect(v).toContain(part);
    const page = src("app/[locale]/store/order/[no]/page.tsx");
    expect(page).toContain("afterRead(num, key)");
    expect(page).toContain("APP_META");
  });
  it("never pins anything to the bottom of the screen (R2)", () => {
    const css = src("components/store/sx-B4.css");
    expect(css).not.toMatch(/position:\s*(fixed|sticky)/);
  });
});
