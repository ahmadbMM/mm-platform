// What My Account's record reads besides the account's own rows (lib/ride-record.ts): the kind of
// every session the rider booked (as the account may see them: a private ride too, through its
// token), the badge catalogue, the weeks and the dated badges (the public key, as the booking app
// reads them), the badges staff gave this account and the badges it asked for (its own token), and
// the name of a bike handed over tonight.
import { rpcServer, type Account } from "./account";
import { getJson, readSessions, rideKind, type RideKind, type SessionReader } from "./rides";
import type { BadgeData, BadgeRow, RecordSession } from "./ride-record";
import { badgeReqs } from "./badge-request";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const env = () => ({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });

/** Every session by id (any state, past ones too), 80 to a request, as `account` may see them. */
export async function loadRecordSessions(ids: string[], account: SessionReader | null = null, fetchImpl: typeof fetch = fetch): Promise<Map<string, RecordSession>> {
  const { url, key } = env();
  const clean = [...new Set(ids)].filter((x) => ID.test(x)).slice(0, 800);
  const out = new Map<string, RecordSession>();
  if (!url || !key || !clean.length) return out;
  const chunks: string[][] = [];
  for (let i = 0; i < clean.length; i += 80) chunks.push(clean.slice(i, i + 80));
  await Promise.all(chunks.map(async (c) => {
    try {
      const rows = await readSessions(fetchImpl, url, key, `select=id,ride_kind,event_kind,paid_ride,needs_approval,bike_slots&id=in.(${c.join(",")})`, account);
      if (!Array.isArray(rows)) return;
      for (const r of rows as Record<string, unknown>[]) {
        // a community ride as the booking app's _isCommunity reads it: the National Day ride (snd96) is not one
        const comm = r.event_kind === "community" && r.ride_kind !== "snd96";
        if (typeof r.id === "string") out.set(r.id, { kind: rideKind(r), freeRide: comm && r.paid_ride !== true, approval: comm && r.needs_approval !== false, groupKm: groupKm(r.bike_slots), km: rideKm(r.bike_slots) });
      }
    } catch { /* that chunk counts as unknown sessions */ }
  }));
  return out;
}

/** The kinds of session the account can still book, for Stats' kinds tried (lib/landmarks.ts triedKinds; the booking
 *  app's _lmKindsHtml): the sessions it is sent, open or full, today (Riyadh) or later, read through list_sessions with
 *  its own token, so a private ride it may see counts too. The Petromin nights are left out: the site lists them on
 *  Experiences alone. Null when they could not be read: the checklist then shows nothing rather than the kinds done alone. */
export async function loadOpenKinds(today: string, account: SessionReader | null, fetchImpl: typeof fetch = fetch): Promise<Set<RideKind> | null> {
  const { url, key } = env();
  if (!url || !key || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  try {
    const rows = await readSessions(fetchImpl, url, key, `select=id,session_date,status,ride_kind,event_kind&session_date=gte.${today}&status=in.(open,full)&limit=500`, account);
    if (!Array.isArray(rows)) return null;
    return new Set((rows as Record<string, unknown>[]).filter((r) => r && typeof r.id === "string").map((r) => rideKind(r)).filter((k) => k !== "petromin"));
  } catch {
    return null;
  }
}

/** The Saturday ride's two distances (the booking app's _rgKm): the ride's own, kept in its bike_slots as
 *  _km {beg, int}, else the usual 20 and 40 km. */
export function groupKm(slots: unknown): { beg: number; int: number } {
  let o: unknown = slots;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  const k = o && typeof o === "object" ? (o as Record<string, unknown>)._km : null;
  const v = (g: "beg" | "int", d: number) => { const n = k && typeof k === "object" ? Number((k as Record<string, unknown>)[g]) : NaN; return n > 0 && n <= 500 ? n : d; };
  return { beg: v("beg", 20), int: v("int", 40) };
}

/** Any other bike ride's one distance (the booking app's _rideKm, 2026-10-17): _km {all} in its bike_slots, else
 *  none - a ride without one adds no kilometres. */
export function rideKm(slots: unknown): number {
  let o: unknown = slots;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  const k = o && typeof o === "object" ? (o as Record<string, unknown>)._km : null;
  const n = k && typeof k === "object" ? Number((k as Record<string, unknown>).all) : NaN;
  return n > 0 && n <= 500 ? n : 0;
}

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** The badge data: a function the database does not have, or a failed call, is an empty answer
 *  (no weeks: Perfect Week and Perfect Month cannot be told, as in the booking app). The badge
 *  requests (rentals 20261108210000) are null then: the page offers none. */
export async function loadBadgeData(a: Account): Promise<BadgeData> {
  const [cat, weeks, seasons, mine, reqs] = await Promise.all([
    rpcServer<unknown>("badge_catalog", {}), rpcServer<unknown>("badge_weeks", {}), rpcServer<unknown>("badge_seasons", {}),
    rpcServer<unknown>("customer_my_badges", { p_id: a.id, p_token: a.token }),
    rpcServer<unknown>("customer_my_badge_requests", { p_id: a.id, p_token: a.token }),
  ]);
  const w = list<{ w: string; ids: string[] }>(weeks.data);
  return {
    catalog: list<BadgeRow>(cat.data).filter((b) => b && typeof b.slug === "string"),
    weeks: Array.isArray(weeks.data) ? w : null, // an empty answer is known (no week of two sessions yet); only a failed call is not
    seasons: list<BadgeRow>(seasons.data).filter((b) => b && typeof b.slug === "string"),
    mine: list<BadgeRow>(mine.data).filter((b) => b && typeof b.slug === "string"),
    requests: reqs.status === 0 || reqs.status >= 400 ? null : badgeReqs(reqs.data),
  };
}

/** A bike's name ("B-12") by its id, or null when the public key cannot see it. */
export async function bikeName(id: string | null, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const { url, key } = env();
  if (!id || !url || !key || !ID.test(id)) return null;
  try {
    const rows = await getJson(fetchImpl, `${url}/rest/v1/bikes?select=name&id=eq.${id}&limit=1`, key);
    const n = Array.isArray(rows) ? (rows[0] as { name?: unknown } | undefined)?.name : null;
    return typeof n === "string" && n.trim() ? n.trim() : null;
  } catch {
    return null;
  }
}
