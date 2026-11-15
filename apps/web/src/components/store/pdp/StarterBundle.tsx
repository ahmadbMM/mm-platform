import { serverLocalize } from "@/i18n/dicts";
import { bundleOf, type Store, type StoreProduct } from "@/lib/store-core";
import { leanProduct } from "@/lib/store-sections";
import { T } from "../w3b.text";
import BundleCard from "./BundleCard";

// The starter set (F31): drawn only with a bundle price staff set AND the Ministry of Commerce discount licence (a set
// cheaper than its parts is a discount, R8), with every product of it still in stock and the set really cheaper.
export default function StarterBundle({ store, p, locale, licence }: { store: Store; p: StoreProduct; locale: string; licence: string | null }) {
  const b = licence ? bundleOf(store, p, licence) : null;
  if (!b || !licence) return null;
  const w = serverLocalize(T, locale);
  return (
    <section className="st-pd-sec" aria-labelledby="st-pd-set-h">
      <h2 id="st-pd-set-h">{w.setH}</h2>
      <BundleCard products={b.products.map(leanProduct)} price={b.price} licence={licence} locale={locale} />
    </section>
  );
}
