"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { isRtl } from "@/i18n/locales";
import { fill } from "@/lib/fill";
import { fill as fillAt } from "@/i18n/tx";
import { bookingAt, featuredFirst, infoShown, memberOn, membersOnlyDate, membersOnlyEvent } from "@/lib/event-info";
import { isNonBike, typeOffered } from "@/lib/bike-kinds";
import { ArrowIcon, BackIcon, ClockIcon, InfoIcon, TickIcon } from "@/components/site/Icons";
import { opensLine, type OpensWords } from "@/lib/opens-in";
import { radioKey, tabStop } from "@/lib/radio-keys";
import { YOGA_MARK, YOGA_MARK_SIZE } from "@/lib/yoga";
import { hasKindArt, kindsInOrder, rowsOfKind } from "@/lib/kind-theme";
import { KindIcon, SatRoute, type RouteWords } from "./KindArt";

// Booking in steps, one at a time (owner, 2026-09-25): the event, as the booking app's own event
// cards; then one of its dates, as the booking app's own session cards; then the ride - its prices
// and rules - and the button that opens the booking app on exactly that event and date
// (?ev=<event>&session=<id>).
// Under each event card "About this event", and under each date "Details" (the owner, 2026-10-05,
// as the booking app's picker has them): a link of its own beside the card, never inside it, that
// opens one dialog saying what the event or the date is, with the date's facts. A members-only card
// or date shows its link to community members alone (lib/event-info.ts).
// A Saturday ride's date names its breakfast stop once staff set one (the owner, 2026-10-05): a line
// on its card, the last of its Details, and its summary say "Breakfast at {name}".
// A session for men only or women only, and a pool session open to both (the owner, 2026-10-27), wears its
// chip on its card, in its Details and in the summary; every visitor sees it (the owner, 2026-10-28), and a
// signed-in account the session is not for reads why in place of the button (the page decides,
// lib/session-gender.ts genderBlock).
// Arena Heros (the owner, 2026-10-28) has a card of its own: since 2026-10-29 the organisers' poster ("add the image
// to the card dont keep it plain"): their logo over the red-lit hall, its name in the poster's heavy italic capitals,
// its soonest date, hours and venue, its line; its dates never say how many places are left.
// The Blood Donation event (2026-11-03) has a card of its own while it has a date, its words in its StepEvent alone, from
// the server, so none of them sits in this code: the hosts' plate, its name, when and where, its tagline and four short
// rules, in crimson on white, never a price. Its About and its dates' Details open the poster in Arabic or English.
// Yoga (2026-11-12; lib/yoga.ts) is a date inside the community card, on a card of its own in the booking app's "Sunset
// Hatha" look: cream, the low sun rising from its far corner, the mark, its name in Marcellus clay, when, how long and
// where, and who leads it along the foot; its summary wears the mark, its button clay.
// Featured (2026-11-13, as the booking app's _featLandHtml and renderRegister): a date inside MicroMobility Experiences that
// staff feature, or a special event as it is made (lib/rides.ts featuredOf). Above the event cards, "Featured" (a star on a
// neon disc) heads one card for each, four at most, soonest first: its day as a calendar leaf (the weekday on a band of
// its kind's colour), its name, its time (yoga says how long too), where, and its price word or who leads yoga, with the
// waitlist, the places left or when it opens as its date's card says them; yoga's keeps its own colours. A card opens
// what its event's card and then its date would. On a phone two or more are one row that scrolls sideways, the next
// showing at the edge. In its event's dates the featured ones come first under "Featured" and the rest follow under
// "Upcoming", each date once; with nothing featured the list has no headings, and with every date featured no second one.
// The Experiences card, its list and the Saturday ride (the owner's picks on the booking app's theming page, 2026-11-13;
// lib/kind-theme.ts): the card leads with the brand pattern and a mark for each kind it has dates for, no lockup, and its
// link says About and its dialog See dates; its list's heading sits in that pattern under the card's name, a switch picks
// one of its kinds (the rows alone narrow), and a list mixing rides with sessions without a bike says Choose a date; a
// named date wears its kind's mark on its tint, the Saturday ride, the pool and a Petromin night their motif along the
// foot and their drawing across the top of their Details, and the Saturday ride's Details draw its two routes and say
// when the sun rises.
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
  /** A Saturday ride while it is booked at micromobility.sa/saturday with a ride code (rentals 20261108120000): where its button goes. */
  satLink?: string | null;
  noCarbon: boolean; // the ride offers no Road Carbon bike, so its price is not shown
  closedTypes?: string[]; // nor the price of a type staff closed on this session (typeOffered)
  /** A ticketed event: seats instead of bikes, so no bike prices - its own blurb, the seat price
   *  as the page writes it (null when free) and its seats as a number the page has formatted. */
  event: boolean; description: string | null; seatPrice: string | null; seats: string | null;
  /** The route the ride follows, named after the Routes page's list; null when none. */
  route: string | null;
  /** The Saturday ride's (or Run for Her's) breakfast stop by name, in the page's language (lib/event-info.ts
   *  infoBreakfast); null on any other ride or one with no stop yet. */
  breakfast: string | null;
  /** The Saturday ride's (or Run for Her's) breakfast spot told later (lib/tickets.ts spotHeld): the line
   *  that says when, ready in the page's language; null when nothing is held back. Optional, so a copy
   *  kept from before reads as none. */
  reveal?: string | null;
  /** Not open to book yet (the booking window): the words for when it opens; null when it may be booked. */
  opens: string | null;
  /** When it opens (epoch ms; lib/booking-window.ts opensAt) while it is not open yet: within a day of it the card counts
   *  down ("Booking opens in 2 h 10 min"), each minute, and opens itself when the window does. Optional: none, no countdown. */
  opensAt?: number | null;
  /** What its Details say, every word ready in the page's language. */
  info: StepInfo;
  /** The DEFE 5KM Run's own date card (the booking app's _defeSessCard, 2026-10-18): when, how far and
   *  where ("7 PM · 5 km · Jeddah Corniche Circuit") and the cause along its foot; absent on any other date. */
  defe?: { meta: string[]; cause: string };
  /** Yoga's own date card (the booking app's _ygSessCard, 2026-11-12): its start and end, how long and where ("4:00 PM –
   *  5:30 PM · 90 min · SILKDEER"), and who leads it along its foot ("with Jassim Alsaady"); absent on any other date. */
  yoga?: { meta: string[]; with: string };
  /** A featured date (lib/rides.ts featuredOf, 2026-11-13): its day as its Featured card's tile, short weekday, day
   *  number and short month ("Sat", "21", "Nov"), and how long yoga runs ("90 min", null on any other date or when it
   *  cannot be told); absent on a date that is not featured. */
  feat?: { wd: string; dn: string; mo: string; len: string | null };
  /** Victory Lap, to those who may book it: how the ticket is paid once booked (the booking app's vlPayLater,
   *  or staff's own words, sessions.vl.pay), under the price; Arena Heros, to a community member: that how to
   *  pay will be announced (or staff's words); absent on any other date. */
  payNote?: string;
  /** Men only, women only or mixed (lib/session-gender.ts genderChip): the chip's class and words; null on a
   *  session that wears none. Optional, so a copy kept from before reads as none. */
  sg?: { cls: string; label: string } | null;
  /** "This session is for women only.": the signed-in account may not book it (genderOk), so the summary says
   *  this in place of its button; null when it may, and for a visitor who is not signed in (genderBlock). */
  refusal?: string | null;
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
  /** Victory Lap's and Arena Heros' races and divisions open to book, in the page's words; absent on any other kind. */
  races?: string; divs?: string;
  /** Arena Heros: each division's level and what it asks; the race's format (teams, stations, medals); and the line
   *  under its window (the prayer break). Absent on any other kind. */
  guide?: { name: string; level: string; text: string }[]; format?: string; whenNote?: string;
  /** Arena Heros: the organisers' race details, a link of its own (its label, its text, its address). */
  link?: { label: string; text: string; url: string };
  /** The DEFE 5KM Run: when the race kits are handed out, and where the race itself is entered (Race
   *  Arabia, a link of its own); absent on any other kind. */
  kit?: { label: string; text: string };
  race?: { label: string; link: string; url: string };
  /** Facts of the date's own kind, after where it is: yoga's who leads it, how long, the level and what to bring
   *  (2026-11-12). Absent on any other kind. */
  more?: { k: string; v: string }[];
  /** The Saturday ride: when the sun rises that day, in the page's clock (a fact right after when it is), and its two
   *  routes' words for the drawing above the facts (KindArt.tsx SatRoute). Absent on any other kind. */
  sunrise?: string;
  route?: RouteWords;
};
/** `about`: what the event is, in its About (Experiences > Event cards, *About). */
export type StepEvent = {
  key: string; title: string; meta: string; logo: string; note: string; about: string; sessions: StepSession[];
  /** Victory Lap's card (the booking app's _vlCardHtml): its soonest date, when the doors open and where, under its
   *  line; Arena Heros' its soonest date, its hours and its venue. */
  line?: string[];
  /** Arena Heros: you must have a partner, said loud on its card (2026-11-02). */
  must?: string;
  /** Arena Heros' name under its logo (Experiences > Dates: arName), as the booking app's card says it. */
  name?: string;
  /** The Blood Donation event's card; absent on any other. */
  blood?: StepBlood;
  /** The Experiences card: a mark for each kind it has a date for, in their order (lib/kind-theme.ts kindMarks), and
   *  their names joined for a screen reader; absent on any other card, and when it has no such date. */
  marks?: { kinds: string[]; label: string };
};
/** What the Blood Donation event's card, its summary and its poster say, every word ready in the page's language: the
 *  hosts' plate, the tagline, the four short rules, and the poster retyped from the hospital's PDF (blood-info.json). */
