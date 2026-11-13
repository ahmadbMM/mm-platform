import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell, { navFrom } from "@/components/site/PageShell";
import "@/components/experiences/experiences.css";
import "@/components/booking/booking.css";
import "@/components/account/account.css";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { termsSchema } from "@/content/pages/terms";
import { parseBody } from "@/lib/journal";
import { asLocale, resolvePage } from "@/lib/content";
import { bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { kindNames, loadRides, sessionName, upcoming, type RideKind, type RideSession } from "@/lib/rides";
import { routeItems } from "@/lib/route-names";
import { notOpenYet, opensText, siteBookingWindow } from "@/lib/booking-window";
import BookingFlow, { type FlowEvent } from "@/components/experiences/BookingFlow";
import LearnTeaser, { learnTeaser } from "@/components/learn/LearnTeaser";
import { riyadhClock } from "@/lib/workshop-days";
import { dayWord, fmtClock, fmtDayDate, ticketRoute, type TicketRoute } from "@/lib/tickets";
import { getAccount, rpcServer } from "@/lib/account";
import { bookingAccount } from "@/lib/booking-server";
import { bizOf, faresOf } from "@/lib/biz";
import { priceMap, type AddonItem, type BookAccount, type BookSession } from "@/lib/booking";
import { serverL } from "@/i18n/dicts";
import { fill as fillNamed, fmtNum } from "@/lib/fill";
import { fill as fillAt, phrase } from "@/i18n/tx";
import { ArrowIcon } from "@/components/site/Icons";
import { bg } from "@/lib/img";
import { payReady } from "@/lib/pay/config";
import { paySettings } from "@/lib/pay/settings";

// micromobility.sa/experiences - booking a ride on the website (the owner, 2026-10-03: "full
// booking on the website"), as the booking app's own wizard books one (BookingFlow): the event,
// its dates as the app's session cards, the riders, the waiver, the review, and the tickets. The
// events, dates and prices are read live from the booking system; the booking goes through the
// app's own customer_create_booking (app/api/booking), which prices every row itself. A session for men
// only or women only (the owner, 2026-10-27; lib/session-gender.ts) is listed to every visitor, signed in or not,
// of either gender, as a mixed one is (the owner, 2026-10-28: "make all pool sessions visible to all genders but
// only male can book male sessions and female can book female sessions"), and the booking refuses anyone else
// (BookingFlow).
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);

// The ticket's bike type names, as My Account says them.
const TYPE_NAME: Record<string, { en: string; ar: string }> = {
  Road: phrase("Road", "طريق"), Hybrid: phrase("Hybrid", "هجين"), Mountain: phrase("Mountain", "جبلي"), "Road Carbon": phrase("Road Carbon", "طريق كربون"),
  Kids: phrase("Kids", "أطفال"), Own: phrase("Own bike", "دراجتي الخاصة"),
};

/** The add-on items the listed sessions sell, read with the public key (the columns the booking
 *  app's customers read: never what the shop pays). */
