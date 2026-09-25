"use client";

import { useRef, useState } from "react";

// Booking in steps, one at a time (owner, 2026-09-25): the event, as the booking app's own event
// cards; then one of its dates; then the ride - its prices and rules - and the button that opens
// the booking app on exactly that event and date (?ev=<event>&session=<id>).
export type StepSession = {
  id: string; day: string; name: string; when: { gather: boolean; a: string; b: string } | null;
  members: boolean; free: boolean; full: boolean; paid: boolean;
  noCarbon: boolean; // the ride offers no Road Carbon bike, so its price is not shown
};
export type StepEvent = { key: string; title: string; meta: string; logo: string; note: string; sessions: StepSession[] };
export type StepText = {
  steps: [string, string, string]; eventTitle: string; dateTitle: string; bookTitle: string; cont: string; waitlist: string; back: string;
  noDates: string; handoff: string; members: string; free: string; full: string; gather: string; start: string; membersNote: string; clubLink: string;
  pricesTitle: string; pricesText: string; codeNote: string;
};
type Props = { locale: string; events: StepEvent[]; prices: { type: string; label: string; price: string }[]; bookHref: string; clubHref: string; text: StepText };

export default function ExperienceSteps({ locale, events, prices, bookHref, clubHref, text: t }: Props) {
  const ar = locale === "ar";
  const [step, setStep] = useState(1);
  const [ev, setEv] = useState<StepEvent | null>(null);
  const [sess, setSess] = useState<StepSession | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const go = (n: number) => {
    setStep(n);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const arrow = ar ? "←" : "→";
  const back = ar ? "→" : "←";
  const when = (s: StepSession) => (s.when ? (s.when.gather
    ? <>{t.gather} <bdi dir="ltr">{s.when.a}</bdi> · {t.start} <bdi dir="ltr">{s.when.b}</bdi></>
    : <bdi dir="ltr">{s.when.a} – {s.when.b}</bdi>) : null);
  const tags = (s: StepSession) => (
    <span className="xs-tags">
      {s.members && <em>{t.members}</em>}
      {s.free && <em>{t.free}</em>}
      {s.full && <em className="warn">{t.full}</em>}
    </span>
  );
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
            <div className="xs-dates">
              {ev.sessions.map((s) => (
                <button key={s.id} type="button" className={`xs-date${s.full ? " is-full" : ""}`} onClick={() => { setSess(s); go(3); }}>
                  <span className="xs-day">{s.day}</span>
                  {ev.key === "community" && <strong>{s.name}</strong>}
                  {s.when && <span className="xs-time">{when(s)}</span>}
                  {tags(s)}
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
              <div><strong>{ev.key === "community" ? sess.name : ev.title}</strong><span>{sess.day}{sess.when ? <> · {when(sess)}</> : null}</span></div>
            </div>
            {tags(sess)}
            {ev.note && <p className="xs-rules">{ev.note}</p>}
            {sess.paid && prices.some((p) => !(sess.noCarbon && p.type === "Road Carbon")) && (
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
