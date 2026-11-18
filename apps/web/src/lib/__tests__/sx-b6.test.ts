import { describe, expect, it } from "vitest";
import {
  datesLive, daysUntil, declineCause, earlyPct, giftLink, giftName, keyboardUp, kitFor, kitPick, KIT_NAMES, lessPct, packsOf, partyOf,
  refundLine, refundUntil, riderDone, setParty, soonDays, xpSettings,
} from "../sx-b6";
import { icsFor, type TicketSession } from "../tickets";

describe("dates on the steps and the tickets", () => {
  it("counts whole days and says In N days only from two days to sixty ahead (EF34)", () => {
    expect(daysUntil("2026-11-21", "2026-11-18")).toBe(3);
    expect(soonDays("2026-11-18", "2026-11-18")).toBeNull();
    expect(soonDays("2026-11-19", "2026-11-18")).toBeNull();
    expect(soonDays("2026-11-20", "2026-11-18")).toBe(2);
    expect(soonDays("2027-01-17", "2026-11-18")).toBe(60);
    expect(soonDays("2027-01-18", "2026-11-18")).toBeNull();
    expect(soonDays("not a date", "2026-11-18")).toBeNull();
  });
  it("puts the last refund day refundDays before the ride, as pay_booking_cancel counts it (EF14)", () => {
    expect(refundUntil("2026-11-21", 1)).toBe("2026-11-20");
    expect(refundUntil("2026-11-21", 0)).toBe("2026-11-21");
    expect(refundUntil("2026-12-01", 3)).toBe("2026-11-28");
    expect(refundLine("2026-11-21", "2026-11-18", 1)).toEqual({ until: "2026-11-20" });
    expect(refundLine("2026-11-21", "2026-11-20", 1)).toEqual({ until: "2026-11-20" });
    expect(refundLine("2026-11-21", "2026-11-21", 1)).toEqual({ none: true });
    expect(refundLine("x", "2026-11-21", 1)).toBeNull();
  });
});

describe("the party (EF09, EM07-B)", () => {
  const r = (child = false, name = "") => ({ name, height: "", type: "" as const, ...(child ? { child: true } : {}) });
  it("keeps one adult at least, puts the children after the adults and caps the whole party", () => {
    expect(partyOf([r()])).toEqual({ adults: 1, kids: 0 });
    const p = setParty([r(false, "Sara")], 2, 2, 3, "Kids");
    expect(p.map((x) => !!x.child)).toEqual([false, false, true]);
    expect(p[0].name).toBe("Sara");
    expect(p[2].type).toBe("Kids");
    expect(setParty([r()], 0, 0, 3, null)).toHaveLength(1);
    expect(setParty([r()], 1, 2, 3, null)[2].type).toBe("");
  });
  it("keeps each rider's answers when the party grows or shrinks", () => {
    const p = setParty([r(false, "A"), r(false, "B"), r(true, "C")], 1, 1, 3, "Kids");
    expect(p.map((x) => x.name)).toEqual(["A", "C"]);
  });
  it("calls a rider answered once the bike, the height and (in a party) the name are there", () => {
    expect(riderDone({ name: "", height: "170", type: "Road" }, false)).toBe(true);
    expect(riderDone({ name: "", height: "170", type: "Road" }, true)).toBe(false);
    expect(riderDone({ name: "Omar", height: "", type: "Own" }, true)).toBe(true);
    expect(riderDone({ name: "Omar", height: "1", type: "Kids" }, true)).toBe(false);
  });
});

describe("the bar (EM04-B, E01, E04)", () => {
  it("has something to do only with a date here that can be chosen", () => {
    expect(datesLive([])).toBe(false);
    expect(datesLive([{ opens: "Opens Sat" }, { fbk: true }, { handoff: "https://x" }, { satLink: "/saturday" }])).toBe(false);
    expect(datesLive([{ opens: null }, { fbk: true }])).toBe(true);
  });
  it("reads the keyboard as up only with a field focused and the visual viewport much shorter", () => {
    expect(keyboardUp(844, 500, true)).toBe(true);
    expect(keyboardUp(844, 500, false)).toBe(false);
    expect(keyboardUp(844, 780, true)).toBe(false);
  });
});

describe("a card payment that did not go through (EF13)", () => {
  it("names the cause from the gateway's words", () => {
    expect(declineCause("INSUFFICIENT FUNDS")).toBe("funds");
    expect(declineCause("Expired Card")).toBe("expired");
    expect(declineCause("Exceeds withdrawal limit")).toBe("limit");
    expect(declineCause("3-D Secure transaction attempt failed (Not Enrolled)")).toBe("secure");
    expect(declineCause("LOST CARD, PICK UP")).toBe("blocked");
    expect(declineCause("Invalid card number")).toBe("details");
    expect(declineCause("DO NOT HONOR")).toBe("bank");
    expect(declineCause("")).toBe("generic");
    expect(declineCause(null)).toBe("generic");
    expect(declineCause("something else")).toBe("generic");
  });
});

