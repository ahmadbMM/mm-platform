import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import "@/components/pages/pages.css";
import { siteSchema } from "@/content/pages/site";
import { termsSchema } from "@/content/pages/terms";
import { asLocale, resolvePage } from "@/lib/content";
import { fill } from "@/lib/fill";
import { parseBody } from "@/lib/journal";
import { pageState } from "@/lib/page-state";
import { serverL } from "@/i18n/dicts";
import { intlOf } from "@/i18n/locales";

// micromobility.sa/terms - the Terms & Conditions staff keep in Website > Terms (content/pages/
// terms.ts). Legal text in English and Arabic only, like the Privacy Notice: every other language
// reads the English, told so in its own language. Plain text, never markup.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("terms");
  const tx = serverL(locale);
  const t = resolvePage(termsSchema, content, asLocale(locale));
  return pageMeta({ path: "/terms", locale, title: `${tx("Terms & Conditions", "الشروط والأحكام")} · Micromobility`, description: S(t.intro.text), closed });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const own = L === "en" || L === "ar";
  const { content, previewing, hidden } = await pageState("terms");
  const site = resolvePage(siteSchema, content, L);
  const t = resolvePage(termsSchema, content, L);
  const day = S(t.intro.updated);
  const updated = /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? new Intl.DateTimeFormat(intlOf(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))
    : "";
  const clauses = list(t.clauses.items).filter((c) => S(c.title) || S(c.body));
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="pg pg-privacy">
        <h1>{tx("Terms & Conditions", "الشروط والأحكام")}</h1>
        {updated && <p className="pg-updated">{fill(tx("Last updated: {date}", "آخر تحديث: {date}"), { date: updated })}</p>}
        {!own && <p className="pg-updated">{tx("These terms are available in English and Arabic.", "هذه الشروط متاحة بالإنجليزية والعربية.")}</p>}
        <div className="pg-notice" {...(own ? {} : { lang: "en", dir: "ltr" })}>
          {S(t.intro.text) && <p>{S(t.intro.text)}</p>}
          {clauses.map((c, i) => (
            <section key={i}>
              {S(c.title) && <h2>{S(c.title)}</h2>}
              {parseBody(S(c.body)).map((b, k) => ("h" in b ? <h3 key={k}>{b.h}</h3> : "ul" in b ? <ul key={k}>{b.ul.map((x, j) => <li key={j}>{x}</li>)}</ul> : <p key={k}>{b.p}</p>))}
            </section>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
