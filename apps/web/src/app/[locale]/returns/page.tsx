import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import ReturnsPolicy, { returnsPolicy } from "@/components/site/ReturnsPolicy";
import LearnAlone from "@/components/learn/LearnAlone";
import { WhatsAppMark } from "@/components/store/bits";
import { T } from "@/components/store/w1.text";
import "@/components/pages/pages.css";
import "@/components/learn/learn.css";
import "@/components/site/policies.css";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { learnFrame } from "@/lib/learn-page";
import { pageState } from "@/lib/page-state";
import { whatsappHref } from "@/lib/policies";
import { serverLocalize } from "@/i18n/dicts";
import { Link } from "@/i18n/navigation";

// micromobility.sa/returns - the store's returns and exchanges policy (store build, 2026-11-15: L12's Returns page, the
// target a product page's "Returns policy" needs, X07): the one return sentence, then the Help page's Returns answers as
// staff keep them. It is not a page staff switch: like the Privacy Notice it answers whatever the site's, the store's and
// the Help page's switches say (proxy.ts POLICY_PAGE), since a returns promise made anywhere must lead somewhere; while the
// site is Coming Soon it stands alone in the sign-up's frame (LearnAlone), with no way into the closed site.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { closed } = await pageState();
  const t = serverLocalize(T, locale);
  return pageMeta({ path: "/returns", locale, title: `${t.returnsTitle} · Micromobility`, description: t.returnsDesc, closed });
}

export default async function ReturnsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const t = serverLocalize(T, locale);
  const { content, previewing, hidden } = await pageState();
  const site = resolvePage(siteSchema, content, L);
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  const policy = returnsPolicy(content, locale);
  const alone = learnFrame(content, previewing) === "alone";
  const wa = whatsappHref(S(site.social.whatsapp), S(site.contact.phone));
  const page = (
    <div className="pg pg-privacy pol">
      <p className="pg-eyebrow">{t.policies}</p>
      <h1>{t.returnsTitle}</h1>
      <ReturnsPolicy {...policy} />
      {wa && !alone && (
        <p className="pol-act">
          <a className="pg-btn" href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppMark size={18} />{t.askReturn}</a>
        </p>
      )}
      {!alone && (
        <p className="pol-more">
          {!hidden.includes("terms") && <Link href="/terms">{t.terms}</Link>}
          <Link href="/complaints">{t.complaints}</Link>
        </p>
      )}
    </div>
  );
  if (alone) return <LearnAlone locale={locale} company={site.legal.company} notice="pg-notice">{page}</LearnAlone>;
  return <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>{page}</PageShell>;
}
