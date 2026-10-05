"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { isRtl } from "@/i18n/locales";
import { fill } from "@/lib/fill";
import { fill as fillAt } from "@/i18n/tx";
import { infoShown, membersOnlyEvent } from "@/lib/event-info";

// Booking in steps, one at a time (owner, 2026-09-25): the event, as the booking app's own event
// cards; then one of its dates, as the booking app's own session cards; then the ride - its prices
// and rules - and the button that opens the booking app on exactly that event and date
// (?ev=<event>&session=<id>).
// Under each event card "About this event", and under each date "Details" (the owner, 2026-10-05,
// as the booking app's picker has them): a link of its own beside the card, never inside it, that
// opens one dialog saying what the event or the date is, with the date's facts. A members-only card
// or date shows its link to community members alone (lib/event-info.ts).
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
  /** What its Details say, every word ready in the page's language. */
  info: StepInfo;
};
/** A date's Details (lib/event-info.ts): its text, staff's own line, and its facts. */
export type StepInfo = {
  /** The date's kind's text with its times filled in, or a ticketed event's own description. */
  text: string;
  /** Staff's own line for the date (sessions.description), under the text; null on an event, whose description is the text. */
  extra: string | null;
  /** Who may book it, and what it costs (null when there is nothing to say). */
  who: string; price: string | null;
  /** "Collect bikes from 8:15 PM", under the time; null on a ride without one. */
  collect: string | null;
  /** Where it is, and that place's map (null when there is none). */
  place: string; map: string | null;
  /** A run's distances ("3 km · 5 km") and the places it has (said when counted); null when not said. */
  distance: string | null; places: string | null;
};
/** `about`: what the event is, in its About (Experiences > Event cards, *About). */
export type StepEvent = { key: string; title: string; meta: string; logo: string; note: string; about: string; sessions: StepSession[] };
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
  /** The About and Details links, and their dialog's words. */
  info: {
    about: string; details: string; bookEvent: string; chooseDate: string; who: string; price: string; when: string; next: string;
    where: string; map: string; distance: string; places: string; whoMembers: string; close: string;
  };
};
// clubHref: the Club page, "" while staff have it switched off (its address then leads Home), so no link is offered.
// member: the visitor is a signed-in community member (the page asks community_member), so the
// members-only cards and dates show their links too.
type Props = { locale: string; events: StepEvent[]; prices: { type: string; label: string; price: string }[]; bookHref: string; clubHref: string; member: boolean; text: StepText };
type Fact = { k: string; v: ReactNode };

