import { PRIVACY_NOTICE, PRIVACY_VERSION, type NoticeBlock } from "@/content/privacy-notice";
import { asLocale } from "@/lib/content";
import { intlOf } from "@/i18n/locales";
import "@/components/pages/pages.css";

// The Privacy Notice as the site shows it: on its own page (/privacy) and in the dialog a form
// opens it in (NoticeDialog.tsx), from the same blocks. It is the booking app's own notice, word
// for word (content/privacy-notice.ts, copied by scripts/sync-privacy-notice.mjs), and our own
// static text, so its markup (<strong>, the email link) is rendered as is. Like the booking app,
// it is published in English and Arabic only: every other language reads the English one, marked
// as English so it is read and laid out as such, and the page says so in its own language. Its
// look is .pg-notice in pages.css, which the Terms share.

/** Whether this language has the notice in its own words (English and Arabic). */
export const noticeOwn = (locale: string) => {
  const L = asLocale(locale);
  return L === "en" || L === "ar";
};

/** The notice's date, "25 September 2026", in the page's language. */
export const noticeDate = (locale: string) =>
  new Intl.DateTimeFormat(intlOf(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${PRIVACY_VERSION}T00:00:00Z`));

/** One block of the notice. `h`: the level its headings take under the page's own heading. */
export function Block({ b, h: H = "h2" }: { b: NoticeBlock; h?: "h2" | "h3" }) {
  if (b.h) return <H>{b.h}</H>;
  if (b.p) return <p dangerouslySetInnerHTML={{ __html: b.p }} />;
  if (b.ul) return <ul>{b.ul.map((x, i) => <li key={i} dangerouslySetInnerHTML={{ __html: x }} />)}</ul>;
  if (b.table) {
    const t = b.table;
    return (
      <div className="pv-tw">
        <table>
          <thead><tr>{t.head.map((h, i) => <th key={i} dangerouslySetInnerHTML={{ __html: h }} />)}</tr></thead>
          <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j} data-label={t.head[j].replace(/<[^>]+>/g, "")} dangerouslySetInnerHTML={{ __html: x }} />)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  return null;
}

/** The notice's text in the page's language, or the English one marked as English. */
export function NoticeBody({ locale, h }: { locale: string; h?: "h2" | "h3" }) {
  const own = noticeOwn(locale);
  return (
    <div className="pg-notice" {...(own ? {} : { lang: "en", dir: "ltr" })}>
      {PRIVACY_NOTICE[asLocale(locale) === "ar" ? "ar" : "en"].map((b, i) => <Block key={i} b={b} h={h} />)}
    </div>
  );
}
