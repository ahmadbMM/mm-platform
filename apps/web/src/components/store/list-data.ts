import { intlOf } from "@/i18n/locales";
import { serverLocalize } from "@/i18n/dicts";
import { cardWhens, listProducts, listQueryOf, type CardWhens, type FilterKey, type ListFilters, type WhenWords } from "@/lib/store-listing";
import type { StoreProduct, StoreSort } from "@/lib/store-core";
import { catFilters, type StoreCat } from "@/lib/store-cats";
import type { StoreState } from "./store-data";
import { T as W } from "./w2.text";
import { T as ST } from "./Store.text";
import { T as B1 } from "./sx-B1.text";

// What a list page (/store, a category's page, Saved) hands its cards (chain w2): the products without their long texts,
// whether a former price may show (the discount licence), today in Riyadh, and the delivery chip each kind of card says
// (F05), written here because the server has every language's dates.
//   The product-management build (2026-11-19): the filter groups the list offers (`groups`: the category's own, else the
// store's) and the store's own order (`dflt`, store.sort).
export type ListProps = { products: StoreProduct[]; licence: boolean; today: string; whens: CardWhens; groups?: readonly FilterKey[]; dflt?: StoreSort };
export function listProps(s: StoreState, locale: string, products: readonly StoreProduct[] = s.store.products, cat: StoreCat | null = null): ListProps {
  return {
    products: listProducts(products),
    licence: !!s.licence,
    today: s.today,
    whens: cardWhens(s.settings, s.today, intlOf(locale), wordsOf(locale)),
    groups: catFilters(s.cats, cat),
    dflt: s.rules.sort,
  };
}

/** The delivery chip's words: the days, and each way's own name for a way staff gave no days (SM04-B). */
function wordsOf(locale: string): WhenWords {
  const st = serverLocalize(ST, locale);
  return { ...serverLocalize(W, locale), ways: { pickup: serverLocalize(B1, locale).collectJeddah, jeddah: st.jeddah, ksa: st.ksa } };
}

/** The order and filters a list page's address asks for (no order asked for: the store's own, `dflt`). */
export const listStart = (q: Record<string, string | string[] | undefined>, dflt: StoreSort = "featured"): { sort: StoreSort; filters: ListFilters } => listQueryOf(q, dflt);
