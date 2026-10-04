import { Link } from "@/i18n/navigation";
import { isRtl } from "@/i18n/locales";
import "./teaser.css";

// The question "Never learned to ride?" and the way to the lessons sign-up (/experiences/learn), on
// Home (before "Experiences & business") and on Experiences (after the booking steps). Its words are
// the Experiences page's, Learn to ride section; the page showing it decides whether it shows - the
// section's switch, and on Home the Experiences page being open, since the sign-up lives under it.
// While staff are not taking sign-ups ("Taking sign-ups" off), the question stays and says so: its
// text is the closed text, and it has no button.
export type LearnTeaserText = { eyebrow: string; title: string; text: string; button: string; closed: boolean };

/** The question's words from the Learn to ride section, or null while the lessons are switched off. */
export function learnTeaser(l: { on: boolean; taking: boolean; teaserEyebrow: string; teaserTitle: string; teaserText: string; teaserBtn: string; closedText: string }): LearnTeaserText | null {
  if (!l.on || !l.teaserTitle) return null;
  if (!l.taking) return { eyebrow: l.teaserEyebrow, title: l.teaserTitle, text: l.closedText, button: "", closed: true };
  if (!l.teaserBtn) return null;
  return { eyebrow: l.teaserEyebrow, title: l.teaserTitle, text: l.teaserText, button: l.teaserBtn, closed: false };
}

export default function LearnTeaser({ locale, t, place }: { locale: string; t: LearnTeaserText; place: "home" | "experiences" }) {
  const h = `ln-tz-${place}-h`;
  return (
    <section className={`ln-tz ln-tz-${place}${t.closed ? " ln-tz-closed" : ""}`} aria-labelledby={h}>
      <div className="ln-tz-copy">
        {t.eyebrow && <p className="ln-tz-eyebrow">{t.eyebrow}</p>}
        <h2 id={h}>{t.title}</h2>
        {t.text && <p className="ln-tz-text">{t.text}</p>}
      </div>
      {!t.closed && <Link className="ln-tz-btn" href="/experiences/learn">{t.button} <span aria-hidden="true">{isRtl(locale) ? "←" : "→"}</span></Link>}
    </section>
  );
}
