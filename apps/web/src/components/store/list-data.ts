import { intlOf } from "@/i18n/locales";
import { serverLocalize } from "@/i18n/dicts";
import { cardWhens, listProducts, listQueryOf, type CardWhens, type ListFilters } from "@/lib/store-listing";
import type { StoreProduct, StoreSort } from "@/lib/store-core";
import type { StoreState } from "./store-data";
import { T as W } from "./w2.text";

// What a list page (/store, a category's page, Saved) hands its cards (chain w2): the products without their long texts,
// whether a former price may show (the discount licence), today in Riyadh, and the delivery chip each kind of card says
// (F05), written here because the server has every language's dates.
export type ListProps = { products: StoreProduct[]; licence: boolean; today: string; whens: CardWhens };
export function listProps(s: StoreState, locale: string, products: readonly StoreProduct[] = s.store.products): ListProps {
  return {
    products: listProducts(products),
    licence: !!s.licence,
    today: s.today,
    whens: cardWhens(s.settings, s.today, intlOf(locale), serverLocalize(W, locale)),
  };
}

/** The order and filters a list page's address asks for. */
export const listStart = (q: Record<string, string | string[] | undefined>): { sort: StoreSort; filters: ListFilters } => listQueryOf(q);
