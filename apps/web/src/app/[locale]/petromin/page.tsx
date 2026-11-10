import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { serverL } from "@/i18n/dicts";
import FormPage from "@/components/forms/FormPage";
import PetrominSiteForm from "@/components/forms/PetrominSiteForm";

// micromobility.sa/petromin - the Petromin and Petrolube employees' bike registration as a page of the website (the user,
// 2026-11-09): the site's header, footer and languages around the form forms/petromin builds, which keeps every rule
// and message it had. ?classic=1 answers with that form's own page (app/petromin/route.ts, proxy.ts). Never in search
// results, as before.
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tx = serverL(locale);
  return pageMeta({ path: "/petromin", locale, noindex: true,
    title: `${tx("Employees Bike Registration Form", "نموذج تسجيل الدراجات للموظفين")} · Micromobility` });
}

export default async function PetrominPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  return (
    <FormPage locale={locale} path="/petromin" search={await searchParams} plain>
      <PetrominSiteForm lang={locale} />
    </FormPage>
  );
}
