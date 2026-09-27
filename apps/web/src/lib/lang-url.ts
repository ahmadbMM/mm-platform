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
