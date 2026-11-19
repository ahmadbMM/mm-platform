import { forVisitor, rpcServer } from "@/lib/account";
import { bodyOf, json, unreachable, writeSession } from "@/lib/account-route";

// POST /api/account/company {code}: joins a company challenge by its code (the booking app's Account > Company challenge,
// company_challenge_join of rentals 20261114082600). The database judges the code (unknown, ended, too many tries from
// this network); the answer is {ok} or {ok: false, error: "code" | "ended" | "busy" | "signin" | "generic"}.
export async function POST(req: Request) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const b = await bodyOf(req);
  const code = typeof b.code === "string" ? b.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12) : "";
  if (!code) return json({ ok: false, error: "code" }, 400);
  const r = await rpcServer<{ ok?: boolean; error?: string }>("company_challenge_join", forVisitor(req, { p_id: w.session.id, p_token: w.session.token, p_code: code }));
  if (unreachable(r) || r.status >= 400 || !r.data) return json({ ok: false, error: "generic" }, 502);
  if (r.data.ok === true) return json({ ok: true });
  const e = String(r.data.error ?? "");
  return json({ ok: false, error: e === "denied" ? "signin" : e === "busy" ? "busy" : e === "ended" ? "ended" : e === "not_found" || e === "code" ? "code" : "generic" }, e === "denied" ? 401 : 400);
}
