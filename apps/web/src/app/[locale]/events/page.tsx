import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import "@/components/pages/pages.css";
import { eventsSchema } from "@/content/pages/events";
import { experiencesSchema } from "@/content/pages/experiences";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { bookingLink, localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { kindNames, loadRides, sessionName, upcoming, type RideKind, type RideSession } from "@/lib/rides";
import { riyadhClock } from "@/lib/workshop-days";

// micromobility.sa/events - every upcoming session in the booking system, month by month, each
// booked in the booking app; sessions are named the way /experiences names them.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);
const KIND_COLOUR: Record<RideKind, string> = { jcc: "#2f63ad", saturday: "#077a4b", swim: "#0d7d8f", workshop: "#c2410c", snd96: "#00894a", petromin: "#a33b2e" };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("events");
  const c = resolvePage(eventsSchema, content, asLocale(locale));
  return { title: `${S(c.hero.eyebrow)} · Micromobility`, description: S(c.hero.text), robots: closed ? { index: false, follow: false } : undefined };
}

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const ar = L === "ar";
  const [{ content, previewing, hidden }, rides] = await Promise.all([pageState("events"), loadRides()]);
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(eventsSchema, content, L);
  const d = resolvePage(experiencesSchema, content, L).dates;
  const dEn = resolvePage(experiencesSchema, content, "en").dates;
  const book = bookingLink(S(c.hero.bookHref), locale);
  const kindName = kindNames(d), enName = kindNames(dEn);
  const name = (s: RideSession) => sessionName(s, kindName, enName, ar);
  const sessions = upcoming(rides?.sessions ?? [], riyadhClock(new Date())).slice(0, Math.max(1, N(c.hero.count)));
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(ar ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { ...o, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const months: { key: string; label: string; items: RideSession[] }[] = [];
  for (const s of sessions) {
    const key = s.date.slice(0, 7);
    if (months[months.length - 1]?.key !== key) months.push({ key, label: fmt(s.date, { month: "long", year: "numeric" }), items: [] });
    months[months.length - 1].items.push(s);
  }
  const hostHref = S(c.host.href);
  const hostShown = hostHref && !hidden.includes(hostHref.replace(/^\/(?:en\/|ar\/)?/, "").split(/[/?#]/)[0]);
  const places = list(c.places.items).filter((p) => S(p.name));
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="pg">
        <p className="pg-eyebrow">{S(c.hero.eyebrow)}</p>
        <h1>{S(c.hero.title)}</h1>
        {S(c.hero.text) && <p className="pg-lead">{S(c.hero.text)}</p>}
        {months.length > 0 ? (
          <div className="pg-events">
            {months.map((m) => (
              <div key={m.key} style={{ display: "contents" }}>
                <p className="pg-month">{m.label}</p>
                {m.items.map((s) => (
                  <div key={s.id} className={`pg-event${s.full ? " is-full" : ""}`} style={{ ["--kind" as string]: KIND_COLOUR[s.kind] }}>
                    <div className="pg-date"><strong>{fmt(s.date, { day: "numeric" })}</strong><span>{fmt(s.date, { weekday: "short" })}</span></div>
                    <div className="pg-event-body">
                      <strong>{name(s)}</strong>
                      <div className="pg-event-meta">
                        {s.times && (s.gather
                          ? <span>{S(d.gather)} <bdi dir="ltr">{s.times[0]}</bdi> · {S(d.start)} <bdi dir="ltr">{s.times[1]}</bdi></span>
                          : <span><bdi dir="ltr">{s.times[0]} – {s.times[1]}</bdi></span>)}
                        <em>{s.kind === "jcc" || s.kind === "snd96" ? S(c.hero.rideTag) : S(c.hero.communityTag)}</em>
                        {s.members && <em>{S(d.members)}</em>}
                        {s.free && <em>{S(d.free)}</em>}
                        {s.full && <em className="warn">{S(d.full)}</em>}
                      </div>
                    </div>
                    <a href={book}>{s.full ? S(d.waitlist) : S(d.book)}</a>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="pg-empty">{S(d.empty)}</p>
        )}
        {S(c.host.text) && (
          <div className="pg-host">
            <p>{S(c.host.text)}</p>
            {hostShown && S(c.host.button) && <a className="pg-btn line" href={localHref(hostHref, locale)}>{S(c.host.button)}</a>}
          </div>
        )}
        {places.length > 0 && (
          <section aria-labelledby="pg-places-h">
            <h2 id="pg-places-h">{S(c.places.title)}</h2>
            <div className="pg-places">
              {places.map((p, i) => (
                <a key={i} href={S(p.href) || undefined} target="_blank" rel="noopener noreferrer">
                  <strong>{S(p.name)}</strong>{S(p.text) && <span>{S(p.text)}</span>}{S(p.href) && <em>{ar ? "الاتجاهات ←" : "Directions →"}</em>}
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}
