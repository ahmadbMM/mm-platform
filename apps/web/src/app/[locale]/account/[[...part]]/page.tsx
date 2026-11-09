import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell, { navFrom } from "@/components/site/PageShell";
import ClubCard from "@/components/club/ClubCard";
import SignIn from "@/components/account/SignIn";
import SignOut from "@/components/account/SignOut";
import "@/components/account/account.css";
import "@/components/booking/booking.css";
import TicketCard from "@/components/booking/TicketCard";
import RateRide from "@/components/account/RateRide";
import RideRecord from "@/components/account/RideRecord";
import RideMore from "@/components/account/RideMore";
import AccountParts, { accountPartHref, accountPartOf } from "@/components/account/AccountParts";
import WalletCard from "@/components/account/WalletCard";
import ReferralCard from "@/components/account/ReferralCard";
import VolunteerCard, { volunteerCardShows, type VolunteerMe } from "@/components/account/VolunteerCard";
import { walletOf } from "@/lib/wallet";
import { referralOf, referralRodeOf } from "@/lib/referral";
import BloodTypeCard from "@/components/account/BloodTypeCard";
import { bloodTypeWords } from "@/components/account/BloodType.words";
import { T as RECORD } from "@/components/account/RideRecord.text";
import { T as TICKET } from "@/components/booking/tickets.text";
import "@/components/club/club.css";
import "../handoff.css";
import { accountSchema } from "@/content/pages/account";
import { BLOOD_NAME, bloodName, bloodWords } from "@/content/blood-words";
import { clubSchema } from "@/content/pages/club";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { accountBookings, getAccount, rpcServer } from "@/lib/account";
import { bloodRewards, isBloodId, rewardGood } from "@/lib/blood";
import { btOf } from "@/lib/blood-type";
import { emAbsent } from "@/lib/emergency";
import { decodeSession } from "@/lib/account-core";
import { HANDOFF_COOKIE, accountLabel, sessionProfile } from "@/lib/handoff";
import { asLocale, resolvePage } from "@/lib/content";
import { fill } from "@/lib/fill";
import { bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { kindNames, sessionName, type RideKind } from "@/lib/rides";
import { routeItems } from "@/lib/route-names";
import { RATE_FROM, formOf, pendingRating, ratingNoBike, rideWord, unratedRides } from "@/lib/rating";
import { isNonBike } from "@/lib/bike-kinds";
import { loadAddonItems } from "@/lib/ticket-addons";
import { bloodDone, breakfastFor, doneToday, fmtDayDate, lockersOf, lockerText, ownLockersOf, placeLink, type TicketSession, rideCompleted, ticketCue, ticketGroups, ticketRoute } from "@/lib/tickets";
import { anyoneAhead, loadTicketSessions } from "@/lib/tickets-data";
import { badgeList, ledRides, recordRows, rideMore, rideStats } from "@/lib/ride-record";
import { bikeName, loadBadgeData, loadRecordSessions } from "@/lib/ride-record-data";
import { riyadhClock } from "@/lib/workshop-days";
import { DATE_STYLES, datePattern } from "@/lib/date-pattern";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { phrase } from "@/i18n/tx";
import { intlOf } from "@/i18n/locales";
import { bizOf } from "@/lib/biz";
import { ArrowIcon } from "@/components/site/Icons";
import Qr from "@/components/booking/Qr";

// micromobility.sa/account - sign in with the Micromobility account riders book with; signed in,
// the next rides as the booking app's own tickets (changing one opens the booking app), the Club
// card opened with the account's own email and mobile, and shortcuts. After the booking app hands a
// rider back (api/account/handoff), it says whom they are signed in as (?handoff=done), or, when the
// account handed back is not the one signed in here, asks which one this browser keeps.
// In three parts since 2026-11-09, as the booking app's account page (the owner: "divide the customer my account page
// into 3 separate pages account stats badges"): Account at /account (the tickets, the Club card, the wallet, Invite
// friends and the rest), Stats at /account/stats (Your rides and more of the record), Badges at /account/badges. The
// switch under the greeting moves between them; any other /account/... is not a page.
const S = (v: unknown) => (typeof v === "string" ? v : "");
const TYPE_NAME: Record<string, { en: string; ar: string }> = {
  Road: phrase("Road", "طريق"), Hybrid: phrase("Hybrid", "هجين"), Mountain: phrase("Mountain", "جبلي"), "Road Carbon": phrase("Road Carbon", "طريق كربون"),
  Kids: phrase("Kids", "أطفال"), Gravel: phrase("Gravel", "حصى"), Any: phrase("Any bike", "أي دراجة"), Own: phrase("Own bike", "دراجتي الخاصة"),
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string; part?: string[] }> }): Promise<Metadata> {
  const { locale, part } = await params;
  return pageMeta({ path: accountPartHref(accountPartOf(part) ?? "account"), locale, title: `${serverL(locale)("Account", "الحساب")} · Micromobility`, noindex: true });
}

