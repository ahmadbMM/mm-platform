import { SITE_URL } from "@/lib/seo";
import { pageState } from "@/lib/page-state";
import { discountLicence, loadStore, storeOpen } from "@/lib/store";
import { riyadhToday } from "@/lib/store-delivery";
import { productFeed } from "@/lib/sx-B1-feed";

// micromobility.sa/store/feed.xml (the user, 2026-11-18: "do all", N27): the store's products for Google Merchant Center's
// free listings, in English; ?lang=ar for the Arabic listings (lib/sx-B1-feed.ts). Only while the site is open and staff
// have the store open, as the sitemap lists the store's pages: otherwise there is no store of ours to list, and the
// address answers 404. An address with a dot never reaches the proxy, so the store's forwarding to the Salla shop does
// not apply here; this check does its work. Google reads it about once a day; an hour's copy is plenty.
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const { content, closed } = await pageState();
  if (closed || !storeOpen(content)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const store = await loadStore();
  if (!store) return new Response("Try again later", { status: 503, headers: { "Retry-After": "600", "Cache-Control": "no-store" } });
  const lang = new URL(req.url).searchParams.get("lang") === "ar" ? "ar" : "en";
  const xml = productFeed(store.products, {
    site: SITE_URL,
    lang,
    licence: discountLicence(content),
    today: riyadhToday(),
    storeName: "Micromobility",
    description: lang === "ar" ? "دراجات وإكسسوارات ومستلزمات من متجرنا في جدة. الأسعار شاملة الضريبة." : "Bikes, accessories and gear from our Jeddah store. Prices include VAT.",
  });
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
