import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import "@/components/pages/pages.css";
import { NoticeBody, noticeDate, noticeOwn } from "@/components/privacy/PrivacyNotice";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { serverL } from "@/i18n/dicts";
import { fill } from "@/lib/fill";

// micromobility.sa/privacy - the booking app's own Privacy Notice, word for word (it is copied
// from the booking app by scripts/sync-privacy-notice.mjs), so the site and the app never differ.
// Like the booking app, it is published in English and Arabic only: every other language reads
// the English one, told so in its own language (components/privacy/PrivacyNotice.tsx, which the
// forms' in-page notice shares).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { closed } = await pageState();
  const tx = serverL(locale);
  return pageMeta({ path: "/privacy", locale, title: `${tx("Privacy Notice", "إشعار الخصوصية")} · Micromobility`,
    description: tx("How Micromobility collects, uses and protects your personal data, and the choices you have.", "كيف تجمع مايكروموبيليتي بياناتك الشخصية وتستخدمها وتحميها، والخيارات المتاحة لك."), closed });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const own = noticeOwn(locale);
  const { content, previewing, hidden } = await pageState();
  const site = resolvePage(siteSchema, content, L);
  const updated = noticeDate(locale);
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="pg pg-privacy">
        <p className="pg-eyebrow">{tx("Privacy & data protection", "الخصوصية وحماية البيانات")}</p>
        <h1>{tx("Privacy Notice", "إشعار الخصوصية")}</h1>
        <p className="pg-updated">{fill(tx("Last updated: {date}", "آخر تحديث: {date}"), { date: updated })}</p>
        {!own && <p className="pg-updated">{tx("This notice is available in English and Arabic.", "هذا الإشعار متاح بالإنجليزية والعربية.")}</p>}
        <NoticeBody locale={locale} />
      </div>
    </PageShell>
  );
}
