/** A staff text with {name} placeholders filled in: "{discount}% off" -> "10% off". Unknown names stay as written. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{([a-zA-Z]+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** A number in the page's language: Latin digits in both, Arabic grouping in Arabic. */
export const fmtNum = (n: number, locale: string) => n.toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US");
