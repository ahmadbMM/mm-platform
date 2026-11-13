import "./helper-path.css";
import Medal from "./Medal";
import { TickIcon } from "@/components/site/Icons";
import { fill } from "@/i18n/tx";
import { HP_LADDER, HP_STEPS, type HelperPath as Path } from "@/lib/helper-path";
import { helperWords } from "./HelperPath.words";

// The Helper path card on My Account > Badges, under the badges (the booking app's helper-path.js _hpCardHtml, new
// features build F23, 2026-11-13; lib/helper-path.ts): the four steps, those passed ticked and the member's own marked,
// what the next step is called, the helper days and the helper-day ladder at 1, 5, 10 and 25 days as badge tiles. All of
// it is the member's own (customer_helper_path): nothing about another member is read or drawn.
export default function HelperPath({ locale, path }: { locale: string; path: Path }) {
  const w = helperWords(locale), { step, days } = path;
  return (
    <div className="myr hp-mine">
      <p className="myr-h">{w.title}</p>
      <ol className="hp-steps">
        {HP_STEPS.map((k, i) => (
          <li key={k} className={`hp-step${i < step ? " done" : i === step ? " on" : ""}`} aria-current={i === step ? "step" : undefined}>
            <i aria-hidden="true">{i < step && <TickIcon size={14} />}</i>
            <span>{w[k]}</span>
          </li>
        ))}
      </ol>
      {step < HP_STEPS.length - 1 && <p className="hp-next">{fill(w.next, w[HP_STEPS[step + 1]])}</p>}
      <p className="hp-days"><span className="hp-days-n">{days}</span><span className="hp-days-w">{w.days}</span></p>
      <ul className="mr-badges hp-badges">
        {HP_LADDER.map(([n, k, color]) => (
          <li key={k} className={`mr-badge${days >= n ? "" : " locked"}`}>
            {days < n && <span className="mr-badge-p"><bdi>{days}/{n}</bdi></span>}
            <Medal icon="hand" color={color} />
            <span className="mr-badge-nm">{w[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The helper days line on Stats, under Rides led (the booking app's #hp-line): its people glyph, as the flag beside
 *  Rides led. RideRecord draws it with the line's words already filled. */
export function helperLine(locale: string, path: Path | null): string | null {
  return path && path.days > 0 ? fill(helperWords(locale).line, path.days) : null;
}
