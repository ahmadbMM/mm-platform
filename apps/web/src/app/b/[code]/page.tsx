import type { Metadata } from "next";
import LangToggle from "../LangToggle";
import { bikeState, filled, getBikeByNumber, ridePrice, type BikeRow } from "@/lib/bikes";
import { bikeTitle, fmtDate, fmtPrice, speedsLabel, tFor, translateValue, type BikeLang } from "@/lib/bike-i18n";
import { readBikeLang } from "@/lib/bike-lang";

// Where a rider goes to book. The rentals app answers on its own origin today and moves to
// micromobility.sa/experiences later; when it does, this one line changes and nothing else.
const BOOKING_URL = "https://micromobilityrentals.pages.dev";

type Field = { label: string; value: string };
type Group = { heading?: string; fields: Field[] };

/**
 * The page shows what staff filled in and nothing else: every candidate is pushed with its
 * raw value, the blanks are dropped, and a group with nothing left never renders its heading.
 * No placeholder dashes — a field exists on screen only because it exists on the record.
 */
function buildGroups(row: BikeRow, lang: BikeLang, titleUsedBrandModel: boolean): Group[] {
  const t = tFor(lang);
  const tv = (v: string) => translateValue(v, t);

  const spec: Array<[string, unknown]> = [
    // Already the headline when the title was built from them — a spec row repeating it
    // would just be the same two words twice on one screen.
    [t("fBrand"), titleUsedBrandModel ? null : row.brand],
    [t("fModel"), titleUsedBrandModel ? null : row.model],
    [t("fFrame"), filled(row.frame_type) ? tv(row.frame_type!) : null],
    [t("fSize"), filled(row.size) ? tv(row.size!) : null],
    [t("fGroupset"), row.groupset],
    // A count of zero speeds or zero kilos is a broken import, not a specification.
    [t("fSpeeds"), Number(row.speeds) > 0 ? speedsLabel(Number(row.speeds), lang) : null],
    [t("fWheels"), row.wheel_size],
    [t("fBrakes"), row.brake_type],
    [t("fWeight"), Number(row.weight_kg) > 0 ? `${row.weight_kg} ${t("unitKg")}` : null],
    [t("fColour"), (row.color_names ?? []).filter(filled).join(" · ") || null],
  ];

  const service: Array<[string, unknown]> = [
    [t("fInService"), filled(row.in_service_date) ? fmtDate(row.in_service_date!, lang) : null],
    [t("fLastService"), filled(row.last_serviced_at) ? fmtDate(row.last_serviced_at!, lang) : null],
  ];

  const pick = (pairs: Array<[string, unknown]>): Field[] =>
    pairs.filter(([, v]) => filled(v)).map(([label, v]) => ({ label, value: String(v).trim() }));

  return ([
    { heading: t("specs"), fields: pick(spec) },
    { heading: t("service"), fields: pick(service) },
  ] as Group[]).filter((g) => g.fields.length > 0);
}

export async function generateMetadata({
  params,
}: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  // The tab title is read by the same person as the page, so it is built in their language.
  const [row, lang] = await Promise.all([getBikeByNumber(code), readBikeLang()]);
  const name = row ? bikeTitle(row, tFor(lang)).title : `#${code}`;
  return { title: `${name} · MicroMobility`, robots: { index: false, follow: false } };
}

export default async function BikePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [row, lang] = await Promise.all([getBikeByNumber(code), readBikeLang()]);
  const t = tFor(lang);

  // An unrecognised sticker is a dead end, not an error page: say so and offer the way out.
  if (!row) {
    return (
      <main className="bk-unknown">
        <h1>{t("unknownTitle")}</h1>
        <p>{t("unknownBody")}</p>
        <p className="lat">micromobility.sa/b/{code}</p>
        <a className="bk-cta" href="https://micromobility.sa">{t("unknownCta")}</a>
      </main>
    );
  }

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

  // The line under the title says what the title did not. When the headline is already
  // "Mountain bike" the type would only repeat itself, so only the frame material is left.
  const category = [heading.fromType ? null : row.type, row.frame_type]
    .filter(filled)
    .map((v) => translateValue(String(v), t))
    .join(" · ");

  return (
    <main className="bk-page">
      <div className="bk-hero" data-photo={heroStyle ? "yes" : "none"} style={heroStyle}>
        <div className="bk-hero-bar">
          <div className="bk-hero-start">
            {/* The mark is inline so the hero never waits on a second request. */}
            <svg className="bk-mark" viewBox="0 0 32 32" fill="none" aria-label="MicroMobility">
              <circle cx="9" cy="22" r="6.5" stroke="#FBF9F4" strokeWidth="2" />
              <circle cx="23" cy="22" r="6.5" stroke="#FBF9F4" strokeWidth="2" />
              <path d="M9 22l5-11h6l3 11" stroke="#FBF9F4" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <LangToggle lang={lang} />
          </div>
          <span className="bk-code lat">#{row.bike_number}</span>
        </div>
      </div>

      <div className="bk-title">
        <h1>{heading.title}</h1>
        {/* Dropped when the headline is already the bike's kind: all that would be left is
            the frame material, which the specification grid states properly a few lines down. */}
        {category && !heading.fromType && <p className="bk-cat">{category}</p>}
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
                  <div className="bk-field" key={f.label}>
                    <p className="bk-label">{f.label}</p>
                    <p className="bk-value">{f.value}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <footer className="bk-foot">
        {state === "hold" ? (
          <p className="bk-notice">{t("holdNotice")}</p>
        ) : (
          <>
            {state === "out" && <p className="bk-notice">{t("outNotice")}</p>}
            <a className="bk-cta" href={BOOKING_URL} target="_blank" rel="noopener">
              {t("book")}
            </a>
          </>
        )}
      </footer>
    </main>
  );
}
