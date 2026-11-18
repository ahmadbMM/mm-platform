"use client";

import { useRef } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import type { FilterKey } from "@/lib/store-listing";
import type { ActiveFilter } from "@/lib/sx-B1-list";
import type { StoreText } from "./Store.text";
import type { W2Text } from "./w2.text";
import { Ic } from "./bits";
import { facetText } from "./FilterPanel";
import { T as SPM } from "./spm.text";

// The store list's own parts on every screen (the user, 2026-11-18: "do all", builder B1): the filters that are on as
// pills above the list (SM13-B) and the drawn mark of the Sort button. Drawn marks only (R1): one monoline stroke on a
// 24 grid, as bits.tsx and icons.tsx draw.

/** Two arrows, up and down: the order of the list (SM13-B's Sort button). A sign beside a word, so screen readers skip it. */
export function SortMark() {
  return (
    <svg className="st-ic st-sort-ic" viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M8 19V5M4.5 8.5L8 5l3.5 3.5M16 5v14M12.5 15.5L16 19l3.5-3.5" />
    </svg>
  );
}


/** The filters that are on, as pills above the list once the pop-up has closed (SM13-B; beside the side panel on a
 *  computer): each takes itself off, and Clear all takes them all off when two or more are on. Nothing is drawn while no
 *  filter is on. The keyboard moves to the next pill when one goes. */
export function FilterPills({ on, locale, t, w, onRemove, onClear }: {
  on: ActiveFilter[]; locale: string; t: StoreText; w: W2Text; onRemove: (key: FilterKey, value: string) => void; onClear: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const x = useLocalize(SPM);
  if (!on.length) return null;
  const remove = (i: number, a: ActiveFilter) => {
    onRemove(a.key, a.value);
    requestAnimationFrame(() => {
      const left = box.current?.querySelectorAll<HTMLButtonElement>("button.st-fpill");
      const next = left?.[Math.min(i, left.length - 1)];
      (next ?? document.querySelector<HTMLButtonElement>(".st-filter-btn"))?.focus();
    });
  };
  return (
    <div ref={box} className="st-fpills" role="group" aria-label={w.filters}>
      {on.map((a, i) => (
        <button key={`${a.key}:${a.value}`} type="button" className="st-fpill" onClick={() => remove(i, a)}>
          <span className="mm-sr">{t.remove} </span>
          {a.key === "colour" && <i className={`st-fpill-dot${a.option.hex ? "" : " st-dot-none"}`} style={a.option.hex ? { background: a.option.hex } : undefined} aria-hidden="true" />}
          {a.key === "size" ? <span>{t.size} <bdi>{a.value}</bdi></span> : a.key === "brand" || a.key === "tags" ? <bdi>{a.value}</bdi> : <span>{facetText(a.key, a.option, locale, t, w, x)}</span>}
          <Ic name="close" size={14} />
        </button>
      ))}
      {on.length > 1 && <button type="button" className="st-clear" onClick={onClear}>{w.clearAll}</button>}
    </div>
  );
}
