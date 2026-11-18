import { Link } from "@/i18n/navigation";
import { collectionHref, pick } from "@/lib/store-core";
import type { CollSection } from "@/lib/store-colls";
import { listProducts } from "@/lib/store-listing";
import type { ListProps } from "./list-data";
import ProductCard from "./ProductCard";
import type { StoreText } from "./Store.text";
import type { W2Text } from "./w2.text";
import type { SpmText } from "./spm.text";
import { SpmIc } from "./spm-parts";

// The store page's collections (the product-management build 2026-11-19, lib/store-colls.ts storeSections): each one
// staff put on the store page, in their order, as a heading with "See all" to its own page and one row of its products'
// cards that swipes sideways (the most staff set for it), drawn by the server.
export function CollSections({ sections, locale, list, t, w, x }: {
  sections: CollSection[]; locale: string; list: Omit<ListProps, "products">; t: StoreText; w: W2Text; x: SpmText;
}) {
  if (!sections.length) return null;
  return (
    <>
      {sections.map(({ coll, products }) => {
        const id = `st-coll-${coll.slug}`;
        return (
          <section key={coll.slug} className="st-coll" aria-labelledby={id}>
            <div className="st-coll-head">
              <h2 id={id} className="st-h2"><bdi>{pick(locale, coll.name_en, coll.name_ar)}</bdi></h2>
              <Link href={collectionHref(coll.slug)} className="st-coll-all">{x.seeAll}<SpmIc name="arrow" size={16} flip /></Link>
            </div>
            <ul className="st-coll-row">
              {listProducts(products).map((p) => (
                <li key={p.id}>
                  <ProductCard p={p} locale={locale} t={t} w={w} x={x} licence={list.licence} today={list.today} whens={list.whens} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
