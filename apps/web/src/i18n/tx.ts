// Translation helpers, the same on the server and in the browser. English is the source and
// Arabic is written beside it (in the code, and by staff in the content store); every other
// language looks its English up in that language's dictionary (src/i18n/tx/<code>.json), and a
// text with no translation yet reads in English rather than not at all.

export type Dict = Readonly<Record<string, string>>;
/** A text in the page's language: L("English", "العربية"). */
export type L = (en: string, ar?: string) => string;

export function tr(locale: string, dict: Dict | null | undefined, en: string, ar?: string): string {
  if (locale === "ar") return ar ?? en;
  if (locale === "en" || !dict) return en;
  const v = dict[en];
  return typeof v === "string" && v ? v : en;
}

export const makeL = (locale: string, dict: Dict | null | undefined): L => (en, ar) => tr(locale, dict, en, ar);

/** A text staff do not edit that lives in data rather than in a component (a menu entry, a type
 *  name): phrase("English", "العربية"). It reads with tx(p.en, p.ar) like any other; being written
 *  this way is what puts it on the list the translations are checked against (src/i18n/extract.ts). */
export const phrase = (en: string, ar: string) => ({ en, ar });

/** A template with its values: fill("{0} of {1}", 2, 5) -> "2 of 5". */
export function fill(s: string, ...args: Array<string | number>): string {
  return s.replace(/\{(\d+)\}/g, (m, i) => (args[Number(i)] !== undefined ? String(args[Number(i)]) : m));
}

/** A component's { en, ar } strings in the page's language. A string translates through the
 *  dictionary; a function (a sentence with values in it, `(m) => \`~${m} min\``) is read once
 *  with {0}, {1}... in place of its values, translated as that template, and filled when called. */
export function localize<T>(T: { en: T; ar: T }, locale: string, dict: Dict | null | undefined): T {
  if (locale === "ar") return T.ar;
  if (locale === "en" || !dict) return T.en;
  return walk(T.en, (s) => tr(locale, dict, s)) as T;
}

/** The English texts a component's strings hold (the functions as their templates), for the
 *  source list the translations are checked against. */
export function englishOf(v: unknown): string[] {
  const out: string[] = [];
  walk(v, (s) => (out.push(s), s));
  return out;
}

const templateOf = (f: (...a: unknown[]) => unknown): string | null => {
  const out = f(...Array.from({ length: f.length }, (_, i) => `{${i}}`));
  return typeof out === "string" ? out : null;
};

function walk(v: unknown, t: (s: string) => string): unknown {
  if (typeof v === "string") return v ? t(v) : v;
  if (typeof v === "function") {
    const tpl = templateOf(v as (...a: unknown[]) => unknown);
    if (tpl === null) return v;
    const done = t(tpl);
    return (...args: Array<string | number>) => fill(done, ...args);
  }
  if (Array.isArray(v)) return v.map((x) => walk(x, t));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, t)]));
  return v;
}
