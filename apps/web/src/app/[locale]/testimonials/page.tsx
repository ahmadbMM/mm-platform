import type { Metadata } from "next";
import { askSite } from "@/components/ask/AskFrame";
import Stars from "@/components/testimonials/Stars";
import TestimonialCard from "@/components/testimonials/TestimonialCard";
import TmFrame from "@/components/testimonials/TmFrame";
import { T } from "@/components/testimonials/Testimonials.text";
import "@/components/learn/learn.css";
import "@/components/pages/pages.css";
import "@/components/testimonials/testimonials.css";
import { serverLocalize } from "@/i18n/dicts";
import { Link } from "@/i18n/navigation";
import { pageMeta } from "@/lib/seo";
import { isComingSoon, loadSiteContent, siteCanOpen } from "@/lib/site";
import { TM_PAGE, testimonialsOn, tmAboutParam, tmAvg, tmHref, tmPageParam, tmPills, tmTotal } from "@/lib/testimonials";
import { readTestimonials } from "@/lib/testimonials-server";

// micromobility.sa/testimonials: what riders say, as staff published it (testimonials_public). At the top the average of
// the published stars and how many there are, and "Write yours"; pills to show one kind only (only the kinds that have
// any, and only when two or more do); the cards, 60 a page. It opens by its link whatever the launch switch says
// (site_content 'testimonials.on'): while it is off the page is never in search engines (noindex), the sitemap or the
// header; once on it is all three (lib/testimonials.ts). Kept at the edge like any page for everyone (lib/page-cache.ts).
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = serverLocalize(T, locale);
  const content = await loadSiteContent();
  const closed = siteCanOpen() ? isComingSoon(content) : true;
  return pageMeta({ path: "/testimonials", locale, title: `${t.title} · Micromobility`, description: t.metaDesc, closed, noindex: !testimonialsOn(content) });
}

export default async function TestimonialsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  const q = await searchParams;
  const about = tmAboutParam(q.about);
  const page = tmPageParam(q.page);
  const t = serverLocalize(T, locale);
  const [at, list] = await Promise.all([askSite(locale), readTestimonials(about, (page - 1) * TM_PAGE)]);
  const total = tmTotal(list, about);
  const pills = tmPills(list);
  const avg = list.avg !== null ? tmAvg(list.avg, locale) : null;
  const summary = list.count === 0 ? null
    : avg !== null ? (list.count === 1 ? t.avgOfOne(avg) : t.avgOf(avg, list.count))
    : list.count === 1 ? t.countOne : t.countOf(list.count);
  const more = page * TM_PAGE < total;
  return (
    <TmFrame locale={locale} at={at}>
      <div className="pg tm-page">
        <p className="pg-eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <div className="tm-sum">
          {summary && (
            <p className="tm-avg">
              {list.avg !== null && avg !== null && <Stars value={list.avg} label={t.starsOf(avg)} size={22} />}
              <span>{summary}</span>
            </p>
          )}
          <Link className="pg-btn" href="/testimonials/write">{t.writeYours}</Link>
        </div>
        {pills.length > 0 && (
          <nav className="tm-pills" aria-label={t.topics}>
            <Link href={tmHref(null)} aria-current={about === null ? "page" : undefined}>{t.all}</Link>
            {pills.map((a) => <Link key={a} href={tmHref(a)} aria-current={about === a ? "page" : undefined}>{t.about[a]}</Link>)}
          </nav>
        )}
        {list.items.length > 0
          ? <div className="tm-grid">{list.items.map((c) => <TestimonialCard key={c.id} c={c} w={t} />)}</div>
          : <p className="tm-empty">{t.empty}</p>}
        {(page > 1 || more) && (
          <nav className="tm-pager" aria-label={t.pages}>
            {page > 1 && <Link href={tmHref(about, page - 1)} rel="prev">{t.prev}</Link>}
            {more && <Link href={tmHref(about, page + 1)} rel="next">{t.next}</Link>}
          </nav>
        )}
      </div>
    </TmFrame>
  );
}