export type StepBlood = {
  plate: { src: string; alt: string; width: number; height: number };
  picture: { src: string; width: number; height: number };
  types: string[]; line: string;
  cause: string; rules: string[];
  info: {
    title: string; language: string; pdf: { label: string; url: string };
    poster: Record<"ar" | "en", { sections: { h: string; p?: string; i?: string[] }[]; source: string }>;
  };
};
export type StepText = {
  steps: [string, string, string]; eventTitle: string; dateTitle: string; bookTitle: string; cont: string; waitlist: string; back: string;
  noDates: string; handoff: string; members: string; free: string; full: string; gather: string; start: string; membersNote: string; clubLink: string;
  /** A date without a bike (the pool, the workshop, an event, a run, Victory Lap; the owner, 2026-10-18: nothing
   *  about cycling there): the last step's title, the line under its button and the members' note, in words
   *  that say booking, participants and sessions, never ride or riders. */
  bookTitleNb: string; handoffNb: string; membersNoteNb: string;
  /** The booking app's session card says Available or Waitlist on the right. */
  available: string; waitlisted: string;
  /** "{0} spot left" / "{0} spots left": a ride with three places or fewer (spotsLeftLabel). */
  left1: string; leftN: string;
  /** "Featured" over the featured dates and their cards, "Upcoming" over the rest of an event's dates (the booking
   *  app's featTitle and featRest). */
  featured: string; upcoming: string;
  pricesTitle: string; pricesText: string; codeNote: string;
  /** An event's facts: "Open to everyone", "{price} per seat", "{n} seats" (the page fills them). */
  everyone: string; perSeat: string; seats: string;
  /** The word before a ride's route: "Route: Obhur coast". */
  route: string;
  /** "Breakfast at {0}", {0} the stop's name (StepSession.breakfast). */
  breakfastAt: string;
  /** The countdown to a date's booking window (lib/booking-window.ts opensInWords): "Booking opens in {0}" and its units. */
  opensIn: OpensWords;
  /** The About and Details links, and their dialog's words; `after` heads the breakfast stop, the last fact. */
  info: {
    about: string; details: string; bookEvent: string; chooseDate: string; who: string; price: string; when: string; next: string;
    where: string; map: string; distance: string; places: string; after: string; whoMembers: string; close: string;
    races: string; divs: string; format: string;
    /** The Experiences card's link and its dialog's kicker ("About"), and its dialog's button ("See dates"); the
     *  Saturday ride's sunrise fact. */
    aboutShort: string; seeDates: string; sunrise: string;
  };
  /** The kind switch over a list of two kinds or more: its name for a screen reader, All, and each kind's name (the
   *  short one where it has one: Saturday, Pool, Petromin). */
  kinds: { show: string; all: string; names: Record<string, string> };
  /** The date step's title on a list mixing rides with sessions without a bike. */
  chooseDate: string;
};
// clubHref: the Club page, "" while staff have it switched off (its address then leads Home), so no link is offered.
// member: the visitor is a signed-in community member (the page asks community_member), so the
// members-only cards and dates show their links too. petromin: the visitor holds the Petromin tag
// (petromin_member), for whom Petromin Days and its dates show theirs (the owner, 2026-10-12).
// featured: the Featured cards in order, each naming one of `events` and one of its dates (lib/event-info.ts featuredDates).
type Props = { locale: string; events: StepEvent[]; featured?: { ev: string; id: string }[]; prices: { type: string; label: string; price: string }[]; bookHref: string; clubHref: string; member: boolean; petromin: boolean; text: StepText };
type Fact = { k: string; v: ReactNode };

