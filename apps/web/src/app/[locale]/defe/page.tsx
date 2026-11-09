import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { serverL } from "@/i18n/dicts";
import FormPage from "@/components/forms/FormPage";
import DefeSiteForm from "@/components/forms/DefeSiteForm";

// micromobility.sa/defe - the Defe x MicroMobility booking for the Saturday Social Ride as a page of the website (the user,
// 2026-11-09): the site's header, footer and languages around the page forms/defe builds - Defe's logo beside
// MicroMobility's kept at its top - which keeps every rule and message it had. ?classic=1 answers with that page as it
// is built on its own (app/defe/route.ts, proxy.ts). Never in search results, as before.
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tx = serverL(locale);
  return pageMeta({ path: "/defe", locale, noindex: true, title: tx("Defe x MicroMobility | Saturday Social Ride", "دفء × MicroMobility | رحلة السبت الاجتماعية") });
}

export default async function DefePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  return (
    <FormPage locale={locale} path="/defe" search={await searchParams}>
      <DefeSiteForm lang={locale} />
    </FormPage>
  );
}
