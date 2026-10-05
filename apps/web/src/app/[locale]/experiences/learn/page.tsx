import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell, { navFrom } from "@/components/site/PageShell";
import LearnAlone from "@/components/learn/LearnAlone";
import LearnClosed from "@/components/learn/LearnClosed";
import LearnForm from "@/components/learn/LearnForm";
import NoticeDialog from "@/components/privacy/NoticeDialog";
import "@/components/learn/learn.css";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { PRIVACY_ASK_FROM, PRIVACY_VERSION } from "@/content/privacy-notice";
import { asLocale, resolvePage } from "@/lib/content";
import { learnFrame } from "@/lib/learn-page";
import { pageState } from "@/lib/page-state";

// micromobility.sa/experiences/learn - the Learn to ride sign-up, received by the staff page
// (learn_apply). Its words are the Experiences page's (Experiences > Learn to ride). It opens
// whatever the site's state, the way the registration forms do (owner, 2026-09-28: usable now;
// proxy.ts lets it through Coming Soon and the Experiences switch alike): while the site is Coming
// Soon it stands alone (LearnAlone), with nothing that leads into the closed site, and once the
// site is open it has the header and footer of every page (lib/learn-page.ts). The Privacy Notice
// opens in a dialog on the page in both. With the lessons switched off, the address goes to the
// Experiences page - Coming Soon while the site is closed - and the question on Home and
// Experiences that leads here is gone too. While staff are not taking sign-ups ("Taking sign-ups"
// off; owner, 2026-10-04), the page stays and says so in place of the form (LearnClosed). No photo on the page (owner, 2026-09-28): the intro is
// words alone beside the form; its photo setting is only the picture a shared link shows.
const NOTICE = "ln-notice";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("experiences");
  const l = resolvePage(experiencesSchema, content, asLocale(locale)).learn;
  // Its own title, text and photo, for a link shared on WhatsApp or Instagram; kept out of search
  // engines while the site is closed.
  return pageMeta({ path: "/experiences/learn", locale, title: `${l.title.replace(/[.。।۔!]\s*$/, "")} · Micromobility`, description: l.text, image: l.image || undefined, closed: closed || !l.on });
}

export default async function LearnPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const { content, previewing, hidden } = await pageState("experiences");
  const l = resolvePage(experiencesSchema, content, L).learn;
  if (!l.on) redirect("/experiences");
  const site = resolvePage(siteSchema, content, L);
  const page = (
    <>
      <section className="ln-grid">
        <div className="ln-intro">
          <p className="ln-eyebrow">{l.eyebrow}</p>
          <h1>{l.title}</h1>
          <p className="ln-lead">{l.text}</p>
        </div>
        {l.taking
          ? <LearnForm locale={locale} formTitle={l.formTitle} formSub={l.formSub} doneTitle={l.doneTitle} doneText={l.doneText} closedTitle={l.closedTitle} closedText={l.closedText}
              privacyVersion={PRIVACY_VERSION} privacyAskFrom={PRIVACY_ASK_FROM} notice={NOTICE} bookingUrl={navFrom(site).booking} />
          : <LearnClosed title={l.closedTitle} text={l.closedText} />}
      </section>
      <NoticeDialog id={NOTICE} locale={locale} />
    </>
  );
  if (learnFrame(content, previewing) === "alone") return <LearnAlone locale={locale} company={site.legal.company} notice={NOTICE}>{page}</LearnAlone>;
  return <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>{page}</PageShell>;
}
