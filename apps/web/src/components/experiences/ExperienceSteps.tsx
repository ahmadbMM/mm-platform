"use client";

import { useRef, useState } from "react";
import { isRtl } from "@/i18n/locales";
import { fill } from "@/lib/fill";
import { fill as fillAt } from "@/i18n/tx";

// Booking in steps, one at a time (owner, 2026-09-25): the event, as the booking app's own event
// cards; then one of its dates, as the booking app's own session cards; then the ride - its prices
// and rules - and the button that opens the booking app on exactly that event and date
// (?ev=<event>&session=<id>).
export type StepSession = {
  id: string; kind: string; day: string; name: string;
  /** "Today" or "Tomorrow" in the page's language when the date is that close, else null. */
  near: string | null;
  /** Under the time: when bikes go out and the price from (the booking app's sess-card-meta). */
  meta?: string[];
  /** The route's distance for the summary ("6.17 km a lap"), or null. */
  routeKm?: string | null;
  /** Places left when counted (lib/rides.ts); said on the card at 3 or fewer. */
  left?: number | null; when: { gather: boolean; a: string; b: string } | null;
  members: boolean; free: boolean; full: boolean; paid: boolean;
  noCarbon: boolean; // the ride offers no Road Carbon bike, so its price is not shown
  /** A ticketed event: seats instead of bikes, so no bike prices - its own blurb, the seat price
   *  as the page writes it (null when free) and its seats as a number the page has formatted. */
  event: boolean; description: string | null; seatPrice: string | null; seats: string | null;
  /** The route the ride follows, named after the Routes page's list; null when none. */
  route: string | null;
  /** Not open to book yet (the booking window): the words for when it opens; null when it may be booked. */
  opens: string | null;
};
export type StepEvent = { key: string; title: string; meta: string; logo: string; note: string; sessions: StepSession[] };
export type StepText = {
  steps: [string, string, string]; eventTitle: string; dateTitle: string; bookTitle: string; cont: string; waitlist: string; back: string;
  noDates: string; handoff: string; members: string; free: string; full: string; gather: string; start: string; membersNote: string; clubLink: string;
  /** The booking app's session card says Available or Waitlist on the right. */
  available: string; waitlisted: string;
  /** "{0} spot left" / "{0} spots left": a ride with three places or fewer (spotsLeftLabel). */
  left1: string; leftN: string;
  pricesTitle: string; pricesText: string; codeNote: string;
  /** An event's facts: "Open to everyone", "{price} per seat", "{n} seats" (the page fills them). */
  everyone: string; perSeat: string; seats: string;
  /** The word before a ride's route: "Route: Obhur coast". */
  route: string;
};
type Props = { locale: string; events: StepEvent[]; prices: { type: string; label: string; price: string }[]; bookHref: string; clubHref: string; text: StepText };

