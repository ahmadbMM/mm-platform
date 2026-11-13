import BadgeGrid, { type BadgeView } from "./BadgeGrid";
import { askChoices, askTarget, canAsk, type AskChoice, type BadgeReq } from "@/lib/badge-request";
import Medal from "./Medal";
import type { T } from "./RideRecord.text";
import { fill } from "@/lib/fill";
import { fill as fillAt } from "@/i18n/tx";
import { closestBadges, ladderLevel, type BadgeItem, type RideStats } from "@/lib/ride-record";
import { intlOf } from "@/i18n/locales";

// My Account's record, as the booking app's account page draws it (91816da and the badges before
// it): Your rides - the last 26 weeks as a strip, rides this year, the favourite bike type, the
// time on the bike staff timed, the first ride - then the two badges already begun with the least
// left, each with its bar (a ladder's next level among them), then every badge (BadgeGrid). Rides led
// (2026-11-06, the app's season line with its flag) closes Your rides, shown once there is one. With the
// account's badge requests (reqs; null when the database has none) the grid offers to ask for a badge staff give.
// The account page's parts (2026-11-09, the booking app's Stats and Badges): `part` "stats" draws Your rides alone,
// "badges" the closest badges and the grid; without it, both.
// With `share` (the Badges part; the booking app's Share, new features build F12, 2026-11-13) an earned badge's popup
// offers its picture, dated the day staff or the database gave it, else the day the rider's rides reached it (`rode`,
// lib/share-days.ts), else not dated.
// With `helper` (a community member's helper days, the booking app's Helper path line, new features build F23, 2026-11-13;
// HelperPath.tsx helperLine) Your rides says them under Rides led, its people glyph beside them.
export type RecordText = (typeof T)["en"];
type Props = {
  locale: string; stats: RideStats | null; led: number; badges: BadgeItem[]; t: RecordText;
  typeName: (type: string) => string; dur: { h: string; hm: string; m: string };
  reqs?: BadgeReq[] | null;
  part?: "stats" | "badges";
  share?: { first: string; rode: Record<string, string> } | null;
  helper?: string | null;
};

export default function RideRecord({ locale, stats, led, badges, t, typeName, dur, reqs = null, part, share = null, helper = null }: Props) {
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
      levels: x.lv ? x.lv.map((y) => { const [nm, hw] = words(y); return { slug: y.slug, icon: y.icon, color: y.color, on: y.on, name: nm, how: hw, prog: y.p }; }) : null,
      lvN: x.lvN,
      given: x.given ? { line: fillAt(t.givenBy, day(x.given.at)), note: x.given.note || null } : null,
      season: x.season?.curTo ? fillAt(t.seasonOpen, day(x.season.curTo)) : x.season?.next ? fillAt(t.seasonSoon, day(x.season.next)) : null,
      ask: reqs ? askTarget(x)?.slug ?? null : null,
      askSlugs: reqs ? (x.lv ?? [x]).filter(canAsk).map((y) => y.slug) : [],
      ...(share && x.on ? { day: day(x.given ? x.given.at : share.rode[x.slug]) } : {}),
    };
  });
  const choices: AskChoice[] = reqs ? askChoices(badges).map((y) => { const [name, how] = words(y); return { slug: y.slug, name, how, icon: y.icon, color: y.color, level: ladderLevel(y.slug) }; }) : [];
  const near = closestBadges(badges);
  const mine = part !== "badges", grid = part !== "stats";
  if (!(mine && (stats || led || helper)) && !(grid && badges.length)) return null;
  return (
    <>
      {mine && (stats || led > 0 || helper) && (
        <div className="myr">
          <p className="myr-h">{t.yourRides}</p>
          {stats && (
            <>
              <div className="myr-weeks" role="img" aria-label={t.weeks(String(stats.nWeeks))}>
                {stats.weeks.map((on, i) => <i key={i} className={on ? "on" : undefined} />)}
              </div>
              <p className="myr-wl">{t.weeks(String(stats.nWeeks))}</p>
              <dl className="myr-f">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            </>
          )}
          {led > 0 && (
            <p className="myr-led">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V3.5M5 4.5h12.5l-2.6 4 2.6 4H5" /></svg>
              <span>{fillAt(t.led, String(led))}</span>
            </p>
          )}
          {helper && (
            <p className="myr-led">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.6" r="3.1" /><path d="M3.4 19.4c.6-3.2 2.8-5 5.6-5s5 1.8 5.6 5M15.2 5.9a3 3 0 0 1 0 5.6M17.6 14.6c1.7.6 2.8 2.2 3.1 4.8" /></svg>
              <span>{helper}</span>
            </p>
          )}
        </div>
      )}
      {grid && near.length > 0 && (
        <div className="bd-next">
          <p className="bd-next-h">{t.closest}</p>
          {near.map(({ item, show, n, of }) => {
            const [nm, how] = words(show);
            return (
              <div key={item.slug} className="bd-next-row">
                <Medal icon={show.icon} color={show.color} className="bd-next-ic" />
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
      {grid && views.length > 0 && <BadgeGrid items={views} t={{ badges: t.badges, toEarn: t.toEarn, show: t.show, hide: t.hide, notEarned: t.notEarned, howTo: t.howTo, earned: t.earned, close: t.close, levelOf: t.levelOf, maxLevel: t.maxLevel, levels: t.levels }}
        ask={reqs ? { reqs, choices, locale } : null} share={share ? { locale, first: share.first } : null} />}
    </>
  );
}
