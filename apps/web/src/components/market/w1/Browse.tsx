"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useLocalize } from "@/i18n/TxProvider";
import { MK_SELLER_KINDS, MK_SORTS, SA_CITIES, isMkCity, isMkSort, mkCityName, mkErrorKey, type MkCard } from "@/lib/market/core";
import { W1_NONE, w1Further, w1Href, w1Key, w1Narrowed, w1Q, type W1Filters } from "@/lib/market/w1";
import MkIcon from "../MkIcon";
import MkModal from "../MkModal";
import { T, mkErrorText } from "../Market.text";
import { T as W } from "../w1.text";
import Filters from "./Filters";
import ListingCard from "./ListingCard";
import Results from "./Results";

// The Marketplace's browse page (micromobility.sa/marketplace), under the page's heading: the keyword search, the
// sport chips (only the sports with something on sale), who is selling (All / Private / Shops / MicroMobility), the
// city and the order, the Filters button, and the grid. Every choice is in the page's address (lib/market/w1.ts), so
// a search can be shared, opened in a new tab and walked back through; the chips are real links, and the page is drawn
// on the server for whatever its address asks. Here only the moving parts live:
//   - a choice goes to its address without leaving the page, and while the new results are on their way the grid says
//     so (aria-busy, dimmed) instead of jumping;
//   - Filters opens the further filters (product type, condition, price range): a centred pop-up on a phone
//     (MkModal: the keyboard kept inside it, Escape and a tap outside close it), a panel beside the grid from 1000px
//     wide, which stays open while the visitor tries one filter after another;
//   - the list grows by its "Show more" button (./Results.tsx), never by scrolling.
// What it is handed is already decided on the server (app/[locale]/marketplace/page.tsx): the chips and types that
// have something to show, the first page, or why there is none.
type Named = { slug: string; name: string };
export type BrowseProps = {
  locale: string;
  /** The page's own address without its filters. */
  base: string;
  filters: W1Filters;
  /** The sports with something on sale, in staff's order. */
  sports: Named[];
  /** The product types the Filters offer (those of the sport picked). */
  types: Named[];
  /** The first page; null when it could not be read (`fail` says why). */
  result: { items: MkCard[]; next: string | null } | null;
  fail: { error: string; detail: string } | null;
  /** For a search that found nothing: where to look next (a sport's name, or null for everything), and the newest listings. */
  near: { key: string; name: string | null; filters: W1Filters }[];
  newest: MkCard[];
  /** The "Sell an item" button, drawn on the server. */
  sell: ReactNode;
};

