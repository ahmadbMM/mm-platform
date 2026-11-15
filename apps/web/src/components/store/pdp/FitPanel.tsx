import { serverLocalize } from "@/i18n/dicts";
import { pickBi, type StoreProduct } from "@/lib/store-core";
import { T } from "../w3b.text";

// The apparel fit panel (F38), in the details and never under Add to cart: Fit (Regular), Size (your normal size) and
// Best for (hot days), each row only when staff wrote it.
export default function FitPanel({ p, locale }: { p: StoreProduct; locale: string }) {
  if (!p.fit) return null;
  const w = serverLocalize(T, locale);
  const rows = ([["fit", w.fitK], ["size", w.sizeK], ["best", w.bestK]] as const)
    .map(([k, label]) => [label, pickBi(locale, p.fit?.[k])] as const).filter(([, v]) => v);
  if (!rows.length) return null;
  return (
    <section className="st-pd-card" aria-labelledby="st-pd-fit-h">
      <h2 id="st-pd-fit-h" className="st-pd-h3">{w.fitH}</h2>
      <dl className="st-pd-fit">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd><bdi>{v}</bdi></dd></div>)}
      </dl>
    </section>
  );
}
