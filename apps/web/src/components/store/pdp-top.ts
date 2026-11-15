import { helpSchema } from "@/content/pages/help";
import { asLocale, resolvePage } from "@/lib/content";
import { payEnv, payReady } from "@/lib/pay/config";
import { SITE_URL } from "@/lib/seo";
import { productHref, relatedOf, type StoreProduct } from "@/lib/store";
import { storeSwitches } from "@/lib/store-settings";
import { waDigits } from "@/lib/store-pdp";
import { allWhens, type StoreState } from "./store-data";
import type { TopProps } from "./ProductTop";

// What the top of a product's page is drawn from (store build 2026-11-15, chain w3a), on the server: the product and
// its add-ons cut down to what the browser needs, the delivery dates in this language, the returns answers staff keep
// on the Help page (read whether or not that page is switched on), the WhatsApp number, and the two switches.

/** The product without the long texts the sections below the buy box draw on the server (w3b's). */
const slim = (p: StoreProduct): StoreProduct => ({ ...p, description_en: null, description_ar: null, specs: [], faq: [], box: [], fit: null });
/** An add-on as the Extras step draws it: its first photo, its name, its variants. */
const slimExtra = (p: StoreProduct): StoreProduct => ({ ...slim(p), tagline_en: null, tagline_ar: null, images: p.images.slice(0, 1), image_meta: {}, key_specs: [], sizes: [] });

const S = (v: unknown) => (typeof v === "string" ? v : "");
type Sec = Record<string, unknown>;

export function topProps(s: StoreState, p: StoreProduct, locale: string): TopProps {
  const help = resolvePage(helpSchema, s.content, asLocale(locale));
  const policy = (Array.isArray(help.topics.returns) ? (help.topics.returns as Sec[]) : [])
    .map((x) => ({ q: S(x.q).trim(), a: S(x.a).trim() })).filter((x) => x.q && x.a);
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
    tabby: storeSwitches(s.content).tabby,
    // Apple Pay pays on the payment page only where Apple knows the site (its domain file, a Worker secret)
    applePay: payReady() && !!payEnv().APPLE_PAY_DOMAIN_FILE,
    href: `${SITE_URL}${productHref(p)}`,
  };
}
