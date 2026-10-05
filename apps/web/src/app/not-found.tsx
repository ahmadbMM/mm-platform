import { cookies, headers } from "next/headers";
import { Space_Grotesk, IBM_Plex_Sans_Arabic } from "next/font/google";
import { serverL } from "@/i18n/dicts";
import { localeInfo } from "@/i18n/locales";
import { LANG_COOKIE } from "@/i18n/routing";
import { visitorLang } from "@/lib/lang-url";
import { stagingTitle } from "@/lib/staging";
import "./globals.css";
import "@/components/pages/pages.css";
import "./not-found.css";

// The site's 404 for an address that never reaches a language (app/[locale]/layout.tsx refuses it):
// one the proxy never sees, as a single segment with a dot - /privacy.html, /x.png, /wp-login.php -
// is read as a language, which the language layout answers with notFound(), and only a not-found page
// above that layout can catch it. It replaced Next's bare English page, which had no <html lang>, two
// titles and two robots tags. It is a whole document (the root layout beside it passes its children
// straight through): in the visitor's language (their pick, else their browser's, else English), the
// site's look and fonts, and the way back. Next adds the noindex itself, as for every 404. The 404
// inside the site, with its header and footer, is app/[locale]/not-found.tsx.
const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--cs-font-en" });
const plexAr = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "700"], display: "swap", variable: "--cs-font-ar", preload: false });

async function lang() {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return visitorLang(c.get(LANG_COOKIE.name)?.value, h.get("accept-language"));
}

export default async function RootNotFound() {
  const locale = await lang();
  const tx = serverL(locale);
  const info = localeInfo(locale);
  return (
    <html lang={info.html} dir={info.dir} className={`${grotesk.variable} ${plexAr.variable}`}>
      <body className="mm-404">
        <title>{stagingTitle(`${tx("Page not found", "الصفحة غير موجودة")} · Micromobility`)}</title>
        <main className="pg pg-missing">
          <img src="/site/logo-dark.png" alt="Micromobility" width={241} height={256} className="mm-404-logo" />
          <p className="pg-eyebrow">404</p>
          <h1>{tx("Page not found", "الصفحة غير موجودة")}</h1>
          <p className="pg-lead">{tx("The page you're looking for doesn't exist or has moved.", "الصفحة التي تبحث عنها غير موجودة أو نُقلت.")}</p>
          {/* a whole page load: nothing of the site is loaded here to navigate with */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <p><a className="pg-btn" href="/">{tx("Back to home", "العودة إلى الرئيسية")}</a></p>
        </main>
      </body>
    </html>
  );
}
