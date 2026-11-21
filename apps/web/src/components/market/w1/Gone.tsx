import { getLocale } from "next-intl/server";
import MkFrame, { marketSite } from "@/components/market/MkFrame";
import { T } from "@/components/market/Market.text";
import { T as W } from "@/components/market/w1.text";
import "@/components/market/w1.css";
import { serverLocalize } from "@/i18n/dicts";
import { Link } from "@/i18n/navigation";
import { MK_HOME, mkCatName } from "@/lib/market/core";
import { loadMarketCategories } from "@/lib/market/server";
import { W1_NONE, w1Href, w1SportChips } from "@/lib/market/w1";
import { browseKept } from "@/lib/market/w1-server";
import { stagingTitle } from "@/lib/staging";
import ListingCard from "./ListingCard";

// A listing that is not shown any more (sold a while ago, deleted, removed, expired, or a number that never was one):
// the address answers "not found" (app/[locale]/marketplace/[id]/not-found.tsx draws this), which also takes it out of
// search engines, and the page says so and leads on: the Marketplace, the sports with something on sale, and the
// newest listings. Nothing about the listing itself is said or kept.
export default async function Gone() {
  const locale = await getLocale();
  const [at, cats, newest] = await Promise.all([marketSite(locale), loadMarketCategories(), browseKept({})]);
  const t = serverLocalize(T, locale), w = serverLocalize(W, locale);
  const data = newest.ok ? newest.data : null;
  const sports = w1SportChips(cats, data?.sports ?? [], null);
  const items = (data?.items ?? []).slice(0, 8);
  return (
    <MkFrame locale={locale} at={at}>
      <title>{stagingTitle(`${w.goneTitle} · MicroMobility`)}</title>
      <div className="mk-w1-gone">
        <h1>{w.goneTitle}</h1>
        <p><Link className="mk-btn" href={MK_HOME}>{w.browse}</Link></p>
        {sports.length > 0 && (
          <nav className="mk-chips" aria-label={w.sports}>
            {sports.map((s) => <Link key={s.slug} className="mk-chip" href={w1Href(MK_HOME, { ...W1_NONE, sport: s.slug })}>{mkCatName(s, locale)}</Link>)}
          </nav>
        )}
        {items.length > 0 && (
          <section className="mk-w1-also">
            <h2>{w.newest}</h2>
            <ul className="mk-w1-grid" role="list">
              {items.map((c) => <li key={c.id}><ListingCard c={c} t={t} w={w} locale={locale} /></li>)}
            </ul>
          </section>
        )}
      </div>
    </MkFrame>
  );
}
