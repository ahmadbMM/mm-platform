/** A staff text with {name} placeholders filled in: "{discount}% off" -> "10% off". Unknown names stay as written. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{([a-zA-Z]+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

import { intlOf } from "../i18n/locales";

/** A number in the page's language: Latin digits in every language, each with its own grouping. */
export const fmtNum = (n: number, locale: string) => n.toLocaleString(locale === "en" ? "en-US" : intlOf(locale));

/** A price's own digits (the booking app's _sar): two decimals when it has a fraction (57.50), none when it is whole (75). */
export const priceFraction = (n: number) => (Number.isInteger(Math.round((Number(n) || 0) * 100) / 100) ? 0 : 2);

/** A price in riyals as the page's language writes one: "SAR 75" or "SAR 57.50" in English, "75 ر.س" in Arabic,
 *  and each other language its own way ("75 SAR", "SAR 75"). */
export function fmtSar(n: number, locale: string): string {
  const f = priceFraction(n);
  if (locale === "en" || locale === "ar") {
    const num = n.toLocaleString(locale === "en" ? "en-US" : intlOf(locale), { minimumFractionDigits: f, maximumFractionDigits: f });
    return locale === "en" ? `SAR ${num}` : `${num} ر.س`;
  }
  return new Intl.NumberFormat(intlOf(locale), { style: "currency", currency: "SAR", currencyDisplay: "code", minimumFractionDigits: f, maximumFractionDigits: f }).format(n);
}
