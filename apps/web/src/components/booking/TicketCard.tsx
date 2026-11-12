import Qr from "./Qr";
import Countdown from "./Countdown";
import RaceRegQuestion from "./RaceRegQuestion";
import WalletPay from "./WalletPay";
import { TicketPayCancel, TicketPayNow } from "@/components/pay/TicketPay";
import { refundable } from "@/lib/pay/settings";
import { walletWords } from "@/components/account/Wallet.words";
import { walletDue } from "@/lib/wallet";
import VlTicket from "./VlTicket";
import WalletButton from "@/components/account/WalletButton";
import type { T } from "./tickets.text";
import { codeWords } from "./Code.words";
import { BLOOD_PLATE_SIZE, bloodPlate } from "@/content/blood-plate";
import type { BloodWords } from "@/content/blood-words";
import { intlOf } from "@/i18n/locales";
import { fill } from "@/lib/fill";
import { VL_DIV_KM, vlDivName, vlIsDbl } from "@/lib/vlap";
import { ahDivName, ahHold } from "@/lib/arena";
import { isBloodId, type BloodReward } from "@/lib/blood";
import { AH_BANK, vlBankWords, vlTicketAmount, vlTicketView } from "@/lib/vl-ticket";
import { timesText } from "@/lib/rides";
import { isNonBike } from "@/lib/bike-kinds";
import { genderChip } from "@/lib/session-gender";
import { DEFE_RACE_URL, raceRegAsked, rowCodes, type CodeKind, addonLines, addonsCost, lockerText, type TicketLocker, type OwnLocker, bookingRef, breakfastFor, cdLine, codeReady, countdownMoments, dayWord, fmtClock, icsFor, icsPlace, kmText, meetsAt, partnerPlace, meetHeld, queueNumbers, revealWhen, spotHeld, ticketLook, wlCollectTime, ticketStages, venueOf, venueText, type AddonItem, type Cue, type TicketRoute, type TicketRow, type TicketSession, satNumOk, BOOTH_APPLE, BOOTH_DIR, todayCode } from "@/lib/tickets";
import { TickIcon } from "@/components/site/Icons";
import { Sar, sarText } from "./Sar";
import { TicketDir, TicketMore, TicketShare } from "./TicketParts";

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
// A Blood Donation ticket (2026-11-03; lib/blood.ts) says "Donor number" under the hosts' plate, on its own look (white
// and crimson: the booking app's th-blood), with the short rules, what confirmed donors get, and their free ride's code
// once staff have confirmed the donation. Never a price, a total or a pay line, no wallet pass, no Edit or Reschedule;
// Cancel stays. Its words come from the page (`blood`), not from T: that dictionary goes to every page's browser.
// After the booking app's Bookings page research (2026-11-10): the date on one start-aligned line under the number and
// the place on one more; on the ride's day the code drawn large under the number (todayCode); the route and the
// add-ons behind one Details row (TicketMore); Calendar and Directions side by side with a square Share at the end of
// their row, the Live map on a row of its own; the circuit's Directions at the booth, with Apple Maps offered on an
// iPhone (TicketDir); a waitlist's cancel says Leave waitlist. The event colours stay the site's own.
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
  /** live: the live ride map (/live?session=), on the day of the ride only. share: what Share sends as its link
   *  (lib/tickets.ts shareLink), none for no Share. bookings: the booking app's My Bookings, the calendar entry's URL. */
  links: { edit: string | null; manage: string; place: string | null; live?: string | null; share?: string | null; bookings?: string | null };
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
  /** Paying online (2026-11-10): open on this site, the refund rule, and today in Riyadh. Absent: no Pay now, and Cancel goes to the booking app. */
  online?: { open: boolean; refundDays: number; today: string } | null;
  /** Edit, Reschedule and Cancel under the card (My Account); false on the booking's own
   *  confirmation on Experiences, which is the booking app's renderOneTicket (none there). */
  manage?: boolean;
  /** The add-ons' items by id, their names and today's prices (lib/ticket-addons.ts); null when the
   *  inventory could not be read. */
  addonItems?: Map<string, AddonItem> | null;
  /** the account's lockers by booking (customer_lockers): a locker line says its period and number */
  lockers?: Map<string, TicketLocker> | null;
  /** the rider's own lockers that evening with no booking behind them (ownLockersOf): named on the ticket too */
  ownLockers?: OwnLocker[] | null;
  /** Victory Lap (and Arena Heros): each team booking's partner by first name, by booking id (customer_vl_teams);
   *  a booking without one has no partner named. */
  vlPartners?: Map<string, string> | null;
  /** The rider's wallet balance when it was read, else null: no wallet line on the ticket (2026-11-02). */
  balance?: number | null;
  /** The Blood Donation event: its words (content/blood-words.ts), and each booking's free ride by booking id
   *  (customer_blood_rewards), null or missing where there is none. */
  blood?: { words: BloodWords; rewards: Map<string, BloodReward> | null } | null;
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
// An amount as riders read it in the booking app (_sar), as text inside a sentence; on its own it is <Sar> (./Sar.tsx),
// whose sign a screen reader reads as a word.
const sar = sarText;

