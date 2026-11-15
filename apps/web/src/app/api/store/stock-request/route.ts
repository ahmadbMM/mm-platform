import { guard, json, langOf } from "@/lib/pay/http";
import { stockRequest } from "@/lib/store-api";
import { storePhone } from "@/lib/store-form";

// POST /api/store/stock-request (F34): a shopper asks to be told when a sold-out size, colour or product is back. The
// name and mobile are kept for staff (store_stock_request, rentals 20261115235500), who message them on WhatsApp by hand
// when it is: nothing is sent from here, no email and no SMS. The database checks the variant is a published product's
// and meters each shopper (STORE_BUSY: the call names the shopper's address, lib/account.ts forVisitor, or every shopper
// would share the Worker's one meter); a second request for the same choice and mobile answers the open one.
// Body: {variant, name, phone, lang}. Answers {ok: true} or {ok: false, error: name | phone | gone | busy | invalid | ...}.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const b = g.body;
  const variant = typeof b.variant === "string" ? b.variant.trim().toLowerCase() : "";
  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
  const phone = storePhone(typeof b.phone === "string" ? b.phone.slice(0, 30) : "");
  if (!UUID.test(variant)) return json({ ok: false, error: "invalid" }, 400);
  if (name.length < 2 || name.length > 60) return json({ ok: false, error: "name" }, 400);
  if (!phone) return json({ ok: false, error: "phone" }, 400);
  const r = await stockRequest({ variant, name, phone, lang: langOf(b.lang) }, req);
  return r.ok ? json({ ok: true }) : json({ ok: false, error: r.error }, r.status);
}
