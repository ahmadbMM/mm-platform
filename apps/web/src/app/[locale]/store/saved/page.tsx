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
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store/saved (F07): what this browser saved with a card's heart, no account needed. The list lives in
// the browser alone, so the page is drawn there and is never indexed.
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const s = await storeState(locale);
  return pageMeta({ path: "/store/saved", locale, title: `${serverLocalize(W, locale).saved} · Micromobility`, noindex: true, closed: s.closed || !s.open });
}

export default async function SavedPage({ params }: Props) {
  const { locale } = await params;
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
        <header className="st-head">
          <h1>{w.saved}</h1>
        </header>
        <SavedList locale={locale} {...listProps(s, locale)} />
        <RecentRow items={recentItems(s.store.products, locale)} locale={locale} />
      </div>
    </PageShell>
  );
}
