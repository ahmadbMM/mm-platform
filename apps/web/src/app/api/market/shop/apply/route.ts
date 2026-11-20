import { marketGuard, mkAnswer, mkRefuse } from "@/lib/market/route";
import { mkShopApply } from "@/lib/market/server";
import { w4BodyFields } from "@/lib/market/w4";

// POST /api/market/shop/apply: the signed-in account sends its shop's application, sends a waiting or refused one
// again, or changes the details an approved shop leaves open (market_shop_apply decides which, by the shop the
// account already has; one shop per account).
// Body: {fields: MkShopFields}: the trade name in English (and Arabic), the commercial registration number and its
// activity, the VAT number if the shop has one, the city, address and map link, the phone and WhatsApp, what it
// sells, about the shop, its return terms, the logo's stored name (uploaded through POST /api/market/photo with
// for=shop once the shop exists), and `agreement`: the version of the rules the form showed.
// The account is the one in the HttpOnly cookie, never anything the body says. The body is checked for its shape
// only (lib/market/w4.ts w4BodyFields: the application's own keys, texts of a sane length, a city of the list);
// what the values say is the database's to judge, and its refusals come back as they are: "input" with the key,
// "link" and "phone" with the key, "dup" with "cr", "terms", "birth", "adult", "suspended", "limit" with "shop".
// Answers {ok: true, shop: ShopMine} or {ok: false, error, detail?}.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await marketGuard(req);
  if (!g.ok) return g.res;
  const fields = w4BodyFields(g.body.fields);
  if (!fields) return mkRefuse("invalid", 400);
  return mkAnswer(await mkShopApply(g.session, fields, req));
}
