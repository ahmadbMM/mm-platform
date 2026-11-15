import { serverLocalize } from "@/i18n/dicts";
import { reviewSummary, type StoreReview } from "@/lib/store-core";
import { avgText, monthLabel, starsOf } from "@/lib/store-sections";
import { StIcon } from "../icons";
import { T } from "../w3b.text";

// Verified buyers' reviews (F42), drawn once the product has any staff chose to show: each with its drawn stars, what
// the buyer wrote (in the language they wrote it) and "Verified buyer · Bought Nov 2026" - no name, no account. The star
// average only from five reviews on (reviewSummary); never a placeholder or an invented rating. Six show; the rest
// open below them.
const SHOWN = 6;

function Stars({ n, label }: { n: number; label: string }) {
  return (
    <span className="st-pd-stars" role="img" aria-label={label}>
      {starsOf(n).map((on, i) => <StIcon key={i} name="star" size={16} filled={on} className={on ? "on" : undefined} />)}
    </span>
  );
}

export default function ReviewList({ reviews, locale }: { reviews: readonly StoreReview[]; locale: string }) {
  if (!reviews.length) return null;
  const w = serverLocalize(T, locale);
  const sum = reviewSummary(reviews);
  const one = (r: StoreReview) => (
    <li key={r.id}>
      <Stars n={r.rating} label={w.outOf5(String(r.rating))} />
      {r.body && <p lang={r.lang ?? undefined} dir="auto">{r.body}</p>}
      <small><StIcon name="badge" size={16} />{w.verified} · {w.bought(monthLabel(r.bought, locale))}</small>
    </li>
  );
  return (
    <section className="st-pd-sec" aria-labelledby="st-pd-rev-h">
      <h2 id="st-pd-rev-h">{w.reviewsH}</h2>
      <p className="st-pd-rev-sum">
        {sum.avg !== null && <><Stars n={sum.avg} label={w.outOf5(avgText(sum.avg))} /><b>{avgText(sum.avg)}</b></>}
        <span>{sum.count === 1 ? w.review1 : w.reviewsN(sum.count)}</span>
      </p>
      <ul className="st-pd-revs">{reviews.slice(0, SHOWN).map(one)}</ul>
      {reviews.length > SHOWN && (
        <details className="st-pd-more">
          <summary>{w.allReviews(sum.count)}<StIcon name="chevronDown" size={18} className="st-pd-chev" /></summary>
          <ul className="st-pd-revs">{reviews.slice(SHOWN).map(one)}</ul>
        </details>
      )}
    </section>
  );
}
