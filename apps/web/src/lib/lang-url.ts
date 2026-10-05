// The language in an address. Paths carry none (i18n/routing.ts), so ?lang= is how an address
// names one: a link shared in Arabic, the booking app's own ?lang=, and the per-language
// addresses search engines are given (lib/seo.ts).
import { routing } from "../i18n/routing";

export type Lang = (typeof routing.locales)[number];

/** The language ?lang= asks for, when it is one of the site's. */
export function askedLang(params: URLSearchParams): Lang | null {
  const v = params.get("lang") ?? "";
  return (routing.locales as readonly string[]).includes(v) ? (v as Lang) : null;
}

/** The visitor's language where no page names one (the site-wide 404, app/global-not-found.tsx):
 *  the language they picked (the NEXT_LOCALE cookie), else their browser's first one the site
 *  speaks, else English - the order every page follows (proxy.ts, next-intl). */
export function visitorLang(cookie: string | null | undefined, acceptLanguage: string | null | undefined): Lang {
  const has = (v: string): v is Lang => (routing.locales as readonly string[]).includes(v);
  if (cookie && has(cookie)) return cookie;
  for (const part of String(acceptLanguage ?? "").toLowerCase().split(",")) {
    const base = part.split(";")[0].trim().split("-")[0];
    const code = base === "fil" ? "tl" : base === "in" ? "id" : base;
    if (has(code)) return code;
  }
  return routing.defaultLocale;
}
