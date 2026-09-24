import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Space_Grotesk, IBM_Plex_Sans_Arabic } from "next/font/google";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Self-hosted at build time, like the bike pages: no third-party font request.
const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--cs-font-en" });
const plexAr = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--cs-font-ar",
});

export default async function LocaleLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${grotesk.variable} ${plexAr.variable}`}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