/** The DEFE 5KM Run's logo: the ribbon woven into دفء, in Defe's rose (assets/defe-logo.svg in the booking app). */
const DEFE_LOGO = "/site/defe-logo.svg";
/** The awareness ribbon (the booking app's _PTN_RIBBON), drawn in the text's colour. */
const Ribbon = () => (
  <svg className="xs-rb" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 21L14.7 9.2c.9-1.5 1-2.7.6-3.8a3.5 3.5 0 0 0-6.6 0c-.4 1.1-.3 2.3.6 3.8l1.4 2.2" /><path d="M13.1 13.6L17 21" />
  </svg>
);
/** The low sun rising from yoga's card's far corner, three breaths around it (the booking app's _ygScene): drawn, never a
 *  picture, so it takes the card's colours. */
const YogaScene = () => (
  <svg className="sc-yg-scene" aria-hidden="true" focusable="false" viewBox="0 0 160 80">
    <circle className="sc-yg-ring" cx="80" cy="80" r="76" /><circle className="sc-yg-ring" cx="80" cy="80" r="58" /><circle className="sc-yg-ring" cx="80" cy="80" r="41" /><circle className="sc-yg-sun" cx="80" cy="80" r="25" />
  </svg>
);
/** Featured's star (the booking app's _cuIc star), drawn in the text's colour on its neon disc. */
const FeatStar = () => (
  <span className="xs-star" aria-hidden="true">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path d="M12 3.6l2.55 5.2 5.75.84-4.16 4.05.98 5.72L12 16.7l-5.12 2.7.98-5.72L3.7 9.64l5.75-.84z" />
    </svg>
  </span>
);
/** A short rule's tick (the booking app's _cuIc tick). */
const Tick = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
/** The hosts' marks on their white plate: a span, as it also stands inside the card's button. */
const Plate = ({ b }: { b: StepBlood }) => (
  <span className="bld-plate"><img src={b.plate.src} alt={b.plate.alt} width={b.plate.width} height={b.plate.height} decoding="async" /></span>
);

