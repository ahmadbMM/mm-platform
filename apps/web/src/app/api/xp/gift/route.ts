import { guard, json, langOf, payError } from "@/lib/pay/http";
import { payRpc, refusal } from "@/lib/pay/server";
import { giftName, GIFT_CODE } from "@/lib/sx-b6";

// Gifting a ride (EF20; the user, 2026-11-18: "do all"), behind staff's xp.gifts switch (rentals SX B6: xp_gift_start).
// POST {kind, type, forName?, note?, lang}: a signed-in rider buys one rider's place on one bike type at today's fare; the
// answer is the payment page to pay it on. GET ?code=GF-XXXXXXXX: what a gift is (its kind, bike type, the friend's first
// name and message, and whether it is ready, used, expired or void), never who bought it; nothing for an unknown code.
// A database without the functions answers 404, which the page reads as no gift (the feature hides).
export async function POST(req: Request) {
  const g = await guard(req, { signin: true });
  if (!g.ok) return g.res;
  const kind = g.body.kind === "jcc" ? "jcc" : "";
  const type = typeof g.body.type === "string" && /^[A-Za-z ]{2,30}$/.test(g.body.type) ? g.body.type : "";
  const forName = typeof g.body.forName === "string" ? giftName(g.body.forName) : "";
  const note = typeof g.body.note === "string" ? g.body.note.trim().slice(0, 200) : "";
  if (!kind || !type || type === "Any" || type === "Own") return json({ ok: false, error: "invalid" }, 400);
  const r = await payRpc<{ id: string }>("xp_gift_start", {
    p_id: g.acct!.id, p_token: g.acct!.token, p_kind: kind, p_type: type, p_for: forName || null, p_note: note || null, p_lang: langOf(g.body.lang),
  });
  if (r.status !== 200 || !r.data?.id) {
    const code = refusal(r);
    if (code.startsWith("XP_")) return json({ ok: false, error: code.toLowerCase() }, code === "XP_OFF" ? 403 : 400);
    const e = payError(r); return json({ ok: false, error: e.error }, e.status);
  }
  return json({ ok: true, url: `/pay/${r.data.id}` });
}

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!GIFT_CODE.test(code)) return json({ ok: false, error: "invalid" }, 400);
  const r = await payRpc<Record<string, unknown> | null>("xp_gift_view", { p_code: code }, undefined, req);
  if (r.status !== 200 || !r.data || typeof r.data !== "object") return json({ ok: false, error: "not_found" }, 404);
  const d = r.data;
  return json({ ok: true, gift: { kind: d.kind, type: d.bike_type, forName: d.for_name ?? null, note: d.note ?? null, status: d.status, expires: d.expires_on ?? null } });
}
