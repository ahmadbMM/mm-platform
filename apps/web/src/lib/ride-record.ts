// A rider's record on My Account, as the booking app's account page reads it (91816da, 2026-10-01):
// Your rides (_myrStats) and the two closest badges (bd-next in _mrBadgesRow), worked out from the
// account's own my_bookings rows with the booking app's rules (_mrBadges, _bdgRuns, _bdgSeason,
// _bdgPerfect, _mrStreak). Plain logic, so it can be tested; the data comes from lib/ride-record-data.ts.
import { rideCompleted, ticketRow, type TicketRow } from "./tickets";
import type { RideKind } from "./rides";

/** What the record needs of a session: its kind, and whether it costs nothing (_isFreeRide). */
export type RecordSession = { kind: RideKind; freeRide: boolean; approval?: boolean };
/** A badge as badge_catalog / badge_seasons / customer_my_badges hand it back. */
export type BadgeRow = {
  slug: string; note?: string | null; at?: string | null; icon?: string | null; color?: string | null; system?: boolean | null; auto?: boolean | null;
  name?: string | null; name_ar?: string | null; description?: string | null; description_ar?: string | null;
  rule?: { rides?: number; windows?: { from?: string; to?: string }[] } | null;
};
export type BadgeData = { catalog: BadgeRow[]; weeks: { w: string; ids: string[] }[] | null; seasons: BadgeRow[]; mine: BadgeRow[] };

/** The app's own badges by slug: [glyph, colour] (the booking app's BD_SYS). Their words are in
 *  RideRecord.text.ts under the same slug. */
export const BADGE_SYS: Record<string, [string, string]> = {
  first_lap: ["flag", "green"], regular: ["wheel", "teal"], podium: ["podium", "purple"], front_row: ["one", "gold"], carbon: ["bike", "silver"],
  streak: ["flame", "orange"], squad: ["people", "blue"], fuel: ["bottle", "red"], corniche25: ["wave", "blue"],
  marshal: ["shield", "orange"], pit_crew: ["wrench", "silver"], green_flag: ["wflag", "green"], super_licence: ["card", "purple"],
  scrutineer: ["search", "teal"], champion: ["trophy", "gold"], spirit: ["heart", "red"], complete_profile: ["profile", "special"],
  national_day_96: ["n96", "national"], back_on_track: ["return", "teal"], safety_car: ["beacon", "orange"], endurance: ["clock", "purple"],
  triple_crown: ["crown", "gold"], slipstream: ["wind", "green"], paceline: ["wind", "blue"], peloton: ["wind", "gold"],
  rolling_start: ["wind", "teal"], grand_tour: ["wind", "purple"], hall_of_fame: ["wind", "special"],
  clean_sheet: ["calcheck", "green"], works_team: ["briefcase", "teal"], perfect_week: ["calstar", "purple"], perfect_month: ["calcrown", "gold"],
  winter_series: ["snow", "blue"], ramadan_nights: ["lantern", "purple"], founding_day: ["fort", "orange"],
};
/** The badges staff give by hand that the app knows itself (BDG_GIVEN_SYS): shown where the
 *  database has no catalogue. */
