import { intlOf } from "@/i18n/locales";
import { hoursText, volunteerWords } from "./Volunteer.words";

export type VolunteerMe = {
  hours?: number;
  status?: string | null;
  promote?: boolean;
  open_count?: number;
  record?: { id: number; hours: number; on: string; title?: string | null }[];
};

/** Whether the card has anything to say (the booking app's _accVolHtml): hours, a volunteer record, or staff asking to show the portal while something is open. */
export function volunteerCardShows(v: VolunteerMe | null | undefined): v is VolunteerMe {
  return !!v && ((Number(v.hours) || 0) > 0 || !!v.status || (!!v.promote && (Number(v.open_count) || 0) > 0));
}

// A record's day as the booking app's shortDate: "5 Nov 2026".
function recDate(iso: string, locale: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

// Volunteering on My Account, as the booking app's: the account's hours and the way to the volunteer portal, handed over
// signed in (/api/account/volunteer-portal).
export default function VolunteerCard({ me, locale }: { me: VolunteerMe; locale: string }) {
  const t = volunteerWords(locale), hours = Number(me.hours) || 0, rec = (me.record ?? []).slice(0, 5);
  return (
    <section className="ac-sec ac-wal" aria-labelledby="ac-vol-h">
      <h2 id="ac-vol-h">{t.title}</h2>
      <p className="ac-text">{hours > 0 ? <strong>{t.hours.replace("{0}", String(hours))}</strong> : t.join}</p>
      {/* Not a <Link>: it leaves this site, through a route that makes the one-time code. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="ac-go ac-vol-go" href="/api/account/volunteer-portal" rel="nofollow">{t.open}</a>
      {rec.length > 0 && (
        <>
          <p className="ac-text">{t.recent}</p>
          <ul className="ac-wal-rows">
            {/* The event, its day, then the hours with their word ("Micromobility Blood Donation · 5 Nov 2026 · 6 hours"), as
                the booking app's _accVolRecLi: a bare number first read as anything but hours (the owner, 2026-11-09). */}
            {rec.map((x) => <li key={x.id}><span>{x.title ? <><bdi>{x.title}</bdi> · </> : null}{recDate(x.on, locale)}</span><strong>{hoursText(x.hours, locale)}</strong></li>)}
          </ul>
        </>
      )}
    </section>
  );
}
