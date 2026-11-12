import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { serverL } from "@/i18n/dicts";
import FormPage from "@/components/forms/FormPage";
import PetrominInviteSiteForm from "@/components/forms/PetrominInviteSiteForm";

// micromobility.sa/petromin-invite - the people Petromin invites to its bike nights (not its employees) book a place as a
// page of the website (the owner, 2026-11-12): the site's header, footer and languages around the form
// forms/petromin-invite builds. A guest is a walk-in booking on the night's list who pays the fare at the desk, so nothing
// is bought here: the plain shell, with no store cart or payment marks. ?classic=1 answers with the form's own page
// (app/petromin-invite/route.ts, proxy.ts). Never in search results.
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tx = serverL(locale);
  return pageMeta({ path: "/petromin-invite", locale, noindex: true,
    title: `${tx("Petromin Ride Night: Invited Guests", "ليلة دراجات بترومين: الضيوف المدعوون")} · Micromobility` });
}

export default async function PetrominInvitePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  return (
    <FormPage locale={locale} path="/petromin-invite" search={await searchParams} plain>
      <PetrominInviteSiteForm lang={locale} />
    </FormPage>
  );
}
