// The store lists' own drawn marks (chain w2): the quick-add bag with its plus (F06) and the showroom's map thumbnail
// (F101). One monoline stroke on a 24 grid, as bits.tsx and icons.tsx draw; never an emoji or a text glyph.

/** The bag with a plus in it: Add to cart from a card (F06). */
export function BagPlus({ size = 20 }: { size?: number }) {
  return (
    <svg className="st-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5.5 8.5h13L17.4 20a1.5 1.5 0 0 1-1.5 1.3H8.1A1.5 1.5 0 0 1 6.6 20L5.5 8.5z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8M12 11.6v6M9 14.6h6" />
    </svg>
  );
}

/** A drawn map of the showroom's corner of Jeddah (F101): pale blocks, the roads between them, the sea's edge and a green
 *  pin in the middle. A picture of a place, so it never mirrors on right-to-left pages; it says nothing a reader needs
 *  (the address beside it does), so it is hidden from screen readers. */
export function MapThumb() {
  return (
    <svg className="st-map-svg" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="320" height="200" fill="#f4f1ea" />
      <path d="M0 0h46c-8 30 6 58-4 92-9 32 8 70-2 108H0z" fill="#dfe9ee" />
      <path d="M46 0c-8 30 6 58-4 92-9 32 8 70-2 108" fill="none" stroke="#c9d9e0" strokeWidth="2" />
      <g fill="#ebe6da">
        <rect x="64" y="14" width="62" height="44" rx="6" />
        <rect x="140" y="14" width="76" height="44" rx="6" />
        <rect x="230" y="14" width="78" height="44" rx="6" />
        <rect x="64" y="74" width="62" height="52" rx="6" />
        <rect x="230" y="74" width="78" height="52" rx="6" />
        <rect x="64" y="142" width="62" height="46" rx="6" />
        <rect x="140" y="142" width="76" height="46" rx="6" />
        <rect x="230" y="142" width="78" height="46" rx="6" />
      </g>
      <rect x="140" y="74" width="76" height="52" rx="6" fill="#dcebdc" />
      <g fill="none" stroke="#fff" strokeLinecap="round">
        <path d="M56 66h264M56 134h264M133 0v200M223 0v200" strokeWidth="9" />
        <path d="M90 0l-26 200" strokeWidth="5" />
      </g>
      <g fill="none" stroke="rgba(26,25,25,.1)" strokeWidth="1">
        <path d="M56 61.5h264M56 70.5h264M56 129.5h264M56 138.5h264" />
      </g>
      <g transform="translate(160 62)">
        <ellipse cx="18" cy="40" rx="10" ry="3.5" fill="rgba(26,25,25,.16)" />
        <path d="M18 40S4 26.5 4 15.5a14 14 0 0 1 28 0C32 26.5 18 40 18 40z" fill="#077a4b" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="18" cy="15.5" r="5" fill="#fff" />
      </g>
    </svg>
  );
}
