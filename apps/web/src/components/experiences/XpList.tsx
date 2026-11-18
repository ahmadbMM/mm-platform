"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { fill } from "@/i18n/tx";
import { isRtl } from "@/i18n/locales";
import { T as BOOK } from "./Booking.text";
import { T } from "./sx-B5.text";
import { KindIcon } from "./KindArt";
import { XIc } from "./sx-B5-icons";
import XpDetail, { PriceText, statusText, statusTone, type XpExtras } from "./XpDetail";
import "./sx-B5.css";
import { NO_FILTER, chipHas, dayGroups, filterOn, filterQuery, kindsOf, lenText, seriesPlan, xpFilter, type XpFilter, type XpItem, type XpSeries, type XpWhen } from "@/lib/sx-B5";

// Every session ahead in one list (EM01-B, EM03-B): chips for each kind and for Today, This week, This weekend, Women
// only and Kids, the one on filled (EF26); absolute day headings with Today or Tomorrow beside them (EF07); a kind with
// several dates ahead as one series block with its next two dates and their prices (EF27, EF08), its other dates under
// its chip; each row the start in large figures with the gathering under it (EF32), the name, the place and how long it
// lasts (EF04), the price, Free or where it stands at the end, the kind's colour along its start and its drawn mark, a
// Featured ribbon (EF28). A row opens the session's own page (EM05-B); from 768px the page sits beside the list instead,
// in a pane that sticks under the header on desktops (EM10-B), on the left in Arabic and Urdu as the grid turns round.

type Props = {
  locale: string;
  items: XpItem[];
  /** The kinds in the order the chips name them. */
  order: string[];
  x: XpExtras;
  today: string;
  /** The filters the address asked for (?k=&w=&women=&kids=). */
  start: XpFilter;
  /** /experiences/s/ on this site: a session's page is this and its id. */
  pageBase: string;
  /** What the page says when nothing is ahead at all (Experiences > Dates: empty). */
  empty: string;
};

const WIDE = "(min-width: 768px)";

