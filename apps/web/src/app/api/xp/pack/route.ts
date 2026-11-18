import { guard, json, langOf, payError } from "@/lib/pay/http";
import { payRpc, refusal } from "@/lib/pay/server";

// A pack of sessions at one price (EF21; the user, 2026-11-18: "do all"; rentals SX B6: xp_pack_start). POST {pack, lang}:
// a signed-in rider buys an active pack staff made; the answer is the payment page. Once paid, the pack is a code of the
// rider's own with one use per session (each booking draws one at the review's "Use my pack").
export async function POST(req: Request) {
  const g = await guard(req, { signin: true });
  if (!g.ok) return g.res;
  const pack = typeof g.body.pack === "string" && /^[0-9a-f-]{36}$/i.test(g.body.pack) ? g.body.pack : "";
  if (!pack) return json({ ok: false, error: "invalid" }, 400);
  const r = await payRpc<{ id: string }>("xp_pack_start", { p_id: g.acct!.id, p_token: g.acct!.token, p_pack: pack, p_lang: langOf(g.body.lang) });
  if (r.status !== 200 || !r.data?.id) {
    const code = refusal(r);
    if (code.startsWith("XP_")) return json({ ok: false, error: code.toLowerCase() }, code === "XP_OFF" ? 403 : 400);
    const e = payError(r); return json({ ok: false, error: e.error }, e.status);
  }
  return json({ ok: true, url: `/pay/${r.data.id}` });
}
