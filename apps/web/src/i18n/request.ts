import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { dictOf } from "./dicts";
import { tr } from "./tx";

// English and Arabic have their messages files; a translated language reads the English ones
// through its dictionary (src/i18n/tx), like every other text on the site.
const through = (v: unknown, locale: string): unknown =>
  typeof v === "string" ? tr(locale, dictOf(locale), v)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, through(x, locale)]))
      : v;

// The time zone next-intl hands its formatters and the browser. Named, so it is not worked out again
// on every request (a throwaway Intl.DateTimeFormat each time); UTC is what the Worker always worked
// it out to. The site formats its own dates and times, each with the zone it means.
const timeZone = "UTC";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  if (locale === "en" || locale === "ar") return { locale, timeZone, messages: (await import(`../../messages/${locale}.json`)).default };
  const en = (await import("../../messages/en.json")).default;
  return { locale, timeZone, messages: through(en, locale) as typeof en };
});
