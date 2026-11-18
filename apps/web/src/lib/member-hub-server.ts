import type { Session } from "./account-core";
import { readBookings, rpcServer } from "./account";
import { hubMonthOf, hubPlanOf, monthDue, type HubMonth, type HubPlan } from "./member-hub";
import { SESSION_COLS_FBK, SESSION_COLS_GENDER, SESSION_COLS_TITLE_AR, sessionRows } from "./rides";
import { bupBookings, bupEvent, bupFrom, bupSession, buildupPlan, dayPlus, type BupPlan, type BupSession } from "./buildup-plan";
import type { SessionGender } from "./session-gender";

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
export async function readBuildup(acct: Session, today: string, gender: SessionGender | null, open: (s: BupSession) => boolean): Promise<BupPlan | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^\d{4}-\d\d-\d\d$/.test(today)) return null;
  const raw = await readBookings(acct);
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
