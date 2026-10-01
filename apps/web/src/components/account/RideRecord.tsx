import BadgeGrid, { type BadgeView } from "./BadgeGrid";
import Medal from "./Medal";
import type { T } from "./RideRecord.text";
import { fill } from "@/lib/fill";
import { fill as fillAt } from "@/i18n/tx";
import { closestBadges, type BadgeItem, type RideStats } from "@/lib/ride-record";
import { intlOf } from "@/i18n/locales";

// My Account's record, as the booking app's account page draws it (91816da and the badges before
// it): Your rides - the last 26 weeks as a strip, rides this year, the favourite bike type, the
// time on the bike staff timed, the first ride - then the two badges already begun with the least
// left, each with its bar, then every badge (BadgeGrid).
export type RecordText = (typeof T)["en"];
type Props = {
  locale: string; stats: RideStats | null; badges: BadgeItem[]; t: RecordText;
  typeName: (type: string) => string; dur: { h: string; hm: string; m: string };
};

export default function RideRecord({ locale, stats, badges, t, typeName, dur }: Props) {
  const day = (iso: string | null | undefined) => {
    const d = iso ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    try { return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(d); }
    catch { return ""; }
  };
  const time = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? fill(dur.hm, { h, m }) : fill(dur.h, { h })) : fill(dur.m, { m }); };
  const facts: [string, string][] = stats ? [
    [t.year, String(stats.year)],
    ...(stats.fav ? [[t.fav, typeName(stats.fav)] as [string, string]] : []),
    ...(stats.minutes >= 1 ? [[t.time, time(stats.minutes)] as [string, string]] : []),
    ...(stats.first ? [[t.first, day(stats.first)] as [string, string]] : []),
  ] : [];
  // A badge in the reader's words: the app's own from its texts, one an admin made from its English or Arabic.
  const words = (x: BadgeItem): [string, string, string] => {
    const own = t.names[x.slug];
    if (own && (!x.row || x.row.system !== false)) return own;
    const ar = locale === "ar", r = x.row;
    return [String((ar && r?.name_ar) || r?.name || x.slug), String((ar && r?.description_ar) || r?.description || ""), ""];
  };
  const views: BadgeView[] = badges.map((x) => {
    const [name, how, about] = words(x);
    return {
      slug: x.slug, icon: x.icon, color: x.color, on: x.on, name, how, about, prog: x.p,
      given: x.given ? { line: fillAt(t.givenBy, day(x.given.at)), note: x.given.note || null } : null,
      season: x.season?.curTo ? fillAt(t.seasonOpen, day(x.season.curTo)) : x.season?.next ? fillAt(t.seasonSoon, day(x.season.next)) : null,
    };
  });
  const near = closestBadges(badges);
  if (!stats && !badges.length) return null;
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
      {near.length > 0 && (
        <div className="bd-next">
          <p className="bd-next-h">{t.closest}</p>
          {near.map(({ item, n, of }) => {
            const [nm, how] = words(item);
            return (
              <div key={item.slug} className="bd-next-row">
                <Medal icon={item.icon} color={item.color} className="bd-next-ic" />
                <span className="bd-next-t">
                  <strong>{nm}</strong>{how && <small>{how}</small>}
                  <span className="bd-next-bar" role="progressbar" aria-label={nm} aria-valuemin={0} aria-valuemax={of} aria-valuenow={n}>
                    <i style={{ width: `${Math.round((n / of) * 100)}%` }} />
                  </span>
                </span>
                <bdi className="bd-next-n">{n}/{of}</bdi>
              </div>
            );
          })}
        </div>
      )}
      {views.length > 0 && <BadgeGrid items={views} t={{ badges: t.badges, toEarn: t.toEarn, show: t.show, hide: t.hide, notEarned: t.notEarned, howTo: t.howTo, earned: t.earned, close: t.close }} />}
    </>
  );
}
