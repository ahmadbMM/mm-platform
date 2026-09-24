import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import ComingSoon from "@/components/ComingSoon";
import HomePage from "@/components/home/HomePage";
import { homeSchema } from "@/content/pages/home";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { PREVIEW_COOKIE, isStaffToken } from "@/lib/preview";
import { HOME_BUILT, isComingSoon, loadSiteContent, siteText } from "@/lib/site";

// micromobility.sa. While the site is closed (Coming Soon on in the staff page, or Home not
// released yet) visitors get the Coming Soon screen and staff previewing get the real Home.
// Once staff open the site, everyone gets Home.
async function state(locale: string) {
  const [t, content] = await Promise.all([getTranslations({ locale, namespace: "comingSoon" }), loadSiteContent()]);
  const closed = HOME_BUILT ? isComingSoon(content) : true;
  const previewing = closed ? await isStaffToken((await cookies()).get(PREVIEW_COOKIE)?.value) : false;
  return { t, content, closed, previewing, showHome: !closed || previewing };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const s = await state(locale);
  const ar = locale === "ar";
  return s.showHome
    ? {
        title: ar ? "مايكروموبيليتي - دراجات فاخرة وتجارب ومجتمع دراجات في جدة" : "Micromobility - Premium Bikes, Experiences & Cycling Community in Jeddah",
        description: ar ? "الموزع الحصري في السعودية لـ Battle وAlvas وCamp وStrauss. متجر دراجات وتجارب وورشة ومجتمع دراجات في جدة."
          : "Exclusive KSA distributor of Battle, Alvas, Camp & Strauss. Bike store, experiences, workshop and cycling community in Jeddah.",
        robots: s.closed ? { index: false, follow: false } : undefined,
      }
    : {
        title: s.t("metaTitle"),
        description: siteText(s.content, "coming_soon.sub", locale, s.t("sub")),
        robots: { index: false, follow: false },
      };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const s = await state(locale);
  if (!s.showHome) {
    return (
      <ComingSoon
        eyebrow={siteText(s.content, "coming_soon.eyebrow", locale, s.t("eyebrow"))}
        title={siteText(s.content, "coming_soon.title", locale, s.t("title"))}
        sub={siteText(s.content, "coming_soon.sub", locale, s.t("sub"))}
      />
    );
  }
  const L = asLocale(locale);
  return <HomePage locale={locale} home={resolvePage(homeSchema, s.content, L)} site={resolvePage(siteSchema, s.content, L)} preview={s.previewing} />;
}
