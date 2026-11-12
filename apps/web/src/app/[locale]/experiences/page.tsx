import type { Metadata } from "next";
import { cookies } from "next/headers";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import "@/components/experiences/experiences.css";
import "@/components/booking/booking.css";
import bloodPoster from "@/content/blood-info.json";
import { BLOOD_CARD, BLOOD_NAME, BLOOD_PLATE_SIZE, bloodName, bloodPlate, bloodWords } from "@/content/blood-words";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { fill, fmtNum, fmtSar } from "@/lib/fill";
import { BOOKING_URL, bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { genderViewer, rpcServer } from "@/lib/account";
import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { typeOffered } from "@/lib/bike-kinds";
import { dateText, eventCards, featuredDates, infoArena, infoBreakfast, infoDistance, infoPlace, infoPlaces, infoPrice, infoTimes, infoVl, infoWho, rentsBikes, type DateTexts } from "@/lib/event-info";
import { bizOf, faresOf } from "@/lib/biz";
import { kindNames, loadRides, oneTime, sessionName, upcoming, type RideKind, type RideSession } from "@/lib/rides";
import { routeItems, routeNameOf, routeNames } from "@/lib/route-names";
import { notOpenYet, opensAt, opensInWords, opensText, siteBookingWindow } from "@/lib/booking-window";
import ExperienceSteps, { type StepEvent, type StepSession, type StepText } from "@/components/experiences/ExperienceSteps";
import LearnTeaser, { learnTeaser } from "@/components/learn/LearnTeaser";
import { riyadhClock } from "@/lib/workshop-days";
import { DEFE_RACE_URL, dayWord, fmtClock, fmtDayDate, fmtDayTile, kmText, meetHeld, revealWhen, spotHeld } from "@/lib/tickets";
import { serverL } from "@/i18n/dicts";
import { fill as fillAt, phrase } from "@/i18n/tx";
import { intlOf } from "@/i18n/locales";
import { bg } from "@/lib/img";
import { vlConfig, vlDivNames, vlPayLine } from "@/lib/vlap";
import { AH_INFO_URL, ahConfig, ahPayLine } from "@/lib/arena";
import { genderBlock, genderChip, genderText } from "@/lib/session-gender";
import { yogaKnow, yogaLength } from "@/lib/yoga";
import { ArrowIcon } from "@/components/site/Icons";
import { kindThemeWords } from "@/components/experiences/KindTheme.words";
import { kindMarks, sunriseHhmm } from "@/lib/kind-theme";

// micromobility.sa/experiences - booking in steps (ExperienceSteps): the event, a date, then the
// ride with its prices and rules, handed to the booking app on that event and date. The events,
// dates and prices are read live from the booking system. A session for men only or women only (the
// owner, 2026-10-27; lib/session-gender.ts) is listed to every visitor, signed in or not, of either gender,
// as a mixed one is (the owner, 2026-10-28: "make all pool sessions visible to all genders but only male can
// book male sessions and female can book female sessions"); every date of one and every pool date wears its
// chip, and a signed-in account of the other gender is told so in place of the button that hands the booking
// over. Arena Heros (the owner, 2026-10-28; everyone's since 2026-11-02, session open_to_all): its About,
// its dates' Details and its price are members' (community_member), and its last step hands over to the booking
// app (?ev=arena), which has the athlete step. The Blood Donation event (2026-11-03; lib/blood.ts) has a card of its own
// while a session is on the books, and nothing names it before that: its words and its poster are this server's
// (content/blood-words.ts, blood-info.json) and go into the page only with that card; its last step hands over to the
// booking app (?ev=blood), which has the donor step. Yoga (2026-11-12; lib/yoga.ts) is a date inside the community card,
// on its own "Sunset Hatha" card: the mark, its name, when, how long and where, and who leads it; its Details say who
// leads it, how long, the level and what to bring. Featured (2026-11-13; lib/rides.ts featuredOf): a date inside
// MicroMobility Experiences that staff feature, or a special event as it is made, leads its event's dates under
// "Featured" and has a card above the event cards (lib/event-info.ts featuredDates), which opens it as its event card
// and then its date would.
// The Experiences card, its list and the Saturday ride (the owner's picks on the booking app's theming page, 2026-11-13;
// lib/kind-theme.ts): the card leads, without the lockup, with a mark for each kind it has dates for; its About says About
// and See dates; its list sits under the card's pattern, offers a switch between its kinds and says Choose a date when it
// mixes rides with sessions without a bike; each named date wears its kind's mark, the Saturday ride's row and Details say
// when the sun rises, and its Details draw the two routes. An Arabic page names a session by its Arabic name (title_ar).
// The Saturday ride's number in its series is the booking app's alone: this page holds the dates from today on, never
// the ones before, so it cannot count them.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);

// The booking app's bike types, in the order a rider meets them there.
const TYPE_ORDER = ["Road", "Hybrid", "Mountain", "Road Carbon", "Kids", "Gravel"];
const TYPE_NAME: Record<string, { en: string; ar: string }> = {
  Road: phrase("Road", "طريق"), Hybrid: phrase("Hybrid", "هجين"), Mountain: phrase("Mountain", "جبلي"), "Road Carbon": phrase("Road Carbon", "طريق كربون"),
  Kids: phrase("Kids", "أطفال"), Gravel: phrase("Gravel", "حصى"), Any: phrase("No preference", "بلا تفضيل"),
};

// Is the visitor a community member? The members-only cards and dates show their About and Details
// links to members alone (the owner, 2026-10-05). Asked only when the request carries the account's
// cookie, of the booking app's own members gate (community_member, which checks the token); any
// failure reads as no. A signed-in visitor's page is never kept at the edge (lib/page-cache.ts).
async function communityMember(): Promise<boolean> {
  const s = decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
  if (!s) return false;
  const r = await rpcServer<boolean>("community_member", { p_id: s.id, p_token: s.token });
  return r.data === true;
}

// Does the visitor hold the Petromin tag? Petromin Days, the Petromin nights' own card, shows to
// holders alone (the owner, 2026-10-12: "a new event card that has the name Petromin Days that only
// is visible for petromin tag holders"). The booking app's own answer (petromin_member, a bare
// boolean like community_member's, which checks the token); any failure reads as no, a database
// without the function too.
async function petrominMember(): Promise<boolean> {
  const s = decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
  if (!s) return false;
  // rpcServer never throws: a refusal, a missing function or no answer comes back without data
  const r = await rpcServer<boolean>("petromin_member", { p_id: s.id, p_token: s.token });
  return r.data === true;
}

// May the visitor book Victory Lap (a Community member or a Victory Lap tag holder)? Only they are told
// its price (the owner, 2026-10-17); its card and Details are everyone's. The booking app's own answer
// (vlap_member, a bare boolean like community_member's, which checks the token; rentals 20261017210000);
// any failure reads as no, a database without the function too.
async function vlapMember(): Promise<boolean> {
  const s = decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
  if (!s) return false;
  const r = await rpcServer<boolean>("vlap_member", { p_id: s.id, p_token: s.token });
  return r.data === true;
}

// Are Saturday rides booked at micromobility.sa/saturday, with a ride code (the owner, 2026-11-08)? Staff switch it on in
// the booking app (saturday_link_only, rentals 20261108120000); then a Saturday date's button goes to that page, for
// anyone with a code, member or not. Any failure, or a database without the function, reads as no: the booking app.
async function saturdayLinkOnly(): Promise<boolean> {
  const r = await rpcServer<boolean>("saturday_link_only", {});
  return r.data === true;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("experiences");
  const c = resolvePage(experiencesSchema, content, asLocale(locale));
  return pageMeta({ path: "/experiences", locale, title: `${serverL(locale)("Experiences", "التجارب")} · Micromobility`, description: S(c.hero.text), closed });
}

export default async function ExperiencesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const [{ content, previewing, hidden }, rides, member, petromin, gv] = await Promise.all([pageState("experiences"), loadRides(), communityMember(), petrominMember(), genderViewer()]);
  // asked only while a Victory Lap date is on the books: its price is said to those who may book it
  const vlBook = (rides?.sessions ?? []).some((s) => s.kind === "vlap") ? await vlapMember() : false;
  // and while a Saturday date is: whether it is booked at micromobility.sa/saturday with a code
  const satLink = (rides?.sessions ?? []).some((s) => s.kind === "saturday") ? await saturdayLinkOnly() : false;
  const site = resolvePage(siteSchema, content, L);
  const kw = kindThemeWords(locale); // the card, its list and the Saturday ride (components/experiences/KindTheme.words.ts)
  const c = resolvePage(experiencesSchema, content, L);
  const d = c.dates, e = c.events, st = c.steps;
  const book = bookingLink(S(c.hero.bookHref), locale);

  // "No preference" (Any) is staff's to give, never a rider's choice (the owner, 2026-10-09), so it is
  // not priced here; the booking app does not offer it either.
  const prices = (rides?.prices ?? []).filter((p) => p.type !== "Any").sort((a, b) => {
    const i = (t: string) => (TYPE_ORDER.indexOf(t) + 1 || 99);
    return i(a.type) - i(b.type) || a.type.localeCompare(b.type);
  });
  const sar = (n: number) => fmtSar(n, locale);
  // A type's highest fare (ride_prices max_price, the booking app's priceDisplay): "SAR 75 – SAR 90"
  // when an admin set one above the fare, else the fare alone.
  const fares = faresOf(rides?.prices);
  const sarRange = (type: string, lo: number) => {
    const hi = Math.max(lo, fares.max[type] ?? lo);
    return hi > lo ? `\u2066${sar(lo)} – ${sar(hi)}\u2069` : sar(lo);
  };
  // The caps an admin sets in the booking app (Settings > Business, site_content biz.public), which
  // the database's _group_ride_cap enforces: the cards' rules (jccNote, evNote) say them through
  // {riders} and {seats}. The About texts are the booking app's too (it reads them for its own sheet
  // and fills only the date's times), so they carry no such placeholder.
  const biz = bizOf(content);
  const caps = { riders: fmtNum(biz.jccAccountCap, locale), seats: fmtNum(biz.eventSeatMax, locale) };

  // a Petromin night without a title of its own is "Petromin", as the other pages name one
  const kindName = { ...kindNames(d), petromin: tx("Petromin", "بترومين"), blood: bloodName(tx) };
  const enName = L !== "en" ? { ...kindNames(resolvePage(experiencesSchema, content, "en").dates), petromin: "Petromin", blood: BLOOD_NAME } : kindName;
  const routes = routeNames(content, L); // a ride that follows a route on the Routes page is named after it
  const routeKm = routeItems(content, L);
  // What a ride costs before anything is picked (_sessFromPrice): the cheapest bike it offers.
  const fromPrice = (s: RideSession) => {
    const ps = prices.filter((p) => p.type !== "Any" && p.type !== "Own" && typeOffered(s, p.type)).map((p) => p.price);
    return ps.length ? fillAt(tx("from {0}", "من {0}"), sar(Math.min(...ps))) : null;
  };
  // A route's distance on the booking summary (the booking app's reg-side row): the route's own,
  // or a lap of the circuit on a circuit night without one.
  const kmWord = tx("{0} km", "{0} كم");
  const kmOf = (s: RideSession) => {
    const km = s.routeSlug ? routeKm.get(s.routeSlug)?.km ?? 0 : s.kind === "jcc" ? 6.174 : 0;
    return km > 0 ? fillAt(s.routeSlug ? kmWord : tx("{0} km a lap", "{0} كم للفة"), kmText(km)) : null;
  };
  const drawn = new Date();
  const now = riyadhClock(drawn);
  // every date ahead, men-only and women-only ones too, to every visitor (the owner, 2026-10-28)
  const all = upcoming(rides?.sessions ?? [], now);
  const sgWords = genderText(tx);
  // The booking window (site_content booking.window): a date not open yet is shown greyed, never hidden.
  const window = siteBookingWindow(content);
  const directions = S(site.contact.jccHref);
  const waitWord = tx("Waitlist", "قائمة الانتظار"), left1 = tx("{0} spot left", "{0} مقعد متبقي"), leftN = tx("{0} spots left", "{0} مقاعد متبقية");
  // "About this event" and "Details" (the owner, 2026-10-05; lib/event-info.ts): what each date is
  // and its facts, in the booking app's words - Experiences' own texts, which the booking app reads too.
  const dateTexts: DateTexts = {
    aboutJcc: S(d.aboutJcc), aboutSat: S(d.aboutSat), aboutPetro: S(d.aboutPetro), aboutSwim: S(d.aboutSwim), aboutWs: S(d.aboutWs), aboutRun: S(d.aboutRun), aboutVl: S(d.aboutVl), aboutDefe: S(d.aboutDefe), aboutAr: S(d.aboutAr), aboutYoga: S(d.aboutYoga),
    sndAbout: S(e.sndAbout), evAbout: S(e.evAbout),
  };
  const whoWords = {
    all: tx("Everyone", "الجميع"), members: tx("Community members", "أعضاء المجتمع"), members18: tx("Community members, 18 and over", "أعضاء المجتمع ممن أتموا 18 عامًا"),
    petromin: tx("Community members and Petromin's team", "أعضاء المجتمع وفريق بترومين"), // a Petromin night (the booking app's infoWhoPetromin, 2026-10-12)
    vlap: tx("Community members and Victory Lap athletes, 16 and over", "أعضاء المجتمع ورياضيو فيكتوري لاب، من 16 عامًا فأكثر"), // the booking app's infoWhoVlap (2026-10-17)
    arena: tx("Community members, in teams of two", "أعضاء المجتمع، في فرق من شخصين"), // the booking app's infoWhoArena (2026-10-28)
    arenaAll: tx("Everyone, in teams of two. You must have a partner.", "الجميع، في فرق من شخصين. يجب أن يكون لديك شريك."), // infoWhoArenaAll (2026-11-02)
  };
  // Victory Lap's races and divisions, in the booking app's words (vlRace_*, vlDiv_*)
  const vlWords = {
    races: { ws: tx("Women’s Singles", "فردي السيدات"), ms: tx("Men’s Singles", "فردي الرجال"), wd: tx("Women’s Doubles", "زوجي السيدات"), md: tx("Men’s Doubles", "زوجي الرجال"), xd: tx("Mixed Doubles", "زوجي مختلط") },
    divs: vlDivNames(locale), // Kamin Sports' names, in English but in Arabic, as the booking app keeps them
    km: kmWord,
  };
  // Victory Lap's price per athlete, to those who may book it alone (vlBook; the owner, 2026-10-17); Arena Heros', to
  // a community member alone, who may book it (2026-10-28)
  const athletePrice = (s: RideSession) => (s.kind === "vlap" && vlBook && s.price != null ? `${sar(s.price)} · ${tx("per athlete, VAT included", "لكل رياضي، شاملًا ضريبة القيمة المضافة")}`
    : s.kind === "arena" && (member || !s.members) && s.price != null ? `${sar(s.price)} · ${tx("per athlete, medals included", "لكل رياضي، شاملًا الميدالية")}` : null);
  // Arena Heros' facts (lib/arena.ts), in the booking app's words (arFormatTxt, arLvl_*, arGuide_*, arRulesLink): its
  // two races in Victory Lap's words, the organisers' two divisions (their names kept as the booking app keeps
  // Victory Lap's), each with its level and what it asks, the race's format, the prayer break under its window,
  // and the organisers' race details
  const ahWords = {
    races: { wd: vlWords.races.wd, md: vlWords.races.md }, divs: { op: vlWords.divs.op, el: vlWords.divs.el },
    guide: {
      op: { level: tx("Intermediate", "متوسط"), text: tx("Reduced loads, distances or volume. For athletes with a solid base in functional fitness who are not yet ready for Elite loads or volume: the same competitive spirit, with more accessible distances, repetitions and loads.", "أوزان أو مسافات أو أحجام تمرين مخففة. للرياضيين الذين يملكون أساسًا جيدًا في اللياقة الوظيفية ولم يصلوا بعد إلى أوزان النخبة أو حجمها: الروح التنافسية نفسها، بمسافات وتكرارات وأوزان أيسر.") },
      el: { level: tx("Advanced", "متقدم"), text: tx("Full prescribed loads, distances and volume. For highly trained athletes who regularly do high-intensity functional and hybrid training, with strong movement quality under fatigue and a competitive pace, with little or no scaling.", "الأوزان والمسافات وأحجام التمرين المقررة كاملة. للرياضيين المتمرسين الذين يمارسون التدريب الوظيفي والهجين عالي الشدة بانتظام، مع جودة حركة عالية تحت الإجهاد وإيقاع تنافسي، بلا تخفيف أو بقليل منه.") },
    },
  };
  const ahFormat = tx("Teams of two (two men or two women) · 7 stations · medals included", "فرق من شخصين (رجلان أو امرأتان) · 7 محطات · الميداليات مشمولة");
  const ahWhen = tx("With a break for prayer", "مع استراحة للصلاة");
  const venueWords = { meetingPoint: tx("Meeting point", "نقطة التجمع"), venueCircuit: tx("Jeddah Corniche Circuit", "حلبة كورنيش جدة"), venueJyc: tx("Jeddah Yacht Club", "نادي جدة لليخوت"), venueGymnation: tx("Gymnation, Tahlia Street", "Gymnation، شارع التحلية") };
  const clock = (hhmm: string) => fmtClock(hhmm, locale);
  // The Saturday ride's breakfast spot (and Run for Her's, 2026-10-14), told at a time staff choose (the owner,
  // 2026-10-06; lib/tickets.ts spotHeld): until then its card and Details say when; its meeting point shows (never
  // the circuit, meetHeld; Run for Her the Jeddah Yacht Club).
  const nearWords = { today: tx("Today", "اليوم"), tomorrow: tx("Tomorrow", "غداً") };
  const heldWhen = (s: RideSession) => (spotHeld(s) ? revealWhen(s.revealAt, locale, now.slice(0, 10), nearWords) : null);
  // The DEFE 5KM Run (2026-10-18), in the booking app's words (defeCause, defeKitLabel, defeKitTxt,
  // defeRegLabel, defeRegLinkShort, defeLogoAlt): its date card's cause line, and its Details' kit
  // collection and the way to register for the race itself (Defe's registration page).
  const defeWords = {
    cause: tx("Breast cancer awareness run", "جري للتوعية بسرطان الثدي"),
    kitLabel: tx("Kit collection", "استلام عُدّة السباق"), kit: tx("Jeddah Park · Wed 21 Oct · 4–10 PM", "جدة بارك · الأربعاء 21 أكتوبر · 4–10 م"),
    regLabel: tx("Race registration", "التسجيل في السباق"), regLink: tx("Defe registration", "تسجيل دفء"),
  };
  // Yoga (2026-11-12), in the booking app's words (ygWith, ygMin, ygLeadK, ygLeadV, ygDurK, ygLevelK, ygLevelV, ygBringK,
  // ygBringV): its date card's foot line and length, and its Details' rows
  const ygWords = {
    with: tx("with Jassim Alsaady", "مع جاسم الساعدي"), min: tx("{0} min", "{0} دقيقة"),
    leadK: tx("Led by", "يقدّمها"), leadV: tx("Jassim Alsaady", "جاسم الساعدي"), durK: tx("Length", "المدة"),
    levelK: tx("Level", "المستوى"), levelV: tx("All levels, no yoga experience needed", "جميع المستويات، ولا تلزم خبرة سابقة في اليوغا"),
    bringK: tx("Bring", "أحضر معك"), bringV: tx("Your yoga mat, and wear comfortable clothing", "سجادة اليوغا الخاصة بك، وارتدِ ملابس مريحة"),
  };
  // The Saturday ride's sunrise over the Corniche that day, in the page's clock (lib/kind-theme.ts), and its two routes'
  // words; null on any other kind.
  const sunrise = (s: RideSession) => (s.kind === "saturday" ? ((v) => (v ? clock(v) : null))(sunriseHhmm(s.date)) : null);
  const routeOf = (s: RideSession) => (s.kind === "saturday"
    ? { beg: fillAt(kmWord, kmText(s.groupKm?.beg ?? 20)), int: fillAt(kmWord, kmText(s.groupKm?.int ?? 40)), start: venueWords.meetingPoint, begPlace: venueWords.venueJyc, intPlace: kw.intPlace }
    : null);
  const toStep = (s: RideSession): StepSession => {
    const seatPrice = s.kind === "event" && s.price != null ? sar(s.price) : null;
    const sr = sunrise(s), route = routeOf(s);
    // when bikes go out and the price from, under the time, as the booking app's session card says them
    const collect = s.collect ? fillAt(tx("Collect bikes from {0}", "استلام الدراجات من {0}"), clock(s.collect)) : null;
    const from = !s.free && rentsBikes(s.kind) ? fromPrice(s) : null;
    const held = heldWhen(s);
    const place = meetHeld(s) ? { name: venueWords.meetingPoint, map: null } : infoPlace(s, venueWords, directions);
    return {
      // the booking app's session card: "Sunday · 26 Sept 2026", and its times in the rider's clock
      id: s.id, kind: s.kind, day: fmtDayDate(s.date, locale),
      // today or tomorrow said in words, as the booking app's session card does (_dayWord)
      near: ((w) => (w === "today" ? tx("Today", "اليوم") : w === "tomorrow" ? tx("Tomorrow", "غداً") : null))(dayWord(s.date, now.slice(0, 10))),
      name: sessionName(s, kindName, enName, L !== "en", L === "ar"),
      // a session with a start time alone (the DEFE 5KM Run) says it once: b is ""
      when: s.times ? { gather: s.gather && !oneTime(s.times), a: clock(s.times[0]), b: oneTime(s.times) ? "" : clock(s.times[1]) } : null,
      // a run and Victory Lap have no bikes, so never the bike prices
      // (nor the pool, the workshop or an event: "Per bike" prices only where bikes are rented, 2026-10-18)
      // (the Blood Donation event, free as it is, never says so: no price and no free word, as the booking app)
      members: s.members, free: s.free && s.kind !== "blood", full: s.full, paid: !s.free && rentsBikes(s.kind), noCarbon: s.noCarbon, closedTypes: s.closedTypes ?? [],
      // a Saturday ride booked with a ride code: anyone with a code, member or not, books it on its own page
      ...(satLink && s.kind === "saturday" ? { members: false, satLink: `/saturday?lang=${locale}` } : {}),
      // the DEFE 5KM Run's own card (the booking app's _defeSessCard): the logo, its name, when, how far and
      // where, and the cause along the foot
      ...(s.kind === "defe5k" ? { defe: { meta: [s.times ? clock(s.times[0]) : "", fillAt(kmWord, 5), place.name].filter(Boolean), cause: defeWords.cause } } : {}),
      // yoga's own card (the booking app's _ygSessCard, 2026-11-12): its start and end, how long, where, and who leads it
      ...(s.kind === "yoga" ? { yoga: { meta: [s.times ? (oneTime(s.times) ? clock(s.times[0]) : `${clock(s.times[0])} – ${clock(s.times[1])}`) : "", yogaLength(s.times, ygWords.min), place.name].filter(Boolean), with: ygWords.with } } : {}),
      // a featured date (the booking app's _featCardHtml, 2026-11-13): its day as its Featured card's tile, and how long
      // yoga runs, which that card says after its time
      ...(s.featured ? { feat: { ...fmtDayTile(s.date, locale), len: s.kind === "yoga" ? yogaLength(s.times, ygWords.min) || null : null } } : {}),
      // a copy kept at the edge from before these fields existed reads as an event without them
      event: s.kind === "event", description: s.kind === "event" ? s.description ?? null : null,
      seatPrice, seats: s.kind === "event" && s.seats != null ? fmtNum(s.seats, locale) : null,
      // Victory Lap's payment, as the booking app's review step says it under the price (2026-10-23); Arena Heros':
      // announced later (the owner, 2026-10-28), unless staff wrote how (sessions.vl.pay)
      ...(athletePrice(s) ? { payNote: s.kind === "arena"
        ? ahPayLine(ahConfig(s.vl), locale, tx("Pay by bank transfer after booking and upload the receipt. Your QR code and number appear once your payment is confirmed.", "ادفع بتحويل بنكي بعد الحجز وارفع الإيصال. يظهر رمز QR ورقمك بعد تأكيد الدفع."))
        : vlPayLine(vlConfig(s.vl), locale, tx("Once booked, tell us whether you already have a ticket or buy one by bank transfer.", "بعد الحجز، أخبرنا إن كانت لديك تذكرة بالفعل أو اشترِ واحدة بتحويل بنكي.")) } : {}),
      route: routeNameOf(routes, s.routeSlug),
      routeKm: kmOf(s),
      // men only, women only or mixed (the owner, 2026-10-27): its chip, and the refusal a signed-in account of the
      // other gender (or with none on file) reads in place of the button; a visitor who is not signed in keeps the
      // button, and the booking app signs them in and judges the booking (the owner, 2026-10-28)
      sg: genderChip(s, sgWords),
      refusal: genderBlock(s, gv, sgWords),
      // the Saturday ride's (and Run for Her's) breakfast stop, by its Arabic name on the Arabic page when it has one
      breakfast: infoBreakfast(s, locale),
      reveal: held ? fillAt(tx("Breakfast spot: announced {0}", "موقع الفطور: يُعلَن عنه {0}"), held) : null,
      left: s.left ?? null,
      meta: [collect, from, sr && fillAt(kw.sunriseAt, sr)].filter((x): x is string => !!x),
      // within a day of opening, a countdown to the real window that the browser keeps up to date each minute (opensAt)
      opens: window && notOpenYet(s.date, window, now, s.kind) ? opensText(s.date, window, locale, tx, drawn.getTime()) : null,
      opensAt: window && notOpenYet(s.date, window, now, s.kind) ? opensAt(s.date, window) : null,
      // its Details: staff's own line for the date shows under the text, except on an event, whose
      // description is the text
      info: {
        text: dateText(s, dateTexts, infoTimes(s, clock)), extra: s.kind === "event" ? null : s.description ?? null,
        // a session for one gender open to everyone: its chip says who, never "Everyone" beside it
        who: s.gender && !s.members ? "" : infoWho(s, whoWords), price: infoPrice(s, { free: S(d.free), seat: seatPrice && fill(S(d.perSeat), { price: seatPrice }), from, athlete: athletePrice(s) }),
        collect, place: place.name, map: place.map,
        // the Saturday ride: when the sun rises, after when it is, and its two routes drawn above the facts
        ...(sr ? { sunrise: sr } : {}), ...(route ? { route } : {}),
        distance: infoDistance(s.kind, kmWord), places: infoPlaces(s, { waitlist: waitWord, left1, leftN }),
        ...((v) => (v ? { races: v.races, divs: v.divs } : {}))(infoVl(s, vlWords)),
        ...((v) => (v ? { races: v.races, divs: v.divs, guide: v.guide, format: ahFormat, whenNote: ahWhen, link: { label: tx("Race details", "تفاصيل السباق"), text: tx("The workout and standards, from the organisers", "التمارين والمعايير من المنظمين"), url: AH_INFO_URL } } : {}))(infoArena(s, ahWords)),
        // the DEFE 5KM Run: when the kits go out, and where the race itself is entered (the booking app's _infoFacts)
        ...(s.kind === "defe5k" ? { kit: { label: defeWords.kitLabel, text: defeWords.kit }, race: { label: defeWords.regLabel, link: defeWords.regLink, url: DEFE_RACE_URL } } : {}),
        // yoga: who leads it, how long, the level and what to bring, after where (the booking app's _infoFacts)
        ...(s.kind === "yoga" ? { more: yogaKnow(ygWords, yogaLength(s.times, ygWords.min)).map(([k, v]) => ({ k, v })) } : {}),
      },
    };
  };
  // The booking app's events (lib/event-info.ts eventCards): the circuit and the community rides
  // always, the others while they have dates - Petromin Days (the owner, 2026-10-12) first, and only
  // to a Petromin tag holder, then Run for Her, as on the booking app's landing.
  // Victory Lap's card (the owner picked D for the booking app, 2026-10-17): under its line, its soonest
  // date ("26 Oct"), when the doors open and JCC, as the booking app's _vlCardHtml says them.
  const vlLine = (s: RideSession | undefined): string[] => {
    if (!s) return [];
    let day = s.date;
    try { day = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${s.date}T12:00:00Z`)); } catch { /* the date as stored */ }
    return [day, s.times ? clock(s.times[0]) : "", tx("JCC", "حلبة الكورنيش")].filter(Boolean);
  };
  // Arena Heros' card (2026-10-28; the organisers' poster on it since 2026-10-29, as the booking app's): its name
  // under the logo, then its soonest date, its hours and where, then its line - never the price.
  const ahLine = (s: RideSession | undefined): string[] => {
    if (!s) return [];
    const [day] = vlLine(s);
    const place = infoPlace(s, venueWords, directions).name;
    return [day, s.times ? (oneTime(s.times) ? clock(s.times[0]) : `${clock(s.times[0])} – ${clock(s.times[1])}`) : "", place].filter(Boolean);
  };
  // The Blood Donation event's card (2026-11-03, the booking app's _bldCardWrap, _bldWhenTxt): the hosts' plate, its name, its
  // day, hours and venue, its tagline and the four short rules, and what its About opens, the hospital's poster in Arabic
  // and English with the PDF the booking app holds. Asked for only when it has a date, so a page without one holds none of it.
  const bloodCard = (s: RideSession | undefined): Partial<StepEvent> => {
    const b = bloodWords(tx);
    let day = s?.date ?? "";
    try { day = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${s?.date}T12:00:00Z`)); } catch { /* the date as stored */ }
    return {
      title: b.name,
      line: s ? [day, s.times ? (oneTime(s.times) ? clock(s.times[0]) : `${clock(s.times[0])} – ${clock(s.times[1])}`) : "", infoPlace(s, venueWords, directions).name].filter(Boolean) : [],
      blood: {
        plate: { src: bloodPlate(locale), alt: b.plateAlt, ...BLOOD_PLATE_SIZE }, picture: BLOOD_CARD, types: b.types, line: b.typesLine, cause: b.cause, rules: b.rules,
        info: { title: b.infoTitle, language: b.language, pdf: { label: b.infoPdf, url: `${new URL(BOOKING_URL).origin}/assets/blood-donation-poster.pdf` }, poster: bloodPoster },
      },
    };
  };
  const ev: Sec = e; // the cards' texts by prefix: the Blood Donation event has no fields here, and its card brings its own
  // each card with the dates it lists (Experiences > Dates: how many per event)
  // (and every date on its books, onBooks, for the Experiences card's marks)
  const cards = eventCards(all, { member, petromin }).map(({ card, sessions }) => ({ card, sessions: sessions.slice(0, Math.max(1, N(d.count))), onBooks: sessions }));
  const events: StepEvent[] = cards.map(({ card: { key, p }, sessions, onBooks }) => ({
    key, title: S(ev[`${p}Title`]), meta: S(ev[`${p}Meta`]), logo: S(ev[`${p}Logo`]), note: fill(S(ev[`${p}Note`]), caps), about: S(ev[`${p}About`]),
    sessions: sessions.map(toStep),
    // the Experiences card: a mark for each kind it has a date for (every one on its books, not only those it lists),
    // named for a screen reader by the kinds' names
    ...(key === "community" ? ((m) => (m.length ? { marks: { kinds: m, label: m.map((k) => kindName[k as RideKind]).join(" · ") } } : {}))(kindMarks(onBooks)) : {}),
    ...(key === "vlap" ? { line: vlLine(sessions[0]) } : key === "arena" ? { line: ahLine(sessions[0]), name: kindName.arena, must: tx("You must have a partner to take part. There are no individual entries.", "يجب أن يكون لديك شريك للمشاركة. لا يوجد تسجيل فردي.") } : key === "blood" ? bloodCard(sessions[0]) : {}),
  }));
  const text: StepText = {
    steps: [S(st.stepEvent), S(st.stepDate), S(st.stepBook)], eventTitle: S(st.eventTitle), dateTitle: S(st.dateTitle), bookTitle: S(st.bookTitle),
    cont: S(st.continue), waitlist: S(d.waitlist), back: S(st.back), noDates: S(st.noDates), handoff: S(st.handoff),
    members: S(d.members), free: S(d.free), full: S(d.full), gather: S(d.gather), start: S(d.start), membersNote: S(d.membersNote), clubLink: S(d.clubLink),
    // a date without a bike says booking, participants and sessions (2026-10-18)
    bookTitleNb: tx("Your booking", "حجزك"),
    handoffNb: S(st.handoff) ? tx("The booking app opens on this date: sign in, add the participants and confirm.", "يفتح تطبيق الحجز على هذا الموعد: سجّل الدخول وأضف المشاركين وأكّد.") : "",
    membersNoteNb: tx("Sessions marked Members are for Club members.", "الفعاليات المعلَّمة «للأعضاء» مخصصة لأعضاء النادي."),
    available: tx("Available", "متاح"), waitlisted: waitWord, left1, leftN,
    // the booking app's featTitle and featRest (2026-11-13)
    featured: tx("Featured", "مميّزة"), upcoming: tx("Upcoming", "المواعيد القادمة"),
    pricesTitle: S(c.prices.title), pricesText: S(c.prices.text), codeNote: S(c.prices.codeNote),
    everyone: S(d.everyone), perSeat: S(d.perSeat), seats: S(d.seats), route: tx("Route", "المسار"),
    breakfastAt: tx("Breakfast at {0}", "الإفطار في {0}"),
    opensIn: opensInWords(tx),
    info: {
      about: tx("About this event", "عن هذه الفعالية"), details: tx("Details", "التفاصيل"),
      bookEvent: tx("Book this event", "احجز هذه الفعالية"), chooseDate: tx("Choose this date", "اختر هذا الموعد"),
      who: tx("Who", "لمن"), price: tx("Price", "السعر"), when: tx("When", "الموعد"), next: tx("Next date", "الموعد القادم"),
      where: tx("Where", "المكان"), map: tx("Map", "الخريطة"), distance: tx("Distance", "المسافة"), places: tx("Places", "الأماكن"),
      races: tx("Races", "السباقات"), divs: tx("Divisions", "الفئات"), format: tx("Format", "النظام"),
      after: tx("After", "بعدها"), whoMembers: whoWords.members, close: tx("Close", "إغلاق"),
      aboutShort: kw.about, seeDates: kw.seeDates, sunrise: kw.sunrise,
    },
    // the kind switch over a list of two kinds or more: its name, All, and each kind by its short name, else its own
    // (the kinds on the page's dates alone: the Blood Donation event's name never reaches the browser without its date)
    kinds: { show: kw.show, all: kw.all, names: Object.fromEntries([...new Set(all.map((s) => s.kind))].map((k) => [k, (kw.kinds as Record<string, string>)[k] ?? kindName[k]])) },
    chooseDate: kw.chooseDate,
  };

  const good = list(c.good.items).filter((g) => S(g.title));
  const learn = learnTeaser(c.learn); // Learn to ride: the lessons sign-up, while staff offer lessons
  const whatsapp = S(site.social.whatsapp);

  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="xp">
        <section className="xp-hero" style={{ backgroundImage: `linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,.25) 46%,rgba(0,0,0,.12) 70%),url('${bg(S(c.hero.image))}')` }}>
          <p className="xp-eyebrow">{S(c.hero.eyebrow)}</p>
          <h1>{S(c.hero.title)}</h1>
          <p className="xp-hero-text">{S(c.hero.text)}</p>
          <div className="xp-btns">
            <a className="xp-btn" href="#book">{S(c.hero.bookBtn)} <ArrowIcon size={15} /></a>
          </div>
        </section>

        <div className="xp-wrap">
          <section className="xp-sec" id="book">
            <ExperienceSteps locale={locale} events={events} featured={featuredDates(cards)} bookHref={book} clubHref={hidden.includes("club") ? "" : localHref("/club", locale)} member={member} petromin={petromin} text={text}
              prices={prices.map((p) => ({ type: p.type, label: TYPE_NAME[p.type] ? tx(TYPE_NAME[p.type].en, TYPE_NAME[p.type].ar) : p.type, price: p.price > 0 ? sarRange(p.type, p.price) : S(d.free) }))} />
          </section>

          {learn && <LearnTeaser locale={locale} t={learn} place="experiences" />}

          {good.length > 0 && (
            <section className="xp-sec" aria-labelledby="xp-good-h">
              <h2 id="xp-good-h">{S(c.good.title)}</h2>
              <div className="xp-good">
                {good.map((g, i) => <div key={i}><strong>{S(g.title)}</strong>{S(g.text) && <p>{S(g.text)}</p>}</div>)}
              </div>
            </section>
          )}

          <div className="xp-btns xp-end">
            {directions && S(c.good.directions) && <a className="xp-btn line" href={directions} target="_blank" rel="noopener">{S(c.good.directions)}</a>}
            {whatsapp && <a className="xp-btn line" href={whatsapp} target="_blank" rel="noopener">{tx("WhatsApp", "واتساب")}</a>}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
