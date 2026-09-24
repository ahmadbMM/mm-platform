import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import "@/components/experiences/experiences.css";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { fill, fmtNum } from "@/lib/fill";
import { bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { loadRides, upcoming, type RideKind, type RideSession } from "@/lib/rides";
import { riyadhClock } from "@/lib/workshop-days";

// micromobility.sa/experiences - the rides: what kinds there are, the bike prices and the next
// dates, read live from the booking system. Booking itself happens in the booking app, which
// every Book button opens in the page's language.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);

// The booking app's own colour for each kind of ride.
const KIND_COLOUR: Record<RideKind, string> = { jcc: "#2f63ad", saturday: "#077a4b", swim: "#0d7d8f", workshop: "#c2410c", snd96: "#00894a", petromin: "#a33b2e" };
const RIDE_COLOURS = ["#2f63ad", "#077a4b", "#0d7d8f", "#c2410c", "#00894a", "#57605a"];
// The booking app's bike types, in the order a rider meets them there.
const TYPE_ORDER = ["Road", "Hybrid", "Mountain", "Road Carbon", "Kids", "Gravel", "Any"];
const TYPE_NAME: Record<string, [string, string]> = {
  Road: ["Road", "طريق"], Hybrid: ["Hybrid", "هجين"], Mountain: ["Mountain", "جبلي"], "Road Carbon": ["Road Carbon", "طريق كربون"],
  Kids: ["Kids", "أطفال"], Gravel: ["Gravel", "حصى"], Any: ["No preference", "بلا تفضيل"],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState();
  const c = resolvePage(experiencesSchema, content, asLocale(locale));
  return { title: `${locale === "ar" ? "التجارب" : "Experiences"} · Micromobility`, description: S(c.hero.text), robots: closed ? { index: false, follow: false } : undefined };
}

export default async function ExperiencesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const ar = L === "ar";
  const [{ content, previewing }, rides] = await Promise.all([pageState(), loadRides()]);
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(experiencesSchema, content, L);
  const d = c.dates;
  const book = bookingLink(S(c.hero.bookHref), locale);
  const arrow = ar ? "←" : "→";

  const prices = (rides?.prices ?? []).slice().sort((a, b) => {
    const i = (t: string) => (TYPE_ORDER.indexOf(t) + 1 || 99);
    return i(a.type) - i(b.type) || a.type.localeCompare(b.type);
  });
  const paid = prices.map((p) => p.price).filter((p) => p > 0);
  const from = paid.length ? fmtNum(Math.min(...paid), locale) : null;
  const sar = (n: number) => (ar ? `${fmtNum(n, locale)} ر.س` : `SAR ${fmtNum(n, locale)}`);
  // A price line that needs the live price is left out while the price is unknown.
  const priceLine = (v: unknown) => (S(v).includes("{from}") && !from ? "" : fill(S(v), { from: from ?? "" }));

  // Named as the booking app names them: a circuit night by its fixed name, any other session by
  // what staff called it, else its kind. Staff titles are typed once, in English; on the Arabic
  // page a title that is just the kind's English name reads as the Arabic one.
  const names = (x: Sec): Record<RideKind, string> => ({ jcc: S(x.jccName), saturday: S(x.satName), swim: S(x.swimName), workshop: S(x.workshopName), snd96: S(x.snd96Name), petromin: "" });
  const kindName = names(d);
  const enName = ar ? names(resolvePage(experiencesSchema, content, "en").dates) : kindName;
  const name = (s: RideSession) => {
    if (s.kind === "jcc" || !s.title) return kindName[s.kind];
    return ar && s.title.toLowerCase() === enName[s.kind].trim().toLowerCase() ? kindName[s.kind] : s.title;
  };
  const day = (iso: string) => new Intl.DateTimeFormat(ar ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  // A ride that gathers names its two times; any other session is a window.
  const when = (s: RideSession) => {
    if (!s.times) return null;
    return s.gather
      ? <>{S(d.gather)} <bdi dir="ltr">{s.times[0]}</bdi> · {S(d.start)} <bdi dir="ltr">{s.times[1]}</bdi></>
      : <bdi dir="ltr">{s.times[0]} – {s.times[1]}</bdi>;
  };
  const sessions = upcoming(rides?.sessions ?? [], riyadhClock(new Date())).slice(0, Math.max(1, N(d.count)));
  const anyMembers = sessions.some((s) => s.members);

  const rideCards = list(c.rides.items).filter((r) => S(r.name));
  const good = list(c.good.items).filter((g) => S(g.title));
  const directions = S(site.contact.jccHref);
  const whatsapp = S(site.social.whatsapp);

  return (
    <PageShell locale={locale} site={site} preview={previewing}>
      <div className="xp">
        <section className="xp-hero" style={{ backgroundImage: `linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,.25) 46%,rgba(0,0,0,.12) 70%),url('${S(c.hero.image)}')` }}>
          <p className="xp-eyebrow">{S(c.hero.eyebrow)}</p>
          <h1>{S(c.hero.title)}</h1>
          <p className="xp-hero-text">{S(c.hero.text)}</p>
          <div className="xp-btns">
            <a className="xp-btn" href={book}>{S(c.hero.bookBtn)} <span aria-hidden="true">{arrow}</span></a>
            <a className="xp-btn ghost" href="#dates">{S(c.hero.datesBtn)}</a>
          </div>
        </section>

        <div className="xp-wrap">
          {rideCards.length > 0 && (
            <section className="xp-sec" aria-labelledby="xp-rides-h">
              <h2 id="xp-rides-h">{S(c.rides.title)}</h2>
              <div className="xp-rides">
                {rideCards.map((r, i) => (
                  <div key={i} className="xp-ride" style={{ ["--kind" as string]: RIDE_COLOURS[i % RIDE_COLOURS.length] }}>
                    {S(r.kind) && <span className="xp-kind"><i aria-hidden="true" />{S(r.kind)}</span>}
                    <strong>{S(r.name)}</strong>
                    {S(r.when) && <span className="xp-ride-when">{S(r.when)}</span>}
                    {S(r.note) && <p>{S(r.note)}</p>}
                    {priceLine(r.price) && <span className="xp-ride-price">{priceLine(r.price)}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="xp-sec" id="dates" aria-labelledby="xp-dates-h">
            <p className="xp-label">{S(d.eyebrow)}</p>
            <h2 id="xp-dates-h">{S(d.title)}</h2>
            {sessions.length > 0 ? (
              <div className="xp-dates">
                {sessions.map((s) => (
                  <a key={s.id} className={`xp-date${s.full ? " is-full" : ""}`} href={book} style={{ ["--kind" as string]: KIND_COLOUR[s.kind] }}>
                    <span className="xp-date-day">{day(s.date)}</span>
                    <strong>{name(s)}</strong>
                    {s.times && <span className="xp-date-time">{when(s)}</span>}
                    <span className="xp-tags">
                      {s.members && <em>{S(d.members)}</em>}
                      {s.free && <em>{S(d.free)}</em>}
                      {s.full && <em className="warn">{S(d.full)}</em>}
                    </span>
                    <span className="xp-date-go">{s.full ? S(d.waitlist) : S(d.book)} <span aria-hidden="true">{arrow}</span></span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="xp-empty">{S(d.empty)}</p>
            )}
            {anyMembers && S(d.membersNote) && (
              <p className="xp-note">{S(d.membersNote)} <a href={localHref("/club", locale)}>{S(d.clubLink)} {arrow}</a></p>
            )}
          </section>

          {prices.length > 0 && (
            <section className="xp-sec" aria-labelledby="xp-prices-h">
              <p className="xp-label">{S(c.prices.eyebrow)}</p>
              <h2 id="xp-prices-h">{S(c.prices.title)}</h2>
              {S(c.prices.text) && <p className="xp-lead">{S(c.prices.text)}</p>}
              <div className="xp-prices">
                {prices.map((p) => (
                  <div key={p.type}>
                    <span>{TYPE_NAME[p.type] ? TYPE_NAME[p.type][ar ? 1 : 0] : p.type}</span>
                    <strong>{p.price > 0 ? sar(p.price) : S(d.free)}</strong>
                  </div>
                ))}
              </div>
              {S(c.prices.codeNote) && <p className="xp-note">{S(c.prices.codeNote)}</p>}
            </section>
          )}

          {good.length > 0 && (
            <section className="xp-sec" aria-labelledby="xp-good-h">
              <h2 id="xp-good-h">{S(c.good.title)}</h2>
              <div className="xp-good">
                {good.map((g, i) => <div key={i}><strong>{S(g.title)}</strong>{S(g.text) && <p>{S(g.text)}</p>}</div>)}
              </div>
            </section>
          )}

          <div className="xp-btns xp-end">
            <a className="xp-btn" href={book}>{S(c.hero.bookBtn)} <span aria-hidden="true">{arrow}</span></a>
            {directions && S(c.good.directions) && <a className="xp-btn line" href={directions} target="_blank" rel="noopener">{S(c.good.directions)}</a>}
            {whatsapp && <a className="xp-btn line" href={whatsapp} target="_blank" rel="noopener">WhatsApp</a>}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