export default function ExperienceSteps({ locale, events, featured, prices, bookHref, clubHref, member, petromin, text: t }: Props) {
  const [step, setStep] = useState(1);
  const [ev, setEv] = useState<StepEvent | null>(null);
  const [sess, setSess] = useState<StepSession | null>(null);
  // The kind picked on the date step's switch (null: All). It narrows the rows alone: a date already chosen stays chosen.
  const [kind, setKind] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  // The dialog: an event's About (s null), or one of its dates' Details. It opens once its words are
  // drawn and its title takes the focus; Escape, Close or a tap outside closes it, and the focus goes
  // back to the link that opened it.
  const [info, setInfo] = useState<{ ev: StepEvent; s: StepSession | null } | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [posterLang, setPosterLang] = useState<"ar" | "en">(locale === "ar" ? "ar" : "en"); // the poster is in these two; every other language (Urdu too, RTL as it is) reads the English
  const rtl = isRtl(locale);
  // The browser's clock, read once the page is up and then at each minute, while the dates are shown and one of them is
  // not open yet: its countdown follows the real booking window (StepSession.opensAt), never a timer of its own. Before
  // that the card says what the server said, so the first drawing matches the server's.
  const [nowMs, setNowMs] = useState<number | null>(null);
  // The Featured cards: each a date of one of the cards below, found there, so none stands for a date its event does
  // not list.
  const feats = (featured ?? []).flatMap((f) => {
    const e = events.find((x) => x.key === f.ev), s = e?.sessions.find((x) => x.id === f.id);
    return e && s?.feat ? [{ e, s, feat: s.feat }] : [];
  });
  // The chosen event's kinds (two or more offer the switch) and the dates the kind picked leaves (lib/kind-theme.ts): the
  // switch narrows the dates first, as the booking app's renderRegister does.
  const kinds = ev ? kindsInOrder(ev.sessions) : [];
  const picked = kinds.length > 1 && kind && kinds.includes(kind) ? kind : null;
  const rows = ev ? rowsOfKind(ev.sessions, picked) : [];
  // Those dates as the list shows them: the featured ones first, then the rest; as given when none is.
  const dates = featuredFirst(rows, (s) => !!s.feat);
  const listed = [...dates.featured, ...dates.rest];
  const ticking = (step === 2 && !!ev?.sessions.some((s) => s.opensAt != null)) || (step === 1 && feats.some((f) => f.s.opensAt != null));
  useEffect(() => {
    if (!ticking) return;
    let h = 0;
    const tick = () => { setNowMs(Date.now()); h = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 50); };
    h = window.setTimeout(tick, 0);
    const back = () => { if (document.visibilityState === "visible") { window.clearTimeout(h); tick(); } };
    document.addEventListener("visibilitychange", back);
    return () => { window.clearTimeout(h); document.removeEventListener("visibilitychange", back); };
  }, [ticking]);
  /** When a date opens, as its card says it now: the countdown within a day, null once the window has opened. */
  const opensOf = (s: StepSession): string | null => {
    if (!s.opens) return null;
    return opensLine(s.opens, s.opensAt, nowMs, t.opensIn);
  };
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
      // the step's first heading: Featured, where the first step starts with it
      top.current?.querySelector<HTMLElement>(".xs-feat-h, .xs-title")?.focus({ preventScroll: true });
    });
  };
  // What a card does, and what its dialog's button does too.
  const pickEvent = (e: StepEvent) => { setEv(e); setSess(null); setKind(null); go(2); };
  const pickDate = (s: StepSession) => { setSess(s); go(3); };
  // A Featured card goes through its event and on to its date, as choosing the event's card and then the date would, so
  // the last step says and asks what it does that way (the Members note, a session for the other gender, where its
  // button hands over). A date not open to book yet cannot be chosen there either: its event's dates open instead.
  const pickFeat = (e: StepEvent, s: StepSession) => {
    setEv(e);
    if (opensOf(s)) { setSess(null); go(2); } else { setSess(s); go(3); }
  };
  const arrow = <ArrowIcon size={15} />;
  const arrow18 = <ArrowIcon size={18} />;
  const back = <BackIcon size={15} />;
  // The times in their own direction (a <bdi> with none forced): an Arabic clock ("9:00 م") read right
  // to left, a Latin one ("9:00 PM") left to right. Forcing ltr turned an Arabic range into
  // "م – 11:00 م 9:00" (2026-10-05).
  // A date with a start time alone (the DEFE 5KM Run) says that time once.
  const when = (s: StepSession) => (s.when ? (s.when.gather
    ? <>{t.gather} <bdi>{s.when.a}</bdi> · {t.start} <bdi>{s.when.b}</bdi></>
    : <bdi>{s.when.b ? `${s.when.a} – ${s.when.b}` : s.when.a}</bdi>) : null);
  // Petromin Days is Petromin's team's, who are not Club members (an account holds the Community tag or
  // the Petromin tag, never both): its dates carry no Members tag and no word about joining the Club.
  // Nor do Victory Lap's, which its tag holders book too (its rules say who, vlNote).
  const clubOnly = (s: StepSession) => s.members && ev?.key !== "petromin" && s.kind !== "vlap";
  const noBike = (s: StepSession) => isNonBike(s.kind, s.id);
  // men only, women only or mixed: the booking app's .sg-chip
  const chip = (s: StepSession) => (s.sg ? <span className={`sg-chip sg-${s.sg.cls}`}>{s.sg.label}</span> : null);
  // What a card says of a date's places: when it opens, a clock beside it so the grey is never the only sign (WCAG
  // 1.4.1); the waitlist once it is full; how many are left at three or fewer; null with nothing to say.
  const stateOf = (s: StepSession) => {
    const opens = opensOf(s);
    return opens ? <span className="sc-spots closed"><ClockIcon size={13} /><span>{opens}</span></span> : s.full ? <span className="sc-spots full">{t.waitlisted}</span>
      : s.kind !== "vlap" && s.kind !== "arena" && s.left != null && s.left > 0 && s.left <= 3 ? <span className="sc-spots low">{fillAt(s.left === 1 ? t.left1 : t.leftN, s.left)}</span>
      : null;
  };
  const tags = (s: StepSession) => (
    <span className="xs-tags">
      {chip(s)}
      {clubOnly(s) && <em>{t.members}</em>}
      {s.event && !s.members && <em>{t.everyone}</em>}
      {s.free && <em>{t.free}</em>}
      {s.full && <em className="warn">{t.full}</em>}
    </span>
  );
  // "Breakfast at {name}", the name where the language puts it and in its own direction (a <bdi>): a
  // stop named in English reads right on an Arabic page, and an Arabic name on any other.
  const breakfastAt = (name: string) => {
    const [a, b = ""] = t.breakfastAt.split("{0}");
    return <>{a}<bdi>{name}</bdi>{b}</>;
  };
  // An event's seat price and seats, on its card and in the summary.
  const facts = (s: StepSession) => (s.event && (s.seatPrice || s.seats) ? (
    <span className="sc-facts">
      {s.seatPrice && <span>{fill(t.perSeat, { price: s.seatPrice })}</span>}
      {s.seats && <span>{fill(t.seats, { n: s.seats })}</span>}
    </span>
  ) : null);
  // The community rides and the events are named by their own title, the fixed events by the card's.
  const named = (e: StepEvent) => e.key === "community" || e.key === "event";
  // The date step's title: Choose a date where the dates the kind switch leaves mix rides with sessions without a bike
  // (the booking app's _mixList), else the page's own.
  const dateTitle = rows.some(noBike) && !rows.every(noBike) ? t.chooseDate : t.dateTitle;
  // The Experiences card's link and its dialog say About and See dates: it stands for several kinds of session.
  const aboutWord = (e: StepEvent) => (e.key === "community" ? t.info.aboutShort : t.info.about);
  // A date's facts in the dialog (the booking app's _infoFacts); `next` says it as its event's next date.
  const infoFacts = (s: StepSession, next: boolean): Fact[] => {
    const i = s.info;
    const out: Fact[] = [{ k: t.info.who, v: <>{i.who}{s.sg && <>{i.who && " "}{chip(s)}</>}</> }];
    if (i.price) out.push({ k: t.info.price, v: <bdi>{i.price}</bdi> });
    out.push({ k: next ? t.info.next : t.info.when, v: <>{s.day}{s.when && <><br />{when(s)}</>}{i.collect && <><br />{i.collect}</>}{i.whenNote && <><br />{i.whenNote}</>}</> });
    if (i.sunrise && !next) out.push({ k: t.info.sunrise, v: <bdi>{i.sunrise}</bdi> }); // the Saturday ride's sunrise
    out.push({ k: t.info.where, v: <>{i.place}{i.map && <> · <a href={i.map} target="_blank" rel="noopener">{t.info.map}</a></>}</> });
    if (i.distance) out.push({ k: t.info.distance, v: <bdi>{i.distance}</bdi> });
    for (const m of i.more ?? []) out.push({ k: m.k, v: m.v });
    if (i.format) out.push({ k: t.info.format, v: i.format });
    if (i.races) out.push({ k: t.info.races, v: i.races });
    if (i.divs) out.push({ k: t.info.divs, v: <><bdi>{i.divs}</bdi>{i.guide?.map((g, n) => <span key={n} className="xs-ah-div"><strong><bdi>{g.name}</bdi> · {g.level}</strong>{g.text}</span>)}</> });
    if (i.kit) out.push({ k: i.kit.label, v: <bdi>{i.kit.text}</bdi> });
    if (i.race) out.push({ k: i.race.label, v: <a href={i.race.url} target="_blank" rel="noopener">{i.race.link}</a> });
    if (i.link) out.push({ k: i.link.label, v: <a href={i.link.url} target="_blank" rel="noopener">{i.link.text}</a> });
    if (i.places) out.push({ k: t.info.places, v: i.places });
    if (s.breakfast) out.push({ k: t.info.after, v: breakfastAt(s.breakfast) });
    else if (s.reveal) out.push({ k: t.info.after, v: s.reveal }); // the breakfast spot is told later: when
    return out;
  };
  // An event's About lists its next date's facts; the community rides' card, which stands for several
  // kinds of ride, says only who may book them and which ride is next - never one ride's price.
  const eventFacts = (e: StepEvent): Fact[] => {
    const s = e.sessions[0];
    if (!s) return [];
    if (e.key === "community") return [{ k: t.info.who, v: t.info.whoMembers }, { k: t.info.next, v: <>{s.name}{s.sg && <> {chip(s)}</>} · {s.day}{s.when && <><br />{when(s)}</>}</> }];
    return infoFacts(s, true);
  };
  // What the dialog says, and its button's words: the card's own step, which a date not open to book
  // yet does not offer ("").
  const poster = info?.ev.blood ?? null;
  const sheet = info && (poster
    // the Blood Donation event's About and Details are its poster (the booking app's _bldInfoView), its facts on the card
    ? { kind: "blood", kick: info.s ? info.s.day : t.info.about, title: poster.info.title, text: "", extra: null, facts: [], act: info.s ? (opensOf(info.s) ? "" : t.info.chooseDate) : t.info.bookEvent, art: false, route: null }
    : info.s
    // a date's Details: its kind's drawing across the top, and the Saturday ride's routes above the facts
    ? { kind: info.s.kind, kick: info.s.name, title: info.s.day, text: info.s.info.text, extra: info.s.info.extra, facts: infoFacts(info.s, false), act: opensOf(info.s) ? "" : t.info.chooseDate, art: hasKindArt(info.s.kind), route: info.s.info.route ?? null }
    : { kind: info.ev.sessions[0]?.kind ?? info.ev.key, kick: aboutWord(info.ev), title: info.ev.title, text: info.ev.about, extra: null, facts: eventFacts(info.ev), act: info.ev.key === "community" ? t.info.seeDates : t.info.bookEvent, art: false, route: null });
  // The dialog's button does what the card does. The link that opened the dialog goes with its step,
  // so the focus goes on to the next step's heading (go) rather than back to it.
  const take = () => {
    if (!info) return;
    opener.current = null;
    dlg.current?.close();
    if (info.s) pickDate(info.s);
    else pickEvent(info.ev);
  };
  // Petromin Days hands over ev=petromin, which the booking app opens under its own Petromin Days. A Saturday ride
  // booked with a ride code goes to its own page (micromobility.sa/saturday) instead.
  const link = ev && sess ? sess.satLink || bookingAt(bookHref, ev.key, sess.id) : bookHref;

  return (
    <div className="xs" ref={top}>
      <ol className="xs-bar" aria-label={t.steps.join(" · ")}>
        {t.steps.map((label, i) => {
          const n = i + 1, done = step > n, cur = step === n;
          return (
            <li key={n} className={done ? "done" : cur ? "cur" : ""} aria-current={cur ? "step" : undefined}>
              <span className="xs-dot">{done ? <TickIcon size={14} /> : n}</span><span className="xs-lbl">{label}</span>
            </li>
          );
        })}
      </ol>

      {step === 1 && feats.length > 0 && (
        <section className="xs-feat" aria-labelledby="xs-feat-h">
          <h2 id="xs-feat-h" className="xs-feat-h" tabIndex={-1}><FeatStar /><span>{t.featured}</span></h2>
          <div className={`xs-feat-grid${feats.length > 1 ? " xs-feat-rail" : ""}`}>
            {feats.map(({ e, s, feat }) => {
              const foot = s.yoga ? s.yoga.with : s.info.price;
              return (
                <button key={s.id} type="button" className={`xs-feat-card ev-${s.kind}${s.yoga ? " xs-feat-yg" : ""}`} onClick={() => pickFeat(e, s)}>
                  {s.yoga && <YogaScene />}
                  <span className="xs-feat-day"><span className="xs-feat-wd">{feat.wd}</span><b>{feat.dn}</b><span>{feat.mo}</span></span>
                  <span className="xs-feat-copy">
                    <span className={`xs-feat-name${s.yoga ? " sc-yg-title" : ""}`}>{s.name}</span>
                    {/* a rule before each part, cut where a line starts (.xs-feat-meta), so none starts or ends a line; a
                        ride that gathers says its gathering and its start as two parts */}
                    <span className="xs-feat-meta">
                      <span className="xs-feat-mi">
                        {s.near && <span><strong className="sc-dw">{s.near}</strong></span>}
                        {s.when && (s.when.gather
                          ? <><span>{t.gather} <bdi>{s.when.a}</bdi></span><span>{t.start} <bdi>{s.when.b}</bdi></span></>
                          : <span><bdi>{s.when.b ? `${s.when.a} – ${s.when.b}` : s.when.a}</bdi></span>)}
                        {feat.len && <span><bdi>{feat.len}</bdi></span>}
                      </span>
                    </span>
                    <span className="xs-feat-foot">
                      <span className="xs-feat-meta">
                        <span className="xs-feat-mi">
                          {s.info.place && <span><bdi>{s.info.place}</bdi></span>}
                          {foot && <span className={s.yoga ? "xs-feat-with" : undefined}><bdi>{foot}</bdi></span>}
                        </span>
                      </span>
                      {stateOf(s)}
                    </span>
                  </span>
                  <span className="xs-feat-go" aria-hidden="true">{arrow18}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 1 && (
        <section aria-labelledby="xs-h1">
          <h2 id="xs-h1" className="xs-title" tabIndex={-1}>{t.eventTitle}</h2>
          <div className="xs-events">
            {events.map((e) => {
              const about = infoShown(membersOnlyEvent(e.key), memberOn(e.key, { member, petromin }));
              return (
                <div key={e.key} className={`xs-ev-wrap${about ? " has-about" : ""}`}>
                  {e.key === "vlap" ? (
                    // Victory Lap (the owner picked D for the booking app, 2026-10-17): white, the race's logo
                    // (named by its title), its line, its date, doors and place, a checkered flag down the end
                    // edge - never the price
                    <button type="button" className="xs-event ev-vlap" onClick={() => pickEvent(e)}>
                      <span className="xs-vl-main">
                        {e.logo ? <span className="xs-logo xs-vl-logo"><img src={e.logo} alt={e.title} /></span> : <span className="xs-ev-title">{e.title}</span>}
                        <span className="xs-copy">
                          {e.meta && <span className="xs-vl-title">{e.meta}</span>}
                          {e.line && e.line.length > 0 && <span className="xs-vl-meta">{e.line.map((x, i) => <span key={i}>{i > 0 && <i aria-hidden="true" />}<bdi>{x}</bdi></span>)}</span>}
                        </span>
                      </span>
                      <span className="xs-vl-flag" aria-hidden="true" />
                    </button>
                  ) : e.key === "arena" ? (
                    // Arena Heros (2026-10-29, the booking app's card): the organisers' logo over the red-lit hall (their
                    // wordmark "ARENA HEROS Competition" if staff empty the logo), its name in the poster's capitals, its
                    // date, hours and venue (a rule between two, none starting a line when the venue wraps), its line in
                    // red - never the price
                    <button type="button" className="xs-event ev-arena" onClick={() => pickEvent(e)}>
                      <span className="xs-ah-main">
                        {e.logo ? <span className="xs-logo xs-ah-logo"><img src={e.logo} alt={e.title} /></span> : <span className="xs-ah-mark" role="img" aria-label={e.title}><b>Arena Heros</b><i>Competition</i></span>}
                        <span className="xs-copy">
                          {e.name && <span className="xs-ah-name">{e.name}</span>}
                          {e.line && e.line.length > 0 && <span className="xs-ah-meta"><span className="xs-ah-mi">{e.line.map((x, i) => <span key={i}><bdi>{x}</bdi></span>)}</span></span>}
                          {e.meta && <span className="xs-ah-title">{e.meta}</span>}
                          {e.must && <span className="xs-ah-must">{e.must}</span>}
                        </span>
                      </span>
                    </button>
                  ) : e.blood ? (
                    // The Blood Donation event (2026-11-03, the booking app's _bldCardWrap): an ordinary card's padding, so its
                    // height and About link line up with its neighbours; a button holds phrasing content alone, hence the spans
                    <button type="button" className="xs-event ev-blood" onClick={() => pickEvent(e)}>
                      <img className="xs-bld-pic" src={e.blood.picture.src} alt="" width={e.blood.picture.width} height={e.blood.picture.height} loading="lazy" decoding="async" />
                      <Plate b={e.blood} />
                      <span className="xs-copy">
                        <span className="xs-ev-title">{e.title}</span>
                        {e.line && e.line.length > 0 && <span className="xs-ev-meta">{e.line.map((x, i) => <span key={i}>{i > 0 && " · "}<bdi>{x}</bdi></span>)}</span>}
                      </span>
                      <span className="xs-bld-tiles" aria-hidden="true">{e.blood.types.map((x, i) => <span key={x} className={`xs-bld-ti${(i + (i > 3 ? 1 : 0)) % 2 === 0 ? " on" : ""}`}>{x}</span>)}</span>
                      <span className="xs-bld-cause">{e.blood.line} {e.blood.cause}</span>
                    </button>
                  ) : e.key === "community" ? (
                    // MicroMobility Experiences (the owner's picks Q1 c, Q2 c, 2026-11-13): the brand pattern, no lockup, its
                    // name and line, and a mark for each kind it has dates for, on its tint, named for a screen reader
                    <button type="button" className="xs-event ev-community" onClick={() => pickEvent(e)}>
                      <span className="xs-copy">
                        <span className="xs-ev-title">{e.title}</span>{e.meta && <span className="xs-ev-meta">{e.meta}</span>}
                        {e.marks && <span className="xs-marks" role="img" aria-label={e.marks.label}>{e.marks.kinds.map((k) => <span key={k} className={`xs-mk ev-${k}`}><KindIcon kind={k} size={18} /></span>)}</span>}
                      </span>
                    </button>
                  ) : (
                    <button type="button" className={`xs-event ev-${e.key}`} onClick={() => pickEvent(e)}>
                      {e.logo && <span className="xs-logo"><img src={e.logo} alt="" /></span>}
                      <span className="xs-copy"><span className="xs-ev-title">{e.title}</span>{e.meta && <span className="xs-ev-meta">{e.meta}</span>}</span>
                    </button>
                  )}
                  {about && <button type="button" className={`xs-about ab-${e.key}`} aria-label={`${aboutWord(e)} · ${e.title}`} onClick={(x) => showInfo(e, null, x.currentTarget)}>{aboutWord(e)}</button>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && ev && (
        <section aria-labelledby="xs-h2">
          <button type="button" className="xs-back" onClick={() => go(1)}><span aria-hidden="true">{back}</span> {t.back}</button>
          {ev.key === "community" ? (
            // the Experiences list's heading in its card's pattern, under the card's name (the owner's pick B1)
            <div className="xs-band"><p className="xs-band-k">{ev.title}</p><h2 id="xs-h2" className="xs-title" tabIndex={-1}>{dateTitle}</h2></div>
          ) : (
            <>
              <p className="xs-picked">{ev.title}</p>
              <h2 id="xs-h2" className="xs-title" tabIndex={-1}>{dateTitle}</h2>
            </>
          )}
          {/* All, then each kind (the owner's pick B5): the one picked in ink */}
          {kinds.length > 1 && (
            <div className="xs-kinds" role="group" aria-label={t.kinds.show}>
              {[null, ...kinds].map((k) => (
                <button key={k ?? ""} type="button" className={`xs-kind${k ? ` ev-${k}` : ""}`} aria-pressed={picked === k} onClick={() => setKind(k)}>
                  {k && <KindIcon kind={k} size={15} />}<span>{k ? t.kinds.names[k] ?? k : t.kinds.all}</span>
                </button>
              ))}
            </div>
          )}
          {ev.sessions.length === 0 ? (
            <p className="xs-empty">{t.noDates}</p>
          ) : (
            // One date is chosen among them (the research's row 11): a radio group with one tab stop and the arrow keys,
            // which move the choice with the focus (nothing else happens until a date is tapped or Enter or Space pressed)
            <div className="sc-list" role="radiogroup" aria-labelledby="xs-h2"
              onKeyDown={(e) => { const id = radioKey(e, rtl)?.dataset.id; const s = id ? listed.find((x) => x.id === id) : undefined; if (s) setSess(s); }}>
              {listed.map((s, n) => {
                const details = infoShown(membersOnlyDate(s), memberOn(ev.key, { member, petromin }));
                const opens = opensOf(s);
                const spots = stateOf(s) ?? <span className="sc-spots">{t.available}</span>;
                // "Featured" over the featured dates, which come first, and "Upcoming" over the rest; none when nothing is
                // featured, and no second one when every date is
                const head = dates.featured.length === 0 ? null
                  : n === 0 ? <h3 className="xs-sec-h"><FeatStar /><span>{t.featured}</span></h3>
                  : n === dates.featured.length ? <h3 className="xs-sec-h xs-sec-rest">{t.upcoming}</h3> : null;
                // the radio's own attributes: checked when it is the date chosen, the group's one tab stop (the first date
                // on the page that may be chosen)
                const stop = tabStop(listed, (x) => sess?.id === x.id, (x) => !opensOf(x));
                const radio = { role: "radio", "aria-checked": sess?.id === s.id, tabIndex: n === stop ? 0 : -1, "data-id": s.id, disabled: !!opens, "aria-disabled": !!opens } as const;
                // its Details: the booking app's "i", 44px, beside the card and never inside it, named for the event and the date
                const about = details && (
                  <button type="button" className="sc-about" aria-haspopup="dialog" aria-label={`${t.info.details} · ${named(ev) ? s.name : ev.title} · ${s.day}`} onClick={(x) => showInfo(ev, s, x.currentTarget)}>
                    <InfoIcon size={20} />
                  </button>
                );
                // Yoga's own card (the booking app's _ygSessCard, 2026-11-12): cream, the low sun rising from the far corner,
                // the mark, its name, when, how long and where, and who leads it along the foot with its state
                if (s.yoga) return (
                  <Fragment key={s.id}>{head}<div className={`sc-wrap ev-${s.kind}${details ? " has-about" : ""}`}>
                    <button type="button" className={`sc-card sc-yoga ev-${s.kind}${s.full ? " full" : ""}${opens ? " closed" : ""}`} {...radio} onClick={() => pickDate(s)}>
                      <YogaScene />
                      <span className="sc-yg-top"><span className="sc-dot" aria-hidden="true" /><img className="sc-yg-mark" src={YOGA_MARK} alt="" width={YOGA_MARK_SIZE.width} height={YOGA_MARK_SIZE.height} decoding="async" /></span>
                      <span className="sc-yg-title">{s.name}</span>
                      {s.sg && <span className="sc-kicker">{chip(s)}</span>}
                      <span className="sc-date">{s.near && <><strong className="sc-dw">{s.near}</strong> · </>}{s.day}</span>
                      <span className="sc-yg-meta">{s.yoga.meta.map((x, i) => <span key={i}>{i > 0 && <i aria-hidden="true" />}<bdi>{x}</bdi></span>)}</span>
                      <span className="sc-yg-foot"><span className="sc-yg-with">{s.yoga.with}</span>{spots}</span>
                    </button>
                    {about}
                  </div></Fragment>
                );
                // The DEFE 5KM Run's own card (the booking app's _defeSessCard, 2026-10-18): white with Defe's
                // pink washed in from the far corner, the logo, the race's name, when, how far and where, the
                // cause along the foot with its state
                if (s.defe) return (
                  <Fragment key={s.id}>{head}<div className={`sc-wrap ev-${s.kind}${details ? " has-about" : ""}`}>
                    <button type="button" className={`sc-card sc-defe ev-${s.kind}${s.full ? " full" : ""}${opens ? " closed" : ""}`} {...radio} onClick={() => pickDate(s)}>
                      <span className="sc-defe-top"><span className="sc-dot" aria-hidden="true" /><img className="sc-defe-logo" src={DEFE_LOGO} alt="" width={977} height={660} decoding="async" /></span>
                      <span className="sc-defe-title">{s.name}</span>
                      {s.sg && <span className="sc-kicker">{chip(s)}</span>}
                      <span className="sc-date">{s.near && <><strong className="sc-dw">{s.near}</strong> · </>}{s.day}</span>
                      <span className="sc-defe-meta">{s.defe.meta.map((x, i) => <span key={i}>{i > 0 && <i aria-hidden="true" />}<bdi>{x}</bdi></span>)}</span>
                      <span className="sc-defe-foot"><span className="sc-defe-cause"><Ribbon /><span>{s.defe.cause}</span></span>{spots}</span>
                    </button>
                    {about}
                  </div></Fragment>
                );
                return (
                  <Fragment key={s.id}>{head}<div className={`sc-wrap ev-${s.kind}${details ? " has-about" : ""}`}>
                    <button type="button" className={`sc-card ev-${s.kind}${s.full ? " full" : ""}${opens ? " closed" : ""}${hasKindArt(s.kind) ? " has-motif" : ""}`} {...radio} onClick={() => pickDate(s)}>
                      {(named(ev) || clubOnly(s) || s.free || s.sg) && (
                        <span className="sc-kicker">
                          {/* the kind's mark on its tint, then the name (the owner's pick B2) */}
                          {named(ev) && <span className="sc-chip has-ic"><span className="k-tile"><KindIcon kind={s.kind} size={16} /></span>{s.name}</span>}
                          {chip(s)}
                          {clubOnly(s) && <span className="sc-tag">{t.members}</span>}
                          {s.event && !s.members && <span className="sc-tag">{t.everyone}</span>}
                          {s.free && <span className="sc-tag">{t.free}</span>}
                        </span>
                      )}
                      <span className="sc-head">
                        <span className="sc-dot" aria-hidden="true" />
                        <span className="sc-date">{s.near && <><strong className="sc-dw">{s.near}</strong> · </>}{s.day}</span>
                        {spots}
                      </span>
                      {s.when && <span className="sc-time">{when(s)}</span>}
                      {s.meta && s.meta.length > 0 && <span className="sc-meta">{s.meta.map((x, i) => <span key={i}>{i > 0 && " · "}<bdi>{x}</bdi></span>)}</span>}
                      {s.route && <span className="sc-time">{t.route}: {s.route}</span>}
                      {s.breakfast && <span className="sc-meta">{breakfastAt(s.breakfast)}</span>}
                      {s.reveal && <span className="sc-meta">{s.reveal}</span>}
                      {s.event && s.description && <span className="sc-desc">{s.description}</span>}
                      {facts(s)}
                      {/* the kind's motif along the foot: the Saturday ride's dawn band, the pool's water, Petromin's stripes */}
                      {hasKindArt(s.kind) && <span className="k-art sc-motif" aria-hidden="true" />}
                    </button>
                    {about}
                  </div></Fragment>
                );
              })}
            </div>
          )}
          {ev.sessions.some(clubOnly) && <p className="xs-note">{ev.sessions.some((s) => clubOnly(s) && noBike(s)) ? t.membersNoteNb : t.membersNote}{clubHref && <> <a href={clubHref}>{t.clubLink} {arrow}</a></>}</p>}
        </section>
      )}

      {step === 3 && ev && sess && (
        <section aria-labelledby="xs-h3">
          <button type="button" className="xs-back" onClick={() => go(2)}><span aria-hidden="true">{back}</span> {t.back}</button>
          <h2 id="xs-h3" className="xs-title" tabIndex={-1}>{noBike(sess) ? t.bookTitleNb : t.bookTitle}</h2>
          <div className="xs-summary">
            {ev.blood && <Plate b={ev.blood} />}
            <div className="xs-sum-head">
              {sess.defe ? <span className="xs-logo small xs-defe-logo"><img src={DEFE_LOGO} alt="" /></span>
                : sess.yoga ? <span className="xs-logo small xs-yoga-logo"><img src={YOGA_MARK} alt="" width={YOGA_MARK_SIZE.width} height={YOGA_MARK_SIZE.height} /></span>
                : ev.logo && <span className="xs-logo small"><img src={ev.logo} alt="" /></span>}
              <div><strong className={sess.yoga ? "xs-yg-name" : undefined}>{named(ev) ? sess.name : ev.title}</strong><span>{sess.day}{sess.when ? <> · {when(sess)}</> : null}{sess.route ? <> · {t.route}: {sess.route}</> : null}{sess.routeKm ? <> · {sess.route ? "" : <>{t.route}: </>}{sess.routeKm}</> : null}{sess.breakfast ? <> · {breakfastAt(sess.breakfast)}</> : null}</span></div>
            </div>
            {tags(sess)}
            {sess.defe && <p className="xs-defe-cause"><Ribbon /><span>{sess.defe.cause}</span></p>}
            {sess.yoga && <p className="xs-yg-with">{sess.yoga.with}</p>}
            {ev.blood && <p className="xs-bld-cause">{ev.blood.cause}</p>}
            {ev.blood && <ul className="bld-sum">{ev.blood.rules.map((x, i) => <li key={i}><Tick /><span>{x}</span></li>)}</ul>}
            {sess.event && sess.description && <p className="xs-rules">{sess.description}</p>}
            {facts(sess)}
            {/* Victory Lap's and Arena Heros' price per athlete, to a visitor who may book it alone (its Details' price) */}
            {(sess.kind === "vlap" || sess.kind === "arena") && sess.info.price && <p className="xs-rules xs-vl-price"><bdi>{sess.info.price}</bdi></p>}
            {sess.payNote && <p className="xs-rules">{sess.payNote}</p>}
            {/* the community card's rules speak of riders and the ride: not on its pool session or the DEFE run */}
            {ev.note && !(ev.key === "community" && noBike(sess)) && <p className="xs-rules">{ev.note}</p>}
            {sess.paid && !sess.event && prices.some((p) => typeOffered(sess, p.type)) && (
              <div className="xs-prices">
                <p className="xs-prices-h">{t.pricesTitle}</p>
                {t.pricesText && <p className="xs-prices-t">{t.pricesText}</p>}
                <div>{prices.filter((p) => typeOffered(sess, p.type)).map((p) => <span key={p.label}><span>{p.label}</span><strong>{p.price}</strong></span>)}</div>
                {t.codeNote && <p className="xs-prices-t">{t.codeNote}</p>}
              </div>
            )}
            {clubOnly(sess) && <p className="xs-note">{noBike(sess) ? t.membersNoteNb : t.membersNote}{clubHref && <> <a href={clubHref}>{t.clubLink} {arrow}</a></>}</p>}
          </div>
          {sess.refusal ? (
            // a session for the other gender (the owner, 2026-10-27): no hand-over, as the booking app refuses it too
            <p className="xs-refuse" role="alert">{sess.refusal}</p>
          ) : (
            <>
              <a className={`xs-go${ev.blood ? " ev-blood" : sess.yoga ? " ev-yoga" : ""}`} href={link}>{sess.full ? t.waitlist : t.cont} <span aria-hidden="true">{arrow}</span></a>
              {/* one place per account, so never "add the participants" on the Blood Donation event, nor on yoga (the booking
                  app's _noGroupAdd) */}
              {!ev.blood && !sess.yoga && (noBike(sess) ? t.handoffNb : t.handoff) && <p className="xs-handoff">{noBike(sess) ? t.handoffNb : t.handoff}</p>}
            </>
          )}
        </section>
      )}

      <dialog ref={dlg} className={`xs-info${sheet ? ` ev-${sheet.kind}` : ""}${sheet?.art ? " has-art" : ""}`} aria-labelledby="xs-info-h"
        onClose={() => { setInfo(null); opener.current?.focus({ preventScroll: true }); opener.current = null; }}
        onClick={(x) => { if (x.target === x.currentTarget) dlg.current?.close(); }}>
        {sheet?.art && <span className="k-art xs-info-art" aria-hidden="true" />}
        {sheet && (
          <div className="xs-info-in">
            <p className="xs-info-kick">{sheet.kick}</p>
            <h2 id="xs-info-h" className="xs-info-title" tabIndex={-1} ref={head}>{sheet.title}</h2>
            {sheet.text && <p className="xs-info-text">{sheet.text}</p>}
            {sheet.extra && <p className="xs-info-extra" dir="auto">{sheet.extra}</p>}
            {sheet.route && <SatRoute w={sheet.route} rtl={rtl} />}
            {sheet.facts.length > 0 && <dl className="xs-info-facts">{sheet.facts.map((f) => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></div>)}</dl>}
            {poster && (
              <>
                <Plate b={poster} />
                <div className="xs-bld-lang" role="group" aria-label={poster.info.language}>
                  {(["ar", "en"] as const).map((l) => <button key={l} type="button" lang={l} aria-pressed={posterLang === l} onClick={() => setPosterLang(l)}>{l === "ar" ? "العربية" : "English"}</button>)}
                </div>
                <div className="xs-bld-poster" dir={posterLang === "ar" ? "rtl" : "ltr"} lang={posterLang}>
                  {poster.info.poster[posterLang].sections.map((x, i) => (
                    <details key={`${posterLang}-${i}`} className="xs-bld-sec" open={i < 3}>
                      <summary>{x.h}</summary>
                      {x.p && <p>{x.p}</p>}
                      {x.i && <ol>{x.i.map((y, j) => <li key={j}>{y}</li>)}</ol>}
                    </details>
                  ))}
                  <p className="xs-bld-src">{poster.info.poster[posterLang].source}</p>
                </div>
                <a className="xs-bld-pdf" href={poster.info.pdf.url} target="_blank" rel="noopener">{poster.info.pdf.label}</a>
              </>
            )}
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
