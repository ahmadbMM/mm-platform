import type { AccountText } from "./Account.text";
import type { Purchase } from "@/lib/account-profile";
import { intlOf } from "@/i18n/locales";

// The rider's own desk purchases (customer_purchases, the owner, 2026-10-03), newest first, with
// their total: what, how many, the day and the ride it was at, and the amount with the riyal sign
// as the booking app writes it (U+20C1, the .tk-amt font of booking.css). A voided or refunded sale
// stays on the list struck through, with why, and is not counted in the total.
const sar = (n: number) => `⁦⃁ ${Math.round((Number(n) || 0) * 100) / 100}⁩`;

export default function Purchases({ locale, t, rows, total }: { locale: string; t: AccountText; rows: Purchase[]; total: number }) {
  const day = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "";
    try { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(d); } catch { return ""; }
  };
  return (
    <section className="ac-panel" aria-labelledby="ac-purch-h">
      <div className="ac-panel-top">
        <h2 id="ac-purch-h" className="ac-panel-h">{t.purchTitle}</h2>
        <p className="ac-purch-total">{t.total} <bdi className="tk-amt">{sar(total)}</bdi></p>
      </div>
      <ul className="ac-list ac-purch">
        {rows.map((r) => {
          const off = r.voided || r.refunded;
          return (
            <li key={r.id} className={off ? "void" : undefined}>
              <span>
                <b>{r.name}{r.qty > 1 && <em dir="ltr"> ×{r.qty}</em>}</b>
                <small>{[day(r.at), r.session_title].filter(Boolean).join(" · ")}{off && <> · <i className="ac-pill warn">{r.voided ? t.voided : t.refunded}</i></>}</small>
              </span>
              <bdi className="tk-amt">{off ? <s>{sar(r.qty * r.price)}</s> : sar(r.qty * r.price)}</bdi>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
