import { notFound } from "next/navigation";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { paySettings } from "@/lib/pay/settings";
import { discountLicence, loadBest, loadCats, loadColls, loadStore, storeOpen, type Store } from "@/lib/store";
import type { CollCtx } from "@/lib/store-colls";
import { bannerToday, storeBanner, storeRules, withRules } from "@/lib/store-rules";
import { deliveryOptions, deliveryRange, fmtRange, readyDay, riyadhToday, type DeliveryOption } from "@/lib/store-delivery";
import { intlOf } from "@/i18n/locales";
import { serverLocalize } from "@/i18n/dicts";
import { T } from "./Store.text";

// What every store page needs: the page state, the site's settings, whether the store is open, the
// products (empty when they cannot be read: the pages then say there is nothing yet), the payment and
// delivery settings, and the store's words in this language.
//   The product-management build (2026-11-19): staff's categories (`cats`, the six built-in ones until there are any),
// the collections the public sees (`colls`), the store's settings (`rules`: the limit per order, the low-stock mark, the
// automatic New, the smallest order, the default order) already applied to the products, and today's banner.
export async function storeState(locale: string) {
  const [state, store, cats, colls] = await Promise.all([pageState(), loadStore(), loadCats(), loadColls()]);
  const L = asLocale(locale);
  const today = riyadhToday();
  const rules = storeRules(state.content);
  return {
    ...state,
    site: resolvePage(siteSchema, state.content, L),
    open: storeOpen(state.content),
    store: { products: withRules((store ?? ({ products: [] } as Store)).products, rules, today, Date.now()) } as Store,
    cats,
    colls,
    rules,
    banner: bannerToday(storeBanner(state.content), today),
    settings: paySettings(state.content),
    licence: discountLicence(state.content),
    t: serverLocalize(T, locale),
    today,
  };
}
export type StoreState = Awaited<ReturnType<typeof storeState>>;

/** What the collections are filled from on this page: today, the clock, the licence and the best sellers of each
 *  collection of best sellers the page shows (read only where one is). */
export async function collCtx(s: StoreState): Promise<CollCtx> {
  const best = await loadBest(s.colls.filter((c) => c.kind === "best").map((c) => c.days));
  return { today: s.today, now: Date.now(), licence: s.licence, best: (d) => best.get(d) ?? [] };
}

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

/** The delivery dates of every way staff offer, whatever the cart: the cart and checkout pick from these. `pickup` is
 *  the one day it is ready to collect (F28), null when staff set no days for it. */
export function allWhens(s: StoreState, locale: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const id of ["jeddah", "ksa"] as const) {
    const r = deliveryRange(s.settings.delivery[id].days, s.today);
    out[id] = r ? fmtRange(r, intlOf(locale)) : null;
  }
  const ready = readyDay(s.settings, s.today);
  out.pickup = ready ? fmtRange({ from: ready, to: ready }, intlOf(locale)) : null;
  return out;
}
