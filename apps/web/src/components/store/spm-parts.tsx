import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { ProductBadge, StoreProduct } from "@/lib/store-core";
import { badgeText, type StoreBanner } from "@/lib/store-rules";
import { pick } from "@/lib/store-core";
import type { SpmText } from "./spm.text";

// The product-management build's own pieces (2026-11-19), drawn by the server or inside a list: a product's mark (staff's
// badge or the automatic New), the Preview mark (staging only), the pre-order mark, and the store's banner. Drawn marks
// only: one monoline stroke on a 24 grid, round ends, the weight of bits.tsx's set (1.75); never a text glyph or an emoji.

const P = {
  new: <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
  best: <path d="M12 3.6l2.3 5.6 6.1.5-4.7 3.9 1.5 5.9-5.2-3.2-5.2 3.2 1.5-5.9-4.7-3.9 6.1-.5z" />,
  limited: <path d="M7 3.5h10M7 20.5h10M8 3.5c0 4.2 4 5.6 4 8.5s-4 4.3-4 8.5M16 3.5c0 4.2-4 5.6-4 8.5s4 4.3 4 8.5M9.5 18h5" />,
  exclusive: <path d="M7.5 4h9l3.5 5-8 11L4 9zM4 9h16M10 4l-1.6 5L12 20l3.6-11L14 4" />,
  sale: <><path d="M3.8 12.6v-8a.8.8 0 0 1 .8-.8h8l7.6 7.6a1.2 1.2 0 0 1 0 1.7l-6.7 6.7a1.2 1.2 0 0 1-1.7 0z" /><circle cx="8.3" cy="8.3" r="1.4" /></>,
  preview: <><path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  preorder: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M9 14.8l2 2 4-4" /></>,
  arrow: <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />,
} satisfies Record<string, ReactNode>;
export type SpmIcon = keyof typeof P;

export function SpmIc({ name, size = 14, flip }: { name: SpmIcon; size?: number; flip?: boolean }) {
  return (
    <svg className={`st-ic${flip ? " st-ic-flip" : ""}`} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{P[name]}</svg>
  );
}

/** A product's mark as a chip: its kind's colour (store.css .st-mark.is-<kind>), its drawn sign and its words. Staff's
 *  own words may be Arabic: their direction is their own. */
export function BadgeChip({ b, locale, x }: { b: ProductBadge; locale: string; x: SpmText }) {
  const words = { new: x.badgeNew, best: x.badgeBest, limited: x.badgeLimited, exclusive: x.badgeExclusive, sale: x.badgeSale };
  const text = badgeText(b, locale, words);
  if (!text) return null;
  return (
    <span className={`st-mark is-${b.kind}`}>
      {b.kind !== "custom" && <SpmIc name={b.kind} />}
      {b.kind === "custom" ? <bdi dir="auto">{text}</bdi> : text}
    </span>
  );
}

/** The marks over a card's photo or beside a product's name: staff's badge, then Preview (staging only). */
export function ProductMarks({ p, locale, x }: { p: Pick<StoreProduct, "badge" | "preview">; locale: string; x: SpmText }) {
  if (!p.badge && !p.preview) return null;
  return (
    <>
      {p.badge && <BadgeChip b={p.badge} locale={locale} x={x} />}
      {p.preview && <span className="st-mark is-preview"><SpmIc name="preview" />{x.preview}</span>}
    </>
  );
}

/** The pre-order line: "Pre-order", and the day it ships by when staff gave one (written by the server). */
export function PreorderLine({ ships, x, className = "st-pre" }: { ships: string | null; x: SpmText; className?: string }) {
  return (
    <span className={className}>
      <SpmIc name="preorder" size={16} />
      <span>{ships ? `${x.preorder} · ${x.shipsBy(ships)}` : x.preorder}</span>
    </span>
  );
}

/** The store's banner (store.banner): one line across the top of the store's pages in staff's tone, the whole line a
 *  link when staff gave one (a page of the site, or another site in a new tab). Never fixed to the screen. */
export function StoreBannerLine({ banner, locale }: { banner: StoreBanner | null; locale: string }) {
  if (!banner) return null;
  const text = pick(locale, banner.en, banner.ar);
  const inner = <><bdi dir="auto" className="st-banner-text">{text}</bdi>{banner.link && <SpmIc name="arrow" size={16} flip />}</>;
  const cls = `st-banner is-${banner.tone}`;
  if (!banner.link) return <p className={cls}>{inner}</p>;
  return /^https:\/\//i.test(banner.link)
    ? <p className={cls}><a href={banner.link} target="_blank" rel="noopener noreferrer">{inner}</a></p>
    : <p className={cls}><Link href={banner.link}>{inner}</Link></p>;
}
