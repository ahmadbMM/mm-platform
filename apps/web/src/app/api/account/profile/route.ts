import { rpcServer } from "@/lib/account";
import { bodyOf, json, unreachable, writeSession } from "@/lib/account-route";
import { aboutArgs, cleanChanges, profileArgs, profileError, socialsChanged, type AboutRow, type ProfileChanges, type ProfileRow } from "@/lib/account-profile";

// POST /api/account/profile {changes}: the account's details saved as the booking app's saveAccount
// saves them. The form sends only what the rider changed; the account is read again here
// (customer_profile, customer_about) and every field they left alone is written back as it is on
// file now, so a staff correction made since the page was drawn is never undone. Then, each only
// when something in it changed: customer_update_profile (name, email, mobile, height, bike type,
// birth date, country, city, nationality), customer_set_socials, customer_set_about (gender,
// profession, company, how they heard of us).
export async function POST(req: Request) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const { id, token } = w.session;
  const body = await bodyOf(req);
  const changes = body.changes && typeof body.changes === "object" && !Array.isArray(body.changes) ? (body.changes as ProfileChanges) : null;
  if (!changes) return json({ ok: false, error: "invalid" }, 400);

  const [p, a] = await Promise.all([
    rpcServer<ProfileRow[]>("customer_profile", { p_id: id, p_token: token }),
    rpcServer<AboutRow[]>("customer_about", { p_id: id, p_token: token }),
  ]);
  if (unreachable(p)) return json({ ok: false, error: "generic" }, 502);
  const cur = Array.isArray(p.data) ? p.data[0] : null;
  if (!cur) return json({ ok: false, error: "signin" }, 401);
  const ab = Array.isArray(a.data) ? a.data[0] ?? null : null;

  const c = cleanChanges(changes, cur);
  if ("error" in c) return json({ ok: false, error: c.error }, 400);
  const fail = (r: { status: number; message: string; details?: string }) => {
    if (unreachable(r)) return json({ ok: false, error: "generic" }, 502);
    const e = profileError(r.message, r.details);
    return json({ ok: false, error: e }, e === "signin" ? 401 : e === "rate" ? 429 : e === "phone_taken" || e === "email_taken" ? 409 : 400);
  };

  const args = profileArgs(cur, c.ok.core);
  if (args) {
    const r = await rpcServer<boolean>("customer_update_profile", { p_id: id, p_token: token, ...args });
    if (r.status >= 400 || r.status === 0) return fail(r);
    if (r.data !== true) return json({ ok: false, error: "signin" }, 401);
  }
  if (c.ok.socials !== undefined && socialsChanged(c.ok.socials, cur.socials)) {
    const r = await rpcServer<boolean>("customer_set_socials", { p_id: id, p_token: token, p_socials: c.ok.socials ?? {} });
    if (r.status >= 400 || r.status === 0) return fail(r);
    if (r.data !== true) return json({ ok: false, error: "signin" }, 401);
  }
  if (Object.keys(c.ok.about).length) {
    if (!ab) return json({ ok: false, error: unreachable(a) ? "generic" : "signin" }, unreachable(a) ? 502 : 401);
    const aa = aboutArgs(ab, cur, c.ok.about);
    if (aa) {
      const r = await rpcServer<boolean>("customer_set_about", { p_id: id, p_token: token, ...aa });
      if (r.status >= 400 || r.status === 0) return fail(r);
      if (r.data !== true) return json({ ok: false, error: "signin" }, 401);
    }
  }
  return json({ ok: true });
}