export default function XpList({ locale, items, order, x, today, start, pageBase, empty }: Props) {
  const t = useLocalize(T);
  const b = useLocalize(BOOK);
  const rtl = isRtl(locale);
  const [f, setF] = useState<XpFilter>(start);
  const [selId, setSelId] = useState<string | null>(null);
  const kinds = useMemo(() => kindsOf(items, order), [items, order]);
  const shown = useMemo(() => xpFilter(items, f, today), [items, f, today]);
  // folded into series only while nothing narrows the list
  const plan = useMemo(() => (filterOn(f) ? { series: [] as XpSeries<XpItem>[], rest: shown } : seriesPlan(shown)), [f, shown]);
  const days = useMemo(() => {
    const at = new Map<string, XpSeries<XpItem>[]>();
    for (const sr of plan.series) at.set(sr.next[0].date, [...(at.get(sr.next[0].date) ?? []), sr]);
    const rows = dayGroups(plan.rest);
    const all = [...new Set([...rows.map((d) => d.date), ...at.keys()])].sort();
    return all.map((date) => ({ date, series: at.get(date) ?? [], rows: rows.find((d) => d.date === date)?.items ?? [] }));
  }, [plan]);
  const sel = shown.find((s) => s.id === selId) ?? shown.find((s) => s.act.k !== "none") ?? shown[0] ?? null;

  // the chips are kept in the address, so a narrowed list can be shared and Back returns to it
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      for (const k of ["k", "w", "women", "kids"]) u.searchParams.delete(k);
      new URLSearchParams(filterQuery(f).slice(1)).forEach((v, k) => u.searchParams.set(k, v));
      if (u.toString() !== window.location.href) window.history.replaceState(window.history.state, "", u.toString());
    } catch { /* the chips still narrow the list */ }
  }, [f]);

  const open = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (typeof window !== "undefined" && window.matchMedia(WIDE).matches) {
      e.preventDefault();
      setSelId(id);
    }
  };
  const chip = (on: boolean, label: React.ReactNode, onClick: () => void, key: string, kind?: string) => (
    <button key={key} type="button" className={`xq-chip${on ? " on" : ""}${kind ? ` ev-${kind}` : ""}`} aria-pressed={on} onClick={onClick}>{label}</button>
  );
  const whenChip = (w: XpWhen, label: string) => chipHas(items, { ...f, when: w }, today) || f.when === w
    ? chip(f.when === w, label, () => setF({ ...f, when: f.when === w ? null : w }), w) : null;

  const row = (s: XpItem) => {
    const st = statusText(s.status, b);
    const on = sel?.id === s.id;
    return (
      <li key={s.id}>
        <a className={`xq-row ev-${s.kind}${on ? " sel" : ""}${s.status?.k === "fbk" ? " fbk" : ""}`} href={`${pageBase}${encodeURIComponent(s.id)}`}
          onClick={(e) => open(e, s.id)} aria-current={on ? "true" : undefined}>
          <span className="xq-row-t">
            <bdi className="xq-row-start">{s.start ?? ""}</bdi>
            {s.gather && <bdi className="xq-row-g">{x.gatherWord} {s.gather}</bdi>}
          </span>
          <span className="xq-row-m">
            <span className="xq-row-n"><KindIcon kind={s.kind} size={15} /><span>{s.name}</span>{s.featured && <span className="xq-feat">{t.featured}</span>}</span>
            <span className="xq-row-p">{[s.place?.name, s.len ? lenText(s.len, t) : null].filter(Boolean).map((v, i) => <span key={i}>{i > 0 && " · "}<bdi>{v}</bdi></span>)}</span>
          </span>
          <span className="xq-row-e">
            {s.price && s.status?.k !== "fbk" && <span className="xq-row-price"><PriceText s={s} b={b} /></span>}
            {st && <span className={`xq-st ${statusTone(s.status)}`}>{st}</span>}
          </span>
          <XIc name={rtl ? "back" : "go"} size={16} className="xq-row-go" />
        </a>
      </li>
    );
  };
  const series = (sr: XpSeries<XpItem>) => (
    <section key={`sr-${sr.kind}`} className={`xq-series ev-${sr.kind}`} aria-label={x.kindName[sr.kind] ?? sr.kind}>
      <div className="xq-series-h">
        <span className="xq-series-mk"><KindIcon kind={sr.kind} size={18} /></span>
        <span className="xq-series-n"><strong>{sr.next[0]?.name || x.kindName[sr.kind]}</strong>
          {sr.weekday != null && <span>{fill(t.every, new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + sr.weekday, 12))))}</span>}</span>
      </div>
      <ul className="xq-sdates" role="list">
        {sr.next.map((s) => {
          const st = statusText(s.status, b);
          return (
            <li key={s.id}>
              <a className={`xq-sdate${sel?.id === s.id ? " sel" : ""}`} href={`${pageBase}${encodeURIComponent(s.id)}`} onClick={(e) => open(e, s.id)}>
                <span className="xq-sdate-d">{s.near ?? `${s.tile.wd} ${s.tile.dn} ${s.tile.mo}`}{s.start && <> · <bdi>{s.start}</bdi></>}</span>
                <span className={`xq-sdate-p${s.status ? ` ${statusTone(s.status)}` : ""}`}>{st ?? <PriceText s={s} b={b} />}</span>
              </a>
            </li>
          );
        })}
      </ul>
      {sr.items.length > 2 && <button type="button" className="xq-link" onClick={() => setF({ ...NO_FILTER, kind: sr.kind })}>{t.allDates}<XIc name={rtl ? "back" : "go"} size={15} /></button>}
    </section>
  );

  if (!items.length) return <p className="xq-empty">{empty}</p>;
  return (
    <div className="xq-split">
      <div className="xq-list">
        <div className="xq-filters" role="group" aria-label={t.show}>
          {kinds.length > 1 && (
            <div className="xq-chiprow">
              {chip(!f.kind, t.all, () => setF({ ...f, kind: null }), "all")}
              {kinds.map((k) => chip(f.kind === k, <><KindIcon kind={k} size={15} />{x.kindName[k] ?? k}</>, () => setF({ ...f, kind: f.kind === k ? null : k }), `k-${k}`, k))}
            </div>
          )}
          <div className="xq-chiprow">
            {whenChip("today", t.today)}
            {whenChip("week", t.week)}
            {whenChip("weekend", t.weekend)}
            {(chipHas(items, { ...f, women: true }, today) || f.women) && chip(f.women, t.women, () => setF({ ...f, women: !f.women }), "women")}
            {(chipHas(items, { ...f, kids: true }, today) || f.kids) && chip(f.kids, t.kids, () => setF({ ...f, kids: !f.kids }), "kids")}
          </div>
        </div>
        {!shown.length ? (
          <div className="xq-empty"><p>{t.noMatch}</p><button type="button" className="xq-btn2" onClick={() => setF(NO_FILTER)}>{t.showAll}</button></div>
        ) : days.map((d) => {
          const first = d.rows[0] ?? d.series[0]?.next[0];
          return (
            <section key={d.date} className="xq-day" aria-labelledby={`xq-d-${d.date}`}>
              <h3 id={`xq-d-${d.date}`} className="xq-dayh">{first?.near && <><strong>{first.near}</strong> · </>}{first?.day}</h3>
              {d.series.map(series)}
              {d.rows.length > 0 && <ul className="xq-rows" role="list">{d.rows.map(row)}</ul>}
            </section>
          );
        })}
      </div>
      {sel && (
        <div className="xq-pane">
          <XpDetail key={sel.id} s={sel} x={x} locale={locale} mode="pane" pageHref={`${pageBase}${encodeURIComponent(sel.id)}`} />
        </div>
      )}
    </div>
  );
}
