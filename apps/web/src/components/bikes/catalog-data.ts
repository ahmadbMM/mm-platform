import { bikesSchema } from "@/content/pages/bikes";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { loadCatalog } from "@/lib/catalog";
import { pageState } from "@/lib/page-state";
import { serverL } from "@/i18n/dicts";

// What every catalogue page needs: the page state (Bikes is a switched page), the site's settings
// and the page's own words for this language, and the catalogue itself (null when it could not be
// read and nothing was read before - the pages then show their empty state).
export async function bikesState(locale: string) {
  const [state, catalog] = await Promise.all([pageState("bikes"), loadCatalog()]);
  const L = asLocale(locale);
  return {
    ...state,
    L,
    tx: serverL(locale),
    site: resolvePage(siteSchema, state.content, L),
    c: resolvePage(bikesSchema, state.content, L),
    catalog,
  };
}

export type BikesState = Awaited<ReturnType<typeof bikesState>>;

export const S = (v: unknown) => (typeof v === "string" ? v : "");
