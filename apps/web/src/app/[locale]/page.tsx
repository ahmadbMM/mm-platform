import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import ComingSoon from "@/components/ComingSoon";
import HomePage from "@/components/home/HomePage";
import { homeSchema } from "@/content/pages/home";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { PREVIEW_COOKIE, isStaffToken } from "@/lib/preview";
import { HOME_BUILT, hiddenPages, isComingSoon, loadSiteContent, siteText } from "@/lib/site";
import { serverL } from "@/i18n/dicts";

// micromobility.sa. While the site is closed (Coming Soon on in the staff page, or Home not
// released yet) visitors get the Coming Soon screen and staff previewing get the real Home.
// Once staff open the site, everyone gets Home.
async function state(locale: string) {
  const [t, content] = await Promise.all([getTranslations({ locale, namespace: "comingSoon" }), loadSiteContent()]);
  const closed = HOME_BUILT ? isComingSoon(content) : true;
  const previewing = closed ? await isStaffToken((await cookies()).get(PREVIEW_COOKIE)?.value) : false;
  // A Coming Soon text staff wrote: in this language, or - in a translated one - their English
  // translated (src/i18n/tx); else the default message.
  const tx = serverL(locale);
  const soon = (key: string, fallback: string) => {
    const own = siteText(content, key, locale, "");
    if (own || locale === "en" || locale === "ar") return own || fallback;
    const en = siteText(content, key, "en", "");
    return en ? tx(en) : fallback;
  };
  return { t, content, closed, previewing, showHome: !closed || previewing, soon };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const s = await state(locale);
  const tx = serverL(locale);
  return s.showHome
    ? {
        title: tx("Micromobility - Premium Bikes, Experiences & Cycling Community in Jeddah", "مايكروموبيليتي - دراجات فاخرة وتجارب ومجتمع دراجات في جدة"),
        description: tx("Exclusive KSA distributor of Battle, Alvas, Camp & Strauss. Bike store, experiences, workshop and cycling community in Jeddah.",
          "الموزع الحصري في السعودية لـ Battle وAlvas وCamp وStrauss. متجر دراجات وتجارب وورشة ومجتمع دراجات في جدة."),
        robots: s.closed ? { index: false, follow: false } : undefined,
      }
    : {
        title: s.t("metaTitle"),
        description: s.soon("coming_soon.sub", s.t("sub")),
        robots: { index: false, follow: false },
      };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const s = await state(locale);
  if (!s.showHome) {
    return (
      <ComingSoon
        eyebrow={s.soon("coming_soon.eyebrow", s.t("eyebrow"))}
        title={s.soon("coming_soon.title", s.t("title"))}
        sub={s.soon("coming_soon.sub", s.t("sub"))}
      />
    );
  }
  const L = asLocale(locale);
  return <HomePage locale={locale} home={resolvePage(homeSchema, s.content, L)} site={resolvePage(siteSchema, s.content, L)} preview={s.previewing} hidden={s.previewing ? [] : hiddenPages(s.content)} />;
}