export default function ExperienceSteps({ locale, events, prices, bookHref, clubHref, member, text: t }: Props) {
  const [step, setStep] = useState(1);
  const [ev, setEv] = useState<StepEvent | null>(null);
  const [sess, setSess] = useState<StepSession | null>(null);
  const top = useRef<HTMLDivElement>(null);
  // The dialog: an event's About (s null), or one of its dates' Details. It opens once its words are
  // drawn and its title takes the focus; Escape, Close or a tap outside closes it, and the focus goes
  // back to the link that opened it.
  const [info, setInfo] = useState<{ ev: StepEvent; s: StepSession | null } | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const d = dlg.current;
    if (!info || !d) return;
    if (!d.open) d.showModal();
    head.current?.focus({ preventScroll: true });
  }, [info]);
  const showInfo = (e: StepEvent, s: StepSession | null, el: HTMLElement) => {
    opener.current = el;
    setInfo({ ev: e, s });
  };
  // The button pressed is gone with its step, so the new step's heading takes the focus (a keyboard
  // or screen reader carries on from there instead of from the top of the page).
  const go = (n: number) => {
    setStep(n);
    requestAnimationFrame(() => {
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      top.current?.querySelector<HTMLElement>(".xs-title")?.focus({ preventScroll: true });
    });
  };
  // What a card does, and what its dialog's button does too.
  const pickEvent = (e: StepEvent) => { setEv(e); setSess(null); go(2); };
  const pickDate = (s: StepSession) => { setSess(s); go(3); };
  const arrow = (isRtl(locale) ? "←" : "→");
  const back = (isRtl(locale) ? "→" : "←");
  // The times in their own direction (a <bdi> with none forced): an Arabic clock ("9:00 م") read right
  // to left, a Latin one ("9:00 PM") left to right. Forcing ltr turned an Arabic range into
  // "م – 11:00 م 9:00" (2026-10-05).
  const when = (s: StepSession) => (s.when ? (s.when.gather
    ? <>{t.gather} <bdi>{s.when.a}</bdi> · {t.start} <bdi>{s.when.b}</bdi></>
    : <bdi>{s.when.a} – {s.when.b}</bdi>) : null);
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
  // A date's facts in the dialog (the booking app's _infoFacts); `next` says it as its event's next date.
  const infoFacts = (s: StepSession, next: boolean): Fact[] => {
    const i = s.info;
    const out: Fact[] = [{ k: t.info.who, v: i.who }];
    if (i.price) out.push({ k: t.info.price, v: <bdi>{i.price}</bdi> });
    out.push({ k: next ? t.info.next : t.info.when, v: <>{s.day}{s.when && <><br />{when(s)}</>}{i.collect && <><br />{i.collect}</>}</> });
    out.push({ k: t.info.where, v: <>{i.place}{i.map && <> · <a href={i.map} target="_blank" rel="noopener">{t.info.map}</a></>}</> });
    if (i.distance) out.push({ k: t.info.distance, v: <bdi>{i.distance}</bdi> });
    if (i.places) out.push({ k: t.info.places, v: i.places });
    return out;
  };
  // An event's About lists its next date's facts; the community rides' card, which stands for several
  // kinds of ride, says only who may book them and which ride is next - never one ride's price.
  const eventFacts = (e: StepEvent): Fact[] => {
    const s = e.sessions[0];
    if (!s) return [];
    if (e.key === "community") return [{ k: t.info.who, v: t.info.whoMembers }, { k: t.info.next, v: <>{s.name} · {s.day}{s.when && <><br />{when(s)}</>}</> }];
    return infoFacts(s, true);
  };
  // What the dialog says, and its button's words: the card's own step, which a date not open to book
  // yet does not offer ("").
  const sheet = info && (info.s
    ? { kind: info.s.kind, kick: info.s.name, title: info.s.day, text: info.s.info.text, extra: info.s.info.extra, facts: infoFacts(info.s, false), act: info.s.opens ? "" : t.info.chooseDate }
    : { kind: info.ev.sessions[0]?.kind ?? info.ev.key, kick: t.info.about, title: info.ev.title, text: info.ev.about, extra: null, facts: eventFacts(info.ev), act: t.info.bookEvent });
  // The dialog's button does what the card does. The link that opened the dialog goes with its step,
  // so the focus goes on to the next step's heading (go) rather than back to it.
  const take = () => {
    if (!info) return;
    opener.current = null;
    dlg.current?.close();
    if (info.s) pickDate(info.s);
    else pickEvent(info.ev);
  };
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
          <h2 id="xs-h1" className="xs-title" tabIndex={-1}>{t.eventTitle}</h2>
          <div className="xs-events">
            {events.map((e) => {
              const about = infoShown(membersOnlyEvent(e.key), member);
              return (
                <div key={e.key} className={`xs-ev-wrap${about ? " has-about" : ""}`}>
                  <button type="button" className={`xs-event ev-${e.key}`} onClick={() => pickEvent(e)}>
                    {e.logo && <span className="xs-logo"><img src={e.logo} alt="" /></span>}
                    <span className="xs-copy"><span className="xs-ev-title">{e.title}</span>{e.meta && <span className="xs-ev-meta">{e.meta}</span>}</span>
                  </button>
                  {about && <button type="button" className={`xs-about ab-${e.key}`} aria-label={`${t.info.about} · ${e.title}`} onClick={(x) => showInfo(e, null, x.currentTarget)}>{t.info.about}</button>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && ev && (
        <section aria-labelledby="xs-h2">
          <button type="button" className="xs-back" onClick={() => go(1)}><span aria-hidden="true">{back}</span> {t.back}</button>
          <p className="xs-picked">{ev.title}</p>
          <h2 id="xs-h2" className="xs-title" tabIndex={-1}>{t.dateTitle}</h2>
          {ev.sessions.length === 0 ? (
            <p className="xs-empty">{t.noDates}</p>
          ) : (
            <div className="sc-list">
              {ev.sessions.map((s) => {
                const details = infoShown(s.members, member);
                return (
                  <div key={s.id} className={`sc-wrap ev-${s.kind}${details ? " has-about" : ""}`}>
                    <button type="button" className={`sc-card ev-${s.kind}${s.full ? " full" : ""}${s.opens ? " closed" : ""}`} disabled={!!s.opens} aria-disabled={!!s.opens} onClick={() => pickDate(s)}>
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
                    {details && <button type="button" className="sc-about" aria-label={`${t.info.details} · ${s.name} · ${s.day}`} onClick={(x) => showInfo(ev, s, x.currentTarget)}>{t.info.details}</button>}
                  </div>
                );
              })}
            </div>
          )}
          {ev.sessions.some((s) => s.members) && <p className="xs-note">{t.membersNote}{clubHref && <> <a href={clubHref}>{t.clubLink} {arrow}</a></>}</p>}
        </section>
      )}

      {step === 3 && ev && sess && (
        <section aria-labelledby="xs-h3">
          <button type="button" className="xs-back" onClick={() => go(2)}><span aria-hidden="true">{back}</span> {t.back}</button>
          <h2 id="xs-h3" className="xs-title" tabIndex={-1}>{t.bookTitle}</h2>
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
            {sess.members && <p className="xs-note">{t.membersNote}{clubHref && <> <a href={clubHref}>{t.clubLink} {arrow}</a></>}</p>}
          </div>
          <a className="xs-go" href={link}>{sess.full ? t.waitlist : t.cont} <span aria-hidden="true">{arrow}</span></a>
          {t.handoff && <p className="xs-handoff">{t.handoff}</p>}
        </section>
      )}

      <dialog ref={dlg} className={`xs-info${sheet ? ` ev-${sheet.kind}` : ""}`} aria-labelledby="xs-info-h"
        onClose={() => { setInfo(null); opener.current?.focus({ preventScroll: true }); opener.current = null; }}
        onClick={(x) => { if (x.target === x.currentTarget) dlg.current?.close(); }}>
        {sheet && (
          <div className="xs-info-in">
            <p className="xs-info-kick">{sheet.kick}</p>
            <h2 id="xs-info-h" className="xs-info-title" tabIndex={-1} ref={head}>{sheet.title}</h2>
            {sheet.text && <p className="xs-info-text">{sheet.text}</p>}
            {sheet.extra && <p className="xs-info-extra" dir="auto">{sheet.extra}</p>}
            {sheet.facts.length > 0 && <dl className="xs-info-facts">{sheet.facts.map((f) => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></div>)}</dl>}
            <div className="xs-info-btns">
              <button type="button" className="xs-info-close" onClick={() => dlg.current?.close()}>{t.info.close}</button>
              {sheet.act && <button type="button" className="xs-info-go" onClick={take}>{sheet.act}</button>}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
