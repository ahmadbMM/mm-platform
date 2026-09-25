import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import ClubCard from "@/components/club/ClubCard";
import ClubRides from "@/components/club/ClubRides";
import "@/components/club/club.css";
import { clubSchema } from "@/content/pages/club";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { fill, fmtNum } from "@/lib/fill";
import { bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { getAccount } from "@/lib/account";

// micromobility.sa/club - the Community membership as the Club: how it works, a member's card,
// the upcoming community rides. Joining is the community application, received by the staff
// page (Community > Applications).
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);
const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("club");
  const c = resolvePage(clubSchema, content, asLocale(locale));
  return { title: `${S(c.hero.eyebrow)} · Micromobility`, description: S(c.hero.text), robots: closed ? { index: false, follow: false } : undefined };
}

export default async function ClubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const ar = L === "ar";
  const [{ content, previewing, hidden }, acct] = await Promise.all([pageState("club"), getAccount()]);
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(clubSchema, content, L);
  const r = c.rules;
  const shown = { perTen: fmtNum(N(r.perTen), locale), groupRidePts: fmtNum(N(r.groupRidePts), locale), reviewPts: fmtNum(N(r.reviewPts), locale), proAt: fmtNum(N(r.proAt), locale), legendAt: fmtNum(N(r.legendAt), locale) };
  const F = (v: unknown) => fill(S(v), shown);
  const tierNames: [string, string, string] = [S(c.tiers.t1Name), S(c.tiers.t2Name), S(c.tiers.t3Name)];
  const credits = ar ? "رصيد" : "credits";
  const applyHref = localHref(S(c.hero.applyHref), locale);
  const ridesHref = bookingLink(S(c.hero.ridesHref), locale);
  const words = lines(S(c.hero.marquee));
  const earn = [
    { label: S(c.earn.paidLabel), value: ar ? `${shown.perTen} لكل 10 ر.س` : `${shown.perTen} / SAR 10`, on: N(r.perTen) > 0 },
    { label: S(c.earn.groupLabel), value: `+${shown.groupRidePts}`, on: N(r.groupRidePts) > 0 },
    { label: S(c.earn.reviewLabel), value: `+${shown.reviewPts}`, on: N(r.reviewPts) > 0 },
  ].filter((x) => x.on);
  const tiers = [
    { name: tierNames[0], req: S(c.tiers.t1Req), perks: lines(F(c.tiers.t1Perks)) },
    { name: tierNames[1], req: `${shown.proAt} ${credits}`, perks: lines(F(c.tiers.t2Perks)) },
    { name: tierNames[2], req: `${shown.legendAt} ${credits}`, perks: lines(F(c.tiers.t3Perks)) },
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
              <span className="club-cardviz-brand"><img src="/site/logo-mark.png" alt="" /><span>{ar ? "بطاقة العضوية" : "Membership card"}</span></span>
              <span className="club-pill">{tierNames[1]}</span>
            </div>
            <div className="club-cardviz-bottom">
              <span className="club-cardviz-label">{ar ? "رصيد ركوب" : "ride credits"}</span>
              <strong className="club-cardviz-num">—</strong>
              <div className="club-cardviz-foot"><strong>{ar ? "بطاقتك بانتظارك" : "Your card awaits"}</strong><span>{ar ? "انضم لتفعيل بطاقتك" : "Join to activate your card"}</span></div>
            </div>
          </div>
        </section>
        {words.length > 0 && (
          <div className="club-marquee" dir="ltr" aria-hidden="true">
            <div>{[...words, ...words].map((w, i) => <span key={i}>{w} <i>◆</i></span>)}</div>
          </div>
        )}
        <section className="club-join" id="card">
          <ClubCard locale={locale} title={S(c.card.title)} text={S(c.card.text)} notMember={S(c.card.notMember)} applyBtn={S(c.hero.applyBtn)} applyHref={applyHref} tierNames={tierNames} email={acct?.email} phone={acct?.phone} />
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
                    <span className="club-cardviz-brand"><img src={i === 2 ? "/site/logo-mark-dark.png" : "/site/logo-mark.png"} alt="" /><span>{ar ? "بطاقة العضوية" : "Membership card"}</span></span>
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
            <a href={bookingLink(S(c.rides.allHref), locale)}>{S(c.rides.allLabel)} {ar ? "←" : "→"}</a>
          </div>
          <ClubRides locale={locale} href={bookingLink(S(c.rides.allHref), locale)} empty={S(c.rides.empty)} />
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
