// The marks after the sale needs (builder B4), drawn in the site's monoline style: 24 grid, stroke 1.75, round caps,
// currentColor. Kept here, not in bits.tsx or icons.tsx, which the other builders edit.
const P = {
  share: "M12 3.5v11M8 7.2l4-3.7 4 3.7M7 10.5H5.5v9h13v-9H17",
  calendarPlus: "M4 6.5h16v13.5H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4M12 13v5M9.5 15.5h5",
  car: "M3.5 15.5v-3l2.2-5h12.6l2.2 5v3zM3.5 15.5v2.5h3v-2.5M17.5 15.5v2.5h3v-2.5M6.5 12.5h1.5M16 12.5h1.5M5.7 10.5h12.6",
  camera: "M3.5 8.5h3.5l1.8-2.5h6.4l1.8 2.5h3.5v11h-17zM12 16.6a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2z",
  image: "M4 5h16v14H4zM4 15.5l4.5-4.5 4 4 2.5-2.5 5 5M15.5 9.5h.01",
  homeAdd: "M5 4h14v16H5zM12 8.5v7M8.5 12h7",
  bell: "M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5zM10 20.5h4",
  wallet: "M3.5 7h17v12.5h-17zM3.5 7l12-3.5V7M16 13.25h1.5",
  bike: "M5.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5.5 14l3.5-6.5h6L12 14zM9 7.5l3 6.5M15 7.5l3.5 6.5M8 5.5h2.5M15 7.5l.5-2h2",
  here: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM9.5 10l1.8 1.8 3.4-3.6",
  shield: "M12 3.5l7 2.8v5.4c0 4.3-2.9 7.6-7 9.3-4.1-1.7-7-5-7-9.3V6.3zM9 12l2 2 4-4.2",
  clock: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.5V12l3 2",
  tick: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6L6 18",
} as const;

export type AfterIconName = keyof typeof P;

export function AfterIcon({ name, size = 20 }: { name: AfterIconName; size?: number }) {
  return (
    <svg className="st-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={P[name]} />
    </svg>
  );
}
