import { marketGuard, mkAnswer, mkRefuse } from "@/lib/market/route";
import { mkListingSave, purgeLater } from "@/lib/market/server";
import { w2BodyFields } from "@/lib/market/w2";

// POST /api/market/listing/save: a new draft, or a change to one of the account's own listings (market_listing_save,
// with the account cookie's id and token). Body: {id: number | null, fields: {...}} - `id` null makes a draft; `fields`
// holds only the keys that changed (a key left out stays as it is, null clears it): category, title, description,
// condition, faults, price, negotiable, city, facts, serial, declarations, photos. Each is checked for its shape here
// (lib/market/w2.ts w2BodyFields) before the database is asked; the database decides the rest and its refusal comes
// back as the error id and the word after its colon ("input" + "title", "link" + "description", "limit" + "drafts").
// Answers {ok: true, listing, purge}. A photo the seller took off the listing is marked by the database (`purge` says
// how many); it is removed from the storage behind this answer.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await marketGuard(req);
  if (!g.ok) return g.res;
  const raw = g.body.id ?? null;
  const id = raw === null ? null : typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0 ? raw : undefined;
  const fields = w2BodyFields(g.body.fields);
  if (id === undefined || !fields) return mkRefuse("invalid", 400);
  const r = await mkListingSave(g.session, id, fields, req);
  if (r.ok && r.data.purge > 0) purgeLater();
  return mkAnswer(r);
}
