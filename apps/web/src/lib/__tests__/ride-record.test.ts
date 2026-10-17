import { describe, expect, it } from "vitest";
import { badgeList, climb, closestBadges, perfectWeeks, profilePct, recordRows, rideStats, seasonProgress, weekRuns, weekStreak, type BadgeData, type RecordSession } from "../ride-record";
import Medal from "@/components/account/Medal";
import RideRecord from "@/components/account/RideRecord";
import { T as RECORD } from "@/components/account/RideRecord.text";
import { createElement, type ReactElement } from "react";
// The site has no @types/react-dom; this test needs one function of it (as rating.test.ts does).
// @ts-expect-error -- react-dom/server ships without type declarations here
import { renderToStaticMarkup as renderUntyped } from "react-dom/server";

const renderToStaticMarkup = renderUntyped as (el: ReactElement) => string;

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
    // four nights first in the queue, all ridden: Front Row, one short of Pole Position (5 since 2026-10-12)
    expect(on()).toEqual(["first_lap", "front_row", "streak"]);
    // Grid Regular is First Lap's next level: the ladder's one tile counts towards it
    expect(list().find((x) => x.slug === "first_lap")).toMatchObject({ on: true, lvN: 1, p: "4/5", nx: { slug: "regular", on: false, p: "4/5" } });
  });
  it("keep National Day 96 and Back on Track out until earned, and staff's own badges last", () => {
    const slugs = list().map((x) => x.slug);
    expect(slugs).not.toContain("national_day_96");
    expect(slugs).not.toContain("back_on_track");
    // the T100 races are one ladder, where its first level stood (T100, the list's order), shown as T25 until one is given
    // and so is each badge staff give with its levels (2026-10-12), shown as its first level until one is given
    expect(slugs.slice(-9)).toEqual(["marshal", "pit_crew", "green_flag", "super_licence", "scrutineer", "champion", "spirit", "t25", "bike_owner"]);
  });
  it("put a badge staff gave first, with their note and the day", () => {
    const L = list({ ...empty, mine: [{ slug: "champion", note: "Won the hill climb", at: "2026-09-30T18:00:00Z" }] });
    expect(L[0]).toMatchObject({ slug: "champion", on: true, given: { note: "Won the hill climb", at: "2026-09-30T18:00:00Z" } });
    expect(L.filter((x) => x.slug === "champion")).toHaveLength(1);
  });
  it("leave out a badge the catalogue no longer lists, unless the rider holds it", () => {
    const cat = [{ slug: "first_lap" }, { slug: "regular" }];
    expect(list({ ...empty, catalog: cat }).map((x) => x.slug)).toEqual(["first_lap", "front_row", "streak"]);
    expect(list({ ...empty, catalog: cat })[0].lv!.map((x) => x.slug)).toEqual(["first_lap", "regular"]);
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
    expect(closestBadges(list()).map((x) => [x.show.slug, x.n, x.of])).toEqual([["regular", 4, 5], ["pole_position", 4, 5]]);
    expect(closestBadges(list({ ...empty, mine: [{ slug: "regular" }] })).map((x) => x.show.slug)).not.toContain("regular");
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
    // one ladder (2026-10-09 badge ladders): the top level reached, and the next level's progress
    const c = L.find((x) => x.lv?.some((y) => y.slug === "rolling_start"))!;
    expect(c).toMatchObject({ slug: "rolling_start", on: true, color: "teal", lvN: 1, p: "4/5", nx: { slug: "slipstream" } });
    expect(c.lv!.map((x) => [x.slug, x.on, x.color])).toEqual([["rolling_start", true, "teal"], ["slipstream", false, expect.any(String)],
      ["paceline", false, expect.any(String)], ["peloton", false, expect.any(String)], ["grand_tour", false, "purple"], ["hall_of_fame", false, "special"]]);
    // circuit nights do not count: the ladder is not begun
    expect(list().find((x) => x.lv?.some((y) => y.slug === "rolling_start"))).toMatchObject({ slug: "rolling_start", on: false, lvN: 0, p: "0/1" });
  });
  it("give Front Row only where the number is shown", () => {
    const appr = new Map<string, RecordSession>(rows.map((r) => [r.sessionId, { kind: "saturday", freeRide: true, approval: true }]));
    expect(list(empty, rows, appr).find((x) => x.slug === "front_row")!.on).toBe(false);
  });
});

