import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import LearnForm from "@/components/learn/LearnForm";
import "@/components/learn/learn.css";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { PRIVACY_VERSION } from "@/content/privacy-notice";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { sized, srcSet } from "@/lib/img";

// micromobility.sa/experiences/learn - the Learn to ride sign-up, received by the staff page
// (learn_apply). It is part of Experiences: its address is under /experiences, so while staff have
// that page switched off the proxy sends it to Home like the rest of Experiences (lib/site.ts,
// switchedPageOf), and its words are that page's (Experiences > Learn to ride). With the lessons
// switched off there, the address goes to the Experiences page - the way to it is gone from Home
// and Experiences too, so only an old link or a search result still leads here.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("experiences");
  const l = resolvePage(experiencesSchema, content, asLocale(locale)).learn;
  return pageMeta({ path: "/experiences/learn", locale, title: `${l.title.replace(/[.。।۔!]\s*$/, "")} · Micromobility`, description: l.text, closed: closed || !l.on });
}

export default async function LearnPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const { content, previewing, hidden } = await pageState("experiences");
  const l = resolvePage(experiencesSchema, content, L).learn;
  if (!l.on) redirect("/experiences");
  const site = resolvePage(siteSchema, content, L);
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <section className="ln-grid">
        <div className="ln-intro">
          <p className="ln-eyebrow">{l.eyebrow}</p>
          <h1>{l.title}</h1>
          <p className="ln-lead">{l.text}</p>
          {l.image && <img className="ln-photo" src={sized(l.image, 800)} srcSet={srcSet(l.image)} sizes="(max-width: 900px) 92vw, 44vw" alt="" width={800} height={600} decoding="async" />}
        </div>
        <LearnForm locale={locale} formTitle={l.formTitle} formSub={l.formSub} doneTitle={l.doneTitle} doneText={l.doneText} privacyVersion={PRIVACY_VERSION} />
      </section>
    </PageShell>
  );
}
