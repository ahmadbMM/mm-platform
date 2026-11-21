import { forVisitor, rpcServer } from "@/lib/account";
import { bodyOf, json, unreachable, writeSession } from "@/lib/account-route";

// POST /api/account/whatsapp {same, phone}: the account's WhatsApp number, as the booking app's Contact page saves it
// (saveWhatsapp, customer_set_whatsapp of rentals 20261007223000): the mobile itself (same: true), or another number
// (same: false, phone "+9665..."). The database checks the number again (wa_* refusals) and meters the change.
export async function POST(req: Request) {
  const w = writeSession(req);
  if ("refuse" in w) return w.refuse;
  const b = await bodyOf(req);
  if (typeof b.same !== "boolean") return json({ ok: false, error: "invalid" }, 400);
  const phone = b.same ? null : typeof b.phone === "string" ? b.phone.replace(/[^0-9+]/g, "").slice(0, 16) : "";
  if (!b.same && !/^\+?[0-9]{8,15}$/.test(phone ?? "")) return json({ ok: false, error: "wa" }, 400);
  const r = await rpcServer<boolean>("customer_set_whatsapp", forVisitor(req, { p_id: w.session.id, p_token: w.session.token, p_same: b.same, p_phone: phone }));
  if (unreachable(r)) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) {
    const m = `${r.message} ${r.details ?? ""}`;
    return json({ ok: false, error: /wa_/.test(m) ? "wa" : /RATE_LIMITED/.test(m) ? "rate" : /BAD_TOKEN|denied/i.test(m) ? "signin" : "generic" }, /wa_/.test(m) ? 400 : 409);
  }
  if (r.data !== true) return json({ ok: false, error: "signin" }, 401);
  return json({ ok: true });
}