const WIDE = "(min-width: 1000px)";
const watchWide = (cb: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export default function Browse({ locale, base, filters, sports, types, result, fail, near, newest, sell }: BrowseProps) {
  const t = useLocalize(T);
  const w = useLocalize(W);
  const router = useRouter();
  const id = useId();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const wide = useSyncExternalStore(watchWide, () => window.matchMedia(WIDE).matches, () => false);
  const button = useRef<HTMLButtonElement>(null);
  const side = useRef<HTMLHeadingElement>(null);
  const panel = open && wide, popup = open && !wide;

  // the side panel is not a pop-up, so the keyboard is only shown where it opened
  useEffect(() => { if (panel) side.current?.focus({ preventScroll: true }); }, [panel]);

  const go = (next: W1Filters) => start(() => { router.push(w1Href(base, next), { scroll: false }); });
  /** A chip is a link (a new tab, a crawler, no script: its address); a plain tap changes the page in place. */
  const tap = (next: W1Filters) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(next);
  };
  const chip = (label: string, next: W1Filters, on: boolean, key: string) => (
    <Link key={key} href={w1Href(base, next)} scroll={false} className="mk-chip" aria-current={on ? "true" : undefined} onClick={tap(next)}>{label}</Link>
  );
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    go({ ...filters, q: w1Q(String(new FormData(e.currentTarget).get("q") ?? "")) });
  }
  const close = () => { setOpen(false); button.current?.focus({ preventScroll: true }); };
  const apply = (next: W1Filters) => { if (!wide) setOpen(false); go(next); };

  const further = w1Further(filters);
  const narrowed = w1Narrowed(filters);
  const items = result?.items ?? [];

  return (
    <div className="mk-w1-browse">
      <header className="mk-w1-head">
        <h1>{t.name}</h1>
        {sell}
      </header>

      <form className="mk-w1-search" role="search" action={base} method="get" onSubmit={search}>
        <label htmlFor={`${id}-q`} className="mm-sr">{w.searchHint}</label>
        <MkIcon name="search" size={20} />
        {/* the box stays in the page's direction, so its room for the mark is on the mark's side; what is typed finds
            its own direction (w1.css: unicode-bidi plaintext, which is what dir="auto" gives a text box) */}
        <input key={filters.q} id={`${id}-q`} type="search" name="q" defaultValue={filters.q} maxLength={80} placeholder={w.searchHint} enterKeyHint="search" autoComplete="off" />
        {/* without script the form still searches inside what is picked */}
        {filters.type ? <input type="hidden" name="type" value={filters.type} /> : filters.sport ? <input type="hidden" name="sport" value={filters.sport} /> : null}
        {filters.seller && <input type="hidden" name="seller" value={filters.seller} />}
        {filters.city && <input type="hidden" name="city" value={filters.city} />}
        {filters.condition && <input type="hidden" name="condition" value={filters.condition} />}
        {filters.min !== null && <input type="hidden" name="min" value={filters.min} />}
        {filters.max !== null && <input type="hidden" name="max" value={filters.max} />}
        {filters.sort !== "new" && <input type="hidden" name="sort" value={filters.sort} />}
        <button type="submit" className="mk-btn2">{w.search}</button>
      </form>

      {sports.length > 0 && (
        <nav className="mk-chips mk-w1-sports" aria-label={w.sports}>
          {chip(w.all, { ...filters, sport: null, type: null }, !filters.sport, "all")}
          {sports.map((s) => chip(s.name, { ...filters, sport: s.slug, type: null }, filters.sport === s.slug, s.slug))}
        </nav>
      )}

      <div className="mk-w1-bar">
        <div className="mk-chips mk-w1-seg" role="group" aria-label={w.seller}>
          {chip(w.all, { ...filters, seller: null }, !filters.seller, "all")}
          {MK_SELLER_KINDS.map((k) => chip(w.sellers[k], { ...filters, seller: k }, filters.seller === k, k))}
        </div>
        <div className="mk-w1-picks">
          <div className="mk-field">
            <label htmlFor={`${id}-city`} className="mm-sr">{w.city}</label>
            <select id={`${id}-city`} value={filters.city ?? ""} onChange={(e) => go({ ...filters, city: isMkCity(e.target.value) ? e.target.value : null })}>
              <option value="">{w.allCities}</option>
              {SA_CITIES.map((c) => <option key={c.key} value={c.key}>{mkCityName(c.key, locale)}</option>)}
            </select>
          </div>
          <div className="mk-field">
            <label htmlFor={`${id}-sort`} className="mm-sr">{w.sort}</label>
            <select id={`${id}-sort`} value={filters.sort} onChange={(e) => go({ ...filters, sort: isMkSort(e.target.value) ? e.target.value : "new" })}>
              {MK_SORTS.map((s) => <option key={s} value={s}>{w.sorts[s]}</option>)}
            </select>
          </div>
          <button ref={button} type="button" className="mk-btn2 mk-w1-fbtn" aria-expanded={open} aria-controls={panel ? `${id}-side` : undefined}
            aria-label={further ? w.filtersOn(further) : undefined} onClick={() => setOpen((o) => !o)}>
            <MkIcon name="filter" size={18} />{w.filters}
            {further > 0 && <span className="mk-w1-n" aria-hidden="true">{further}</span>}
          </button>
          {narrowed && <Link href={base} scroll={false} className="mk-link mk-w1-clear" onClick={tap(W1_NONE)}>{w.clearAll}</Link>}
        </div>
      </div>

      <div className={`mk-w1-layout${panel ? " mk-w1-layout-side" : ""}`}>
        {panel && (
          <aside id={`${id}-side`} className="mk-box mk-w1-side" aria-labelledby={`${id}-side-h`} onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
            <div className="mk-pop-head">
              <h2 id={`${id}-side-h`} ref={side} tabIndex={-1} className="mk-pop-title">{w.filters}</h2>
              <button type="button" className="mk-x" onClick={close} aria-label={t.close}><MkIcon name="close" size={18} /></button>
            </div>
            <Filters filters={filters} types={types} onApply={apply} t={t} w={w} />
          </aside>
        )}

        <section className={`mk-w1-results${pending ? " mk-w1-wait" : ""}`} aria-label={w.listings} aria-busy={pending}>
          <p className="mm-sr" role="status">{pending ? w.loading : ""}</p>
          {!result ? (
            <div className="mk-empty" role="alert">
              <p>{fail && (fail.error === "absent" || fail.error === "busy") ? mkErrorText(t, mkErrorKey(fail.error, fail.detail)) : w.loadError}</p>
              <a className="mk-btn2" href={w1Href(base, filters)}>{t.retry}</a>
            </div>
          ) : items.length > 0 ? (
            <Results key={w1Key(filters)} items={items} next={result.next} filters={filters} locale={locale} />
          ) : !narrowed ? (
            <div className="mk-empty">
              <p>{w.empty}</p>
              {sell}
            </div>
          ) : (
            <>
              <div className="mk-empty">
                <p>{w.none}</p>
                {/* the chips say where to look next by themselves: their name is for a screen reader, not a line on the page */}
                {near.length > 0 && (
                  <nav className="mk-w1-near" aria-label={w.nearby}>{near.map((n) => chip(n.name ?? w.allListings, n.filters, false, n.key))}</nav>
                )}
              </div>
              {newest.length > 0 && (
                <div className="mk-w1-also">
                  <h2>{w.newest}</h2>
                  <ul className="mk-w1-grid" role="list">
                    {newest.map((c) => <li key={c.id}><ListingCard c={c} t={t} w={w} locale={locale} /></li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {popup && (
        <MkModal title={w.filters} onClose={close}>
          <Filters filters={filters} types={types} onApply={apply} popup t={t} w={w} />
        </MkModal>
      )}
    </div>
  );
}
