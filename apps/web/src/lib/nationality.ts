import { COUNTRY_AR, NATIONALITIES } from "@/content/nationalities";
import { localeInfo } from "@/i18n/locales";

// The nationality list as a picker shows it (the booking app's own, content/nationalities.ts):
// each one stored as its English name, as the app stores it, and labelled with the browser's own
// name for the region in the page's language - for Arabic the app's own where it has one - Saudi
// Arabia first, then the rest in the language's alphabetical order. Built in the browser only
// (Intl's names differ between the server and a phone), once the page has drawn.
export type NatOption = { value: string; label: string };

export function natOptions(locale: string): NatOption[] {
  const intl = localeInfo(locale).intl;
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames([intl], { type: "region" }); } catch { /* the English names stand */ }
  const label = (code: string, name: string) => (locale === "ar" && COUNTRY_AR[name]) || names?.of(code) || name;
  const all = NATIONALITIES.map(([code, name]) => ({ value: name, label: label(code, name) }));
  const saudi = all.filter((o) => o.value === "Saudi Arabia");
  const rest = all.filter((o) => o.value !== "Saudi Arabia").sort((a, b) => a.label.localeCompare(b.label, intl));
  return [...saudi, ...rest];
}

/** The twelve months' names in the page's language, January first. */
export function monthNames(locale: string): string[] {
  const f = new Intl.DateTimeFormat(localeInfo(locale).intl, { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(Date.UTC(2000, i, 1))));
}
