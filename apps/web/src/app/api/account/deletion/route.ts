import { rpcServer } from "@/lib/account";
import { bodyOf, json, unreachable, writeSession } from "@/lib/account-route";

// POST /api/account/deletion {request: true | false}: ask for the account to be deleted, or withdraw
// the request (customer_deletion_request; Personal Data Protection Law, Art. 4). Staff act on it
// within 30 days, after checking for live bookings or money owed. The answer is the day it was
// asked for, or null once withdrawn.
export async function POST(req: Request) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const b = await bodyOf(req);
  if (b.request !== true && b.request !== false) return json({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<{ requested_at?: string | null }>("customer_deletion_request", { p_id: w.session.id, p_token: w.session.token, p_request: b.request });
  if (unreachable(r)) return json({ ok: false, error: "generic" }, 502);
  if (!r.data || typeof r.data !== "object" || !("requested_at" in r.data)) return json({ ok: false, error: "signin" }, 401);
  return json({ ok: true, requestedAt: r.data.requested_at ?? null });
}
