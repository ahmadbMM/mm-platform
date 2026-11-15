import { helpSchema } from "@/content/pages/help";
import { asLocale, resolvePage } from "@/lib/content";
import { payEnv, payReady } from "@/lib/pay/config";
import { tabbyKeys } from "@/lib/pay/tabby";
import { storeEnv } from "@/lib/store-api";
import { SITE_URL } from "@/lib/seo";
import { linePhotos, productHref, relatedOf, type StoreProduct } from "@/lib/store";
import { returnsAnswers } from "@/lib/policies";
import { storeSwitches } from "@/lib/store-settings";
import { waDigits } from "@/lib/store-pdp";
import { allWhens, type StoreState } from "./store-data";
import type { TopProps } from "./ProductTop";

// What the top of a product's page is drawn from (store build 2026-11-15, chain w3a), on the server: the product and
// its add-ons cut down to what the browser needs, the delivery dates in this language, the returns answers staff keep
// on the Help page (read whether or not that page is switched on), the WhatsApp number, and the two switches.

/** The product without the long texts the sections below the buy box draw on the server (w3b's). */
const slim = (p: StoreProduct): StoreProduct => ({ ...p, description_en: null, description_ar: null, specs: [], faq: [], box: [], fit: null });
/** An add-on as the Extras step draws it: its name, its variants, and its first photo and each colour's first (the row's
 *  photo follows the choice picked, as the cart's line will: linePhoto). */
const slimExtra = (p: StoreProduct): StoreProduct => {
  const images = linePhotos(p);
  return { ...slim(p), tagline_en: null, tagline_ar: null, images, key_specs: [], sizes: [],
    image_meta: Object.fromEntries(images.filter((src) => p.image_meta[src]).map((src) => [src, p.image_meta[src]])) };
};

const S = (v: unknown) => (typeof v === "string" ? v : "");

export function topProps(s: StoreState, p: StoreProduct, locale: string): TopProps {
  const help = resolvePage(helpSchema, s.content, asLocale(locale));
  // the Returns page's own answers (lib/policies.ts, w1's /returns), so the pop-up and the page never differ
  const policy = returnsAnswers(help.topics.returns);
  return {
    p: slim(p),
    locale,
    licence: s.licence,
    today: s.today,
    related: p.category === "bikes" ? relatedOf(s.store, p.goes_with, p.id).map(slimExtra) : [],
    settings: s.settings,
    whens: allWhens(s, locale),
    showroom: S(s.site.contact.address),
    policy,
    whatsapp: waDigits(S(s.site.social.whatsapp), S(s.site.contact.phone)),
    // the line under the price promises only what the payment page offers: its Tabby tile wants the switch AND Tabby's
    // keys (app/[locale]/pay/[id]/page.tsx), so the line does too (off means absent)
    tabby: storeSwitches(s.content).tabby && tabbyKeys(storeEnv()),
    // Apple Pay pays on the payment page only while payments are on and where Apple knows the site (its domain file, a
    // Worker secret): the cart's express button asks the same (app/[locale]/store/cart/page.tsx)
    applePay: s.settings.enabled && payReady() && !!payEnv().APPLE_PAY_DOMAIN_FILE,
    href: `${SITE_URL}${productHref(p)}`,
  };
}
