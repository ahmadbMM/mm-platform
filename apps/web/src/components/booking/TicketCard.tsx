import Qr from "./Qr";
import type { T } from "./tickets.text";
import { fmtSar } from "@/lib/fill";
import { intlOf } from "@/i18n/locales";
import { bookingRef, codeReady, fmtClock, icsFor, queueNumbers, type Cue, type TicketRow, type TicketSession } from "@/lib/tickets";

// The booking app's ticket (renderBookingTicket), for My Account: the same card, the same rules.
// Its actions are the booking app's own - Edit, Reschedule and Cancel open it there - so the site
// never changes a booking behind its back.
export type TicketText = (typeof T)["en"];
type Props = {
  locale: string;
  rows: TicketRow[];
  session: TicketSession | undefined;
  /** The ride's name as the site says it: a ride that shows no number shows this instead. */
  name: string;
  cue: Cue;
  t: TicketText;
  /** The Experiences dates' own words for a ride that gathers: "Gathering", "Start". */
  gather: string;
  start: string;
  typeName: (type: string) => string;
  links: { edit: string | null; manage: string; place: string | null };
};

const Bike = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="5.5" cy="17" r="3.5" /><circle cx="18.5" cy="17" r="3.5" /><path d="M15 6h2l1.5 11M5.5 17 9 9h7M9 9l3 8h3" />
  </svg>
);
const Pin = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
const Again = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </svg>
);

export default function TicketCard({ locale, rows, session: s, name, cue, t, gather, start, typeName, links }: Props) {
  const primary = rows[0];
  const noNum = !s || s.approval; // a ride staff approve never shows its order
  const allWl = rows.every((r) => r.status === "waitlist");
  const num = noNum ? name : queueNumbers(rows);
  const big = num.length <= 4 ? "big" : num.length <= 9 ? "mid" : "small";
  const bikes = s ? s.bikes : true;
  const total = rows.reduce((sum, r) => sum + r.price, 0);
  const free = !!s?.free || (noNum && total === 0);
  const canEdit = rows.some((r) => r.status === "waiting" || r.status === "waitlist");
  const d = new Date(`${primary.date}T00:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { ...o, timeZone: "UTC" }).format(d);
  const clock = (x: string) => fmtClock(x, locale);
  const when = s?.times
    ? (s.gathers ? `${gather} ${clock(s.times[0])} · ${start} ${clock(s.times[1])}` : `${clock(s.times[0])} – ${clock(s.times[1])}`)
    : "";
  const green = s?.times && s.gathers ? t.gatherAt(clock(s.times[0])) : s?.collect && bikes ? t.collectFrom(clock(s.collect)) : "";
  const ics = s ? icsFor(s, `${name} - ${f({ weekday: "long" })}`, s.approval ? s.meetUrl ?? "" : "") : "";
  const wl = primary.waitlistNum;

  return (
    <article className={`tk-card ev-${s?.kind ?? "jcc"}`}>
      <div className="tk-head">
        <div className="tk-num-block">
          {!noNum && (allWl
            ? <p className="tk-label wl">{t.waitlist}{wl ? <> · <bdi dir="ltr">W{wl}</bdi></> : ""}</p>
            : <p className="tk-label">{t.queueNumber}</p>)}
          {/* a number reads left to right in every language: "#7 – #8" is never "#8 – #7" */}
          <p className={`tk-num ${big}`}>{noNum ? num : <bdi dir="ltr">{num}</bdi>}</p>
          {allWl && !noNum && <p className="tk-wl-note">{wl ? t.wlPos(String(wl)) : t.wlPosNoNum}</p>}
        </div>
        <div className="tk-right">
          {codeReady(rows, s)
            ? <Qr payload={bookingRef(primary, s)} label={`${t.queueNumber} ${num}`} />
            : <div className="tk-qr-hold"><span>{t.qrHold}</span></div>}
          <p className="tk-when">
            {f({ weekday: "long" })}<br />{f({ day: "numeric", month: "short", year: "numeric" })}
            {when && <><br /><bdi>{when}</bdi></>}
            {green && <><br /><span className="go">{green}</span></>}
          </p>
        </div>
      </div>

      <div className="tk-body">
        {cue === "confirmed" ? (
          <div className="tk-ok" role="status"><span className="tk-ok-tick" aria-hidden="true">✓</span><span><strong>{t.confirmed}</strong><small>{t.confirmedSub}</small></span></div>
        ) : cue ? (
          <div className={`tk-note ${cue === "next" || cue === "onBike" ? "go" : cue === "inQueue" ? "" : "warn"}`}>
            {cue !== "next" && cue !== "inQueue" && <span className="dot" aria-hidden="true" />}
            <span>{{ underReview: t.underReview, pending: t.pending, waitlist: t.waitlistCue, onBike: t.onBike, next: t.next, inQueue: t.inQueue }[cue]}</span>
          </div>
        ) : null}
        <p className="tk-riders-h">{bikes ? t.riders : t.participants} · {noNum ? num : <bdi dir="ltr">{num}</bdi>}</p>
        {rows.map((r) => (
          <div key={r.id} className="tk-rider">
            <div className="tk-rider-top">
              {!noNum && (r.status === "waitlist"
                ? <span className="tk-w"><span className="dot" aria-hidden="true" />W{r.waitlistNum ?? ""}</span>
                : r.queueNum != null && <span className="tk-q" dir="ltr">#{r.queueNum}</span>)}
              <span className="tk-name">{r.name}</span>
              {bikes && r.type && r.type !== "None" && <span className={`tk-type t-${r.type.toLowerCase().replace(/\s+/g, "")}`}><Bike /> {typeName(r.type)}</span>}
            </div>
            {!noNum && (
              <div className="tk-rider-pay">
                <span className={r.paid ? "paid" : ""}>{fmtSar(r.price, locale)}</span>
                <span className={`tk-pay ${r.paid ? "paid" : "due"}`}><span className="dot" aria-hidden="true" />{r.paid ? (r.price === 0 ? t.onTheHouse : t.paid) : t.pendingPay}</span>
              </div>
            )}
          </div>
        ))}
        <div className="tk-total"><span>{t.total}</span><strong>{free ? t.complimentary : fmtSar(total, locale)}</strong></div>
      </div>

      <div className="tk-actions">
        {ics && <a className="tk-btn" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download={`micromobility-${primary.date.replace(/-/g, "")}.ics`}>{t.calendar}</a>}
        {links.place && <a className="tk-btn" href={links.place} target="_blank" rel="noopener"><Pin />{s?.approval ? t.meetingPoint : t.directions}</a>}
      </div>
      {canEdit && (
        <div className="tk-manage">
          {!noNum && links.edit && <a className="tk-btn solid" href={links.edit}>{t.edit}</a>}
          {!noNum && s?.kind !== "snd96" && <a className="tk-btn" href={links.manage}><Again /> {t.reschedule}</a>}
          <a className="tk-btn red" href={links.manage}>{t.cancel}</a>
        </div>
      )}
    </article>
  );
}
