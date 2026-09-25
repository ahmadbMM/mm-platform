import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import "@/components/pages/pages.css";
import { PRIVACY_NOTICE, PRIVACY_VERSION, type NoticeBlock } from "@/content/privacy-notice";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { serverL } from "@/i18n/dicts";
import { intlOf } from "@/i18n/locales";
import { fill } from "@/lib/fill";

// micromobility.sa/privacy - the booking app's own Privacy Notice, word for word (it is copied
// from the booking app by scripts/sync-privacy-notice.mjs), so the site and the app never differ.
// The notice is our own static text, so its markup (<strong>, the email link) is rendered as is.
// Like the booking app, it is published in English and Arabic only: every other language reads
// the English one, told so in its own language.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { closed } = await pageState();
  const tx = serverL(locale);
  return pageMeta({ path: "/privacy", locale, title: `${tx("Privacy Notice", "إشعار الخصوصية")} · Micromobility`,
    description: tx("How Micromobility collects, uses and protects your personal data, and the choices you have.", "كيف تجمع مايكروموبيليتي بياناتك الشخصية وتستخدمها وتحميها، والخيارات المتاحة لك."), closed });
}

function Block({ b }: { b: NoticeBlock }) {
  if (b.h) return <h2>{b.h}</h2>;
  if (b.p) return <p dangerouslySetInnerHTML={{ __html: b.p }} />;
  if (b.ul) return <ul>{b.ul.map((x, i) => <li key={i} dangerouslySetInnerHTML={{ __html: x }} />)}</ul>;
  if (b.table) {
    const t = b.table;
    return (
      <div className="pv-tw">
        <table>
          <thead><tr>{t.head.map((h, i) => <th key={i} dangerouslySetInnerHTML={{ __html: h }} />)}</tr></thead>
          <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j} data-label={t.head[j].replace(/<[^>]+>/g, "")} dangerouslySetInnerHTML={{ __html: x }} />)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  return null;
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const own = L === "en" || L === "ar";
  const { content, previewing, hidden } = await pageState();
  const site = resolvePage(siteSchema, content, L);
  const updated = new Intl.DateTimeFormat(intlOf(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${PRIVACY_VERSION}T00:00:00Z`));
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="pg pg-privacy">
        <p className="pg-eyebrow">{tx("Privacy & data protection", "الخصوصية وحماية البيانات")}</p>
        <h1>{tx("Privacy Notice", "إشعار الخصوصية")}</h1>
        <p className="pg-updated">{fill(tx("Last updated: {date}", "آخر تحديث: {date}"), { date: updated })}</p>
        {!own && <p className="pg-updated">{tx("This notice is available in English and Arabic.", "هذا الإشعار متاح بالإنجليزية والعربية.")}</p>}
        <div className="pg-notice" {...(own ? {} : { lang: "en", dir: "ltr" })}>{PRIVACY_NOTICE[L === "ar" ? "ar" : "en"].map((b, i) => <Block key={i} b={b} />)}</div>
      </div>
    </PageShell>
  );
}
