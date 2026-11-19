// The new-badge pop-up on My Account, as the booking app pops it (_bdgCelebrate, _bdgProfCheer and, for a Community
// badge, the pulse's _plsCheer; since 97674480, 2026-11-09, "when entering my account as a customer why is it showing me
// getting badges i already have from before"): a badge pops up as new once on a device, and only while it IS new -
//   - the newest badge staff gave, within three days of being given, newer than the last one this device showed;
//   - an event's badge (National Day 96, Run for Her, the DEFE 5KM Run, Victory Lap, Rode with Defe, Blood Donor and
//     Blood Donation Visitor, Farmhouse Night) within three days of its session (Blood Donor: of the donation);
//   - Race Ready when the rider's own save filled the profile (a profile that arrives full is not news);
//   - a Recruiter level when more friends have ridden than this device last counted (the first count is only noted);
//   - a Community badge the server gave and the member has not seen (hub_pulse's fresh), marked seen on the server
//     (hub_seen) once shown, so another phone does not show it again; while the pulse answers, those badges are its own.
// One at a time. With no storage it never pops rather than popping on every visit. Plain logic, tested; the data is read
// by app/api/account/badge-new, the pop-up drawn by components/account/BadgeCelebrate.tsx.
import type { BadgeItem, RecordSession } from "./ride-record";
import { DEFE_RIDE_IDS, onBike } from "./ride-record";
import type { TicketRow } from "./tickets";

export const BDG_FRESH_MS = 3 * 864e5;
/** Given or earned in the last three days (the app's _bdgFresh): a day ("2026-11-18") counts from its midnight (UTC), as
 *  the app's Date.parse reads it. */
export const fresh = (at: string | null | undefined, now: number = Date.now()): boolean => {
  const v = Date.parse(at || "");
  return Number.isFinite(v) && now - v < BDG_FRESH_MS;
};

/** The badges the app works out itself that pop up, in the app's order (its BDG_CHEER). */
export const CHEER_ORDER = ["recruiter", "recruiter_3", "recruiter_5", "recruiter_10", "complete_profile", "national_day_96", "run_for_her", "defe_5k",
  "victory_lap", "defe_ride", "blood_donor", "blood_visitor", "farmhouse_night"] as const;
export const RECRUITER_N: Record<string, number> = { recruiter: 1, recruiter_3: 3, recruiter_5: 5, recruiter_10: 10 };
const EVENT = new Set(["national_day_96", "run_for_her", "defe_5k", "victory_lap", "defe_ride", "blood_donor", "blood_visitor", "farmhouse_night"]);
/** A Community badge (a month's challenge, the club's goal): the pulse's, while it answers (the app's _hubBdg). */
export const isCommunityBadge = (slug: string): boolean => /^(challenge|club_goal)_\d+$/.test(slug);

type Row = TicketRow & { donated?: boolean };
const FARM_ID = /^\d{4}-\d\d-\d\d-fh(-|$)/;
const ymd = (s: string) => (/^\d{4}-\d\d-\d\d/.test(s) ? s.slice(0, 10) : "");

/** The day each event badge was first earned (the app's day1: the earliest session it was earned on; Blood Donor the
 *  first donation's time, Blood Donation Visitor the earlier of that and its first visit). `donatedAt` holds the raw
 *  my_bookings rows' donated_at by booking id. */
export function eventDays(rows: Row[], sessions: Map<string, RecordSession>, donatedAt: Map<string, string>): Record<string, string> {
  const kind = (r: Row) => sessions.get(r.sessionId)?.kind;
  const day1 = (f: (r: Row) => boolean, list: Row[] = rows) => list.filter(f).map((r) => ymd(r.date || r.sessionId)).filter(Boolean).sort()[0] ?? "";
  const done = (r: Row) => r.status === "done";
  const onIt = (r: Row) => r.status === "done" || r.status === "active";
  const bike = rows.filter((r) => onBike(r.sessionId, sessions));
  const bld = [...donatedAt.values()].filter(Boolean).sort()[0] ?? "";
  const out: Record<string, string> = {
    national_day_96: day1((r) => onIt(r) && kind(r) === "snd96", bike),
    run_for_her: day1((r) => done(r) && kind(r) === "runher"),
    defe_5k: day1((r) => done(r) && kind(r) === "defe5k"),
    victory_lap: day1((r) => done(r) && kind(r) === "vlap"),
    defe_ride: day1((r) => onIt(r) && DEFE_RIDE_IDS.includes(r.sessionId), bike),
    blood_donor: bld,
    blood_visitor: [bld, day1((r) => done(r) && kind(r) === "blood")].filter(Boolean).sort()[0] ?? "",
    farmhouse_night: day1((r) => onIt(r) && (sessions.has(r.sessionId) ? kind(r) === "farm" : FARM_ID.test(r.sessionId))),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v));
}

