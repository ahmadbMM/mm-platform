// A rider's record on My Account, as the booking app's account page reads it (91816da, 2026-10-01):
// Your rides (_myrStats) and the two closest badges (bd-next in _mrBadgesRow), worked out from the
// account's own my_bookings rows with the booking app's rules (_mrBadges, _bdgRuns, _bdgSeason,
// _bdgPerfect, _mrStreak). Plain logic, so it can be tested; the data comes from lib/ride-record-data.ts.
import { rideCompleted, ticketRow, type TicketRow } from "./tickets";
import type { RideKind } from "./rides";

/** What the record needs of a session: its kind, and whether it costs nothing (_isFreeRide). */
export type RecordSession = { kind: RideKind; freeRide: boolean };
/** A badge as badge_catalog / badge_seasons / customer_my_badges hand it back. */
export type BadgeRow = {
  slug: string; icon?: string | null; color?: string | null; system?: boolean | null; auto?: boolean | null;
  name?: string | null; name_ar?: string | null; description?: string | null; description_ar?: string | null;
  rule?: { rides?: number; windows?: { from?: string; to?: string }[] } | null;
};
export type BadgeData = { catalog: BadgeRow[]; weeks: { w: string; ids: string[] }[] | null; seasons: BadgeRow[]; mine: BadgeRow[] };

/** The app's own badges: [glyph, colour, the text's key] (BD_SYS), for the ones a ride earns. */
export const BADGE_SYS: Record<string, [string, string, string]> = {
  first_lap: ["flag", "green", "firstLap"], regular: ["wheel", "teal", "regular"], podium: ["podium", "purple", "podium"],
  streak: ["flame", "orange", "streak"], corniche25: ["wave", "blue", "corniche25"], safety_car: ["beacon", "orange", "safetyCar"],
  endurance: ["clock", "purple", "endurance"], triple_crown: ["crown", "gold", "tripleCrown"], clean_sheet: ["calcheck", "green", "cleanSheet"],
  slipstream: ["wind", "green", "slipstream"], paceline: ["wind", "blue", "paceline"], peloton: ["wind", "gold", "peloton"],
  works_team: ["briefcase", "teal", "worksTeam"], perfect_week: ["calstar", "purple", "perfectWeek"], perfect_month: ["calcrown", "gold", "perfectMonth"],
  winter_series: ["snow", "blue", "winterSeries"], ramadan_nights: ["lantern", "purple", "ramadanNights"], founding_day: ["fort", "orange", "foundingDay"],
};

/** Weeks since 1970 on the rides' calendar, Sunday first (_bdgWk), from a YYYY-MM-DD. */
export const weekOf = (ds: string) => Math.floor((Date.parse(`${ds.slice(0, 10)}T00:00:00Z`) / 864e5 + 4) / 7);

/** The longest run of ridden weeks, strict (best) and with one quiet week in any four forgiven
 *  (bestS), and the forgiving run still going (curS); this week is never a miss (_bdgRuns). */
export function weekRuns(dates: string[], today: string): { best: number; bestS: number; curS: number } {
  const W = new Set(dates.map(weekOf).filter(Number.isFinite)), now = weekOf(today);
  let best = 0, run = 0, bestS = 0, start: number | null = null, last: number | null = null, miss: number | null = null;
  for (let w = W.size ? Math.min(...W) : now + 1; w <= now; w++) {
    if (W.has(w)) { run++; best = Math.max(best, run); if (start == null) start = w; last = w; bestS = Math.max(bestS, last - start + 1); continue; }
    run = 0; if (w === now) break;
    if (start != null && (miss == null || w - miss >= 4)) miss = w; else start = miss = null;
  }
  return { best, bestS, curS: start != null && last != null ? last - start + 1 : 0 };
}

/** Consecutive ridden weeks counted back from this week, or last week (_mrStreak). */
export function weekStreak(dates: string[], today: string): number {
  const W = new Set(dates.map(weekOf)), now = weekOf(today);
  let w = W.has(now) ? now : W.has(now - 1) ? now - 1 : null;
  if (w == null) return 0;
  let n = 0;
  while (W.has(w)) { n++; w--; }
  return n;
}

