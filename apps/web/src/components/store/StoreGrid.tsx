"use client";

import { useMemo, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { STORE_SORTS, sortProducts, type StoreCategory, type StoreProduct, type StoreSort } from "@/lib/store-core";
import { T } from "./Store.text";
import ProductCard from "./ProductCard";

// The list at /store: a chip per category that has products, the order, and the cards. Both choices stay
// in the address (?cat=bikes&sort=price-asc), so a shared link opens the same list.
export default function StoreGrid({ locale, products, cats, start, licence }: {
  locale: string; products: StoreProduct[]; cats: StoreCategory[]; start: { cat: string; sort: StoreSort }; licence: boolean;
}) {
  const t = useLocalize(T);
  const [cat, setCat] = useState(start.cat);
  const [sort, setSort] = useState<StoreSort>(start.sort);
  const shown = useMemo(() => sortProducts(cat === "all" ? products : products.filter((p) => p.category === cat), sort), [products, cat, sort]);
  const remember = (c: string, s: StoreSort) => {
    const q = new URLSearchParams(window.location.search);
    if (c === "all") q.delete("cat"); else q.set("cat", c);
    if (s === "featured") q.delete("sort"); else q.set("sort", s);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
  };
  const pickCat = (c: string) => { setCat(c); remember(c, sort); };
  const pickSort = (s: StoreSort) => { setSort(s); remember(cat, s); };

  if (!products.length) return <p className="st-empty">{t.emptyStore}</p>;
  return (
    <>
      <div className="st-tools">
        {cats.length > 1 && (
          <div className="st-chips" role="group" aria-label={t.catsLabel}>
            {(["all", ...cats] as string[]).map((c) => (
              <button key={c} type="button" aria-pressed={cat === c} onClick={() => pickCat(c)}>{t.cats[c] ?? c}</button>
            ))}
          </div>
        )}
        <label className="st-sort">
          <span>{t.sortLabel}</span>
          <select value={sort} onChange={(e) => pickSort(e.target.value as StoreSort)}>
            {STORE_SORTS.map((s) => <option key={s} value={s}>{t.sorts[s]}</option>)}
          </select>
        </label>
      </div>
      <p className="st-count" aria-live="polite">{shown.length === 1 ? t.count1 : t.countN(shown.length)}</p>
      {shown.length ? (
        <div className="st-grid">
          {shown.map((p, i) => <ProductCard key={p.id} p={p} locale={locale} t={t} licence={licence} eager={i < 4} />)}
        </div>
      ) : (
        <div className="st-empty">
          <p>{t.emptyCat}</p>
          <button type="button" className="bk-btn2" onClick={() => pickCat("all")}>{t.showAll}</button>
        </div>
      )}
    </>
  );
}
