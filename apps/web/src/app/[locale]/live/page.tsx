import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell, { navFrom } from "@/components/site/PageShell";
import SignIn from "@/components/account/SignIn";
import LiveMap from "@/components/live/LiveMap";
import "@/components/account/account.css";
import "@/components/live/live.css";
import { accountSchema } from "@/content/pages/account";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { getAccount } from "@/lib/account";
import { asLocale, resolvePage } from "@/lib/content";
import { bookingLink, localHref } from "@/lib/links";
import { SESSION_ID } from "@/lib/live";
import { pageState } from "@/lib/page-state";
import { kindNames, sessionName } from "@/lib/rides";
import { fmtDayDate, rideEndsAt } from "@/lib/tickets";
import { loadTicketSessions } from "@/lib/tickets-data";
import { serverL } from "@/i18n/dicts";
import { isRtl } from "@/i18n/locales";

// micromobility.sa/live?session=<id> - where the ride leader is during a ride, for a rider with a
// booking on it (the account's ticket links here on the day). The map itself is
// components/live/LiveMap.tsx; the positions come through /api/live with the account cookie.
const S = (v: unknown) => (typeof v === "string" ? v : "");

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMeta({ path: "/live", locale, title: `${serverL(locale)("Live map", "الخريطة الحية")} · Micromobility`, noindex: true });
}

export default async function LivePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const asked = (await searchParams).session;
  const sessionId = typeof asked === "string" && SESSION_ID.test(asked) ? asked : null;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const [{ content, previewing, hidden }, acct] = await Promise.all([pageState(), getAccount()]);
  const site = resolvePage(siteSchema, content, L);
  const title = tx("Live map", "الخريطة الحية");
  const arrow = isRtl(locale) ? "←" : "→";

  if (!acct) {
    const c = resolvePage(accountSchema, content, L);
    const app = navFrom(site).booking;
    const handoff = (auth?: string) => bookingLink(`${app.replace(/[?#].*$/, "")}?handoff=site${auth ? `&auth=${auth}` : ""}`, locale);
    return (
      <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
        <div className="ac">
          <section className="ac-card">
            <img src="/site/logo-dark.png" alt="Micromobility" className="ac-logo" />
            <p className="ac-eyebrow">{title}</p>
            <h1>{S(c.signin.title)}</h1>
            <p className="ac-text">{tx("Sign in with your Micromobility account to see where your ride is.", "سجّل الدخول بحساب مايكروموبيليتي لترى أين وصلت جولتك.")}</p>
            <SignIn locale={locale} />
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

  // The ride's name and day, for the heading (read with the account's token: a private ride too); a
  // session that cannot be read still gets its map.
  const d = resolvePage(experiencesSchema, content, L).dates;
  const names = { ...kindNames(d), petromin: tx("Petromin", "بترومين") };
  const enNames = kindNames(resolvePage(experiencesSchema, content, "en").dates);
  const s = sessionId ? (await loadTicketSessions([sessionId], acct)).get(sessionId) : undefined;

  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="ac ac-in">
        <header className="lv-head">
          <div>
            <p className="ac-eyebrow">{title}</p>
            <h1>{s ? sessionName(s, names, enNames, L !== "en") : title}</h1>
            {s && <p>{fmtDayDate(s.date, locale)}</p>}
          </div>
          <a className="ac-out" href={localHref("/account", locale)}>{tx("My account", "حسابي")} <span aria-hidden="true">{arrow}</span></a>
        </header>
        {sessionId ? (
          <>
            <p className="ac-who">{tx("Where the ride leader is right now, updated every ten seconds. Only riders booked on this ride can see it.", "أين قائد الجولة الآن، ويُحدَّث كل عشر ثوانٍ. لا يراه إلا الركاب المحجوزون في هذه الجولة.")}</p>
            <LiveMap sessionId={sessionId} locale={locale} until={s ? rideEndsAt(s) : null} />
          </>
        ) : (
          <p className="ac-empty">{tx("Open the live map from a ticket on your account on the day of the ride.", "افتح الخريطة الحية من تذكرتك في حسابك يوم الجولة.")} <a href={localHref("/account", locale)}>{tx("My account", "حسابي")} <span aria-hidden="true">{arrow}</span></a></p>
        )}
      </div>
    </PageShell>
  );
}
