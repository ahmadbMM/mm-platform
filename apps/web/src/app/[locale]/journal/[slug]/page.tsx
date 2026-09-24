import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageShell from "@/components/site/PageShell";
import { Link } from "@/i18n/navigation";
import "@/components/journal/journal.css";
import { fmtDate, journalState } from "@/components/journal/journal-data";
import { siteSchema } from "@/content/pages/site";
import { resolvePage } from "@/lib/content";
import { parseBody, readMinutes } from "@/lib/journal";
import { localHref } from "@/lib/links";

// One article of the Journal. Its text is plain text laid out by lib/journal.ts - never markup.
const S = (v: unknown) => (typeof v === "string" ? v : "");

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const { posts, closed } = await journalState(locale);
  const p = posts.find((x) => x.slug === slug);
  if (!p) return { robots: { index: false, follow: false } };
  return { title: `${p.title} · Micromobility`, description: p.excerpt, robots: closed ? { index: false, follow: false } : undefined, openGraph: p.cover ? { images: [p.cover] } : undefined };
}

export default async function ArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const { content, previewing, hidden, L, j, posts } = await journalState(locale);
  const p = posts.find((x) => x.slug === slug);
  if (!p) notFound();
  const ar = L === "ar";
  const site = resolvePage(siteSchema, content, L);
  const others = posts.filter((x) => x.slug !== slug).slice(0, 3);
  const ctaPage = (p.ctaHref.match(/^\/(?:(?:en|ar)\/)?([a-z_]+)/) || [])[1] || "";
  const showCta = p.cta && p.ctaHref && !hidden.includes(ctaPage);
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <article className="jr jr-article">
        <Link className="jr-back" href="/journal"><span aria-hidden="true">{ar ? "→" : "←"}</span> {S(j.hero.eyebrow)}</Link>
        <span className="jr-meta">{[p.tag, fmtDate(p.date, ar), ar ? `${readMinutes(p.body)} د قراءة` : `${readMinutes(p.body)} min read`].filter(Boolean).join(" · ")}</span>
        <h1>{p.title}</h1>
        {p.excerpt && <p className="jr-lead">{p.excerpt}</p>}
        {p.cover && <div className="jr-hero-img" style={{ backgroundImage: `url('${p.cover}')` }} role="img" aria-label={p.title} />}
        <div className="jr-body">
          {parseBody(p.body).map((b, i) => ("h" in b ? <h2 key={i}>{b.h}</h2> : "ul" in b ? <ul key={i}>{b.ul.map((x, k) => <li key={k}>{x}</li>)}</ul> : <p key={i}>{b.p}</p>))}
        </div>
        {showCta && <a className="jr-cta" href={localHref(p.ctaHref, locale)}>{p.cta} <span aria-hidden="true">{ar ? "←" : "→"}</span></a>}
      </article>
      {others.length > 0 && (
        <section className="jr jr-more" aria-labelledby="jr-more-h">
          <h2 id="jr-more-h">{S(j.hero.more)}</h2>
          <div className="jr-grid">
            {others.map((x) => (
              <a key={x.slug} href={`/journal/${x.slug}`}>
                <div className="jr-cover" style={x.cover ? { backgroundImage: `url('${x.cover}')` } : undefined} aria-hidden="true" />
                <span className="jr-meta">{[x.tag, fmtDate(x.date, ar)].filter(Boolean).join(" · ")}</span>
                <strong>{x.title}</strong>
              </a>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
