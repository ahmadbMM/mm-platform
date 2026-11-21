import { rpcServer } from "@/lib/account";
import { bodyOf, json, unreachable, writeSession } from "@/lib/account-route";
import { emAbsent } from "@/lib/emergency";

// POST /api/account/hub-level {level}: a member picks the month's level in Your challenge on /club
// (components/club/ChallengeCard.tsx; the booking app's _hubPick) through hub_pick_level with the account cookie's id and
// token. The database alone decides which levels the month offers and that it is picked once (a second tap on the same
// one is fine). Answers {ok: true, level}, or {ok: false, error}: "refused" for a level it does not take, "chosen" when
// another level was picked already, "member" when the account is no longer a member, "signin" when its session has
// ended, "absent" when the database has no such function, "generic" when it could not be done. Only this site's pages
// may call it.
export async function POST(req: Request) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const b = await bodyOf(req);
  const level = b.level;
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 99) return json({ ok: false, error: "refused" }, 400);
  const r = await rpcServer<unknown>("hub_pick_level", { p_id: w.session.id, p_token: w.session.token, p_level: level });
  if (unreachable(r)) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return emAbsent(r) ? json({ ok: false, error: "absent" }, 404) : json({ ok: false, error: "generic" }, 502);
  const d = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  if (d?.ok === true) return json({ ok: true, level });
  const e = d?.error;
  if (e === "denied") return json({ ok: false, error: "signin" }, 401);
  if (e === "member") return json({ ok: false, error: "member" }, 403);
  if (e === "chosen") return json({ ok: false, error: "chosen" }, 409);
  if (e === "level") return json({ ok: false, error: "refused" }, 400);
  return json({ ok: false, error: "generic" }, 502);
}
