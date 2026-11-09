import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { serverL } from "@/i18n/dicts";
import FormPage from "@/components/forms/FormPage";
import LockersSiteForm from "@/components/forms/LockersSiteForm";

// micromobility.sa/lockers - a locker reserved from a drawing of the cabinet, as a page of the website (the user,
// 2026-11-09): the site's header, footer and languages around the page forms/lockers builds, which keeps every rule and
// message it had. A locker's tag (/lockers/7) still opens it with that locker picked (proxy.ts). ?classic=1 answers with
// the page as it is built on its own (app/lockers/route.ts, proxy.ts). Never in search results, as before.
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tx = serverL(locale);
  return pageMeta({ path: "/lockers", locale, noindex: true, title: tx("Lockers | MicroMobility", "الخزائن | MicroMobility") });
}

export default async function LockersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  return (
    <FormPage locale={locale} path="/lockers" search={await searchParams}>
      <LockersSiteForm lang={locale} />
    </FormPage>
  );
}
