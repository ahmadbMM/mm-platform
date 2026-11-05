import { fmtDayDate } from "@/lib/tickets";
import { volunteerWords } from "./Volunteer.words";

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
            {rec.map((x) => <li key={x.id}><span>{fmtDayDate(x.on, locale)}{x.title ? ` · ${x.title}` : ""}</span><strong><bdi>{x.hours}</bdi></strong></li>)}
          </ul>
        </>
      )}
    </section>
  );
}
