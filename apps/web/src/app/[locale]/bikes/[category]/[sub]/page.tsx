import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import CategoryPage, { categoryDescription } from "@/components/bikes/CategoryPage";
import ModelPage, { modelDescription, modelTitle } from "@/components/bikes/ModelPage";
import { bikesState, catalogOrThrow } from "@/components/bikes/catalog-data";
import { coverOf, findCategory, findModel, findSubtype, loadCatalog, modelPath, pick, type Catalog } from "@/lib/catalog";
import { pageState } from "@/lib/page-state";
import { serverL } from "@/i18n/dicts";

// micromobility.sa/bikes/<category>/<x> - one of the category's sub-types (/bikes/road/carbon), or
// a model of the category that has no sub-type (/bikes/road/alvas-da54). A model's slug is unique
// across the catalogue, so a model found at any other address is sent to its own: staff moving a
// model into a sub-type does not break the links already shared.
type Params = Promise<{ locale: string; category: string; sub: string }>;

function resolve(catalog: Catalog, category: string, sub: string) {
  const cat = findCategory(catalog, category);
  const subtype = cat ? findSubtype(catalog, cat, sub) : null;
  if (cat && subtype) return { cat, subtype, model: null };
  const model = findModel(catalog, sub);
  return { cat, subtype: null, model };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, category, sub } = await params;
  const [{ closed }, catalog] = await Promise.all([pageState("bikes"), loadCatalog()]);
  const r = catalog ? resolve(catalog, category, sub) : null;
  if (r?.cat && r.subtype) {
    return pageMeta({ path: `/bikes/${r.cat.slug}/${r.subtype.slug}`, locale, closed, image: r.subtype.cover || r.cat.cover || undefined,
      title: `${pick(locale, r.subtype.name_en, r.subtype.name_ar)} · ${pick(locale, r.cat.name_en, r.cat.name_ar)} · Micromobility`,
      description: categoryDescription(r.subtype, locale, serverL(locale)) });
  }
  if (catalog && r?.model) {
    return pageMeta({ path: modelPath(r.model, catalog.categories), locale, closed, title: `${modelTitle(r.model)} · Micromobility`, description: modelDescription(r.model, locale), image: coverOf(r.model, catalog.photos)?.url });
  }
  return { robots: { index: false, follow: false } };
}

export default async function Page({ params }: { params: Params }) {
  const { locale, category, sub } = await params;
  const s = await bikesState(locale);
  const catalog = catalogOrThrow(s);
  const r = resolve(catalog, category, sub);
  if (r.cat && r.subtype) return <CategoryPage locale={locale} category={r.cat} subtype={r.subtype} catalog={catalog} s={s} />;
  if (!r.model) notFound();
  const canonical = modelPath(r.model, catalog.categories);
  if (canonical !== `/bikes/${category}/${sub}`) permanentRedirect(canonical);
  return <ModelPage locale={locale} model={r.model} catalog={catalog} s={s} />;
}
