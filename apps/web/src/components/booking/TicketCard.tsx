import Qr from "./Qr";
import Countdown from "./Countdown";
import RaceRegQuestion from "./RaceRegQuestion";
import VlTicket from "./VlTicket";
import WalletButton from "@/components/account/WalletButton";
import type { T } from "./tickets.text";
import { intlOf } from "@/i18n/locales";
import { fill } from "@/lib/fill";
import { VL_DIV_KM, vlDivName, vlIsDbl } from "@/lib/vlap";
import { ahDivName, ahPayLine } from "@/lib/arena";
import { vlBankWords, vlTicketAmount, vlTicketView } from "@/lib/vl-ticket";
import { timesText } from "@/lib/rides";
import { isNonBike } from "@/lib/bike-kinds";
import { genderChip } from "@/lib/session-gender";
import { DEFE_RACE_URL, raceRegAsked, addonLines, addonsCost, bookingRef, breakfastFor, cdLine, codeReady, countdownMoments, dayWord, fmtClock, icsFor, icsPlace, kmText, meetsAt, partnerPlace, meetHeld, queueNumbers, revealWhen, spotHeld, ticketLook, ticketStages, venueOf, venueText, type AddonItem, type Cue, type TicketRoute, type TicketRow, type TicketSession, satNumOk } from "@/lib/tickets";

// The booking app's ticket (renderBookingTicket), for My Account: the same card, the same rules.
// Its actions are the booking app's own - Edit, Reschedule and Cancel open it there - so the site
// never changes a booking behind its back. A Run for Her ticket (2026-10-05) says "Runner number",
// lists each runner's distance where a ride lists the bike type, and is never changed, only
// cancelled ("A run booking is never modified"). A Victory Lap ticket (2026-10-17) says "Athlete number",
// the race and division where a ride shows the bike type, the team's code and the partner (Doubles), the
// T-shirt and 5 km time, and "Do you already have a ticket, or would you like to buy one?" (VlTicket), on its own look (white, the race's logo, a
// checkered strip down the end edge: the booking app's th-vlap); its details change in the booking app.
// A DEFE 5KM Run ticket (2026-10-18) is a run's too - "Runner number", 5 km, cancel only - on Defe's own
// look (white with Defe's blush, its logo: the booking app's th-defe5k), with when the kits go out and the
// race starts, and "Have you registered for the race?" (RaceRegQuestion) while the place is still to run.
// A session for men only or women only, and a pool session open to both, says so on a chip under its time and
// place (the owner, 2026-10-27; lib/session-gender.ts).
// An Arena Heros ticket (2026-10-28; lib/arena.ts) says "Athlete number", the race (a team of 2 women or 2 men)
// and the division where a ride shows the bike type, the team's code and the partner, when the organiser's heat
// times come, and that how to pay will be announced; black with red where the night ticket is neon, the hall's lamps
// across its top and the organisers' logo, cut from their poster (2026-10-29, as the booking app's ticket). No wallet
// pass, no ticket question, never the booth; its details change in the booking
// app (Change details) and it is never edited or rescheduled here.
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
  /** The route the ride follows (ticketRoute): a Routes page item, or the circuit drawn; null for none. */
  route?: TicketRoute | null;
  /** The bike handed over tonight, by name, when the public key can see it. */
  bikeName?: string | null;
  /** A ride tonight that is over: the booking app's past card (no code, calendar, directions,
   *  Wallet or changes), with the night's steps and how long they rode. */
  past?: boolean;
  /** The server's clock when it drew the page (the countdown's first line). */
  now: number;
  /** The booking (and the party's rows) a Google Wallet pass is made for (WalletButton); null for none. */
  wallet?: { bookingId: string; groupIds: string[] } | null;
  /** The add-ons' items by id, their names and today's prices (lib/ticket-addons.ts); null when the
   *  inventory could not be read. */
  addonItems?: Map<string, AddonItem> | null;
  /** Victory Lap (and Arena Heros): each team booking's partner by first name, by booking id (customer_vl_teams);
   *  a booking without one has no partner named. */
  vlPartners?: Map<string, string> | null;
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

