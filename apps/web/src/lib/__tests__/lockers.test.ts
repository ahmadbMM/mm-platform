import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import proxy, { lockerRiderTarget, staffTapTarget } from "../../proxy";
import { LOCKER_LINE, addonLines, addonsCost, lockerText, lockersOf, ownLockersOf } from "../tickets";

// Lockers (the booking app's, rentals 20261109120000; plain numbers 1 to 18 since the lockers page, 20261109220000): a
// locker's NFC tag or QR label at micromobility.sa/lockers/7 (a tag written before, /lockers/L7) takes a staff phone to
// the staff app and a rider's to the lockers page with that locker picked, and a ticket's locker line (the add-on line
// the database writes, {"id":"locker"}) says the period and, once given, the number.
describe("a locker's tag", () => {
  it("a staff phone goes to the staff app with the code as written; a rider's to the lockers page with it", () => {
    expect(staffTapTarget("/lockers/7", new URLSearchParams(), "1")).toBe("https://staff.micromobility.sa/?locker=7");
    expect(staffTapTarget("/lockers/18/", new URLSearchParams(), "1")).toBe("https://staff.micromobility.sa/?locker=18");
    expect(staffTapTarget("/lockers/l7", new URLSearchParams(), "1")).toBe("https://staff.micromobility.sa/?locker=L7");
    expect(staffTapTarget("/lockers/P12/", new URLSearchParams(), "1")).toBe("https://staff.micromobility.sa/?locker=P12");
    expect(staffTapTarget("/lockers/7", new URLSearchParams(), undefined)).toBeNull();
    expect(lockerRiderTarget("/lockers/7")).toBe("/lockers?locker=7");
    expect(lockerRiderTarget("/lockers/07/")).toBe("/lockers?locker=07");
    expect(lockerRiderTarget("/lockers/L7")).toBe("/lockers?locker=L7");
    expect(lockerRiderTarget("/lockers/7", new URLSearchParams("lang=ar"))).toBe("/lockers?locker=7&lang=ar");
    expect(lockerRiderTarget("/lockers/7", new URLSearchParams("lang=xx"))).toBe("/lockers?locker=7");
    expect(lockerRiderTarget("/lockers/7", new URLSearchParams("lang=ur"))).toBe("/lockers?locker=7&lang=ur"); // the page speaks all sixteen
    // the page itself, and anything that is not a locker's number, is not a tag
    expect(lockerRiderTarget("/lockers")).toBeNull();
    expect(lockerRiderTarget("/lockers/not-a-code")).toBeNull();
    expect(lockerRiderTarget("/lockers/12345")).toBeNull();
    expect(lockerRiderTarget("/bikes/42")).toBeNull();
    expect(staffTapTarget("/lockers", new URLSearchParams(), "1")).toBeNull();
    // the bikes' tags are unchanged
    expect(staffTapTarget("/bikes/42", new URLSearchParams(), "1")).toBe("https://staff.micromobility.sa/?bike=42");
  });

  it("the proxy answers both, and keeps neither answer", async () => {
    const staff = await proxy(new NextRequest("https://micromobility.sa/lockers/7", { headers: { cookie: "mm_staff_tap=1" } }));
    expect(staff.status).toBe(307);
    expect(staff.headers.get("location")).toBe("https://staff.micromobility.sa/?locker=7");
    expect(staff.headers.get("cache-control")).toBe("private, no-store");
    const rider = await proxy(new NextRequest("https://micromobility.sa/lockers/L7"));
    expect(rider.status).toBe(307);
    const to = new URL(rider.headers.get("location") || "");
    expect(to.pathname).toBe("/lockers");
    expect(to.searchParams.get("locker")).toBe("L7");
    expect(rider.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("a rider's show-at-desk QR (micromobility.sa/lockers/r/<rental>)", () => {
  const id = "0b6f2a8e-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
  it("sends a staff phone to that rider's lockers in the staff app, and a rider's phone to the lockers page", () => {
    expect(staffTapTarget(`/lockers/r/${id}`, new URLSearchParams(), "1")).toBe(`https://staff.micromobility.sa/?lkr=${id}`);
    expect(staffTapTarget(`/lockers/r/${id.toUpperCase()}/`, new URLSearchParams(), "1")).toBe(`https://staff.micromobility.sa/?lkr=${id}`);
    expect(staffTapTarget(`/lockers/r/${id}`, new URLSearchParams(), undefined)).toBeNull();
    expect(lockerRiderTarget(`/lockers/r/${id}`)).toBe("/lockers");
    expect(lockerRiderTarget(`/lockers/r/${id}`, new URLSearchParams("lang=ar"))).toBe("/lockers?lang=ar");
    expect(lockerRiderTarget(`/lockers/r/${id}`, new URLSearchParams("lang=de"))).toBe("/lockers?lang=de");
    expect(lockerRiderTarget(`/lockers/r/${id}`, new URLSearchParams("lang=xx"))).toBe("/lockers");
    expect(lockerRiderTarget("/lockers/r/not-a-rental")).toBeNull();
  });
});

describe("a ticket's locker line", () => {
  it("is named by the card, counted in the total, and says the period and the number", () => {
    const lines = addonLines([{ id: "q1", name: "Rana", addonLines: [{ id: LOCKER_LINE, qty: 1, p: 15 }, { id: "gel", qty: 2, p: 5 }] }], new Map([["gel", { name: "Gel", price: 5 }]]));
    expect(lines.map((l) => [l.locker, l.name, l.amount])).toEqual([[true, "", 15], [false, "Gel", 10]]);
    expect(addonsCost(lines)).toBe(25);
    const lk = lockersOf([
      { booking_id: "q1", period: "both", status: "in_use", price: 15, code: "L7" },
      { booking_id: "q2", period: "pm", status: "reserved", price: 10, code: null },
      { booking_id: "q3", period: "late", status: "cancelled", price: 10, code: null },
      "junk",
    ]);
    expect([...lk.keys()]).toEqual(["q1", "q2"]);
    expect(lockerText("Locker", lk.get("q1"), "en")).toBe("Locker · 6 PM - 11 PM · L7");
    expect(lockerText("Locker", lk.get("q2"), "en")).toBe("Locker · 7 PM - 9 PM");
    expect(lockerText("Locker", undefined, "en")).toBe("Locker");
    expect(lockersOf(null).size).toBe(0);
  });
});

describe("the rider's own lockers (no booking behind them)", () => {
  const rows = [
    { id: "a", booking_id: null, day: "2099-01-02", period: "early", status: "reserved", code: "7", name: "Sara", pay: "desk", paid: false },
    { id: "b", booking_id: null, day: "2099-01-01", period: "late", status: "in_use", code: "3", name: "Omar", pay: "wallet", paid: true },
    { id: "c", booking_id: "q1", day: "2099-01-01", period: "late", status: "reserved", code: "4" },
    { id: "d", booking_id: null, day: "2098-12-31", period: "late", status: "reserved", code: "5" },
    { id: "e", booking_id: null, day: "2099-01-03", period: "late", status: "returned", code: "6" },
  ];
  it("keeps today on, reserved or in use, with no booking, soonest first", () => {
    const own = ownLockersOf(rows, "2099-01-01");
    expect(own.map((l) => l.id)).toEqual(["b", "a"]);
    expect(own[0]).toEqual({ id: "b", day: "2099-01-01", period: "late", code: "3", name: "Omar", status: "in_use", pay: "wallet", paid: true });
    expect(ownLockersOf(null, "2099-01-01")).toEqual([]);
  });
  it("reads as a ticket line without the word: the time and the number", () => {
    expect(lockerText("", { period: "early", code: "7", status: "reserved" }, "en")).toBe("6 PM - 8 PM · 7");
  });
});
