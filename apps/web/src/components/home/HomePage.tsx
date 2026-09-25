import SiteNav from "@/components/site/SiteNav";
import SiteFooter, { type FooterContent } from "@/components/site/SiteFooter";
import { footerFrom } from "@/components/site/PageShell";
import AnnouncementBar, { type Announcement } from "@/components/site/AnnouncementBar";
import PreviewBar from "@/components/site/PreviewBar";
import BuildStory, { type Step } from "@/components/home/BuildStory";
import PhotoWall from "@/components/home/PhotoWall";
import FitQuiz, { type QuizText } from "@/components/home/FitQuiz";
import OpenNow from "@/components/home/OpenNow";
import "@/components/site/site.css";
import "@/components/home/home.css";
import { BOOKING_URL, bookingLink, localHref, pageOf } from "@/lib/links";
import { serverL } from "@/i18n/dicts";
import { localeInfo, isRtl } from "@/i18n/locales";

// Home, from Home.dc.html. Everything it says comes from the staff page (site_content), else
// the design's words. Sections whose content is still empty (reviews, the numbers strip, the
// Google rating) are left out rather than shown with invented examples.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);

export default function HomePage({ locale, home, site, preview, hidden = [] }: { locale: string; home: Record<string, Sec>; site: Record<string, Sec>; preview: boolean; hidden?: string[] }) {
  const tx = serverL(locale);
  // A button to a page staff have switched off would only reload Home (the proxy sends it back
  // here): a ride page opens the booking app instead, any other the WhatsApp chat.
  const RIDE_PAGES = new Set(["experiences", "events", "club", "routes"]);
  const H = (v: unknown) => {
    const href = S(v), pg = pageOf(href);
    if (!pg || !hidden.includes(pg)) return localHref(href, locale);
    return RIDE_PAGES.has(pg) ? bookingLink(BOOKING_URL, locale) : (S(site.social?.whatsapp) || bookingLink(BOOKING_URL, locale));
  };
  const arrow = (isRtl(locale) ? "←" : "→");
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

  return (
    <div className="mm-site" dir={localeInfo(locale).dir}>
      <SiteNav locale={locale} hidden={hidden} />
      <main id="mm-main" style={{ paddingTop: 52 }}>
        {/* Welcome: riders or business */}
        <section className="hm-entry" aria-label={`${S(e.riderTitle)} / ${S(e.bizTitle)}`}>
          <a className="hm-entry-half riders" href="#start">
            <span className="hm-entry-bg" style={{ backgroundImage: `linear-gradient(to top,rgba(0,0,0,.62),rgba(0,0,0,.05) 55%),url('${S(e.riderImage)}')` }} />
            <span className="hm-entry-copy">
              <span className="hm-entry-tick" />
              <span className="hm-entry-eyebrow">{S(e.riderEyebrow)}</span>
              <h1 className="hm-entry-title">{S(e.riderTitle)}</h1>
              <span className="hm-entry-text">{S(e.riderText)}</span>
              <span className="hm-btn hm-green hm-entry-btn">{S(e.riderBtn)} <span className="hm-arw">{arrow}</span></span>
            </span>
          </a>
          <a className="hm-entry-half biz" href={H(e.bizHref)}>
            <span className="hm-entry-bg" style={{ backgroundImage: `linear-gradient(to top,rgba(0,0,0,.62),rgba(0,0,0,.05) 55%),url('${S(e.bizImage)}')` }} />
            <span className="hm-entry-copy">
              <span className="hm-entry-tick" />
              <span className="hm-entry-eyebrow">{S(e.bizEyebrow)}</span>
              <span className="hm-entry-title" role="heading" aria-level={2}>{S(e.bizTitle)}</span>
              <span className="hm-entry-text">{S(e.bizText)}</span>
              <span className="hm-btn hm-light hm-entry-btn">{S(e.bizBtn)} <span className="hm-arw">{arrow}</span></span>
            </span>
          </a>
          <div className="hm-entry-divider" aria-hidden="true" />
          <div className="hm-entry-phone" style={{ backgroundImage: `linear-gradient(to top,rgba(251,249,244,.95),rgba(251,249,244,.5) 40%,rgba(251,249,244,0) 70%),url('${S(e.riderImage)}')` }}>
            <p className="hm-est mm-lat">EST. JEDDAH · 21°32′N</p>
            <h2>{S(e.phoneTitle)}</h2>
            <p>{S(e.phoneText)}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a href="#start" className="hm-btn hm-green">{S(e.riderBtn)} <span className="hm-arw">{arrow}</span></a>
              <a href={H(e.bizHref)} className="hm-btn hm-ghost">{S(e.bizBtn)} <span className="hm-arw">{arrow}</span></a>
            </div>
          </div>
        </section>

        <AnnouncementBar items={announcements} arrow={arrow} />

        {/* Hero */}
        <header className="hm-hero" id="start">
          <div className="hm-hero-meta">
            <span className="hm-coord mm-lat">EST. JEDDAH</span>
            <span className="hm-hero-eyebrow">{S(h.eyebrow)}</span>
            <span className="hm-coord mm-lat">21°32′N · 39°10′E</span>
          </div>
          <h2 className="hm-hero-title">{S(h.title)}</h2>
          <p className="hm-hero-text">{S(h.text)}</p>
          <div className="hm-hero-bike">
            <img src={S(h.image)} alt={S(h.eyebrow)} width={1180} height={620} fetchPriority="high" decoding="async" />
          </div>
          <div className="hm-badges">
            {list(h.badges).map((b, i) => S(b.title) && (
              <div key={i}><strong>{S(b.title)}</strong><span>{S(b.sub)}</span></div>
            ))}
          </div>
          {list(h.brands).length > 0 && (
            <div className="hm-marquee" dir="ltr" aria-hidden="true">
              <div>
                {[...list(h.brands), ...list(h.brands), ...list(h.brands), ...list(h.brands)].map((b, i) => <span key={i}>{S(b.name)}</span>)}
              </div>
            </div>
          )}
        </header>

        {/* Featured bike */}
        <section className="hm-feature" aria-label={S(f.title)}>
          <div className="hm-feature-card">
            <a href={H(f.ctaHref)} className="hm-feature-img" style={{ backgroundImage: `url('${S(f.image)}')` }} aria-label={S(f.title)} />
            <div className="hm-feature-body">
              <span className="hm-eyebrow">{S(f.eyebrow)}</span>
              <h2>{S(f.title)}</h2>
              <p>{S(f.text)}</p>
              <div className="hm-chips">{list(f.chips).map((x, i) => S(x.label) && <span key={i}>{S(x.label)}</span>)}</div>
              <div className="hm-feature-ctas">
                <a href={H(f.ctaHref)} className="hm-btn hm-green">{S(f.cta)}</a>
                <a href={H(f.cta2Href)} className="hm-btn hm-line">{S(f.cta2)}</a>
              </div>
            </div>
          </div>
        </section>

        <BuildStory eyebrow={S(st.eyebrow)} title={S(st.title)} steps={steps} />

        {/* Community */}
        <section className="hm-community" aria-label={S(c.title)}>
          <h2>{S(c.title)}</h2>
          <p>{S(c.text)}</p>
          {photos.length > 0 && <PhotoWall photos={photos} label={S(c.title)} closeLabel={tx("Close", "إغلاق")} />}
          {S(c.button) && S(c.buttonHref) && (
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

        {/* Experiences & business */}
        <section className="hm-split" id="split">
          <a href={H(sp.rentHref)} style={{ backgroundImage: `linear-gradient(to top,rgba(0,0,0,.8),rgba(0,0,0,.06) 55%),url('${S(sp.rentImage)}')` }}>
            <div><h3>{S(sp.rentTitle)}</h3><p>{S(sp.rentText)}</p><span className="hm-btn hm-green">{S(sp.rentBtn)}</span></div>
          </a>
          <a href={H(sp.bizHref)} style={{ backgroundImage: `linear-gradient(to top,rgba(0,0,0,.8),rgba(0,0,0,.06) 55%),url('${S(sp.bizImage)}')` }}>
            <div><h3>{S(sp.bizTitle)}</h3><p>{S(sp.bizText)}</p><span className="hm-btn hm-light">{S(sp.bizBtn)}</span></div>
          </a>
        </section>

        {/* Visit */}
        <section className="hm-visit" id="visit" aria-label={S(v.title)}>
          <div>
            <h2>{S(v.title)}</h2>
            <p className="lead">{S(v.text)}</p>
            <p className="meta">{S(contact.address)}<br />{S(contact.hoursText)}</p>
            <p className="meta"><a href={S(contact.jccHref)} target="_blank" rel="noopener noreferrer">{S(contact.jccName)} {arrow}</a></p>
            <OpenNow openHour={N(contact.openHour)} closeHour={N(contact.closeHour)} fridayClosed={contact.fridayClosed === true} />
            <div className="hm-visit-btns">
              {rating > 0 && (
                <a href={S(v.reviewsHref)} target="_blank" rel="noopener noreferrer" className="rating">
                  <span className="stars" aria-hidden="true">★★★★★</span><span className="mm-lat">{rating.toFixed(1)}</span><small>{S(v.ratingLabel)}</small>
                </a>
              )}
              <a href={S(contact.mapsHref)} target="_blank" rel="noopener noreferrer" className="dark">{S(v.directions)}</a>
            </div>
          </div>
          <iframe title={S(v.title)} src="https://www.google.com/maps?q=Micromobility+Jeddah+Saudi+Arabia&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </section>
      </main>
      <SiteFooter locale={locale} c={footer} hidden={hidden} />
      {preview && <PreviewBar locale={locale} />}
    </div>
  );
}