// The Jeddah Corniche Circuit, drawn from OpenStreetMap (© OpenStreetMap contributors, ODbL): the
// Formula 1 ways chained into one loop, simplified, north up, the start marked (the booking app's JCC_TRACK).
const JCC_TRACK = "M12.9 71.4 11 69.3 10.4 66.7 10.7 64.5 12.7 60.9 12.9 58.7 11.7 54.8 8.5 51.6 8.4 45.7 9.8 43.1 12.8 41.8 14 40.4 16.6 30.6 16.8 24.8 15.8 6.2 14.7 4.7 13.1 4 10.8 4.7 9.7 6.1 9.4 9.9 13.1 17.2 13.5 23.5 10.6 31 9.8 36.1 5.4 38.7 4.3 41.1 4.3 48 8.3 59.2 9.2 70.6 13.7 79.4 15 84.7 15.1 90.6 14.1 96.6 15 98.4 17.9 101.4 19.2 106.6 18.7 108.9 14.4 117.5 13.4 121.9 13.7 127.1 16.5 136.6 21.3 144.7 25.9 148.9 33.2 153.9 35 153.7 36.1 151.9 31.3 130.1 20.3 97.5 19.3 96.6 17.3 97.2 16.2 96.1 17.7 90 17.8 87.5 15.5 72.6Z";
const Tick = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);

const Clock = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6" /><path d="M12 7.4V12l3.2 2" /></svg>
);

const Again = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </svg>
);

