import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import RecentRow from "@/components/store/RecentRow";
import SavedList from "@/components/store/SavedList";
import { listProps } from "@/components/store/list-data";
import { openOr404, storeState } from "@/components/store/store-data";
import { T as W } from "@/components/store/w2.text";
import { Link } from "@/i18n/navigation";
import { serverLocalize } from "@/i18n/dicts";
import { recentItems } from "@/lib/store-listing";
import { MAX_SAVED } from "@/lib/store-lists";
import { sharedSlugs } from "@/lib/sx-B2";
import SavedShare from "@/components/store/sx-B2-saved";
import { T as B } from "@/components/store/sx-B2.text";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";
import "@/components/store/sx-B2.css";

// micromobility.sa/store/saved (F07): what this browser saved with a card's heart, no account needed. The list lives in
// the browser alone, so the page is drawn there and is never indexed.
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const s = await storeState(locale);
  return pageMeta({ path: "/store/saved", locale, title: `${serverLocalize(W, locale).saved} · Micromobility`, noindex: true, closed: s.closed || !s.open });
}

export default async function SavedPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const shared = sharedSlugs((await searchParams).list, MAX_SAVED);
  const s = await storeState(locale);
  openOr404(s);
  const { t } = s;
  const w = serverLocalize(W, locale);
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st">
        <nav className="st-crumbs" aria-label={t.store}>
          <ol>
            <li><Link href="/store">{t.store}</Link></li>
            <li aria-current="page">{w.saved}</li>
          </ol>
        </nav>
        <header className="st-head st-b2-savedhead">
          <h1>{shared ? serverLocalize(B, locale).sharedList : w.saved}</h1>
          {!shared && <SavedShare title={w.saved} />}
        </header>
        <SavedList locale={locale} {...listProps(s, locale)} shared={shared} />
        <RecentRow items={recentItems(s.store.products, locale)} locale={locale} />
      </div>
    </PageShell>
  );
}
