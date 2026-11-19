import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell, { navFrom } from "@/components/site/PageShell";
import "@/components/account/account.css";
import "@/components/account/account-menu.css";
import "@/components/booking/booking.css";
import "../account/handoff.css";
import TicketCard, { TicketCancelled } from "@/components/booking/TicketCard";
import { TicketWake } from "@/components/booking/TicketParts";
import RateRide from "@/components/account/RateRide";
import Qr from "@/components/booking/Qr";
import { Appointment } from "@/components/account/AccLists";
import { wsStatus } from "@/components/account/AccLists";
import { accWords } from "@/components/account/AccountMenu.words";
import { volunteerWords } from "@/components/account/Volunteer.words";
import { T as TICKET } from "@/components/booking/tickets.text";
import { T as WS_TRACK } from "@/components/workshop/WorkshopTrack.text";
import { handoffNotice, signedOutView, unreadView } from "@/components/account/gate";
import { accountSchema } from "@/content/pages/account";
import { bloodName, bloodWords, BLOOD_NAME } from "@/content/blood-words";
import { FARM_NAME, farmName } from "@/content/farm-words";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { readAccount, readBookings, rpcServer } from "@/lib/account";
import { bloodRewards, isBloodId, rewardGood } from "@/lib/blood";
import { asLocale, resolvePage } from "@/lib/content";
import { bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { kindNames, sessionName } from "@/lib/rides";
import { routeItems } from "@/lib/route-names";
import { routePageOf } from "@/lib/route-track";
import { RATE_FROM, formOf, pendingRating, ratingNoBike, rideWord, unratedRides } from "@/lib/rating";
import { tmAboutOfKind } from "@/lib/testimonials";
import { isNonBike } from "@/lib/bike-kinds";
import { loadAddonItems } from "@/lib/ticket-addons";
import { BOOTH_DIR, bfFor, bloodDone, breakfastFor, cancelledGroups, doneToday, fmtClock, fmtDayDate, lockersOf, lockerStart, lockerText, ownLockersOf, placeLink, shareLink, ticketRow,
  type TicketSession, ticketCue, ticketGroups, ticketRoute, todayCode } from "@/lib/tickets";
import { anyoneAhead, loadTicketSessions } from "@/lib/tickets-data";
import { bikeReport } from "@/lib/bike-report";
import { bikeName } from "@/lib/ride-record-data";
import { walletOf } from "@/lib/wallet";
import { riyadhClock } from "@/lib/workshop-days";
import { riyadhParts, upcomingJobs, workshopJobsOf } from "@/lib/workshop-mine";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { phrase } from "@/i18n/tx";
import { bizOf } from "@/lib/biz";
import { ArrowIcon } from "@/components/site/Icons";
import AccIcon from "@/components/account/AccIcon";
import type { VolunteerMe } from "@/components/account/VolunteerCard";

// micromobility.sa/bookings - every booking the rider has, in one place (the user, 2026-11-19: "make sure to have a page
// or dedicated space for purchases and workshop appointments and unified place to have all upcoming appointments for
// everything"; the booking app's Bookings tab, reached from the ticket in the header as there): what is ahead, soonest
// first - the ride and session tickets as the booking app draws them (the QR, the countdown, Still coming?, a bike
// problem, help on the ride, the wallet; changing one opens the booking app), the workshop appointments, the lockers
// taken without a booking, the volunteer shifts and the learn-to-ride lessons - then the cancelled ones, the rides to
// rate, and the rides done. Moved here from My Account (/account), which is the booking app's profile menu now.
const S = (v: unknown) => (typeof v === "string" ? v : "");
const TYPE_NAME: Record<string, { en: string; ar: string }> = {
  Road: phrase("Road", "طريق"), Hybrid: phrase("Hybrid", "هجين"), Mountain: phrase("Mountain", "جبلي"), "Road Carbon": phrase("Road Carbon", "طريق كربون"),
  Kids: phrase("Kids", "أطفال"), Gravel: phrase("Gravel", "حصى"), Any: phrase("Any bike", "أي دراجة"), Own: phrase("Own bike", "دراجتي الخاصة"),
};
/** One booking among those ahead, for the soonest-first order: its day and time (HH:MM, "" when not known). */
type Ahead = { key: string; date: string; time: string; node: React.ReactNode };
const byWhen = (a: Ahead, b: Ahead) => a.date.localeCompare(b.date) || (a.time || "99").localeCompare(b.time || "99") || a.key.localeCompare(b.key);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMeta({ path: "/bookings", locale, title: `${accWords(locale).bookings} · Micromobility`, noindex: true });
}