// The Jeddah Corniche Circuit, drawn from OpenStreetMap (© OpenStreetMap contributors, ODbL): the
// Formula 1 ways chained into one loop, simplified, north up, the start marked (the booking app's JCC_TRACK).
const JCC_TRACK = "M12.9 71.4 11 69.3 10.4 66.7 10.7 64.5 12.7 60.9 12.9 58.7 11.7 54.8 8.5 51.6 8.4 45.7 9.8 43.1 12.8 41.8 14 40.4 16.6 30.6 16.8 24.8 15.8 6.2 14.7 4.7 13.1 4 10.8 4.7 9.7 6.1 9.4 9.9 13.1 17.2 13.5 23.5 10.6 31 9.8 36.1 5.4 38.7 4.3 41.1 4.3 48 8.3 59.2 9.2 70.6 13.7 79.4 15 84.7 15.1 90.6 14.1 96.6 15 98.4 17.9 101.4 19.2 106.6 18.7 108.9 14.4 117.5 13.4 121.9 13.7 127.1 16.5 136.6 21.3 144.7 25.9 148.9 33.2 153.9 35 153.7 36.1 151.9 31.3 130.1 20.3 97.5 19.3 96.6 17.3 97.2 16.2 96.1 17.7 90 17.8 87.5 15.5 72.6Z";
const Tick = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);

// The mark of each kind of code a booking used (the booking app's _CODE_IC, 2026-11-08): the friend's invite, the free ride
// (a gift), the bonus (a star), the blood donation (a drop), a volunteer's free ride (a raised hand, as on the Volunteer
// badge, 2026-11-09), a promo code (a tag), a Saturday ride code (a ticket).
const CODE_MARK: Record<CodeKind, React.ReactNode> = {
  rw: <><circle cx="9.4" cy="8.2" r="3.4" /><path d="M3.4 19.8c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4M18.6 7.4v6.2M15.5 10.5h6.2" /></>,
  rf: <><rect x="3.6" y="8.4" width="16.8" height="4.2" rx="1" /><path d="M5.2 12.6v6.6a1.2 1.2 0 0 0 1.2 1.2h11.2a1.2 1.2 0 0 0 1.2-1.2v-6.6M12 8.4v12M12 8.4C10.9 5.6 8.4 4 7 5.1c-1.3 1-.1 3.3 5 3.3zM12 8.4c1.1-2.8 3.6-4.4 5-3.3 1.3 1 .1 3.3-5 3.3z" /></>,
  rb: <><circle cx="12" cy="12" r="8.6" /><path d="M12 7.2l1.44 2.92 3.22.47-2.33 2.27.55 3.2L12 14.56l-2.88 1.5.55-3.2-2.33-2.27 3.22-.47z" /></>,
  bd: <path d="M12 3.4s-6.2 6.5-6.2 10.8a6.2 6.2 0 0 0 12.4 0C18.2 9.9 12 3.4 12 3.4z" />,
  vl: <path d="M8.6 12.4V6.2a1.5 1.5 0 0 1 3 0v5M11.6 11V4.6a1.5 1.5 0 0 1 3 0V11M14.6 11.2V6.4a1.5 1.5 0 0 1 3 0v7.8c0 3.9-2.5 6.6-6 6.6-2.5 0-4.1-1.2-5.3-3.2l-2.2-3.8a1.5 1.5 0 0 1 2.5-1.7l1.4 1.9" />,
  promo: <><path d="M3.5 12.3V5a1.5 1.5 0 0 1 1.5-1.5h7.3l8.2 8.2a1.5 1.5 0 0 1 0 2.1l-7.3 7.3a1.5 1.5 0 0 1-2.1 0z" /><circle cx="8.3" cy="8.3" r="1.5" /></>,
  sat: <><path d="M3.6 7.6A1.6 1.6 0 0 1 5.2 6h13.6a1.6 1.6 0 0 1 1.6 1.6V10a2 2 0 0 0 0 4v2.4a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V14a2 2 0 0 0 0-4z" /><path d="M14.4 6.6v1.6M14.4 11.2v1.6M14.4 15.8v1.6" /></>,
};
const CodeMark = ({ k }: { k: CodeKind }) => (
  <svg className="tk-code-ic" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{CODE_MARK[k]}</svg>
);

