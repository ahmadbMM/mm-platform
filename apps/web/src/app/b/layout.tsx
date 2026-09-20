import { Space_Grotesk, IBM_Plex_Sans_Arabic } from "next/font/google";
import { dirOf } from "@/lib/bike-i18n";
import { readBikeLang } from "@/lib/bike-lang";
import "../globals.css";
import "./bike.css";

// Self-hosted at build time, so the page carries no third-party font request.
const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--bk-font-en" });
const plexAr = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--bk-font-ar",
});

/**
 * The bike pages are their own root layout, outside the [locale] tree on purpose: the NFC
 * chips hold /b/42 with no locale segment, and that URL has to keep working forever.
 */
export default async function BikeLayout({ children }: { children: React.ReactNode }) {
  const lang = await readBikeLang();
  return (
    <html lang={lang} dir={dirOf(lang)} className={`${grotesk.variable} ${plexAr.variable}`}>
      <body>{children}</body>
    </html>
  );
}
