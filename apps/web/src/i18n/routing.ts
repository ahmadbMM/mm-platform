import { defineRouting } from "next-intl/routing";
import { LOCALE_CODES } from "./locales";

/** The visitor's language, remembered for a year: it is the only place it is kept. */
export const LANG_COOKIE = { name: "NEXT_LOCALE", maxAge: 60 * 60 * 24 * 365 };

// No language in the address (owner, 2026-09-25): micromobility.sa/club is the same page in
// every language (locales.ts lists them). A visitor reads the language they last picked
// (LANG_COOKIE), else their browser's, else English; ?lang=<code> in an address picks one
// (proxy.ts). Old /en/... and /ar/... links still work: they redirect to the page without the
// prefix, in that language - which is also how the header's language menu switches.
export const routing = defineRouting({
  locales: LOCALE_CODES,
  defaultLocale: "en",
  localePrefix: "never",
  localeCookie: LANG_COOKIE,
});
