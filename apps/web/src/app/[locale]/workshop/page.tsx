import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import WorkshopForm, { type Service } from "@/components/workshop/WorkshopForm";
import WorkshopTrack from "@/components/workshop/WorkshopTrack";
import "@/components/workshop/workshop.css";
import { siteSchema } from "@/content/pages/site";
import { workshopSchema } from "@/content/pages/workshop";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { slugId } from "@/lib/slug";
import { riyadhClock } from "@/lib/workshop-days";
import { DATE_STYLES, datePattern } from "@/lib/date-pattern";
import { bg } from "@/lib/img";

// micromobility.sa/workshop - a service request, received by the staff page (Workshop section).
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);
const slug = (s: string, i: number) => slugId(s, `service-${i + 1}`);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("workshop");
  const w = resolvePage(workshopSchema, content, asLocale(locale));
  return pageMeta({ path: "/workshop", locale, title: `${S(w.intro.title).replace(/[.。।۔!]\s*$/, "")} · Micromobility`, description: S(w.intro.text), closed });
}

export default async function WorkshopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const { content, previewing, hidden } = await pageState("workshop");
  const site = resolvePage(siteSchema, content, L);
  const w = resolvePage(workshopSchema, content, L);
  // Service ids come from the English names so the staff page's list reads the same whatever
  // language the customer used.
  const enNames = resolvePage(workshopSchema, content, "en");
  const services: Service[] = list(w.services.items).map((s, i) => ({
    id: slug(S(list(enNames.services.items)[i]?.name), i), pos: i + 1, name: S(s.name), sub: S(s.sub), price: N(s.price), mins: N(s.mins),
    includes: S(s.includes).split("\n").map((x) => x.trim()).filter(Boolean),
  })).filter((s) => s.name);
  const parts = list(w.services.parts).map((p, i) => ({ id: slug(S(list(enNames.services.parts)[i]?.label), i).replace(/^service-/, "part-"), label: S(p.label), price: N(p.price) })).filter((p) => p.label);
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <section className="ws-grid">
        <div className="ws-intro">
          <span className="ws-eyebrow">{S(w.intro.eyebrow)}</span>
          <h1>{S(w.intro.title)}</h1>
          <p className="ws-lead">{S(w.intro.text)}</p>
          <ul className="ws-features">{list(w.intro.features).map((f, i) => S(f.label) && <li key={i}>{S(f.label)}</li>)}</ul>
          <div className="ws-photo" style={{ backgroundImage: `linear-gradient(to top,rgba(0,0,0,.55),transparent),url('${bg(S(w.intro.image))}')` }}>
            <div><strong>{S(w.intro.locTitle)}</strong><span>{S(site.contact.hoursText)}</span></div>
          </div>
        </div>
        <WorkshopForm
          locale={locale}
          formTitle={S(w.booking.formTitle)} formSub={S(w.booking.formSub)}
          services={services}
          symptoms={list(w.services.symptoms).map((s) => ({ label: S(s.label), service: N(s.service) })).filter((s) => s.label)}
          parts={parts}
          wait={w.booking.wait === true} pickup={w.booking.pickup === true} pickupFee={N(w.booking.pickupFee)}
          now={riyadhClock(new Date())} days={N(w.booking.days) || 7}
          times={list(w.booking.times).map((x) => S(x.time)).filter((x) => /^([01]\d|2[0-3]):[0-5]\d$/.test(x)).sort()}
          fridayClosed={site.contact.fridayClosed === true} closeHour={N(site.contact.closeHour) || 22}
          dayFmt={datePattern(locale, DATE_STYLES.workshopDay)}
          doneTitle={S(w.booking.doneTitle)} doneText={S(w.booking.doneText)}
        />
        <WorkshopTrack locale={locale} whenFmt={datePattern(locale, DATE_STYLES.booked)} />
      </section>
    </PageShell>
  );
}
