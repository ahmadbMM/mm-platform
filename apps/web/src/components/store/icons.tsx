import type { ReactNode } from "react";
import type { BoxIcon, KeySpecIcon } from "@/lib/store-core";

// The store build's drawn marks (2026-11-15): one monoline stroke on a 24 grid, round ends, the weight of bits.tsx's
// set (1.75), never a text glyph or an emoji. bits.tsx keeps the store's first set (Ic); these are the ones the build's
// chains share, so no two chains draw the same mark: the key-spec chips (F24) and the box rows (F37) by the names staff
// pick (KEY_SPEC_ICONS, BOX_ICONS), saved (F07), stars (F42, F94), the gallery's and carousels' arrows (D06-C, D12-C,
// F13), the size guide (F21), filters (O05-C), the showroom (F101), the warranty shield (L09), the certified badge (F53),
// "fully built" (F27), gift (F57, F58), a code (F67), the delivery day (F78), the brand band (F03).
// Arrows that point along the reading direction take `flip`: they mirror on right-to-left pages (A06-A; store.css
// .st-ic-flip). A bike photo is never flipped.

const P = {
  // ── the page's marks ──
  heart: <path d="M12 19.6C7.4 16.4 4 13.2 4 9.4 4 7 5.9 5 8.2 5c1.6 0 3 .9 3.8 2.2C12.8 5.9 14.2 5 15.8 5 18.1 5 20 7 20 9.4c0 3.8-3.4 7-8 10.2z" />,
  star: <path d="M12 3.6l2.3 5.6 6.1.5-4.7 3.9 1.5 5.9-5.2-3.2-5.2 3.2 1.5-5.9-4.7-3.9 6.1-.5z" />,
  chevronDown: <path d="M6.5 9.5L12 15l5.5-5.5" />,
  next: <path d="M9.5 6L15.5 12l-6 6" />,
  prev: <path d="M14.5 6L8.5 12l6 6" />,
  zoom: <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5M10.5 8v5M8 10.5h5" /></>,
  mapPin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  filter: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  gift: <><rect x="4" y="9" width="16" height="4" rx="1" /><path d="M5.5 13v7h13v-7M12 9v11M12 9C10.6 5.6 6.4 5.4 6.4 7.8c0 1.4 2.4 1.2 5.6 1.2zM12 9c1.4-3.4 5.6-3.6 5.6-1.2 0 1.4-2.4 1.2-5.6 1.2z" /></>,
  tag: <><path d="M3.8 12.6v-8a.8.8 0 0 1 .8-.8h8l7.6 7.6a1.2 1.2 0 0 1 0 1.7l-6.7 6.7a1.2 1.2 0 0 1-1.7 0z" /><circle cx="8.3" cy="8.3" r="1.4" /></>,
  ruler: <path d="M3.5 15.5L15.5 3.5l5 5-12 12zM7 12l1.6 1.6M9.8 9.2l1.6 1.6M12.6 6.4l1.6 1.6" />,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.2" /><path d="M15.4 15.4l4.6 4.6" /></>,
  shield: <path d="M12 3.5l7 2.6v5.6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6.1zM8.8 12.2l2.3 2.3 4.2-4.4" />,
  badge: <path d="M12 3l2.2 1.6 2.7-.2.9 2.6 2.3 1.4-.8 2.6.8 2.6-2.3 1.4-.9 2.6-2.7-.2L12 19.6l-2.2-1.6-2.7.2-.9-2.6-2.3-1.4.8-2.6-.8-2.6 2.3-1.4.9-2.6 2.7.2zM8.8 11.4l2.2 2.2 4.2-4.2" />,
  spanner: <path d="M15.6 3.8a4.6 4.6 0 0 0-4.4 6l-6.6 6.6a1.9 1.9 0 0 0 2.7 2.7l6.6-6.6a4.6 4.6 0 0 0 6-4.4l-2.8 2.8-2.6-.7-.7-2.6z" />,
  box: <path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8" />,
  award: <><circle cx="12" cy="9" r="5" /><path d="M9 13.4L7.6 20l4.4-2.4 4.4 2.4-1.4-6.6" /></>,
  // ── key specifications (F24) ──
  weight: <path d="M8.5 9.5a3.5 3.5 0 1 1 7 0M6.8 11h10.4l1.3 7.2a1.4 1.4 0 0 1-1.4 1.6H6.9a1.4 1.4 0 0 1-1.4-1.6z" />,
  gears: <><circle cx="12" cy="12" r="5.5" /><circle cx="12" cy="12" r="2.2" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
  brakes: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.2" /><path d="M15.6 3.6h3.6a1 1 0 0 1 1 1v4.6M12 5v2M12 17v2M5 12h2M17 12h2" /></>,
  wheel: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="1.5" /><path d="M12 3.5v7M12 13.5v7M3.5 12h7M13.5 12h7" /></>,
  frame: <path d="M4 17h6.5L17 7H8l-4 10M8 7l2.5 10M17 7l3 10M7 5h3M16 5.5l1 1.5" />,
  fork: <path d="M8 21V10a4 4 0 0 1 8 0v11M12 6V3" />,
  tyre: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5.5" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6" /></>,
  battery: <><rect x="3.5" y="7.5" width="15" height="9" rx="1.8" /><path d="M20.5 10.5v3M11.5 9.5l-2 3h3l-2 3" /></>,
  motor: <path d="M13 3.5L6 13.5h5l-1 7 7-10h-5z" />,
  range: <><circle cx="6.5" cy="17.5" r="2" /><circle cx="17.5" cy="6.5" r="2" /><path d="M8.5 17.5h6a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6h6" /></>,
  material: <path d="M12 4l8.5 4.5L12 13 3.5 8.5zM3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5" />,
  other: <><circle cx="12" cy="12" r="8.5" /><path d="M8.3 12h.2M11.9 12h.2M15.5 12h.2" /></>,
  // ── what's in the box (F37) ──
  bike: <><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l3.5-7h6L18 16M9.5 9L12 16H6M12 16l3.5-7M15.5 9l-1.2-3h-2.2" /></>,
  pedals: <><rect x="13.5" y="8" width="6" height="8" rx="1.2" /><path d="M13.5 12H7.8" /><circle cx="6" cy="12" r="1.8" /></>,
  tools: <path d="M8 3.5v12a2.5 2.5 0 0 0 2.5 2.5H20M5.5 3.5h5" />,
  manual: <path d="M4.5 5.5c2.5-1 5-1 7.5.5v13c-2.5-1.5-5-1.5-7.5-.5zM19.5 5.5c-2.5-1-5-1-7.5.5v13c2.5-1.5 5-1.5 7.5-.5z" />,
  charger: <path d="M9 3.5v4M15 3.5v4M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0zM12 16v4.5" />,
  lights: <path d="M9.5 18.5h5M10.3 21h3.4M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.6.5 1 1.2 1 2v.6h4.6v-.6c0-.8.4-1.5 1-2A5.5 5.5 0 0 0 12 3.5z" />,
  bell: <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5zM10.3 20.5a2 2 0 0 0 3.4 0" />,
  reflectors: <path d="M12 3.5l7.5 8.5-7.5 8.5L4.5 12zM12 8l4 4-4 4-4-4z" />,
  bag: <path d="M5.5 8.5h13L17.4 20a1.5 1.5 0 0 1-1.5 1.3H8.1A1.5 1.5 0 0 1 6.6 20L5.5 8.5zM9 8V6.5a3 3 0 0 1 6 0V8" />,
  bottle: <path d="M10 3.5h4v2.5l1.5 2.5V20a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V8.5L10 6zM8.5 12h7" />,
} satisfies Record<string, ReactNode>;

export type StIconName = keyof typeof P;
/** Every name the chips and rows staff fill can carry is drawn here (a test holds it). */
export const ICON_NAMES = Object.keys(P) as StIconName[];
const FILLABLE = new Set<StIconName>(["heart", "star"]);

/** A drawn mark. `filled`: a heart saved or a star given (heart and star only). `flip`: mirrors on right-to-left pages.
 *  `label`: a mark that says something alone (a star rating, a heart button's state is said by the button). */
export function StIcon({ name, size = 18, className = "", filled = false, flip = false, label }: {
  name: StIconName; size?: number; className?: string; filled?: boolean; flip?: boolean; label?: string;
}) {
  const fill = filled && FILLABLE.has(name) ? "currentColor" : "none";
  const cls = ["st-ic", flip ? "st-ic-flip" : "", className].filter(Boolean).join(" ");
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const, focusable: "false" as const };
  return (
    <svg className={cls} viewBox="0 0 24 24" width={size} height={size} fill={fill} stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...a11y}>{P[name]}</svg>
  );
}

/** The mark of a key-spec chip (F24) or a box row (F37), by the name staff picked. */
export const specIcon = (n: KeySpecIcon | BoxIcon): StIconName => n;