/** A dated badge's rule (_bdgSeason): YYYY-MM-DD windows once, MM-DD every year. */
export function seasonProgress(rule: BadgeRow["rule"], dates: string[], today: string): { on: boolean; rides: number; cur: number | null } {
  const rides = Math.min(99, Math.max(1, Number(rule?.rides) || 1)), inst: [string, string][] = [];
  const y1 = Number(today.slice(0, 4)), y0 = Math.min(y1, ...dates.map((d) => Number(d.slice(0, 4))).filter(Boolean)) - 1;
  for (const w of rule?.windows ?? []) {
    const f = String(w?.from ?? ""), to = String(w?.to ?? "");
    if (/^\d{4}-\d\d-\d\d$/.test(f) && /^\d{4}-\d\d-\d\d$/.test(to)) inst.push([f, to]);
    else if (/^\d\d-\d\d$/.test(f) && /^\d\d-\d\d$/.test(to)) for (let y = y0; y <= y1 + 1; y++) inst.push([`${y}-${f}`, `${to < f ? y + 1 : y}-${to}`]);
  }
  let best = 0, cur: number | null = null;
  for (const [f, to] of inst) {
    const n = dates.filter((d) => d >= f && d <= to).length;
    best = Math.max(best, n);
    if (today >= f && today <= to) cur = n;
  }
  return { on: best >= rides, rides, cur };
}

/** Perfect Week and Perfect Month (_bdgPerfect): every session of a week (two or more) ridden. */
export function perfectWeeks(weeks: BadgeData["weeks"], rodeIds: Set<string>, today: string) {
  const W = weeks ? weeks.filter((w) => w && w.w && Array.isArray(w.ids) && w.ids.length >= 2) : null;
  if (!W) return { known: false, any: false, run: 0, best: 0, cur: null as { n: number; of: number } | null };
  const now = weekOf(today);
  let run = 0, best = 0, any = false, cur: { n: number; of: number } | null = null;
  for (const w of W.map((x) => ({ k: weekOf(x.w), ids: x.ids })).filter((x) => x.k <= now).sort((a, b) => a.k - b.k)) {
    const n = w.ids.filter((id) => rodeIds.has(id)).length, full = n === w.ids.length;
    if (w.k === now) cur = { n, of: w.ids.length };
    if (full) { any = true; run++; best = Math.max(best, run); } else if (w.k < now) run = 0;
  }
  return { known: true, any, run, best, cur };
}

export type Progress = { slug: string; on: boolean; n: number; of: number; row: BadgeRow | null };

/** The ride badges a count can show progress on, earned or not (the counting part of _mrBadges).
 *  Rides are rows, as the booking app's first counts are; the badges of 2026-09-29 count nights. */
