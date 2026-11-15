import JsonLd from "@/components/site/JsonLd";
import { loadReviews, type StoreProduct } from "@/lib/store";
import { productLd } from "@/lib/store-sections";

// The product for search engines (F45): schema.org Product with its price with VAT in riyals, stock, condition,
// warranty, return policy and brand (lib/store-sections.ts productLd), and the star average only once five verified
// buyers' reviews are shown, as on the page. A data block, never run as a script.
export default async function ProductJsonLd({ p, locale }: { p: StoreProduct; locale: string }) {
  const reviews = (await loadReviews()).get(p.id.toLowerCase()) ?? [];
  const data = productLd(p, { locale, reviews });
  return data ? <JsonLd data={data} /> : null;
}
