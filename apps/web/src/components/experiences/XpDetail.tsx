"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { fill } from "@/i18n/tx";
import { isRtl } from "@/i18n/locales";
import { Sar } from "@/components/booking/Sar";
import { T as BOOK } from "./Booking.text";
import { T } from "./sx-B5.text";
import { KindIcon, SatRoute } from "./KindArt";
import { XIc, type XpIconName } from "./sx-B5-icons";
import { waLink, whenText, type XpFactKey, type XpItem, type XpStatus } from "@/lib/sx-B5";
import "./sx-B5.css";

// A session's own page (EM05-B), and the detail pane beside the list on tablets and desktops (EM10-B): the kind's drawn
// cover, the title, a 48px date tile, the place with Directions, the facts as rows (R4: facts, never sentences under
// things), the booking card (price or Free, where the date stands, Book) and, after it, the map, the Saturday ride's
// route, a private group request and the kind's calendar. On a page the booking card sits in its own column from 768px
// and sticks under the header; on a phone, and in the pane, it follows the date and place, about the second screen.
// Nothing is pinned to the bottom (R2) and nobody else's booking is ever said (R7).

/** What the page knows beside the session: the kind's name, the words staff keep for the gathering and the start, the
 *  kind's calendar address (EF16), its average rating (EF35), the WhatsApp number for a private group (EF31). */
export type XpExtras = {
  kindName: Record<string, string>;
  gatherWord: string; startWord: string;
  cal: Record<string, string>;
  rating: Record<string, { avg: number; n: number }>;
  wa: string | null;
  /** The List / Calendar switch's words and the month's arrows (the booking app's shGrpView, calViewList, calViewCal,
   *  calPrev, calNext; KindTheme.words.ts). */
  calWords: { view: string; list: string; cal: string; prev: string; next: string };
};

export function XpAmt({ n, word }: { n: number; word: string }) {
  return <Sar n={n} word={word} />;
}

/** The price or Free, in the page's words (Booking.text's). */
export function PriceText({ s, b }: { s: Pick<XpItem, "price">; b: typeof BOOK.en }): ReactNode {
  const p = s.price;
  if (!p) return null;
  if (p.k === "free") return b.free;
  const [a, z = ""] = (p.k === "seat" ? b.perSeat : b.from).split("{0}");
  return <>{a}<XpAmt n={p.n} word={b.sarWord} />{z}</>;
}

/** Where the date stands, in the booking's words; null when it is simply open. */
export function statusText(st: XpStatus | null, b: typeof BOOK.en): string | null {
  if (!st) return null;
  switch (st.k) {
    case "fbk": return b.fbk;
    case "wl": return b.waitlist;
    case "left": return fill(st.n === 1 ? b.left1 : b.leftN, st.n);
    case "few": return b.few;
    case "opens": return st.text;
    case "mf": return st.label;
  }
}
export const statusTone = (st: XpStatus | null): string => (!st ? "" : st.k === "fbk" || st.k === "wl" ? "full" : st.k === "left" || st.k === "few" ? "low" : st.k === "mf" && !st.held ? "mf" : "closed");

const FACT_IC: Record<XpFactKey, XpIconName> = {
  who: "people", needs: "info", bring: "bottle", included: "check", collect: "bike", route: "route", breakfast: "cup", lang: "lang", terms: "terms",
};

