// A rider's record on My Account, as the booking app's account page reads it (91816da, 2026-10-01):
// Your rides (_myrStats) and the two closest badges (bd-next in _mrBadgesRow), worked out from the
// account's own my_bookings rows with the booking app's rules (_mrBadges, _bdgRuns, _bdgSeason,
// _bdgPerfect, _mrStreak). Plain logic, so it can be tested; the data comes from lib/ride-record-data.ts.
import { rideCompleted, ticketRow, type TicketRow } from "./tickets";
import type { RideKind } from "./rides";

/** What the record needs of a session: its kind, and whether it costs nothing (_isFreeRide). */
export type RecordSession = { kind: RideKind; freeRide: boolean; approval?: boolean; groupKm?: { beg: number; int: number }; km?: number };
/** The kinds ridden on a bike (the booking app's KIND_TRAITS): the only ones the distance ladder counts. */
const BIKE_KINDS = new Set<RideKind>(["jcc", "saturday", "petromin", "snd96"]);
/** A badge as badge_catalog / badge_seasons / customer_my_badges hand it back. */
export type BadgeRow = {
  slug: string; note?: string | null; at?: string | null; icon?: string | null; color?: string | null; system?: boolean | null; auto?: boolean | null;
  name?: string | null; name_ar?: string | null; description?: string | null; description_ar?: string | null;
  rule?: { rides?: number; windows?: { from?: string; to?: string }[] } | null;
};
export type BadgeData = { catalog: BadgeRow[]; weeks: { w: string; ids: string[] }[] | null; seasons: BadgeRow[]; mine: BadgeRow[] };

/** The app's own badges by slug: [glyph, colour] (the booking app's BD_SYS). Their words are in
 *  RideRecord.text.ts under the same slug. Run for Her's pink ribbon is drawn on the 'pink' special
 *  medal, which the badges table cannot hold (it stores the badge as 'red'). */
/** The Saturday social rides with Defe that earn Rode with Defe (session ids; the booking app's DEFE_RIDE_IDS). */
export const DEFE_RIDE_IDS = ["2026-10-24"];

export const BADGE_SYS: Record<string, [string, string]> = {
  first_lap: ["flag", "green"], regular: ["wheel", "teal"], podium: ["podium", "purple"], front_row: ["one", "gold"], carbon: ["bike", "silver"],
  streak: ["flame", "orange"], squad: ["people", "blue"], fuel: ["bottle", "red"], corniche25: ["wave", "blue"],
  marshal: ["shield", "orange"], pit_crew: ["wrench", "silver"], green_flag: ["wflag", "green"], super_licence: ["card", "purple"],
  scrutineer: ["search", "teal"], champion: ["trophy", "gold"], spirit: ["heart", "red"], t100: ["t100", "gold"], t50: ["t50", "silver"], t25: ["t25", "orange"], complete_profile: ["profile", "special"],
  national_day_96: ["n96", "national"], back_on_track: ["return", "teal"], safety_car: ["beacon", "orange"], endurance: ["clock", "purple"],
  triple_crown: ["crown", "gold"], slipstream: ["wind", "green"], paceline: ["wind", "blue"], peloton: ["wind", "gold"],
  rolling_start: ["wind", "teal"], grand_tour: ["wind", "purple"], hall_of_fame: ["wind", "special"],
  km20: ["road", "green"], km40: ["road", "blue"], km70: ["road", "purple"], km100: ["road", "gold"], // the distance ladder (2026-10-16)
  clean_sheet: ["calcheck", "green"], works_team: ["briefcase", "teal"], perfect_week: ["calstar", "purple"], perfect_month: ["calcrown", "gold"],
  run_for_her: ["ribbon", "pink"],
  victory_lap: ["lapring", "vlap"], // Victory Lap's lap ring, on its own special medal, purple into black (2026-10-17)
  defe_ride: ["defewheel", "defe"], // Rode with Defe: the ribbon wheel, rose into berry (2026-10-18)
  // the staff ladders' higher levels and Front Row's (the booking app, 2026-10-12)
  senior_marshal: ["shield", "blue"], chief_marshal: ["shield", "gold"], pit_boss: ["wrench", "teal"], crew_chief: ["wrench", "gold"],
  clear_track: ["wflag", "teal"], track_guardian: ["wflag", "gold"], tech_inspector: ["search", "blue"], chief_scrutineer: ["search", "gold"],
  hat_trick: ["trophy", "purple"], grand_champion: ["trophy", "red"], fair_play: ["heart", "purple"], heart_of_race: ["heart", "gold"],
  bike_owner: ["bike", "green"], road_owner: ["bike", "blue"], carbon_owner: ["bike", "special"], pole_position: ["one", "purple"], pole_master: ["one", "red"],
  // levels 4 and 5 of the seven ladders (2026-10-12: "1 5 10 are too low even if you need to increase the number of levels")
  clerk_of_course: ["shield", "red"], race_director: ["shield", "special"], team_manager: ["wrench", "red"], team_principal: ["wrench", "special"],
  flag_bearer: ["wflag", "red"], track_legend: ["wflag", "special"], tech_delegate: ["search", "red"], chief_engineer: ["search", "special"],
  dynasty: ["trophy", "blue"], world_champion: ["trophy", "special"], ride_ambassador: ["heart", "red"], soul_of_ride: ["heart", "special"],
  grid_leader: ["one", "blue"], pole_legend: ["one", "special"],
  winter_series: ["snow", "blue"], ramadan_nights: ["lantern", "purple"], founding_day: ["fort", "orange"],
};
/** The badges staff give by hand that the app knows itself (BDG_GIVEN_SYS): shown where the
 *  database has no catalogue. */
