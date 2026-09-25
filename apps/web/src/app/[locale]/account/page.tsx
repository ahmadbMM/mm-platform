import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import ClubCard from "@/components/club/ClubCard";
import SignIn from "@/components/account/SignIn";
import SignOut from "@/components/account/SignOut";
import "@/components/account/account.css";
import "@/components/club/club.css";
import { accountSchema } from "@/content/pages/account";
import { clubSchema } from "@/content/pages/club";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { accountBookings, getAccount } from "@/lib/account";
import { upcomingBookings } from "@/lib/account-core";
import { asLocale, resolvePage } from "@/lib/content";
import { fill } from "@/lib/fill";
import { BOOKING_URL, bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { kindNames, loadRides, sessionName, loadSessionsById } from "@/lib/rides";
import { riyadhClock } from "@/lib/workshop-days";
import { serverL } from "@/i18n/dicts";
import { phrase } from "@/i18n/tx";
import { isRtl, intlOf } from "@/i18n/locales";

// micromobility.sa/account - sign in with the Micromobility account riders book with; signed in,
// the next rides (their tickets and changes stay in the booking app), the Club card opened with
// the account's own email and mobile, and shortcuts.
const S = (v: unknown) => (typeof v === "string" ? v : "");
const TYPE_NAME: Record<string, { en: string; ar: string }> = {
  Road: phrase("Road", "طريق"), Hybrid: phrase("Hybrid", "هجين"), Mountain: phrase("Mountain", "جبلي"), "Road Carbon": phrase("Road Carbon", "طريق كربون"),
  Kids: phrase("Kids", "أطفال"), Any: phrase("Any bike", "أي دراجة"), Own: phrase("Own bike", "دراجتي الخاصة"),
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: `${serverL(locale)("Account", "الحساب")} · Micromobility`, robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const [{ content, previewing, hidden }, acct] = await Promise.all([pageState("account"), getAccount()]);
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(accountSchema, content, L);
  const book = bookingLink(BOOKING_URL, locale);

  if (!acct) {
    return (
      <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
        <div className="ac">
          <section className="ac-card">
            <img src="/site/logo-dark.png" alt="Micromobility" className="ac-logo" />
            <p className="ac-eyebrow">{S(c.signin.eyebrow)}</p>
            <h1>{S(c.signin.title)}</h1>
            <p className="ac-text">{S(c.signin.text)}</p>
            <SignIn />
            <ul className="ac-notes">
              <li><a href={book}>{S(c.signin.create)}</a></li>
              <li>{S(c.signin.forgot)}</li>
              <li><a href={book}>{S(c.signin.oauth)}</a></li>
            </ul>
          </section>
        </div>
      </PageShell>
    );
  }

  const [rows, rides] = await Promise.all([accountBookings(acct), loadRides()]);
  const now = riyadhClock(new Date());
  const bookings = upcomingBookings(rows, now.slice(0, 10));
  const d = resolvePage(experiencesSchema, content, L).dates;
  const names = { ...kindNames(d), petromin: tx("Petromin", "بترومين") };
  const enNames = kindNames(resolvePage(experiencesSchema, content, "en").dates);
  // a booking on a Petromin night or on a session staff closed since is named too
  const booked = await loadSessionsById(bookings.map((b) => b.sessionId));
  const sessions = new Map([...(rides?.sessions ?? []), ...booked].map((s) => [s.id, s]));
  const day = (iso: string) => new Intl.DateTimeFormat(intlOf(locale), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const statusText = { booked: tx("Booked", "محجوز"), waitlist: tx("Waitlist", "قائمة الانتظار"), riding: tx("On the ride", "في الجولة") };
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
          {bookings.length === 0 ? (
            <p className="ac-empty">{S(c.home.noRides)} {!hidden.includes("experiences") && <a href={localHref("/experiences", locale)}>{tx("See the dates", "المواعيد")} <span aria-hidden="true">{isRtl(locale) ? "←" : "→"}</span></a>}</p>
          ) : (
            <div className="ac-rides">
              {bookings.map((b) => {
                const s = sessions.get(b.sessionId);
                const name = s ? sessionName(s, names, enNames, L !== "en") : tx("Ride", "جولة");
                return (
                  <div key={b.sessionId} className="ac-ride">
                    <div><strong>{name}</strong><span>{day(b.date)}{s?.times ? <> · <bdi dir="ltr">{s.times[0]}</bdi></> : null}</span></div>
                    <ul>{b.riders.map((r, i) => <li key={i}><span>{r.name}{r.type && r.type !== "None" ? ` · ${TYPE_NAME[r.type] ? tx(TYPE_NAME[r.type].en, TYPE_NAME[r.type].ar) : r.type}` : ""}{r.size ? ` · ${r.size}` : ""}</span><em className={r.status}>{statusText[r.status]}</em></li>)}</ul>
                  </div>
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
