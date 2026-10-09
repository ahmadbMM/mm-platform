import type { Metadata } from "next";
import { cookies } from "next/headers";
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
import { T as RECORD } from "@/components/account/RideRecord.text";
import { T as TICKET } from "@/components/booking/tickets.text";
import "@/components/club/club.css";
import "./handoff.css";
import { accountSchema } from "@/content/pages/account";
import { clubSchema } from "@/content/pages/club";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { accountBookings, getAccount } from "@/lib/account";
import { decodeSession } from "@/lib/account-core";
import { HANDOFF_COOKIE, accountLabel, sessionProfile } from "@/lib/handoff";
import { asLocale, resolvePage } from "@/lib/content";
import { fill } from "@/lib/fill";
import { bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { kindNames, sessionName } from "@/lib/rides";
import { routeItems } from "@/lib/route-names";
import { RATE_FROM, formOf, pendingRating, unratedRides } from "@/lib/rating";
import { loadAddonItems } from "@/lib/ticket-addons";
import { breakfastFor, doneToday, fmtDayDate, meetsAt, type TicketSession, rideCompleted, ticketCue, ticketGroups, ticketRoute } from "@/lib/tickets";
import { anyoneAhead, loadTicketSessions } from "@/lib/tickets-data";
import { badgeList, recordRows, rideStats } from "@/lib/ride-record";
import { bikeName, loadBadgeData, loadRecordSessions } from "@/lib/ride-record-data";
import { riyadhClock } from "@/lib/workshop-days";
import { DATE_STYLES, datePattern } from "@/lib/date-pattern";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { phrase } from "@/i18n/tx";
import { isRtl } from "@/i18n/locales";
import { bizOf } from "@/lib/biz";

// micromobility.sa/account - sign in with the Micromobility account riders book with; signed in,
// the next rides as the booking app's own tickets (changing one opens the booking app), the Club
// card opened with the account's own email and mobile, and shortcuts. After the booking app hands a
// rider back (api/account/handoff), it says whom they are signed in as (?handoff=done), or, when the
// account handed back is not the one signed in here, asks which one this browser keeps.
const S = (v: unknown) => (typeof v === "string" ? v : "");
const TYPE_NAME: Record<string, { en: string; ar: string }> = {
  Road: phrase("Road", "طريق"), Hybrid: phrase("Hybrid", "هجين"), Mountain: phrase("Mountain", "جبلي"), "Road Carbon": phrase("Road Carbon", "طريق كربون"),
  Kids: phrase("Kids", "أطفال"), Gravel: phrase("Gravel", "حصى"), Any: phrase("Any bike", "أي دراجة"), Own: phrase("Own bike", "دراجتي الخاصة"),
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMeta({ path: "/account", locale, title: `${serverL(locale)("Account", "الحساب")} · Micromobility`, noindex: true });
}

export default async function AccountPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
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
            {/* Sign-up, a password reset and Google or Apple happen in the booking app, which hands
                the rider back here signed in (?handoff=site; api/account/handoff). */}
            <ul className="ac-notes">
              <li><a href={handoff("signup")}>{S(c.signin.create)}</a></li>
              <li><a href={handoff("forgot")}>{S(c.signin.forgot)}</a></li>
              <li><a href={handoff()}>{S(c.signin.oauth)}</a></li>
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
  const groups = ticketGroups(rows, today);
  const doneTonight = doneToday(rows, today);
  const d = resolvePage(experiencesSchema, content, L).dates;
  const names = { ...kindNames(d), petromin: tx("Petromin", "بترومين") };
  const enNames = kindNames(resolvePage(experiencesSchema, content, "en").dates);
  // Finished rides not rated yet, one per night (a party rates once, on its first rider): the
  // booking app's post-ride rating. The oldest from the day it went live on is the pop-up the
  // rider cannot skip (RatingGateLoader, on every page; the booking app's _pendingRatingId), and
  // every later one is that pop-up in its turn: only rides from before that day are cards here.
  const gate = pendingRating(rows, today);
  const toRate = unratedRides(rows, today).filter((r) => r.date < RATE_FROM && r.entryId !== gate?.entryId).reverse().slice(0, 5);
  // every booked session, whatever its state now (a Petromin night, one staff closed since), read
  // with the account's token so a private ride (one its tag holders alone may see) keeps its name
  const record = recordRows(rows);
  const [sessions, recSessions, badges] = await Promise.all([
    loadTicketSessions([...groups.map((g) => g.sessionId), ...doneTonight.map((g) => g.sessionId), ...toRate.map((r) => r.sessionId), ...(gate ? [gate.sessionId] : [])], acct),
    // every night booked, for Your rides and the badges (the kind of ride, whether it was free, whether staff approve it)
    loadRecordSessions(record.map((r) => r.sessionId), acct),
    loadBadgeData(acct),
  ]);
  // tonight's ride already over stays as a past card while it counts as ridden (_rideCompleted)
  const past = doneTonight.filter((g) => { const s = sessions.get(g.sessionId); return g.rows.some((r) => rideCompleted(r, !!s?.freeRide)); });
  const routes = routeItems(content, L); // a ride that follows a route on the Routes page names it on its ticket
  // tonight's bike, by name, for the steps and the line under the header
  const bikeOf = new Map(await Promise.all([...groups, ...past].filter((g) => g.date === today).map(async (g) => [g.sessionId, await bikeName(g.rows.find((r) => r.bikeId)?.bikeId ?? null)] as const)));
  // the add-ons the tickets list, by name and price
  const addonItems = await loadAddonItems([...groups, ...past].flatMap((g) => g.rows.flatMap((r) => r.addonLines.map((a) => a.id))));
  const stats = rideStats(record, recSessions, today);
  const allBadges = badgeList(record, recSessions, badges, today, acct.profile ?? null);
  // "You're next" on a numbered night: whether anyone still waiting holds a lower number. Said on
  // the ride's day only, as the booking app does: a week ahead it counts a queue nobody stands in.
  const ahead = await Promise.all(groups.map((g) => {
    const s = sessions.get(g.sessionId), first = g.rows.find((r) => r.status === "waiting" && r.queueNum != null);
    return s && !s.approval && first && g.date === now.slice(0, 10) ? anyoneAhead(g.sessionId, first.queueNum as number) : Promise.resolve(null);
  }));
  const rideName = (s: TicketSession | undefined) => (s ? sessionName(s, names, enNames, L !== "en") : tx("Ride", "جولة"));
  const ticketText = serverLocalize(TICKET, locale);
  const recordText = serverLocalize(RECORD, locale);
  const drawn = new Date().getTime(); // the countdown's first line, before the browser takes over
  const typeName = (ty: string) => (TYPE_NAME[ty] ? tx(TYPE_NAME[ty].en, TYPE_NAME[ty].ar) : ty);
  // Changing a booking happens in the booking app: Edit reopens its date there, as the app's own
  // Edit does; Reschedule and Cancel open its My Bookings. (A Run for Her place is only cancelled;
  // its event is still named, as the booking app's event link takes it.)
  const EV: Record<string, string> = { jcc: "jcc", saturday: "community", swim: "community", workshop: "workshop", snd96: "snd96", event: "event", runher: "runher" };
  const appLink = (params: Record<string, string>) => {
    try { const u = new URL(app); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); return bookingLink(u.toString(), locale); }
    catch { return book; }
  };
  const manage = appLink({ tab: "bookings" });
  const first = acct.name.trim().split(/\s+/)[0] || acct.name;
  const club = resolvePage(clubSchema, content, L);
  const tierNames: [string, string, string] = [S(club.tiers.t1Name), S(club.tiers.t2Name), S(club.tiers.t3Name)];
  const shortcuts = [
    ["experiences", tx("Book a ride", "احجز جولة"), "/experiences"],
    ["workshop", tx("Request a service", "اطلب صيانة"), "/workshop"],
    ["ambassadors", tx("Ambassador Program", "برنامج السفراء"), "/ambassadors"],
    ["help", tx("Help", "المساعدة"), "/help"],
  ].filter(([k]) => !hidden.includes(k));

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

        <section className="ac-sec" aria-labelledby="ac-rides-h">
          <div className="ac-sec-head"><h2 id="ac-rides-h">{S(c.home.ridesTitle)}</h2><a href={book}>{S(c.home.manage)} <span aria-hidden="true">{(isRtl(locale) ? "←" : "→")}</span></a></div>
          {groups.length === 0 && past.length === 0 ? (
            <p className="ac-empty">{S(c.home.noRides)} {!hidden.includes("experiences") && <a href={localHref("/experiences", locale)}>{tx("See the dates", "المواعيد")} <span aria-hidden="true">{isRtl(locale) ? "←" : "→"}</span></a>}</p>
          ) : (
            <div className="tk-grid">
              {groups.map((g, i) => {
                const s = sessions.get(g.sessionId);
                const ev = s ? EV[s.kind] : undefined;
                // a ride staff approve and Run for Her meet at the point staff set (meetsAt), the rest at the circuit
                const place = s && meetsAt(s) ? s.meetUrl : S(site.contact.jccHref) || null;
                return (
                  <TicketCard key={g.sessionId} locale={locale} today={now.slice(0, 10)} rows={g.rows} session={s}
                    name={s ? sessionName(s, names, enNames, L !== "en") : tx("Ride", "جولة")}
                    cue={ticketCue(g.rows, s, ahead[i])} t={ticketText} gather={S(d.gather)} start={S(d.start)} typeName={typeName}
                    links={{ edit: ev ? appLink({ ev, session: g.sessionId }) : null, manage, place,
                      live: g.date === now.slice(0, 10) ? localHref(`/live?session=${encodeURIComponent(g.sessionId)}`, locale) : null }}
                    route={ticketRoute(s, routes)} bikeName={bikeOf.get(g.sessionId) ?? null} now={drawn}
                    wallet={{ bookingId: g.rows[0].id, groupIds: g.rows.map((r) => r.id) }} addonItems={addonItems} />
                );
              })}
              {past.map((g) => {
                const s = sessions.get(g.sessionId);
                return (
                  <TicketCard key={g.sessionId} past locale={locale} today={today} rows={g.rows} session={s}
                    name={s ? sessionName(s, names, enNames, L !== "en") : tx("Ride", "جولة")}
                    cue={null} t={ticketText} gather={S(d.gather)} start={S(d.start)} typeName={typeName}
                    links={{ edit: null, manage, place: null }} route={ticketRoute(s, routes)} bikeName={bikeOf.get(g.sessionId) ?? null} now={drawn} addonItems={addonItems} />
                );
              })}
            </div>
          )}
        </section>

        {(stats || allBadges.length > 0) && (
          <section className="ac-sec" aria-label={recordText.yourRides}>
            <RideRecord locale={locale} stats={stats} badges={allBadges} t={recordText} typeName={typeName} dur={{ h: ticketText.durH, hm: ticketText.durHM, m: ticketText.durM }} />
          </section>
        )}

        {toRate.length > 0 && (
          <section className="ac-sec" aria-labelledby="ac-rate-h">
            <h2 id="ac-rate-h">{tx("Rate your rides", "قيّم جولاتك")}</h2>
            <div className="rr-grid">
              {toRate.map((r) => {
                const s = sessions.get(r.sessionId);
                // a Saturday ride's form names the restaurant its breakfast was at, as the pop-up's does
                return <RateRide key={r.entryId} entryId={r.entryId} name={rideName(s)} when={fmtDayDate(r.date, locale)} form={formOf(s?.kind)} noBike={r.ownBike || (s ? !s.bikes : false)} restaurant={breakfastFor(s, locale)?.name ?? null} rgLow={bizOf(content).rgLow} />;
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

        {shortcuts.length > 0 && (
          <nav className="ac-links" aria-label={tx("Shortcuts", "اختصارات")}>
            {shortcuts.map(([k, label, href]) => <a key={k} href={localHref(href, locale)}>{label} <span aria-hidden="true">{(isRtl(locale) ? "←" : "→")}</span></a>)}
          </nav>
        )}
      </div>
    </PageShell>
  );
}
