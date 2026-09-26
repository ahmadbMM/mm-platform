import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import ModelPage, { modelDescription, modelTitle } from "@/components/bikes/ModelPage";
import { bikesState } from "@/components/bikes/catalog-data";
import { coverOf, findModel, loadCatalog, modelPath } from "@/lib/catalog";
import { pageState } from "@/lib/page-state";

// micromobility.sa/bikes/<category>/<sub-type>/<model> - a model that belongs to a sub-type. The
// model's slug is unique, so the category and sub-type in the address are checked against its own:
// any other address that names it is sent to the right one.
type Params = Promise<{ locale: string; category: string; sub: string; model: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, model } = await params;
  const [{ closed }, catalog] = await Promise.all([pageState("bikes"), loadCatalog()]);
  const m = catalog ? findModel(catalog, model) : null;
  if (!catalog || !m) return { robots: { index: false, follow: false } };
  return pageMeta({ path: modelPath(m, catalog.categories), locale, closed, title: `${modelTitle(m)} · Micromobility`, description: modelDescription(m, locale), image: coverOf(m, catalog.photos)?.url });
}

export default async function Page({ params }: { params: Params }) {
  const { locale, category, sub, model } = await params;
  const s = await bikesState(locale);
  const m = s.catalog ? findModel(s.catalog, model) : null;
  if (!s.catalog || !m) notFound();
  const canonical = modelPath(m, s.catalog.categories);
  if (canonical !== `/bikes/${category}/${sub}/${model}`) permanentRedirect(canonical);
  return <ModelPage locale={locale} model={m} catalog={s.catalog} s={s} />;
}
