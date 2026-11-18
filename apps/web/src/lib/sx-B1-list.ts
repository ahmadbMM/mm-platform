import { isBike, type StoreProduct } from "./store-core";
import { FILTER_KEYS, type Facet, type FacetOption, type FilterKey, type ListFilters } from "./store-listing";

// The store's lists on every screen (the user, 2026-11-18: "do all" of the store and Experiences mobile report, builder
// B1): how big a card is (SM03-B), the filters that are on as pills above the list (SM13-B), the card's name with the
// brand said once (P22) and which of a list's photos load first (SM12-B). Pure, so the server's first drawing and the
// browser's agree and the rules are unit-tested (src/lib/__tests__/sx-B1.test.ts).

/** A bike takes a whole row on a phone, half a row on a tablet and two of four columns on a computer (SM03-B, which
 *  reopens D02-A at the owner's "do all"); everything else keeps one cell. A gift card is never a bike. */
export const isWideCard = (p: Pick<StoreProduct, "category" | "kind" | "top">): boolean => p.kind === "item" && isBike(p);

/** The `sizes` of a card's photos, for the grid store.css draws (SM03-B, SM08-B): two cells a row on a phone (a bike the
 *  whole row), six columns on a tablet (a cell two, a bike three), four beside the 212px filter panel on a computer (a
 *  bike two) and four across a list without the panel (Saved). Never more than a 1,320px page holds. */
export const cardSizes = (wide: boolean): string => wide
  ? "(max-width: 699px) calc(100vw - 32px), (max-width: 999px) 50vw, (max-width: 1179px) 46vw, 680px"
  : "(max-width: 699px) 50vw, (max-width: 999px) 33vw, (max-width: 1179px) 30vw, 330px";

/** How a list's photo loads (SM12-B): the first card's first photo at once and before anything else, every other photo
 *  when it nears the screen. */
export type PhotoLoad = { loading: "eager" | "lazy"; fetchPriority?: "high" };
export const photoLoad = (first: boolean, photo: number): PhotoLoad =>
  first && photo === 0 ? { loading: "eager", fetchPriority: "high" } : { loading: "lazy" };

/** A filter that is on, as a pill above the list (SM13-B): its group, its value in the address and the choice it is. */
export type ActiveFilter = { key: FilterKey; value: string; option: FacetOption };
/** The filters that are on, in the panel's order (price, size, colour, brand; each group in its choices' order). A value
 *  the facets do not offer is never on (cleanFilters dropped it). */
export function activeFilters(f: ListFilters, facets: readonly Facet[]): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  for (const key of FILTER_KEYS) {
    const fc = facets.find((x) => x.key === key);
    if (!fc) continue;
    for (const o of fc.options) if (f[key].includes(o.value)) out.push({ key, value: o.value, option: o });
  }
  return out;
}

/** The filters with one value taken off (a pill's own remove). */
export const withoutFilter = (f: ListFilters, key: FilterKey, value: string): ListFilters => ({ ...f, [key]: f[key].filter((v) => v !== value) });

/** A product's name as its card draws it (P22, "brand once"): the card's brand line already says the brand, so a name
 *  that starts with it in Latin letters ("ALVAS TT BGP" under "Alvas") keeps only the rest ("TT BGP"). A name that is
 *  nothing but the brand, or does not start with it as a word of its own, stays whole. The Arabic names lead with the
 *  model in Latin letters (the data fix SX/sql/B1.sql), set in a <bdi> by BidiText. */
export function brandOnce(name: string, brand: string | null | undefined): string {
  const b = (brand ?? "").trim();
  if (!b) return name;
  const n = name.trim();
  if (n.length <= b.length || n.slice(0, b.length).toLowerCase() !== b.toLowerCase()) return name;
  const rest = n.slice(b.length);
  if (!/^[\s ]+\S/.test(rest)) return name;
  return rest.trim();
}
