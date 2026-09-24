// The language in an address. Paths carry none (i18n/routing.ts), so ?lang= is how an address
// names one: a link shared in Arabic, the booking app's own ?lang=, and the per-language
// addresses search engines are given.
import { routing } from "../i18n/routing";

export type Lang = (typeof routing.locales)[number];

/** The language ?lang= asks for, when it is one of the site's. */
export function askedLang(params: URLSearchParams): Lang | null {
  const v = params.get("lang") ?? "";
  return (routing.locales as readonly string[]).includes(v) ? (v as Lang) : null;
}

/** An HTTP Link header naming this page in each language, and the plain address as the default.
 *  next-intl sends this only when the language is in the path, so search engines would otherwise
 *  see one language per page and never the Arabic site. */
export function alternateLinks(url: URL): string {
  const at = (lang: Lang | null) => {
    const u = new URL(url.pathname + url.search, url.origin);
    if (lang) u.searchParams.set("lang", lang);
    else u.searchParams.delete("lang");
    return u.toString();
  };
  return [
    ...routing.locales.map((l) => `<${at(l)}>; rel="alternate"; hreflang="${l}"`),
    `<${at(null)}>; rel="alternate"; hreflang="x-default"`,
  ].join(", ");
}