export default async function BookingsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const handoffState = (await searchParams).handoff;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const w = accWords(locale);
  const [{ content, previewing, hidden }, read] = await Promise.all([pageState("account"), readAccount()]);
  const acct = read === "unread" ? null : read;
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(accountSchema, content, L);
  const app = navFrom(site).booking; // the booking app as staff set it
  const book = bookingLink(app, locale);
  const handoff = (auth?: string) => bookingLink(`${app.replace(/[?#].*$/, "")}?handoff=site${auth ? `&auth=${auth}` : ""}`, locale);
  const again = localHref("/bookings", locale);
  const shell = (body: React.ReactNode) => <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>{body}</PageShell>;
  if (read === "unread") return shell(unreadView(tx, again));
  if (!acct) return shell(await signedOutView({ tx, locale, expired: handoffState === "expired", signin: c.signin, handoff }));

  const notice = await handoffNotice({ tx, acct, state: handoffState });
  const a = { p_id: acct.id, p_token: acct.token };
  // the bookings; when they could not be read, the page says so rather than that there are none
  const booked = await readBookings(acct);
  const unread = booked === null;
  const rows = booked ?? [];
  const tryAgain = tx("Try again", "حاول مرة أخرى");
  const now = riyadhClock(new Date());
  const today = now.slice(0, 10);
  const d = resolvePage(experiencesSchema, content, L).dates;
  // (the Farm House Night's name is the server's, content/farm-words.ts: on a member's own ticket)
  const names = { ...kindNames(d), petromin: tx("Petromin", "بترومين"), blood: bloodName(tx), farm: farmName(tx) };
  const enNames = { ...kindNames(resolvePage(experiencesSchema, content, "en").dates), blood: BLOOD_NAME, farm: FARM_NAME };
  const ticketText = serverLocalize(TICKET, locale);
  const typeName = (ty: string) => (TYPE_NAME[ty] ? tx(TYPE_NAME[ty].en, TYPE_NAME[ty].ar) : ty);
  const groups = ticketGroups(rows, today);
  const doneTonight = doneToday(rows, today);
  const cancelled = cancelledGroups(rows, today); // kept, said as such, until their day has gone (2026-11-10)
  const donorEarlier = bloodDone(rows, today); // the Blood Donation event, over: kept while its free ride is good
  // Finished rides not rated yet, one per night: the booking app's post-ride rating. The oldest from the day it went live
  // on is the pop-up the rider cannot skip (RatingGateLoader, on every page); only rides from before that day are cards.
  const gate = pendingRating(rows, today);
  const toRate = unratedRides(rows, today).filter((r) => r.date < RATE_FROM && r.entryId !== gate?.entryId).reverse().slice(0, 5);
  // The rides done before today, newest first (the booking app's Past rides): one line each, the latest twenty.
  const doneBefore = (() => {
    const seen = new Map<string, { sessionId: string; date: string }>();
    for (const r of rows.map(ticketRow)) if (r && r.status === "done" && r.date < today && !seen.has(r.sessionId)) seen.set(r.sessionId, { sessionId: r.sessionId, date: r.date });
    return [...seen.values()].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 20);
  })();
  // every booked session, whatever its state now (a Petromin night, one staff closed since), read with the account's token
  // so a private ride (one its tag holders alone may see) keeps its name
  const [sessions, walletRead, lockersRaw, wsR, volR, learnR] = await Promise.all([
    loadTicketSessions([...groups.map((g) => g.sessionId), ...doneTonight.map((g) => g.sessionId), ...donorEarlier.map((g) => g.sessionId), ...toRate.map((r) => r.sessionId),
      ...(gate ? [gate.sessionId] : []), ...cancelled.map((g) => g.sessionId), ...doneBefore.map((x) => x.sessionId)], acct),
    // the wallet (rentals 20261102210000): no pay button while the database has none or cannot be read
    rpcServer<unknown>("customer_wallet", a).then((r) => (r.status === 200 ? walletOf(r.data) : null)),
    // the lockers (rentals 20261109120000): the period and number on a ticket's locker line, and the ones taken alone
    rpcServer<unknown>("customer_lockers", a).then((r) => (r.status === 200 ? r.data : null)),
    // the workshop appointments (customer_workshop_jobs, rentals 20261119500000): none until the function is there
    rpcServer<unknown>("customer_workshop_jobs", a),
    // the volunteer shifts (volunteer_me, rentals 20261105120000): none on a database without it
    rpcServer<VolunteerMe & { mine?: unknown[] }>("volunteer_me", a),
    // the learn-to-ride lessons (learn_ladder, rentals 20261114082100): an account whose sign-up has a lesson
    rpcServer<{ ok?: boolean; learners?: unknown[] }>("learn_ladder", a),
  ]);
  // A ride whose breakfast spot is for community members only (bike_slots._bfm) tells it to a member alone.
  if ([...sessions.values()].some((x) => x.bfMembers)) {
    const mem = (await rpcServer<boolean>("community_member", a)).data === true;
    for (const [k, v] of sessions) sessions.set(k, bfFor(v, mem));
  }
  const lockers = lockersRaw == null ? null : lockersOf(lockersRaw);
  const own = ownLockersOf(lockersRaw, today);
  // The Blood Donation event (2026-11-03): a donor's free ride, asked only when a ticket is on the event. The event over,
  // its ticket stays as a past card while the code on it is still good.
  const isDonation = (id: string) => sessions.get(id)?.kind === "blood" || isBloodId(id);
  const donorRewards = [...groups, ...doneTonight, ...donorEarlier].some((g) => isDonation(g.sessionId))
    ? await rpcServer<unknown>("customer_blood_rewards", a).then((r) => bloodRewards(r.data))
    : null;
  const past = [...doneTonight, ...donorEarlier.filter((g) => g.rows.some((r) => rewardGood(donorRewards?.get(r.id), today)))];
  const donor = donorRewards ? { words: bloodWords(tx), rewards: donorRewards } : null;
  const routes = routeItems(content, L);
  const bikeOf = new Map(await Promise.all([...groups, ...past].filter((g) => g.date === today).map(async (g) => [g.sessionId, await bikeName(g.rows.find((r) => r.bikeId)?.bikeId ?? null)] as const)));
  const addonItems = await loadAddonItems([...groups, ...past].flatMap((g) => g.rows.flatMap((r) => r.addonLines.map((x) => x.id))));
  // Victory Lap and Arena Heros: each Doubles booking's partner by first name (customer_vl_teams), asked only when a ticket
  // holds a team; a database without the function, or a failed read, names nobody.
  const vlPartners = [...groups, ...past].some((g) => g.rows.some((r) => r.vl?.team || r.ah?.team))
    ? await rpcServer<unknown>("customer_vl_teams", a).then((r) => new Map(
      (Array.isArray(r.data) ? (r.data as Record<string, unknown>[]) : [])
        .filter((x) => x && typeof x.entry_id === "string" && typeof x.partner === "string" && x.partner.trim())
        .map((x) => [x.entry_id as string, (x.partner as string).trim()] as const)))
    : null;
  // "You're next" on a numbered night: said on the ride's day only, as the booking app does.
  const ahead = await Promise.all(groups.map((g) => {
    const s = sessions.get(g.sessionId), first = g.rows.find((r) => r.status === "waiting" && r.queueNum != null);
    return s && !s.approval && first && g.date === today ? anyoneAhead(g.sessionId, first.queueNum as number) : Promise.resolve(null);
  }));
  // a session that did not load is named by what it is: never "Ride" on one without a bike (2026-10-18)
  const rideName = (s: TicketSession | undefined, sessionId: string) =>
    (s ? sessionName(s, names, enNames, L !== "en") : isNonBike(null, sessionId) ? tx("Session", "الفعالية") : tx("Ride", "جولة"));
  const drawn = new Date().getTime(); // the countdown's first line, before the browser takes over
  // "Report a bike problem" (2026-11-13): a booking holding more than one bike asks which one, by the bikes' names
  const brpBikes = [...new Set([...groups, ...past].flatMap((g) => {
    const o = bikeReport(g.rows, sessions.get(g.sessionId), drawn)?.options ?? [];
    return o.length > 1 ? o.map((x) => x.bike) : [];
  }))].slice(0, 12);
  const bikeNames = new Map(await Promise.all(brpBikes.map(async (id) => [id, await bikeName(id)] as const)));
  // Changing a booking happens in the booking app: Edit reopens its date there, as the app's own Edit does; Reschedule and
  // Cancel open its My Bookings. (Victory Lap's and Arena Heros' details change in My Bookings there.)
  const EV: Record<string, string> = { jcc: "jcc", saturday: "community", swim: "community", workshop: "workshop", snd96: "snd96", event: "event", runher: "runher", vlap: "vlap", defe5k: "community", arena: "arena", blood: "blood", yoga: "community", farm: "community" };
  const appLink = (params: Record<string, string>) => {
    try { const u = new URL(app); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); return bookingLink(u.toString(), locale); }
    catch { return book; }
  };
  const manage = appLink({ tab: "bookings" });
  const myBookings = (() => { try { return new URL("/my-bookings", app).toString(); } catch { return null; } })();

  // ── What is ahead, soonest first ──
  const items: Ahead[] = groups.map((g, i) => {
    const s = sessions.get(g.sessionId);
    const ev = s ? EV[s.kind] : undefined;
    // a ride staff approve and Run for Her meet at the point staff set, Arena Heros and the Blood Donation event are at
    // their venue's map, a ride at another named place is searched by its name, the rest at the booth (BOOTH_DIR)
    const place = placeLink(s, BOOTH_DIR);
    return { key: `t-${g.key}`, date: g.date, time: s?.times?.[0] ?? "", node: (
      <TicketCard key={g.key} locale={locale} today={today} rows={g.rows} session={s}
        name={rideName(s, g.sessionId)}
        cue={ticketCue(g.rows, s, ahead[i])} t={ticketText} gather={S(d.gather)} start={S(d.start)} typeName={typeName}
        links={{ edit: ev ? appLink({ ev, session: g.sessionId }) : null, manage, place,
          // the live map follows the ride leader: a bike session's only (2026-10-18)
          live: g.date === today && (s ? s.bikes : !isNonBike(null, g.sessionId)) ? localHref(`/live?session=${encodeURIComponent(g.sessionId)}`, locale) : null,
          share: shareLink(app, ev, g.sessionId), bookings: myBookings }}
        route={ticketRoute(s, routes)} routePage={routePageOf(s, routes, content, L)} bikeName={bikeOf.get(g.sessionId) ?? null} now={drawn}
        wallet={{ bookingId: g.rows[0].id, groupIds: g.rows.map((r) => r.id) }} addonItems={addonItems} lockers={lockers} ownLockers={own.filter((l) => l.day === g.date)} vlPartners={vlPartners} balance={walletRead?.balance ?? null} blood={donor} bikeNames={bikeNames} account={acct.name} />
    ) };
  });
  // the lockers taken without a booking, each evening with the QR the desk scans to hand the keys (2026-11-09); an
  // evening with a ride ticket shows them on the ticket too
  for (const day of [...new Set(own.map((l) => l.day))]) {
    const ls = own.filter((l) => l.day === day), due = ls.find((l) => l.status === "reserved");
    items.push({ key: `l-${day}`, date: day, time: lockerStart(ls[0]?.period ?? ""), node: (
      <Appointment key={`l-${day}`} kind={tx("Your lockers", "خزائنك")} icon="key" title={ls.map((l) => l.code ?? "").filter(Boolean).join(" · ") || tx("Locker", "خزانة")}
        when={fmtDayDate(day, locale)} href={`/api/account/lockers-link?lang=${L}`} hrefLabel={tx("Manage", "إدارة")}>
        <ul className="bk-appt-lines">
          {ls.map((l) => (
            <li key={l.id}>
              {[lockerText("", { period: l.period, code: null, status: l.status }, locale), l.name && l.name.trim() !== acct.name.trim() ? l.name : "",
                l.paid ? tx("Paid from your wallet", "مدفوعة من محفظتك") : l.pay === "desk" ? tx("Pay at the desk", "الدفع في المكتب") : ""]
                .filter(Boolean).map((x, i) => <span key={i}>{i > 0 && " · "}<bdi>{x}</bdi></span>)}
            </li>
          ))}
        </ul>
        {due && <div className="bk-appt-qr"><Qr payload={`https://micromobility.sa/lockers/r/${due.id}`} label={tx("Show this at the desk", "اعرض هذا في المكتب")} /></div>}
      </Appointment>
    ) });
  }
  // the workshop appointments still ahead (customer_workshop_jobs): the service, the day, how it stands
  const wsT = serverLocalize(WS_TRACK, locale);
  const wsText = { stages: wsT.stages, scheduled: wsT.scheduled, price: wsT.price, cancelled: wsT.cancelled, reference: tx("Reference", "رقم الطلب") };
  for (const j of upcomingJobs(wsR.status === 200 ? workshopJobsOf(wsR.data) : [], today)) {
    items.push({ key: `w-${j.id}`, date: j.date ?? today, time: j.time ?? "", node: (
      <Appointment key={`w-${j.id}`} kind={tx("Workshop", "الورشة")} icon="wrench" title={j.service || j.ref}
        when={[j.date ? fmtDayDate(j.date, locale) : "", j.time ? fmtClock(j.time, locale) : "", j.ref].filter(Boolean).join(" · ")}
        status={wsStatus(j, wsText)} href={localHref("/account/workshop", locale)} hrefLabel={w.workshop} />
    ) });
  }
  // the volunteer shifts ahead (volunteer_me's mine): an event the rider asked to help at, or was accepted for
  const vw = volunteerWords(locale);
  for (const x of Array.isArray(volR.data?.mine) ? volR.data.mine : []) {
    const o = (x ?? {}) as Record<string, unknown>;
    const day = S(o.date).slice(0, 10), st = S(o.status);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today || o.cancelled === true || (st !== "accepted" && st !== "interested")) continue;
    const time = /^\d{2}:\d{2}/.test(S(o.time)) ? S(o.time).slice(0, 5) : "";
    items.push({ key: `v-${S(o.id)}-${day}`, date: day, time, node: (
      <Appointment key={`v-${S(o.id)}-${day}`} kind={vw.title} icon="clock" title={S(o.title) || vw.title}
        when={[fmtDayDate(day, locale), time ? fmtClock(time, locale) : ""].filter(Boolean).join(" · ")}
        status={st === "accepted" ? wsT.stages.confirmed : wsT.stages.new} href="/api/account/volunteer-portal" hrefLabel={vw.open} />
    ) });
  }
  // the learn-to-ride lessons ahead (learn_ladder's learners: each one's latest lesson)
  const learners = learnR.data && learnR.data.ok === true && Array.isArray(learnR.data.learners) ? learnR.data.learners : [];
  for (const [i, x] of learners.entries()) {
    const o = (x ?? {}) as Record<string, unknown>;
    const at = S(o.lesson_at) ? riyadhParts(S(o.lesson_at)) : null;
    if (!at || at.date < today) continue;
    items.push({ key: `ll-${i}-${at.date}`, date: at.date, time: at.time, node: (
      <Appointment key={`ll-${i}-${at.date}`} kind={tx("Learn to ride", "تعلّم ركوب الدراجة")} icon="bike" title={S(o.name) || acct.name}
        when={[fmtDayDate(at.date, locale), fmtClock(at.time, locale)].join(" · ")} />
    ) });
  }
  items.sort(byWhen);
  const failed = (
    <p className="ac-empty" role="alert">
      {tx("Something went wrong at our end. Check your connection and try again.", "حدث خلل لدينا. تحقق من اتصالك وحاول مرة أخرى.")} <a href={again}>{tryAgain} <ArrowIcon size={15} /></a>
    </p>
  );

  return shell(
    <div className="ac ac-in acm bk">
      {notice}
      <header className="bk-head">
        <h1>{w.bookings}</h1>
        <div className="bk-head-links">
          {!hidden.includes("experiences") && <a className="acm-btn" href={localHref("/experiences", locale)}><AccIcon name="bike" size={18} />{tx("Book a ride", "احجز جولة")}</a>}
          {!hidden.includes("workshop") && <a className="acm-btn acm-btn-line" href={localHref("/workshop", locale)}><AccIcon name="wrench" size={18} />{tx("Request a service", "اطلب صيانة")}</a>}
        </div>
      </header>

      <section className="ac-sec bk-sec" aria-labelledby="bk-up-h">
        <div className="ac-sec-head"><h2 id="bk-up-h">{w.upcoming}</h2><a href={book}>{S(c.home.manage)} <ArrowIcon size={15} /></a></div>
        {/* today's code large on the page: the phone stays awake while it shows (the booking app's _wakeWant, 2026-11-10) */}
        {groups.some((g) => todayCode(g.rows, sessions.get(g.sessionId), today)) && <TicketWake />}
        {items.length === 0 && past.length === 0 ? (unread ? failed : (
          <p className="ac-empty">{S(c.home.noRides)} {!hidden.includes("experiences") && <a href={localHref("/experiences", locale)}>{tx("See the dates", "المواعيد")} <ArrowIcon size={15} /></a>}</p>
        )) : null}
        {(items.length > 0 || past.length > 0 || cancelled.length > 0) && (
          <div className="tk-grid bk-grid">
            {items.map((x) => x.node)}
            {/* the bookings cancelled, after the bookings ahead: one quiet row each, until their day has gone */}
            {cancelled.length > 0 && (
              <ul className="tk-cx-list">
                {cancelled.map((g) => {
                  const s = sessions.get(g.sessionId);
                  return <li key={g.key}><TicketCancelled locale={locale} date={g.date} session={s} name={rideName(s, g.sessionId)} by={g.by} t={ticketText} gather={S(d.gather)} start={S(d.start)} /></li>;
                })}
              </ul>
            )}
            {past.map((g) => {
              const s = sessions.get(g.sessionId);
              return (
                <TicketCard key={g.key} past locale={locale} today={today} rows={g.rows} session={s}
                  name={rideName(s, g.sessionId)}
                  cue={null} t={ticketText} gather={S(d.gather)} start={S(d.start)} typeName={typeName}
                  links={{ edit: null, manage, place: null }} route={ticketRoute(s, routes)} routePage={routePageOf(s, routes, content, L)} bikeName={bikeOf.get(g.sessionId) ?? null} now={drawn} addonItems={addonItems} lockers={lockers} vlPartners={vlPartners} blood={donor} bikeNames={bikeNames} account={acct.name} />
              );
            })}
          </div>
        )}
      </section>

      {toRate.length > 0 && (
        <section className="ac-sec" aria-labelledby="ac-rate-h">
          <h2 id="ac-rate-h">{toRate.some((r) => rideWord(sessions.get(r.sessionId)?.kind, r.sessionId) !== "ride") ? tx("Rate your sessions", "قيّم فعالياتك") : tx("Rate your rides", "قيّم جولاتك")}</h2>
          <div className="rr-grid">
            {toRate.map((r) => {
              const s = sessions.get(r.sessionId);
              // a Saturday ride's form names the restaurant its breakfast was at, as the pop-up's does
              const word = rideWord(s?.kind, r.sessionId);
              return <RateRide key={r.entryId} entryId={r.entryId} name={rideName(s, r.sessionId)} when={fmtDayDate(r.date, locale)} form={formOf(s?.kind)} noBike={ratingNoBike(r.ownBike, s, r.sessionId)} run={word === "run"} session={word === "session"} restaurant={breakfastFor(s, locale)?.name ?? null} rgLow={bizOf(content).rgLow} about={tmAboutOfKind(s?.kind)} />;
            })}
          </div>
        </section>
      )}

      {doneBefore.length > 0 && (
        <section className="ac-sec bk-sec" aria-labelledby="bk-past-h">
          <h2 id="bk-past-h">{w.pastRides}</h2>
          <ul className="acm-card acm-card-list acm-lines bk-past">
            {doneBefore.map((x) => {
              const s = sessions.get(x.sessionId);
              return (
                <li key={x.sessionId}>
                  <span className="acm-line-main"><b><bdi>{rideName(s, x.sessionId)}</bdi></b><small><bdi>{fmtDayDate(x.date, locale)}</bdi></small></span>
                  <span className="acm-line-end"><AccIcon name="tick" size={18} className="bk-done" /></span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>,
  );
}
