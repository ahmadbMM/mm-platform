import type { ReactNode } from "react";
import LangToggle from "@/components/bikes/LangToggle";
import NoticeLink from "@/components/privacy/NoticeLink";
import { serverL } from "@/i18n/dicts";
import { localeInfo } from "@/i18n/locales";
import { riyadhClock } from "@/lib/workshop-days";
import "@/components/site/site.css";

// The Learn to ride sign-up's own frame while the site is Coming Soon (lib/learn-page.ts): the
// page opens then like the registration forms do, so nothing on it may lead into the closed site -
// no header, no footer, no links but the Privacy Notice, which opens on the page itself. A slim
// bar with the brand and the language (the fleet tag pages' globe, which keeps the visitor here),
// the page, and one line with the company and the notice.
export default function LearnAlone({ locale, company, notice, children }: { locale: string; company: string; notice: string; children: ReactNode }) {
  const tx = serverL(locale);
  const year = riyadhClock(new Date()).slice(0, 4);
  return (
    <div className="mm-site ln-alone" dir={localeInfo(locale).dir}>
      <header className="ln-top">
        <span className="ln-top-mark" role="img" aria-label="Micromobility" />
        <LangToggle lang={locale} label={tx("Language", "اللغة")} />
      </header>
      <main id="mm-main">{children}</main>
      <footer className="ln-foot">
        <span>© <span className="mm-lat">{year}</span> {company}. {tx("All Rights Reserved", "جميع الحقوق محفوظة.")}</span>
        <NoticeLink dialog={notice} className="ln-foot-link">{tx("Privacy Notice", "إشعار الخصوصية")}</NoticeLink>
      </footer>
    </div>
  );
}
