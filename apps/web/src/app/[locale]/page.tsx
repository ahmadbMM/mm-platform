import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HOME_BUILT, isComingSoon, loadSiteContent, siteText } from "@/lib/site";
import "./coming-soon.css";

// The Coming Soon screen from the Claude Design launch package (ComingSoon.dc.html, "site"
// mode), and nothing else, as the owner asked (2026-09-24): the neon mark, "Coming soon."
// and one line. No menu, no footer, no buttons, no language switch - the language follows
// the device (next-intl picks /ar or /en from the browser).
//
// Its three lines are edited in the staff page (Website > Coming Soon screen, keys
// coming_soon.eyebrow / .title / .sub). What is not set there reads as the design wrote it
// (messages/*.json), and so does everything when the database cannot be reached.
async function lines(locale: string) {
  const [t, content] = await Promise.all([getTranslations({ locale, namespace: "comingSoon" }), loadSiteContent()]);
  return {
    eyebrow: siteText(content, "coming_soon.eyebrow", locale, t("eyebrow")),
    title: siteText(content, "coming_soon.title", locale, t("title")),
    sub: siteText(content, "coming_soon.sub", locale, t("sub")),
    metaTitle: t("metaTitle"),
    closed: HOME_BUILT ? isComingSoon(content) : true,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l = await lines(locale);
  return {
    title: l.metaTitle,
    description: l.sub,
    robots: l.closed ? { index: false, follow: false } : undefined,
  };
}

export default async function ComingSoon({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = await lines(locale);
  return (
    <main className="cs">
      <span className="cs-mark" role="img" aria-label="Micromobility" />
      <div className="cs-shade" aria-hidden="true" />
      <div className="cs-body">
        <span className="cs-eyebrow">
          <span className="cs-dot" aria-hidden="true" />
          {l.eyebrow}
        </span>
        <h1 className="cs-title">{l.title}</h1>
        <p className="cs-sub">{l.sub}</p>
      </div>
    </main>
  );
}
