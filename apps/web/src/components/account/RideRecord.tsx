import { GLYPH } from "./badge-glyphs";
import type { T } from "./RideRecord.text";
import { fill } from "@/lib/fill";
import { BADGE_SYS, type Progress, type RideStats } from "@/lib/ride-record";
import { intlOf } from "@/i18n/locales";

// My Account's record, as the booking app's account page draws it (91816da): Your rides - the last
// 26 weeks as a strip, rides this year, the favourite bike type, the time on the bike staff timed,
// the first ride - and the two badges already begun with the least left, each with its bar.
export type RecordText = (typeof T)["en"];
type Props = {
  locale: string; stats: RideStats | null; closest: Progress[]; t: RecordText;
  typeName: (type: string) => string; dur: { h: string; hm: string; m: string };
};

const COLORS = ["green", "gold", "blue", "red", "purple", "orange", "teal", "silver"];

/** A badge drawn as the booking app draws it (_bdgMedal): its glyph on a hexagon in its colour. */
export function Medal({ icon, color, className = "" }: { icon: string; color: string; className?: string }) {
  const c = COLORS.includes(color) ? color : "green";
  return (
    <svg className={`bdg-m bdc-${c} ${className}`} viewBox="0 0 40 40" aria-hidden="true">
      <path className="bdg-hex" d="M20 2.2 35.4 11.1v17.8L20 37.8 4.6 28.9V11.1z" />
      <g transform="translate(7.6 7.6) scale(1.034)" dangerouslySetInnerHTML={{ __html: GLYPH[icon] ?? GLYPH.medal }} />
    </svg>
  );
}

export default function RideRecord({ locale, stats, closest, t, typeName, dur }: Props) {
  if (!stats && !closest.length) return null;
  const day = (iso: string) => {
    try { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)); }
    catch { return iso; }
  };
  const time = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? fill(dur.hm, { h, m }) : fill(dur.h, { h })) : fill(dur.m, { m }); };
  const facts: [string, string][] = stats ? [
    [t.year, String(stats.year)],
    ...(stats.fav ? [[t.fav, typeName(stats.fav)] as [string, string]] : []),
    ...(stats.minutes >= 1 ? [[t.time, time(stats.minutes)] as [string, string]] : []),
    ...(stats.first ? [[t.first, day(stats.first)] as [string, string]] : []),
  ] : [];
  const named = (p: Progress): [string, string] => {
    const sys = BADGE_SYS[p.slug];
    if (sys && t.names[sys[2]]) return t.names[sys[2]];
    const r = p.row;
    const ar = locale === "ar";
    return [String((ar && r?.name_ar) || r?.name || p.slug), String((ar && r?.description_ar) || r?.description || "")];
  };
  return (
    <>
      {stats && (
        <div className="myr">
          <p className="myr-h">{t.yourRides}</p>
          <div className="myr-weeks" role="img" aria-label={t.weeks(String(stats.nWeeks))}>
            {stats.weeks.map((on, i) => <i key={i} className={on ? "on" : undefined} />)}
          </div>
          <p className="myr-wl">{t.weeks(String(stats.nWeeks))}</p>
          <dl className="myr-f">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </div>
      )}
      {closest.length > 0 && (
        <div className="bd-next">
          <p className="bd-next-h">{t.closest}</p>
          {closest.map((p) => {
            const [nm, desc] = named(p), sys = BADGE_SYS[p.slug];
            return (
              <div key={p.slug} className="bd-next-row">
                <Medal icon={sys?.[0] ?? p.row?.icon ?? "medal"} color={sys?.[1] ?? p.row?.color ?? "green"} className="bd-next-ic" />
                <span className="bd-next-t">
                  <strong>{nm}</strong>{desc && <small>{desc}</small>}
                  <span className="bd-next-bar" role="progressbar" aria-label={nm} aria-valuemin={0} aria-valuemax={p.of} aria-valuenow={p.n}>
                    <i style={{ width: `${Math.round((p.n / p.of) * 100)}%` }} />
                  </span>
                </span>
                <bdi className="bd-next-n">{p.n}/{p.of}</bdi>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
