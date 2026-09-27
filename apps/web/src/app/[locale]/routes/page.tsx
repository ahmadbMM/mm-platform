import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import "@/components/pages/pages.css";
import { routesSchema } from "@/content/pages/routes";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { fmtNum, fill } from "@/lib/fill";
import { elevationProfile, loadGpx, profilePaths, type GpxTrack } from "@/lib/gpx";
import { localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { serverL } from "@/i18n/dicts";
import { isRtl } from "@/i18n/locales";

// micromobility.sa/routes - places to ride in and around Jeddah, each with a map link and, when
// staff link a GPX file, its elevation profile (drawn here, no library), a distance and climb read
// from the track where the fields are left at 0, and the file to download; Strava and Komoot links
// when set. The page's words are typed from its schema (content/pages/routes.ts): c.routes.items is
// a list of routes, each with its name, its distance and so on, so nothing here has to check what
// it was given.

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("routes");
  const c = resolvePage(routesSchema, content, asLocale(locale));
  return pageMeta({ path: "/routes", locale, title: `${c.hero.eyebrow} · Micromobility`, description: c.hero.text, closed });
}

export default async function RoutesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const tx = serverL(locale);
  const { content, previewing, hidden } = await pageState("routes");
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(routesSchema, content, L);
  const routes = c.routes.items.filter((r) => r.name);
  // The GPX files, read together; one that cannot be read leaves its route as it was.
  const tracks: (GpxTrack | null)[] = await Promise.all(routes.map((r) => (r.gpxHref ? loadGpx(r.gpxHref) : Promise.resolve(null))));
  const n = (v: number) => fmtNum(v, locale);
  const time = (m: number) => {
    const h = Math.floor(m / 60), rest = m % 60;
    if (m < 60) return fill(tx("{m} min", "{m} د"), { m: n(m) });
    return rest ? fill(tx("{h} h {m} min", "{h} س {m} د"), { h: n(h), m: n(rest) }) : fill(tx("{h} h", "{h} س"), { h: n(h) });
  };
  const arrow = isRtl(locale) ? "←" : "→";
  const ctaHref = c.cta.href;
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="pg">
        <p className="pg-eyebrow">{c.hero.eyebrow}</p>
        <h1>{c.hero.title}</h1>
        {c.hero.text && <p className="pg-lead">{c.hero.text}</p>}
        <div className="pg-routes">
          {routes.map((r, i) => {
            const t = tracks[i];
            // staff's own figures first; the track's where a field is left at 0
            const km = r.km > 0 ? r.km : t && t.distanceKm > 0 ? Math.round(t.distanceKm * 10) / 10 : 0;
            const climb = r.climb > 0 ? r.climb : t && t.climbM > 0 ? t.climbM : 0;
            const stats = [
              km > 0 && [tx("Distance", "المسافة"), fill(tx("{n} km", "{n} كم"), { n: n(km) })],
              climb > 0 && [tx("Climb", "الصعود"), fill(tx("{n} m", "{n} م"), { n: n(climb) })],
              r.minutes > 0 && [tx("Time", "الوقت"), time(r.minutes)],
              r.surface && [tx("Surface", "السطح"), r.surface],
            ].filter(Boolean) as [string, string][];
            const profile = t ? elevationProfile(t) : null;
            const paths = profile ? profilePaths(profile, 320, 80) : null;
            const links = [
              r.href && { href: localHref(r.href, locale), label: tx("Open in Maps", "افتح في الخرائط") },
              r.gpxHref && { href: r.gpxHref, label: tx("Download GPX", "تنزيل GPX"), download: true },
              r.stravaHref && { href: r.stravaHref, label: "Strava" },
              r.komootHref && { href: r.komootHref, label: "Komoot" },
            ].filter((x): x is { href: string; label: string; download?: boolean } => !!x);
            return (
              <div key={i} className="pg-route">
                <div className="pg-route-head">
                  <div><strong>{r.name}</strong>{r.area && <span>{r.area}</span>}</div>
                  {r.level && <span className="pg-level">{r.level}</span>}
                </div>
                {stats.length > 0 && <div className="pg-stats">{stats.map(([k, v]) => <span key={k}>{k}<strong>{v}</strong></span>)}</div>}
                {paths && (
                  <figure className="pg-elev">
                    <svg viewBox="0 0 320 80" preserveAspectRatio="none" role="img" aria-label={`${tx("Elevation profile", "منحنى الارتفاع")}: ${fill(tx("{n} m", "{n} م"), { n: `${n(paths.min)} – ${n(paths.max)}` })}`}>
                      <path className="pg-elev-area" d={paths.area} />
                      <path className="pg-elev-line" d={paths.line} />
                    </svg>
                    <figcaption><span>{tx("Elevation profile", "منحنى الارتفاع")}</span><bdi dir="ltr">{fill(tx("{n} m", "{n} م"), { n: `${n(paths.min)} – ${n(paths.max)}` })}</bdi></figcaption>
                  </figure>
                )}
                {r.text && <p>{r.text}</p>}
                {links.length > 0 && (
                  <div className="pg-route-links">
                    {links.map((l) => (
                      <a key={l.label} href={l.href} target={l.href.startsWith("/") && !l.download ? undefined : "_blank"} rel="noopener noreferrer" download={l.download ? "" : undefined}>{l.label} {arrow}</a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {c.cta.title && (
          <div className="pg-cta">
            <div><h2>{c.cta.title}</h2>{c.cta.text && <p>{c.cta.text}</p>}</div>
            {ctaHref && c.cta.button && !hidden.includes(ctaHref.replace(/^\/(?:en\/|ar\/)?/, "").split(/[/?#]/)[0]) && <a className="pg-btn" href={localHref(ctaHref, locale)}>{c.cta.button}</a>}
          </div>
        )}
      </div>
    </PageShell>
  );
}
