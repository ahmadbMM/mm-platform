import { serverL } from "@/i18n/dicts";
import { fill } from "@/lib/fill";
import { NoticeBody, noticeDate, noticeOwn } from "./PrivacyNotice";
import "./notice-dialog.css";

// The Privacy Notice in a dialog on the page itself, for a form's "I have read the Privacy
// Notice" (NoticeLink.tsx opens it): reading it never leaves the page, so nothing the visitor
// typed is lost, and it opens whatever the site's state - /privacy is behind Coming Soon while the
// site is closed, and a form like Learn to ride is not. Drawn on the server into a native
// <dialog>, with the same words as /privacy (PrivacyNotice.tsx); Escape and the close button (a
// form of method "dialog") shut it without any script of ours.
export default function NoticeDialog({ id, locale }: { id: string; locale: string }) {
  const tx = serverL(locale);
  return (
    <dialog id={id} className="pv-dialog" aria-labelledby={`${id}-h`}>
      <div className="pv-dialog-box">
        <div className="pv-dialog-head">
          <h2 id={`${id}-h`}>{tx("Privacy Notice", "إشعار الخصوصية")}</h2>
          <form method="dialog">
            <button type="submit" className="pv-dialog-x" aria-label={tx("Close", "إغلاق")} title={tx("Close", "إغلاق")}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </form>
        </div>
        <div className="pv-dialog-body">
          <p className="pv-dialog-meta">{fill(tx("Last updated: {date}", "آخر تحديث: {date}"), { date: noticeDate(locale) })}</p>
          {!noticeOwn(locale) && <p className="pv-dialog-meta">{tx("This notice is available in English and Arabic.", "هذا الإشعار متاح بالإنجليزية والعربية.")}</p>}
          <NoticeBody locale={locale} h="h3" />
        </div>
      </div>
    </dialog>
  );
}
