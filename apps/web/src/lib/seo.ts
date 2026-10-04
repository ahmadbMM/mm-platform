import type { Metadata } from "next";
import { LOCALES, localeInfo } from "@/i18n/locales";

// What search engines and link previews read about a page. Addresses carry no language
// (i18n/routing.ts), so each language of a page is named by ?lang=<code>: the page tells search
// engines about all sixteen and says which one it is (canonical), and the plain address is the
// "whichever language the visitor reads" default. Without this in the page itself a crawler, which
// keeps no cookie, followed the site's links in English only and never found the other languages.

export const SITE_URL = "https://micromobility.sa";
export const SITE_NAME = "Micromobility";
/** The picture a shared link shows when the page has none of its own (1200 x 630). */
export const DEFAULT_SHARE_IMAGE = "/site/og.jpg";

/** A page's address in one language (?lang=), or the plain one. */
export function langPath(path: string, lang?: string | null): string {
  if (!lang) return path;
  return `${path}${path.includes("?") ? "&" : "?"}lang=${lang}`;
}

/** Every language of a page, as hreflang -> address, plus x-default; `missing` names the languages
 *  the page does not exist in (a Journal article staff have not written in Arabic). */
export function languageAlternates(path: string, missing: readonly string[] = []): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.filter((l) => !missing.includes(l.code)).map((l) => [l.html, langPath(path, l.code)])),
    "x-default": path,
  };
}

// Open Graph writes a locale as language_TERRITORY.
const OG_LOCALE: Record<string, string> = {
  en: "en_GB", ar: "ar_SA", id: "id_ID", ms: "ms_MY", de: "de_DE", es: "es_ES", fr: "fr_FR", pt: "pt_BR",
  tl: "tl_PH", ru: "ru_RU", ur: "ur_PK", hi: "hi_IN", ne: "ne_NP", bn: "bn_BD", zh: "zh_CN", ja: "ja_JP",
};

export type PageMetaInput = {
  /** The page's address without a language: "/", "/club", "/journal/first-ride". */
  path: string;
  locale: string;
  title: string;
  description?: string;
  /** Closed to visitors (Coming Soon, or a page staff have not switched on): kept out of search. */
  closed?: boolean;
  /** A picture of the page's own; else the site's. */
  image?: string;
  type?: "website" | "article";
  /** Never indexed, whatever the site's state (the account page). */
  noindex?: boolean;
  /** Languages the page does not exist in, left out of its alternates. */
  missing?: readonly string[];
};

/** The metadata every page returns: title, description, the page in every language, and how a
 *  shared link looks. */
export function pageMeta({ path, locale, title, description, closed, image, type = "website", noindex, missing }: PageMetaInput): Metadata {
  const url = langPath(path, localeInfo(locale).code);
  const images = [image || DEFAULT_SHARE_IMAGE];
  return {
    title,
    description: description || undefined,
    robots: closed || noindex ? { index: false, follow: false } : undefined,
    alternates: { canonical: url, languages: languageAlternates(path, missing) },
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      title,
      description: description || undefined,
      locale: OG_LOCALE[locale] ?? "en_GB",
      images,
    },
    twitter: { card: "summary_large_image", title, description: description || undefined, images },
  };
}