const GIVEN_SYS = ["marshal", "pit_crew", "green_flag", "super_licence", "scrutineer", "champion", "spirit"];

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
export function closestBadges(list: BadgeItem[]): { item: BadgeItem; n: number; of: number }[] {
  return list.filter((x) => !x.on).map((item) => {
    const m = /^(\d+)\/(\d+)$/.exec(item.p ?? "");
    return m && +m[1] > 0 && +m[1] < +m[2] ? { item, n: +m[1], of: +m[2] } : null;
  }).filter((x): x is { item: BadgeItem; n: number; of: number } => !!x)
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
export function recordRows(rows: Record<string, unknown>[]): (TicketRow & { addons: boolean })[] {
  return rows.map((r) => {
    const x = r.status === "noshow" ? ticketRow({ ...r, status: "waiting" }) : ticketRow(r);
    if (!x) return null;
    // add-ons bought with the booking (Fuel Stop): a JSON list, or its text
    let ad: unknown = r.addons;
    if (typeof ad === "string") { try { ad = JSON.parse(ad); } catch { ad = null; } }
    return { ...x, ...(r.status === "noshow" ? { status: "noshow" as unknown as TicketRow["status"] } : {}), addons: Array.isArray(ad) && ad.length > 0 };
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
 *  badge the app does not know itself. */
export type BadgeItem = {
  slug: string; icon: string; color: string; on: boolean; p: string | null;
  given: { note: string | null; at: string | null } | null;
  season: { curTo: string | null; next: string | null } | null;
  manual: boolean; row: BadgeRow | null;
};

type RecordRow = TicketRow & { addons?: boolean };

/** The ride badges, earned or not, with the booking app's progress (_mrBadges). */
function rideBadges(rows: RecordRow[], sessions: Map<string, RecordSession>, data: BadgeData, today: string, profile: ProfileFields | null) {
  const ses = (id: string) => sessions.get(id);
  const done = (r: TicketRow) => rideCompleted(r, !!ses(r.sessionId)?.freeRide);
  const completed = rows.filter(done), rides = completed.length;
  const anyP1 = rows.some((r) => r.queueNum === 1 && !ses(r.sessionId)?.approval);
  const carbon = rows.some((r) => r.type === "Road Carbon" && (r.status === "done" || r.status === "active"));
  const per = new Map<string, number>();
  for (const r of rows) per.set(r.sessionId, (per.get(r.sessionId) ?? 0) + 1);
  const squad = Math.max(0, ...per.values());
  const fuel = rows.some((r) => r.addons);
  const night = new Map<string, { d: string; done: boolean; noshow: boolean }>();
  for (const r of rows) {
    const n = night.get(r.sessionId) ?? { d: r.date, done: false, noshow: false };
    if (done(r)) n.done = true; else if (String(r.status) === "noshow") n.noshow = true;
    night.set(r.sessionId, n);
  }
  const nights = [...night.entries()].sort((a, b) => a[1].d.localeCompare(b[1].d)), doneN = nights.filter(([, n]) => n.done);
  const dates = doneN.map(([, n]) => n.d), kinds = new Set<string>();
  let comm = 0, corp = 0, gap = false, clean = 0, cleanBest = 0;
  for (const [id] of doneN) { const x = ses(id); if (!x) continue; kinds.add(x.kind); if (x.kind === "saturday") comm++; if (x.kind === "petromin") corp++; }
  for (let i = 1; i < dates.length; i++) if (Date.parse(dates[i]) - Date.parse(dates[i - 1]) >= 60 * 864e5) gap = true;
  for (const [, n] of nights) { if (n.done) cleanBest = Math.max(cleanBest, ++clean); else if (n.noshow) clean = 0; }
  const R = weekRuns(dates, today), streak = weekStreak(completed.map((r) => r.date), today);
  const PW = perfectWeeks(data.weeks, new Set(completed.map((r) => r.sessionId)), today);
  const nd96 = rows.some((r) => (r.status === "done" || r.status === "active") && ses(r.sessionId)?.kind === "snd96");
  const P = (n: number, of: number) => `${Math.min(n, of)}/${of}`, pct = profile ? profilePct(profile) : 0;
  type B = { s: string; on: boolean; p?: string | null; hide?: boolean; row?: BadgeRow; season?: BadgeItem["season"] };
  const list: B[] = [
    ...(profile ? [{ s: "complete_profile", on: pct >= 100, p: `${pct}%` }] : []),
    { s: "national_day_96", on: nd96, hide: true },
    { s: "first_lap", on: rides >= 1, p: `${rides}/1` }, { s: "regular", on: rides >= 5, p: P(rides, 5) }, { s: "podium", on: rides >= 10, p: P(rides, 10) },
    { s: "front_row", on: anyP1 }, { s: "carbon", on: carbon }, { s: "streak", on: streak >= 3 || R.best >= 3, p: P(streak, 3) },
    { s: "squad", on: squad >= 3 }, { s: "fuel", on: fuel }, { s: "corniche25", on: rides >= 25, p: P(rides, 25) },
    { s: "safety_car", on: R.bestS >= 6, p: P(R.curS, 6) }, { s: "endurance", on: R.bestS >= 12, p: P(R.curS, 12) },
    { s: "triple_crown", on: kinds.size >= 3, p: P(kinds.size, 3) }, { s: "clean_sheet", on: cleanBest >= 10, p: P(clean, 10) },
    // The Saturday social ride ladder (the owner, 2026-10-03): 1, 5, 10, 25, 50, 100 ride days, as the app.
    { s: "rolling_start", on: comm >= 1, p: P(comm, 1) },
    { s: "slipstream", on: comm >= 5, p: P(comm, 5) }, { s: "paceline", on: comm >= 10, p: P(comm, 10) }, { s: "peloton", on: comm >= 25, p: P(comm, 25) },
    { s: "grand_tour", on: comm >= 50, p: P(comm, 50) }, { s: "hall_of_fame", on: comm >= 100, p: P(comm, 100) },
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
 *  earns, the dated ones and the ones staff give, each group in its own order. National Day 96
 *  and Back on Track stay out until earned; a badge the catalogue no longer lists shows only to a
 *  rider who holds it. */
export function badgeList(rows: RecordRow[], sessions: Map<string, RecordSession>, data: BadgeData, today: string, profile: ProfileFields | null): BadgeItem[] {
  const given = new Map(data.mine.map((g) => [g.slug, g]));
  const cat = data.catalog.length ? new Map(data.catalog.map((b) => [b.slug, b])) : null;
  const draw = (slug: string, row: BadgeRow | null): [string, string] => {
    const sys = BADGE_SYS[slug];
    return sys && (!row || row.system !== false) ? sys : [row?.icon || "medal", row?.color || "green"];
  };
  const item = (slug: string, on: boolean, o: Partial<BadgeItem> = {}): BadgeItem => {
    const row = o.row ?? cat?.get(slug) ?? null, [icon, color] = draw(slug, row);
    return { slug, icon, color, on, p: null, given: null, season: null, manual: false, ...o, row };
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
  return out.map((x, i) => [x, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((a) => a[0]);
}
