import { Link } from "@/i18n/navigation";
import { isRtl } from "@/i18n/locales";
import "./teaser.css";

// The question "Never learned to ride?" and the way to the lessons sign-up (/experiences/learn), on
// Home (before "Experiences & business") and on Experiences (after the booking steps). Its words are
// the Experiences page's, Learn to ride section; the page showing it decides whether it shows - the
// section's switch, and on Home the Experiences page being open, since the sign-up lives under it.
export type LearnTeaserText = { eyebrow: string; title: string; text: string; button: string };

/** The question's words from the Learn to ride section, or null while the lessons are switched off. */
export function learnTeaser(l: { on: boolean; teaserEyebrow: string; teaserTitle: string; teaserText: string; teaserBtn: string }): LearnTeaserText | null {
  if (!l.on || !l.teaserTitle || !l.teaserBtn) return null;
  return { eyebrow: l.teaserEyebrow, title: l.teaserTitle, text: l.teaserText, button: l.teaserBtn };
}

export default function LearnTeaser({ locale, t, place }: { locale: string; t: LearnTeaserText; place: "home" | "experiences" }) {
  const h = `ln-tz-${place}-h`;
  return (
    <section className={`ln-tz ln-tz-${place}`} aria-labelledby={h}>
      <div className="ln-tz-copy">
        {t.eyebrow && <p className="ln-tz-eyebrow">{t.eyebrow}</p>}
        <h2 id={h}>{t.title}</h2>
        {t.text && <p className="ln-tz-text">{t.text}</p>}
      </div>
      <Link className="ln-tz-btn" href="/experiences/learn">{t.button} <span aria-hidden="true">{isRtl(locale) ? "←" : "→"}</span></Link>
    </section>
  );
}
