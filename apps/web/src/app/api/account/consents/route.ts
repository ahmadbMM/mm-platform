import { rpcServer } from "@/lib/account";
import { bodyOf, json, unreachable, writeSession } from "@/lib/account-route";
import { PRIVACY_VERSION } from "@/content/privacy-notice";

// POST /api/account/consents {privacy?: true, rideNews?: boolean}: the rider's two answers, as the
// booking app records them (customer_consents). `privacy` confirms they have read THIS version of
// the Privacy Notice (the server stamps PRIVACY_VERSION, never one the browser names); `rideNews`
// is their yes or no to ride news. Either may be left out. The answer is what is now on file.
type Consents = { privacy_version?: string | null; ride_news?: boolean; ride_news_at?: string | null };

export async function POST(req: Request) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const b = await bodyOf(req);
  const privacy = b.privacy === true ? PRIVACY_VERSION : null;
  const rideNews = b.rideNews === true || b.rideNews === false ? b.rideNews : null;
  if (!privacy && rideNews === null) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<Consents>("customer_consents", { p_id: w.session.id, p_token: w.session.token, p_privacy: privacy, p_ride_news: rideNews });
  if (unreachable(r)) return json({ ok: false, error: "generic" }, 502);
  if (!r.data || typeof r.data.ride_news !== "boolean") return json({ ok: false, error: "signin" }, 401);
  return json({ ok: true, rideNews: r.data.ride_news, privacyVersion: r.data.privacy_version ?? null });
}
