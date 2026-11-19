import { rpcServer } from "@/lib/account";
import { bodyOf, json, unreachable, writeSession } from "@/lib/account-route";

// POST /api/account/consents {rideNews: boolean}: the rider's yes or no to ride news (WhatsApp: new rides, schedules,
// offers and community news), as the booking app records it (customer_consents; its Account > Notifications,
// toggleRideNews). The answer is what is now on file: {ok: true, rideNews}, or {ok: false, error}: "invalid", "signin"
// (a session the database refused), "generic" (no answer). Only this site's pages may call it, signed in.
type Consents = { privacy_version?: string | null; ride_news?: boolean; ride_news_at?: string | null };

export async function POST(req: Request) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const b = await bodyOf(req);
  if (b.rideNews !== true && b.rideNews !== false) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<Consents>("customer_consents", { p_id: w.session.id, p_token: w.session.token, p_privacy: null, p_ride_news: b.rideNews });
  if (unreachable(r)) return json({ ok: false, error: "generic" }, 502);
  if (!r.data || typeof r.data.ride_news !== "boolean") return json({ ok: false, error: r.status >= 400 ? "generic" : "signin" }, r.status >= 400 ? 502 : 401);
  return json({ ok: true, rideNews: r.data.ride_news });
}
