import { rpcServer } from "@/lib/account";
import { bodyOf, json, unreachable, writeSession } from "@/lib/account-route";
import { cleanFix, fixClean, photoBase, profileError, type FixValues } from "@/lib/account-profile";

// POST /api/account/fix {values}: the details staff asked the rider to correct (and the ones the
// server asks for itself: a password for an account with none, a real email for a hidden Apple
// one, a community member's birth date and nationality), saved with customer_fix_save. What is
// asked is read again here (customer_fix_fields), each answer is checked as the booking app's
// check-up checks it, and the answer lists what is still asked - nothing, once all is saved.
export async function POST(req: Request) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const { id, token } = w.session;
  const b = await bodyOf(req);
  const raw = b.values && typeof b.values === "object" && !Array.isArray(b.values) ? (b.values as Record<string, unknown>) : null;
  if (!raw) return json({ ok: false, error: "invalid" }, 400);
  const values: FixValues = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") (values as Record<string, string>)[k] = v.slice(0, 300);

  const asked = await rpcServer<string[]>("customer_fix_fields", { p_id: id, p_token: token });
  if (unreachable(asked)) return json({ ok: false, error: "generic" }, 502);
  if (asked.status >= 400) return json({ ok: false, error: "signin" }, 401);
  const fields = fixClean(asked.data);
  if (!fields.length) return json({ ok: true, left: [] });
  const c = cleanFix(fields, values, photoBase(process.env.NEXT_PUBLIC_SUPABASE_URL || ""));
  if ("errors" in c) return json({ ok: false, error: "check", errors: c.errors }, 400);

  const r = await rpcServer<string[] | null>("customer_fix_save", { p_id: id, p_token: token, p_values: c.values });
  if (unreachable(r)) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) {
    const e = profileError(r.message, r.details);
    if (e === "email_taken") return json({ ok: false, error: "check", errors: { email: "email_taken" } }, 409);
    if (e === "phone_taken") return json({ ok: false, error: "check", errors: { phone: "phone_taken" } }, 409);
    if (e === "name_short" || e === "name_chars") return json({ ok: false, error: "check", errors: { name: e } }, 400);
    return json({ ok: false, error: e === "signin" ? "signin" : "generic" }, e === "signin" ? 401 : 400);
  }
  if (!Array.isArray(r.data)) return json({ ok: false, error: "signin" }, 401);
  return json({ ok: true, left: fixClean(r.data) });
}
