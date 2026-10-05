import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { pageMeta } from "@/lib/seo";
import CategoryPage from "@/components/bikes/CategoryPage";
import FleetBike, { fleetBikeMeta, isFleetCode } from "@/components/bikes/FleetBike";
import { bikesState, catalogOrThrow } from "@/components/bikes/catalog-data";
import { bikesSchema } from "@/content/pages/bikes";
import { getBikeByNumber } from "@/lib/bikes";
import { findCategory, loadCatalog, pick } from "@/lib/catalog";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";

// micromobility.sa/bikes/<category> - one category of the catalogue (/bikes/road)... or, when the
// segment is a number, a fleet bike's NFC tag page (/bikes/42): the stickers on the bikes open it,
// whatever the site's state (proxy.ts lets it through). A category's address always starts with
// a letter, so the two can never be confused. A number no bike carries answers 404, with the tag
// page's own friendly words (not-found.tsx beside this); a fleet that cannot be reached is not a 404,
// it is FleetBike's "try again".
type Params = Promise<{ locale: string; category: string }>;
const tagLookup = cache(getBikeByNumber);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, category } = await params;
  if (isFleetCode(category)) {
    // a sticker no bike carries is a 404 whose page names itself (not-found.tsx), and Next marks every
    // 404 noindex: no second title, no second robots tag
    if ((await tagLookup(category)).status === "missing") return {};
    return fleetBikeMeta(category, locale);
  }
  const [{ content, closed }, catalog] = await Promise.all([pageState("bikes"), loadCatalog()]);
  const cat = catalog ? findCategory(catalog, category) : null;
  if (!cat) return { robots: { index: false, follow: false } };
  const c = resolvePage(bikesSchema, content, asLocale(locale));
  const name = pick(locale, cat.name_en, cat.name_ar);
  return pageMeta({ path: `/bikes/${cat.slug}`, locale, title: `${name} · ${c.hero.eyebrow} · Micromobility`, description: pick(locale, cat.blurb_en, cat.blurb_ar) || c.hero.text, closed, image: cat.cover || undefined });
}

export default async function Page({ params }: { params: Params }) {
  const { locale, category } = await params;
  if (isFleetCode(category)) {
    if ((await tagLookup(category)).status === "missing") notFound();
    return <FleetBike code={category} locale={locale} />;
  }
  const s = await bikesState(locale);
  const catalog = catalogOrThrow(s);
  const cat = findCategory(catalog, category);
  if (!cat) notFound();
  return <CategoryPage locale={locale} category={cat} catalog={catalog} s={s} />;
}
