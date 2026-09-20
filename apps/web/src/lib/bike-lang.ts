import { cookies, headers } from "next/headers";
import { BIKE_LANGS, isBikeLang, type BikeLang } from "./bike-i18n";

/**
 * Language for the bike pages: the mm_lang cookie the globe writes, else the phone's own
 * Accept-Language, else English. Resolved on the server so the first paint is already in
 * the right language and direction — a rider tapping a tag never sees English flash to Arabic.
 */
export async function readBikeLang(): Promise<BikeLang> {
  const fromCookie = (await cookies()).get("mm_lang")?.value;
  if (isBikeLang(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language")?.toLowerCase() ?? "";
  return BIKE_LANGS.find((l) => accept.startsWith(l)) ?? "en";
}