export function badgeProgress(rows: TicketRow[], sessions: Map<string, RecordSession>, data: BadgeData, today: string): Progress[] {
  const ses = (id: string) => sessions.get(id);
  const completed = rows.filter((r) => rideCompleted(r, !!ses(r.sessionId)?.freeRide));
  const rides = completed.length;
  const night = new Map<string, { d: string; done: boolean; noshow: boolean }>();
  for (const r of rows) {
    const n = night.get(r.sessionId) ?? { d: r.date, done: false, noshow: false };
    if (rideCompleted(r, !!ses(r.sessionId)?.freeRide)) n.done = true;
    else if (String(r.status) === "noshow") n.noshow = true;
    night.set(r.sessionId, n);
  }
  const nights = [...night.entries()].sort((a, b) => a[1].d.localeCompare(b[1].d)), doneN = nights.filter(([, n]) => n.done);
  const dates = doneN.map(([, n]) => n.d), kinds = new Set<string>();
  let comm = 0, corp = 0;
  for (const [id] of doneN) { const x = ses(id); if (!x) continue; kinds.add(x.kind); if (x.kind === "saturday") comm++; if (x.kind === "petromin") corp++; }
  let clean = 0, cleanBest = 0;
  for (const [, n] of nights) { if (n.done) cleanBest = Math.max(cleanBest, ++clean); else if (n.noshow) clean = 0; }
  const R = weekRuns(dates, today), streak = weekStreak(completed.map((r) => r.date), today);
  const PW = perfectWeeks(data.weeks, new Set(completed.map((r) => r.sessionId)), today);
  const P = (slug: string, on: boolean, n: number, of: number): Progress => ({ slug, on, n: Math.min(n, of), of, row: null });
  const out: Progress[] = [
    P("first_lap", rides >= 1, rides, 1), P("regular", rides >= 5, rides, 5), P("podium", rides >= 10, rides, 10),
    P("streak", streak >= 3 || R.best >= 3, streak, 3), P("corniche25", rides >= 25, rides, 25),
    P("safety_car", R.bestS >= 6, R.curS, 6), P("endurance", R.bestS >= 12, R.curS, 12),
    P("triple_crown", kinds.size >= 3, kinds.size, 3), P("clean_sheet", cleanBest >= 10, clean, 10),
    P("slipstream", comm >= 5, comm, 5), P("paceline", comm >= 15, comm, 15), P("peloton", comm >= 30, comm, 30),
    P("works_team", corp >= 3, corp, 3),
    ...(PW.cur ? [P("perfect_week", PW.any, PW.cur.n, PW.cur.of)] : []),
    ...(PW.known ? [P("perfect_month", PW.best >= 4, PW.run, 4)] : []),
    ...data.seasons.filter((b) => b && b.slug && b.rule).map((b) => {
      const r = seasonProgress(b.rule, dates, today);
      return { ...P(b.slug, r.on, r.cur ?? 0, r.rides), row: b };
    }),
  ];
  // A badge staff gave is earned; a badge the catalogue no longer lists (retired) is left out.
  const given = new Set(data.mine.map((b) => b.slug)), cat = data.catalog.length ? new Map(data.catalog.map((b) => [b.slug, b])) : null;
  return out.filter((p) => !cat || cat.has(p.slug)).map((p) => ({ ...p, on: p.on || given.has(p.slug), row: p.row ?? cat?.get(p.slug) ?? null }));
}

/** The two badges already begun with the least left (bd-next): n above zero and under its goal,
 *  fewest to go first, then the furthest along. */
export function closestBadges(list: Progress[]): Progress[] {
  return list.filter((p) => !p.on && p.n > 0 && p.n < p.of)
    .sort((x, y) => (x.of - x.n) - (y.of - y.n) || y.n / y.of - x.n / x.of)
    .slice(0, 2);
}

/** Your rides (_myrStats): counted in ride nights (a party is one night, read off the rider's own
 *  row, the lowest number). Null with no ride yet. */
export type RideStats = { weeks: boolean[]; nWeeks: number; year: number; fav: string | null; minutes: number; first: string | null };
export function rideStats(rows: TicketRow[], sessions: Map<string, RecordSession>, today: string): RideStats | null {
  const nights = new Map<string, TicketRow>();
  for (const r of rows) {
    if (!rideCompleted(r, !!sessions.get(r.sessionId)?.freeRide)) continue;
    const c = nights.get(r.sessionId);
    if (!c || (r.queueNum ?? 0) < (c.queueNum ?? 0)) nights.set(r.sessionId, r);
  }
  const N = [...nights.values()];
  if (!N.length) return null;
  const wk = new Set(N.map((r) => weekOf(r.date))), now = weekOf(today);
  const weeks = Array.from({ length: 26 }, (_, i) => wk.has(now - 25 + i));
  const tc = new Map<string, number>();
  for (const r of N) if (r.type && !["Any", "None", "Own"].includes(r.type)) tc.set(r.type, (tc.get(r.type) ?? 0) + 1);
  const fav = [...tc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    weeks, nWeeks: weeks.filter(Boolean).length,
    year: N.filter((r) => r.date.startsWith(today.slice(0, 4))).length,
    fav, minutes: N.reduce((m, r) => m + (r.rideDuration ?? 0), 0),
    first: N.map((r) => r.date).sort()[0] ?? null,
  };
}

/** The account's rows as the record reads them (every status the ticket knows, plus no-shows,
 *  which break a Clean Sheet). */
export function recordRows(rows: Record<string, unknown>[]): TicketRow[] {
  return rows.map((r) => {
    if (r.status === "noshow") { const x = ticketRow({ ...r, status: "waiting" }); return x ? { ...x, status: "noshow" as unknown as TicketRow["status"] } : null; }
    return ticketRow(r);
  }).filter((r): r is TicketRow => !!r);
}
