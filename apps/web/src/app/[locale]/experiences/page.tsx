import type { Metadata } from "next";
import { cookies } from "next/headers";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import "@/components/experiences/experiences.css";
import "@/components/booking/booking.css";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { fill, fmtNum, fmtSar } from "@/lib/fill";
import { bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { genderViewer, rpcServer } from "@/lib/account";
import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { dateText, eventCards, infoArena, infoBreakfast, infoDistance, infoPlace, infoPlaces, infoPrice, infoTimes, infoVl, infoWho, rentsBikes, type DateTexts } from "@/lib/event-info";
import { bizOf, faresOf } from "@/lib/biz";
import { kindNames, loadRides, oneTime, sessionName, upcoming, type RideSession } from "@/lib/rides";
import { routeItems, routeNameOf, routeNames } from "@/lib/route-names";
import { notOpenYet, opensText, siteBookingWindow } from "@/lib/booking-window";
import ExperienceSteps, { type StepEvent, type StepSession, type StepText } from "@/components/experiences/ExperienceSteps";
import LearnTeaser, { learnTeaser } from "@/components/learn/LearnTeaser";
import { riyadhClock } from "@/lib/workshop-days";
import { DEFE_RACE_URL, dayWord, fmtClock, fmtDayDate, kmText, meetHeld, revealWhen, spotHeld } from "@/lib/tickets";
import { serverL } from "@/i18n/dicts";
import { fill as fillAt, phrase } from "@/i18n/tx";
import { intlOf, isRtl } from "@/i18n/locales";
import { bg } from "@/lib/img";
import { vlConfig, vlDivNames, vlPayLine } from "@/lib/vlap";
import { AH_INFO_URL, ahConfig, ahPayLine } from "@/lib/arena";
import { genderBlock, genderChip, genderText } from "@/lib/session-gender";

// micromobility.sa/experiences - booking in steps (ExperienceSteps): the event, a date, then the
// ride with its prices and rules, handed to the booking app on that event and date. The events,
// dates and prices are read live from the booking system. A session for men only or women only (the
// owner, 2026-10-27; lib/session-gender.ts) is listed to every visitor, signed in or not, of either gender,
// as a mixed one is (the owner, 2026-10-28: "make all pool sessions visible to all genders but only male can
// book male sessions and female can book female sessions"); every date of one and every pool date wears its
// chip, and a signed-in account of the other gender is told so in place of the button that hands the booking
// over. Arena Heros (the owner, 2026-10-28) is for community members alone: its card is everyone's, its About,
// its dates' Details and its price are members' (community_member), and its last step hands over to the booking
// app (?ev=arena), which has the athlete step.
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
  const site = resolvePage(siteSchema, content, L);
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
  const kindName = { ...kindNames(d), petromin: tx("Petromin", "بترومين") };
  const enName = L !== "en" ? { ...kindNames(resolvePage(experiencesSchema, content, "en").dates), petromin: "Petromin" } : kindName;
  const routes = routeNames(content, L); // a ride that follows a route on the Routes page is named after it
  const routeKm = routeItems(content, L);
  // What a ride costs before anything is picked (_sessFromPrice): the cheapest bike it offers.
  const fromPrice = (s: RideSession) => {
    const ps = prices.filter((p) => p.type !== "Any" && p.type !== "Own" && !(s.noCarbon && p.type === "Road Carbon")).map((p) => p.price);
    return ps.length ? fillAt(tx("from {0}", "من {0}"), sar(Math.min(...ps))) : null;
  };
  // A route's distance on the booking summary (the booking app's reg-side row): the route's own,
  // or a lap of the circuit on a circuit night without one.
  const kmWord = tx("{0} km", "{0} كم");
  const kmOf = (s: RideSession) => {
    const km = s.routeSlug ? routeKm.get(s.routeSlug)?.km ?? 0 : s.kind === "jcc" ? 6.174 : 0;
    return km > 0 ? fillAt(s.routeSlug ? kmWord : tx("{0} km a lap", "{0} كم للفة"), kmText(km)) : null;
  };
  const now = riyadhClock(new Date());
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
    aboutJcc: S(d.aboutJcc), aboutSat: S(d.aboutSat), aboutPetro: S(d.aboutPetro), aboutSwim: S(d.aboutSwim), aboutWs: S(d.aboutWs), aboutRun: S(d.aboutRun), aboutVl: S(d.aboutVl), aboutDefe: S(d.aboutDefe), aboutAr: S(d.aboutAr),
    sndAbout: S(e.sndAbout), evAbout: S(e.evAbout),
  };
  const whoWords = {
    all: tx("Everyone", "الجميع"), members: tx("Community members", "أعضاء المجتمع"), members18: tx("Community members, 18 and over", "أعضاء المجتمع ممن أتموا 18 عامًا"),
    petromin: tx("Community members and Petromin's team", "أعضاء المجتمع وفريق بترومين"), // a Petromin night (the booking app's infoWhoPetromin, 2026-10-12)
    vlap: tx("Community members and Victory Lap athletes, 16 and over", "أعضاء المجتمع ورياضيو فيكتوري لاب، من 16 عامًا فأكثر"), // the booking app's infoWhoVlap (2026-10-17)
    arena: tx("Community members, in teams of two", "أعضاء المجتمع، في فرق من شخصين"), // the booking app's infoWhoArena (2026-10-28)
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
    : s.kind === "arena" && member && s.price != null ? `${sar(s.price)} · ${tx("per athlete, medals included", "لكل رياضي، شاملًا الميدالية")}` : null);
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
  const toStep = (s: RideSession): StepSession => {
    const seatPrice = s.kind === "event" && s.price != null ? sar(s.price) : null;
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
      name: sessionName(s, kindName, enName, L !== "en"),
      // a session with a start time alone (the DEFE 5KM Run) says it once: b is ""
      when: s.times ? { gather: s.gather && !oneTime(s.times), a: clock(s.times[0]), b: oneTime(s.times) ? "" : clock(s.times[1]) } : null,
      // a run and Victory Lap have no bikes, so never the bike prices
      // (nor the pool, the workshop or an event: "Per bike" prices only where bikes are rented, 2026-10-18)
      members: s.members, free: s.free, full: s.full, paid: !s.free && rentsBikes(s.kind), noCarbon: s.noCarbon,
      // the DEFE 5KM Run's own card (the booking app's _defeSessCard): the logo, its name, when, how far and
      // where, and the cause along the foot
      ...(s.kind === "defe5k" ? { defe: { meta: [s.times ? clock(s.times[0]) : "", fillAt(kmWord, 5), place.name].filter(Boolean), cause: defeWords.cause } } : {}),
      // a copy kept at the edge from before these fields existed reads as an event without them
      event: s.kind === "event", description: s.kind === "event" ? s.description ?? null : null,
      seatPrice, seats: s.kind === "event" && s.seats != null ? fmtNum(s.seats, locale) : null,
      // Victory Lap's payment, as the booking app's review step says it under the price (2026-10-23); Arena Heros':
      // announced later (the owner, 2026-10-28), unless staff wrote how (sessions.vl.pay)
      ...(athletePrice(s) ? { payNote: s.kind === "arena"
        ? ahPayLine(ahConfig(s.vl), locale, tx("How to pay will be announced.", "سيُعلن عن طريقة الدفع لاحقًا."))
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
      meta: [collect, from].filter((x): x is string => !!x),
      opens: window && notOpenYet(s.date, window, now) ? opensText(s.date, window, locale, tx) : null,
      // its Details: staff's own line for the date shows under the text, except on an event, whose
      // description is the text
      info: {
        text: dateText(s, dateTexts, infoTimes(s, clock)), extra: s.kind === "event" ? null : s.description ?? null,
        // a session for one gender open to everyone: its chip says who, never "Everyone" beside it
        who: s.gender && !s.members ? "" : infoWho(s, whoWords), price: infoPrice(s, { free: S(d.free), seat: seatPrice && fill(S(d.perSeat), { price: seatPrice }), from, athlete: athletePrice(s) }),
        collect, place: place.name, map: place.map,
        distance: infoDistance(s.kind, kmWord), places: infoPlaces(s, { waitlist: waitWord, left1, leftN }),
        ...((v) => (v ? { races: v.races, divs: v.divs } : {}))(infoVl(s, vlWords)),
        ...((v) => (v ? { races: v.races, divs: v.divs, guide: v.guide, format: ahFormat, whenNote: ahWhen, link: { label: tx("Race details", "تفاصيل السباق"), text: tx("The workout and standards, from the organisers", "التمارين والمعايير من المنظمين"), url: AH_INFO_URL } } : {}))(infoArena(s, ahWords)),
        // the DEFE 5KM Run: when the kits go out, and where the race itself is entered (the booking app's _infoFacts)
        ...(s.kind === "defe5k" ? { kit: { label: defeWords.kitLabel, text: defeWords.kit }, race: { label: defeWords.regLabel, link: defeWords.regLink, url: DEFE_RACE_URL } } : {}),
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
  // Arena Heros' card (2026-10-28; no logo exists, so a wordmark): under its line, its soonest date, its hours and
  // where, never the price.
  const ahLine = (s: RideSession | undefined): string[] => {
    if (!s) return [];
    const [day] = vlLine(s);
    const place = infoPlace(s, venueWords, directions).name;
    return [day, s.times ? (oneTime(s.times) ? clock(s.times[0]) : `${clock(s.times[0])} – ${clock(s.times[1])}`) : "", place].filter(Boolean);
  };
  const events: StepEvent[] = eventCards(all, { member, petromin }).map(({ card: { key, p }, sessions }) => ({
    key, title: S(e[`${p}Title`]), meta: S(e[`${p}Meta`]), logo: S(e[`${p}Logo`]), note: fill(S(e[`${p}Note`]), caps), about: S(e[`${p}About`]),
    sessions: sessions.slice(0, Math.max(1, N(d.count))).map(toStep),
    ...(key === "vlap" ? { line: vlLine(sessions[0]) } : key === "arena" ? { line: ahLine(sessions[0]) } : {}),
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
    pricesTitle: S(c.prices.title), pricesText: S(c.prices.text), codeNote: S(c.prices.codeNote),
    everyone: S(d.everyone), perSeat: S(d.perSeat), seats: S(d.seats), route: tx("Route", "المسار"),
    breakfastAt: tx("Breakfast at {0}", "الإفطار في {0}"),
    info: {
      about: tx("About this event", "عن هذه الفعالية"), details: tx("Details", "التفاصيل"),
      bookEvent: tx("Book this event", "احجز هذه الفعالية"), chooseDate: tx("Choose this date", "اختر هذا الموعد"),
      who: tx("Who", "لمن"), price: tx("Price", "السعر"), when: tx("When", "الموعد"), next: tx("Next date", "الموعد القادم"),
      where: tx("Where", "المكان"), map: tx("Map", "الخريطة"), distance: tx("Distance", "المسافة"), places: tx("Places", "الأماكن"),
      races: tx("Races", "السباقات"), divs: tx("Divisions", "الفئات"), format: tx("Format", "النظام"),
      after: tx("After", "بعدها"), whoMembers: whoWords.members, close: tx("Close", "إغلاق"),
    },
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
            <a className="xp-btn" href="#book">{S(c.hero.bookBtn)} <span aria-hidden="true">{(isRtl(locale) ? "←" : "→")}</span></a>
          </div>
        </section>

        <div className="xp-wrap">
          <section className="xp-sec" id="book">
            <ExperienceSteps locale={locale} events={events} bookHref={book} clubHref={hidden.includes("club") ? "" : localHref("/club", locale)} member={member} petromin={petromin} text={text}
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
