import type { Purchase } from "@/lib/account-profile";
import { fmtClock, fmtDayDate } from "@/lib/tickets";
import type { WorkshopJob } from "@/lib/workshop-mine";
import { Sar } from "@/components/booking/Sar";
import type { AccWords } from "./AccountMenu.words";
import AccIcon, { type AccIconName } from "./AccIcon";

// My Account's two lists (the user, 2026-11-19: "make sure to have a page or dedicated space for purchases and workshop
// appointments"), and the line every booking that is not a ride ticket takes on /bookings.

/** A moment as the day the rider reads ("12 Nov 2026"), Riyadh time. */
function dayOf(iso: string | null, locale: string): string {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : new Date(Date.parse(iso) + 3 * 3600e3).toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? fmtDayDate(d, locale) : "";
}

// ── Purchases (the booking app's _purchHtml) ────────────────────────────────────────────────────────────────────────
/** What the rider bought at the desk, newest first, the total of what stands at the top; a voided or refunded sale struck
 *  through and not counted; one on the house says so and costs nothing. */
export function AccPurchases({ rows, total, w, locale, sarWord }: { rows: Purchase[]; total: number; w: AccWords; locale: string; sarWord: string }) {
  if (!rows.length) return <p className="acm-card acm-empty">{w.purchEmpty}</p>;
  const st = (r: Purchase) => (r.voided ? w.voided : r.refunded ? w.refunded : r.pay === "house" ? w.onHouse : r.pay === "paid" ? w.paid : r.pay === "pending" ? w.pending : "");
  return (
    <div className="acm-card acm-card-list">
      <p className="acm-total"><Sar n={total} word={sarWord} /></p>
      <ul className="acm-lines">
        {rows.map((r) => {
          const off = r.voided || r.refunded, s = st(r);
          return (
            <li key={r.id} className={off ? "is-off" : undefined}>
              <span className="acm-line-main">
                <b><bdi>{r.name}</bdi>{r.qty > 1 && <>{" "}<bdi className="acm-muted" dir="ltr">×{r.qty}</bdi></>}</b>
                <small>{[dayOf(r.at, locale), r.session_title].filter(Boolean).map((x, i) => <span key={i}>{i > 0 && " · "}<bdi>{x}</bdi></span>)}</small>
              </span>
              <span className="acm-line-end">
                {off ? <s><Sar n={r.amount} word={sarWord} /></s> : <Sar n={r.amount} word={sarWord} />}
                {s && <small className={off ? "acm-st-warn" : undefined}>{s}</small>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Workshop appointments ───────────────────────────────────────────────────────────────────────────────────────────
export type WsText = { stages: Record<string, string>; scheduled: string; price: string; cancelled: string; reference: string };
const wsWhen = (j: WorkshopJob, locale: string) => [j.date ? fmtDayDate(j.date, locale) : "", j.time ? fmtClock(j.time, locale) : ""].filter(Boolean).join(" · ");
export const wsStatus = (j: WorkshopJob, t: WsText) => (j.status === "cancelled" ? t.cancelled : t.stages[j.status] ?? j.status);

function WsItem({ j, t, locale, sarWord }: { j: WorkshopJob; t: WsText; locale: string; sarWord: string }) {
  const when = wsWhen(j, locale);
  return (
    <li className={j.status === "cancelled" ? "is-off" : undefined}>
      <span className="acm-line-main">
        <b><bdi>{j.service || t.reference}</bdi></b>
        <small>{when && <><bdi>{when}</bdi> · </>}{t.reference} <bdi dir="ltr">{j.ref}</bdi>{j.bike && <> · <bdi>{j.bike}</bdi></>}</small>
      </span>
      <span className="acm-line-end">
        {j.price != null && <Sar n={j.price} word={sarWord} />}
        <small className={`acm-chip${j.status === "ready" ? " acm-chip-go" : j.status === "cancelled" ? " acm-chip-warn" : ""}`}>{wsStatus(j, t)}</small>
      </span>
    </li>
  );
}

/** The rider's workshop appointments: those still ahead, then the earlier ones; the way to ask for another. */
export function AccWorkshop({ up, past, w, t, locale, sarWord, request, empty }: { up: WorkshopJob[]; past: WorkshopJob[]; w: AccWords; t: WsText; locale: string; sarWord: string;
  request: { href: string; label: string } | null; empty: string }) {
  return (
    <>
      {!up.length && !past.length && <p className="acm-card acm-empty">{empty}</p>}
      {up.length > 0 && (
        <section className="acm-sub" aria-labelledby="acm-ws-up">
          <h3 id="acm-ws-up" className="acm-sub-h">{w.upcoming}</h3>
          <ul className="acm-card acm-card-list acm-lines">{up.map((j) => <WsItem key={j.id} j={j} t={t} locale={locale} sarWord={sarWord} />)}</ul>
        </section>
      )}
      {past.length > 0 && (
        <section className="acm-sub" aria-labelledby="acm-ws-past">
          <h3 id="acm-ws-past" className="acm-sub-h">{w.pastWorkshop}</h3>
          <ul className="acm-card acm-card-list acm-lines">{past.map((j) => <WsItem key={j.id} j={j} t={t} locale={locale} sarWord={sarWord} />)}</ul>
        </section>
      )}
      {request && <a className="acm-btn acm-btn-line acm-go-link" href={request.href}>{request.label}</a>}
    </>
  );
}

// ── An appointment on /bookings that is not a ride ticket ───────────────────────────────────────────────────────────
/** One booking among the rider's upcoming ones: what it is (its kind's word and icon), its name, when, how it stands, and
 *  where to open it. */
export function Appointment({ kind, icon, title, when, status, href, hrefLabel, children }: {
  kind: string; icon: AccIconName; title: string; when: string; status?: string; href?: string | null; hrefLabel?: string; children?: React.ReactNode;
}) {
  return (
    <article className="bk-appt">
      <span className="bk-appt-ic"><AccIcon name={icon} size={22} /></span>
      <div className="bk-appt-main">
        <p className="bk-appt-k">{kind}</p>
        <h3 className="bk-appt-t"><bdi>{title}</bdi></h3>
        {when && <p className="bk-appt-w"><bdi>{when}</bdi></p>}
        {children}
      </div>
      <div className="bk-appt-end">
        {status && <span className="acm-chip">{status}</span>}
        {href && <a className="acm-btn acm-btn-line acm-btn-sm" href={href}>{hrefLabel}</a>}
      </div>
    </article>
  );
}
