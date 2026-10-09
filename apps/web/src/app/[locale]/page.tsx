import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import ComingSoon from "@/components/ComingSoon";
import HomePage from "@/components/home/HomePage";
import JsonLd from "@/components/site/JsonLd";
import { companyData } from "@/lib/structured-data";
import { experiencesSchema } from "@/content/pages/experiences";
import { homeSchema } from "@/content/pages/home";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { PREVIEW_COOKIE, isStaffToken } from "@/lib/preview";
import { hiddenPages, isComingSoon, loadSiteContent, siteCanOpen, siteText } from "@/lib/site";
import { serverL } from "@/i18n/dicts";
import { routing } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { learnTeaser } from "@/components/learn/LearnTeaser";
import ClaimPage from "@/components/claim/ClaimPage";
import { claimToken } from "@/lib/claim";

// micromobility.sa. While the site is closed (Coming Soon on in the staff page, or Home not
// released yet) visitors get the Coming Soon screen and staff previewing get the real Home.
// Once staff open the site, everyone gets Home.
async function state(locale: string) {
  const [t, content] = await Promise.all([getTranslations({ locale, namespace: "comingSoon" }), loadSiteContent()]);
  const closed = siteCanOpen() ? isComingSoon(content) : true;
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

type Search = Promise<Record<string, string | string[] | undefined>>;
const claimOf = async (searchParams: Search | undefined) => {
  const v = (await searchParams)?.claim;
  return claimToken(Array.isArray(v) ? v[0] : v);
};

export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams?: Search }): Promise<Metadata> {
  const { locale } = await params;
  // /privacy.html, /x.png...: a single segment the proxy never sees is read as a language, which the
  // language layout refuses (app/not-found.tsx answers, with its own title): no Home title beside it.
  if (!hasLocale(routing.locales, locale)) return {};
  const tx = serverL(locale);
  // a waitlist claim link (/?claim=<token>): its own page, never in a search engine
  if (await claimOf(searchParams)) return pageMeta({ path: "/", locale, noindex: true, title: `${tx("Waitlist", "قائمة الانتظار")} · Micromobility` });
  const s = await state(locale);
  return s.showHome
    ? pageMeta({
        path: "/", locale, closed: s.closed,
        title: tx("Micromobility - Premium Bikes, Experiences & Cycling Community in Jeddah", "مايكروموبيليتي - دراجات فاخرة وتجارب ومجتمع دراجات في جدة"),
        description: tx("Exclusive KSA distributor of Battle, Alvas, Camp & Strauss. Bike store, experiences, workshop and cycling community in Jeddah.",
          "الموزع الحصري في السعودية لـ Battle وAlvas وCamp وStrauss. متجر دراجات وتجارب وورشة ومجتمع دراجات في جدة."),
      })
    : pageMeta({ path: "/", locale, noindex: true, title: s.t("metaTitle"), description: s.soon("coming_soon.sub", s.t("sub")) });
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams?: Search }) {
  const { locale } = await params;
  // A freed waitlist place to claim (the booking app's /?claim=, components/claim): the card, whatever
  // the site's state - the link reaches riders on WhatsApp while the site is still Coming Soon.
  const claim = await claimOf(searchParams);
  if (claim) return <ClaimPage locale={locale} token={claim} />;
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
  const site = resolvePage(siteSchema, s.content, L);
  const hidden = s.previewing ? [] : hiddenPages(s.content);
  // The Learn to ride question, from the Experiences page's content: only while staff offer
  // lessons and Experiences is open - the sign-up it leads to lives under /experiences.
  const learn = hidden.includes("experiences") ? null : learnTeaser(resolvePage(experiencesSchema, s.content, L).learn);
  return (
    <>
      <JsonLd data={companyData(site as Record<string, Record<string, unknown>>, locale)} />
      <HomePage locale={locale} home={resolvePage(homeSchema, s.content, L)} site={site} preview={s.previewing} hidden={hidden} learn={learn} />
    </>
  );
}
