import { cookies, headers } from "next/headers";
import { LANG_COOKIE } from "@/i18n/routing";
import { fromAcceptLanguage, isBikeLang, type BikeLang } from "./bike-i18n";

/**
 * Language for the bike pages: the one the visitor picked - the site's language cookie, which
 * the globe here writes too, then mm_lang, the bike page's own cookie from before - else the
 * phone's own languages in order, else English. Resolved on the server so the first paint is
 * already in the right language and direction: a rider tapping a tag never sees English flash
 * to Arabic.
 */
export async function readBikeLang(): Promise<BikeLang> {
  const jar = await cookies();
  for (const name of [LANG_COOKIE.name, "mm_lang"]) {
    const v = jar.get(name)?.value;
    if (isBikeLang(v)) return v;
  }
  return fromAcceptLanguage((await headers()).get("accept-language")) ?? "en";
}
