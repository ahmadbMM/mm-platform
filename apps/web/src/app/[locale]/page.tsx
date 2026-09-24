import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { COMING_SOON } from "@/lib/site";
import "./coming-soon.css";

// The Coming Soon screen from the Claude Design launch package (ComingSoon.dc.html, "site"
// mode), and nothing else, as the owner asked (2026-09-24): the neon mark, "Coming soon."
// and one line. No menu, no footer, no buttons, no language switch - the language follows
// the device (next-intl picks /ar or /en from the browser).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "comingSoon" });
  return {
    title: t("metaTitle"),
    description: t("sub"),
    robots: COMING_SOON ? { index: false, follow: false } : undefined,
  };
}

export default async function ComingSoon({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "comingSoon" });
  return (
    <main className="cs">
      <span className="cs-mark" role="img" aria-label="Micromobility" />
      <div className="cs-shade" aria-hidden="true" />
      <div className="cs-body">
        <span className="cs-eyebrow">
          <span className="cs-dot" aria-hidden="true" />
          {t("eyebrow")}
        </span>
        <h1 className="cs-title">{t("title")}</h1>
        <p className="cs-sub">{t("sub")}</p>
      </div>
    </main>
  );
}