const Clock = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6" /><path d="M12 7.4V12l3.2 2" /></svg>
);

const Cal = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </svg>
);

const Again = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </svg>
);

export default function TicketCard({ locale, today, rows, session: s, name, cue, t, gather, start, typeName, links, route = null, wallet = null, bikeName = null, past = false, now, manage = true, addonItems = null, lockers = null, ownLockers = null, vlPartners = null, balance = null, blood = null, online = null }: Props) {
  const primary = rows[0];
  const noNum = !s || s.approval; // a ride staff approve never shows its order (nor prices, nor edit)
  // ...except a Saturday ride's booking number once its list is out, to a rider on it (satNumOk, 2026-10-25)
  const satNum = satNumOk(rows, s);
  const ahHeld = s?.kind === "arena" && ahHold(rows); // Arena Heros: no number and no code until the place is paid (2026-11-02)
  const hideNum = (noNum && !satNum) || ahHeld;
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
  // The Blood Donation event, by its id on a session that did not load: a donor's number, no price anywhere (2026-11-03)
  const donor = s ? s.kind === "blood" : isBloodId(primary.sessionId);
  const bw = donor ? blood?.words ?? null : null;
  const vis = !!primary.bloodVisitor; // a visitor, not a donor (rentals 20261105140000)
  const numLabel = bw ? (vis ? bw.visitorNumLabel : bw.numLabel) : run ? t.runnerNumber : vlap || arena ? t.athleteNumber : satNum ? t.bookingNumber : t.queueNumber;
  // The add-ons bought with the booking, each rider's under their name, and in the total, as the
  // booking app lists them (none on a ride staff approve). A line whose price is not known (the
  // inventory could not be read) is listed without it, and the total is left out: never a wrong one.
  const extras = s?.approval || donor ? [] : addonLines(rows, addonItems);
  const extrasCost = addonsCost(extras);
  const total = rows.reduce((sum, r) => sum + r.price, 0) + (extrasCost ?? 0);
  const free = (!!s?.free || (noNum && total === 0)) && extras.length === 0;
  const ready = codeReady(rows, s);
  // the Wallet switch (the booking app's _cwPaySlot, 2026-11-03): only with a balance read; each row's own add-ons, so a
  // row that costs nothing is left out of what it pays
  const extrasBy = extrasCost === null ? null : extras.reduce((m, x) => m.set(x.rowId, (m.get(x.rowId) ?? 0) + (x.amount ?? 0)), new Map<string, number>());
  const due = !past && !allWl && balance !== null ? walletDue(rows, s?.kind, !!s?.approval, extrasBy) : null;
  const wWords = walletWords(locale);
  // Paying online (2026-11-10): Pay now for places still unpaid on a ride paid online; Cancel with the refund's
  // choice for a booking paid online (never a race, a Petromin night, the blood drive, or a ride staff approve).
  const payKind = !free && !s?.approval && !["vlap", "arena", "petromin", "blood"].includes(s?.kind ?? "");
  // only a row that still owes something, as the database's _pay_due counts it (its price and add-ons less what the wallet
  // paid): a row that costs nothing would only be answered "paid" and the page reloaded to the same button (bug hunt 2026-11-11)
  const owes = (r: (typeof rows)[number]) => (extrasBy
    ? Math.round((r.price + (extrasBy.get(r.id) ?? 0) - (r.walletPaid ?? 0)) * 100) / 100 > 0
    : r.price > (r.walletPaid ?? 0) || extras.some((x) => x.rowId === r.id));
  const unpaid = online?.open && payKind && !past ? rows.filter((r) => (r.status === "waiting" || r.status === "active") && !r.paid && owes(r)).map((r) => r.id) : [];
  const heldTill = rows.map((r) => r.payHold).find((h) => !!h && Date.parse(h) > now) ?? null;
  const paidOnline = rows.some((r) => r.payMethod === "online");
  const onlineBack = rows.filter((r) => r.payMethod === "online" && (r.status === "waiting" || r.status === "waitlist")).reduce((n, r) => n + (r.cardAmount ?? 0), 0);
  const cw = codeWords(locale); // the kinds of code a row used
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
  const fmtShort = (iso: string) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const clock = (x: string) => fmtClock(x, locale);
  // a session with a start time alone (the DEFE 5KM Run's 7 PM) says it once
  const when = timesText(s?.times, !!s?.gathers, clock, { gather, start });
  // the waitlist collects later (wlCollectTime: the session's own time, or a circuit night's 15 minutes after the
  // start): said under the band, or on the rider's row in a mixed party
  const wlc = wlCollectTime(s);
  const wlLine = wlc && !past ? t.wlCollectFrom(clock(wlc)) : "";
  const green = s?.times && s.gathers ? t.gatherAt(clock(s.times[0])) : allWl && wlLine ? "" : s?.collect && bikes ? t.collectFrom(clock(s.collect)) : "";
  const ics = s ? icsFor(s, `${name} - ${f({ weekday: "long" })}`, icsPlace(s), new Date(), { id: primary.id, url: links.bookings }) : "";
  // men only, women only or mixed (the booking app's _sgChip): none on a session that did not load
  const sg = s ? genderChip(s, { male: t.sgMale, female: t.sgFemale, mixed: t.sgMixed }) : null;
  const reward = donor ? blood?.rewards?.get(primary.id) ?? null : null;
  // The code, named with what it says (MMC-12-ab12cd), so a screen reader gives the rider the words to read to the desk,
  // which can type them into Scan (the booking app's _qrBox, 2026-11-10); on the ride's day drawn large (todayCode).
  const ref = bookingRef(primary, s);
  const qrName = `${t.qrLabel} ${ref}`;
  const largeQr = todayCode(rows, s, today, past);
  const day = `${f({ weekday: "long" })} ${f({ day: "numeric", month: "short", year: "numeric" })}`;
  const placeLabel = meetsAt(s) ? t.meetingPoint : t.directions;
  // Share's words: what, when and where; never a name (the booking app's _tkShareText). A held ride's point is not told.
  const shareText = [name, day, when, held && meetHeld(s, now) ? "" : venueText(venue, t)].filter(Boolean).join(" · ");
  // each rider's add-ons under their name: the ones looked up behind Details, a locker in view (its period and number)
  const looked = extras.filter((x) => !x.locker), lockerLines = extras.filter((x) => x.locker);
  const addonRows = (list: typeof extras, head: string) => list.length > 0 && rows.map((r) => {
    const mine = list.filter((x) => x.rowId === r.id);
    return mine.length > 0 && (
      <div key={`ad-${r.id}`} className="tk-addons">
        <p className="tk-addons-h">{rows.length > 1 && <><bdi>{r.name}</bdi> · </>}{head}</p>
        {mine.map((x, i) => (
          <div key={i} className="tk-ad">
            <span className="tk-ad-n"><bdi>{x.locker ? lockerText("", lockers?.get(x.rowId), locale) || t.locker : x.name}</bdi>{x.qty > 1 && <> <bdi className="tk-ad-q" dir="ltr">×{x.qty}</bdi></>}</span>
            {x.amount !== null && <Sar n={x.amount} word={t.sarWord} />}
          </div>
        ))}
      </div>
    );
  });

  return (
    <article className={`tk-card ev-${donor ? "blood" : s?.kind ?? "jcc"}${look ? ` tk-${look}` : ""}${look === "live" && onDay ? " tk-today" : ""}`}>
      {/* The hosts' marks on their white plate, across the top of the ticket (the booking app's _bldPlateHtml). */}
      {bw && <div className="bld-plate tk-bld-plate"><img src={bloodPlate(locale)} alt={bw.plateAlt} width={BLOOD_PLATE_SIZE.width} height={BLOOD_PLATE_SIZE.height} decoding="async" /></div>}
      {/* A visitor's stripe, in the booking app's words and colours (_bldTkType, the owner, 2026-11-05). */}
      {bw && vis && <div className="tk-bld-vis">{bw.visitor.toUpperCase()}</div>}
      <div className="tk-head">
        <div className="tk-num-block">
          {/* The logo heads the number's column (the booking app's _tkLogo): white lettering on the dark card. */}
          {donor ? null : vlap
            ? <span className="tk-logo tk-logo-vl" aria-hidden="true"><img src="/site/victory-lap-dark.webp" alt="" decoding="async" /></span>
            : arena ? <span className="tk-logo tk-logo-ah" aria-hidden="true"><img src="/site/arena-heros-logo.webp" alt="" decoding="async" /></span>
            : defe ? <span className="tk-logo tk-logo-defe" aria-hidden="true"><img src="/site/defe-logo.svg" alt="" decoding="async" /></span>
            : <span className="tk-logo" aria-hidden="true"><img className="tk-logo-l" src="/site/logo-dark.webp" alt="" decoding="async" /><img className="tk-logo-d" src="/site/logo.webp" alt="" decoding="async" /></span>}
          {ahHeld && !allWl && <p className="tk-label">{t.ahHoldTitle}</p>}
          {!hideNum && (allWl
            ? <><p className={`tk-label wl${wlc ? " solid" : ""}`}>{t.wlOnList}</p>{wlLine && <p className="tk-wl-collect">{wlLine}</p>}</>
            : <p className="tk-label">{rows.length > 1 ? (rows.length === 2 ? (bikes ? t.bikes2 : t.party2) : (bikes ? t.bikesN : t.partyN)(String(rows.length))) : numLabel}</p>)}
          {/* a number reads left to right in every language: "#7 – #8" is never "#8 – #7" */}
          <p className={`tk-num ${big}`}>{hideNum ? num : <bdi dir="ltr">{num}</bdi>}</p>
          {/* in line for a place, never which number in the line (the booking app, the owner 2026-11-10) */}
          {allWl && !hideNum && <p className="tk-wl-note">{t.wlPosNoNum}</p>}
        </div>
        {!past && !largeQr && (
          <div className="tk-right">
            {ready
              ? <Qr payload={ref} label={qrName} />
              : <div className="tk-qr-hold"><span>{ahHeld ? t.ahHoldNote : t.qrHold}</span></div>}
          </div>
        )}
      </div>
      {/* today's code: 224px, centred under the number (Qr's size is the code inside its 6px white tile) */}
      {largeQr && <div className="tk-qr-big"><Qr payload={ref} size={212} label={qrName} /></div>}
      {/* the date on one line ([Today ·] weekday date · time) and the place on one more (venue · collect time · chip);
          they were six right-aligned lines beside the code. A segment breaks only at its dot. */}
      <div className="tk-when">
        <p className="tk-when-d">
          {dw && <><strong className="tk-dw">{dw === "today" ? t.today : t.tomorrow}</strong><span className="tk-sep" aria-hidden="true">·</span></>}
          <bdi className="tk-seg">{day}</bdi>
          {when && <><span className="tk-sep" aria-hidden="true">·</span><bdi>{when}</bdi></>}
        </p>
        {/* tonight's past card keeps only the chip (2026-10-27) */}
        {(!past || sg) && (
          <p className="tk-when-p">
            {!past && <span className="tk-venue">{venueText(venue, t)}</span>}
            {!past && green && <><span className="tk-sep" aria-hidden="true">·</span><span className="go tk-seg">{green}</span></>}
            {sg && <span className={`sg-chip sg-${sg.cls}`}>{sg.label}</span>}
          </p>
        )}
      </div>

      <div className="tk-body">
        {moments.length > 0 && cdLine(moments, now, cdT) && <Countdown moments={moments} now={now} t={cdT} />}
        {active ? (
          <div className="tk-note go"><span className="dot" aria-hidden="true" /><span>{activeText}</span></div>
        ) : past && allDone && onDay ? (
          <div className="tk-note go"><span className="dot" aria-hidden="true" /><span>{minutes >= 1 ? (bikes ? t.cueDone : t.cueDoneNb)(dur(minutes)) : bikes ? t.cueDoneNoDur : t.cueDoneNoDurNb}</span></div>
        ) : cue === "confirmed" ? (
          <div className="tk-ok" role="status"><span className="tk-ok-tick" aria-hidden="true"><TickIcon size={14} /></span><span><strong>{t.confirmed}</strong></span></div>
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
        <p className="tk-riders-h">{bw ? (vis ? bw.visitor : bw.donor) : bikes ? t.riders : t.participants} · {hideNum ? num : <bdi dir="ltr">{num}</bdi>}</p>
        {rows.map((r) => (
          <div key={r.id} className="tk-rider">
            <div className="tk-rider-top">
              {!hideNum && (r.status === "waitlist"
                ? <span className="tk-w"><span className="dot" aria-hidden="true" />{t.waitlist}</span>
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
            {/* the code the row was booked with, its kind and its mark (the booking app's _codeRowHtml, 2026-11-08) */}
            {rowCodes(r).length > 0 && (
              <p className="tk-code">
                {rowCodes(r).map(([k, c]) => (
                  <span key={k} className={`tk-code-tag ck-${k}`} title={`${cw[k]}: ${c}`}><CodeMark k={k} /><span className="tk-code-kn">{cw[k]}</span><bdi dir="ltr" className="tk-code-c">{c}</bdi></span>
                ))}
              </p>
            )}
            {r.status === "waitlist" && !allWl && wlLine && <p className="tk-wl-collect row">{wlLine}</p>}
            {!noNum && !donor && (
              <div className="tk-rider-pay">
                <Sar n={r.price} word={t.sarWord} className={`tk-amt${r.paid ? " paid" : ""}`} />
                {/* Unpaid says where it is paid; a waitlisted rider owes nothing until they have a place. */}
                {r.paid
                  ? <span className="tk-pay paid"><span className="dot" aria-hidden="true" />{r.price === 0 ? t.onTheHouse : t.paid}</span>
                  : r.status !== "waitlist" && r.price > 0 && !vlap && !arena && <span className="tk-pay due"><span className="dot" aria-hidden="true" />{t.payDue}</span>}
              </div>
            )}
          </div>
        ))}
        {/* the route and the add-ons: things a rider looks up, behind one Details row, closed until opened (the booking
            app's _tkMore, 2026-11-10); the total stays in view */}
        {(route || looked.length > 0) && (
          <TicketMore label={t.details}>
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
            {addonRows(looked, t.addons)}
          </TicketMore>
        )}
        {/* a locker on the booking stays in view: its number is what the rider gives at the desk (the booking app's _lkTkHtml) */}
        {addonRows(lockerLines, t.locker)}
        {!!ownLockers?.length && (
          <div className="tk-addons">
            <p className="tk-addons-h">{t.locker}</p>
            {ownLockers.map((l) => (
              <div key={l.id} className="tk-ad">
                <span className="tk-ad-n"><bdi>{lockerText("", { period: l.period, code: l.code, status: l.status }, locale)}</bdi></span>
                {l.paid && <span className="tk-amt">{t.lockerPaid}</span>}
              </div>
            ))}
          </div>
        )}
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
        {(vlap || arena) && vlTicketView(primary, past, arena) !== "none" && (() => {
          // "Do you already have a ticket, or would you like to buy one?" (the owner, 2026-10-23; the booking
          // app's _vtTkHtml): nothing on a past, done or waitlisted place, nor on one staff marked paid with no answer
          const bank = arena ? vlBankWords(locale, AH_BANK) : vlBankWords(locale);
          return (
            <VlTicket arena={arena} entryId={primary.id} answer={primary.vlTicket ?? null} receipt={!!primary.vlReceiptAt} paid={primary.paid}
              name={name} when={`${f({ weekday: "long" })} · ${f({ day: "numeric", month: "short", year: "numeric" })}`}
              amount={sar(vlTicketAmount(s?.price, primary.price)).replace(/[\u2066\u2069]/g, "")} bankName={bank.name} bankBank={bank.bank}
              t={{
                title: t.vtTitle, q: t.vtQ, have: t.vtHave, buy: t.vtBuy, buyTitle: arena ? t.ahBuyTitle : t.vtBuyTitle, buySub: arena ? t.ahBuySub : t.vtBuySub, amount: t.vtAmount, benef: t.vtBenef,
                bank: t.vtBank, iban: t.vtIban, acct: t.vtAcct, copy: t.vtCopy, copied: t.vtCopied, letter: t.vtLetter, rcptLabel: t.vtRcptLabel,
                rcptPick: t.vtRcptPick, rcptChange: t.vtRcptChange, rcptBad: t.vtRcptBad, send: t.vtSend, later: t.vtLater, back: t.vtBack,
                haveNote: t.vtHaveNote, paidNote: t.vtPaidNote, sentNote: t.vtSentNote, needRcpt: arena ? t.ahNeedPay : t.vtNeedRcpt, upload: t.vtUpload, change: t.change, saving: t.vtSaving,
                close: t.vtClose, failed: t.rrFailed,
              }} />
          );
        })()}
        {arena && (() => {
          // The athlete's place: the team's code and the partner once named (or that our team is finding one),
          // and when the heat times come; how to pay is the transfer's line above (2026-11-02)
          const v = primary.ah;
          const partner = vlPartners?.get(primary.id) ?? "";
          return (
            <div className="tk-ah">
              {v?.team && (
                <div className="tk-vl-team tk-ah-team">
                  <p className="tk-vl-code"><span>{t.vlTeamCode}</span><strong dir="ltr">{v.team}</strong></p>
                  <p className="tk-vl-p">{partner ? t.vlWithPartner(partner) : past ? t.ahTeamCode : t.ahWait}</p>
                </div>
              )}
              {v && !v.team && v.pair && <div className="tk-vl-team tk-ah-team"><p className="tk-vl-p">{t.vlPairWait}</p></div>}
              {!past && <p className="tk-ah-heat">{t.ahHeat}</p>}
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
        {bw && (
          // the short rules, what confirmed donors get, and the free ride once staff confirmed the donation (the booking
          // app's _bldTkHtml, _bldRwHtml); a code that has been used says so, as there
          <div className="tk-bld">
            {primary.bloodClub && <p className="tk-bld-club">{bw.clubLabel}: <b><bdi>{primary.bloodClub}</bdi></b></p>}
            {!past && <ul className="bld-sum">{(vis ? [bw.rules[0]] : bw.rules).map((x, i) => <li key={i}><Tick /><span>{x}</span></li>)}</ul>}
            {!(vis && past) && <p className="tk-bld-note">{vis ? bw.visitorNote : bw.rewardNote}</p>}
            {reward && (
              <div className="tk-bld-rw">
                <p className="tk-bld-rw-t">{bw.rewardTitle}</p>
                {reward.used
                  ? <p>{vis ? bw.rewardUsedVis : bw.rewardUsed}</p>
                  : <><p className="tk-bld-rw-c" dir="ltr">{reward.code}</p>{reward.expiresAt && <p>{(vis ? bw.rewardTxtVis : bw.rewardTxt).replace("{0}", fmtShort(reward.expiresAt))}</p>}</>}
              </div>
            )}
          </div>
        )}
        {!donor && (free || extrasCost !== null) && <div className="tk-total"><span>{t.total}</span><strong>{free ? t.free : <Sar n={total} word={t.sarWord} />}</strong></div>}
        {due && (due.used > 0 || (due.left > 0 && (balance ?? 0) > 0)) && (
          <WalletPay ids={due.ids} on={due.used > 0} title={wWords.title} failed={wWords.failed}
            sub={due.used <= 0 ? wWords.have.replace("{0}", sar(balance ?? 0))
              : due.left > 0 ? wWords.usingLeft.replace("{0}", sar(due.used)).replace("{1}", sar(due.left))
              : wWords.usingAll.replace("{0}", sar(due.used))} />
        )}
        {paidOnline && <p className="tk-line tk-online">{t.paidOnline}</p>}
        {unpaid.length > 0 && <TicketPayNow ids={unpaid} held={heldTill} locale={locale} />}
        {!allWl && !past && bikes && <p className="tk-line">{s?.approval ? t.helmetFree : t.helmetLine}</p>}
      </div>

      {/* Calendar and Directions side by side, Share a 48px square at the end of their row, the Live map on its own row */}
      {!past && <div className="tk-actions tk-go">
        {ics && !allWl && <a className="tk-btn tk-cal" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download={`micromobility-${primary.date.replace(/-/g, "")}.ics`}><Cal />{t.calendar}</a>}
        {links.place && (
          <TicketDir href={links.place} apple={links.place === BOOTH_DIR ? BOOTH_APPLE : null} words={{ title: placeLabel, apple: t.mapsApple, google: t.mapsGoogle, close: t.vtClose }}>
            <Pin />{placeLabel}
          </TicketDir>
        )}
        {links.share && <TicketShare text={shareText} url={links.share} label={t.share} copied={t.vtCopied} />}
        {links.live && <a className="tk-btn solid tk-map" href={links.live}><Live />{t.liveMap}</a>}
      </div>}
      {/* A pass in the phone's wallet reads as a place held: none on a waitlist or before the code is out, and
          none on the DEFE 5KM Run or Arena Heros, which the passes do not know (the booking app's _walletOk). */}
      {wallet && !past && !allWl && ready && !defe && !arena && !donor && <div className="tk-actions"><WalletButton bookingId={wallet.bookingId} groupIds={wallet.groupIds} /></div>}
      {canEdit && manage && (
        <div className="tk-manage">
          {/* a run booking is never changed, only cancelled, as in the booking app */}
          {!noNum && !run && !vlap && !arena && !donor && links.edit && <a className="tk-btn solid" href={links.edit}>{t.edit}</a>}
          {!noNum && !run && !vlap && !arena && !donor && s?.kind !== "snd96" && <a className="tk-btn" href={links.manage}><Again /> {t.reschedule}</a>}
          {/* Victory Lap: the division, T-shirt and 5 km time change in the booking app's My Bookings (_vlEditOpen) */}
          {vlap && rows.length === 1 && primary.vl && <a className="tk-btn solid" href={links.manage}>{t.vlEdit}</a>}
          {/* Arena Heros: the athlete's details and division change there too (the booking app's _vlEditOpen) */}
          {arena && rows.length === 1 && primary.ah && <a className="tk-btn solid" href={links.manage}>{t.vlEdit}</a>}
          {/* nothing is held on a waitlist: the rider leaves it (the booking app's leaveWlBtn, 2026-11-10); a place paid
              online is cancelled here, with where its money goes back (components/pay/TicketPay.tsx) */}
          {paidOnline && online
            ? <TicketPayCancel ids={rows.filter((r) => r.status === "waiting" || r.status === "waitlist").map((r) => r.id)} amount={onlineBack}
                refundable={refundable(primary.date, online.today, online.refundDays)} refundDays={online.refundDays} amountText={sar(onlineBack)} locale={locale} />
            : <a className="tk-btn red" href={links.manage}>{allWl ? t.leaveWl : t.cancel}</a>}
        </div>
      )}
    </article>
  );
}

/** A cancelled booking, one quiet row under the tickets until its day has gone (the booking app's _mrCxRow, 2026-11-10):
 *  what it was, when, and who cancelled it. With no email or SMS the page is the rider's only record of it. It holds no
 *  code, no money and nothing to press: the place is gone, and where any money went is the desk's to say. */
export function TicketCancelled({ locale, date, session: s, name, by, t, gather, start }: {
  locale: string; date: string; session: TicketSession | undefined; name: string; by: "staff" | "customer" | ""; t: TicketText; gather: string; start: string;
}) {
  const d = new Date(`${date}T00:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { ...o, timeZone: "UTC" }).format(d);
  const when = timesText(s?.times, !!s?.gathers, (x) => fmtClock(x, locale), { gather, start });
  return (
    <div className="tk-cx">
      <p className="tk-cx-top"><span className="tk-cx-n">{name}</span><span className="tk-cx-chip">{by === "staff" ? t.cxByUs : by === "customer" ? t.cxByYou : t.cancelled}</span></p>
      <p className="tk-cx-w"><bdi>{f({ weekday: "long" })} {f({ day: "numeric", month: "short", year: "numeric" })}</bdi>{when && <> · <bdi>{when}</bdi></>}</p>
    </div>
  );
}
