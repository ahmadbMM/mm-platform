import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { serverL } from "@/i18n/dicts";
import FormPage from "@/components/forms/FormPage";
import SaturdaySiteForm from "@/components/forms/SaturdaySiteForm";

// micromobility.sa/saturday - the Saturday Social Ride's booking, with a ride code staff give out, as a page of the
// website (the user, 2026-11-09): the site's header, footer and languages around the page forms/saturday builds, which
// keeps every rule and message it had. ?classic=1 answers with that page as it is built on its own
// (app/saturday/route.ts, proxy.ts). Never in search results, as before.
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tx = serverL(locale);
  return pageMeta({ path: "/saturday", locale, noindex: true, title: tx("Saturday Social Ride | MicroMobility", "رحلة السبت الاجتماعية | MicroMobility") });
}

export default async function SaturdayPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  return (
    <FormPage locale={locale} path="/saturday" search={await searchParams}>
      <SaturdaySiteForm lang={locale} />
    </FormPage>
  );
}
