// The marks only these sections draw (store build w3b), in the store's monoline style (24 grid, 1.75 stroke, round
// ends, currentColor): two arrows passing each other, for the trade-in row (F52).
export function SwapMark({ size = 22 }: { size?: number }) {
  return (
    <svg className="st-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 8.5h14.5M15 5l3.5 3.5L15 12M20 15.5H5.5M9 12l-3.5 3.5L9 19" />
    </svg>
  );
}
