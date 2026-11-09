import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { serverL } from "@/i18n/dicts";
import FormPage from "@/components/forms/FormPage";
import CommunitySiteForm from "@/components/forms/CommunitySiteForm";

// micromobility.sa/community/registration - the Community Membership Application as a page of the website (the user,
// 2026-11-09): the site's header, footer and languages around the form forms/community builds, which keeps every rule
// and message it had. ?classic=1 answers with that form's own page (app/community/registration/route.ts, proxy.ts).
// Never in search results, as before. Its link preview is the form's own picture.
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tx = serverL(locale);
  return pageMeta({ path: "/community/registration", locale, noindex: true, image: "/community/registration/og-image.png",
    title: `${tx("Community Membership Application", "طلب عضوية المجتمع")} · Micromobility` });
}

export default async function CommunityRegistrationPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  return (
    <FormPage locale={locale} path="/community/registration" search={await searchParams}>
      <CommunitySiteForm lang={locale} />
    </FormPage>
  );
}
