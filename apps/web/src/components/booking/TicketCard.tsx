import Qr from "./Qr";
import WalletButton from "@/components/account/WalletButton";
import type { T } from "./tickets.text";
import { intlOf } from "@/i18n/locales";
import { bookingRef, codeReady, dayWord, fmtClock, icsFor, queueNumbers, ticketLook, venueOf, type Cue, type TicketRow, type TicketSession } from "@/lib/tickets";

// The booking app's ticket (renderBookingTicket), for My Account: the same card, the same rules.
// Its actions are the booking app's own - Edit, Reschedule and Cancel open it there - so the site
// never changes a booking behind its back.
export type TicketText = (typeof T)["en"];
type Props = {
  locale: string;
  /** Today in Riyadh (YYYY-MM-DD): the ride's day leads with Today, Tomorrow and the neon line. */
  today: string;
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
  /** live: the live ride map (/live?session=), on the day of the ride only. */
  links: { edit: string | null; manage: string; place: string | null; live?: string | null };
  /** The route the ride follows, named after the Routes page's list; null when none. */
  route?: string | null;
  /** The booking (and the party's rows) a Google Wallet pass is made for (WalletButton); null for none. */
  wallet?: { bookingId: string; groupIds: string[] } | null;
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
const Live = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" /><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" />
  </svg>
);
// An amount as riders read it in the booking app (_sar): the riyal sign (U+20C1, drawn by
// /fonts/Riyal-*.woff2, booking.css) left of the number in every language, isolated left to right
// so an Arabic line cannot flip it.
const sar = (n: number) => `\u2066\u20C1 ${Math.round((Number(n) || 0) * 100) / 100}\u2069`;

const Again = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </svg>
);

export default function TicketCard({ locale, today, rows, session: s, name, cue, t, gather, start, typeName, links, route = null, wallet = null }: Props) {
  const primary = rows[0];
  const noNum = !s || s.approval; // a ride staff approve never shows its order
  const allWl = rows.every((r) => r.status === "waitlist");
  const num = noNum ? name : queueNumbers(rows);
  const look = ticketLook(rows, s); // dark when a place is held, paper otherwise (the booking app's tk-live)
  const onDay = primary.date === today;
  const dw = dayWord(primary.date, today);
  const venue = venueOf(s);
  const big = num.length <= 4 ? "big" : num.length <= 9 ? "mid" : "small";
  const bikes = s ? s.bikes : true;
  const total = rows.reduce((sum, r) => sum + r.price, 0);
  const free = !!s?.free || (noNum && total === 0);
  const ready = codeReady(rows, s);
  const owes = !allWl && !s?.approval && rows.some((r) => !r.paid && r.price > 0);
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
    <article className={`tk-card ev-${s?.kind ?? "jcc"}${look ? ` tk-${look}` : ""}${look === "live" && onDay ? " tk-today" : ""}`}>
      <div className="tk-head">
        <div className="tk-num-block">
          {/* The logo heads the number's column (the booking app's _tkLogo): white lettering on the dark card. */}
          <span className="tk-logo" aria-hidden="true"><img className="tk-logo-l" src="/site/logo-dark.webp" alt="" decoding="async" /><img className="tk-logo-d" src="/site/logo.webp" alt="" decoding="async" /></span>
          {!noNum && (allWl
            ? <p className="tk-label wl">{t.wlOnList}{wl ? <> · {t.wlLinePos(String(wl))}</> : ""}</p>
            : <p className="tk-label">{rows.length > 1 ? (rows.length === 2 ? t.bikes2 : t.bikesN(String(rows.length))) : t.queueNumber}</p>)}
          {/* a number reads left to right in every language: "#7 – #8" is never "#8 – #7" */}
          <p className={`tk-num ${big}`}>{noNum ? num : <bdi dir="ltr">{num}</bdi>}</p>
          {allWl && !noNum && <p className="tk-wl-note">{wl ? t.wlPos(String(wl)) : t.wlPosNoNum}</p>}
        </div>
        <div className="tk-right">
          {ready
            ? <Qr payload={bookingRef(primary, s)} label={`${t.queueNumber} ${num}`} />
            : <div className="tk-qr-hold"><span>{t.qrHold}</span></div>}
          <p className="tk-when">
            {dw && <><strong className="tk-dw">{dw === "today" ? t.today : t.tomorrow}</strong><br /></>}
            {f({ weekday: "long" })}<br />{f({ day: "numeric", month: "short", year: "numeric" })}
            {when && <><br /><bdi>{when}</bdi></>}
            {green && <><br /><span className="go">{green}</span></>}
            {route && <><br /><span className="tk-route">{t.route}: {route}</span></>}
            <br /><span className="tk-venue">{venue.kind === "meet" ? t.meetingPoint : venue.kind === "circuit" ? t.venueCircuit : venue.text}</span>
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
                ? <span className="tk-w"><span className="dot" aria-hidden="true" />{r.waitlistNum ? t.wlRowPos(String(r.waitlistNum)) : t.waitlist}</span>
                : r.queueNum != null && <span className="tk-q" dir="ltr">#{r.queueNum}</span>)}
              <span className="tk-name">{r.name}</span>
              {bikes && r.type && r.type !== "None" && <span className={`tk-type t-${r.type.toLowerCase().replace(/\s+/g, "")}`}><Bike /> {typeName(r.type)}</span>}
            </div>
            {!noNum && (
              <div className="tk-rider-pay">
                <bdi className={`tk-amt${r.paid ? " paid" : ""}`}>{sar(r.price)}</bdi>
                {/* Unpaid says where it is paid; a waitlisted rider owes nothing until they have a place. */}
                {r.paid
                  ? <span className="tk-pay paid"><span className="dot" aria-hidden="true" />{r.price === 0 ? t.onTheHouse : t.paid}</span>
                  : r.status !== "waitlist" && r.price > 0 && <span className="tk-pay due"><span className="dot" aria-hidden="true" />{t.payDue}</span>}
              </div>
            )}
          </div>
        ))}
        <div className="tk-total"><span>{t.total}</span><strong>{free ? t.free : <bdi className="tk-amt">{sar(total)}</bdi>}</strong></div>
        {owes && <p className="tk-line">{t.payAtBooth}</p>}
        {!allWl && bikes && <p className="tk-line">{s?.approval ? t.helmetBring : t.helmetLine}</p>}
      </div>

      <div className="tk-actions">
        {ics && !allWl && <a className="tk-btn" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download={`micromobility-${primary.date.replace(/-/g, "")}.ics`}>{t.calendar}</a>}
        {links.place && <a className="tk-btn" href={links.place} target="_blank" rel="noopener"><Pin />{s?.approval ? t.meetingPoint : t.directions}</a>}
        {links.live && <a className="tk-btn solid" href={links.live}><Live />{t.liveMap}</a>}
      </div>
      {/* A pass in the phone's wallet reads as a place held: none on a waitlist or before the code is out. */}
      {wallet && !allWl && ready && <div className="tk-actions"><WalletButton bookingId={wallet.bookingId} groupIds={wallet.groupIds} /></div>}
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
