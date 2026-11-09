import { Link } from "@/i18n/navigation";
import { sized, srcSet } from "@/lib/img";
import { pick, priceRange, productStock, sar, type StoreProduct } from "@/lib/store-core";
import type { StoreText } from "./Store.text";
import { Amt, NoPhoto } from "./bits";

// One product as the list shows it: its photo in a fixed square (nothing moves while it loads), the brand,
// the name, its colours, the price with VAT ("From" when its variants cost different amounts) and whether
// it can still be had. A former price shows only beside a discount licence (`licence`).
export default function ProductCard({ p, locale, t, licence, eager }: { p: StoreProduct; locale: string; t: StoreText; licence: boolean; eager?: boolean }) {
  const name = pick(locale, p.name_en, p.name_ar);
  const { lo, hi } = priceRange(p);
  const stock = productStock(p);
  const img = p.images[0];
  const hexes = [...new Set(p.variants.map((v) => v.color_hex).filter((h): h is string => !!h))];
  return (
    <Link href={`/store/${p.slug}`} className={`st-card${stock.kind === "out" ? " is-out" : ""}`}>
      <span className="st-card-img">
        {img ? <img src={sized(img, 640)} srcSet={srcSet(img)} sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw" alt="" loading={eager ? undefined : "lazy"} decoding="async" /> : <NoPhoto />}
        {stock.kind === "out" && <span className="st-flag">{t.soldOut}</span>}
      </span>
      <span className="st-card-body">
        {p.brand && <span className="st-brand">{p.brand}</span>}
        <strong className="st-card-name">{name}</strong>
        {hexes.length > 1 && (
          <span className="st-dots" aria-label={t.colours(hexes.length)}>
            {hexes.slice(0, 6).map((h) => <i key={h} style={{ background: h }} />)}
          </span>
        )}
        <span className="st-card-price">
          <Amt>{lo !== hi ? t.from(sar(lo)) : sar(lo)}</Amt>
          {licence && p.compare_at && lo === hi && <s className="st-was"><Amt>{sar(p.compare_at)}</Amt></s>}
        </span>
        {stock.kind === "low" && <span className="st-low">{t.left(stock.left)}</span>}
      </span>
    </Link>
  );
}
