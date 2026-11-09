import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import proxy, { lockerRiderTarget, staffTapTarget } from "../../proxy";
import { LOCKER_LINE, addonLines, addonsCost, lockerText, lockersOf } from "../tickets";

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
