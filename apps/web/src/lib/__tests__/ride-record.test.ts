import { describe, expect, it } from "vitest";
import { badgeProgress, closestBadges, perfectWeeks, recordRows, rideStats, seasonProgress, weekRuns, weekStreak, type BadgeData, type RecordSession } from "../ride-record";

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

describe("the closest badges", () => {
  const rows = recordRows(["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"].map((d) => row({ session_id: d })));
  const ses = new Map<string, RecordSession>(rows.map((r) => [r.sessionId, { kind: "jcc", freeRide: false }]));
  it("are the two begun with the least left", () => {
    const c = closestBadges(badgeProgress(rows, ses, empty, today));
    expect(c.map((x) => [x.slug, x.n, x.of])).toEqual([["regular", 4, 5], ["safety_car", 4, 6]]);
  });
  it("leave out one staff gave, and one the catalogue retired", () => {
    const given = closestBadges(badgeProgress(rows, ses, { ...empty, mine: [{ slug: "regular" }] }, today));
    expect(given.map((x) => x.slug)).not.toContain("regular");
    const cat = closestBadges(badgeProgress(rows, ses, { ...empty, catalog: [{ slug: "podium" }, { slug: "regular" }] }, today));
    expect(cat.map((x) => x.slug)).toEqual(["regular", "podium"]);
  });
  it("do not count an unpaid ride, unless the ride was free", () => {
    const unpaid = recordRows([row({ session_id: "s1", session_date: "2026-09-01", paid: false })]);
    expect(unpaid).toHaveLength(1);
    expect(badgeProgress(unpaid, new Map([["s1", { kind: "jcc", freeRide: false }]]), empty, today).find((p) => p.slug === "first_lap")!.on).toBe(false);
    expect(badgeProgress(unpaid, new Map([["s1", { kind: "saturday", freeRide: true }]]), empty, today).find((p) => p.slug === "first_lap")!.on).toBe(true);
  });
  it("break a clean sheet on a no-show", () => {
    const r = recordRows([row({ session_id: "2026-09-01" }), row({ session_id: "2026-09-08", status: "noshow" }), row({ session_id: "2026-09-15" })]);
    const s = new Map<string, RecordSession>(r.map((x) => [x.sessionId, { kind: "jcc", freeRide: false }]));
    expect(badgeProgress(r, s, empty, today).find((p) => p.slug === "clean_sheet")!.n).toBe(1);
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
