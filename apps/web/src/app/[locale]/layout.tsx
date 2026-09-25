import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Space_Grotesk, IBM_Plex_Sans_Arabic } from "next/font/google";
import { routing } from "@/i18n/routing";
import { localeInfo } from "@/i18n/locales";
import { clientDict } from "@/i18n/dicts";
import { TxProvider } from "@/i18n/TxProvider";
import "../globals.css";

// Self-hosted at build time, like the bike pages: no third-party font request.
const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--cs-font-en" });
// Not preloaded: its four weights were fetched up front on every page, English included. Arabic
// and Urdu pages still get it as soon as their stylesheet asks (display: swap).
const plexAr = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--cs-font-ar", preload: false,
});

// Relative share images (/site/..., /media/...) resolve against the site's own address; without
// this Next falls back to http://localhost:3000 on Cloudflare and every WhatsApp preview breaks.
export const metadata: Metadata = { metadataBase: new URL("https://micromobility.sa") };

export default async function LocaleLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const info = localeInfo(locale);
  return (
    <html lang={info.html} dir={info.dir} className={`${grotesk.variable} ${plexAr.variable}`}>
      <body>
        <NextIntlClientProvider>
          <TxProvider locale={locale} dict={clientDict(locale)}>{children}</TxProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
