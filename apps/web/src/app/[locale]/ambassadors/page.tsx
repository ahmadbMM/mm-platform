import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import AmbassadorPortal from "@/components/ambassadors/AmbassadorPortal";
import AmbassadorApply from "@/components/ambassadors/AmbassadorApply";
import AmbassadorBoard from "@/components/ambassadors/AmbassadorBoard";
import "@/components/ambassadors/ambassadors.css";
import { ambassadorsSchema } from "@/content/pages/ambassadors";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { fill, fmtNum } from "@/lib/fill";
import { pageState } from "@/lib/page-state";
import { riyadhClock } from "@/lib/workshop-days";

// micromobility.sa/ambassadors - the programme, an ambassador's card, and the application,
// which lands in the staff page (Ambassadors).
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);
const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState();
  const a = resolvePage(ambassadorsSchema, content, asLocale(locale));
  return { title: `${S(a.hero.eyebrow)} · Micromobility`, robots: closed ? { index: false, follow: false } : undefined };
}

export default async function AmbassadorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const { content, previewing } = await pageState();
  const site = resolvePage(siteSchema, content, L);
  const a = resolvePage(ambassadorsSchema, content, L);
  const r = a.rules;
  const numbers = { discount: N(r.discount), rentalPts: N(r.rentalPts), eventPts: N(r.eventPts), workshopPts: N(r.workshopPts), captainAt: N(r.captainAt), eliteAt: N(r.eliteAt) };
  const shown = Object.fromEntries(Object.entries(numbers).map(([k, v]) => [k, fmtNum(v, locale)]));
  const F = (v: unknown) => fill(S(v), shown);
  const ar = L === "ar";
  const pts = (n: number) => (ar ? `+${fmtNum(n, locale)} نقطة` : `+${fmtNum(n, locale)} pts`);
  const now = riyadhClock(new Date());
  const season = `Q${Math.floor((Number(now.slice(5, 7)) - 1) / 3) + 1} ${now.slice(0, 4)}`;
  const h = a.hero, how = a.how, tiers = a.tiers;
  const tierNames: [string, string, string] = [S(tiers.t1Name), S(tiers.t2Name), S(tiers.t3Name)];
  const rules = [
    { label: S(how.rentalLabel), value: numbers.rentalPts, note: F(how.rentalNote) },
    { label: S(how.workshopLabel), value: numbers.workshopPts, note: F(how.workshopNote) },
    { label: S(how.eventLabel), value: numbers.eventPts, note: F(how.eventNote) },
  ].filter((x) => x.value > 0);
  return (
    <PageShell locale={locale} site={site} preview={previewing}>
      <div className="amb">
        <section className="amb-hero">
          <div>
            <p className="amb-eyebrow">{S(h.eyebrow)}</p>
            <h1>{F(h.title)}</h1>
            <p className="amb-hero-text">{F(h.text)}</p>
            <div className="amb-hero-btns">
              <a className="primary" href="#apply">{S(h.applyBtn)}</a>
              <a className="line" href="#how">{S(h.howBtn)}</a>
            </div>
            <div className="amb-stats">
              {list(h.stats).map((s, i) => S(s.value) && <div key={i}><strong>{F(s.value)}</strong><span>{F(s.label)}</span></div>)}
            </div>
          </div>
          <div className="amb-demo" aria-hidden="true">
            <span>{S(h.demoTitle)}</span>
            <div className="amb-demo-code"><strong className="mm-lat">{S(h.demoCode)}</strong><span className="mm-lat">-{numbers.discount}%</span></div>
            {rules.map((x, i) => <div key={i} className="amb-demo-row"><span>{x.label}</span><strong>{pts(x.value)}</strong></div>)}
            <small>{F(h.demoNote)}</small>
          </div>
        </section>
        <div className="amb-portal-wrap">
          <AmbassadorPortal
            locale={locale} title={S(a.portal.title)} text={S(a.portal.text)} share={S(a.portal.share)} discount={numbers.discount}
            tierNames={tierNames} labels={{ rental: S(how.rentalLabel), workshop: S(how.workshopLabel), event: S(how.eventLabel) }}
            rewardsTitle={S(a.redeem.title)}
            rewards={list(a.redeem.items).map((x) => ({ label: S(x.label), cost: N(x.cost) })).filter((x) => x.label && x.cost > 0)}
          />
        </div>
        <section className="amb-sec" id="how">
          <h2>{S(how.title)}</h2>
          <div className="amb-steps">
            {list(how.steps).map((s, i) => S(s.title) && <div key={i}><span>{fmtNum(i + 1, locale)}</span><strong>{F(s.title)}</strong><p>{F(s.text)}</p></div>)}
          </div>
        </section>
        {rules.length > 0 && (
          <section className="amb-sec">
            <h2>{S(how.earnTitle)}</h2>
            <p className="amb-muted">{F(how.earnText)}</p>
            <div className="amb-rules">
              {rules.map((x, i) => <div key={i}><strong>{x.label}</strong><b>{pts(x.value)}</b><p>{x.note}</p></div>)}
            </div>
          </section>
        )}
        <section className="amb-sec">
          <h2>{S(tiers.title)}</h2>
          <div className="amb-tiers">
            {[
              { name: tierNames[0], req: S(tiers.t1Req), perks: lines(F(tiers.t1Perks)) },
              { name: tierNames[1], req: ar ? `${shown.captainAt} نقطة` : `${shown.captainAt} pts`, perks: lines(F(tiers.t2Perks)) },
              { name: tierNames[2], req: ar ? `${shown.eliteAt} نقطة` : `${shown.eliteAt} pts`, perks: lines(F(tiers.t3Perks)) },
            ].map((x, i) => (
              <div key={i} className={`amb-tier${i === 2 ? " elite" : ""}`}>
                <div><strong>{x.name}</strong><small>{x.req}</small></div>
                <ul>{x.perks.map((pk, j) => <li key={j}>{pk}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>
        {a.board.show === true && <AmbassadorBoard locale={locale} title={S(a.board.title)} text={fill(S(a.board.text), { season })} />}
        <div className="amb-apply-wrap" id="apply">
          <AmbassadorApply locale={locale} title={S(a.apply.title)} text={S(a.apply.text)} button={S(a.apply.button)} note={S(a.apply.note)} doneTitle={S(a.apply.doneTitle)} doneText={S(a.apply.doneText)} />
        </div>
      </div>
    </PageShell>
  );
}
