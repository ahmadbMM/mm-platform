/** A staff text with {name} placeholders filled in: "{discount}% off" -> "10% off". Unknown names stay as written. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{([a-zA-Z]+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

import { intlOf } from "../i18n/locales";

/** A number in the page's language: Latin digits in every language, each with its own grouping. */
export const fmtNum = (n: number, locale: string) => n.toLocaleString(locale === "en" ? "en-US" : intlOf(locale));

/** A price in riyals as the page's language writes one: "SAR 75" in English, "75 ر.س" in Arabic,
 *  and each other language its own way ("75 SAR", "SAR 75"). */
export function fmtSar(n: number, locale: string): string {
  if (locale === "en") return `SAR ${fmtNum(n, locale)}`;
  if (locale === "ar") return `${fmtNum(n, locale)} ر.س`;
  return new Intl.NumberFormat(intlOf(locale), { style: "currency", currency: "SAR", currencyDisplay: "code", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}
