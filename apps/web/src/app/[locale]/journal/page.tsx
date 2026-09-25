import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import "@/components/journal/journal.css";
import { fmtDate, journalState } from "@/components/journal/journal-data";
import { siteSchema } from "@/content/pages/site";
import { resolvePage } from "@/lib/content";
import { readMinutes } from "@/lib/journal";
import { isRtl } from "@/i18n/locales";
import { serverL } from "@/i18n/dicts";
import { fill } from "@/lib/fill";
import { bg } from "@/lib/img";

// micromobility.sa/journal - the articles staff write, newest first, with their tags as filters.
const S = (v: unknown) => (typeof v === "string" ? v : "");

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { j, closed } = await journalState(locale);
  return pageMeta({ path: "/journal", locale, title: `${S(j.hero.eyebrow)} · Micromobility`, description: S(j.hero.text), closed });
}

export default async function JournalPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tag?: string }> }) {
  const { locale } = await params;
  const { tag = "" } = await searchParams;
  const { content, previewing, hidden, L, j, posts } = await journalState(locale);
  const tx = serverL(locale);
  const site = resolvePage(siteSchema, content, L);
  const tags = [...new Set(posts.map((p) => p.tag).filter(Boolean))];
  const shown = tag && tags.includes(tag) ? posts.filter((p) => p.tag === tag) : posts;
  const [feature, ...rest] = shown;
  const href = (slug: string) => `/journal/${slug}`;
  const meta = (p: (typeof posts)[number]) => [p.tag, fmtDate(p.date, locale), fill(tx("{n} min read", "{n} د قراءة"), { n: readMinutes(p.body) })].filter(Boolean).join(" · ");
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="jr">
        <p className="jr-eyebrow">{S(j.hero.eyebrow)}</p>
        <h1>{S(j.hero.title)}</h1>
        {S(j.hero.text) && <p className="jr-lead">{S(j.hero.text)}</p>}
        {tags.length > 1 && (
          <nav className="jr-chips" aria-label={S(j.hero.all)}>
            {["", ...tags].map((t) => (
              <a key={t || "all"} href={t ? `/journal?tag=${encodeURIComponent(t)}` : "/journal"} aria-current={(t === tag || (!t && !tags.includes(tag))) ? "page" : undefined}>{t || S(j.hero.all)}</a>
            ))}
          </nav>
        )}
        {!feature ? (
          <p className="jr-empty">{S(j.hero.empty)}</p>
        ) : (
          <>
            <a className="jr-feature" href={href(feature.slug)}>
              <div className="jr-cover" style={feature.cover ? { backgroundImage: `url('${bg(feature.cover)}')` } : undefined} aria-hidden="true" />
              <div>
                <span className="jr-meta">{meta(feature)}</span>
                <h2>{feature.title}</h2>
                {feature.excerpt && <p>{feature.excerpt}</p>}
                <span className="jr-go">{S(j.hero.readMore)} <span aria-hidden="true">{(isRtl(locale) ? "←" : "→")}</span></span>
              </div>
            </a>
            {rest.length > 0 && (
              <div className="jr-grid">
                {rest.map((p) => (
                  <a key={p.slug} href={href(p.slug)}>
                    <div className="jr-cover" style={p.cover ? { backgroundImage: `url('${bg(p.cover, 640)}')` } : undefined} aria-hidden="true" />
                    <span className="jr-meta">{meta(p)}</span>
                    <strong>{p.title}</strong>
                    {p.excerpt && <p>{p.excerpt}</p>}
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
