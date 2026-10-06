// What My Account's tickets read besides the account's own rows (lib/tickets.ts): the booked
// sessions as the ticket needs them, and whether anyone still waiting holds a lower number -
// both with the public key, as the booking app's own customers read them (queue_public carries
// no names). The sessions are read for the signed-in account (list_sessions with its token,
// lib/rides.ts readSessions): a private ride - one only riders with its tag may see - is hidden
// from the public key, and its ticket, waiver and rating would lose their ride.
import { getJson, SESSION_COLS_REVEAL, sessionRows, type SessionReader } from "./rides";
import { ticketSession, type TicketSession } from "./tickets";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
// The route column rides along through sessionRows, which leaves it out while the database does not have it yet.
const COLS = "id,session_date,day,title,ride_kind,event_kind,bike_slots,needs_approval,hide_queue,meet_url,paid_ride,open_to_all,status,location,breakfast_name,breakfast_url";
// The breakfast stop's Arabic name and offer (rentals migration 20261004130000): a group of their own,
// left out while the database does not have them yet, without taking the route along.
const BF_COLS = "breakfast_name_ar,breakfast_offer_en,breakfast_offer_ar";

/** The booked sessions by id, whatever their state (a closed night still shows its ticket), as
 *  `account` may see them (every public session, and the private ones it holds a booking on). */
export async function loadTicketSessions(ids: string[], account: SessionReader | null = null, fetchImpl: typeof fetch = fetch): Promise<Map<string, TicketSession>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const clean = [...new Set(ids)].filter((x) => ID.test(x)).slice(0, 40);
  if (!url || !key || !clean.length) return new Map();
  try {
    const rows = await sessionRows(fetchImpl, url, key, `id=in.(${clean.join(",")})`, COLS, Date.now(), { optional: [BF_COLS, SESSION_COLS_REVEAL], account });
    const list = Array.isArray(rows) ? rows.map((r) => ticketSession(r as Record<string, unknown>)).filter((x): x is TicketSession => x !== null) : [];
    return new Map(list.map((s) => [s.id, s]));
  } catch {
    return new Map();
  }
}

/** Whether anyone still waiting on the night holds a lower number than `queueNum`: the booking
 *  app's "You're next!" / "You're in the queue". Null when it could not be read. */
export async function anyoneAhead(sessionId: string, queueNum: number, fetchImpl: typeof fetch = fetch): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !ID.test(sessionId) || !Number.isInteger(queueNum)) return null;
  try {
    const rows = await getJson(fetchImpl, `${url}/rest/v1/queue_public?select=id&session_id=eq.${sessionId}&status=eq.waiting&queue_num=lt.${queueNum}&limit=1`, key);
    return Array.isArray(rows) ? rows.length > 0 : null;
  } catch {
    return null;
  }
}
