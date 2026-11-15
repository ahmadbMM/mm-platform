// The two policy pages' own drawn marks (store build, 2026-11-15, chain w1): a phone and a parcel coming back, in the
// store's monoline set (one 1.75 stroke on a 24 grid, round ends, currentColor), never a glyph or an emoji. The rest
// (WhatsApp, the map pin, the clock) are the store's own (bits.tsx, icons.tsx).
const P = {
  phone: <path d="M6.6 3.8h2.6l1.4 4.1-1.9 1.4a11.5 11.5 0 0 0 6 6l1.4-1.9 4.1 1.4v2.6a1.8 1.8 0 0 1-2 1.8C10.6 18.6 5.4 13.4 4.8 5.8a1.8 1.8 0 0 1 1.8-2z" />,
  returnBox: <><path d="M4 8.2L12 4l8 4.2v7.6L12 20l-8-4.2z" /><path d="M4 8.2l8 4.2 8-4.2M12 12.4V20" /><path d="M14.6 6.6L7.2 10.5" /></>,
};
export type PolicyIconName = keyof typeof P;

export function PolicyIcon({ name, size = 20 }: { name: PolicyIconName; size?: number }) {
  return (
    <svg className="st-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{P[name]}</svg>
  );
}
