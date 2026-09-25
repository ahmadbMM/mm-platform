// The site's languages (owner, 2026-09-25): the ten the booking app speaks, and Chinese,
// Indonesian, Malay, Japanese, Russian and German. English and Arabic are written by staff
// (the content store holds both); every other language is translated from the English
// (src/i18n/tx/<code>.json) and falls back to the English for a text that has no translation yet.
//
// `intl` is what dates and numbers are formatted with: Latin digits in every language, as the
// booking app does, and the Gregorian calendar.

export type LocaleInfo = {
  code: string;
  /** The language's own name, as the language menu shows it. */
  name: string;
  /** Its English name, for staff and for search engines. */
  english: string;
  dir: "ltr" | "rtl";
  intl: string;
  /** The <html lang> and hreflang value. */
  html: string;
};

export const LOCALES = [
  { code: "en", name: "English", english: "English", dir: "ltr", intl: "en-GB", html: "en" },
  { code: "ar", name: "العربية", english: "Arabic", dir: "rtl", intl: "ar-SA-u-nu-latn-ca-gregory", html: "ar" },
  { code: "id", name: "Bahasa Indonesia", english: "Indonesian", dir: "ltr", intl: "id-ID", html: "id" },
  { code: "ms", name: "Bahasa Melayu", english: "Malay", dir: "ltr", intl: "ms-MY", html: "ms" },
  { code: "de", name: "Deutsch", english: "German", dir: "ltr", intl: "de-DE", html: "de" },
  { code: "es", name: "Español", english: "Spanish", dir: "ltr", intl: "es-ES", html: "es" },
  { code: "fr", name: "Français", english: "French", dir: "ltr", intl: "fr-FR", html: "fr" },
  { code: "pt", name: "Português", english: "Portuguese", dir: "ltr", intl: "pt-BR", html: "pt" },
  { code: "tl", name: "Tagalog", english: "Tagalog", dir: "ltr", intl: "fil-PH", html: "tl" },
  { code: "ru", name: "Русский", english: "Russian", dir: "ltr", intl: "ru-RU", html: "ru" },
  { code: "ur", name: "اردو", english: "Urdu", dir: "rtl", intl: "ur-PK-u-nu-latn", html: "ur" },
  { code: "hi", name: "हिन्दी", english: "Hindi", dir: "ltr", intl: "hi-IN-u-nu-latn", html: "hi" },
  { code: "ne", name: "नेपाली", english: "Nepali", dir: "ltr", intl: "ne-NP-u-nu-latn", html: "ne" },
  { code: "bn", name: "বাংলা", english: "Bengali", dir: "ltr", intl: "bn-BD-u-nu-latn", html: "bn" },
  { code: "zh", name: "简体中文", english: "Chinese (Simplified)", dir: "ltr", intl: "zh-CN", html: "zh-Hans" },
  { code: "ja", name: "日本語", english: "Japanese", dir: "ltr", intl: "ja-JP", html: "ja" },
] as const satisfies readonly LocaleInfo[];

export type Locale = (typeof LOCALES)[number]["code"];
export const LOCALE_CODES = LOCALES.map((l) => l.code) as unknown as readonly [Locale, ...Locale[]];
/** The languages translated from the English: all but the two staff write. */
export const TRANSLATED = LOCALE_CODES.filter((c) => c !== "en" && c !== "ar");

export const localeInfo = (code: string): LocaleInfo => LOCALES.find((l) => l.code === code) ?? LOCALES[0];
export const isRtl = (code: string) => localeInfo(code).dir === "rtl";
export const intlOf = (code: string) => localeInfo(code).intl;
