import type { Metadata } from "next";
import MkFrame, { marketSite } from "@/components/market/MkFrame";
import { T as M } from "@/components/market/Market.text";
import RulesBody, { RulesContents } from "@/components/market/w4/RulesBody";
import { T } from "@/components/market/w4.text";
import "@/components/market/w4.css";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { intlOf } from "@/i18n/locales";
import { fill } from "@/lib/fill";
import { MK_RULES, mkSettings } from "@/lib/market/core";
import { w4Rules, w4RulesDay, w4RulesLang, w4RulesOwn } from "@/lib/market/w4-rules";
import { pageMeta } from "@/lib/seo";
import { isComingSoon, siteCanOpen } from "@/lib/site";

// micromobility.sa/marketplace/rules: the Marketplace's rules, for everyone, signed in or not. How the Marketplace
// works (the site shows the listings; the sale, the payment and the handover are between the buyer and the seller),
// who may sell, what a seller promises, what may not be sold, what is sold new only or with a declaration, staying
// safe, the honour commission, reports and what staff do, complaints and disputes, how data is used, the shop
// agreement, and how the rules change. Each section is an address on the page (#safety, #not-allowed ...), so a form
// or a listing can link to the one it means (components/market/w4/RulesLink.tsx).
//
// The text is lib/market/w4-rules.ts: written in English and Arabic only, like the site's Terms and Privacy Notice.
// Every other language reads the English, marked as English so it is read and laid out as such, and is told so in its
// own words. The numbers in it are the settings staff keep (site_content marketplace.*), and its date is the rules'
// version, the one a seller's acceptance and a shop's agreement record.
// It is one page for everyone and is kept at the edge like any page (lib/page-cache.ts): nothing about the reader is
// read here. While the launch switch is off it opens by its address and is kept out of search engines.
const S = (v: unknown) => (typeof v === "string" ? v : "");

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const at = await marketSite(locale);
  const t = serverLocalize(M, locale), w = serverLocalize(T, locale);
  const closed = siteCanOpen() ? isComingSoon(at.content) : true;
  return pageMeta({ path: MK_RULES, locale, title: `${t.rules} · MicroMobility`, description: w.rulesMeta, closed, noindex: !at.on });
}

export default async function RulesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const at = await marketSite(locale);
  const t = serverLocalize(M, locale), w = serverLocalize(T, locale);
  const tx = serverL(locale);
  const settings = mkSettings(at.content);
  const own = w4RulesOwn(locale);
  const rules = w4Rules(w4RulesLang(locale), { settings, email: S(at.site.contact.email), whatsapp: S(at.site.social.whatsapp) || null });
  const day = w4RulesDay(settings.termsVersion);
  const updated = day
    ? fill(tx("Last updated: {date}", "آخر تحديث: {date}"), { date: new Intl.DateTimeFormat(intlOf(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`)) })
    : w.version(settings.termsVersion);
  // the English text on a page in another language: read and laid out as English
  const en = own ? {} : { lang: "en", dir: "ltr" as const };
  return (
    <MkFrame locale={locale} at={at}>
      <article className="mk-w4-rules">
        <header className="mk-w4-rules-head">
          <h1>{t.rules}</h1>
          <p className="mk-w4-rules-date">{updated}</p>
        </header>
        <div className="mk-w4-rules-cols">
          <nav className="mk-w4-toc" aria-labelledby="mk-w4-toc-h">
            <h2 id="mk-w4-toc-h">{w.onThisPage}</h2>
            <div {...en}><RulesContents rules={rules} /></div>
          </nav>
          <div className="mk-w4-rules-body" {...en}>
            <RulesBody rules={rules} />
          </div>
        </div>
      </article>
    </MkFrame>
  );
}
