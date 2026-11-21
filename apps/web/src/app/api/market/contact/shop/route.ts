import { bodyText, marketGuard, mkAnswer, mkRefuse } from "@/lib/market/route";
import { mkShopContact } from "@/lib/market/server";
import { isShopSlug } from "@/lib/market/w3";

// POST /api/market/contact/shop: an approved shop's phone and WhatsApp numbers, for a signed-in account that tapped
// one of the shop's contact buttons (market_shop_contact; thirty shops' numbers a day per account). They are never
// sent with a page. Body {slug: string}. Answers {ok: true, phone, whatsapp} (digits, country code first; either may
// be null), or {ok: false, error, detail?}: "invalid", "gone" (no approved shop at that slug), "limit" (detail
// contacts), "signin", "busy".
export const dynamic = "force-dynamic";

const digits = (v: unknown): string | null => (typeof v === "string" && /^\d{8,15}$/.test(v) ? v : null);

export async function POST(req: Request) {
  const g = await marketGuard(req);
  if (!g.ok) return g.res;
  const slug = bodyText(g.body.slug, 40);
  if (!isShopSlug(slug)) return mkRefuse("invalid", 400);
  return mkAnswer(await mkShopContact(g.session, slug, req), (d) => ({ phone: digits(d.phone), whatsapp: digits(d.whatsapp) }));
}
