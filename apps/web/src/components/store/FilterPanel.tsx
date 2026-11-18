"use client";

import { pick, sar } from "@/lib/store-core";
import type { Facet, FacetOption, FilterKey, ListFilters } from "@/lib/store-listing";
import type { StoreText } from "./Store.text";
import type { W2Text } from "./w2.text";

// The list's filters (O05-C): price band, size, colour and brand, each a group of ticks; any tick of a group keeps what
// has it, every group ticked must agree. The same panel sits beside the list on a wide screen and in the centred pop-up
// a phone opens with its Filters button. A group with one choice is never offered (lib/store-listing.ts facetsOf).
// Sizes are drawn as a row of chips (store.css .st-facet.is-size); each is still a tick box underneath.
export default function FilterPanel({ facets, f, onChange, locale, t, w, idp }: {
  facets: Facet[]; f: ListFilters; onChange: (next: ListFilters) => void; locale: string; t: StoreText; w: W2Text; idp: string;
}) {
  const title: Record<FilterKey, string> = { price: w.price, size: t.size, colour: t.colour, brand: w.brand };
  const label = (key: FilterKey, o: FacetOption) => {
    if (key === "price" && o.band) {
      const { min, max } = o.band;
      return min === null && max !== null ? w.under(sar(max)) : max === null && min !== null ? w.over(sar(min)) : w.band(sar(min ?? 0), sar(max ?? 0));
    }
    return key === "colour" ? pick(locale, o.en, o.ar) : o.en;
  };
  const toggle = (key: FilterKey, v: string, on: boolean) =>
    onChange({ ...f, [key]: on ? [...f[key].filter((x) => x !== v), v] : f[key].filter((x) => x !== v) });
  return (
    <div className="st-facets">
      {facets.map((fc) => (
        <fieldset key={fc.key} className={`st-facet is-${fc.key}`}>
          <legend>{title[fc.key]}</legend>
          {fc.options.map((o, i) => {
            const id = `${idp}-${fc.key}-${i}`;
            const on = f[fc.key].includes(o.value);
            return (
              <label key={o.value} htmlFor={id} className={`st-check${on ? " on" : ""}`}>
                <input id={id} type="checkbox" checked={on} onChange={(e) => toggle(fc.key, o.value, e.target.checked)} />
                {fc.key === "colour" && <i className={`st-facet-dot${o.hex ? "" : " st-dot-none"}`} style={o.hex ? { background: o.hex } : undefined} aria-hidden="true" />}
                <span>{fc.key === "size" || fc.key === "brand" ? <bdi>{label(fc.key, o)}</bdi> : label(fc.key, o)}</span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