export default async function AccountPage({ params, searchParams }: { params: Promise<{ locale: string; part?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale, part: seg } = await params;
  const part = accountPartOf(seg);
  if (!part) notFound();
  const handoffState = (await searchParams).handoff;
  const expired = handoffState === "expired";
  const L = asLocale(locale);
  const tx = serverL(locale);
  const [{ content, previewing, hidden }, acct] = await Promise.all([pageState("account"), getAccount()]);
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(accountSchema, content, L);
  const app = navFrom(site).booking; // the booking app as staff set it
  const book = bookingLink(app, locale);
  const handoff = (auth?: string) => bookingLink(`${app.replace(/[?#].*$/, "")}?handoff=site${auth ? `&auth=${auth}` : ""}`, locale);

  if (!acct) {
    return (
      <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
        <div className="ac">
          <section className="ac-card">
            <img src="/site/logo-dark.png" alt="Micromobility" className="ac-logo" />
            <p className="ac-eyebrow">{S(c.signin.eyebrow)}</p>
            <h1>{S(c.signin.title)}</h1>
            <p className="ac-text">{S(c.signin.text)}</p>
            {expired && <p className="ac-err" role="status">{tx("That sign-in link has expired. Please sign in again.", "انتهت صلاحية رابط تسجيل الدخول. يرجى تسجيل الدخول مجدداً.")}</p>}
            <SignIn locale={locale} />
            {/* Sign-up and a password reset happen in the booking app, which hands the rider back
                here signed in (?handoff=site; api/account/handoff). */}
            <ul className="ac-notes">
              <li><a href={handoff("signup")}>{S(c.signin.create)}</a></li>
              <li><a href={handoff("forgot")}>{S(c.signin.forgot)}</a></li>
            </ul>
          </section>
        </div>
      </PageShell>
    );
  }

  // A session the booking app handed back while this account was signed in (lib/handoff.ts): named
  // here, with the choice of account, until the rider answers or five minutes pass.
  const kept = decodeSession((await cookies()).get(HANDOFF_COOKIE)?.value);
  const handedP = kept && kept.id !== acct.id ? await sessionProfile(kept) : null;
  const handed = handedP && handedP !== "none" ? handedP : null;
  const rows = await accountBookings(acct);
  const now = riyadhClock(new Date());
  const today = now.slice(0, 10);
  const d = resolvePage(experiencesSchema, content, L).dates;
  const names = { ...kindNames(d), petromin: tx("Petromin", "بترومين"), blood: bloodName(tx) };
  const enNames = { ...kindNames(resolvePage(experiencesSchema, content, "en").dates), blood: BLOOD_NAME };
  const ticketText = serverLocalize(TICKET, locale);
  const recordBase = serverLocalize(RECORD, locale);
  const typeName = (ty: string) => (TYPE_NAME[ty] ? tx(TYPE_NAME[ty].en, TYPE_NAME[ty].ar) : ty);
  const first = acct.name.trim().split(/\s+/)[0] || acct.name;
  // Invite friends (rentals 20261108160000): the account's code is made the first time it is asked for; no card while
  // the database has none, referrals are switched off, or it cannot be read. Stats and Badges ask too: the Recruiter
  // badge counts the friends who rode.
  const referralP = rpcServer<unknown>("customer_referral", { p_id: acct.id, p_token: acct.token, p_make: true }).then((r) => (r.status === 200 ? r.data : null));

  // Account: the tickets, the rating, the Club card, the wallet, Invite friends, the blood type and the shortcuts.
  const accountMain = async () => {
    const groups = ticketGroups(rows, today);
    const doneTonight = doneToday(rows, today);
    const donorEarlier = bloodDone(rows, today); // the Blood Donation event, over: kept below while its free ride is good
    // Finished rides not rated yet, one per night (a party rates once, on its first rider): the
    // booking app's post-ride rating. The oldest from the day it went live on is the pop-up the
    // rider cannot skip (RatingGateLoader, on every page; the booking app's _pendingRatingId), and
    // every later one is that pop-up in its turn: only rides from before that day are cards here.
    const gate = pendingRating(rows, today);
    const toRate = unratedRides(rows, today).filter((r) => r.date < RATE_FROM && r.entryId !== gate?.entryId).reverse().slice(0, 5);
    // every booked session, whatever its state now (a Petromin night, one staff closed since), read
    // with the account's token so a private ride (one its tag holders alone may see) keeps its name
    const [sessions, blood, walletRead, referralRaw, lockersRaw] = await Promise.all([
      loadTicketSessions([...groups.map((g) => g.sessionId), ...doneTonight.map((g) => g.sessionId), ...donorEarlier.map((g) => g.sessionId), ...toRate.map((r) => r.sessionId), ...(gate ? [gate.sessionId] : [])], acct),
      // the blood type (2026-10-14): no card while the database has no customer_blood_type yet, nor
      // when it cannot be read just now (a card showing none would invite saving over the real one)
      rpcServer<unknown>("customer_blood_type", { p_id: acct.id, p_token: acct.token })
        .then((r) => (r.status === 0 || r.status >= 400 || emAbsent(r) ? null : { type: btOf(r.data) })),
      // the wallet (rentals 20261102210000): no card and no pay button while the database has none or cannot be read
      rpcServer<unknown>("customer_wallet", { p_id: acct.id, p_token: acct.token }).then((r) => (r.status === 200 ? walletOf(r.data) : null)),
      referralP,
      // the lockers (rentals 20261109120000): the period and number on a ticket's locker line; none read, the line says Locker
      rpcServer<unknown>("customer_lockers", { p_id: acct.id, p_token: acct.token }).then((r) => (r.status === 200 ? r.data : null)),
    ]);
    const lockers = lockersRaw == null ? null : lockersOf(lockersRaw);
    // the rider's own lockers with no booking behind them (the lockers page; 2026-11-09): on that evening's ride ticket,
    // and as Your lockers below the rides, each evening with the QR the desk scans to hand the keys
    const own = ownLockersOf(lockersRaw, today);
    const referral = referralOf(referralRaw, today);
    // tonight's ride already over stays as a past card while it counts as ridden (_rideCompleted)
    const pastTonight = doneTonight.filter((g) => { const s = sessions.get(g.sessionId); return g.rows.some((r) => rideCompleted(r, !!s?.freeRide)); });
    // The Blood Donation event (2026-11-03): a donor's free ride, asked only when a ticket is on the event; a database
    // without customer_blood_rewards, or a failed read, gives none and the ticket shows no code. The event over, its ticket
    // stays as a past card while the code on it is still good: it is good for a month, and this page lists no past bookings.
    const isDonation = (id: string) => sessions.get(id)?.kind === "blood" || isBloodId(id);
    const donorRewards = [...groups, ...pastTonight, ...donorEarlier].some((g) => isDonation(g.sessionId))
      ? await rpcServer<unknown>("customer_blood_rewards", { p_id: acct.id, p_token: acct.token }).then((r) => bloodRewards(r.data))
      : null;
    const past = [...pastTonight, ...donorEarlier.filter((g) => g.rows.some((r) => rewardGood(donorRewards?.get(r.id), today)))];
    const donor = donorRewards ? { words: bloodWords(tx), rewards: donorRewards } : null;
    const routes = routeItems(content, L); // a ride that follows a route on the Routes page names it on its ticket
    // tonight's bike, by name, for the steps and the line under the header
    const bikeOf = new Map(await Promise.all([...groups, ...past].filter((g) => g.date === today).map(async (g) => [g.sessionId, await bikeName(g.rows.find((r) => r.bikeId)?.bikeId ?? null)] as const)));
    // the add-ons the tickets list, by name and price
    const addonItems = await loadAddonItems([...groups, ...past].flatMap((g) => g.rows.flatMap((r) => r.addonLines.map((a) => a.id))));
    // Victory Lap: each Doubles booking's partner by first name (customer_vl_teams, rentals 20261017210000:
    // a rider never reads another account's booking), asked only when a ticket holds a team; a database
    // without the function, or a failed read, names nobody (the ticket then says it waits for the partner).
    // Arena Heros' teams (2026-10-28) too, when the function names them; when it does not, the ticket says the
    // partner books with the code.
    const vlPartners = [...groups, ...past].some((g) => g.rows.some((r) => r.vl?.team || r.ah?.team))
      ? await rpcServer<unknown>("customer_vl_teams", { p_id: acct.id, p_token: acct.token }).then((r) => new Map(
        (Array.isArray(r.data) ? (r.data as Record<string, unknown>[]) : [])
          .filter((x) => x && typeof x.entry_id === "string" && typeof x.partner === "string" && x.partner.trim())
          .map((x) => [x.entry_id as string, (x.partner as string).trim()] as const)))
      : null;
    // Volunteering (rentals 20261105120000): a database without it, or a failed read, shows no card.
    const volunteer = await rpcServer<VolunteerMe>("volunteer_me", { p_id: acct.id, p_token: acct.token }).then((r) => r.data).catch(() => null);
    // "You're next" on a numbered night: whether anyone still waiting holds a lower number. Said on
    // the ride's day only, as the booking app does: a week ahead it counts a queue nobody stands in.
    const ahead = await Promise.all(groups.map((g) => {
      const s = sessions.get(g.sessionId), first = g.rows.find((r) => r.status === "waiting" && r.queueNum != null);
      return s && !s.approval && first && g.date === now.slice(0, 10) ? anyoneAhead(g.sessionId, first.queueNum as number) : Promise.resolve(null);
    }));
    // a session that did not load is named by what it is: never "Ride" on one without a bike (2026-10-18)
    const rideName = (s: TicketSession | undefined, sessionId: string) =>
      (s ? sessionName(s, names, enNames, L !== "en") : isNonBike(null, sessionId) ? tx("Session", "الفعالية") : tx("Ride", "جولة"));
    const drawn = new Date().getTime(); // the countdown's first line, before the browser takes over
    // Changing a booking happens in the booking app: Edit reopens its date there, as the app's own
    // Edit does; Reschedule and Cancel open its My Bookings. (A Run for Her place is only cancelled;
    // its event is still named, as the booking app's event link takes it.)
    // (Victory Lap's details change in My Bookings there: it is never edited or rescheduled; nor Arena Heros'.)
    const EV: Record<string, string> = { jcc: "jcc", saturday: "community", swim: "community", workshop: "workshop", snd96: "snd96", event: "event", runher: "runher", vlap: "vlap", defe5k: "community", arena: "arena", blood: "blood" };
    const appLink = (params: Record<string, string>) => {
      try { const u = new URL(app); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); return bookingLink(u.toString(), locale); }
      catch { return book; }
    };
    const manage = appLink({ tab: "bookings" });
    const club = resolvePage(clubSchema, content, L);
    const tierNames: [string, string, string] = [S(club.tiers.t1Name), S(club.tiers.t2Name), S(club.tiers.t3Name)];
    const shortcuts = [
      ["experiences", tx("Book a ride", "احجز جولة"), "/experiences"],
      ["workshop", tx("Request a service", "اطلب صيانة"), "/workshop"],
      ["ambassadors", tx("Ambassador Program", "برنامج السفراء"), "/ambassadors"],
      ["help", tx("Help", "المساعدة"), "/help"],
    ].filter(([k]) => !hidden.includes(k));
    return (
      <>
        <section className="ac-sec" aria-labelledby="ac-rides-h">
          <div className="ac-sec-head"><h2 id="ac-rides-h">{S(c.home.ridesTitle)}</h2><a href={book}>{S(c.home.manage)} <ArrowIcon size={15} /></a></div>
          {groups.length === 0 && past.length === 0 ? (
            <p className="ac-empty">{S(c.home.noRides)} {!hidden.includes("experiences") && <a href={localHref("/experiences", locale)}>{tx("See the dates", "المواعيد")} <ArrowIcon size={15} /></a>}</p>
          ) : (
            <div className="tk-grid">
              {groups.map((g, i) => {
                const s = sessions.get(g.sessionId);
                const ev = s ? EV[s.kind] : undefined;
                // a ride staff approve and Run for Her meet at the point staff set (meetsAt), Arena Heros and the Blood
                // Donation event are at their venue's map, the rest at the circuit
                const place = placeLink(s, S(site.contact.jccHref) || null);
                return (
                  <TicketCard key={g.key} locale={locale} today={now.slice(0, 10)} rows={g.rows} session={s}
                    name={rideName(s, g.sessionId)}
                    cue={ticketCue(g.rows, s, ahead[i])} t={ticketText} gather={S(d.gather)} start={S(d.start)} typeName={typeName}
                    links={{ edit: ev ? appLink({ ev, session: g.sessionId }) : null, manage, place,
                      // the live map follows the ride leader: a bike session's only (2026-10-18)
                      live: g.date === now.slice(0, 10) && (s ? s.bikes : !isNonBike(null, g.sessionId)) ? localHref(`/live?session=${encodeURIComponent(g.sessionId)}`, locale) : null }}
                    route={ticketRoute(s, routes)} bikeName={bikeOf.get(g.sessionId) ?? null} now={drawn}
                    wallet={{ bookingId: g.rows[0].id, groupIds: g.rows.map((r) => r.id) }} addonItems={addonItems} lockers={lockers} ownLockers={own.filter((l) => l.day === g.date)} vlPartners={vlPartners} balance={walletRead?.balance ?? null} blood={donor} />
                );
              })}
              {past.map((g) => {
                const s = sessions.get(g.sessionId);
                return (
                  <TicketCard key={g.key} past locale={locale} today={today} rows={g.rows} session={s}
                    name={rideName(s, g.sessionId)}
                    cue={null} t={ticketText} gather={S(d.gather)} start={S(d.start)} typeName={typeName}
                    links={{ edit: null, manage, place: null }} route={ticketRoute(s, routes)} bikeName={bikeOf.get(g.sessionId) ?? null} now={drawn} addonItems={addonItems} lockers={lockers} vlPartners={vlPartners} blood={donor} />
                );
              })}
            </div>
          )}
        </section>

        {own.length > 0 && (
          <section className="ac-sec" aria-labelledby="ac-lk-h">
            <div className="ac-sec-head"><h2 id="ac-lk-h">{tx("Your lockers", "خزائنك")}</h2><a href={`/api/account/lockers-link?lang=${L === "ar" ? "ar" : "en"}`}>{tx("Manage", "إدارة")} <ArrowIcon size={15} /></a></div>
            <div className="lk-acc">
              {[...new Set(own.map((l) => l.day))].map((d) => {
                const ls = own.filter((l) => l.day === d), due = ls.find((l) => l.status === "reserved");
                return (
                  <div key={d} className="lk-acc-ev">
                    <p className="lk-acc-h"><bdi>{fmtDayDate(d, locale)}</bdi></p>
                    {ls.map((l) => (
                      <div key={l.id} className="lk-acc-row">
                        <b className="lk-acc-n"><bdi>{l.code ?? ""}</bdi></b>
                        <span className="lk-acc-t">
                          <bdi>{lockerText("", { period: l.period, code: null, status: l.status }, locale)}</bdi>
                          {l.name && l.name.trim() !== acct.name.trim() && <> · <bdi>{l.name}</bdi></>}
                          {(l.paid || l.pay === "desk") && <small>{l.paid ? tx("Paid from your wallet", "مدفوعة من محفظتك") : tx("Pay at the desk", "الدفع في المكتب")}</small>}
                        </span>
                      </div>
                    ))}
                    {due && (
                      <div className="lk-acc-qr">
                        <p>{tx("Show this at the desk", "اعرض هذا في المكتب")}</p>
                        <Qr payload={`https://micromobility.sa/lockers/r/${due.id}`} label={tx("Show this at the desk", "اعرض هذا في المكتب")} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {volunteerCardShows(volunteer) && <VolunteerCard me={volunteer} locale={locale} />}

        {toRate.length > 0 && (
          <section className="ac-sec" aria-labelledby="ac-rate-h">
            <h2 id="ac-rate-h">{toRate.some((r) => rideWord(sessions.get(r.sessionId)?.kind, r.sessionId) !== "ride") ? tx("Rate your sessions", "قيّم فعالياتك") : tx("Rate your rides", "قيّم جولاتك")}</h2>
            <div className="rr-grid">
              {toRate.map((r) => {
                const s = sessions.get(r.sessionId);
                // a Saturday ride's form names the restaurant its breakfast was at, as the pop-up's does
                const word = rideWord(s?.kind, r.sessionId);
                return <RateRide key={r.entryId} entryId={r.entryId} name={rideName(s, r.sessionId)} when={fmtDayDate(r.date, locale)} form={formOf(s?.kind)} noBike={ratingNoBike(r.ownBike, s, r.sessionId)} run={word === "run"} session={word === "session"} restaurant={breakfastFor(s, locale)?.name ?? null} rgLow={bizOf(content).rgLow} />;
              })}
            </div>
          </section>
        )}

        {!hidden.includes("club") && (
          <section className="ac-sec" aria-labelledby="ac-club-h">
            <h2 id="ac-club-h">{S(c.home.clubTitle)}</h2>
            <ClubCard locale={locale} title="" text="" notMember={S(club.card.notMember)} applyBtn={S(club.hero.applyBtn)} applyHref={localHref(S(club.hero.applyHref), locale)} tierNames={tierNames} email={acct.email} phone={acct.phone} sinceFmt={datePattern(locale, DATE_STYLES.memberSince)} />
          </section>
        )}

        {walletRead && <WalletCard wallet={walletRead} locale={locale} />}

        {referral && <ReferralCard r={referral} locale={locale} />}

        {blood && (
          <section className="ac-sec bt-sec" aria-labelledby="ac-bt-h">
            <h2 id="ac-bt-h">{bloodTypeWords(locale).title}</h2>
            <p id="ac-bt-sub" className="ac-text bt-sub">{bloodTypeWords(locale).sub}</p>
            <BloodTypeCard initial={blood.type} />
          </section>
        )}

        {shortcuts.length > 0 && (
          <nav className="ac-links" aria-label={tx("Shortcuts", "اختصارات")}>
            {shortcuts.map(([k, label, href]) => <a key={k} href={localHref(href, locale)}>{label} <ArrowIcon size={15} /></a>)}
          </nav>
        )}
      </>
    );
  };

  // Stats and Badges: the record, read from every night booked (the kind of ride, whether it was free, whether staff
  // approve it). Stats: Your rides, then more of it (RideMore) and the badges earned; Badges: the closest badges and
  // every badge.
  const recordMain = async (p: "stats" | "badges") => {
    const record = recordRows(rows);
    const [recSessions, badges, referralRaw] = await Promise.all([loadRecordSessions(record.map((r) => r.sessionId), acct), loadBadgeData(acct), referralP]);
    badges.referralRode = referralRodeOf(referralRaw); // the Recruiter badge counts these friends
    const allBadges = badgeList(record, recSessions, badges, today, acct.profile ?? null);
    // the Blood Donation Visitor badge is worded by the event's own words (content/blood-words.ts), handed on only to one who holds it
    const recordText = allBadges.some((x) => x.slug === "blood_visitor")
      ? { ...recordBase, names: { ...recordBase.names, blood_visitor: bloodWords(tx).visitorBadge } } : recordBase;
    const dur = { h: ticketText.durH, hm: ticketText.durHM, m: ticketText.durM };
    if (p === "badges") return allBadges.length > 0 && (
      <section className="ac-sec" aria-label={recordText.badges}>
        <RideRecord part="badges" locale={locale} stats={null} led={0} badges={allBadges} t={recordText} typeName={typeName} dur={dur} reqs={badges.requests ?? null} />
      </section>
    );
    const stats = rideStats(record, recSessions, today);
    const led = ledRides(record, recSessions); // Rides led under Your rides (the booking app, 2026-11-06)
    const kindName = (k: RideKind) => names[k] || enNames[k] || k;
    const more = rideMore(record, recSessions, today, { type: typeName, kind: kindName, locale: intlOf(locale) });
    return (
      <section className="ac-sec" aria-label={recordText.stats}>
        {!stats && !led && <p className="ac-none">{recordText.none}</p>}
        <RideRecord part="stats" locale={locale} stats={stats} led={led} badges={[]} t={recordText} typeName={typeName} dur={dur} />
        <RideMore locale={locale} more={more} t={recordText} typeName={typeName} kindName={kindName}
          earned={{ n: allBadges.filter((x) => x.on).length, of: allBadges.length, href: localHref(accountPartHref("badges"), locale) }} />
      </section>
    );
  };
  const main = part === "account" ? await accountMain() : await recordMain(part);

  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="ac ac-in">
        {handed ? (
          <section className="ac-sec ac-ho" aria-labelledby="ac-ho-h">
            <h2 id="ac-ho-h">{tx("Switch account?", "تبديل الحساب؟")}</h2>
            <p className="ac-text">
              {fill(tx("This browser is signed in as {current}. You have just signed in to the booking app as {next}. Which account should this site use?",
                "هذا المتصفح مسجّل الدخول باسم {current}، وقد سجّلت الدخول للتو في تطبيق الحجز باسم {next}. أي الحسابين تريد أن يستخدمه هذا الموقع؟"),
              { current: accountLabel(acct), next: accountLabel(handed) })}
            </p>
            <form method="post" action="/api/account/handoff" className="ac-ho-btns">
              <button type="submit" name="do" value="switch" className="ac-go">{fill(tx("Switch to {name}", "التبديل إلى {name}"), { name: handed.name || handed.email || handed.phone })}</button>
              <button type="submit" name="do" value="stay" className="ac-out">{fill(tx("Stay signed in as {name}", "البقاء مسجّلاً باسم {name}"), { name: acct.name || acct.email || acct.phone })}</button>
            </form>
          </section>
        ) : handoffState === "done" && (
          <p className="ac-ho-done" role="status">{fill(tx("You are signed in as {who}. If this is not your account, sign out.", "أنت مسجّل الدخول باسم {who}. إن لم يكن هذا حسابك، فسجّل الخروج."), { who: accountLabel(acct) })}</p>
        )}
        {/* the ride to rate first is the pop-up every page shows (RatingGateLoader in the layout) */}
        <header className="ac-head">
          <div>
            <p className="ac-eyebrow">{S(c.signin.eyebrow)}</p>
            <h1>{fill(S(c.home.hello), { name: first })}</h1>
            <p className="ac-who" dir="ltr">{[acct.email, acct.phone].filter(Boolean).join(" · ")}</p>
          </div>
          <SignOut label={tx("Sign out", "تسجيل الخروج")} />
        </header>
        <AccountParts part={part} locale={locale} t={{ account: recordBase.account, stats: recordBase.stats, badges: recordBase.badges }} />
        {main}
      </div>
    </PageShell>
  );
}
