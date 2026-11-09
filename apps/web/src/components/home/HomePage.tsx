import SiteNav from "@/components/site/SiteNav";
import SiteFooter, { type FooterContent } from "@/components/site/SiteFooter";
import { footerFrom, navFrom } from "@/components/site/PageShell";
import AnnouncementBar, { type Announcement } from "@/components/site/AnnouncementBar";
import PreviewBar from "@/components/site/PreviewBar";
import BuildStory, { type Step } from "@/components/home/BuildStory";
import PhotoWall from "@/components/home/PhotoWall";
import FitQuiz, { type QuizText } from "@/components/home/FitQuiz";
import OpenNow from "@/components/home/OpenNow";
import LazyMap from "@/components/home/LazyMap";
import LazyBackgrounds from "@/components/site/LazyBackgrounds";
import { ArrowIcon, StarIcon } from "@/components/site/Icons";
import LearnTeaser, { type LearnTeaserText } from "@/components/learn/LearnTeaser";
import "@/components/site/site.css";
import "@/components/home/home.css";
import { bookingLink, localHref, pageOf } from "@/lib/links";
import { serverL } from "@/i18n/dicts";
import { localeInfo } from "@/i18n/locales";
import { bg, sized, srcSet } from "@/lib/img";

// Home, from Home.dc.html. Everything it says comes from the staff page (site_content), else
// the design's words. Sections whose content is still empty (reviews, the numbers strip, the
// Google rating) are left out rather than shown with invented examples.
type Sec = Record<string, unknown>;
/** The shade under the words on the two cards near the end (Ride with us / For business): dark
 *  enough under the title and text that a bright sky behind them stays readable. */
const SPLIT_SHADE = "linear-gradient(to top,rgba(0,0,0,.86),rgba(0,0,0,.62) 48%,rgba(0,0,0,.12) 78%),";
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);