async function loadAddonItems(ids: string[]): Promise<AddonItem[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const clean = [...new Set(ids)].filter((x) => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 60);
  if (!url || !key || !clean.length) return [];
  try {
    const res = await fetch(`${url}/rest/v1/inventory?select=id,name,brand,photo,price,qty,category,nutrition,flavour,volume_ml&id=in.(${clean.join(",")})`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Record<string, unknown>[];
    return rows.filter((r) => typeof r.id === "string").map((r) => ({
      id: r.id as string, name: S(r.name) || (r.id as string), brand: S(r.brand), photo: /^https:\/\//.test(S(r.photo)) ? S(r.photo) : "",
      price: Number(r.price) || 0, qty: Number(r.qty) || 0, category: S(r.category) || "Other", nutrition: !!(r.nutrition || r.flavour || r.volume_ml),
    }));
  } catch {
    return [];
  }
}

// Are Saturday rides booked at micromobility.sa/saturday, with a ride code (the owner, 2026-11-08)? Staff switch it on in
// the booking app (saturday_link_only, rentals 20261108120000); then a Saturday date's button goes to that page, for
// anyone with a code, member or not. Any failure, or a database without the function, reads as no: the booking app.
async function saturdayLinkOnly(): Promise<boolean> {
  const r = await rpcServer<boolean>("saturday_link_only", {});
  return r.data === true;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("experiences");
  const c = resolvePage(experiencesSchema, content, asLocale(locale));
  return pageMeta({ path: "/experiences", locale, title: `${serverL(locale)("Experiences", "التجارب")} · Micromobility`, description: S(c.hero.text), closed });
}

export default async function ExperiencesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const q = await searchParams;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const [{ content, previewing, hidden }, rides, signed] = await Promise.all([pageState("experiences"), loadRides(), getAccount()]);
  // asked only while a Saturday date is on the books: whether it is booked at micromobility.sa/saturday with a code
  const satLink = (rides?.sessions ?? []).some((s) => s.kind === "saturday") ? await saturdayLinkOnly() : false;
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(experiencesSchema, content, L);
  const d = c.dates, e = c.events;
  const prices = priceMap(rides?.prices ?? []);
  // The highest fares and the riders per account admins set in the booking app (Settings > Pricing
  // and > Business; lib/biz.ts): the review's ranges and the party's cap, as the database applies them.
  const maxPrices = faresOf(rides?.prices).max;
  const biz = bizOf(content);
  const jccCap = biz.jccAccountCap;
  // The cards' rules (jccNote, evNote) say the caps the database enforces through {riders} and {seats}, as main's
  // Experiences fills them; left as written they reached the rider as "{riders}" (bug hunt 2026-11-10).
  const caps = { riders: fmtNum(biz.jccAccountCap, locale), seats: fmtNum(biz.eventSeatMax, locale) };

  const kindName = kindNames(d);
  const enName = L !== "en" ? kindNames(resolvePage(experiencesSchema, content, "en").dates) : kindName;
  const routeKm = routeItems(content, L);
  const now = riyadhClock(new Date());
  const today = now.slice(0, 10);
  // every date ahead, men-only and women-only ones too, to every visitor (the owner, 2026-10-28)
  const all = upcoming(rides?.sessions ?? [], now);
  // The booking window (site_content booking.window): a date not open yet is shown greyed, never hidden.
  const window = siteBookingWindow(content);
  const clock = (x: string) => fmtClock(x, locale);
  const toBook = (s: RideSession): BookSession => {
    const community = s.kind !== "jcc" && s.kind !== "snd96"; // rideKind: anything but these is a community row
    const approval = !!s.approval;
    const places = (approval ? s.spots || s.capacity : s.capacity) || 12;
    return {
      id: s.id, date: s.date, kind: s.kind, name: s.kind === "jcc" ? "" : sessionName(s, kindName, enName, L !== "en", L === "ar"), // by its Arabic name on the Arabic page (title_ar, 2026-11-13), as main's page and Events name it
      full: s.full, community, members: s.members, free: s.free, approval,
      seat: s.kind === "event" ? s.price ?? 0 : null,
      capacity: places, left: s.left ?? null, wlCap: s.wlCap ?? null, km: s.km ?? { beg: 20, int: 40 }, addons: s.addons ?? [],
      meetUrl: s.meetUrl ?? null, location: s.location ?? null, routeSlug: s.routeSlug,
      day: fmtDayDate(s.date, locale),
      near: ((w) => (w === "today" ? tx("Today", "اليوم") : w === "tomorrow" ? tx("Tomorrow", "غداً") : null))(dayWord(s.date, today)),
      time: s.times ? (s.gather ? `${S(d.gather)} ${clock(s.times[0])} · ${S(d.start)} ${clock(s.times[1])}` : `${clock(s.times[0])} – ${clock(s.times[1])}`) : "",
      collect: s.collect ? fillAt(tx("Collect bikes from {0}", "استلام الدراجات من {0}"), clock(s.collect)) : null,
      // a Saturday ride booked with a ride code (2026-11-08): anyone with a code, member or not, books it on its own page
      ...(satLink && s.kind === "saturday" ? { members: false, satLink: `/saturday?lang=${locale}` } : {}),
      opens: window && notOpenYet(s.date, window, now, s.kind) ? opensText(s.date, window, locale, tx) : null,
      description: s.kind === "event" ? s.description ?? null : null,
      gender: s.gender ?? null, // men only, women only or mixed (2026-10-27): its chip, and who may book it
      closedTypes: s.closedTypes ?? [], // the bike types staff closed on it (2026-11-03): neither picked nor priced
    };
  };
  // The route on a booking's ticket (ticketRoute): the Routes page's, or the circuit drawn.
  const routeOf = (s: RideSession): TicketRoute | null => ticketRoute({
    id: s.id, date: s.date, kind: s.kind, title: s.title, approval: !!s.approval, published: false, times: s.times, gathers: s.gather, collect: s.collect,
    meetUrl: s.meetUrl ?? null, free: s.free, freeRide: s.free, bikes: s.kind !== "swim" && s.kind !== "workshop" && s.kind !== "event" && s.kind !== "runher" && s.kind !== "vlap" && s.kind !== "arena", routeSlug: s.routeSlug, location: s.location ?? null, breakfast: null,
    revealAt: s.revealAt ?? null, // a Saturday ride whose meeting point is told later draws no route yet (spotHeld)
  }, routeKm);
  // The booking app's events (_evMatch) in its order: the National Day ride and the ticketed
  // events while they have dates, the circuit, the community rides, and the T100 workshop while
  // one is dated. Petromin nights are booked through the company's own form, never here.
  // Run for Her (ride_kind 'runher') is not offered here yet: this booking has no runner step (the distance,
  // the emergency contact, 18 and over), so a run is booked in the booking app, as main's page hands it over.
  // Victory Lap (ride_kind 'vlap') neither: no athlete step here (race, division, team, T-shirt, 16 and over,
  // Kamin Sports' agreement); main's page hands it to the booking app (?ev=vlap).
  // The Arena Heros Hybrid Race (ride_kind 'arena', 2026-10-28) neither: no athlete step here (the race, the division,
  // the team code, the organisers' agreement); main's page hands it to the booking app (?ev=arena). Listed nowhere
  // here, so it is never read as a Saturday ride.
  // The DEFE 5KM Run (ride_kind 'defe5k') neither: no runner step or race question here; main's page hands it
  // to the booking app.
  // The Blood Donation event (ride_kind 'blood', 2026-11-03) neither: no donor step here; main's page hands it to the
  // booking app (?ev=blood). Listed nowhere here, so its words and its poster never reach this page.
  // Yoga (ride_kind 'yoga', 2026-11-12) neither: this booking has no step for a session without a bike other than the
  // pool, a workshop or a ticketed event (lib/booking.ts NO_BIKE), so it would be offered a bike; main's page lists it
  // inside MicroMobility Experiences on its own card and hands it to the booking app. Listed nowhere here, so it is
  // never read as a Saturday ride. Main's Featured cards, the Experiences card's marks and kind switch, the Saturday
  // ride's sunrise and routes, and Booked on a date the visitor holds (2026-11-13) are its ExperienceSteps page's own:
  // they are not drawn by this booking flow.
  const EVENT_OF: Record<RideKind, string> = { jcc: "jcc", saturday: "community", swim: "community", petromin: "", workshop: "workshop", snd96: "snd96", event: "event", runher: "", vlap: "", defe5k: "", arena: "", blood: "", yoga: "" };
  const sessionsOf = (key: string) => all.filter((s) => EVENT_OF[s.kind] === key).slice(0, Math.max(1, N(d.count)));
  const listed: RideSession[] = [];
  const card = (key: string, p: "snd" | "jcc" | "comm" | "ws" | "ev", always: boolean): FlowEvent | null => {
    const ss = sessionsOf(key);
    if (!always && ss.length === 0) return null;
    listed.push(...ss);
    return { key, title: S(e[`${p}Title`]), meta: S(e[`${p}Meta`]), logo: S(e[`${p}Logo`]), note: fillNamed(S(e[`${p}Note`]), caps), sessions: ss.map(toBook) };
  };
  const events = [card("snd96", "snd", false), card("event", "ev", false), card("jcc", "jcc", true), card("community", "comm", true), card("workshop", "ws", false)].filter((x): x is FlowEvent => !!x);
  const ps = paySettings(content);
  const paying = ps.enabled && ps.bookings !== "off" && payReady();
  const [acct, items, wallet] = await Promise.all([
    signed ? bookingAccount(signed).catch((): BookAccount | null => null) : Promise.resolve(null),
    loadAddonItems(listed.flatMap((s) => (s.free ? [] : s.addons ?? []))),
    // the wallet's balance, for the review's Wallet switch when the ride is paid now (customer_wallet)
    paying && signed ? rpcServer<{ balance?: number } | null>("customer_wallet", { p_id: signed.id, p_token: signed.token }).then((r) => Number(r.data?.balance) || 0, () => 0) : Promise.resolve(0),
  ]);
  const one = (v: string | string[] | undefined) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null);
  const app = navFrom(site).booking; // the booking app as staff set it
  const appBase = app.replace(/[?#].*$/, "");

  const good = list(c.good.items).filter((g) => S(g.title));
  const learn = learnTeaser(c.learn); // Learn to ride: the lessons sign-up, while staff offer lessons
  const directions = S(site.contact.jccHref);
  const whatsapp = S(site.social.whatsapp);
  // The cancellation terms a booking paid online links to from its review (the owner's answer to question 3, 2026-11-10):
  // the Terms' refunds clause as staff keep it (Website > Terms; found by its English title, in English and Arabic only,
  // as the Terms page shows it), under the refund rule the wizard words from staff's pay settings.
  const refundAt = list(resolvePage(termsSchema, content, "en").clauses.items).findIndex((x) => /refund/i.test(S(x.title)));
  const refundClause = paying && refundAt >= 0 ? list(resolvePage(termsSchema, content, L).clauses.items)[refundAt] : null;
  const cancelTerms = refundClause ? { lang: L === "ar" ? "ar" : "en", title: S(refundClause.title), blocks: parseBody(S(refundClause.body)) } : null;

  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="xp">
        <section className="xp-hero" style={{ backgroundImage: `linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,.25) 46%,rgba(0,0,0,.12) 70%),url('${bg(S(c.hero.image))}')` }}>
          <p className="xp-eyebrow">{S(c.hero.eyebrow)}</p>
          <h1>{S(c.hero.title)}</h1>
          <p className="xp-hero-text">{S(c.hero.text)}</p>
          <div className="xp-btns">
            <a className="xp-btn" href="#book">{S(c.hero.bookBtn)} <ArrowIcon size={15} /></a>
          </div>
        </section>

        <div className="xp-wrap">
          <section className="xp-sec" id="book">
            <BookingFlow locale={locale} events={events} prices={prices} maxPrices={maxPrices} jccCap={jccCap} seatMax={biz.eventSeatMax} acct={acct} items={items}
              pay={paying ? { mode: ps.bookings, holdMinutes: ps.holdMinutes, refundDays: ps.refundDays, wallet, terms: cancelTerms } : undefined}
              start={{ ev: one(q.ev), session: one(q.session) }}
              text={{ eventTitle: S(c.steps.eventTitle), noDates: S(c.steps.noDates), membersNote: S(d.membersNote), clubLink: S(d.clubLink), gather: S(d.gather), start: S(d.start) }}
              links={{
                apply: localHref("/community/registration", locale), account: localHref("/account", locale), club: hidden.includes("club") ? "" : localHref("/club", locale),
                signup: bookingLink(`${appBase}?handoff=site&auth=signup`, locale), app: bookingLink(app, locale), place: directions || null,
                instagram: S(site.social.instagram),
              }}
              today={today} now={new Date().getTime()}
              typeNames={Object.fromEntries(Object.entries(TYPE_NAME).map(([k, v]) => [k, tx(v.en, v.ar)]))}
              routes={Object.fromEntries(listed.map((s) => [s.id, routeOf(s)]))} />
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
