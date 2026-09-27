import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell, { navFrom } from "@/components/site/PageShell";
import ClubCard from "@/components/club/ClubCard";
import SignIn from "@/components/account/SignIn";
import SignOut from "@/components/account/SignOut";
import "@/components/account/account.css";
import "@/components/booking/booking.css";
import TicketCard from "@/components/booking/TicketCard";
import { T as TICKET } from "@/components/booking/tickets.text";
import { labelFont } from "@/components/booking/label-font";
import "@/components/club/club.css";
import { accountSchema } from "@/content/pages/account";
import { clubSchema } from "@/content/pages/club";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { accountBookings, getAccount } from "@/lib/account";
import { asLocale, resolvePage } from "@/lib/content";
import { fill } from "@/lib/fill";
import { bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { kindNames, sessionName } from "@/lib/rides";
import { routeNameOf, routeNames } from "@/lib/route-names";
import { ticketCue, ticketGroups } from "@/lib/tickets";
import { anyoneAhead, loadTicketSessions } from "@/lib/tickets-data";
import { riyadhClock } from "@/lib/workshop-days";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { phrase } from "@/i18n/tx";
import { isRtl } from "@/i18n/locales";

// micromobility.sa/account - sign in with the Micromobility account riders book with; signed in,
// the next rides as the booking app's own tickets (changing one opens the booking app), the Club
// card opened with the account's own email and mobile, and shortcuts.
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
  const expired = (await searchParams).handoff === "expired";
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

  const rows = await accountBookings(acct);
  const now = riyadhClock(new Date());
  const groups = ticketGroups(rows, now.slice(0, 10));
  const d = resolvePage(experiencesSchema, content, L).dates;
  const names = { ...kindNames(d), petromin: tx("Petromin", "بترومين") };
  const enNames = kindNames(resolvePage(experiencesSchema, content, "en").dates);
  // every booked session, whatever its state now (a Petromin night, one staff closed since)
  const sessions = await loadTicketSessions(groups.map((g) => g.sessionId));
  const routes = routeNames(content, L); // a ride that follows a route on the Routes page names it on its ticket
  // "You're next!" on a numbered night: whether anyone still waiting holds a lower number
  const ahead = await Promise.all(groups.map((g) => {
    const s = sessions.get(g.sessionId), first = g.rows.find((r) => r.status === "waiting" && r.queueNum != null);
    return s && !s.approval && first ? anyoneAhead(g.sessionId, first.queueNum as number) : Promise.resolve(null);
  }));
  const ticketText = serverLocalize(TICKET, locale);
  const typeName = (ty: string) => (TYPE_NAME[ty] ? tx(TYPE_NAME[ty].en, TYPE_NAME[ty].ar) : ty);
  // Changing a booking happens in the booking app: Edit reopens its date there, as the app's own
  // Edit does; Reschedule and Cancel open its My Bookings.
  const EV: Record<string, string> = { jcc: "jcc", saturday: "community", swim: "community", workshop: "workshop", snd96: "snd96", event: "event" };
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
          {groups.length === 0 ? (
            <p className="ac-empty">{S(c.home.noRides)} {!hidden.includes("experiences") && <a href={localHref("/experiences", locale)}>{tx("See the dates", "المواعيد")} <span aria-hidden="true">{isRtl(locale) ? "←" : "→"}</span></a>}</p>
          ) : (
            <div className={`tk-grid ${labelFont.variable}`}>
              {groups.map((g, i) => {
                const s = sessions.get(g.sessionId);
                const ev = s ? EV[s.kind] : undefined;
                return (
                  <TicketCard key={g.sessionId} locale={locale} rows={g.rows} session={s}
                    name={s ? sessionName(s, names, enNames, L !== "en") : tx("Ride", "جولة")}
                    cue={ticketCue(g.rows, s, ahead[i])} t={ticketText} gather={S(d.gather)} start={S(d.start)} typeName={typeName}
                    links={{ edit: ev ? appLink({ ev, session: g.sessionId }) : null, manage, place: s?.approval ? s.meetUrl : S(site.contact.jccHref) || null,
                      live: g.date === now.slice(0, 10) ? localHref(`/live?session=${encodeURIComponent(g.sessionId)}`, locale) : null }}
                    route={routeNameOf(routes, s?.routeSlug)} />
                );
              })}
            </div>
          )}
        </section>

        {!hidden.includes("club") && (
          <section className="ac-sec" aria-labelledby="ac-club-h">
            <h2 id="ac-club-h">{S(c.home.clubTitle)}</h2>
            <ClubCard locale={locale} title="" text="" notMember={S(club.card.notMember)} applyBtn={S(club.hero.applyBtn)} applyHref={localHref(S(club.hero.applyHref), locale)} tierNames={tierNames} email={acct.email} phone={acct.phone} />
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
