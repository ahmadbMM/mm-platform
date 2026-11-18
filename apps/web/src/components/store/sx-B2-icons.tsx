// The product page's own drawn marks from the "do all" build of 2026-11-18 (builder B2): one monoline stroke on a 24
// grid, weight 1.75, round ends, currentColor, as icons.tsx. Share (N01), a video call (N24), a bike (N16) and the
// handover clock (N13). Never an emoji.
const P = {
  share: <path d="M12 3.5v11M8 7.5l4-4 4 4M7.5 10.5H6.5a1.5 1.5 0 0 0-1.5 1.5v7a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1" />,
  tick: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  video: <><rect x="3.5" y="6.5" width="12" height="11" rx="2" /><path d="M15.5 10.5l5-3v9l-5-3z" /></>,
  bike: <><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l3.5-7h6L18 16M9.5 9L12 16h-6M15.5 9l-1-2.5h-2M8 9h3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  history: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.5H8" /><path d="M12 8v4.2l2.8 1.8" /></>,
} as const;
export type B2IconName = keyof typeof P;

export function B2Icon({ name, size = 20 }: { name: B2IconName; size?: number }) {
  return (
    <svg className="st-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{P[name]}</svg>
  );
}
