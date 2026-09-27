// The live ride map's data (app/api/live, components/live/LiveMap.tsx): where the ride leader and
// the sweeper are, as live_positions_for hands it to a rider with a booking on the session. The
// plain logic - reading the function's answer, and the rows in it - so it can be tested.

export type LiveRole = "leader" | "sweeper";
export type LivePosition = { role: LiveRole; lat: number; lng: number; heading: number | null; speed: number | null; at: string };
export type LiveAnswer =
  | { ok: true; positions: LivePosition[]; now: string }
  /** signin: no session, or one the booking app no longer accepts · not_booked: no booking on this
   *  ride · unavailable: the database does not have the function yet · network: no answer at all. */
  | { ok: false; error: "signin" | "not_booked" | "unavailable" | "network" };

export const SESSION_ID = /^[A-Za-z0-9_-]{1,64}$/;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The well-formed rows of the answer's `positions`, one per role, the leader first. */
export function cleanPositions(v: unknown): LivePosition[] {
  if (!Array.isArray(v)) return [];
  const out = new Map<LiveRole, LivePosition>();
  for (const r of v as Record<string, unknown>[]) {
    if (!r || typeof r !== "object") continue;
    const role = r.role === "leader" || r.role === "sweeper" ? r.role : null;
    const lat = num(r.lat), lng = num(r.lng);
    if (!role || lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || out.has(role)) continue;
    out.set(role, { role, lat, lng, heading: num(r.heading), speed: num(r.speed), at: typeof r.at === "string" ? r.at : "" });
  }
  return [...out.values()].sort((a) => (a.role === "leader" ? -1 : 1));
}

/** What the function's answer means (lib/account.ts rpcServer's shape). */
export function liveAnswer(r: { status: number; data: unknown; message: string }): LiveAnswer {
  if (r.status === 0) return { ok: false, error: "network" };
  // PostgREST: an unknown function is 404 with PGRST202 (the migration is not applied yet)
  if (r.status === 404 || /PGRST202/.test(r.message)) return { ok: false, error: "unavailable" };
  if (r.status >= 500) return { ok: false, error: "network" };
  const d = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  if (!d || d.ok !== true) {
    const e = d?.error;
    return { ok: false, error: e === "not_booked" ? "not_booked" : e === "denied" ? "signin" : "unavailable" };
  }
  return { ok: true, positions: cleanPositions(d.positions), now: typeof d.now === "string" ? d.now : "" };
}

/** One cookie's value out of a Cookie header, or null. */
export function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}
