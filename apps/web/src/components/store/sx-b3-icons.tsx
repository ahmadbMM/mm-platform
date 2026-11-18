// The drawn marks the cart, checkout and quote link add (build of 2026-11-18, builder B3): one monoline stroke on a 24
// grid, round ends, 1.75 wide, currentColor, the weight of bits.tsx and icons.tsx; never a text glyph or an emoji.
const P = {
  trash: <path d="M5 7h14M10 7V5.4A1.4 1.4 0 0 1 11.4 4h1.2A1.4 1.4 0 0 1 14 5.4V7M6.6 7l.8 12a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.8-12M10.2 11v5.6M13.8 11v5.6" />,
  bookmark: <path d="M7.2 4.4h9.6a1.2 1.2 0 0 1 1.2 1.2v14.3l-6-4.1-6 4.1V5.6a1.2 1.2 0 0 1 1.2-1.2z" />,
  locate: <><circle cx="12" cy="12" r="6.4" /><circle cx="12" cy="12" r="2.1" /><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3" /></>,
  pin: <><path d="M12 21.2s-6.6-6.1-6.6-11.1a6.6 6.6 0 0 1 13.2 0c0 5-6.6 11.1-6.6 11.1z" /><circle cx="12" cy="10.1" r="2.4" /></>,
  building: <><path d="M5 20.5V5.2A1.2 1.2 0 0 1 6.2 4h8.6A1.2 1.2 0 0 1 16 5.2v15.3M16 10h2.8a1.2 1.2 0 0 1 1.2 1.2v9.3M3.5 20.5h17" /><path d="M8.5 8h1M11.5 8h1M8.5 11.5h1M11.5 11.5h1M8.5 15h1M11.5 15h1" /></>,
  clock: <><circle cx="12" cy="12" r="8.4" /><path d="M12 7.6V12l3 2" /></>,
};
export type SxIconName = keyof typeof P;

export function SxIcon({ name, size = 18, className = "" }: { name: SxIconName; size?: number; className?: string }) {
  return (
    <svg className={`st-ic ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{P[name]}</svg>
  );
}
