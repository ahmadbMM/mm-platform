import type { Metadata } from "next";
import { cache } from "react";
import BrandField from "./BrandField";
import LangToggle from "./LangToggle";
import { bikeState, getBikeByNumber, ridePrice } from "@/lib/bikes";
import { filled } from "@/lib/filled";
import { buildGroups } from "@/lib/bike-fields";
import { bikeTitle, fmtPrice, isBikeLang, tFor, type BikeLang } from "@/lib/bike-i18n";
import "./bike.css";

// A fleet bike's NFC tag page: micromobility.sa/bikes/42 (the stickers still hold /b/42, which
// next.config redirects here). A rider tapping a sticker sees the bike, its state and its price,
// and books; a full-screen dark page of its own, not a page of the site - no header, no footer -
// rendered by the catalogue's [category] route when the segment is a number.
//
// Language: the route's, which next-intl reads from the site's language cookie (the globe here
// writes it), the phone's languages, else English; the same rule as every other page.

// Where a rider goes to book. The rentals app answers on its own origin today and moves to
// micromobility.sa/experiences later; when it does, this one line changes and nothing else.
const BOOKING_URL = "https://micromobilityrentals.pages.dev";
// The handoff keeps a secondary "See this bike in the store" button in the markup behind a
// flag, hidden by default. It stays hidden here for a concrete reason: the shop is a hosted
// Salla store on its own domain and the bikes table has no per-bike product id to link to.
// Turn this on once one exists, and give STORE_URL the real product path.
const SHOW_STORE_CTA = false;
const STORE_URL = "https://micromobility.sa/store";

/** A tag's code: the sticker is a number, nothing else. */
export const isFleetCode = (segment: string) => /^\d{1,6}$/.test(segment);

// The metadata and the page both need the bike; one read serves both within a request.
const lookup = cache(getBikeByNumber);

const langOf = (locale: string): BikeLang => (isBikeLang(locale) ? locale : "en");

/** The tab title, in the rider's language; never indexed. */
export async function fleetBikeMeta(code: string, locale: string): Promise<Metadata> {
  const found = await lookup(code);
  const name = found.status === "found" ? bikeTitle(found.row, tFor(langOf(locale))).title : `#${code}`;
  return { title: `${name} · MicroMobility`, robots: { index: false, follow: false } };
}

export default async function FleetBike({ code, locale }: { code: string; locale: string }) {
  const lang = langOf(locale);
  const found = await lookup(code);
  const t = tFor(lang);

  // A fleet we could not reach is a fault to retry, not a sticker to give up on. Saying
  // "unrecognised" here would send a rider away from a bike that is sitting right in front
  // of them, and would hide a broken deployment behind a sentence about their sticker.
  if (found.status === "unavailable") {
    return (
      <div className="bk-root">
        <main className="bk-unknown">
          <BrandField />
          <h1>{t("errTitle")}</h1>
          <p>{t("errBody")}</p>
          <a className="bk-cta" href={`/bikes/${encodeURIComponent(code)}`}>{t("errCta")}</a>
        </main>
      </div>
    );
  }

  // An unrecognised sticker is a dead end, not an error page: say so and offer the way out.
  if (found.status === "missing") {
    return (
      <div className="bk-root">
        <main className="bk-unknown">
          <BrandField />
          <h1>{t("unknownTitle")}</h1>
          <p className="lat">micromobility.sa/bikes/{code}</p>
          <a className="bk-cta" href="https://micromobility.sa">{t("unknownCta")}</a>
        </main>
      </div>
    );
  }

  const row = found.row;
  const state = bikeState(row);
  const price = ridePrice(row);
  const heading = bikeTitle(row, t);
  const groups = buildGroups(row, lang, heading.fromBrandModel);
  const heroStyle = filled(row.photo)
    ? {
        backgroundImage:
          `linear-gradient(to top, #1A1919 0%, rgba(26,25,25,.2) 45%, rgba(26,25,25,.35) 100%), url(${JSON.stringify(row.photo)})`,
      }
    : undefined;

  // "Road bike, size M", as the reference design writes it. When the headline is already
  // "Road bike" the type would only repeat itself, so the size carries the line alone.
  const kindKey = `t${String(row.type ?? "").trim()}`;
  const kind = !heading.fromType && t(kindKey) !== kindKey ? t(kindKey) : null;
  const sized = filled(row.size) ? t("catSize").replace("{0}", String(row.size).trim()) : null;
  // Arabic separates with ،, not a Latin comma.
  const category = [kind, sized].filter(Boolean).join(t("listSep"));

  return (
    <div className="bk-root">
      <main className="bk-page">
        <div
          className="bk-hero"
          data-photo={heroStyle ? "yes" : "none"}
          style={heroStyle}
        >
          <div className="bk-hero-bar">
            <div className="bk-hero-start">
              <span className="bk-brand" role="img" aria-label="MicroMobility" />
              <LangToggle lang={lang} label={t("lang")} />
            </div>
            <span className="bk-code lat">#{row.bike_number}</span>
          </div>
        </div>

        <div className="bk-title">
          <h1>{heading.title}</h1>
          {category && <p className="bk-cat">{category}</p>}
          <span className="bk-pill" data-state={state}>
            {t(`st${state[0].toUpperCase()}${state.slice(1)}`)}
          </span>
          {/* What the ride actually costs, by the same rule the rentals app charges by. Absent
              rather than zero when the bike is not rented out. */}
          {price !== null && (
            <p className="bk-price">
              <span className="lat">{fmtPrice(price, lang)}</span>
              <span className="bk-price-label">{t("price")}</span>
            </p>
          )}
        </div>

        {groups.length > 0 && (
          <div className="bk-groups">
            {groups.map((g) => (
              <section className="bk-group" key={g.heading}>
                {g.heading && <h2>{g.heading}</h2>}
                <div className="bk-grid">
                  {g.fields.map((f) => (
                    <div className="bk-spec" key={f.label}>
                      <p className="bk-label">{f.label}</p>
                      <p className="bk-value">{f.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* The handoff also specifies a secondary "See this bike in the store" button. It is not
            built: the shop is a hosted Salla store on its own domain with no per-bike product
            URL to point at, so there is no destination for it yet. Add it here when there is. */}
        <footer className="bk-foot">
          {state === "hold" ? (
            <p className="bk-notice">{t("holdNotice")}</p>
          ) : (
            <>
              {state === "out" && <p className="bk-notice">{t("outNotice")}</p>}
              <a className="bk-cta" href={BOOKING_URL} target="_blank" rel="noopener">
                {t("book")}
              </a>
              {SHOW_STORE_CTA && (
                <a className="bk-cta2" href={STORE_URL}>
                  {t("store")} <span className="mirror-rtl">→</span>
                </a>
              )}
            </>
          )}
        </footer>
      </main>
    </div>
  );
}
