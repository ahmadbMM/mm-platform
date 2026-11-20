// The selling screens' own drawn marks, beside the Marketplace's shared set (components/market/MkIcon.tsx): the six
// shot outlines of a bike's photo slots and the grip a photo is dragged by. One monoline family on a 24 grid (stroke
// 1.75, round caps and joins, the text's own colour), for the eye alone: the control each sits in names it.
const BIKE = "M5.9 11.7a3.9 3.9 0 1 1 0 7.8 3.9 3.9 0 0 1 0-7.8zM18.1 11.7a3.9 3.9 0 1 1 0 7.8 3.9 3.9 0 0 1 0-7.8zM5.9 15.6L9.4 8.7l2.3 6.9zM9.4 8.7h6.4l-4.1 6.9M15.8 8.7l2.3 6.9M9.4 8.7L8.9 6.6M7.5 6.6h3M15.8 8.7l-.7-2.5h2.7";
const P = {
  // the bike seen from its chain side: the chainring drawn at the cranks
  drive: `${BIKE}M11.7 13.9a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z`,
  // the same bike from its other side (drawn mirrored below)
  other: BIKE,
  drivetrain: "M8.2 8.6a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8zM8.2 12.2a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6zM17.6 10.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM8.6 8.6l9.2 2.2M8.6 17.4l9.2-2.2",
  cockpit: "M5.2 8.4h13.6M5.2 8.4c-2.2 0-2.4 6-.2 6.4M18.8 8.4c2.2 0 2.4 6 .2 6.4M12 8.4v6.2M9.8 16.8a2.2 2.2 0 0 1 4.4 0v2.6H9.8z",
  frame: "M9.6 5.4L8 18.6M16 5.4l-1.6 13.2M5.6 9.6h13.6M4.8 14.4h13.6",
  damage: "M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2zM13.4 6.6l-3.2 4.2 3.4 2.2-2.4 4.6",
  plain: "M12 6v12M6 12h12",
} as const;
export type W2IconName = keyof typeof P;

export default function W2Icon({ name, size = 28 }: { name: W2IconName; size?: number }) {
  return (
    <svg className="mk-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      <path d={P[name]} transform={name === "other" ? "matrix(-1 0 0 1 24 0)" : undefined} />
    </svg>
  );
}

/** The grip a photo is dragged by: six dots. */
export function W2Grip({ size = 20 }: { size?: number }) {
  return (
    <svg className="mk-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
    </svg>
  );
}
