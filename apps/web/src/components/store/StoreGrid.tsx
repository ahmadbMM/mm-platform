"use client";

import { useMemo, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { STORE_SORTS, type StoreProduct, type StoreSort } from "@/lib/store-core";
import { cleanFilters, facetsOf, filterCount, listOf, listQueryText, noFilters, type CardWhens, type ListFilters } from "@/lib/store-listing";
import { activeFilters, withoutFilter } from "@/lib/sx-B1-list";
import { T } from "./Store.text";
import { T as W } from "./w2.text";
import FilterPanel from "./FilterPanel";
import Modal from "./Modal";
import ProductCard from "./ProductCard";
import { StIcon } from "./icons";
import { FilterPills, SortMark } from "./sx-B1-parts";
import "./sx-B1.css";

// A list of products: on /store every product under the category tiles (F01), on a category's page that category's
// (O01-E). The order (O04-A, the Sort select) and the filters (O05-C: a panel beside the list on a wide screen, a
// Filters button opening a centred pop-up on a phone) stay in the address (?sort=price-asc&size=M), so a shared link
// opens the same list. The certified pre-owned products sit apart under the new ones, in their own section with its
// drawn badge (F53). On every screen (SM13-B, P11, P18): Filters and Sort are two equal buttons on one row, the order a
// native menu at 16px drawn as a button (iOS does not zoom it); the filters that are on show as pills above the list,
// each taking itself off, and Filters counts them. Bikes take a wider card (SM03-B, ProductCard).
export default function StoreGrid({ locale, products, start, licence, today, whens }: {
  locale: string; products: StoreProduct[]; start: { sort: StoreSort; filters: ListFilters }; licence: boolean; today: string; whens: CardWhens;
}) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const facets = useMemo(() => facetsOf(products), [products]);
  const [sort, setSort] = useState<StoreSort>(start.sort);
  const [f, setF] = useState<ListFilters>(() => cleanFilters(start.filters, facets));
  const [open, setOpen] = useState(false);
  const { fresh, certified } = useMemo(() => listOf(products, f, sort), [products, f, sort]);
  const shown = fresh.length + certified.length;
  const active = filterCount(f);
  const on = useMemo(() => activeFilters(f, facets), [f, facets]);

  const remember = (nf: ListFilters, s: StoreSort) =>
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${listQueryText(window.location.search, nf, s)}${window.location.hash}`);
  const pickSort = (s: StoreSort) => { setSort(s); remember(f, s); };
  const pickFilters = (nf: ListFilters) => { setF(nf); remember(nf, sort); };
  const clear = () => pickFilters(noFilters());

  if (!products.length) return <p className="st-empty">{t.emptyStore}</p>;
  const card = (p: StoreProduct, i: number) => <ProductCard key={p.id} p={p} locale={locale} t={t} w={w} licence={licence} today={today} whens={whens} eager={i === 0} />;
  return (
    <div className={`st-list${facets.length ? " has-side" : ""}`}>
      {facets.length > 0 && (
        <aside className="st-side" aria-label={w.filters}>
          <div className="st-side-head">
            <h2>{w.filters}</h2>
            {active > 0 && <button type="button" className="st-clear" onClick={clear}>{w.clearAll}</button>}
          </div>
          <FilterPanel facets={facets} f={f} onChange={pickFilters} locale={locale} t={t} w={w} idp="st-side" />
        </aside>
      )}
      <div className="st-list-main">
        <div className="st-tools">
          {facets.length > 0 && (
            <button type="button" className={`st-filter-btn${active ? " on" : ""}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
              <StIcon name="filter" size={18} />{active ? w.filtersN(String(active)) : w.filters}
            </button>
          )}
          <label className="st-sort">
            <span>{t.sortLabel}</span>
            <SortMark />
            <select value={sort} onChange={(e) => pickSort(e.target.value as StoreSort)}>
              {STORE_SORTS.map((s) => <option key={s} value={s}>{t.sorts[s]}</option>)}
            </select>
          </label>
        </div>
        <FilterPills on={on} locale={locale} t={t} w={w} onRemove={(k, v) => pickFilters(withoutFilter(f, k, v))} onClear={clear} />
        <p className="st-count" aria-live="polite">{shown === 1 ? t.count1 : t.countN(shown)}</p>
        {shown === 0 ? (
          <div className="st-empty">
            <p>{active ? w.noMatch : t.emptyCat}</p>
            {active > 0 && <button type="button" className="bk-btn2" onClick={clear}>{w.clearFilters}</button>}
          </div>
        ) : (
          <>
            {fresh.length > 0 && <div className="st-grid">{fresh.map(card)}</div>}
            {certified.length > 0 && (
              <section className="st-cert" aria-labelledby="st-cert-h">
                <h2 id="st-cert-h" className="st-h2"><StIcon name="badge" size={24} />{w.certified}</h2>
                <div className="st-grid">{certified.map((p, i) => card(p, fresh.length + i))}</div>
              </section>
            )}
          </>
        )}
      </div>
      {open && (
        <Modal title={w.filters} onClose={() => setOpen(false)} closeLabel={t.close}>
          <FilterPanel facets={facets} f={f} onChange={pickFilters} locale={locale} t={t} w={w} idp="st-pop" />
          <div className="st-pop-acts">
            <button type="button" className="bk-btn2" onClick={clear} disabled={!active}>{w.clearAll}</button>
            <button type="button" className="bk-btn grow" onClick={() => setOpen(false)}>{shown === 1 ? w.show1 : w.showN(String(shown))}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
