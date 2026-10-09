"use client";

import { useRef, useState } from "react";
import Medal from "./Medal";
import { fill } from "@/i18n/tx";

// Every badge on My Account, as the booking app's account page draws them (_mrBadgesRow,
// _mrBadgeInfo): the earned ones in a grid of equal tiles, the ones still to earn folded under one
// dashed button that shows four of them greyed and how many there are, and a badge's popup -
// what it means, how it is earned, its progress, a dated badge's window, and for one staff gave,
// their note and the day. A ladder (badges that count the same thing to a higher number, the booking
// app's BDG_LADDERS, 2026-10-09) is one tile: its top level reached, a dot per level under its name,
// and every level listed in its popup. The words arrive ready from the page (RideRecord); nothing is
// fetched here.
export type BadgeView = {
  slug: string; icon: string; color: string; on: boolean;
  name: string; how: string; about: string;
  /** "4/5", "78%" on a badge still to earn; null when there is no count. */
  prog: string | null;
  /** "Given by the MicroMobility team · 3 Oct 2026" and the note staff wrote. */
  given: { line: string; note: string | null } | null;
  /** "On now, until 29 Feb 2027" / "Opens 1 Dec 2026" on a dated badge not yet earned. */
  season: string | null;
  /** A ladder's levels, lowest first, and how many are reached; null on any other badge. */
  levels: BadgeLevel[] | null;
  lvN: number;
};
export type BadgeLevel = { slug: string; icon: string; color: string; on: boolean; name: string; how: string; prog: string | null };
export type BadgeGridText = {
  badges: string; toEarn: string; show: string; hide: string; notEarned: string; howTo: string; earned: string; close: string;
  levelOf: string; maxLevel: string; levels: string;
};

// The colours Medal draws special (its SPECIAL): Race Ready, National Day 96 and Run for Her's pink.
const special = (c: string) => c === "special" || c === "national" || c === "pink";
// A level not begun yet in a ladder's popup (the booking app's lock icon).
const Lock = () => (
  <svg className="badge-lvl-lock" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export default function BadgeGrid({ items, t }: { items: BadgeView[]; t: BadgeGridText }) {
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<BadgeView | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const on = items.filter((x) => x.on), lk = items.filter((x) => !x.on);
  const show = (x: BadgeView, el: HTMLElement) => {
    back.current = el;
    setOpen(x);
    requestAnimationFrame(() => dlg.current?.showModal());
  };
  const levelOf = (x: BadgeView) => fill(t.levelOf, x.lvN, x.levels?.length ?? 0);
  const tile = (x: BadgeView) => (
    <button key={x.slug} type="button" className={`mr-badge${x.on ? "" : " locked"}${x.given ? " given" : ""}${x.levels ? " ladder" : ""}${special(x.color) ? ` special sp-${x.color}` : ""}`}
      aria-label={`${x.name}${x.levels && x.lvN ? ` · ${levelOf(x)}` : ""}: ${x.how}${x.on ? "" : ` (${t.notEarned})`}`} onClick={(e) => show(x, e.currentTarget)}>
      {!x.on && x.prog && <span className="mr-badge-p">{x.prog}</span>}
      <Medal icon={x.icon} color={x.color} />
      <span className="mr-badge-nm">{x.name}</span>
      {x.levels && <span className="mr-badge-lv" aria-hidden="true">{x.levels.map((y, i) => <i key={y.slug} className={i < x.lvN ? "on" : undefined} />)}</span>}
    </button>
  );
  return (
    <div className="mr-bdg">
      <h3 className="mr-badges-h">{t.badges}<span className="mr-badges-n" dir="ltr">{on.length}/{items.length}</span></h3>
      {on.length > 0 && <div className="mr-badges">{on.map(tile)}</div>}
      {lk.length > 0 && (
        <>
          <button type="button" className="mr-badges-more" aria-expanded={more} aria-controls={more ? "mr-badges-lk" : undefined} onClick={() => setMore((m) => !m)}>
            {!more && <span className="mr-bm-peek">{lk.slice(0, 4).map((x) => <Medal key={x.slug} icon={x.icon} color={x.color} />)}</span>}
            <span className="mr-bm-t">{t.toEarn}<span className="mr-bm-n">{lk.length}</span></span>
            <span className="mr-bm-a">{more ? `${t.hide} ▴` : `${t.show} ▾`}</span>
          </button>
          {more && <div className="mr-badges" id="mr-badges-lk">{lk.map(tile)}</div>}
        </>
      )}
      <dialog ref={dlg} className={`badge-pop-box${open && special(open.color) ? ` special sp-${open.color}` : ""}`} aria-label={open?.name}
        onClose={() => { setOpen(null); back.current?.focus(); }}
        onClick={(e) => { if (e.target === e.currentTarget) dlg.current?.close(); }}>
        {open && (
          <div className="badge-pop-in">
            <Medal icon={open.icon} color={open.color} className={`badge-pop-ic${open.on ? "" : " locked"}`} />
            <p className="badge-pop-nm">{open.name}</p>
            {open.levels && open.lvN > 0 && <p className="badge-pop-lvn">{levelOf(open)}</p>}
            {open.about && <p className="badge-pop-about">{open.about}</p>}
            {open.levels ? (
              <>
                <p className="badge-pop-how">{t.levels}</p>
                <ol className="badge-lvls">
                  {open.levels.map((y, i) => (
                    <li key={y.slug} className={`badge-lvl${y.on ? " on" : ""}${i === open.lvN - 1 ? " cur" : ""}`}>
                      <Medal icon={y.icon} color={y.color} className={y.on ? "" : "locked"} />
                      <span className="badge-lvl-t"><b>{y.name}</b>{y.how && <small>{y.how}</small>}</span>
                      <bdi className="badge-lvl-n">{y.on ? "✓" : y.prog && /^\d+\/\d+$/.test(y.prog) ? y.prog : <Lock />}</bdi>
                    </li>
                  ))}
                </ol>
              </>
            ) : open.how && <><p className="badge-pop-how">{t.howTo}</p><p className="badge-pop-d">{open.how}</p></>}
            {!open.on && open.season && <p className="badge-pop-how badge-pop-sn">{open.season}</p>}
            {open.given?.note && <p className="badge-pop-note"><bdi>{open.given.note}</bdi></p>}
            {open.given ? <p className="badge-pop-earned">✓ {open.given.line}</p>
              : open.levels ? (open.lvN === open.levels.length ? <p className="badge-pop-earned">✓ {t.maxLevel}</p> : null)
              : open.on ? <p className="badge-pop-earned">✓ {t.earned}</p>
              : open.prog ? <p className="badge-pop-prog" dir="ltr">{open.prog}</p> : null}
            <form method="dialog"><button type="submit" className="badge-pop-close">{t.close}</button></form>
          </div>
        )}
      </dialog>
    </div>
  );
}
