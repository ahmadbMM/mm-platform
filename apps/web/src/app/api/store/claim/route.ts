import { guard, json } from "@/lib/pay/http";
import { claimAdd } from "@/lib/sx-B4-api";

// POST /api/store/claim {no, key, item, text, photos}: a warranty claim from an order line (N31, builder B4): what is
// wrong (10-600 characters) and up to three photos this site stored in the order's folder (/api/store/claim-photo). The
// database checks the line is the order's own, handed over and within its warranty, with no claim open on it
// (store_after_claim), and staff take it from their queue. Nothing is sent by email or SMS: the order's page shows it.
export async function POST(req: Request) {
  const g = await guard(req, { signin: false });
  if (!g.ok) return g.res;
  const b = g.body;
  const no = typeof b.no === "number" ? b.no : Number(b.no);
  const key = typeof b.key === "string" ? b.key.trim().toLowerCase() : "";
  const item = typeof b.item === "number" ? b.item : Number(b.item);
  const r = await claimAdd({ no, key, item, text: typeof b.text === "string" ? b.text : "", photos: b.photos });
  return r.ok ? json({ ok: true }) : json({ ok: false, error: r.error }, r.status);
}
