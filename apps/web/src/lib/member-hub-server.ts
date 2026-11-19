import type { Session } from "./account-core";
import { readBookings, rpcServer } from "./account";
import { hubMonthOf, hubPlanOf, monthDue, type HubMonth, type HubPlan } from "./member-hub";
import { SESSION_COLS_FBK, SESSION_COLS_GENDER, SESSION_COLS_TITLE_AR, sessionRows } from "./rides";
import { bupBookings, bupEvent, bupFrom, bupSession, buildupPlan, dayPlus, type BupPlan, type BupSession } from "./buildup-plan";
import type { SessionGender } from "./session-gender";
import { interestsOf, type Interests } from "./member-interests";
import { rsgRows, type RsgRow } from "./ride-suggestions";
import { ramadanOf, type Ramadan } from "./hub-season";
import { hubFeedOf, inviteCodeOf, type HubFeed } from "./hub-feed";
import { mentorFeedOf, type MtFeed } from "./mentorship";
import { firstFiveIds, firstFiveTab } from "./first-five";
import { loadRecordSessions } from "./ride-record-data";

/** Plan my Saturdays and My month for a signed-in member of /club (lib/member-hub.ts), read with the account's own
 *  token, at once: hub_plan always, hub_month only from the 26th (Riyadh's `today`, "YYYY-MM-DD"), as the booking app
 *  asks it. A piece whose read failed is null. */
export async function readMemberHub(acct: Session, today: string): Promise<{ plan: HubPlan | null; month: HubMonth | null }> {
  const args = { p_id: acct.id, p_token: acct.token };
  const [p, m] = await Promise.all([rpcServer<unknown>("hub_plan", args), monthDue(today) ? rpcServer<unknown>("hub_month", args) : null]);
  return { plan: hubPlanOf(p, today), month: m ? hubMonthOf(m, today) : null };
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const rowsOf = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

/** The Build-up plan for a signed-in member of /club (lib/buildup-plan.ts; the booking app's _bupHtml, 2026-11-18), from
 *  the member's own bookings (my_bookings) and the sessions as the account sees them (list_sessions with its token): the
 *  sessions they hold a place on still to come, and, only once one of them is marked, the community sessions from the
 *  card's first Saturday to the day before the event. Nothing else is read, and nothing is kept. `gender`: the member's,
 *  for a ride for one gender; `open(s)`: the booking window has opened on that ride. Null: no card (none marked, no
 *  Saturday left, or a read that failed). */
export async function readBuildup(acct: Session, today: string, gender: SessionGender | null, open: (s: BupSession) => boolean,
  rows?: Promise<Record<string, unknown>[] | null>): Promise<BupPlan | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^\d{4}-\d\d-\d\d$/.test(today)) return null;
  const raw = await (rows ?? readBookings(acct));
  if (!raw) return null;
  const bookings = bupBookings(raw);
  const held = [...new Set(rowsOf(raw).filter((r) => (r.status === "waiting" || r.status === "active") && String(r.session_date ?? "").slice(0, 10) > today)
    .map((r) => String(r.session_id ?? "")).filter((id) => ID.test(id)))].slice(0, 40);
  if (!held.length) return null;
  const account = { id: acct.id, token: acct.token };
  try {
    const sessions = new Map<string, BupSession>();
    const put = (v: unknown) => { for (const r of rowsOf(v)) { const s = bupSession(r); if (s) sessions.set(s.id, s); } };
    put(await sessionRows(fetch, url, key, `id=in.(${held.join(",")})`, "id,session_date,status,title,ride_kind,event_kind,bike_slots", Date.now(),
      { optional: [SESSION_COLS_TITLE_AR, SESSION_COLS_FBK], account }));
    const ev = bupEvent(bookings, sessions, today);
    if (!ev) return null;
    put(await sessionRows(fetch, url, key, `event_kind=eq.community&session_date=gte.${bupFrom(bookings, ev)}&session_date=lte.${dayPlus(ev.date, -1)}&order=session_date.asc&limit=200`,
      "id,session_date,status,ride_kind,event_kind,bike_slots", Date.now(), { optional: [SESSION_COLS_GENDER, SESSION_COLS_FBK], account }));
    return buildupPlan(bookings, sessions, today, gender, open);
  } catch {
    return null;
  }
}

/** My interests for a signed-in member of /club (lib/member-interests.ts; the booking app's _intFetch, 2026-11-18):
 *  member_interests_get with the account's own token, never kept. Null: no card (a refusal, not a member, a database
 *  without the function, no answer). */
export async function readInterests(acct: Session): Promise<Interests | null> {
  return interestsOf(await rpcServer<unknown>("member_interests_get", { p_id: acct.id, p_token: acct.token }));
}

/** Suggest a ride for a signed-in member of /club (lib/ride-suggestions.ts; the booking app's _rsgFetch, 2026-11-18): the
 *  member's own suggestions (ride_suggestions_mine with the account's own token), never kept. Null: no card (a refusal, a
 *  database without the function, no answer). */
export async function readSuggestions(acct: Session): Promise<RsgRow[] | null> {
  return rsgRows(await rpcServer<unknown>("ride_suggestions_mine", { p_id: acct.id, p_token: acct.token }));
}

/** The Ramadan season for a signed-in member of /club (lib/hub-season.ts; the booking app's _ssnFetch, 2026-11-18): hub_season
 *  with the account's own token. Null: no Ramadan known, a refusal, or a database without the function. */
export async function readSeason(acct: Session): Promise<Ramadan | null> {
  return ramadanOf(await rpcServer<unknown>("hub_season", { p_id: acct.id, p_token: acct.token }));
}

/** The Community tab's one read for a signed-in member of /club (lib/hub-feed.ts; the booking app's _hubFetch): hub_feed
 *  with the account's own token, never kept. It is asked without an entry point (p_src), as the app's own re-reads are, so
 *  the app's count of where its tab is opened from is not changed by the website. Null: none of its cards. */
export async function readHubFeed(acct: Session): Promise<HubFeed | null> {
  return hubFeedOf(await rpcServer<unknown>("hub_feed", { p_id: acct.id, p_token: acct.token }));
}

/** The Mentorship programme for a signed-in member of /club (lib/mentorship.ts; the booking app's _mtFetch): mentor_feed
 *  with the account's own token, never kept. Null: no card (a database without the programme, a refusal, no answer). */
export async function readMentor(acct: Session): Promise<MtFeed | null> {
  return mentorFeedOf(await rpcServer<unknown>("mentor_feed", { p_id: acct.id, p_token: acct.token }));
}

/** The member's own invitation code (member_invite_code, the booking app's _invEnsure: made on its first read), read
 *  before the tap, as a phone opens its share sheet only from the tap itself. Null: no invitation button. */
export async function readInviteCode(acct: Session): Promise<string | null> {
  return inviteCodeOf(await rpcServer<unknown>("member_invite_code", { p_id: acct.id, p_token: acct.token }));
}

/** The first five rides on /club (lib/first-five.ts firstFiveTab; the booking app's _p5Tab), from the account's own
 *  bookings (`rows`, read once for the page) and their sessions' kinds, counted only once every finished booking's
 *  session came back, as the app counts only from a whole read. Null: the month's challenge stays. */
export async function readFirstFive(acct: Session, rows: Record<string, unknown>[] | null): Promise<{ n: number; tg: number } | null> {
  if (!rows) return null;
  const ids = firstFiveIds(rows);
  const sessions = ids.length ? await loadRecordSessions(ids, acct) : new Map();
  return ids.every((id) => sessions.has(id)) ? firstFiveTab(rows, sessions) : null;
}
