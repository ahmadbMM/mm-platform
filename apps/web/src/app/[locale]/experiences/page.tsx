import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import "@/components/experiences/experiences.css";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { fmtNum } from "@/lib/fill";
import { bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { kindNames, loadRides, sessionName, upcoming, type RideKind, type RideSession } from "@/lib/rides";
import ExperienceSteps, { type StepEvent, type StepSession, type StepText } from "@/components/experiences/ExperienceSteps";
import { riyadhClock } from "@/lib/workshop-days";

// micromobility.sa/experiences - booking in steps (ExperienceSteps): the event, a date, then the
// ride with its prices and rules, handed to the booking app on that event and date. The events,
// dates and prices are read live from the booking system.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);

// The booking app's bike types, in the order a rider meets them there.
const TYPE_ORDER = ["Road", "Hybrid", "Mountain", "Road Carbon", "Kids", "Gravel", "Any"];
const TYPE_NAME: Record<string, [string, string]> = {
  Road: ["Road", "طريق"], Hybrid: ["Hybrid", "هجين"], Mountain: ["Mountain", "جبلي"], "Road Carbon": ["Road Carbon", "طريق كربون"],
  Kids: ["Kids", "أطفال"], Gravel: ["Gravel", "حصى"], Any: ["No preference", "بلا تفضيل"],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("experiences");
  const c = resolvePage(experiencesSchema, content, asLocale(locale));
  return { title: `${locale === "ar" ? "التجارب" : "Experiences"} · Micromobility`, description: S(c.hero.text), robots: closed ? { index: false, follow: false } : undefined };
}

export default async function ExperiencesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const ar = L === "ar";
  const [{ content, previewing, hidden }, rides] = await Promise.all([pageState("experiences"), loadRides()]);
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(experiencesSchema, content, L);
  const d = c.dates, e = c.events, st = c.steps;
  const book = bookingLink(S(c.hero.bookHref), locale);

  const prices = (rides?.prices ?? []).slice().sort((a, b) => {
    const i = (t: string) => (TYPE_ORDER.indexOf(t) + 1 || 99);
    return i(a.type) - i(b.type) || a.type.localeCompare(b.type);
  });
  const sar = (n: number) => (ar ? `${fmtNum(n, locale)} ر.س` : `SAR ${fmtNum(n, locale)}`);
  // "No preference" rides whatever bike is free: from its own price up to the dearest standard bike
  const anyTop = Math.max(0, ...prices.filter((p) => ["Road", "Hybrid", "Mountain"].includes(p.type)).map((p) => p.price));

  const kindName = kindNames(d);
  const enName = ar ? kindNames(resolvePage(experiencesSchema, content, "en").dates) : kindName;
  const day = (iso: string) => new Intl.DateTimeFormat(ar ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const all = upcoming(rides?.sessions ?? [], riyadhClock(new Date()));
  // The booking app's events (_evMatch): the circuit, the community rides, and the National Day
  // ride and the T100 workshop, which have cards of their own while they have dates.
  const EVENT_OF: Record<RideKind, string> = { jcc: "jcc", saturday: "community", swim: "community", petromin: "community", workshop: "workshop", snd96: "snd96" };
  const toStep = (s: RideSession): StepSession => ({
    id: s.id, day: day(s.date), name: sessionName(s, kindName, enName, ar),
    when: s.times ? { gather: s.gather, a: s.times[0], b: s.times[1] } : null,
    members: s.members, free: s.free, full: s.full, paid: !s.free, noCarbon: s.noCarbon,
  });
  const sessionsOf = (key: string) => all.filter((s) => EVENT_OF[s.kind] === key).slice(0, Math.max(1, N(d.count))).map(toStep);
  const card = (key: string, p: string, always: boolean): StepEvent | null => {
    const sessions = sessionsOf(key);
    if (!always && sessions.length === 0) return null;
    return { key, title: S(e[`${p}Title`]), meta: S(e[`${p}Meta`]), logo: S(e[`${p}Logo`]), note: S(e[`${p}Note`]), sessions };
  };
  const events = [card("snd96", "snd", false), card("jcc", "jcc", true), card("community", "comm", true), card("workshop", "ws", false)].filter((x): x is StepEvent => !!x);
  const text: StepText = {
    steps: [S(st.stepEvent), S(st.stepDate), S(st.stepBook)], eventTitle: S(st.eventTitle), dateTitle: S(st.dateTitle), bookTitle: S(st.bookTitle),
    cont: S(st.continue), waitlist: S(d.waitlist), back: S(st.back), noDates: S(st.noDates), handoff: S(st.handoff),
    members: S(d.members), free: S(d.free), full: S(d.full), gather: S(d.gather), start: S(d.start), membersNote: S(d.membersNote), clubLink: S(d.clubLink),
    pricesTitle: S(c.prices.title), pricesText: S(c.prices.text), codeNote: S(c.prices.codeNote),
  };

  const good = list(c.good.items).filter((g) => S(g.title));
  const directions = S(site.contact.jccHref);
  const whatsapp = S(site.social.whatsapp);

  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="xp">
        <section className="xp-hero" style={{ backgroundImage: `linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,.25) 46%,rgba(0,0,0,.12) 70%),url('${S(c.hero.image)}')` }}>
          <p className="xp-eyebrow">{S(c.hero.eyebrow)}</p>
          <h1>{S(c.hero.title)}</h1>
          <p className="xp-hero-text">{S(c.hero.text)}</p>
          <div className="xp-btns">
            <a className="xp-btn" href="#book">{S(c.hero.bookBtn)} <span aria-hidden="true">{ar ? "←" : "→"}</span></a>
          </div>
        </section>

        <div className="xp-wrap">
          <section className="xp-sec" id="book">
            <ExperienceSteps locale={locale} events={events} bookHref={book} clubHref={localHref("/club", locale)} text={text}
              prices={prices.map((p) => ({ type: p.type, label: TYPE_NAME[p.type] ? TYPE_NAME[p.type][ar ? 1 : 0] : p.type, price: p.price > 0 ? (p.type === "Any" && anyTop > p.price ? `${sar(p.price)} – ${sar(anyTop)}` : sar(p.price)) : S(d.free) }))} />
          </section>

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
            {whatsapp && <a className="xp-btn line" href={whatsapp} target="_blank" rel="noopener">{ar ? "واتساب" : "WhatsApp"}</a>}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
