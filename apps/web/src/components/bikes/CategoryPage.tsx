import PageShell from "@/components/site/PageShell";
import JsonLd from "@/components/site/JsonLd";
import Crumbs from "./Crumbs";
import ModelCard from "./ModelCard";
import type { BikesState } from "./catalog-data";
import { modelsIn, pick, subtypeOf, subtypesOf, type Catalog, type CatalogCategory } from "@/lib/catalog";
import { bg } from "@/lib/img";
import { fill, fmtNum } from "@/lib/fill";
import { breadcrumbData } from "@/lib/structured-data";
import "@/components/pages/pages.css";
import "./catalog.css";

/** "1 model" / "{n} models", for a tile. */
export function modelCount(n: number, locale: string, tx: BikesState["tx"]): string {
  return n === 1 ? tx("1 model", "موديل واحد") : fill(tx("{n} models", "{n} موديلات"), { n: fmtNum(n, locale) });
}

/** What search engines read for a category or a sub-type: its blurb, else a line naming it - never
 *  the Bikes page's own text, which every category would then share. */
export function categoryDescription(here: CatalogCategory, locale: string, tx: BikesState["tx"]): string {
  return pick(locale, here.blurb_en, here.blurb_ar)
    || fill(tx("{category} bikes in the Micromobility catalogue: models, photos and specifications.", "دراجات {category} في كتالوج مايكروموبيليتي: الموديلات والصور والمواصفات."), { category: pick(locale, here.name_en, here.name_ar) });
}

/** The sentence the catalogue shows where it has nothing to show yet. */
export const emptyText = (tx: BikesState["tx"]) => tx("Our bikes are being added. Check back soon.", "دراجاتنا قيد الإضافة. عُد قريباً.");

// A category (/bikes/road) or one of its sub-types (/bikes/road/carbon): the name and blurb, the
// sub-types as tiles (a category's), then the models - a category lists the ones with no sub-type
// first, then each sub-type's under its own heading.
export default function CategoryPage({ locale, category, subtype, catalog, s }: { locale: string; category: CatalogCategory; subtype?: CatalogCategory; catalog: Catalog; s: BikesState }) {
  const { tx, site, c, previewing, hidden } = s;
  const here = subtype ?? category;
  const name = pick(locale, here.name_en, here.name_ar);
  const blurb = pick(locale, here.blurb_en, here.blurb_ar);
  const subs = subtype ? [] : subtypesOf(catalog, category.id);
  const models = modelsIn(catalog, here);
  const loose = subtype ? models : models.filter((m) => !subtypeOf(m, catalog.categories));
  const crumbs = [{ href: "/bikes", label: c.hero.eyebrow }];
  if (subtype) crumbs.push({ href: `/bikes/${category.slug}`, label: pick(locale, category.name_en, category.name_ar) });
  const path = subtype ? `/bikes/${category.slug}/${subtype.slug}` : `/bikes/${category.slug}`;
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <JsonLd data={breadcrumbData([...crumbs.map((x) => ({ name: x.label, path: x.href })), { name, path }], locale)} />
      <div className="pg ct">
        <Crumbs items={crumbs} current={name} label={tx("Breadcrumb", "مسار الصفحة")} />
        <p className="pg-eyebrow">{subtype ? pick(locale, category.name_en, category.name_ar) : c.hero.eyebrow}</p>
        <h1>{name}</h1>
        {blurb && <p className="pg-lead">{blurb}</p>}
        {subs.length > 0 && (
          <div className="ct-tiles">
            {subs.map((x) => {
              const n = modelsIn(catalog, x).length;
              return (
                <a key={x.id} className="ct-tile" href={`/bikes/${category.slug}/${x.slug}`} style={x.cover ? { backgroundImage: `url('${bg(x.cover)}')` } : undefined}>
                  <strong>{pick(locale, x.name_en, x.name_ar)}</strong>
                  {pick(locale, x.blurb_en, x.blurb_ar) && <p>{pick(locale, x.blurb_en, x.blurb_ar)}</p>}
                  {n > 0 && <em>{modelCount(n, locale, tx)}</em>}
                </a>
              );
            })}
          </div>
        )}
        {models.length === 0 && <p className="pg-empty">{emptyText(tx)}</p>}
        {loose.length > 0 && (
          <div className="ct-grid">
            {loose.map((m) => <ModelCard key={m.id} model={m} catalog={catalog} locale={locale} />)}
          </div>
        )}
        {subs.map((x) => {
          const own = modelsIn(catalog, x);
          if (!own.length) return null;
          return (
            <section key={x.id} className="ct-section">
              <h2>{pick(locale, x.name_en, x.name_ar)}</h2>
              <div className="ct-grid">
                {own.map((m) => <ModelCard key={m.id} model={m} catalog={catalog} locale={locale} />)}
              </div>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
