import { describe, expect, it } from "vitest";
import { badgeList, closestBadges, perfectWeeks, profilePct, recordRows, rideStats, seasonProgress, weekRuns, weekStreak, type BadgeData, type RecordSession } from "../ride-record";

// My Account's record follows the booking app's account page (_myrStats, _mrBadges, bd-next).
const today = "2026-10-01"; // a Thursday
const row = (o: Record<string, unknown>) => ({ id: String(o.session_id), session_date: o.session_id, status: "done", paid: true, queue_num: 1, type_preference: "Road", ...o });
const empty: BadgeData = { catalog: [], weeks: null, seasons: [], mine: [] };

describe("week runs", () => {
  it("count a streak back from this week or last", () => {
    expect(weekStreak(["2026-09-17", "2026-09-24", "2026-09-30"], today)).toBe(3);
    expect(weekStreak(["2026-09-17", "2026-09-24"], today)).toBe(2); // last week counts
    expect(weekStreak(["2026-09-10"], today)).toBe(0);
  });
  it("forgive one quiet week in four", () => {
    const r = weekRuns(["2026-09-03", "2026-09-10", "2026-09-24", "2026-09-30"], today);
    expect(r.best).toBe(2);
    expect(r.curS).toBe(5);
  });
});

describe("dated badges and perfect weeks", () => {
  it("read a yearly window across New Year", () => {
    const rule = { rides: 2, windows: [{ from: "12-01", to: "02-29" }] };
    expect(seasonProgress(rule, ["2025-12-20", "2026-01-05"], today)).toMatchObject({ on: true, cur: null });
    expect(seasonProgress(rule, ["2025-12-20"], today).on).toBe(false);
  });
  it("count this week's sessions ridden", () => {
    const w = [{ w: "2026-09-27", ids: ["a", "b", "c"] }, { w: "2026-09-20", ids: ["x", "y"] }];
    expect(perfectWeeks(w, new Set(["a", "x", "y"]), today)).toMatchObject({ known: true, any: true, run: 1, cur: { n: 1, of: 3 } });
    expect(perfectWeeks(null, new Set(), today).known).toBe(false);
  });
});