/** One badge that may pop up, as the pop-up shows it: drawn, named, how it is earned, what it means, and staff's note and
 *  day for one they gave. kind: who decides it is new (above). at: when it was given, or the day it was earned. */
export type Cheer = {
  slug: string; icon: string; color: string; name: string; how: string; about: string;
  kind: "given" | "event" | "profile" | "recruiter" | "community";
  at: string | null; given?: { line: string; note: string | null } | null;
};
type Words = (x: BadgeItem) => [string, string, string];

/** The earned badges that may pop up, from the account's badge list (every level of a ladder on its own). `days`: the event
 *  badges' days (eventDays). */
export function cheersOf(items: BadgeItem[], days: Record<string, string>, words: Words, givenLine: (at: string) => string): Cheer[] {
  const all = new Map<string, BadgeItem>();
  for (const x of items) for (const y of [x, ...(x.lv ?? [])]) if (y.on && !all.has(y.slug)) all.set(y.slug, y);
  const out: Cheer[] = [];
  for (const x of all.values()) {
    const kind: Cheer["kind"] | null = x.given?.at ? "given" : x.slug === "complete_profile" ? "profile" : x.slug in RECRUITER_N ? "recruiter"
      : EVENT.has(x.slug) && days[x.slug] ? "event" : null;
    if (!kind) continue;
    const [name, how, about] = words(x);
    out.push({ slug: x.slug, icon: x.icon, color: x.color, name, how, about, kind,
      at: kind === "given" ? x.given?.at ?? null : kind === "event" ? days[x.slug] : null,
      given: kind === "given" && x.given?.at ? { line: givenLine(x.given.at), note: x.given.note || null } : null });
  }
  return out;
}

/** What this device remembers (localStorage in the browser): get and set, set answering false when it is refused. */
export type CheerStore = { get(k: string): string | null; set(k: string, v: string): boolean };

/** The one badge to pop up now, or null, and what this device remembers of it (the app's _bdgCelebrate, then
 *  _bdgProfCheer). `who`: the account's key in this browser's storage. `rode`: the friends who rode with the account's
 *  invite (null: not known). `filled`: the rider's own save just filled the profile (Race Ready). `pulse`: the server's
 *  Community badges are known (hub_pulse answered): they are left to it. */
export function pickCheer(list: Cheer[], o: { who: string; store: CheerStore; rode: number | null; filled: boolean; pulse: boolean; now?: number }): Cheer | null {
  const { who, store } = o, now = o.now ?? Date.now();
  const t = (s: string | null) => (s ? Date.parse(s) || 0 : 0);
  // the newest badge staff gave, while it is new, if this device has not shown one as new as it
  const given = list.filter((x) => x.kind === "given" && !(o.pulse && isCommunityBadge(x.slug))).sort((a, b) => t(b.at) - t(a.at))[0];
  if (given && fresh(given.at, now)) {
    const k = `mm_bdg_seen_${who}`;
    if (t(given.at) > (Number(store.get(k)) || 0)) return store.set(k, String(t(given.at))) ? given : null;
  }
  // the ones the site works out itself, in the app's order
  const kn = `mm_bdg_recn_${who}`;
  const wasRaw = store.get(kn);
  const was = wasRaw == null || wasRaw === "" || !Number.isFinite(Number(wasRaw)) ? null : Number(wasRaw);
  for (const slug of CHEER_ORDER) {
    const x = list.find((y) => y.slug === slug && y.kind !== "given");
    if (!x) continue;
    const due = slug === "complete_profile" ? o.filled
      : slug in RECRUITER_N ? o.rode != null && was != null && was < RECRUITER_N[slug] && RECRUITER_N[slug] <= o.rode
      : fresh(x.at, now);
    if (!due) continue;
    const k = `mm_bdg_${slug}_${who}`;
    if (store.get(k)) continue;
    if (!store.set(k, "1")) return null;
    if (slug in RECRUITER_N && o.rode != null) store.set(kn, String(o.rode));
    return x;
  }
  if (o.rode != null && was !== o.rode) store.set(kn, String(o.rode));
  return null;
}

/** An account's key in this browser's storage: a short hash of its id, so the id itself is never kept there. */
export function storeKey(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
