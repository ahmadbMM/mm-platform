import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import "@/components/pages/pages.css";
import { PRIVACY_NOTICE, PRIVACY_VERSION, type NoticeBlock } from "@/content/privacy-notice";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";

// micromobility.sa/privacy - the booking app's own Privacy Notice, word for word (it is copied
// from the booking app by scripts/sync-privacy-notice.mjs), so the site and the app never differ.
// The notice is our own static text, so its markup (<strong>, the email link) is rendered as is.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { closed } = await pageState();
  return { title: `${locale === "ar" ? "إشعار الخصوصية" : "Privacy Notice"} · Micromobility`, robots: closed ? { index: false, follow: false } : undefined };
}

function Block({ b }: { b: NoticeBlock }) {
  if (b.h) return <h3>{b.h}</h3>;
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
  const ar = L === "ar";
  const { content, previewing, hidden } = await pageState();
  const site = resolvePage(siteSchema, content, L);
  const updated = new Intl.DateTimeFormat(ar ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${PRIVACY_VERSION}T00:00:00Z`));
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="pg pg-privacy">
        <p className="pg-eyebrow">{ar ? "الخصوصية وحماية البيانات" : "Privacy & data protection"}</p>
        <h1>{ar ? "إشعار الخصوصية" : "Privacy Notice"}</h1>
        <p className="pg-updated">{ar ? `آخر تحديث: ${updated}` : `Last updated: ${updated}`}</p>
        <div className="pg-notice">{PRIVACY_NOTICE[L].map((b, i) => <Block key={i} b={b} />)}</div>
      </div>
    </PageShell>
  );
}
