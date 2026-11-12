import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { serverL } from "@/i18n/dicts";
import FormPage from "@/components/forms/FormPage";
import DukanSiteForm from "@/components/forms/DukanSiteForm";

// micromobility.sa/dukan - Dukan's employees' bike registration as a page of the website (the user, 2026-11-12: "create
// a registration page for dukan employees ... make it on a link micromobility.sa/dukan"): the site's header, footer and
// languages around the form forms/dukan builds. Dukan pays for its riders, so the page is the plain shell, with no store
// cart or payment marks. ?classic=1 answers with the form's own page (app/dukan/route.ts, proxy.ts). Never in search
// results.
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tx = serverL(locale);
  return pageMeta({ path: "/dukan", locale, noindex: true,
    title: `${tx("Dukan bike night", "ليلة دراجات الدكان")} · Micromobility` });
}

export default async function DukanPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  return (
    <FormPage locale={locale} path="/dukan" search={await searchParams} plain>
      <DukanSiteForm lang={locale} />
    </FormPage>
  );
}
