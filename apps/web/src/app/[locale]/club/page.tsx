import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell, { navFrom } from "@/components/site/PageShell";
import ClubRides from "@/components/club/ClubRides";
import MembersArea from "@/components/club/MembersArea";
import "@/components/club/club.css";
import { clubSchema } from "@/content/pages/club";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { fill, fmtNum } from "@/lib/fill";
import { bookingLink, bookingPage, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { readAccount, rpcServer } from "@/lib/account";
import { readAskList } from "@/lib/ask-server";
import { memberArea, memberTitle } from "@/lib/members";
import { readMemberHub } from "@/lib/member-hub-server";
import { bloodName } from "@/content/blood-words";
import { notOpenYet, opensAt, opensInWords, opensText, siteBookingWindow } from "@/lib/booking-window";
import { kindNames, sessionName, sessionGenders, type RideKind } from "@/lib/rides";
import { genderBlock, genderChip, genderText, sessionGender } from "@/lib/session-gender";
import { riyadhClock } from "@/lib/workshop-days";
import { DATE_STYLES, datePattern } from "@/lib/date-pattern";
import { serverL } from "@/i18n/dicts";
import { ArrowIcon } from "@/components/site/Icons";

// micromobility.sa/club - the Community membership as the Club: how it works, a member's card,
// the upcoming community rides. Joining is the community application, received by the staff
// page (Community > Applications). A signed-in member sees the members' area (member_area, read with
// the account's own session; components/club/MembersArea.tsx) - their own membership, never another
// member's - and a signed-in visitor who is not a member a line saying so. Anyone else is asked to sign
// in: the card no longer opens with an email and a mobile number (club_card, which named the member,
// their tier and rides to anyone who typed both, is closed to the site since 2026-11-11); a signed-in
// account whose membership cannot be read just now is told so. Its members' rides list every ride
// member_area gives, one for men only or women only too (the owner, 2026-10-28: "make all pool sessions visible to all genders but only
// male can book male sessions and female can book female sessions"), each such ride and each pool session
// with its chip, and a member of the other gender reads "This session is for women only." in place of Book.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);
const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("club");
  const c = resolvePage(clubSchema, content, asLocale(locale));
  return pageMeta({ path: "/club", locale, title: `${S(c.hero.eyebrow)} · Micromobility`, description: S(c.hero.text), closed });
}