export default function TicketCard({ locale, today, rows, session: s, name, cue, t, gather, start, typeName, links, route = null, wallet = null, bikeName = null, past = false, now, addonItems = null, vlPartners = null }: Props) {
  const primary = rows[0];
  const noNum = !s || s.approval; // a ride staff approve never shows its order (nor prices, nor edit)
  // ...except a Saturday ride's booking number once its list is out, to a rider on it (satNumOk, 2026-10-25)
  const satNum = satNumOk(rows, s);
  const hideNum = noNum && !satNum;
  const allWl = rows.every((r) => r.status === "waitlist");
  const num = hideNum ? name : queueNumbers(rows);
  const look = past ? "past" : ticketLook(rows, s); // dark when a place is held, paper otherwise (the booking app's tk-live)
  const onDay = primary.date === today;
  const dw = past ? null : dayWord(primary.date, today);
  // a Saturday ride or Run for Her whose breakfast spot is told later says when (spotHeld); held without its
  // meeting point's link, it still meets at a point, never the circuit (meetHeld); Run for Her at the Jeddah Yacht Club
  const held = !past && spotHeld(s, now);
  const venue = held && meetHeld(s, now) ? ({ kind: "meet" } as const) : venueOf(s);
  const big = num.length <= 4 ? "big" : num.length <= 9 ? "mid" : "small";
  // a session that did not load reads by its id: a kind without a bike never shows bike words (2026-10-18)
  const bikes = s ? s.bikes : !isNonBike(null, primary.sessionId);
  const run = s?.kind === "runher" || s?.kind === "defe5k"; // Run for Her, the DEFE 5KM Run: a runner's number, a distance, cancel only
  const defe = s?.kind === "defe5k";
  const vlap = s?.kind === "vlap"; // Victory Lap: an athlete's number, the race and team, how to pay
  const arena = s?.kind === "arena"; // Arena Heros: an athlete's number, the race, division and team, payment announced later
  const numLabel = run ? t.runnerNumber : vlap || arena ? t.athleteNumber : satNum ? t.bookingNumber : t.queueNumber;
  // The add-ons bought with the booking, each rider's under their name, and in the total, as the
  // booking app lists them (none on a ride staff approve). A line whose price is not known (the
  // inventory could not be read) is listed without it, and the total is left out: never a wrong one.
  const extras = s?.approval ? [] : addonLines(rows, addonItems);
  const extrasCost = addonsCost(extras);
  const total = rows.reduce((sum, r) => sum + r.price, 0) + (extrasCost ?? 0);
  const free = (!!s?.free || (noNum && total === 0)) && extras.length === 0;
  const ready = codeReady(rows, s);
  // Victory Lap and Arena Heros are not paid at the booth: their own lines say how (below)
  const owes = !allWl && !s?.approval && !vlap && !arena && rows.some((r) => !r.paid && r.price > 0);
  const canEdit = !past && rows.some((r) => r.status === "waiting" || r.status === "waitlist");
  const active = rows.some((r) => r.status === "active");
  const allDone = rows.length > 0 && rows.every((r) => r.status === "done");
  const handed = rows.some((r) => !!r.bikeId);
  // On the ride's day a held ticket (or tonight's finished ride) shows where the rider is.
  const night = onDay && (look === "live" || (past && allDone)) ? ticketStages(rows, bikes, bikeName, locale) : null;
  const stLabel = { booked: t.stBooked, in: t.stIn, bike: t.stBike, done: t.stDone };
  // Before the start on the ride's day: the countdown to bike collection (or the gathering), then the start.
  const cdT = { collect: t.cdCollect, gather: t.cdGather, start: t.cdStart, h: t.durH, hm: t.durHM, m: t.durM };
  const moments = look === "live" && onDay && !active ? countdownMoments(s, primary.date) : [];
  const dur = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? fill(t.durHM, { h, m }) : fill(t.durH, { h })) : fill(t.durM, { m }); };
  const minutes = rows.reduce((m, r) => Math.max(m, r.rideDuration ?? 0), 0);
  // Checked in is not yet on a bike: the hand-over gives it out after the check-in.
  const activeText = !bikes ? t.stIn : bikeName ? t.cueBike(bikeName) : handed ? t.stBike : t.cueNoBike;
  const d = new Date(`${primary.date}T00:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { ...o, timeZone: "UTC" }).format(d);
  const clock = (x: string) => fmtClock(x, locale);
  // a session with a start time alone (the DEFE 5KM Run's 7 PM) says it once
  const when = timesText(s?.times, !!s?.gathers, clock, { gather, start });
  const green = s?.times && s.gathers ? t.gatherAt(clock(s.times[0])) : s?.collect && bikes ? t.collectFrom(clock(s.collect)) : "";
  const ics = s ? icsFor(s, `${name} - ${f({ weekday: "long" })}`, icsPlace(s)) : "";
  // men only, women only or mixed (the booking app's _sgChip): none on a session that did not load
  const sg = s ? genderChip(s, { male: t.sgMale, female: t.sgFemale, mixed: t.sgMixed }) : null;
  const wl = primary.waitlistNum;

  return (
    <article className={`tk-card ev-${s?.kind ?? "jcc"}${look ? ` tk-${look}` : ""}${look === "live" && onDay ? " tk-today" : ""}`}>
      <div className="tk-head">
        <div className="tk-num-block">
          {/* The logo heads the number's column (the booking app's _tkLogo): white lettering on the dark card. */}
          {vlap
            ? <span className="tk-logo tk-logo-vl" aria-hidden="true"><img src="/site/victory-lap-dark.webp" alt="" decoding="async" /></span>
            : arena ? <span className="tk-logo tk-logo-ah" aria-hidden="true"><img src="/site/arena-heros-logo.webp" alt="" decoding="async" /></span>
            : defe ? <span className="tk-logo tk-logo-defe" aria-hidden="true"><img src="/site/defe-logo.svg" alt="" decoding="async" /></span>
            : <span className="tk-logo" aria-hidden="true"><img className="tk-logo-l" src="/site/logo-dark.webp" alt="" decoding="async" /><img className="tk-logo-d" src="/site/logo.webp" alt="" decoding="async" /></span>}
          {!hideNum && (allWl
            ? <p className="tk-label wl">{t.wlOnList}{wl ? <> · {t.wlLinePos(String(wl))}</> : ""}</p>
            : <p className="tk-label">{rows.length > 1 ? (rows.length === 2 ? (bikes ? t.bikes2 : t.party2) : (bikes ? t.bikesN : t.partyN)(String(rows.length))) : numLabel}</p>)}
          {/* a number reads left to right in every language: "#7 – #8" is never "#8 – #7" */}
          <p className={`tk-num ${big}`}>{hideNum ? num : <bdi dir="ltr">{num}</bdi>}</p>
          {allWl && !hideNum && <p className="tk-wl-note">{wl ? t.wlPos(String(wl)) : t.wlPosNoNum}</p>}
        </div>
        <div className="tk-right">
          {past ? null : ready
            ? <Qr payload={bookingRef(primary, s)} label={`${numLabel} ${num}`} />
            : <div className="tk-qr-hold"><span>{t.qrHold}</span></div>}
          <p className="tk-when">
            {dw && <><strong className="tk-dw">{dw === "today" ? t.today : t.tomorrow}</strong><br /></>}
            {f({ weekday: "long" })}<br />{f({ day: "numeric", month: "short", year: "numeric" })}
            {when && <><br /><bdi>{when}</bdi></>}
            {green && !past && <><br /><span className="go">{green}</span></>}
            {!past && <><br /><span className="tk-venue">{venueText(venue, t)}</span></>}
            {sg && <><br /><span className={`sg-chip sg-${sg.cls}`}>{sg.label}</span></>}
          </p>
        </div>
      </div>

      <div className="tk-body">
        {moments.length > 0 && cdLine(moments, now, cdT) && <Countdown moments={moments} now={now} t={cdT} />}
        {active ? (
          <div className="tk-note go"><span className="dot" aria-hidden="true" /><span>{activeText}</span></div>
        ) : past && allDone && onDay ? (
          <div className="tk-note go"><span className="dot" aria-hidden="true" /><span>{minutes >= 1 ? (bikes ? t.cueDone : t.cueDoneNb)(dur(minutes)) : bikes ? t.cueDoneNoDur : t.cueDoneNoDurNb}</span></div>
        ) : cue === "confirmed" ? (
          <div className="tk-ok" role="status"><span className="tk-ok-tick" aria-hidden="true">✓</span><span><strong>{t.confirmed}</strong><small>{t.confirmedSub}</small></span></div>
        ) : cue ? (
          <div className={`tk-note ${cue === "next" || cue === "onBike" ? "go" : cue === "inQueue" ? "" : "warn"}`}>
            {cue !== "next" && cue !== "inQueue" && <span className="dot" aria-hidden="true" />}
            <span>{{ underReview: bikes ? t.underReview : t.underReviewNb, pending: t.pending, waitlist: t.waitlistCue, onBike: t.onBike, next: t.next, inQueue: t.inQueue }[cue]}</span>
          </div>
        ) : null}
        {partnerPlace(rows) === "defe" && !past && <p className="tk-line tk-partner">{t.withDefe}</p>}
        {night && (
          <ol className="tk-stages">
            {night.stages.map((x, i) => (
              <li key={x.key} className={`${x.on ? "on" : ""}${i === night.cur ? " cur" : ""}`} aria-current={i === night.cur ? "step" : undefined}>
                <span className="tk-st-dot" aria-hidden="true" /><span className="tk-st-l">{stLabel[x.key]}</span>{x.sub && <bdi className="tk-st-s">{x.sub}</bdi>}
              </li>
            ))}
          </ol>
        )}
        {held && (
          // the breakfast spot is told at staff's time: when, in its place (_revealNoteHtml)
          <p className="tk-reveal"><Clock /><bdi>{t.revealSpotsAt(revealWhen(s?.revealAt, locale, today, { today: t.today, tomorrow: t.tomorrow }))}</bdi></p>
        )}
        {(() => {
          // The Saturday ride's (and Run for Her's) breakfast stop, as the booking app's card shows it (_commInfoHtml).
          const bf = past ? null : breakfastFor(s, locale);
          return bf && (
            <div className="tk-rt tk-bf">
              <div className="tk-rt-txt">
                <p className="tk-rt-k">{t.breakfastSpot}</p>
                <p className="tk-rt-n"><bdi>{bf.name}</bdi></p>
                {bf.offer && <p className="tk-rt-m"><bdi>{(bikes ? t.riderOffer : t.participantOffer)(bf.offer)}</bdi></p>}
                {bf.url && <a className="tk-rt-a" href={bf.url} target="_blank" rel="noopener">{t.rtMapLink}</a>}
              </div>
            </div>
          );
        })()}
        {route && (
          <div className={`tk-rt${route.track ? " has-map" : ""}`}>
            <div className="tk-rt-txt">
              <p className="tk-rt-k">{t.route}</p>
              <p className="tk-rt-n">{route.name ?? t.venueCircuit}</p>
              {(route.km > 0 || route.track || route.note) && (
                <p className="tk-rt-m">
                  {route.km > 0 && (route.lap ? t.rtLap(kmText(route.km)) : t.rtKm(kmText(route.km)))}
                  {route.km > 0 && (route.track || route.note) && " · "}
                  {route.track ? t.rtCircuitNote : route.note}
                </p>
              )}
              {past && <p className="tk-rt-done"><Tick /><span>{t.rtRidden}</span></p>}
              {route.href && <a className="tk-rt-a" href={route.href} target="_blank" rel="noopener">{t.rtMapLink}</a>}
              {route.track && <p className="tk-rt-osm">{t.rtOsm}</p>}
            </div>
            {route.track && <svg className="tk-rt-map" viewBox="0 0 40 158" aria-hidden="true" focusable="false"><path d={JCC_TRACK} /><circle cx="12.9" cy="71.4" r="3.2" /></svg>}
          </div>
        )}
        <p className="tk-riders-h">{bikes ? t.riders : t.participants} · {hideNum ? num : <bdi dir="ltr">{num}</bdi>}</p>
        {rows.map((r) => (
          <div key={r.id} className="tk-rider">
            <div className="tk-rider-top">
              {!hideNum && (r.status === "waitlist"
                ? <span className="tk-w"><span className="dot" aria-hidden="true" />{r.waitlistNum ? t.wlRowPos(String(r.waitlistNum)) : t.waitlist}</span>
                : r.queueNum != null && <span className="tk-q" dir="ltr">#{r.queueNum}</span>)}
              <span className="tk-name">{r.name}</span>
              {bikes && r.type && r.type !== "None" && <span className={`tk-type t-${r.type.toLowerCase().replace(/\s+/g, "")}`}><Bike /> {typeName(r.type)}</span>}
              {/* a runner's distance, where a ride shows the bike type (the booking app's run-km-chip) */}
              {r.runKm != null && <span className="tk-type tk-km">{t.rtKm(String(r.runKm))}</span>}
              {/* an athlete's race and division (the booking app's vl-chip) */}
              {vlap && r.vl?.race && <span className="tk-type tk-vl">{t.vlRaces[r.vl.race]}{r.vl.div && <> · {vlDivName(r.vl.div, locale)}</>}</span>}
              {/* Arena Heros: the team's race (2 women or 2 men) and the division */}
              {arena && r.ah && (r.ah.race || r.ah.div) && <span className="tk-type tk-ah">{[r.ah.race ? t.vlRaces[r.ah.race] : "", r.ah.div ? ahDivName(r.ah.div, locale) : ""].filter(Boolean).join(" · ")}</span>}
            </div>
            {!noNum && (
              <div className="tk-rider-pay">
                <bdi className={`tk-amt${r.paid ? " paid" : ""}`}>{sar(r.price)}</bdi>
                {/* Unpaid says where it is paid; a waitlisted rider owes nothing until they have a place. */}
                {r.paid
                  ? <span className="tk-pay paid"><span className="dot" aria-hidden="true" />{r.price === 0 ? t.onTheHouse : t.paid}</span>
                  : r.status !== "waitlist" && r.price > 0 && !vlap && !arena && <span className="tk-pay due"><span className="dot" aria-hidden="true" />{t.payDue}</span>}
              </div>
            )}
          </div>
        ))}
        {extras.length > 0 && rows.map((r) => {
          const mine = extras.filter((x) => x.rowId === r.id);
          return mine.length > 0 && (
            <div key={`ad-${r.id}`} className="tk-addons">
              <p className="tk-addons-h">{rows.length > 1 && <><bdi>{r.name}</bdi> · </>}{t.addons}</p>
              {mine.map((x, i) => (
                <div key={i} className="tk-ad">
                  <span className="tk-ad-n"><bdi>{x.name}</bdi>{x.qty > 1 && <> <bdi className="tk-ad-q" dir="ltr">×{x.qty}</bdi></>}</span>
                  {x.amount !== null && <bdi className="tk-amt">{sar(x.amount)}</bdi>}
                </div>
              ))}
            </div>
          );
        })}
        {vlap && (() => {
          // The athlete's place (the booking app's _vlTkHtml): the team's code and the partner on a Doubles
          // race (or that our team is finding one), the division with its distance, the T-shirt, the 5 km
          // time; the ticket question follows (VlTicket).
          const v = primary.vl;
          if (!v) return null;
          const partner = vlPartners?.get(primary.id) ?? "";
          const meta = [
            v.div ? `${vlDivName(v.div, locale)} · ${t.rtKm(String(VL_DIV_KM[v.div]))}` : "",
            v.shirt ? `${t.vlShirt}: ${v.shirt}` : "",
            v.t5k ? `${t.vlT5Short}: ${t.vlT5[v.t5k]}` : "",
          ].filter(Boolean);
          return (
            <div className="tk-vl">
              {vlIsDbl(v.race) && v.team && (
                <div className="tk-vl-team">
                  <p className="tk-vl-code"><span>{t.vlTeamCode}</span><strong dir="ltr">{v.team}</strong></p>
                  <p className="tk-vl-p">{partner ? t.vlWithPartner(partner) : past ? t.vlNoPartner : t.vlWaitPartner}</p>
                </div>
              )}
              {vlIsDbl(v.race) && !v.team && v.pair && <div className="tk-vl-team"><p className="tk-vl-p">{t.vlPairWait}</p></div>}
              {meta.length > 0 && <p className="tk-vl-meta">{meta.map((x, i) => <span key={i}>{x}</span>)}</p>}
            </div>
          );
        })()}
        {vlap && vlTicketView(primary, past) !== "none" && (() => {
          // "Do you already have a ticket, or would you like to buy one?" (the owner, 2026-10-23; the booking
          // app's _vtTkHtml): nothing on a past, done or waitlisted place, nor on one staff marked paid with no answer
          const bank = vlBankWords(locale);
          return (
            <VlTicket entryId={primary.id} answer={primary.vlTicket ?? null} receipt={!!primary.vlReceiptAt} paid={primary.paid}
              name={name} when={`${f({ weekday: "long" })} · ${f({ day: "numeric", month: "short", year: "numeric" })}`}
              amount={sar(vlTicketAmount(s?.price, primary.price)).replace(/[\u2066\u2069]/g, "")} bankName={bank.name} bankBank={bank.bank}
              t={{
                title: t.vtTitle, q: t.vtQ, have: t.vtHave, buy: t.vtBuy, buyTitle: t.vtBuyTitle, buySub: t.vtBuySub, amount: t.vtAmount, benef: t.vtBenef,
                bank: t.vtBank, iban: t.vtIban, acct: t.vtAcct, copy: t.vtCopy, copied: t.vtCopied, letter: t.vtLetter, rcptLabel: t.vtRcptLabel,
                rcptPick: t.vtRcptPick, rcptChange: t.vtRcptChange, rcptBad: t.vtRcptBad, send: t.vtSend, later: t.vtLater, back: t.vtBack,
                haveNote: t.vtHaveNote, paidNote: t.vtPaidNote, sentNote: t.vtSentNote, needRcpt: t.vtNeedRcpt, upload: t.vtUpload, change: t.change, saving: t.vtSaving,
                close: t.vtClose, failed: t.rrFailed,
              }} />
          );
        })()}
        {arena && (() => {
          // The athlete's place: the team's code and the partner once named (or that our team is finding one),
          // when the heat times come, and how to pay - announced later (the owner, 2026-10-28), or staff's words
          const v = primary.ah;
          const partner = vlPartners?.get(primary.id) ?? "";
          return (
            <div className="tk-ah">
              {v?.team && (
                <div className="tk-vl-team tk-ah-team">
                  <p className="tk-vl-code"><span>{t.vlTeamCode}</span><strong dir="ltr">{v.team}</strong></p>
                  <p className="tk-vl-p">{partner ? t.vlWithPartner(partner) : t.ahTeamCode}</p>
                </div>
              )}
              {v && !v.team && v.pair && <div className="tk-vl-team tk-ah-team"><p className="tk-vl-p">{t.vlPairWait}</p></div>}
              {!past && <p className="tk-ah-heat">{t.ahHeat}</p>}
              {!past && !allWl && !rows.every((r) => r.paid) && <p className="tk-ah-pay">{ahPayLine(s?.ah, locale, t.ahPay)}</p>}
            </div>
          );
        })()}
        {defe && !past && (
          // when the kits go out and the race starts, then the race question (the booking app's _defeKitHtml, _defeRegHtml)
          <>
            <div className="tk-defe-when">
              <p><span className="tk-defe-k">{t.defeKitLabel}</span><span className="tk-defe-v">{t.defeKitTxt}</span></p>
              <p><span className="tk-defe-k">{t.defeRaceLabel}</span><span className="tk-defe-v">{t.defeRaceTxt}</span></p>
            </div>
            {raceRegAsked(primary, s, today) && (
              <RaceRegQuestion entryId={primary.id} initial={primary.raceReg ?? null} url={DEFE_RACE_URL}
                t={{ q: t.defeRegQ, sub: t.defeRegSub, noNote: t.defeRegNoNote, code: t.defeRegCode, link: t.defeRegLink, yesNote: t.defeRegYesNote, yes: t.yes, no: t.no, change: t.change, failed: t.rrFailed }} />
            )}
          </>
        )}
        {(free || extrasCost !== null) && <div className="tk-total"><span>{t.total}</span><strong>{free ? t.free : <bdi className="tk-amt">{sar(total)}</bdi>}</strong></div>}
        {owes && !past && <p className="tk-line">{t.payAtBooth}</p>}
        {!allWl && !past && bikes && <p className="tk-line">{s?.approval ? t.helmetFree : t.helmetLine}</p>}
      </div>

      {!past && <div className="tk-actions">
        {ics && !allWl && <a className="tk-btn" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download={`micromobility-${primary.date.replace(/-/g, "")}.ics`}>{t.calendar}</a>}
        {links.place && <a className="tk-btn" href={links.place} target="_blank" rel="noopener"><Pin />{meetsAt(s) ? t.meetingPoint : t.directions}</a>}
        {links.live && <a className="tk-btn solid" href={links.live}><Live />{t.liveMap}</a>}
      </div>}
      {/* A pass in the phone's wallet reads as a place held: none on a waitlist or before the code is out, and
          none on the DEFE 5KM Run or Arena Heros, which the passes do not know (the booking app's _walletOk). */}
      {wallet && !past && !allWl && ready && !defe && !arena && <div className="tk-actions"><WalletButton bookingId={wallet.bookingId} groupIds={wallet.groupIds} /></div>}
      {canEdit && (
        <div className="tk-manage">
          {/* a run booking is never changed, only cancelled, as in the booking app */}
          {!noNum && !run && !vlap && !arena && links.edit && <a className="tk-btn solid" href={links.edit}>{t.edit}</a>}
          {!noNum && !run && !vlap && !arena && s?.kind !== "snd96" && <a className="tk-btn" href={links.manage}><Again /> {t.reschedule}</a>}
          {/* Victory Lap: the division, T-shirt and 5 km time change in the booking app's My Bookings (_vlEditOpen) */}
          {vlap && rows.length === 1 && primary.vl && <a className="tk-btn solid" href={links.manage}>{t.vlEdit}</a>}
          {/* Arena Heros: the athlete's details and division change there too (the booking app's _vlEditOpen) */}
          {arena && rows.length === 1 && primary.ah && <a className="tk-btn solid" href={links.manage}>{t.vlEdit}</a>}
          <a className="tk-btn red" href={links.manage}>{t.cancel}</a>
        </div>
      )}
    </article>
  );
}
