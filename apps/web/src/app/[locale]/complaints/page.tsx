import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import { showPhone } from "@/components/site/SiteFooter";
import { PolicyIcon } from "@/components/site/PolicyIcons";
import LearnAlone from "@/components/learn/LearnAlone";
import { WhatsAppMark } from "@/components/store/bits";
import { StIcon } from "@/components/store/icons";
import { T } from "@/components/store/w1.text";
import "@/components/pages/pages.css";
import "@/components/learn/learn.css";
import "@/components/site/policies.css";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { learnFrame } from "@/lib/learn-page";
import { pageState } from "@/lib/page-state";
import { waNumber, whatsappHref } from "@/lib/policies";
import { complaintsDays } from "@/lib/store-settings";
import { serverLocalize } from "@/i18n/dicts";

// micromobility.sa/complaints - how to make a complaint (store build, 2026-11-15, L12: the store's obligations list asks
// for a complaints route with a stated response time and Arabic support): the time staff set to answer one (Payments >
// Settings, store.complaintsDays; with none set the page names no time), then the three ways to reach the team, from the
// site's contact settings: WhatsApp, a call, the showroom. Nothing asks for an email (no email or SMS is sent); staff answer
// on WhatsApp by hand. Like the Returns page it answers whatever the site's switches say (proxy.ts POLICY_PAGE), alone in
// the sign-up's frame while the site is Coming Soon.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { closed } = await pageState();
  const t = serverLocalize(T, locale);
  return pageMeta({ path: "/complaints", locale, title: `${t.complaints} · Micromobility`, description: t.complaintsDesc, closed });
}

export default async function ComplaintsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const t = serverLocalize(T, locale);
  const { content, previewing, hidden } = await pageState();
  const site = resolvePage(siteSchema, content, L);
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  const days = complaintsDays(content);
  const phone = S(site.contact.phone).replace(/[^\d+]/g, "");
  const wa = whatsappHref(S(site.social.whatsapp), phone);
  const address = S(site.contact.address), hours = S(site.contact.hoursText), maps = S(site.contact.mapsHref);
  const page = (
    <div className="pg pg-privacy pol">
      <p className="pg-eyebrow">{t.policies}</p>
      <h1>{t.complaints}</h1>
      <p className="pg-lead">{t.complaintsLead}</p>
      <p className="pol-key"><StIcon name="clock" size={20} />{days === null ? t.answerAny : days === 1 ? t.answerIn1 : t.answerInN(days)}</p>
      <h2 className="pol-h">{t.howTo}</h2>
      <div className="pol-ways">
        {wa && (
          <a className="pol-way" href={wa} target="_blank" rel="noopener noreferrer">
            <WhatsAppMark size={22} />
            <strong>{t.byWhatsApp}</strong>
            {waNumber(wa) && <span className="pol-num"><bdi dir="ltr">{showPhone(waNumber(wa))}</bdi></span>}
          </a>
        )}
        {phone && (
          <a className="pol-way" href={`tel:${phone}`}>
            <PolicyIcon name="phone" size={22} />
            <strong>{t.byPhone}</strong>
            <span className="pol-num"><bdi dir="ltr">{showPhone(phone)}</bdi></span>
          </a>
        )}
        {address && (
          <div className="pol-way">
            <StIcon name="mapPin" size={22} />
            <strong>{t.byVisit}</strong>
            <span>{address}</span>
            {hours && <span>{hours}</span>}
            {maps && <a href={maps} target="_blank" rel="noopener noreferrer">{t.directions}</a>}
          </div>
        )}
      </div>
      <p className="pol-note">{t.giveRef}</p>
    </div>
  );
  if (learnFrame(content, previewing) === "alone") return <LearnAlone locale={locale} company={site.legal.company} notice="pg-notice">{page}</LearnAlone>;
  return <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>{page}</PageShell>;
}