export default async function ClubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const tx = serverL(locale);
  // a profile read that timed out or failed ("unread") is not a signed-out visitor: it is told the card could not be opened
  const [{ content, previewing, hidden }, raw] = await Promise.all([pageState("club"), readAccount()]);
  const acct = raw === "unread" ? null : raw;
  const area = acct ? memberArea(await rpcServer<unknown>("member_area", { p_id: acct.id, p_token: acct.token })) : null;
  // Plan my Saturdays and My month (the booking app's new features F10 and F13; lib/member-hub.ts): the member's own
  // reads, begun here beside the reads below and awaited before the page is drawn
  const hub = acct && area?.ok && area.member ? readMemberHub(acct, riyadhClock(new Date()).slice(0, 10)) : null;
  // member_area lists every upcoming members' ride, whatever its rule, and does not say it: each ride's is read
  // through list_sessions for the account; when that cannot be read, the rides wear no chip and keep their Book
  const genders = acct && area?.ok && area.member && area.upcoming.length ? await sessionGenders(area.upcoming.map((r) => r.id), acct) : null;
  const title = acct && area?.ok && area.member ? memberTitle(await rpcServer<unknown>("customer_my_titles", { p_id: acct.id, p_token: acct.token })) : null;
  // the open Ask pages for this member (ask_list, as micromobility.sa/ask lists them; the booking app's Community tab shows the same)
  const asks = acct && area?.ok && area.member ? (await readAskList({ id: acct.id, token: acct.token })).pages : [];
  const members = area?.ok ? (area.member && genders ? { ...area, upcoming: area.upcoming.map((r) => ({ ...r, gender: genders.get(r.id) ?? null })) } : area) : null;
  // who is looking, for the refusal: the account's gender (customer_profile, which readAccount read; null when none is on file)
  const viewer = acct ? { gender: sessionGender(acct.profile?.gender) } : null;
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(clubSchema, content, L);
  const r = c.rules;
  const shown = { perTen: fmtNum(N(r.perTen), locale), groupRidePts: fmtNum(N(r.groupRidePts), locale), reviewPts: fmtNum(N(r.reviewPts), locale), proAt: fmtNum(N(r.proAt), locale), legendAt: fmtNum(N(r.legendAt), locale) };
  const F = (v: unknown) => fill(S(v), shown);
  const tierNames: [string, string, string] = [S(c.tiers.t1Name), S(c.tiers.t2Name), S(c.tiers.t3Name)];
  const applyHref = localHref(S(c.hero.applyHref), locale);
  const ridesHref = bookingLink(S(c.hero.ridesHref), locale);
  // The members' rides are named as Experiences names them, and booked in the booking app on that ride
  // (the kind is the session's ride_kind: Run for Her, 'runher', opens on its own event, ev=runher, and
  // Victory Lap, 'vlap', on its own, ev=vlap, and Arena Heros, 'arena', on its own, ev=arena; the DEFE 5KM Run,
  // 'defe5k', yoga, 'yoga', and the Farm House Night, 'farm', are community dates, ev=community).
  const d = resolvePage(experiencesSchema, content, L).dates;
  const kindName = kindNames(d), enName = kindNames(resolvePage(experiencesSchema, content, "en").dates);
  const asKind = (k: string | null): RideKind => (k && k in kindName ? (k as RideKind) : "saturday");
  const nameOf = (kind: string | null, title: string) => sessionName({ kind: asKind(kind), title: title || null }, kindName, enName, L !== "en");
  const bookAt = (id: string, kind: string | null) => {
    const ev = kind === "event" || kind === "workshop" || kind === "snd96" || kind === "runher" || kind === "vlap" || kind === "arena" ? kind : "community";
    try { const u = new URL(bookingLink(S(c.rides.allHref), locale)); u.searchParams.set("ev", ev); u.searchParams.set("session", id); return u.toString(); } catch { return ridesHref; }
  };
  const drawn = new Date();
  const now = riyadhClock(drawn), today = now.slice(0, 10);
  const { plan, month } = hub ? await hub : { plan: null, month: null };
  // My month's kinds, named as My Account's Stats names them (a Petromin night, the Blood Donation event too)
  const kindOf: Record<RideKind, string> = { ...kindName, petromin: tx("Petromin", "بترومين"), blood: bloodName(tx) };
  // a members' ride not open to book yet says when it opens, beside a clock; within a day of it, a countdown to the
  // real window that the browser keeps up to date each minute and that turns into Book on time, as on Experiences
  const window = siteBookingWindow(content);
  const opens = (date: string, kind: string | null) => (window && notOpenYet(date, window, now, kind) ? opensText(date, window, locale, tx, drawn.getTime()) : null);
  const opensWhen = (date: string) => (window ? opensAt(date, window) : null);
  const sgWords = genderText(tx); // a members' ride's chip (men only, women only, or mixed on a pool session) and refusal
  const words = lines(S(c.hero.marquee));
  const earn = [
    { label: S(c.earn.paidLabel), value: fill(tx("{n} / SAR 10", "{n} لكل 10 ر.س"), { n: shown.perTen }), on: N(r.perTen) > 0 },
    { label: S(c.earn.groupLabel), value: `+${shown.groupRidePts}`, on: N(r.groupRidePts) > 0 },
    { label: S(c.earn.reviewLabel), value: `+${shown.reviewPts}`, on: N(r.reviewPts) > 0 },
  ].filter((x) => x.on);
  const tiers = [
    { name: tierNames[0], req: S(c.tiers.t1Req), perks: lines(F(c.tiers.t1Perks)) },
    { name: tierNames[1], req: fill(tx("{n} credits", "{n} رصيد"), { n: shown.proAt }), perks: lines(F(c.tiers.t2Perks)) },
    { name: tierNames[2], req: fill(tx("{n} credits", "{n} رصيد"), { n: shown.legendAt }), perks: lines(F(c.tiers.t3Perks)) },
  ];
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="club">
        <section className="club-hero">
          <div>
            <p className="club-eyebrow">{S(c.hero.eyebrow)}</p>
            <h1>{S(c.hero.title)}</h1>
            <p className="club-hero-text">{F(c.hero.text)}</p>
            <div className="club-hero-btns">
              <a className="primary" href={applyHref}>{S(c.hero.applyBtn)}</a>
              <a className="line" href={ridesHref}>{S(c.hero.ridesBtn)}</a>
            </div>
            <div className="club-stats">
              {list(c.hero.stats).map((s, i) => S(s.value) && <div key={i}><strong>{F(s.value)}</strong><span>{F(s.label)}</span></div>)}
            </div>
          </div>
          <div className="club-cardviz tier-1" aria-hidden="true">
            <div className="club-cardviz-top">
              <span className="club-cardviz-brand"><img src="/site/logo-mark.png" alt="" /><span>{tx("Membership card", "بطاقة العضوية")}</span></span>
              <span className="club-pill">{tierNames[1]}</span>
            </div>
            <div className="club-cardviz-bottom">
              <span className="club-cardviz-label">{tx("ride credits", "رصيد ركوب")}</span>
              <strong className="club-cardviz-num">—</strong>
              <div className="club-cardviz-foot"><strong>{tx("Your card awaits", "بطاقتك بانتظارك")}</strong><span>{tx("Join to activate your card", "انضم لتفعيل بطاقتك")}</span></div>
            </div>
          </div>
        </section>
        {words.length > 0 && (
          <div className="club-marquee" dir="ltr" aria-hidden="true">
            <div>{[...words, ...words].map((w, i) => <span key={i}>{w} <i>◆</i></span>)}</div>
          </div>
        )}
        <section className="club-join" id="card">
          {members?.member ? (
            <MembersArea plan={plan} month={month} kindName={(k) => kindOf[k] || enName[k] || k} asks={asks} title={title} communityHref={bookingPage("/members", navFrom(site).booking, locale)} accountHref={bookingPage("/account/badges", navFrom(site).booking, locale)} locale={locale} L={L} area={members} tierNames={tierNames} nameOf={nameOf} bookAt={bookAt} today={today} empty={S(c.rides.empty)} opens={opens} opensAt={opensWhen} opensWords={opensInWords(tx)}
              sgOf={(r) => (r.gender === undefined ? null : genderChip(r, sgWords))} refusalOf={(r) => genderBlock(r, viewer, sgWords)} />
          ) : members ? (
            <div className="club-lookup">
              <h2>{S(c.card.title)}</h2>
              <div className="club-notmember" role="status"><span>{S(c.card.notMember)}</span><a href={applyHref}>{S(c.hero.applyBtn)}</a></div>
            </div>
          ) : raw === "unread" || (acct && area && !area.ok && area.error === "unavailable") ? (
            <div className="club-lookup">
              <h2>{S(c.card.title)}</h2>
              <p role="status">{tx("It could not be opened. Check the connection and try again.", "تعذّر الفتح. تحقق من الاتصال وحاول مجدداً.")}</p>
            </div>
          ) : (
            <div className="club-lookup">
              <h2>{S(c.card.title)}</h2>
              <div className="club-signin"><a className="primary" href={localHref("/account", locale)}>{tx("Sign in", "تسجيل الدخول")}</a><a href={applyHref}>{S(c.hero.applyBtn)}</a></div>
            </div>
          )}
          {earn.length > 0 && (
            <div className="club-earn">
              <h3>{S(c.earn.title)}</h3>
              {earn.map((e, i) => <div key={i} className="club-earn-row"><span>{e.label}</span><strong>{e.value}</strong></div>)}
              <p>{F(c.earn.note)}</p>
            </div>
          )}
        </section>
        <section className="club-sec">
          <div className="club-center"><p>{S(c.tiers.eyebrow)}</p><h2>{S(c.tiers.title)}</h2></div>
          <div className="club-tiers">
            {tiers.map((x, i) => (
              <div key={i} className={`club-tier${i === 2 ? " legend" : ""}`}>
                <div className={`club-cardviz tier-${i}`} aria-hidden="true">
                  <div className="club-cardviz-top">
                    <span className="club-cardviz-brand"><img src={i === 2 ? "/site/logo-mark-dark.png" : "/site/logo-mark.png"} alt="" /><span>{tx("Membership card", "بطاقة العضوية")}</span></span>
                    <span className="club-pill">{x.name}</span>
                  </div>
                  <div className="club-cardviz-bottom"><strong className="club-cardviz-num">{x.req}</strong></div>
                </div>
                <div><strong>{x.name}</strong><small>{x.req}</small></div>
                <ul>{x.perks.map((pk, j) => <li key={j}>{pk}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>
        <section className="club-sec">
          <h2>{S(c.perks.title)}</h2>
          <p className="club-perks-text">{S(c.perks.text)}</p>
          <div className="club-perks">{list(c.perks.items).map((x, i) => S(x.title) && <div key={i}><strong>{F(x.title)}</strong><span>{F(x.text)}</span></div>)}</div>
        </section>
        <section className="club-rides">
          <div className="club-rides-head">
            <div><p>{S(c.rides.eyebrow)}</p><h2>{S(c.rides.title)}</h2></div>
            <a href={bookingLink(S(c.rides.allHref), locale)}>{S(c.rides.allLabel)} <ArrowIcon size={15} /></a>
          </div>
          <ClubRides locale={locale} href={bookingLink(S(c.rides.allHref), locale)} empty={S(c.rides.empty)} dayFmt={datePattern(locale, DATE_STYLES.rideDay)} />
        </section>
        <section className="club-sec">
          <h2 style={{ marginBottom: 22 }}>{S(c.faq.title)}</h2>
          <div className="club-faq">
            {list(c.faq.items).map((x, i) => S(x.q) && (
              <details key={i} open={i === 0}><summary>{F(x.q)}</summary><p>{F(x.a)}</p></details>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
