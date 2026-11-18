import { intlOf } from "@/i18n/locales";
import { fill } from "@/i18n/tx";
import { ArrowIcon, TickIcon } from "@/components/site/Icons";
import type { BupPlan, BupRow } from "@/lib/buildup-plan";
import { memberHubWords } from "./MemberHub.words";

// The Build-up plan in a member's area on /club (lib/buildup-plan.ts; the booking app's _bupHtml and its .hub-bup card,
// 2026-11-18): under "Build-up plan" beside a flag, the event's name as its ticket names it, its date, how many Saturdays
// are left, then one row per Saturday: its day and what it says at the row's end (Done with a tick, Booked, On the
// waitlist, Book, Fully booked, Cancelled or Not open yet; a day gone and not ridden, or one whose rides are all for the
// other gender, is the date alone, dimmed). Book opens
// the booking app on that ride (`bookAt`). `name`: the event's name in the page's language.
type Props = { locale: string; plan: BupPlan; name: string; bookAt: (id: string) => string };

const Flag = () => (
  <svg className="mm-ic" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M5 21V3.5M5 4.5h12.5l-2.6 4 2.6 4H5" />
  </svg>
);

export default function BuildupPlan({ locale, plan, name, bookAt }: Props) {
  const w = memberHubWords(locale);
  const intl = locale === "en" ? "en-GB" : intlOf(locale);
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => {
    try { return new Intl.DateTimeFormat(intl, { ...o, timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)); } catch { return d; }
  };
  const end = (r: BupRow) => {
    switch (r.state) {
      case "done": return <span className="club-bup-s"><TickIcon size={14} />{w.bupDone}</span>;
      case "past": case "none": return null;
      case "held": return <span className="club-bup-s">{w.bupBooked}</span>;
      case "wl": return <span className="club-bup-s">{w.bupWl}</span>;
      case "book": return r.book ? <a className="club-bup-go" href={bookAt(r.book)}>{w.bupBook} <ArrowIcon size={15} /></a> : null;
      case "full": return <span className="club-bup-s">{w.bupFull}</span>;
      case "cancel": return <span className="club-bup-s">{w.bupCancel}</span>;
      default: return <span className="club-bup-s">{w.bupSoon}</span>;
    }
  };
  return (
    <section className="club-bup" aria-labelledby="club-bup-h">
      <h3 id="club-bup-h"><Flag /> {w.bup}</h3>
      <p className="club-bup-ev"><strong><bdi>{name}</bdi></strong><span><bdi>{fmt(plan.ev.date, { day: "numeric", month: "short", year: "numeric" })}</bdi></span></p>
      <p className="club-bup-n">{plan.togo === 1 ? w.bupOne : fill(w.bupN, String(plan.togo))}</p>
      {plan.rows.length > 0 && (
        <ul className="club-bup-l" aria-label={w.bupSats}>
          {plan.rows.map((r) => (
            <li key={r.date} className={r.state === "done" || r.state === "past" || r.state === "held" || r.state === "none" ? r.state : undefined} data-state={r.state}>
              <span className="club-bup-d"><bdi>{fmt(r.date, { day: "numeric", month: "short" })}</bdi></span>
              {end(r)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
