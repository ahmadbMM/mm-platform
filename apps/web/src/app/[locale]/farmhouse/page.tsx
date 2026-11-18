import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { serverL } from "@/i18n/dicts";
import FormPage from "@/components/forms/FormPage";
import FarmhouseSiteForm from "@/components/forms/FarmhouseSiteForm";

// micromobility.sa/farmhouse - the Farmhouse Night's booking, with the code MicroMobility gives out, as a page of the
// website (the user, 2026-11-15: "make it through a new url and only allow reservations through a code"): the site's
// header, footer and languages around the page forms/farmhouse builds. ?classic=1 answers with that page as it is
// built on its own (app/farmhouse/route.ts, proxy.ts). Never in search results. The night's details show only once the
// code is good (the database's farm_night), so the page itself names the night and nothing more.
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tx = serverL(locale);
  return pageMeta({ path: "/farmhouse", locale, noindex: true, title: tx("The Farmhouse Night | MicroMobility", "ليلة فارم هاوس | MicroMobility") });
}

export default async function FarmhousePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  return (
    <FormPage locale={locale} path="/farmhouse" search={await searchParams}>
      <FarmhouseSiteForm lang={locale} />
    </FormPage>
  );
}
