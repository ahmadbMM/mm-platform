// What My Account's record reads besides the account's own rows (lib/ride-record.ts): the kind of
// every session the rider booked, the badge catalogue, the weeks and the dated badges (the public
// key, as the booking app reads them), the badges staff gave this account (its own token), and
// the name of a bike handed over tonight.
import { rpcServer, type Account } from "./account";
import { getJson, rideKind } from "./rides";
import type { BadgeData, BadgeRow, RecordSession } from "./ride-record";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const env = () => ({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });

/** Every session by id (any state, past ones too), 80 to a request. */
export async function loadRecordSessions(ids: string[], fetchImpl: typeof fetch = fetch): Promise<Map<string, RecordSession>> {
  const { url, key } = env();
  const clean = [...new Set(ids)].filter((x) => ID.test(x)).slice(0, 800);
  const out = new Map<string, RecordSession>();
  if (!url || !key || !clean.length) return out;
  const chunks: string[][] = [];
  for (let i = 0; i < clean.length; i += 80) chunks.push(clean.slice(i, i + 80));
  await Promise.all(chunks.map(async (c) => {
    try {
      const rows = await getJson(fetchImpl, `${url}/rest/v1/sessions?select=id,ride_kind,event_kind,paid_ride&id=in.(${c.join(",")})`, key);
      if (!Array.isArray(rows)) return;
      for (const r of rows as Record<string, unknown>[]) {
        if (typeof r.id === "string") out.set(r.id, { kind: rideKind(r), freeRide: r.event_kind === "community" && r.paid_ride !== true });
      }
    } catch { /* that chunk counts as unknown sessions */ }
  }));
  return out;
}

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** The badge data: a function the database does not have, or a failed call, is an empty answer
 *  (no weeks: Perfect Week and Perfect Month cannot be told, as in the booking app). */
export async function loadBadgeData(a: Account): Promise<BadgeData> {
  const [cat, weeks, seasons, mine] = await Promise.all([
    rpcServer<unknown>("badge_catalog", {}), rpcServer<unknown>("badge_weeks", {}), rpcServer<unknown>("badge_seasons", {}),
    rpcServer<unknown>("customer_my_badges", { p_id: a.id, p_token: a.token }),
  ]);
  const w = list<{ w: string; ids: string[] }>(weeks.data);
  return {
    catalog: list<BadgeRow>(cat.data).filter((b) => b && typeof b.slug === "string"),
    weeks: w.length ? w : null,
    seasons: list<BadgeRow>(seasons.data).filter((b) => b && typeof b.slug === "string"),
    mine: list<BadgeRow>(mine.data).filter((b) => b && typeof b.slug === "string"),
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
