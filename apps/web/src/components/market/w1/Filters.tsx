"use client";

import { useId, useState, type FormEvent } from "react";
import { MK_CONDITIONS, isMkCondition, type MkCondition } from "@/lib/market/core";
import { w1Digits, w1Key, w1Price, type W1Filters } from "@/lib/market/w1";
import type { MkWords } from "../Market.text";
import type { W1Words } from "../w1.text";

// The further filters of the browse page, behind its Filters button: the product type (of the sport picked), the
// condition and the price range. One form, drawn in two places by components/market/w1/Browse.tsx - inside the centred
// pop-up on a phone, in the side panel on a wide screen - so both behave the same: nothing changes until "Show
// results", and "Clear filters" empties these three and shows the results again.
//   filters   the page's filters; what the form shows when it opens, and again whenever the page's search changes
//   types     the product types offered (lib/market/w1.ts w1TypeOptions): none without a sport
//   onApply   the filters to show
//   popup     drawn inside the pop-up: its buttons are the pop-up's own row
type Draft = { type: string; condition: MkCondition | ""; min: string; max: string };
const draftOf = (f: W1Filters): Draft => ({ type: f.type ?? "", condition: f.condition ?? "", min: f.min === null ? "" : String(f.min), max: f.max === null ? "" : String(f.max) });

export default function Filters({ filters, types, onApply, popup = false, t, w }: {
  filters: W1Filters; types: { slug: string; name: string }[]; onApply: (next: W1Filters) => void; popup?: boolean; t: MkWords; w: W1Words;
}) {
  const id = useId();
  const key = w1Key(filters);
  const [seen, setSeen] = useState(key);
  const [d, setD] = useState<Draft>(() => draftOf(filters));
  // the page's search changed under the form (a chip, the Back button): it shows that search again
  if (seen !== key) { setSeen(key); setD(draftOf(filters)); }

  function submit(e: FormEvent) {
    e.preventDefault();
    let min = w1Price(d.min), max = w1Price(d.max);
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    onApply({ ...filters, type: types.some((x) => x.slug === d.type) ? d.type : null, condition: isMkCondition(d.condition) ? d.condition : null, min, max });
  }
  const clear = () => onApply({ ...filters, type: null, condition: null, min: null, max: null });

  return (
    <form className="mk-w1-form" onSubmit={submit} noValidate>
      {types.length > 0 && (
        <div className="mk-field">
          <label htmlFor={`${id}-type`}>{w.type}</label>
          <select id={`${id}-type`} value={d.type} onChange={(e) => setD({ ...d, type: e.target.value })}>
            <option value="">{w.allTypes}</option>
            {types.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
          </select>
        </div>
      )}
      <fieldset className="mk-set">
        <legend>{w.condition}</legend>
        <div className="mk-opts">
          {(["", ...MK_CONDITIONS] as const).map((c) => (
            <label key={c || "any"} className="mk-opt">
              <input type="radio" name={`${id}-cond`} value={c} checked={d.condition === c} onChange={() => setD({ ...d, condition: c })} />
              <span>{c ? t[`cond_${c}`] : w.anyCondition}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mk-set">
        <legend>{w.price}</legend>
        <div className="mk-w1-range">
          <div className="mk-field">
            <label htmlFor={`${id}-min`}>{w.priceMin}</label>
            <input id={`${id}-min`} type="text" inputMode="numeric" autoComplete="off" dir="ltr" maxLength={6} value={d.min} onChange={(e) => setD({ ...d, min: w1Digits(e.target.value) })} />
          </div>
          <div className="mk-field">
            <label htmlFor={`${id}-max`}>{w.priceMax}</label>
            <input id={`${id}-max`} type="text" inputMode="numeric" autoComplete="off" dir="ltr" maxLength={6} value={d.max} onChange={(e) => setD({ ...d, max: w1Digits(e.target.value) })} />
          </div>
        </div>
      </fieldset>
      <div className={popup ? "mk-pop-acts" : "mk-w1-form-acts"}>
        <button type="button" className="mk-btn2" onClick={clear}>{w.clear}</button>
        <button type="submit" className="mk-btn">{w.apply}</button>
      </div>
    </form>
  );
}