describe("the distance ladder (the booking app, 2026-10-16)", () => {
  // the longest Saturday ride ridden: 20 Beginners, 40 Intermediates, or the ride's own - never the rides added up
  const km = (spec: [string | null, string?, { beg: number; int: number }?][]) => {
    const r = recordRows(spec.map(([g, status], i) => row({ session_id: `2026-09-${String(i + 1).padStart(2, "0")}`, ride_group: g, status: status ?? "done" })));
    const s = new Map<string, RecordSession>(r.map((x, i) => [x.sessionId, { kind: "saturday", freeRide: true, groupKm: spec[i][2] }]));
    const top = badgeList(r, s, empty, today, null).find((x) => x.slug.startsWith("km"))!;
    return [top.lvN, top.p];
  };
  it("gives 20 km Club for a Beginners ride and 40 km Club for an Intermediates one", () => {
    expect(km([["beg"]])).toEqual([1, "20/40"]);
    expect(km([["int"]])).toEqual([2, "40/70"]);
    expect(km([["beg", "waiting"]])).toEqual([0, "0/20"]);
  });
  it("takes the longest one ride, never the total: no group rides the Beginners' 20, a ride's own distance counts", () => {
    expect(km([["beg"], ["beg"], [null]])).toEqual([1, "20/40"]);
    expect(km([["int"], ["int"], ["beg"]])).toEqual([2, "40/70"]);
    expect(km([["int", "done", { beg: 20, int: 35 }]])).toEqual([1, "35/40"]);
    expect(km([["int", "done", { beg: 20, int: 100 }]])).toEqual([4, null]);
  });
  it("counts any bike ride on any day by the distance staff gave it, and never a run (2026-10-17)", () => {
    const one = (kind: RecordSession["kind"], dist?: number, status = "done") => {
      const r = recordRows([row({ session_id: "2026-09-02", status })]);
      const top = badgeList(r, new Map([[r[0].sessionId, { kind, freeRide: false, km: dist }]]), empty, today, null).find((x) => x.slug.startsWith("km"))!;
      return [top.lvN, top.p];
    };
    expect(one("jcc")).toEqual([0, "0/20"]);
    expect(one("jcc", 45)).toEqual([2, "45/70"]);
    expect(one("petromin", 72)).toEqual([3, "72/100"]);
    expect(one("jcc", 45, "noshow")).toEqual([0, "0/20"]);
    expect(one("runher", 30)).toEqual([0, "0/20"]);
  });
});