/** The map, put in only as it nears the screen (a Google Maps embed is heavy), its box holding the space meanwhile. */
function XpMap({ src, title }: { src: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      const t = setTimeout(() => setOn(true));
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={box} className="xq-map">{on && <iframe title={title} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}</div>;
}

export default function XpDetail({ s, x, locale, mode, pageHref }: { s: XpItem; x: XpExtras; locale: string; mode: "page" | "pane"; pageHref?: string }) {
  const t = useLocalize(T);
  const b = useLocalize(BOOK);
  const rtl = isRtl(locale);
  const H = mode === "page" ? "h1" : "h2";
  const st = statusText(s.status, b);
  const when = whenText(s, x, t);
  const rating = x.rating[s.kind];
  const facts = s.facts.filter((f) => f.k !== "lang"); // the language is a chip (EF30)
  const wa = x.wa ? waLink(x.wa, fill(t.privateMsg, s.name, s.day)) : null;
  const kn = x.kindName[s.kind] ?? "";
  const kicker = kn && !s.name.toLowerCase().includes(kn.toLowerCase()) ? kn : "";

  const card = (
    <div className="xq-card">
      {mode === "page" && <p className="xq-card-when"><bdi>{s.tile.wd} {s.tile.dn} {s.tile.mo}{s.start && ` · ${s.start}`}</bdi></p>}
      <div className="xq-card-top">
        {s.price && <p className="xq-price"><PriceText s={s} b={b} /></p>}
        {st && <p className={`xq-st ${statusTone(s.status)}`}>{s.status?.k === "mf" && s.status.held && <XIc name="clock" size={15} />}{st}</p>}
      </div>
      {s.status?.k === "mf" && s.status.when && <p className="xq-st-when"><bdi>{s.status.when}</bdi></p>}
      {s.act.k === "book" && <a className="xq-btn" href={s.act.href}>{t.book}</a>}
      {s.act.k === "out" && <a className="xq-btn" href={s.act.href}>{t.book}<XIc name="out" size={17} /></a>}
      {mode === "pane" && pageHref && <a className="xq-link" href={pageHref}>{t.open}<XIc name={rtl ? "back" : "go"} size={15} /></a>}
    </div>
  );

  return (
    <article className={`xq-detail ev-${s.kind} ${mode}`} aria-labelledby={`xq-t-${s.id}`}>
      <div className="xq-cover" aria-hidden="true"><span className="xq-cover-art k-art" /><span className="xq-cover-big"><KindIcon kind={s.kind} size={120} /></span><span className="xq-cover-mk"><KindIcon kind={s.kind} size={30} /></span></div>
      <header className="xq-head">
        {/* the kind's name, unless the title says it already ("Saturday" over "Saturday Social Ride") */}
        {(kicker || s.featured) && <p className="xq-kicker">{kicker && <><KindIcon kind={s.kind} size={15} />{kicker}</>}{s.featured && <span className="xq-feat">{t.featured}</span>}</p>}
        <H id={`xq-t-${s.id}`} className="xq-title">{s.name}</H>
        <div className="xq-date">
          <span className="xq-tile" aria-hidden="true"><span>{s.tile.wd}</span><strong>{s.tile.dn}</strong><span>{s.tile.mo}</span></span>
          <div className="xq-date-txt">
            <p className="xq-dday">{s.near && <><strong>{s.near}</strong> · </>}{s.day}</p>
            {when && <p className="xq-time"><bdi>{when}</bdi></p>}
          </div>
        </div>
        {s.place && (
          <div className="xq-place">
            <XIc name="pin" />
            <span className="xq-place-n">{s.place.name}{s.place.held && <span className="xq-held"> · <bdi>{fill(t.told, s.place.held)}</bdi></span>}</span>
            {s.place.dir && <a className="xq-btn2" href={s.place.dir} target="_blank" rel="noopener">{t.directions}</a>}
          </div>
        )}
        {(s.sunrise || s.temp != null || s.pace.length > 0 || s.lang || rating) && (
          <ul className="xq-chips" role="list">
            {s.sunrise && <li><XIc name="sun" size={15} /><bdi>{s.sunrise}</bdi></li>}
            {s.temp != null && s.start && <li><XIc name="temp" size={15} /><bdi>{fill(t.tempAt, s.temp, s.start)}</bdi></li>}
            {s.pace.map((p, i) => <li key={i}>{i === 0 && <XIc name="pace" size={15} />}{p}</li>)}
            {s.lang && <li><XIc name="lang" size={15} />{s.lang}</li>}
            {rating && <li aria-label={`${t.ratingAria}: ${fill(t.rating, rating.avg, rating.n)}`}><XIc name="star" size={15} /><bdi>{fill(t.rating, rating.avg, rating.n)}</bdi></li>}
          </ul>
        )}
      </header>
      {card}
      <div className="xq-body">
        {facts.length > 0 && (
          <dl className="xq-facts">
            {facts.map((f) => (
              <div key={f.k} className="xq-fact">
                <dt><XIc name={FACT_IC[f.k]} size={17} />{t[f.k]}</dt>
                <dd>{f.v.length > 1 ? <ul>{f.v.map((v, i) => <li key={i}>{v}</li>)}</ul> : f.v[0]}</dd>
              </div>
            ))}
          </dl>
        )}
        {s.route && <div className="xq-route"><SatRoute w={s.route} rtl={rtl} /></div>}
        {s.desc && <p className="xq-desc">{s.desc}</p>}
        {s.place?.map && <XpMap src={s.place.map} title={`${t.map}: ${s.place.name}`} />}
        {(wa || x.cal[s.kind]) && (
          <div className="xq-more">
            {wa && <a className="xq-btn2" href={wa} target="_blank" rel="noopener"><XIc name="chat" size={17} />{t.privateGroup}</a>}
            {x.cal[s.kind] && (
              // a webcal:// address on this site's host, which a phone's calendar subscribes to; the plain address without it
              <a className="xq-btn2" href={x.cal[s.kind]} onClick={(e) => { e.preventDefault(); window.location.href = `webcal://${window.location.host}${x.cal[s.kind]}`; }}>
                <XIc name="calPlus" size={17} />{t.calendar}
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
