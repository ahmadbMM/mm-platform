"use client";

import { Link } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { MAX_SAVED } from "@/lib/store-lists";
import { bySlugs } from "@/lib/store-listing";
import type { ListProps } from "./list-data";
import ProductCard from "./ProductCard";
import { T } from "./Store.text";
import { useHydrated } from "./useCart";
import { useSaved } from "./useLists";
import { T as W } from "./w2.text";

// /store/saved (F07): the products this browser saved with a card's heart, newest first, as the store's cards (a heart
// tapped again takes one out). No account: the list is kept in this browser alone. Drawn once the page runs in the
// browser, which is where the list is. A list a friend shared (N01, the "do all" build of 2026-11-18:
// /store/saved?list=...) shows those products instead, each with its own heart.
export default function SavedList({ locale, products, licence, today, whens, shared = null }: ListProps & { locale: string; shared?: string[] | null }) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const own = useSaved();
  const slugs = shared ?? own;
  const ready = useHydrated();
  if (!ready) return <div className="st-cart-wait" />;
  const list = bySlugs(products, slugs, MAX_SAVED);
  if (!list.length) {
    return (
      <div className="st-empty">
        <p>{w.savedEmpty}</p>
        <Link href="/store" className="bk-btn">{t.browse}</Link>
      </div>
    );
  }
  return (
    <>
      <p className="st-count" aria-live="polite">{list.length === 1 ? t.count1 : t.countN(list.length)}</p>
      <div className="st-grid">
        {list.map((p, i) => <ProductCard key={p.id} p={p} locale={locale} t={t} w={w} licence={licence} today={today} whens={whens} eager={i === 0} />)}
      </div>
    </>
  );
}
