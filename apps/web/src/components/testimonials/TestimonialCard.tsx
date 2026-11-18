import { sinceText, tmName, tmPhotoSrc, type TmCard } from "@/lib/testimonials";
import type { TmWords } from "./Testimonials.text";
import Stars from "./Stars";

// One published testimonial on micromobility.sa/testimonials: its stars, the words as the rider wrote them (their own
// direction, dir="auto"; React escapes them), the name they chose or "A MicroMobility rider", their "since" line when
// named, the photo when there is one (from the site's own address, app/api/testimonials/photo) and what it is about.
export default function TestimonialCard({ c, w }: { c: TmCard; w: TmWords }) {
  const name = tmName(c, w.anon);
  const since = sinceText(c.since, w);
  return (
    <figure className="tm-card">
      {c.photo && <img className="tm-photo" src={tmPhotoSrc(c.id)} alt={w.photoOf(name)} loading="lazy" decoding="async" />}
      {c.stars !== null && <Stars value={c.stars} label={w.starsOf(String(c.stars))} />}
      <blockquote dir="auto">{c.body}</blockquote>
      <figcaption>
        <span className="tm-who">
          <bdi className="tm-name" dir={c.name ? "auto" : undefined}>{name}</bdi>
          {since && <span className="tm-since">{since}</span>}
        </span>
        <span className="tm-about">{w.about[c.about]}</span>
      </figcaption>
    </figure>
  );
}