const GIVEN_SYS = ["marshal", "senior_marshal", "chief_marshal", "clerk_of_course", "race_director",
  "pit_crew", "pit_boss", "crew_chief", "team_manager", "team_principal",
  "green_flag", "clear_track", "track_guardian", "flag_bearer", "track_legend", "super_licence",
  "scrutineer", "tech_inspector", "chief_scrutineer", "tech_delegate", "chief_engineer",
  "champion", "hat_trick", "grand_champion", "dynasty", "world_champion",
  "spirit", "fair_play", "heart_of_race", "ride_ambassador", "soul_of_ride", "t100", "t50", "t25",
  "bike_owner", "road_owner", "carbon_owner"];

/** Badge ladders (the booking app's BDG_LADDERS, 2026-10-09: "the same way it's done in clash of clans
 *  achievements"): badges that count the same thing to a higher number are the levels of one badge,
 *  lowest first. A level reached brings every level under it, given by staff or earned by riding
 *  ("getting the t100 automatically gives the ones before"). The badges staff give have levels too
 *  (2026-10-12: "put levels and multiple badges in each one"), and so does Front Row; Bike Owner climbs
 *  from any bike bought from us to a road bike, then a carbon road bike. */
export const LADDERS: string[][] = [
  ["first_lap", "regular", "podium", "corniche25"], ["streak", "safety_car", "endurance"],
  ["rolling_start", "slipstream", "paceline", "peloton", "grand_tour", "hall_of_fame"], ["perfect_week", "perfect_month"], ["t25", "t50", "t100"],
  ["km20", "km40", "km70", "km100"], // the distance ladder (the booking app, 2026-10-16)
  // five levels each since 2026-10-12: 1/10/25/50/100, Champion's and Front Row's 1/5/10/25/50
  ["marshal", "senior_marshal", "chief_marshal", "clerk_of_course", "race_director"], ["pit_crew", "pit_boss", "crew_chief", "team_manager", "team_principal"],
  ["green_flag", "clear_track", "track_guardian", "flag_bearer", "track_legend"], ["scrutineer", "tech_inspector", "chief_scrutineer", "tech_delegate", "chief_engineer"],
  ["champion", "hat_trick", "grand_champion", "dynasty", "world_champion"], ["spirit", "fair_play", "heart_of_race", "ride_ambassador", "soul_of_ride"],
  ["front_row", "pole_position", "pole_master", "grid_leader", "pole_legend"], ["bike_owner", "road_owner", "carbon_owner"],
];
const LADDER_OF = new Map(LADDERS.flatMap((L) => L.map((s, i) => [s, [L, i]] as const)));
/** A set of slugs held, with every level under each one (_bdgClimb). */
export function climb(on: Iterable<string>): Set<string> {
  const o = new Set(on);
  for (const s of [...o]) { const l = LADDER_OF.get(s); if (l) for (const x of l[0].slice(0, l[1])) o.add(x); }
  return o;
}

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
export function seasonProgress(rule: BadgeRow["rule"], dates: string[], today: string): { on: boolean; rides: number; cur: number | null; curTo: string | null; next: string | null } {
  const rides = Math.min(99, Math.max(1, Number(rule?.rides) || 1)), inst: [string, string][] = [];
  const y1 = Number(today.slice(0, 4)), y0 = Math.min(y1, ...dates.map((d) => Number(d.slice(0, 4))).filter(Boolean)) - 1;
  for (const w of rule?.windows ?? []) {
    const f = String(w?.from ?? ""), to = String(w?.to ?? "");
    if (/^\d{4}-\d\d-\d\d$/.test(f) && /^\d{4}-\d\d-\d\d$/.test(to)) inst.push([f, to]);
    else if (/^\d\d-\d\d$/.test(f) && /^\d\d-\d\d$/.test(to)) for (let y = y0; y <= y1 + 1; y++) inst.push([`${y}-${f}`, `${to < f ? y + 1 : y}-${to}`]);
  }
  let best = 0, cur: number | null = null, curTo: string | null = null, next: string | null = null;
  for (const [f, to] of inst) {
    const n = dates.filter((d) => d >= f && d <= to).length;
    best = Math.max(best, n);
    if (today >= f && today <= to) { cur = n; curTo = to; } else if (f > today && (!next || f < next)) next = f;
  }
  return { on: best >= rides, rides, cur, curTo, next };
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

/** The two badges already begun with the least left (bd-next in _mrBadgesRow): a count n/of
 *  above zero and under its goal, fewest to go first, then the furthest along. */
/** A ladder's next level counts too, reached levels and all: it is the next badge that ladder gives
 *  (show: the badge to draw, the next level or the badge itself). */
export function closestBadges(list: BadgeItem[]): { item: BadgeItem; show: BadgeItem; n: number; of: number }[] {
  return list.filter((x) => !x.on || x.nx).map((item) => {
    const m = /^(\d+)\/(\d+)$/.exec(item.p ?? "");
    return m && +m[1] > 0 && +m[1] < +m[2] ? { item, show: item.nx ?? item, n: +m[1], of: +m[2] } : null;
  }).filter((x): x is { item: BadgeItem; show: BadgeItem; n: number; of: number } => !!x)
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
 *  which break a Clean Sheet). `addons`: the booking carries an add-on the rider paid for (Fuel Stop,
 *  the booking app's 2026-10-07 rule): the booking paid, on a bike or done, a line sold above zero (a
 *  line without its price counts as charged, as the booking app counts one it cannot price), and not
 *  a booking on the house (marked paid at SAR 0 with no promo code, not an own bike). */
export function recordRows(rows: Record<string, unknown>[]): (TicketRow & { addons: boolean })[] {
  return rows.map((r) => {
    const x = r.status === "noshow" ? ticketRow({ ...r, status: "waiting" }) : ticketRow(r);
    if (!x) return null;
    const house = (typeof r.price === "number" || (typeof r.price === "string" && r.price.trim() !== "")) && Number(r.price) === 0
      && !(typeof r.promo_code === "string" && r.promo_code.trim()) && x.type !== "Own";
    const addons = x.paid && (x.status === "active" || x.status === "done") && !house && x.addonLines.some((a) => a.p === null || a.p > 0);
    return { ...x, ...(r.status === "noshow" ? { status: "noshow" as unknown as TicketRow["status"] } : {}), addons };
  }).filter((r): r is TicketRow & { addons: boolean } => !!r);
}

// ── Every badge, as the account page lists them (_mrBadges, _mrBadgeList) ─────────────────────

/** The account's profile fields Race Ready counts (_profPct). */
export type ProfileFields = Partial<Record<"name" | "email" | "phone" | "height" | "birth_date" | "country" | "city" | "photo" | "type_preference", unknown>>;
export const profilePct = (c: ProfileFields) => {
  const f = [c.name, c.email, c.phone, c.height, c.birth_date, c.country, c.city, c.photo, c.type_preference && c.type_preference !== "Any"];
  return Math.round((f.filter(Boolean).length / f.length) * 100);
};

/** One badge on the page: its slug, how it is drawn, whether it is earned, the progress the
 *  booking app prints ("4/5", "78%"), who gave it (a badge staff gave: their note and the day),
 *  a dated badge's window, whether only staff give it, and its catalogue row for the words of a
 *  badge the app does not know itself. A ladder is one item: the top level reached (else the first),
 *  with lv its levels, lowest first, lvN how many are reached, nx the next one, and p the next one's
 *  progress (null at the top); every other badge has lv null. */
export type BadgeItem = {
  slug: string; icon: string; color: string; on: boolean; p: string | null;
  given: { note: string | null; at: string | null } | null;
  season: { curTo: string | null; next: string | null } | null;
  manual: boolean; row: BadgeRow | null;
  lv: BadgeItem[] | null; lvN: number; nx: BadgeItem | null;
};

type RecordRow = TicketRow & { addons?: boolean };

/** The ride badges, earned or not, with the booking app's progress (_mrBadges). */
function rideBadges(rows: RecordRow[], sessions: Map<string, RecordSession>, data: BadgeData, today: string, profile: ProfileFields | null) {
  const ses = (id: string) => sessions.get(id);
  const done = (r: TicketRow) => rideCompleted(r, !!ses(r.sessionId)?.freeRide);
  // a ride that counts towards a badge (_bdgRode): done and paid, or free, or an own bike checked in;
  // the booking app counts every badge off these rows (_mrBadges(all, all.filter(_bdgRode)))
  const rode = (r: TicketRow) => done(r) || (r.type === "Own" && (r.status === "done" || r.status === "active"));
  const completed = rows.filter(rode), rides = completed.length;
  // Front Row's levels (2026-10-12): nights first in the queue and ridden ("make sure all badges go for
  // deserved holders"); a ride staff approve shows no number, so it never counts
  const p1 = new Set(rows.filter((r) => r.queueNum === 1 && rode(r) && !ses(r.sessionId)?.approval).map((r) => r.sessionId)).size;
  const carbon = rows.some((r) => r.type === "Road Carbon" && (r.status === "done" || r.status === "active") && (r.paid || !!ses(r.sessionId)?.freeRide));
  // Squad Captain (the booking app, 2026-10-07): three or more riders on one night, every one of them
  // checked in (on the bike or done) and paid (free ride, own bike): a party with a no-show, a rider
  // still waiting or one still owing earns nothing that night
  const per = new Map<string, { n: number; ok: boolean }>();
  for (const r of rows) {
    const p = per.get(r.sessionId) ?? { n: 0, ok: true };
    p.n++;
    if (!((r.status === "active" || r.status === "done") && (r.paid || !!ses(r.sessionId)?.freeRide || r.type === "Own"))) p.ok = false;
    per.set(r.sessionId, p);
  }
  const squad = [...per.values()].reduce((m, p) => (p.ok ? Math.max(m, p.n) : m), 0);
  const fuel = rows.some((r) => r.addons);
  const night = new Map<string, { d: string; done: boolean; noshow: boolean }>();
  for (const r of rows) {
    const n = night.get(r.sessionId) ?? { d: r.date, done: false, noshow: false };
    if (rode(r)) n.done = true; else if (String(r.status) === "noshow") n.noshow = true;
    night.set(r.sessionId, n);
  }
  const nights = [...night.entries()].sort((a, b) => a[1].d.localeCompare(b[1].d)), doneN = nights.filter(([, n]) => n.done);
  const dates = doneN.map(([, n]) => n.d), kinds = new Set<string>();
  let comm = 0, corp = 0, gap = false, clean = 0, cleanBest = 0;
  // the Saturday ladder (Slipstream, Paceline, Peloton) counts Saturday rides alone: a run (kind
  // 'runher') or any other community event is a kind of its own, never a Saturday ride
  for (const [id] of doneN) { const x = ses(id); if (!x) continue; kinds.add(x.kind); if (x.kind === "saturday") comm++; if (x.kind === "petromin") corp++; }
  for (let i = 1; i < dates.length; i++) if (Date.parse(dates[i]) - Date.parse(dates[i - 1]) >= 60 * 864e5) gap = true;
  // the distance ladder (the booking app, 2026-10-16: "a badge for the distance in one ride not the total of kilometers"):
  // the longest single bike ride ridden, any ride any day (the booking app's _rideKm, the owner 2026-10-17: "open for
  // all sessions or anytime"). A Saturday ride is its group's distance, the ride's own, else 20 km Beginners, 40 km
  // Intermediates (no group: the Beginners'); any other bike ride the one distance staff gave it, none if none was
  // given. Runs, swims and other sessions without a bike never count.
  const kmN = new Map<string, number>();
  for (const r of completed) {
    const x = ses(r.sessionId); if (!x || !BIKE_KINDS.has(x.kind)) continue;
    const g = x.groupKm ?? { beg: 20, int: 40 };
    const v = x.kind === "saturday" ? (r.rideGroup === "int" ? g.int : g.beg) : (x.km ?? 0);
    if (v > 0) kmN.set(r.sessionId, Math.max(kmN.get(r.sessionId) ?? 0, v));
  }
  const km = Math.max(0, ...kmN.values());
  for (const [, n] of nights) { if (n.done) cleanBest = Math.max(cleanBest, ++clean); else if (n.noshow) clean = 0; }
  const R = weekRuns(dates, today), streak = weekStreak(completed.map((r) => r.date), today);
  const PW = perfectWeeks(data.weeks, new Set(completed.map((r) => r.sessionId)), today);
  const nd96 = rows.some((r) => (r.status === "done" || r.status === "active") && ses(r.sessionId)?.kind === "snd96");
  // Run for Her: finished, i.e. marked done at the end of the run (the owner, 2026-10-05: "who completes this event")
  const rfh = rows.some((r) => r.status === "done" && ses(r.sessionId)?.kind === "runher");
  // Victory Lap: checked out, or the session closed out - both leave the booking done (the owner, 2026-10-17)
  const vlp = rows.some((r) => r.status === "done" && ses(r.sessionId)?.kind === "vlap");
  // Rode with Defe: checked in (on the bike or done) on the Saturday ride with Defe, members and Defe's riders alike
  const dfr = rows.some((r) => (r.status === "done" || r.status === "active") && DEFE_RIDE_IDS.includes(r.sessionId));
  const P = (n: number, of: number) => `${Math.min(n, of)}/${of}`, pct = profile ? profilePct(profile) : 0;
  type B = { s: string; on: boolean; p?: string | null; hide?: boolean; row?: BadgeRow; season?: BadgeItem["season"] };
  const list: B[] = [
    ...(profile ? [{ s: "complete_profile", on: pct >= 100, p: `${pct}%` }] : []),
    { s: "national_day_96", on: nd96, hide: true },
    { s: "run_for_her", on: rfh, hide: true }, // the pink ribbon: shown to those who finished it
    { s: "victory_lap", on: vlp, hide: true }, // the lap ring: shown to those who finished it
    { s: "defe_ride", on: dfr, hide: true }, // the ribbon wheel: shown to those who rode it
    { s: "first_lap", on: rides >= 1, p: `${rides}/1` }, { s: "regular", on: rides >= 5, p: P(rides, 5) }, { s: "podium", on: rides >= 10, p: P(rides, 10) },
    { s: "front_row", on: p1 >= 1, p: P(p1, 1) }, { s: "pole_position", on: p1 >= 5, p: P(p1, 5) }, { s: "pole_master", on: p1 >= 10, p: P(p1, 10) },
    { s: "grid_leader", on: p1 >= 25, p: P(p1, 25) }, { s: "pole_legend", on: p1 >= 50, p: P(p1, 50) },
    { s: "carbon", on: carbon }, { s: "streak", on: streak >= 3 || R.best >= 3, p: P(streak, 3) },
    { s: "squad", on: squad >= 3 }, { s: "fuel", on: fuel }, { s: "corniche25", on: rides >= 25, p: P(rides, 25) },
    { s: "safety_car", on: R.bestS >= 6, p: P(R.curS, 6) }, { s: "endurance", on: R.bestS >= 12, p: P(R.curS, 12) },
    { s: "triple_crown", on: kinds.size >= 3, p: P(kinds.size, 3) }, { s: "clean_sheet", on: cleanBest >= 10, p: P(clean, 10) },
    // the Saturday social ride ladder (the booking app, 2026-10-03): 1, 5, 10, 25, 50, 100 ride days
    { s: "rolling_start", on: comm >= 1, p: P(comm, 1) }, { s: "slipstream", on: comm >= 5, p: P(comm, 5) }, { s: "paceline", on: comm >= 10, p: P(comm, 10) },
    { s: "peloton", on: comm >= 25, p: P(comm, 25) }, { s: "grand_tour", on: comm >= 50, p: P(comm, 50) }, { s: "hall_of_fame", on: comm >= 100, p: P(comm, 100) },
    // the longest Saturday social ride ridden: 20 / 40 / 70 / 100 km (2026-10-16)
    ...[20, 40, 70, 100].map((n) => ({ s: `km${n}`, on: km >= n, p: P(km, n) })),
    { s: "works_team", on: corp >= 3, p: P(corp, 3) },
    { s: "perfect_week", on: PW.any, p: PW.cur ? P(PW.cur.n, PW.cur.of) : null },
    { s: "perfect_month", on: PW.best >= 4, p: PW.known ? P(PW.run, 4) : null },
    { s: "back_on_track", on: gap, hide: true },
    ...data.seasons.filter((b) => b && b.slug && b.rule).map((b) => {
      const r = seasonProgress(b.rule, dates, today);
      return { s: b.slug, on: r.on, p: P(r.cur ?? 0, r.rides), row: b, season: { curTo: r.cur != null ? r.curTo : null, next: r.next } };
    }),
  ];
  return list;
}

/** Every badge on the page, sorted as the booking app sorts them: earned first, then those a ride
 *  earns, the dated ones and the ones staff give, each group in its own order. National Day 96,
 *  Run for Her and Back on Track stay out until earned; a badge the catalogue no longer lists shows
 *  only to a rider who holds it. */
export function badgeList(rows: RecordRow[], sessions: Map<string, RecordSession>, data: BadgeData, today: string, profile: ProfileFields | null): BadgeItem[] {
  const given = new Map(data.mine.map((g) => [g.slug, g]));
  const cat = data.catalog.length ? new Map(data.catalog.map((b) => [b.slug, b])) : null;
  const draw = (slug: string, row: BadgeRow | null): [string, string] => {
    const sys = BADGE_SYS[slug];
    return sys && (!row || row.system !== false) ? sys : [row?.icon || "medal", row?.color || "green"];
  };
  const item = (slug: string, on: boolean, o: Partial<BadgeItem> = {}): BadgeItem => {
    const row = o.row ?? cat?.get(slug) ?? null, [icon, color] = draw(slug, row);
    return { slug, icon, color, on, p: null, given: null, season: null, manual: false, lv: null, lvN: 0, nx: null, ...o, row };
  };
  const ride = rideBadges(rows, sessions, data, today, profile).map((r) => {
    const g = given.get(r.s);
    given.delete(r.s);
    return { x: item(r.s, r.on || !!g, { p: r.p ?? null, given: g ? { note: g.note ?? null, at: g.at ?? null } : null, season: r.season ?? null, row: g ?? r.row ?? null }), hide: !!r.hide && !r.on && !g };
  });
  const manual = (cat ? [...cat.values()].filter((b) => !b.auto).map((b) => b.slug) : GIVEN_SYS).map((s) => ({ x: item(s, false, { manual: true }), hide: false }));
  const staffGiven = [...given.values()].map((g) => ({ x: item(g.slug, true, { given: { note: g.note ?? null, at: g.at ?? null }, row: g }), hide: false }));
  const seen = new Set<string>(), out: BadgeItem[] = [];
  for (const { x, hide } of [...staffGiven, ...ride, ...manual]) {
    if (!x.slug || seen.has(x.slug) || hide || (!x.on && cat && !cat.has(x.slug))) continue;
    seen.add(x.slug);
    out.push(x);
  }
  const rank = (x: BadgeItem) => (x.on ? 0 : x.manual ? 3 : x.season ? 2 : 1);
  return foldLadders(out).map((x, i) => [x, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((a) => a[0]);
}

/** The badge list with each ladder folded into one item, where its first level stood (_bdgFold):
 *  the top level reached (else the first), lv its levels, lvN how many are reached, nx the next
 *  one, p the next one's progress. Every level under the top one is reached too. A level the list
 *  leaves out (one the catalogue no longer has) is left out of its ladder. */
export function foldLadders(list: BadgeItem[]): BadgeItem[] {
  const by = new Map(list.map((x) => [x.slug, x])), done = new Set<string[]>(), out: BadgeItem[] = [];
  for (const x of list) {
    const l = LADDER_OF.get(x.slug);
    if (!l) { out.push(x); continue; }
    if (done.has(l[0])) continue;
    done.add(l[0]);
    const found = l[0].map((s) => by.get(s)).filter((y): y is BadgeItem => !!y);
    const top = found.reduce((t, y, i) => (y.on ? i : t), -1);
    const lv = found.map((y, i) => (i < top && !y.on ? { ...y, on: true } : y));
    const nx = lv[top + 1] ?? null;
    out.push({ ...lv[Math.max(top, 0)], lv, lvN: top + 1, nx, p: nx ? nx.p : null });
  }
  return out;
}
