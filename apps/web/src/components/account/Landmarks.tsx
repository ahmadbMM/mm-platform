import "./landmarks.css";
import type { RideKind } from "@/lib/rides";
import { intlOf } from "@/i18n/locales";
import { TickIcon } from "@/components/site/Icons";
import { annivTitle, landmarkWords } from "./Landmarks.words";

// The personal landmarks on My Account > Stats (the booking app's _lmAnnivHtml and _lmKindsHtml, new features build F16,
// 2026-11-13; lib/landmarks.ts): both private, drawn from the rider's own bookings, nothing sent as a message.

/** The first ride's anniversary card, which leads Stats for its week: the years, the first ride's date (`firstLabel` is
 *  Your rides' own "First ride"), the team's line (`line`, the admins' own; null: the built-in one) and the team's name. */
export function Anniversary({ locale, years, first, firstLabel, line }: { locale: string; years: number; first: string; firstLabel: string; line: string | null }) {
  const w = landmarkWords(locale);
  let day = "";
  try { day = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(`${first}T12:00:00Z`)); }
  catch { day = first; }
  return (
    <div className="myr lm-anniv" id="lm-anniv">
      <p className="lm-anniv-t">{annivTitle(locale, years)}</p>
      <p className="lm-anniv-d">{firstLabel} · <bdi>{day}</bdi></p>
      <p className="lm-anniv-l">{line ?? w.line}</p>
      <p className="lm-anniv-s">{w.sign}</p>
    </div>
  );
}

/** The kinds tried, under By event: each kind by By event's own name (`name`: a session without a bike is never called a
 *  ride), ticked once one was completed, its state said to a screen reader. Fewer than two kinds: nothing. */
export function TriedKinds({ locale, kinds, name }: { locale: string; kinds: { kind: RideKind; done: boolean }[]; name: (kind: RideKind) => string }) {
  if (kinds.length < 2) return null;
  const w = landmarkWords(locale);
  return (
    <div className="myr myr-c lm-kinds">
      <p className="myr-h lm-kinds-h"><span>{w.kinds}</span><bdi>{kinds.filter((k) => k.done).length}/{kinds.length}</bdi></p>
      <ul>
        {kinds.map((k) => (
          <li key={k.kind} className={k.done ? "on" : undefined}>
            {k.done ? <TickIcon size={16} /> : <i aria-hidden="true" />}
            <span>{name(k.kind)}</span>
            <span className="myr-sr">{k.done ? w.done : w.notYet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
