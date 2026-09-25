import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import "@/components/pages/pages.css";
import { routesSchema } from "@/content/pages/routes";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { fmtNum, fill } from "@/lib/fill";
import { localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { serverL } from "@/i18n/dicts";

// micromobility.sa/routes - places to ride in and around Jeddah, each with a map link.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("routes");
  const c = resolvePage(routesSchema, content, asLocale(locale));
  return { title: `${S(c.hero.eyebrow)} · Micromobility`, description: S(c.hero.text), robots: closed ? { index: false, follow: false } : undefined };
}

export default async function RoutesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const { content, previewing, hidden } = await pageState("routes");
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(routesSchema, content, L);
  const routes = list(c.routes.items).filter((r) => S(r.name));
  const n = (v: number) => fmtNum(v, locale);
  const time = (m: number) => {
    const h = Math.floor(m / 60), rest = m % 60;
    if (m < 60) return fill(tx("{m} min", "{m} د"), { m: n(m) });
    return rest ? fill(tx("{h} h {m} min", "{h} س {m} د"), { h: n(h), m: n(rest) }) : fill(tx("{h} h", "{h} س"), { h: n(h) });
  };
  const ctaHref = S(c.cta.href);
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="pg">
        <p className="pg-eyebrow">{S(c.hero.eyebrow)}</p>
        <h1>{S(c.hero.title)}</h1>
        {S(c.hero.text) && <p className="pg-lead">{S(c.hero.text)}</p>}
        <div className="pg-routes">
          {routes.map((r, i) => {
            const stats = [
              N(r.km) > 0 && [tx("Distance", "المسافة"), fill(tx("{n} km", "{n} كم"), { n: n(N(r.km)) })],
              N(r.climb) > 0 && [tx("Climb", "الصعود"), fill(tx("{n} m", "{n} م"), { n: n(N(r.climb)) })],
              N(r.minutes) > 0 && [tx("Time", "الوقت"), time(N(r.minutes))],
              S(r.surface) && [tx("Surface", "السطح"), S(r.surface)],
            ].filter(Boolean) as [string, string][];
            return (
              <div key={i} className="pg-route">
                <div className="pg-route-head">
                  <div><strong>{S(r.name)}</strong>{S(r.area) && <span>{S(r.area)}</span>}</div>
                  {S(r.level) && <span className="pg-level">{S(r.level)}</span>}
                </div>
                {stats.length > 0 && <div className="pg-stats">{stats.map(([k, v]) => <span key={k}>{k}<strong>{v}</strong></span>)}</div>}
                {S(r.text) && <p>{S(r.text)}</p>}
                {S(r.href) && <a href={localHref(S(r.href), locale)} target={S(r.href).startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer">{tx("Open in Maps →", "افتح في الخرائط ←")}</a>}
              </div>
            );
          })}
        </div>
        {S(c.cta.title) && (
          <div className="pg-cta">
            <div><h2>{S(c.cta.title)}</h2>{S(c.cta.text) && <p>{S(c.cta.text)}</p>}</div>
            {ctaHref && S(c.cta.button) && !hidden.includes(ctaHref.replace(/^\/(?:en\/|ar\/)?/, "").split(/[/?#]/)[0]) && <a className="pg-btn" href={localHref(ctaHref, locale)}>{S(c.cta.button)}</a>}
          </div>
        )}
      </div>
    </PageShell>
  );
}