describe("kit on the confirmation (N32)", () => {
  it("links lights and the radar after dark, the bike computer on the Saturday ride, and nothing by day", () => {
    expect(kitFor("saturday", "06:30")).toBe("saturday");
    expect(kitFor("jcc", "21:00")).toBe("night");
    expect(kitFor("jcc", null)).toBe("night");
    expect(kitFor("swim", "20:00")).toBeNull();
    expect(kitFor("event", "10:00")).toBeNull();
  });
  it("never links a helmet, by name or by a slug staff set", () => {
    const ps = [{ slug: "varia-rtl515", name: "Garmin Varia RTL515 radar" }, { slug: "helmet-light", name: "Helmet light" }, { slug: "edge-540", name: "Garmin Edge 540" }];
    expect(kitPick(ps, [], KIT_NAMES.night).map((p) => p.slug)).toEqual(["varia-rtl515"]);
    expect(kitPick(ps, ["helmet-light", "edge-540"], KIT_NAMES.night).map((p) => p.slug)).toEqual(["edge-540"]);
    expect(kitPick(ps, [], KIT_NAMES.saturday).map((p) => p.slug)).toEqual(["varia-rtl515", "edge-540"]);
  });
});

describe("staff settings (xp.*)", () => {
  it("keeps everything off until staff turn it on, and the early bird off without the discount licence", () => {
    const off = xpSettings({}, true);
    expect(off).toEqual({ guardian: false, early: null, bikeCredit: null, gifts: false, kit: { night: [], saturday: [] } });
    const on = xpSettings({ "xp.earlyBird": { on: true, pct: 15, days: 10, kinds: ["jcc"] }, "xp.guardianTick": { on: true }, "xp.gifts": { on: true }, "xp.bikeCredit": { on: true, days: 30, max: 200 } }, true);
    expect(on.early).toEqual({ pct: 15, days: 10, kinds: ["jcc"] });
    expect(on.guardian && on.gifts).toBe(true);
    expect(on.bikeCredit).toEqual({ days: 30, max: 200 });
    expect(xpSettings({ "xp.earlyBird": { on: true, pct: 15, days: 10, kinds: ["jcc"] } }, false).early).toBeNull();
    expect(xpSettings({ "xp.earlyBird": { on: true, pct: 90, days: 10, kinds: ["jcc"] } }, true).early?.pct).toBe(50);
  });
  it("takes the early-bird share only on the kinds named, booked far enough ahead", () => {
    const e = { pct: 10, days: 14, kinds: ["jcc"] };
    expect(earlyPct(e, "jcc", "2026-12-02", "2026-11-18")).toBe(10);
    expect(earlyPct(e, "jcc", "2026-12-01", "2026-11-18")).toBe(0);
    expect(earlyPct(e, "saturday", "2027-01-01", "2026-11-18")).toBe(0);
    expect(earlyPct(null, "jcc", "2027-01-01", "2026-11-18")).toBe(0);
    expect(lessPct(57.5, 10)).toBe(51.75);
    expect(lessPct(75, 15)).toBe(63.75);
  });
});

describe("gifts and packs (EF20, EF21)", () => {
  it("sends a gift as the Experiences page with its code, in the page's language", () => {
    expect(giftLink("https://micromobility.sa", "en", "GF-AB12CD34")).toBe("https://micromobility.sa/experiences?gift=GF-AB12CD34");
    expect(giftLink("https://micromobility.sa", "ar", "GF-AB12CD34")).toBe("https://micromobility.sa/ar/experiences?gift=GF-AB12CD34");
    expect(giftLink("https://micromobility.sa", "en", "BD-1")).toBeNull();
  });
  it("keeps a gift's name to letters and spaces", () => {
    expect(giftName("  Sara-Al  Harbi 2 ")).toBe("SaraAl Harbi");
    expect(giftName("سارة")).toBe("سارة");
  });
  it("lists only packs with a name, two sessions or more and a price, in the page's language", () => {
    const rows = [
      { id: "p1", kind: "jcc", title_en: "Four circuit evenings", title_ar: "أربع أمسيات", lessons: 4, price: 200, bike_type: "Road", months: 6 },
      { id: "p2", kind: "jcc", title_en: "", lessons: 4, price: 200 },
      { id: "p3", kind: "jcc", title_en: "One", lessons: 1, price: 50 },
    ];
    expect(packsOf(rows, "ar")).toEqual([{ id: "p1", kind: "jcc", title: "أربع أمسيات", lessons: 4, price: 200, type: "Road", months: 6 }]);
    expect(packsOf(null, "en")).toEqual([]);
  });
});

describe("the calendar entry's reminders (EF15)", () => {
  const s = { id: "s1", date: "2026-11-21", kind: "jcc", title: null, times: ["21:00", "23:00"], gathers: false } as unknown as TicketSession;
  it("reminds 12 hours and 1 hour before when the confirmation asks, 2 hours otherwise", () => {
    const two = icsFor(s, "Ride", "JCC", new Date("2026-11-18T10:00:00Z"));
    expect(two.match(/TRIGGER:[^\r]*/g)).toEqual(["TRIGGER:-PT2H"]);
    const both = icsFor(s, "Ride", "JCC", new Date("2026-11-18T10:00:00Z"), { alarms: [720, 60] });
    expect(both.match(/TRIGGER:[^\r]*/g)).toEqual(["TRIGGER:-PT12H", "TRIGGER:-PT1H"]);
    expect(icsFor(s, "Ride", "JCC", new Date(), { alarms: [90] })).toContain("TRIGGER:-PT90M");
  });
});