/** `learn`: the Learn to ride question (Experiences > Learn to ride), or null while it is not offered. */
export default function HomePage({ locale, home, site, preview, hidden = [], learn = null, shop = false }: { locale: string; home: Record<string, Sec>; site: Record<string, Sec>; preview: boolean; hidden?: string[]; learn?: LearnTeaserText | null; shop?: boolean }) {
  const tx = serverL(locale);
  // A button to a page staff have switched off would only reload Home (the proxy sends it back
  // here): a ride page opens the booking app instead, and any other button is left out - it used to
  // open the WhatsApp chat, so "View the Gallery" opened a chat. "" = no button.
  const RIDE_PAGES = new Set(["experiences", "events", "club", "routes"]);
  const book0 = navFrom(site).booking; // the booking app as staff set it
  const H = (v: unknown) => {
    const href = S(v), pg = pageOf(href);
    if (!href) return "";
    if (!pg || !hidden.includes(pg)) return localHref(href, locale);
    return RIDE_PAGES.has(pg) ? bookingLink(book0, locale) : "";
  };
  const arrow = <ArrowIcon size={17} className="hm-arw" />;
  const e = home.entry, h = home.hero, f = home.feature, st = home.story, c = home.community, r = home.reviews, q = home.quiz, sp = home.split, v = home.visit;
  const contact = site.contact;
  const announcements: Announcement[] = list(site.announce.messages).map((m) => ({ text: S(m.text), cta: S(m.cta), href: S(m.href) }));
  const steps: Step[] = list(st.steps).map((s) => ({ title: S(s.title), text: S(s.text), image: S(s.image) })).filter((s) => s.title);
  const photos = list(c.photos).map((p) => S(p.image)).filter(Boolean);
  const stats = list(c.stats).map((s) => ({ value: S(s.value), label: S(s.label) })).filter((s) => s.value && s.label);
  const reviews = list(r.items).map((x) => ({ name: S(x.name), role: S(x.role), quote: S(x.quote) })).filter((x) => x.name && x.quote);
  const rating = N(v.rating);
  const recs = (k: "road" | "city" | "trail") => ({ name: S(q[`${k}Name`]), image: S(q[`${k}Image`]), price: N(q[`${k}Price`]),
    why: { speed: S(q[`${k}Speed`]), comfort: S(q[`${k}Comfort`]), value: S(q[`${k}Value`]) } });
  const quiz: QuizText = {
    title: S(q.title), text: S(q.text), q1: S(q.q1), q2: S(q.q2), match: S(q.match), cta: S(q.cta), ctaHref: S(q.ctaHref), retake: S(q.retake),
    rides: [{ id: "road", label: S(q.aRoad) }, { id: "city", label: S(q.aCity) }, { id: "trail", label: S(q.aTrail) }],
    prios: [{ id: "speed", label: S(q.pSpeed) }, { id: "comfort", label: S(q.pComfort) }, { id: "value", label: S(q.pValue) }],
    recs: { road: recs("road"), city: recs("city"), trail: recs("trail") },
  };
  const footer: FooterContent = footerFrom(site);
  // The top of the page: one wide photo, its words on a fixed dark shade (home.css .hm-top-shade), so
  // any photo staff choose stays readable. The photo is the page's largest element: a real <img> in
  // the HTML, asked for first, never lazy. In Arabic the words and the shade move to the right; the
  // photo itself is never mirrored.
  const topImg = S(e.image), bookHref = H(e.bookHref), bizHref = H(e.bizHref);
  const focus = (n: unknown, d: number) => Math.min(100, Math.max(0, typeof n === "number" ? n : d));
  const lazy = (url: string, shade = "") => `${shade}url('${url}')`;

  return (
    <div className="mm-site" dir={localeInfo(locale).dir}>
      <SiteNav locale={locale} hidden={hidden} {...navFrom(site)} shop={shop} />
      <LazyBackgrounds />
      <main id="mm-main" style={{ paddingTop: 52 }}>
        <section className="hm-top" aria-labelledby="hm-top-title">
          {topImg && (
            <img className="hm-top-img" src={sized(topImg, 1280)} srcSet={srcSet(topImg)} sizes="100vw" alt="" width={2000} height={1333}
              fetchPriority="high" style={{ objectPosition: `${focus(e.focusX, 50)}% ${focus(e.focusY, 62)}%` }} />
          )}
          <span className="hm-top-shade" aria-hidden="true" />
          <div className="hm-top-copy">
            <h1 id="hm-top-title">{S(e.title)}</h1>
            {S(e.text) && <p>{S(e.text)}</p>}
            <div className="hm-top-btns">
              {bookHref && S(e.bookBtn) && <a href={bookHref} className="hm-btn hm-neon">{S(e.bookBtn)} {arrow}</a>}
              {bizHref && S(e.bizBtn) && (
                <a href={bizHref} className="hm-btn hm-glass hm-top-biz">
                  <span>{S(e.bizBtn)}</span>
                  {S(e.bizLine) && <small>{S(e.bizLine)}</small>}
                </a>
              )}
            </div>
          </div>
        </section>

        <AnnouncementBar items={announcements} arrow={arrow} />

        {/* Hero */}
        <header className="hm-hero" id="start">
          <div className="hm-hero-meta">
            <span className="hm-coord">{tx("EST. JEDDAH", "تأسست في جدة")}</span>
            <span className="hm-hero-eyebrow">{S(h.eyebrow)}</span>
            <span className="hm-coord mm-lat">21°32′N · 39°10′E</span>
          </div>
          <h2 className="hm-hero-title">{S(h.title)}</h2>
          <p className="hm-hero-text">{S(h.text)}</p>
          <div className="hm-hero-bike">
            {/* A screen below the welcome, so fetched only as the visitor nears it: marked high
                priority, it used to download before the welcome photos that are actually on screen. */}
            <img src={S(h.image)} srcSet={srcSet(S(h.image))} sizes="(max-width: 1240px) 94vw, 1180px" alt={S(h.eyebrow)} width={1180} height={620} loading="lazy" decoding="async" />
          </div>
          <div className="hm-badges">
            {list(h.badges).map((b, i) => S(b.title) && (
              <div key={i}><strong>{S(b.title)}</strong><span>{S(b.sub)}</span></div>
            ))}
          </div>
          {/* The brands, still: the strip used to scroll for ever, which nobody could stop (WCAG 2.2.2). */}
          {list(h.brands).length > 0 && (
            <ul className="hm-marquee" dir="ltr">
              {list(h.brands).map((b, i) => S(b.name) && <li key={i}>{S(b.name)}</li>)}
            </ul>
          )}
        </header>

        {/* Featured bike */}
        <section className="hm-feature" aria-label={S(f.title)}>
          <div className="hm-feature-card">
            {H(f.ctaHref)
              ? <a href={H(f.ctaHref)} className="hm-feature-img" data-bg={lazy(bg(S(f.image)))} aria-label={S(f.title)} />
              : <span className="hm-feature-img" data-bg={lazy(bg(S(f.image)))} />}
            <div className="hm-feature-body">
              <span className="hm-eyebrow">{S(f.eyebrow)}</span>
              <h2>{S(f.title)}</h2>
              <p>{S(f.text)}</p>
              <div className="hm-chips">{list(f.chips).map((x, i) => S(x.label) && <span key={i}>{S(x.label)}</span>)}</div>
              <div className="hm-feature-ctas">
                {H(f.ctaHref) && S(f.cta) && <a href={H(f.ctaHref)} className="hm-btn hm-green">{S(f.cta)}</a>}
                {H(f.cta2Href) && S(f.cta2) && <a href={H(f.cta2Href)} className="hm-btn hm-line">{S(f.cta2)}</a>}
              </div>
            </div>
          </div>
        </section>

        <BuildStory eyebrow={S(st.eyebrow)} title={S(st.title)} steps={steps} />

        {/* Community */}
        <section className="hm-community" aria-label={S(c.title)}>
          <h2>{S(c.title)}</h2>
          <p>{S(c.text)}</p>
          {photos.length > 0 && <PhotoWall photos={photos} label={S(c.title)} closeLabel={tx("Close", "إغلاق")} photoLabel={tx("Photo {n} of {total}", "الصورة {n} من {total}")} />}
          {S(c.button) && H(c.buttonHref) && (
            <div className="hm-center"><a href={H(c.buttonHref)} className="hm-outline-btn">{S(c.button)}</a></div>
          )}
          {stats.length > 0 && (
            <div className="hm-stats">
              {stats.map((s, i) => <div key={i}><strong>{s.value}</strong><span>{s.label}</span></div>)}
            </div>
          )}
        </section>

        {/* What riders say - only with real reviews */}
        {reviews.length > 0 && (
          <section className="hm-reviews" aria-label={S(r.title)}>
            <div className="hm-reviews-rule"><span /><img src="/site/logo-dark.png" alt="" /><span /></div>
            <h2>{S(r.title)}</h2>
            <div className="hm-reviews-track" dir="ltr">
              <div className="hm-reviews-row">
                {[...reviews, ...reviews].map((x, i) => (
                  <figure className="hm-review" key={i} dir={localeInfo(locale).dir} aria-hidden={i >= reviews.length ? true : undefined}>
                    <blockquote>“{x.quote}”</blockquote>
                    <figcaption><span className="init">{x.name.trim().charAt(0)}</span><span><strong>{x.name}</strong><small>{x.role}</small></span></figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        <FitQuiz q={quiz} locale={locale} arrow={arrow} />

        {/* Learn to ride: the question, leading to the lessons sign-up */}
        {learn && <LearnTeaser locale={locale} t={learn} place="home" />}

        {/* Experiences & business */}
        {(H(sp.rentHref) || H(sp.bizHref)) && (
          <section className="hm-split" id="split">
            {H(sp.rentHref) && (
              <a href={H(sp.rentHref)} data-bg={lazy(bg(S(sp.rentImage)), SPLIT_SHADE)}>
                <div><h3>{S(sp.rentTitle)}</h3><p>{S(sp.rentText)}</p><span className="hm-btn hm-green">{S(sp.rentBtn)} {arrow}</span></div>
              </a>
            )}
            {H(sp.bizHref) && (
              <a href={H(sp.bizHref)} data-bg={lazy(bg(S(sp.bizImage)), SPLIT_SHADE)}>
                <div><h3>{S(sp.bizTitle)}</h3><p>{S(sp.bizText)}</p><span className="hm-btn hm-light">{S(sp.bizBtn)} {arrow}</span></div>
              </a>
            )}
          </section>
        )}

        {/* Visit */}
        <section className="hm-visit" id="visit" aria-label={S(v.title)}>
          <div>
            <h2>{S(v.title)}</h2>
            <p className="lead">{S(v.text)}</p>
            <p className="meta">{S(contact.address)}<br />{S(contact.hoursText)}</p>
            {/* A link staff cleared (Website > Whole site > Contact) is left out, not drawn as a link to this page. */}
            {S(contact.jccHref) && S(contact.jccName) && <p className="meta"><a href={S(contact.jccHref)} target="_blank" rel="noopener noreferrer">{S(contact.jccName)} {arrow}</a></p>}
            <OpenNow openHour={N(contact.openHour)} closeHour={N(contact.closeHour)} fridayClosed={contact.fridayClosed === true} />
            <div className="hm-visit-btns">
              {rating > 0 && (
                <a href={S(v.reviewsHref)} target="_blank" rel="noopener noreferrer" className="rating">
                  <span className="stars" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} size={15} />)}</span><span className="mm-lat">{rating.toFixed(1)}</span><small>{S(v.ratingLabel)}</small>
                </a>
              )}
              {S(contact.mapsHref) && <a href={S(contact.mapsHref)} target="_blank" rel="noopener noreferrer" className="dark">{S(v.directions)}</a>}
            </div>
          </div>
          <LazyMap title={S(v.title)} src="https://www.google.com/maps?q=Micromobility+Jeddah+Saudi+Arabia&output=embed" />
        </section>
      </main>
      <SiteFooter locale={locale} c={footer} hidden={hidden} booking={book0} />
      {preview && <PreviewBar locale={locale} />}
    </div>
  );
}
