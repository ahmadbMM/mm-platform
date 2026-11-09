import { notFound } from "next/navigation";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { paySettings } from "@/lib/pay/settings";
import { discountLicence, loadStore, storeOpen, type Store } from "@/lib/store";
import { deliveryOptions, deliveryRange, fmtRange, riyadhToday, type DeliveryOption } from "@/lib/store-delivery";
import { intlOf } from "@/i18n/locales";
import { serverLocalize } from "@/i18n/dicts";
import { T } from "./Store.text";

// What every store page needs: the page state, the site's settings, whether the store is open, the
// products (empty when they cannot be read: the pages then say there is nothing yet), the payment and
// delivery settings, and the store's words in this language.
export async function storeState(locale: string) {
  const [state, store] = await Promise.all([pageState(), loadStore()]);
  const L = asLocale(locale);
  return {
    ...state,
    site: resolvePage(siteSchema, state.content, L),
    open: storeOpen(state.content),
    store: store ?? ({ products: [] } as Store),
    settings: paySettings(state.content),
    licence: discountLicence(state.content),
    t: serverLocalize(T, locale),
    today: riyadhToday(),
  };
}
export type StoreState = Awaited<ReturnType<typeof storeState>>;

/** The shopping pages answer only while the store is open (the proxy sends /store to the Salla shop
 *  until then; a page reached anyway is not found). An order's page and Track order always answer. */
export function openOr404(s: StoreState): void {
  if (!s.open) notFound();
}

export type ShownOption = DeliveryOption & { when: string | null };
/** The ways to have these products, each with its fee and the dates it is expected on, written here
 *  (the server has every language's dates; a browser may not). */
export function shownOptions(s: StoreState, locale: string, cart: { subtotal: number; shipKsa: boolean }): ShownOption[] {
  return deliveryOptions(s.settings, cart).map((o) => {
    const r = deliveryRange(o.days, s.today);
    return { ...o, when: r ? fmtRange(r, intlOf(locale)) : null };
  });
}

/** The delivery dates of every way staff offer, whatever the cart: the cart and checkout pick from these. */
export function allWhens(s: StoreState, locale: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const id of ["jeddah", "ksa"] as const) {
    const r = deliveryRange(s.settings.delivery[id].days, s.today);
    out[id] = r ? fmtRange(r, intlOf(locale)) : null;
  }
  return out;
}