describe("badge ladders (the booking app's _bdgFold, 2026-10-09)", () => {
  const days = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 0, 3 + 7 * i)).toISOString().slice(0, 10));
  const rides = (n: number, kind: RecordSession["kind"] = "jcc") => {
    const r = recordRows(days(n).map((d) => row({ session_id: d })));
    return { r, s: new Map<string, RecordSession>(r.map((x) => [x.sessionId, { kind, freeRide: kind === "saturday" }])) };
  };
  it("fold each ladder into one badge: the top level reached, its levels and the next one's progress", () => {
    const { r, s } = rides(12);
    const L = badgeList(r, s, empty, today, null), laps = L.find((x) => x.slug === "podium")!;
    expect(L.filter((x) => ["first_lap", "regular", "podium", "corniche25"].includes(x.slug))).toHaveLength(1);
    expect(laps).toMatchObject({ on: true, lvN: 3, p: "12/25", nx: { slug: "corniche25" } });
    expect(laps.lv!.map((x) => [x.slug, x.on])).toEqual([["first_lap", true], ["regular", true], ["podium", true], ["corniche25", false]]);
    // the count counts each ladder once
    expect(L.map((x) => x.slug)).not.toContain("regular");
  });
  it("show a ladder not begun as its first level, with nothing reached", () => {
    const L = badgeList([], new Map(), empty, today, null), t = L.find((x) => x.slug === "t25")!;
    expect(t).toMatchObject({ on: false, lvN: 0, nx: { slug: "t25" }, manual: true });
    expect(t.lv!.map((x) => x.slug)).toEqual(["t25", "t50", "t100"]);
  });
  it("give every level under one staff gave (T100 brings T50 and T25)", () => {
    const L = badgeList([], new Map(), { ...empty, mine: [{ slug: "t100", note: "Sub 4 hours", at: "2026-10-09T10:00:00Z" }] }, today, null);
    const t = L[0];
    expect(t).toMatchObject({ slug: "t100", on: true, lvN: 3, nx: null, p: null, given: { note: "Sub 4 hours" } });
    expect(t.lv!.map((x) => [x.slug, x.on])).toEqual([["t25", true], ["t50", true], ["t100", true]]);
    expect(L.filter((x) => x.slug.startsWith("t") && /^t\d/.test(x.slug))).toHaveLength(1);
    expect(closestBadges(L).map((x) => x.item.slug)).not.toContain("t100");
  });
  it("climb a ride ladder from a level staff gave, whatever was ridden", () => {
    const L = badgeList([], new Map(), { ...empty, mine: [{ slug: "podium" }] }, today, null), laps = L.find((x) => x.slug === "podium")!;
    expect(laps).toMatchObject({ on: true, lvN: 3, nx: { slug: "corniche25", p: "0/25" } });
    expect(laps.lv!.slice(0, 2).every((x) => x.on)).toBe(true);
  });
  it("count Saturday rides up the community ladder: 1, 5, 10, 25, 50, 100", () => {
    const { r, s } = rides(6, "saturday");
    const c = badgeList(r, s, empty, today, null).find((x) => x.lv?.some((y) => y.slug === "rolling_start"))!;
    expect(c.lv!.map((x) => x.slug)).toEqual(["rolling_start", "slipstream", "paceline", "peloton", "grand_tour", "hall_of_fame"]);
    expect(c).toMatchObject({ slug: "slipstream", lvN: 2, p: "6/10", nx: { slug: "paceline" } });
    expect(closestBadges([c])[0]).toMatchObject({ show: { slug: "paceline" }, n: 6, of: 10 });
  });
  it("draw a ladder as one tile with a dot per level, and its next level among the closest", () => {
    const { r, s } = rides(9, "saturday");
    const html = renderToStaticMarkup(createElement(RideRecord, { locale: "en", stats: null, badges: badgeList(r, s, empty, today, null), t: RECORD.en, typeName: (x: string) => x, dur: { h: "{h} h", hm: "{h} h {m} min", m: "{m} min" } }));
    expect(html).toContain('aria-label="Slipstream · Level 2 of 6: 5 community rides"');
    expect(html).toMatch(/<span class="mr-badge-lv" aria-hidden="true">(<i class="on"><\/i>){2}(<i><\/i>){4}<\/span>/);
    // nine nights first in the queue, too: Pole Master (10 since 2026-10-12) is one away, as Paceline is, and comes first
    expect(html.match(/<strong>[^<]*<\/strong>/g)).toEqual(["<strong>Podium Pace</strong>", "<strong>Pole Master</strong>"]);
  });
  it("count Front Row's levels in nights first in the queue and ridden: 1, 5, 10, 25, 50", () => {
    const front = (r: ReturnType<typeof recordRows>, kind: RecordSession["kind"] = "jcc", freeRide = false) =>
      badgeList(r, new Map(r.map((x) => [x.sessionId, { kind, freeRide }])), empty, today, null).find((x) => x.lv?.some((y) => y.slug === "front_row"))!;
    const first = (n: number, o: Record<string, unknown> = {}) => recordRows(days(n).map((d) => row({ session_id: d, ...o })));
    expect(front(first(1))).toMatchObject({ slug: "front_row", on: true, lvN: 1, p: "1/5", nx: { slug: "pole_position" } });
    expect(front(first(4))).toMatchObject({ slug: "front_row", lvN: 1, p: "4/5" });
    expect(front(first(5))).toMatchObject({ slug: "pole_position", lvN: 2, p: "5/10", nx: { slug: "pole_master" } });
    expect(front(first(10))).toMatchObject({ slug: "pole_master", lvN: 3, p: "10/25", nx: { slug: "grid_leader" } });
    expect(front(first(25))).toMatchObject({ slug: "grid_leader", lvN: 4, p: "25/50", nx: { slug: "pole_legend" } });
    expect(front(first(50))).toMatchObject({ slug: "pole_legend", lvN: 5, nx: null, p: null, color: "special" });
    expect(front(first(50)).lv!.map((x) => [x.slug, x.on])).toEqual([["front_row", true], ["pole_position", true], ["pole_master", true], ["grid_leader", true], ["pole_legend", true]]);
    // booking #1 alone is not enough: unpaid, not yet ridden or a no-show never count
    for (const o of [{ paid: false }, { status: "waiting" }, { status: "active" }, { status: "noshow" }]) expect(front(first(5, o)), JSON.stringify(o)).toMatchObject({ on: false, lvN: 0, p: "0/1" });
    // a free ride counts unpaid, and an own bike counts once checked in
    expect(front(first(5, { paid: false }), "saturday", true)).toMatchObject({ slug: "pole_position", lvN: 2 });
    expect(front(first(1, { paid: false, status: "active", type_preference: "Own" }))).toMatchObject({ slug: "front_row", on: true });
    // a later number on the night is not first in the queue, and a party's rows are one night
    expect(front(first(5, { queue_num: 2 }))).toMatchObject({ on: false, p: "0/1" });
    const party = recordRows([row({ session_id: "2026-09-01" }), row({ id: "p2", session_id: "2026-09-01" })]);
    expect(front(party)).toMatchObject({ slug: "front_row", lvN: 1, p: "1/5" });
  });
  it("give every level under one staff gave on a staff ladder (Carbon Owner brings Road Bike Owner and Bike Owner)", () => {
    const L = badgeList([], new Map(), { ...empty, mine: [{ slug: "carbon_owner", note: "Bought in October" }] }, today, null);
    expect(L[0]).toMatchObject({ slug: "carbon_owner", on: true, lvN: 3, nx: null, icon: "bike", color: "special", given: { note: "Bought in October" } });
    expect(L[0].lv!.map((x) => [x.slug, x.on])).toEqual([["bike_owner", true], ["road_owner", true], ["carbon_owner", true]]);
    expect(L.filter((x) => ["bike_owner", "road_owner", "carbon_owner"].includes(x.slug))).toHaveLength(1);
    const m = badgeList([], new Map(), { ...empty, mine: [{ slug: "senior_marshal" }] }, today, null).find((x) => x.lv?.some((y) => y.slug === "marshal"))!;
    expect(m).toMatchObject({ slug: "senior_marshal", on: true, lvN: 2, nx: { slug: "chief_marshal", on: false } });
    expect(m.lv!.map((x) => x.slug)).toEqual(["marshal", "senior_marshal", "chief_marshal", "clerk_of_course", "race_director"]);
    expect([...climb(["carbon_owner", "grand_champion"])].sort()).toEqual(["bike_owner", "carbon_owner", "champion", "grand_champion", "hat_trick", "road_owner"]);
    // five levels on each of the seven ladders (2026-10-12): the top one brings all four under it
    expect([...climb(["world_champion", "race_director"])].sort()).toEqual(["champion", "chief_marshal", "clerk_of_course", "dynasty", "grand_champion", "hat_trick", "marshal", "race_director", "senior_marshal", "world_champion"]);
    const w = badgeList([], new Map(), { ...empty, mine: [{ slug: "world_champion" }] }, today, null)[0];
    expect(w).toMatchObject({ slug: "world_champion", lvN: 5, nx: null, icon: "trophy", color: "special" });
    expect(w.lv!.find((x) => x.slug === "grand_champion")).toMatchObject({ color: "red" });
  });
  it("climb a set of slugs held", () => {
    expect([...climb(["t100", "marshal"])].sort()).toEqual(["marshal", "t100", "t25", "t50"]);
    expect([...climb(["perfect_month"])].sort()).toEqual(["perfect_month", "perfect_week"]);
    expect([...climb(["first_lap"])]).toEqual(["first_lap"]);
  });
});

