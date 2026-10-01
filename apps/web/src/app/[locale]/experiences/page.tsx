import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import "@/components/experiences/experiences.css";
import "@/components/booking/booking.css";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { fmtNum, fmtSar } from "@/lib/fill";
import { bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { kindNames, loadRides, sessionName, upcoming, type RideKind, type RideSession } from "@/lib/rides";
import { routeItems, routeNameOf, routeNames } from "@/lib/route-names";
import { notOpenYet, opensText, siteBookingWindow } from "@/lib/booking-window";
import ExperienceSteps, { type StepEvent, type StepSession, type StepText } from "@/components/experiences/ExperienceSteps";
import LearnTeaser, { learnTeaser } from "@/components/learn/LearnTeaser";
import { riyadhClock } from "@/lib/workshop-days";
import { dayWord, fmtClock, fmtDayDate, kmText } from "@/lib/tickets";
import { serverL } from "@/i18n/dicts";
import { fill as fillAt, phrase } from "@/i18n/tx";
import { isRtl } from "@/i18n/locales";
import { bg } from "@/lib/img";

// micromobility.sa/experiences - booking in steps (ExperienceSteps): the event, a date, then the
// ride with its prices and rules, handed to the booking app on that event and date. The events,
// dates and prices are read live from the booking system.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);

// The booking app's bike types, in the order a rider meets them there.
const TYPE_ORDER = ["Road", "Hybrid", "Mountain", "Road Carbon", "Kids", "Gravel", "Any"];
const TYPE_NAME: Record<string, { en: string; ar: string }> = {
  Road: phrase("Road", "طريق"), Hybrid: phrase("Hybrid", "هجين"), Mountain: phrase("Mountain", "جبلي"), "Road Carbon": phrase("Road Carbon", "طريق كربون"),
  Kids: phrase("Kids", "أطفال"), Gravel: phrase("Gravel", "حصى"), Any: phrase("No preference", "بلا تفضيل"),
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("experiences");
  const c = resolvePage(experiencesSchema, content, asLocale(locale));
  return pageMeta({ path: "/experiences", locale, title: `${serverL(locale)("Experiences", "التجارب")} · Micromobility`, description: S(c.hero.text), closed });
}

export default async function ExperiencesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const [{ content, previewing, hidden }, rides] = await Promise.all([pageState("experiences"), loadRides()]);
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(experiencesSchema, content, L);
  const d = c.dates, e = c.events, st = c.steps;
  const book = bookingLink(S(c.hero.bookHref), locale);

  const prices = (rides?.prices ?? []).slice().sort((a, b) => {
    const i = (t: string) => (TYPE_ORDER.indexOf(t) + 1 || 99);
    return i(a.type) - i(b.type) || a.type.localeCompare(b.type);
  });
  const sar = (n: number) => fmtSar(n, locale);
  // "No preference" rides whatever bike is free: from its own price up to the dearest standard bike
  const anyTop = Math.max(0, ...prices.filter((p) => ["Road", "Hybrid", "Mountain"].includes(p.type)).map((p) => p.price));

  const kindName = kindNames(d);
  const enName = L !== "en" ? kindNames(resolvePage(experiencesSchema, content, "en").dates) : kindName;
  const routes = routeNames(content, L); // a ride that follows a route on the Routes page is named after it
  const routeKm = routeItems(content, L);
  // What a ride costs before anything is picked (_sessFromPrice): the cheapest bike it offers.
  const fromPrice = (s: RideSession) => {
    const ps = prices.filter((p) => p.type !== "Any" && p.type !== "Own" && !(s.noCarbon && p.type === "Road Carbon")).map((p) => p.price);
    return ps.length ? fillAt(tx("from {0}", "من {0}"), sar(Math.min(...ps))) : null;
  };
  // A route's distance on the booking summary (the booking app's reg-side row): the route's own,
  // or a lap of the circuit on a circuit night without one.
  const kmOf = (s: RideSession) => {
    const km = s.routeSlug ? routeKm.get(s.routeSlug)?.km ?? 0 : s.kind === "jcc" ? 6.174 : 0;
    return km > 0 ? fillAt(s.routeSlug ? tx("{0} km", "{0} كم") : tx("{0} km a lap", "{0} كم للفة"), kmText(km)) : null;
  };
  const now = riyadhClock(new Date());
  const all = upcoming(rides?.sessions ?? [], now);
  // The booking window (site_content booking.window): a date not open yet is shown greyed, never hidden.
  const window = siteBookingWindow(content);
  // The booking app's events (_evMatch): the circuit, the community rides, and the National Day
  // ride and the T100 workshop, which have cards of their own while they have dates.
  // A ticketed event (ride_kind 'event') has a card of its own too, while one is on the books.
  const EVENT_OF: Record<RideKind, string> = { jcc: "jcc", saturday: "community", swim: "community", petromin: "community", workshop: "workshop", snd96: "snd96", event: "event" };
  const toStep = (s: RideSession): StepSession => ({
    // the booking app's session card: "Sunday · 26 Sept 2026", and its times in the rider's clock
    id: s.id, kind: s.kind, day: fmtDayDate(s.date, locale),
    // today or tomorrow said in words, as the booking app's session card does (_dayWord)
    near: ((w) => (w === "today" ? tx("Today", "اليوم") : w === "tomorrow" ? tx("Tomorrow", "غداً") : null))(dayWord(s.date, now.slice(0, 10))),
    name: sessionName(s, kindName, enName, L !== "en"),
    when: s.times ? { gather: s.gather, a: fmtClock(s.times[0], locale), b: fmtClock(s.times[1], locale) } : null,
    members: s.members, free: s.free, full: s.full, paid: !s.free, noCarbon: s.noCarbon,
    // a copy kept at the edge from before these fields existed reads as an event without them
    event: s.kind === "event", description: s.kind === "event" ? s.description ?? null : null,
    seatPrice: s.kind === "event" && s.price != null ? sar(s.price) : null, seats: s.kind === "event" && s.seats != null ? fmtNum(s.seats, locale) : null,
    route: routeNameOf(routes, s.routeSlug),
    routeKm: kmOf(s),
    // when bikes go out and the price from, under the time, as the booking app's session card says them
    meta: [s.collect ? fillAt(tx("Collect bikes from {0}", "استلام الدراجات من {0}"), fmtClock(s.collect, locale)) : null,
      s.kind !== "event" && !s.free && s.kind !== "swim" && s.kind !== "workshop" ? fromPrice(s) : null].filter((x): x is string => !!x),
    opens: window && notOpenYet(s.date, window, now) ? opensText(s.date, window, locale, tx) : null,
  });
  const sessionsOf = (key: string) => all.filter((s) => EVENT_OF[s.kind] === key).slice(0, Math.max(1, N(d.count))).map(toStep);
  const card = (key: string, p: "snd" | "jcc" | "comm" | "ws" | "ev", always: boolean): StepEvent | null => {
    const sessions = sessionsOf(key);
    if (!always && sessions.length === 0) return null;
    return { key, title: S(e[`${p}Title`]), meta: S(e[`${p}Meta`]), logo: S(e[`${p}Logo`]), note: S(e[`${p}Note`]), sessions };
  };
  const events = [card("snd96", "snd", false), card("jcc", "jcc", true), card("community", "comm", true), card("workshop", "ws", false), card("event", "ev", false)].filter((x): x is StepEvent => !!x);
  const text: StepText = {
    steps: [S(st.stepEvent), S(st.stepDate), S(st.stepBook)], eventTitle: S(st.eventTitle), dateTitle: S(st.dateTitle), bookTitle: S(st.bookTitle),
    cont: S(st.continue), waitlist: S(d.waitlist), back: S(st.back), noDates: S(st.noDates), handoff: S(st.handoff),
    members: S(d.members), free: S(d.free), full: S(d.full), gather: S(d.gather), start: S(d.start), membersNote: S(d.membersNote), clubLink: S(d.clubLink),
    available: tx("Available", "متاح"), waitlisted: tx("Waitlist", "قائمة الانتظار"),
    pricesTitle: S(c.prices.title), pricesText: S(c.prices.text), codeNote: S(c.prices.codeNote),
    everyone: S(d.everyone), perSeat: S(d.perSeat), seats: S(d.seats), route: tx("Route", "المسار"),
  };

  const good = list(c.good.items).filter((g) => S(g.title));
  const learn = learnTeaser(c.learn); // Learn to ride: the lessons sign-up, while staff offer lessons
  const directions = S(site.contact.jccHref);
  const whatsapp = S(site.social.whatsapp);

  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="xp">
        <section className="xp-hero" style={{ backgroundImage: `linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,.25) 46%,rgba(0,0,0,.12) 70%),url('${bg(S(c.hero.image))}')` }}>
          <p className="xp-eyebrow">{S(c.hero.eyebrow)}</p>
          <h1>{S(c.hero.title)}</h1>
          <p className="xp-hero-text">{S(c.hero.text)}</p>
          <div className="xp-btns">
            <a className="xp-btn" href="#book">{S(c.hero.bookBtn)} <span aria-hidden="true">{(isRtl(locale) ? "←" : "→")}</span></a>
          </div>
        </section>

        <div className="xp-wrap">
          <section className="xp-sec" id="book">
            <ExperienceSteps locale={locale} events={events} bookHref={book} clubHref={localHref("/club", locale)} text={text}
              prices={prices.map((p) => ({ type: p.type, label: TYPE_NAME[p.type] ? tx(TYPE_NAME[p.type].en, TYPE_NAME[p.type].ar) : p.type, price: p.price > 0 ? (p.type === "Any" && anyTop > p.price ? `${sar(p.price)} – ${sar(anyTop)}` : sar(p.price)) : S(d.free) }))} />
          </section>

          {learn && <LearnTeaser locale={locale} t={learn} place="experiences" />}

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
            {whatsapp && <a className="xp-btn line" href={whatsapp} target="_blank" rel="noopener">{tx("WhatsApp", "واتساب")}</a>}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
