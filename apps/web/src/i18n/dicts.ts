// The translated languages' dictionaries, for the server: pages resolve their text here and pass
// the browser only what its components need (layout.tsx, clientDict). English and Arabic have
// none - they are written, not translated.
import { makeL, localize, type Dict, type L } from "./tx";
import source from "./source.json";
import id from "./tx/id.json";
import ms from "./tx/ms.json";
import de from "./tx/de.json";
import es from "./tx/es.json";
import fr from "./tx/fr.json";
import pt from "./tx/pt.json";
import tl from "./tx/tl.json";
import ru from "./tx/ru.json";
import ur from "./tx/ur.json";
import hi from "./tx/hi.json";
import ne from "./tx/ne.json";
import bn from "./tx/bn.json";
import zh from "./tx/zh.json";
import ja from "./tx/ja.json";

const DICTS: Record<string, Dict> = { id, ms, de, es, fr, pt, tl, ru, ur, hi, ne, bn, zh, ja };

export const dictOf = (locale: string): Dict | null => DICTS[locale] ?? null;

/** The page's translator, on the server: L("English", "العربية"). */
export const serverL = (locale: string): L => makeL(locale, dictOf(locale));

/** A component's { en, ar } strings in the page's language, on the server. */
export const serverLocalize = <T,>(T: { en: T; ar: T }, locale: string): T => localize(T, locale, dictOf(locale));

/** The part of the dictionary the browser's components use (src/i18n/source.json lists it). */
export function clientDict(locale: string): Dict | null {
  const d = dictOf(locale);
  if (!d) return null;
  const out: Record<string, string> = {};
  for (const k of (source as { client: string[] }).client) if (d[k]) out[k] = d[k];
  return out;
}
