import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { COMING_SOON, INSTAGRAM_URL, STORE_URL, WHATSAPP_URL } from "@/lib/site";
import "./coming-soon.css";

// The Coming Soon screen from the Claude Design launch package (ComingSoon.dc.html, "site"
// mode): the neon mark, "Coming soon.", one line, and the ways to reach us meanwhile. The
// store button is ours: micromobility.sa used to open the Salla shop, and customers who type
// it still need a way there until our own store opens.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "comingSoon" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: COMING_SOON ? { index: false, follow: false } : undefined,
  };
}

export default async function ComingSoon({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "comingSoon" });
  const other = locale === "ar" ? "en" : "ar";
  return (
    <main className="cs">
      <span className="cs-mark" role="img" aria-label="Micromobility" />
      <Link href="/" locale={other} className="cs-lang" hrefLang={other} lang={other}>
        {t("switchLang")}
      </Link>
      <div className="cs-shade" aria-hidden="true" />
      <div className="cs-body">
        <span className="cs-eyebrow">
          <span className="cs-dot" aria-hidden="true" />
          {t("eyebrow")}
        </span>
        <h1 className="cs-title">{t("title")}</h1>
        <p className="cs-sub">{t("sub")}</p>
        <div className="cs-actions">
          <a className="cs-btn cs-btn-neon" href={STORE_URL}>{t("store")}</a>
          <a className="cs-btn cs-btn-line" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">{t("instagram")}</a>
          <a className="cs-btn cs-btn-line" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">{t("whatsapp")}</a>
        </div>
      </div>
    </main>
  );
}
