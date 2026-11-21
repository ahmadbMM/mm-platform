// The Marketplace's drawn marks: one monoline set on a 24 grid (stroke 1.75, round caps and joins, the text's own
// colour), never an emoji or a picture font. A mark is for the eye alone (aria-hidden): the control it sits in says
// what it does. `flip`: an arrow along the reading direction, which turns round on right-to-left pages (market.css).
// A builder who needs a mark that is not here adds it to its own file, not to this one.
const P = {
  close: "M6 6l12 12M18 6L6 18",
  back: "M14.6 5.4L8 12l6.6 6.6",
  next: "M9.4 5.4L16 12l-6.4 6.6",
  down: "M5.4 9.4L12 16l6.6-6.6",
  tick: "M5 12.5l4.5 4.5L19 7.5",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-3.8-3.8",
  filter: "M4 6.5h16M7 12h10M10 17.5h4",
  pin: "M12 21.2s-6.6-5.7-6.6-11.1a6.6 6.6 0 0 1 13.2 0c0 5.4-6.6 11.1-6.6 11.1zM12 7.8a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6z",
  tag: "M3.6 12.4V5.2a1.6 1.6 0 0 1 1.6-1.6h7.2l8 8a1.6 1.6 0 0 1 0 2.3l-6.5 6.5a1.6 1.6 0 0 1-2.3 0zM8 7.2a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8z",
  shop: "M4.2 9.6l1.3-5h13l1.3 5M4.2 9.6h15.6M4.2 9.6a2.6 2.6 0 0 0 5.2 0 2.6 2.6 0 0 0 5.2 0 2.6 2.6 0 0 0 5.2 0M5.4 12.2v7.2h13.2v-7.2M10 19.4v-4h4v4",
  user: "M12 4.5a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4zM4.9 20.2c.8-3.8 3.6-5.9 7.1-5.9s6.3 2.1 7.1 5.9",
  shield: "M12 21.6s7.4-3.6 7.4-9.4V5.4L12 2.6 4.6 5.4v6.8c0 5.8 7.4 9.4 7.4 9.4zM8.8 12l2.2 2.2 4.2-4.4",
  flag: "M5.4 21V3.8M5.4 4.4h11.8l-2.4 4 2.4 4H5.4",
  chat: "M20.4 11.6a8.2 8.2 0 0 1-12.1 7.2L3.6 20.4l1.6-4.5a8.2 8.2 0 1 1 15.2-4.3z",
  send: "M20.4 3.6L3.6 10.4l6.6 3.4 3.4 6.6zM10.2 13.8l4.6-4.6",
  phone: "M5.2 3.6h3.1l1.6 4.2-2.1 1.4a10.6 10.6 0 0 0 5 5l1.4-2.1 4.2 1.6v3.1a2 2 0 0 1-2.2 2A16.2 16.2 0 0 1 3.2 5.8a2 2 0 0 1 2-2.2z",
  whatsapp: "M20.4 11.6a8.2 8.2 0 0 1-12.1 7.2L3.6 20.4l1.6-4.5a8.2 8.2 0 1 1 15.2-4.3zM9.2 8.2c-.6 1 .1 2.9 1.6 4.4s3.4 2.2 4.4 1.6l.4-1.2-1.8-.9-.7.7c-.8-.3-1.8-1.3-2.1-2.1l.7-.7-.9-1.8z",
  map: "M9 4.2L3.6 6.4v13.4L9 17.6l6 2.2 5.4-2.2V4.2L15 6.4zM9 4.2v13.4M15 6.4v13.4",
  camera: "M4.6 7.8h3l1.4-2.2h6l1.4 2.2h3a1.4 1.4 0 0 1 1.4 1.4v8.6a1.4 1.4 0 0 1-1.4 1.4H4.6a1.4 1.4 0 0 1-1.4-1.4V9.2a1.4 1.4 0 0 1 1.4-1.4zM12 10.2a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4z",
  photo: "M5.2 4.6h13.6a1.6 1.6 0 0 1 1.6 1.6v11.6a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V6.2a1.6 1.6 0 0 1 1.6-1.6zM3.6 15.6l4.6-4.4 4.2 4 2.6-2.4 5.4 5M15.4 8.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z",
  edit: "M4.4 19.6l.8-3.8L15.8 5.2a1.7 1.7 0 0 1 2.4 0l.6.6a1.7 1.7 0 0 1 0 2.4L8.2 18.8zM14.2 6.8l3 3",
  trash: "M4 6.6h16M9.6 6.6V4.4h4.8v2.2M6.2 6.6l.9 12.6a1.6 1.6 0 0 0 1.6 1.5h6.6a1.6 1.6 0 0 0 1.6-1.5l.9-12.6",
  clock: "M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2zM12 7.4V12l3.2 2",
  again: "M19.6 12a7.6 7.6 0 1 1-2.3-5.4M19.6 4.4v4.2h-4.2",
  alert: "M12 3.6l9 15.6H3zM12 9.6v4.4M12 16.8v.1",
  block: "M12 3.4a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 0 1 0-17.2zM6 6l12 12",
  share: "M12 15V3.6M8 7.2l4-3.6 4 3.6M5.6 11.6v7.2a1.6 1.6 0 0 0 1.6 1.6h9.6a1.6 1.6 0 0 0 1.6-1.6v-7.2",
  copy: "M9 8.4h9a1.6 1.6 0 0 1 1.6 1.6v9a1.6 1.6 0 0 1-1.6 1.6H9A1.6 1.6 0 0 1 7.4 19v-9A1.6 1.6 0 0 1 9 8.4zM4.4 15.2V5a1.6 1.6 0 0 1 1.6-1.6h9.2",
  lock: "M7 10.6h10a2.4 2.4 0 0 1 2.4 2.4v5.2a2.4 2.4 0 0 1-2.4 2.4H7a2.4 2.4 0 0 1-2.4-2.4V13A2.4 2.4 0 0 1 7 10.6zM8 10.6V7.6a4 4 0 0 1 8 0v3",
  bike: "M5.9 11.7a3.9 3.9 0 1 1 0 7.8 3.9 3.9 0 0 1 0-7.8zM18.1 11.7a3.9 3.9 0 1 1 0 7.8 3.9 3.9 0 0 1 0-7.8zM5.9 15.6L9.4 8.7l2.3 6.9zM9.4 8.7h6.4l-4.1 6.9M15.8 8.7l2.3 6.9M9.4 8.7L8.9 6.6M7.5 6.6h3M15.8 8.7l-.7-2.5h2.7",
  doc: "M14 3.4H7.2a1.8 1.8 0 0 0-1.8 1.8v13.6a1.8 1.8 0 0 0 1.8 1.8h9.6a1.8 1.8 0 0 0 1.8-1.8V8zM14 3.4V8h4.6M8.8 12.6h6.4M8.8 16h4.2",
} as const;
export type MkIconName = keyof typeof P;
export const MK_ICONS = Object.keys(P) as MkIconName[];

export default function MkIcon({ name, size = 20, flip = false, className = "" }: { name: MkIconName; size?: number; flip?: boolean; className?: string }) {
  return (
    <svg className={`mk-ic${flip ? " mk-ic-flip" : ""}${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={P[name]} />
    </svg>
  );
}

/** The mark shown where a listing has no photo. */
export function MkNoPhoto({ label }: { label: string }) {
  return (
    <span className="mk-nophoto" role="img" aria-label={label}>
      <MkIcon name="photo" size={28} />
    </span>
  );
}