export default function ExperienceSteps({ locale, events, prices, bookHref, clubHref, text: t }: Props) {
  const [step, setStep] = useState(1);
  const [ev, setEv] = useState<StepEvent | null>(null);
  const [sess, setSess] = useState<StepSession | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const go = (n: number) => {
    setStep(n);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const arrow = (isRtl(locale) ? "←" : "→");
  const back = (isRtl(locale) ? "→" : "←");
  const when = (s: StepSession) => (s.when ? (s.when.gather
    ? <>{t.gather} <bdi dir="ltr">{s.when.a}</bdi> · {t.start} <bdi dir="ltr">{s.when.b}</bdi></>
    : <bdi dir="ltr">{s.when.a} – {s.when.b}</bdi>) : null);
  const tags = (s: StepSession) => (
    <span className="xs-tags">
      {s.members && <em>{t.members}</em>}
      {s.event && !s.members && <em>{t.everyone}</em>}
      {s.free && <em>{t.free}</em>}
      {s.full && <em className="warn">{t.full}</em>}
    </span>
  );
  // An event's seat price and seats, on its card and in the summary.
  const facts = (s: StepSession) => (s.event && (s.seatPrice || s.seats) ? (
    <span className="sc-facts">
      {s.seatPrice && <span>{fill(t.perSeat, { price: s.seatPrice })}</span>}
      {s.seats && <span>{fill(t.seats, { n: s.seats })}</span>}
    </span>
  ) : null);
  // The community rides and the events are named by their own title, the fixed events by the card's.
  const named = (e: StepEvent) => e.key === "community" || e.key === "event";
  const link = (() => {
    if (!ev || !sess) return bookHref;
    try {
      const u = new URL(bookHref);
      u.searchParams.set("ev", ev.key);
      u.searchParams.set("session", sess.id);
      return u.toString();
    } catch {
      return bookHref;
    }
  })();

  return (
    <div className="xs" ref={top}>
      <ol className="xs-bar" aria-label={t.steps.join(" · ")}>
        {t.steps.map((label, i) => {
          const n = i + 1, done = step > n, cur = step === n;
          return (
            <li key={n} className={done ? "done" : cur ? "cur" : ""} aria-current={cur ? "step" : undefined}>
              <span className="xs-dot">{done ? "✓" : n}</span><span className="xs-lbl">{label}</span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <section aria-labelledby="xs-h1">
          <h2 id="xs-h1" className="xs-title">{t.eventTitle}</h2>
          <div className="xs-events">
            {events.map((e) => (
              <button key={e.key} type="button" className={`xs-event ev-${e.key}`} onClick={() => { setEv(e); setSess(null); go(2); }}>
                {e.logo && <span className="xs-logo"><img src={e.logo} alt="" /></span>}
                <span className="xs-copy"><span className="xs-ev-title">{e.title}</span>{e.meta && <span className="xs-ev-meta">{e.meta}</span>}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && ev && (
        <section aria-labelledby="xs-h2">
          <button type="button" className="xs-back" onClick={() => go(1)}><span aria-hidden="true">{back}</span> {t.back}</button>
          <p className="xs-picked">{ev.title}</p>
          <h2 id="xs-h2" className="xs-title">{t.dateTitle}</h2>
          {ev.sessions.length === 0 ? (
            <p className="xs-empty">{t.noDates}</p>
          ) : (
            <div className="sc-list">
              {ev.sessions.map((s) => (
                <button key={s.id} type="button" className={`sc-card ev-${s.kind}${s.full ? " full" : ""}${s.opens ? " closed" : ""}`} disabled={!!s.opens} aria-disabled={!!s.opens} onClick={() => { setSess(s); go(3); }}>
                  {(named(ev) || s.members || s.free) && (
                    <span className="sc-kicker">
                      {named(ev) && <span className="sc-chip">{s.name}</span>}
                      {s.members && <span className="sc-tag">{t.members}</span>}
                      {s.event && !s.members && <span className="sc-tag">{t.everyone}</span>}
                      {s.free && <span className="sc-tag">{t.free}</span>}
                    </span>
                  )}
                  <span className="sc-head">
                    <span className="sc-dot" aria-hidden="true" />
                    <span className="sc-date">{s.near && <><strong className="sc-dw">{s.near}</strong> · </>}{s.day}</span>
                    {s.opens ? <span className="sc-spots closed">{s.opens}</span> : s.full ? <span className="sc-spots full">{t.waitlisted}</span>
                      : s.left != null && s.left > 0 && s.left <= 3 ? <span className="sc-spots low">{fillAt(s.left === 1 ? t.left1 : t.leftN, s.left)}</span>
                      : <span className="sc-spots">{t.available}</span>}
                  </span>
                  {s.when && <span className="sc-time">{when(s)}</span>}
                  {s.meta && s.meta.length > 0 && <span className="sc-meta">{s.meta.map((x, i) => <span key={i}>{i > 0 && " · "}<bdi>{x}</bdi></span>)}</span>}
                  {s.route && <span className="sc-time">{t.route}: {s.route}</span>}
                  {s.event && s.description && <span className="sc-desc">{s.description}</span>}
                  {facts(s)}
                </button>
              ))}
            </div>
          )}
          {ev.sessions.some((s) => s.members) && <p className="xs-note">{t.membersNote} <a href={clubHref}>{t.clubLink} {arrow}</a></p>}
        </section>
      )}

      {step === 3 && ev && sess && (
        <section aria-labelledby="xs-h3">
          <button type="button" className="xs-back" onClick={() => go(2)}><span aria-hidden="true">{back}</span> {t.back}</button>
          <h2 id="xs-h3" className="xs-title">{t.bookTitle}</h2>
          <div className="xs-summary">
            <div className="xs-sum-head">
              {ev.logo && <span className="xs-logo small"><img src={ev.logo} alt="" /></span>}
              <div><strong>{named(ev) ? sess.name : ev.title}</strong><span>{sess.day}{sess.when ? <> · {when(sess)}</> : null}{sess.route ? <> · {t.route}: {sess.route}</> : null}{sess.routeKm ? <> · {sess.route ? "" : <>{t.route}: </>}{sess.routeKm}</> : null}</span></div>
            </div>
            {tags(sess)}
            {sess.event && sess.description && <p className="xs-rules">{sess.description}</p>}
            {facts(sess)}
            {ev.note && <p className="xs-rules">{ev.note}</p>}
            {sess.paid && !sess.event && prices.some((p) => !(sess.noCarbon && p.type === "Road Carbon")) && (
              <div className="xs-prices">
                <p className="xs-prices-h">{t.pricesTitle}</p>
                {t.pricesText && <p className="xs-prices-t">{t.pricesText}</p>}
                <div>{prices.filter((p) => !(sess.noCarbon && p.type === "Road Carbon")).map((p) => <span key={p.label}><span>{p.label}</span><strong>{p.price}</strong></span>)}</div>
                {t.codeNote && <p className="xs-prices-t">{t.codeNote}</p>}
              </div>
            )}
            {sess.members && <p className="xs-note">{t.membersNote} <a href={clubHref}>{t.clubLink} {arrow}</a></p>}
          </div>
          <a className="xs-go" href={link}>{sess.full ? t.waitlist : t.cont} <span aria-hidden="true">{arrow}</span></a>
          {t.handoff && <p className="xs-handoff">{t.handoff}</p>}
        </section>
      )}
    </div>
  );
}
