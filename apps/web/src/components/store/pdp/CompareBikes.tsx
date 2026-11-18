import { serverLocalize } from "@/i18n/dicts";
import { Link } from "@/i18n/navigation";
import { sized } from "@/lib/img";
import { isBike, photoAlt, pick, priceRange, productHref, sar, type Store, type StoreProduct } from "@/lib/store-core";
import { cmText, compareTable, type CompareRow } from "@/lib/store-sections";
import { T as StoreT } from "../Store.text";
import { T } from "../w3b.text";
import { Amt, NoPhoto } from "../bits";

// This bike against the two or three staff named to compare with (F10, O09-B; Cowboy's "Currently viewing"): a column
// per bike headed by its photo, name and price, this one tinted and marked "Currently viewing", the others with a View
// button; then a row per fact (rider height, weight, gears, brakes, wheel size...), "—" where a bike lacks it. Each
// fact's name sits above its values across the columns, so the table fits a phone; four columns scroll inside it.
export default function CompareBikes({ store, p, locale }: { store: Store; p: StoreProduct; locale: string }) {
  const c = compareTable(store, p, locale);
  if (!c) return null;
  const w = serverLocalize(T, locale), t = serverLocalize(StoreT, locale);
  const n = c.products.length;
  const rows: CompareRow[] = [
    ...(c.rider ? [{ key: "rider", label: w.riderHeight, values: c.rider.map((r) => (r ? cmText(r, w) : null)) }] : []),
    ...c.rows.map((r) => ({ ...r, label: r.label ?? w.keys[r.key] ?? r.key })),
  ];
  const cur = (i: number) => (i === 0 ? "is-cur" : undefined);
  return (
    <section className="st-pd-sec" aria-labelledby="st-pd-cmp-h">
      <h2 id="st-pd-cmp-h">{isBike(p) ? w.cmpBikes : w.cmp}</h2>
      <div className="st-pd-cmp-wrap" role="region" aria-labelledby="st-pd-cmp-h" tabIndex={0}>
        <table className={`st-pd-cmp n${n}`}>
          <thead>
            <tr>
              {c.products.map((x, i) => {
                const { lo, hi } = priceRange(x);
                const img = x.images[0];
                return (
                  <th key={x.id} scope="col" id={`st-cmp-c${i}`} className={cur(i)}>
                    <span className="st-pd-cmp-img">{img ? <img src={sized(img, 640)} alt={photoAlt(x, img, locale)} loading="lazy" decoding="async" /> : <NoPhoto />}</span>
                    <b className="st-pd-cmp-name"><bdi>{pick(locale, x.name_en, x.name_ar)}</bdi></b>
                    <span className="st-pd-cmp-price"><Amt>{lo !== hi ? t.from(sar(lo)) : sar(lo)}</Amt></span>
                    {i === 0
                      ? <span className="st-pd-cur">{w.current}</span>
                      : <Link href={productHref(x)} className="bk-btn2 st-pd-view">{w.view}</Link>}
                  </th>
                );
              })}
            </tr>
          </thead>
          {rows.map((r, ri) => (
            <tbody key={r.key}>
              <tr className="st-pd-cmp-k"><th colSpan={n} scope="colgroup" id={`st-cmp-r${ri}`}>{r.label}</th></tr>
              <tr>
                {r.values.map((v, i) => <td key={i} headers={`st-cmp-c${i} st-cmp-r${ri}`} className={cur(i)}>{v ? <bdi>{v}</bdi> : "—"}</td>)}
              </tr>
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