describe("Run for Her's pink ribbon (run_for_her, 2026-10-05)", () => {
  // A finished run is a done row on a session of kind 'runher' (event_kind 'community', ride_kind 'runher').
  const DAYS = ["2026-08-08", "2026-08-15", "2026-08-22", "2026-08-29", "2026-09-05"];
  const runRows = (status: string, n = 1) => recordRows(DAYS.slice(0, n).map((d) => row({ session_id: `${d}-rh`, session_date: d, status, paid: false, type_preference: "None", run_km: 5 })));
  const runSes = (rows: { sessionId: string }[]) => new Map<string, RecordSession>(rows.map((r) => [r.sessionId, { kind: "runher", freeRide: true, approval: false }]));
  const catalog = [{ slug: "run_for_her", icon: "ribbon", color: "red", system: true, auto: true }, { slug: "first_lap", system: true, auto: true }, { slug: "slipstream", system: true, auto: true }];
  it("stays hidden until a run is finished (done), then shows as the pink ribbon", () => {
    for (const status of ["waiting", "waitlist", "active", "noshow"]) {
      const r = runRows(status);
      expect(badgeList(r, runSes(r), empty, today, null).map((x) => x.slug), status).not.toContain("run_for_her");
    }
    const done = runRows("done");
    const b = badgeList(done, runSes(done), empty, today, null).find((x) => x.slug === "run_for_her");
    expect(b).toMatchObject({ on: true, icon: "ribbon", color: "pink" });
  });
  it("is drawn on the pink medal even though the badges table holds it as red", () => {
    const done = runRows("done");
    expect(badgeList(done, runSes(done), { ...empty, catalog }, today, null).find((x) => x.slug === "run_for_her")).toMatchObject({ on: true, icon: "ribbon", color: "pink" });
    expect(badgeList(recordRows([row({ session_id: "2026-09-01" })]), new Map([["2026-09-01", { kind: "jcc", freeRide: false }]]), { ...empty, catalog }, today, null).map((x) => x.slug)).not.toContain("run_for_her");
  });
  it("is not earned on a ride of another kind, and a run never counts towards the Saturday ladder", () => {
    const sat = recordRows([row({ session_id: "2026-09-05" })]);
    expect(badgeList(sat, new Map([["2026-09-05", { kind: "saturday", freeRide: true }]]), empty, today, null).map((x) => x.slug)).not.toContain("run_for_her");
    const runs = runRows("done", 5);
    const L = badgeList(runs, runSes(runs), empty, today, null);
    // not earned, and nothing counted (the ladder's thresholds are the Saturday badges' own business)
    for (const slug of ["rolling_start", "slipstream", "paceline"]) {
      const b = L.flatMap((x) => x.lv ?? [x]).find((x) => x.slug === slug);
      expect(b).toMatchObject({ on: false });
      expect(String(b?.p)).toMatch(/^0\//);
    }
    // a finished run is still a ride finished, as in the booking app
    expect(L.flatMap((x) => x.lv ?? [x]).find((x) => x.slug === "first_lap")!.on).toBe(true);
  });
  it("is drawn as the booking app draws it: the ribbon on the pink special medal", () => {
    const svg = renderToStaticMarkup(createElement(Medal, { icon: "ribbon", color: "pink" }));
    expect(svg).toContain("bdg-sp");
    for (const c of ["#ffc9da", "#f2789f", "#c2416e", "#a3325b"]) expect(svg).toContain(c);
    expect(svg).toContain('class="rb o"');
  });
  it("does not make the distance a favourite bike", () => {
    const runs = runRows("done", 2);
    expect(rideStats(runs, runSes(runs), today)).toMatchObject({ fav: null });
    expect(runs.map((r) => r.runKm)).toEqual([5, 5]);
  });
});

describe("Victory Lap's lap ring (victory_lap, 2026-10-17)", () => {
  // A finished race is a done row on a session of kind 'vlap' (checked out, or the session closed out).
  const vlRows = (status: string) => recordRows([row({ session_id: "2026-10-26-vl", session_date: "2026-10-26", status, paid: true, type_preference: "None", vl: { race: "ws", div: "so", shirt: "S" } })]);
  const vlSes = (rows: { sessionId: string }[]) => new Map<string, RecordSession>(rows.map((r) => [r.sessionId, { kind: "vlap", freeRide: false, approval: false }]));
  it("stays hidden until the race is finished (done), then shows as the lap ring", () => {
    for (const status of ["waiting", "waitlist", "active", "noshow"]) {
      const r = vlRows(status);
      expect(badgeList(r, vlSes(r), empty, "2026-10-27", null).map((x) => x.slug), status).not.toContain("victory_lap");
    }
    const done = vlRows("done");
    expect(badgeList(done, vlSes(done), empty, "2026-10-27", null).find((x) => x.slug === "victory_lap")).toMatchObject({ on: true, icon: "lapring", color: "vlap" });
    // whatever colour the badges table holds it in
    const catalog = [{ slug: "victory_lap", icon: "medal", color: "purple", system: true, auto: true }];
    expect(badgeList(done, vlSes(done), { ...empty, catalog }, "2026-10-27", null).find((x) => x.slug === "victory_lap")).toMatchObject({ on: true, icon: "lapring", color: "vlap" });
  });
  it("is not earned on any other kind, and the race never counts towards the Saturday ladder or a distance badge", () => {
    const sat = recordRows([row({ session_id: "2026-09-05" })]);
    expect(badgeList(sat, new Map([["2026-09-05", { kind: "saturday", freeRide: true }]]), empty, today, null).map((x) => x.slug)).not.toContain("victory_lap");
    const done = vlRows("done");
    const L = badgeList(done, vlSes(done), empty, "2026-10-27", null).flatMap((x) => x.lv ?? [x]);
    expect(L.find((x) => x.slug === "rolling_start")).toMatchObject({ on: false });
    expect(L.find((x) => x.slug === "km20")).toMatchObject({ on: false });
  });
  it("is drawn as the booking app draws it: the lap ring on the purple-into-black special medal", () => {
    const svg = renderToStaticMarkup(createElement(Medal, { icon: "lapring", color: "vlap" }));
    expect(svg).toContain("bdg-sp");
    for (const c of ["#b9a6ff", "#5b3fd6", "#1b1236", "#140c2e"]) expect(svg).toContain(c);
    expect(svg).toContain('r="8.4"');
    expect(RECORD.en.names.victory_lap[0]).toBe("Victory Lap");
    expect(RECORD.ar.names.victory_lap[0]).toBe("فيكتوري لاب");
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

describe("the booking app's paid and checked-in rules (bh14)", () => {
  const jcc = (r: { sessionId: string }[]) => new Map<string, RecordSession>(r.map((x) => [x.sessionId, { kind: "jcc", freeRide: false }]));
  const on = (r: ReturnType<typeof recordRows>, slug: string) => badgeList(r, jcc(r), empty, today, null).flatMap((x) => x.lv ?? [x]).find((x) => x.slug === slug)!.on;
  it("count a ride on the rider's own bike, never paid for, as ridden (_rideCompleted, _bdgRode)", () => {
    const own = recordRows([row({ session_id: "2026-09-01", paid: false, type_preference: "Own" })]);
    expect(on(own, "first_lap")).toBe(true);
    expect(rideStats(own, jcc(own), today)).toMatchObject({ first: "2026-09-01", fav: null });
    expect(on(recordRows([row({ session_id: "2026-09-01", paid: false })]), "first_lap")).toBe(false);
  });
  it("give Squad Captain only when every rider of the night is checked in and paid", () => {
    const night = (o: Record<string, unknown> = {}) => recordRows([row({ session_id: "2026-09-02" }), row({ id: "n2", session_id: "2026-09-02" }), row({ id: "n3", session_id: "2026-09-02", ...o })]);
    expect(on(night(), "squad")).toBe(true);
    for (const o of [{ status: "waiting" }, { status: "noshow" }, { paid: false }]) expect(on(night(o), "squad"), JSON.stringify(o)).toBe(false);
    expect(on(night({ paid: false, type_preference: "Own" }), "squad")).toBe(true);
  });
  it("give Fuel Stop only for add-ons paid for, Carbon only for a ride paid for", () => {
    const fuel = (o: Record<string, unknown>) => on(recordRows([row({ session_id: "2026-09-03", addons: [{ id: "w", qty: 1, p: 10 }], ...o })]), "fuel");
    expect(fuel({})).toBe(true);
    expect(fuel({ paid: false })).toBe(false);
    expect(fuel({ status: "waiting" })).toBe(false);
    expect(fuel({ addons: [{ id: "w", qty: 1, p: 0 }] })).toBe(false); // an extra at no cost
    expect(fuel({ price: 0 })).toBe(false); // on the house
    expect(fuel({ price: 0, promo_code: "FREE10" })).toBe(true);
    expect(on(recordRows([row({ session_id: "2026-09-04", type_preference: "Road Carbon", paid: false })]), "carbon")).toBe(false);
    expect(on(recordRows([row({ session_id: "2026-09-04", type_preference: "Road Carbon" })]), "carbon")).toBe(true);
  });
});