describe("the badges", () => {
  const rows = recordRows(["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"].map((d) => row({ session_id: d })));
  const ses = new Map<string, RecordSession>(rows.map((r) => [r.sessionId, { kind: "jcc", freeRide: false }]));
  const list = (data: BadgeData = empty, r = rows, s = ses, profile: Record<string, unknown> | null = null) => badgeList(r, s, data, today, profile);
  const on = (data?: BadgeData) => list(data).filter((x) => x.on).map((x) => x.slug);
  it("are earned by riding, as the booking app counts them", () => {
    expect(on()).toEqual(["first_lap", "front_row", "streak"]);
    expect(list().find((x) => x.slug === "regular")).toMatchObject({ on: false, p: "4/5" });
  });
  it("keep National Day 96 and Back on Track out until earned, and staff's own badges last", () => {
    const slugs = list().map((x) => x.slug);
    expect(slugs).not.toContain("national_day_96");
    expect(slugs).not.toContain("back_on_track");
    expect(slugs.slice(-7)).toEqual(["marshal", "pit_crew", "green_flag", "super_licence", "scrutineer", "champion", "spirit"]);
  });
  it("put a badge staff gave first, with their note and the day", () => {
    const L = list({ ...empty, mine: [{ slug: "champion", note: "Won the hill climb", at: "2026-09-30T18:00:00Z" }] });
    expect(L[0]).toMatchObject({ slug: "champion", on: true, given: { note: "Won the hill climb", at: "2026-09-30T18:00:00Z" } });
    expect(L.filter((x) => x.slug === "champion")).toHaveLength(1);
  });
  it("leave out a badge the catalogue no longer lists, unless the rider holds it", () => {
    const cat = [{ slug: "first_lap" }, { slug: "regular" }];
    expect(list({ ...empty, catalog: cat }).map((x) => x.slug)).toEqual(["first_lap", "front_row", "streak", "regular"]);
  });
  it("count Race Ready from the profile", () => {
    const full = { name: "A", email: "a@b.c", phone: "+966500000000", height: 170, birth_date: "1990-01-01", country: "SA", city: "Jeddah", photo: "x", type_preference: "Road" };
    expect(profilePct(full)).toBe(100);
    expect(profilePct({ ...full, type_preference: "Any", photo: null })).toBe(78);
    expect(list(empty, rows, ses, full)[0]).toMatchObject({ slug: "complete_profile", on: true, color: "special" });
  });
  it("say when a dated badge opens", () => {
    const season = { slug: "winter_series", rule: { rides: 6, windows: [{ from: "12-01", to: "02-29" }] } };
    expect(list({ ...empty, seasons: [season] }).find((x) => x.slug === "winter_series")).toMatchObject({ on: false, p: "0/6", season: { curTo: null, next: "2026-12-01" } });
  });
  it("bring the two begun with the least left forward", () => {
    expect(closestBadges(list()).map((x) => [x.item.slug, x.n, x.of])).toEqual([["regular", 4, 5], ["safety_car", 4, 6]]);
    expect(closestBadges(list({ ...empty, mine: [{ slug: "regular" }] })).map((x) => x.item.slug)).not.toContain("regular");
  });
  it("do not count an unpaid ride, unless the ride was free", () => {
    const unpaid = recordRows([row({ session_id: "s1", session_date: "2026-09-01", paid: false })]);
    expect(unpaid).toHaveLength(1);
    expect(badgeList(unpaid, new Map([["s1", { kind: "jcc", freeRide: false }]]), empty, today, null).find((x) => x.slug === "first_lap")!.on).toBe(false);
    expect(badgeList(unpaid, new Map([["s1", { kind: "saturday", freeRide: true }]]), empty, today, null).find((x) => x.slug === "first_lap")!.on).toBe(true);
  });
  it("break a clean sheet on a no-show, and count add-ons for Fuel Stop", () => {
    const r = recordRows([row({ session_id: "2026-09-01" }), row({ session_id: "2026-09-08", status: "noshow" }), row({ session_id: "2026-09-15", addons: '[{"id":"w","qty":1}]' })]);
    const s = new Map<string, RecordSession>(r.map((x) => [x.sessionId, { kind: "jcc", freeRide: false }]));
    const L = badgeList(r, s, empty, today, null);
    expect(L.find((x) => x.slug === "clean_sheet")!.p).toBe("1/10");
    expect(L.find((x) => x.slug === "fuel")!.on).toBe(true);
  });
  it("count the Saturday social ride ladder: 1, 5, 10, 25, 50 and 100 ride days", () => {
    const sat = new Map<string, RecordSession>(rows.map((r) => [r.sessionId, { kind: "saturday", freeRide: true }]));
    const L = list(empty, rows, sat);
    const at = (slug: string) => L.find((x) => x.slug === slug);
    expect(at("rolling_start")).toMatchObject({ on: true, p: "1/1", color: "teal" });
    expect(at("slipstream")).toMatchObject({ on: false, p: "4/5" });
    expect(at("paceline")).toMatchObject({ on: false, p: "4/10" });
    expect(at("peloton")).toMatchObject({ on: false, p: "4/25" });
    expect(at("grand_tour")).toMatchObject({ on: false, p: "4/50", color: "purple" });
    expect(at("hall_of_fame")).toMatchObject({ on: false, p: "4/100", color: "special" });
    expect(list().find((x) => x.slug === "rolling_start")).toMatchObject({ on: false, p: "0/1" }); // circuit nights do not count
  });
  it("give Front Row only where the number is shown", () => {
    const appr = new Map<string, RecordSession>(rows.map((r) => [r.sessionId, { kind: "saturday", freeRide: true, approval: true }]));
    expect(list(empty, rows, appr).find((x) => x.slug === "front_row")!.on).toBe(false);
  });
});

describe("your rides", () => {
  it("count nights, the favourite type, the time on the bike and the first ride", () => {
    const rows = recordRows([
      row({ session_id: "2026-09-29", queue_num: 7, ride_duration: 50 }), row({ id: "p2", session_id: "2026-09-29", queue_num: 8, type_preference: "Hybrid", ride_duration: 50 }),
      row({ session_id: "2026-09-15", ride_duration: 70 }), row({ session_id: "2025-12-01", type_preference: "Hybrid" }),
    ]);
    const s = rideStats(rows, new Map(), today)!;
    expect(s).toMatchObject({ year: 2, fav: "Road", minutes: 120, first: "2025-12-01", nWeeks: 2 });
    expect(s.weeks).toHaveLength(26);
    expect(s.weeks[25]).toBe(true);
    expect(rideStats(recordRows([row({ session_id: "x", status: "waiting" })]), new Map(), today)).toBeNull();
  });
});
