import type { ReactNode } from "react";
import type { RideKind } from "@/lib/rides";
import type { RideMore as More } from "@/lib/ride-record";
import { intlOf } from "@/i18n/locales";
import { ArrowIcon } from "@/components/site/Icons";

// Stats' more of the record (the booking app's _myrMore, the owner, 2026-11-09: "add more stats"): rides by month
// as twelve thin columns on one baseline, this month last, the value on the highest one's cap (the latest of a tie),
// every third month named under the axis and each column's month and count said to a screen reader and as its
// tooltip; rides by bike; sessions by event; then the badges earned, which opens Badges. Each list shows only what
// was ridden; the chart, only when one of its months was. `tried` (the kinds tried, Landmarks.tsx; new features build F16)
// sits under By event, above Badges earned.
type Props = {
  locale: string; more: More;
  t: { months: string; byBike: string; byEvent: string; badgesEarned: string; rides: (n: string) => string };
  typeName: (type: string) => string; kindName: (kind: RideKind) => string;
  earned: { n: number; of: number; href: string } | null;
  tried?: ReactNode;
};

export default function RideMore({ locale, more, t, typeName, kindName, earned, tried = null }: Props) {
  const intl = locale === "en" ? "en-GB" : intlOf(locale);
  const month = (ym: string, o: Intl.DateTimeFormatOptions) => {
    try { return new Intl.DateTimeFormat(intl, { ...o, timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`)); }
    catch { return ym; }
  };
  const V = more.months.map((x) => x.n), mx = Math.max(0, ...V), top = V.lastIndexOf(mx);
  const list = (h: string, rows: [string, number][]) => rows.length > 0 && (
    <div className="myr myr-c">
      <p className="myr-h">{h}</p>
      <dl className="myr-l">{rows.map(([k, n], i) => <div key={i}><dt>{k}</dt><dd>{n}</dd></div>)}</dl>
    </div>
  );
  return (
    <>
      {mx > 0 && (
        <div className="myr myr-mo">
          <p className="myr-h">{t.months}</p>
          <ol className="myr-mo-c">
            {more.months.map((x, i) => {
              const w = `${month(x.ym, { month: "long", year: "numeric" })} · ${t.rides(String(x.n))}`;
              return (
                <li key={x.ym} title={w}>
                  <span className="myr-sr">{w}</span>
                  <span className="myr-mo-a" aria-hidden="true">
                    {i === top && <span className="myr-mo-v">{x.n}</span>}
                    {x.n > 0 && <span className="myr-mo-b" style={{ height: `${Math.round((x.n / mx) * 80)}%` }} />}
                  </span>
                  <span className="myr-mo-l" aria-hidden="true">{(11 - i) % 3 ? "" : month(x.ym, { month: "short" })}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {list(t.byBike, more.byType.map(([k, n]) => [typeName(k), n]))}
      {list(t.byEvent, more.byKind.map(([k, n]) => [kindName(k), n]))}
      {tried}
      {earned && earned.of > 0 && (
        <a className="myr myr-bd" href={earned.href}>
          <span className="myr-bd-t">{t.badgesEarned}</span>
          <bdi className="myr-bd-n">{earned.n}/{earned.of}</bdi>
          <ArrowIcon size={15} />
        </a>
      )}
    </>
  );
}
