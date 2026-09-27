import { serverLocalize } from "@/i18n/dicts";
import { intlOf, isRtl } from "@/i18n/locales";
import type { Locale } from "@/lib/content";
import { fmtNum } from "@/lib/fill";
import { localHref } from "@/lib/links";
import { announcementsOf, isBirthday, type MemberArea } from "@/lib/members";
import { T } from "./MembersArea.text";

// The members' area on /club, for a signed-in community member (member_area, lib/members.ts):
// their card - name, since when, credits, tier and what is left to the next - their attendance
// and last five rides, the upcoming members' rides (each booked in the booking app on that ride,
// the ones already booked marked), a birthday greeting on the day, and the site's announcements.
// Nothing here names another member.
type Props = {
  locale: string;
  L: Locale;
  area: Extract<MemberArea, { member: true }>;
  tierNames: [string, string, string];
  /** What to call a ride: its title, else its kind's name in the page's language. */
  nameOf: (kind: string | null, title: string) => string;
  /** The booking app opened on a members' ride. */
  bookAt: (id: string, kind: string | null) => string;
  /** Today in Riyadh, "YYYY-MM-DD". */
  today: string;
  /** The staff text for no upcoming ride (Club > Upcoming club rides). */
  empty: string;
  /** Whether each upcoming ride may be booked yet (the booking window): null when it may, else the
   *  words for when it opens. */
  opens?: (date: string) => string | null;
};

export default function MembersArea({ locale, L, area: a, tierNames, nameOf, bookAt, today, empty, opens }: Props) {
  const t = serverLocalize(T, locale);
  const N = (n: number) => fmtNum(n, locale);
  const arrow = isRtl(locale) ? "←" : "→";
  const day = (d: string, o: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) => new Intl.DateTimeFormat(intlOf(locale), { ...o, timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const since = a.since ? new Intl.DateTimeFormat(intlOf(locale), { month: "long", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(a.since)) : "";
  const pct = a.tier >= 2 || !a.next ? 100 : Math.min(100, Math.round((a.credits / a.next) * 100));
  const anns = announcementsOf(a.announcements, L);
  const when = (time: string | null) => {
    const m = /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec(time || "");
    return m ? <bdi dir="ltr">{m[1]} – {m[2]}</bdi> : time ? <bdi dir="ltr">{time}</bdi> : null;
  };
  return (
    <div className="club-mine club-members">
      <h2>{t.title}</h2>
      {isBirthday(a.birthDate, today) && (
        <p className="club-bday" role="status"><strong>{t.birthday(a.firstName)}</strong><span>{t.birthdayText}</span></p>
      )}
      <div className={`club-cardviz tier-${a.tier}`}>
        <div className="club-cardviz-top">
          <span className="club-cardviz-brand"><img src={a.tier === 2 ? "/site/logo-mark-dark.png" : "/site/logo-mark.png"} alt="Micromobility" /><span>{t.label}</span></span>
          <span className="club-pill">{tierNames[a.tier]}</span>
        </div>
        <div className="club-cardviz-bottom">
          <span className="club-cardviz-label">{t.credits}</span>
          <strong className="club-cardviz-num">{N(a.credits)}</strong>
          <div className="club-cardviz-foot"><strong>{a.firstName}</strong>{since && <span>{t.since} {since}</span>}</div>
        </div>
      </div>
      <span className="club-bar"><span style={{ width: `${pct}%` }} /></span>
      <p className="club-mine-next">{a.tier >= 2 || !a.next ? t.top : t.toNext(N(Math.max(0, a.next - a.credits)), tierNames[a.tier + 1])}</p>

      <section className="club-att" aria-labelledby="club-att-h">
        <h3 id="club-att-h">{t.attendance}</h3>
        <div className="club-att-nums"><span>{t.rides(N(a.rides))}</span><span>{t.groupRides(N(a.groupRides))}</span></div>
        <p className="club-att-sub">{t.last}</p>
        {a.last.length ? (
          <ul className="club-last">
            {a.last.map((r, i) => (
              <li key={i}><span>{day(r.date, { day: "numeric", month: "short", year: "numeric" })}</span><strong>{nameOf(r.kind, r.title)}</strong>{r.rated ? <em>{t.rated}</em> : <a href={localHref("/account", locale)}>{t.rate} {arrow}</a>}</li>
            ))}
          </ul>
        ) : <p className="club-att-empty">{t.noLast}</p>}
      </section>

      <section className="club-up" aria-labelledby="club-up-h">
        <h3 id="club-up-h">{t.upcoming}</h3>
        {a.upcoming.length ? (
          <ul>
            {a.upcoming.map((r) => {
              const closed = opens ? opens(r.date) : null;
              return (
                <li key={r.id} className={closed ? "closed" : ""}>
                  <span className="club-up-when">{day(r.date)}{r.time ? <> · {when(r.time)}</> : null}</span>
                  <strong>{nameOf(r.kind, r.title)}</strong>
                  {r.booked ? <em>{t.booked}</em> : closed ? <small>{closed}</small> : <a href={bookAt(r.id, r.kind)}>{t.book} {arrow}</a>}
                </li>
              );
            })}
          </ul>
        ) : <p className="club-att-empty">{empty}</p>}
      </section>

      {anns.length > 0 && (
        <section className="club-ann" aria-labelledby="club-ann-h">
          <h3 id="club-ann-h">{t.announcements}</h3>
          <ul>{anns.map((x, i) => <li key={i}>{x.text}{x.cta && x.href ? <> <a href={localHref(x.href, locale)}>{x.cta} {arrow}</a></> : null}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
