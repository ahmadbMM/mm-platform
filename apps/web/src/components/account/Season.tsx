import type { AccountText } from "./Account.text";
import { daysUntil, tierOf } from "@/lib/account-profile";
import { fmtDayDate } from "@/lib/tickets";

// The season at the top of My Account, in a few lines as the booking app's _seasonDashboard draws
// it: the completed rides and the tier they reach (Newcomer 0, Regular 3, Pro 10, Elite 25, Legend
// 50) with what the next tier takes and a bar, the week streak (two weeks or more, a drawn chain),
// and the next ride - or a button to book one. Then the profile meter (_profPct).
type Props = {
  locale: string; t: AccountText; rides: number; streak: number;
  next: { date: string; today: string; href: string } | null; book: string; pct: number;
};

export default function Season({ locale, t, rides, streak, next, book, pct }: Props) {
  const tier = tierOf(rides);
  const name = t.tiers[tier.key];
  const nd = next ? daysUntil(next.date, next.today) : 0;
  const when = nd === 0 ? t.today : nd === 1 ? t.tomorrow : t.inDays(String(nd));
  return (
    <section className="ac-panel ac-season" aria-label={t.seasonTitle}>
      <div className="ac-season-n"><strong>{rides}</strong><span>{rides === 1 ? t.rideOne : t.rideMany}</span></div>
      <div className="ac-season-tier">
        <p><strong>{name}</strong>{tier.next ? ` · ${tier.next.need === 1 ? t.toNextOne(t.tiers[tier.next.key]) : t.toNext(String(tier.next.need), t.tiers[tier.next.key])}` : ` · ${t.topTier}`}</p>
        <span className="ac-bar" role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={tier.pct}><i style={{ width: `${tier.pct}%` }} /></span>
      </div>
      {streak >= 2 && (
        <p className="ac-season-line">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.6" y="8.4" width="10.2" height="7.2" rx="3.6" /><rect x="11.2" y="8.4" width="10.2" height="7.2" rx="3.6" /></svg>
          {t.streak(String(streak))}
        </p>
      )}
      {next ? (
        <a className="ac-season-next" href={next.href}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.6 7.6A1.6 1.6 0 0 1 5.2 6h13.6a1.6 1.6 0 0 1 1.6 1.6V10a2 2 0 0 0 0 4v2.4a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V14a2 2 0 0 0 0-4z" /><path d="M14.4 6.6v1.6M14.4 11.2v1.6M14.4 15.8v1.6" /></svg>
          <span>{t.nextRide(fmtDayDate(next.date, locale), when)}</span>
        </a>
      ) : (
        <a className="ac-btn ac-season-book" href={book}>{t.bookNext}</a>
      )}
      <div className="ac-meter">
        <p>{t.profilePct(String(pct))}</p>
        <span className="ac-bar" role="progressbar" aria-label={t.profilePct(String(pct))} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></span>
      </div>
    </section>
  );
}
