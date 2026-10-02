// The booking app's rider marks (_CU): one monoline stroke, 1.75 on a 24 grid with round ends,
// so nothing the wizard shows is a text glyph or an emoji standing in for an icon.
const CU = {
  tick: <path d="M5 12.6l4.3 4.3L19 7.4" />,
  minus: <path d="M6.5 12h11" />,
  plus: <path d="M12 6.5v11M6.5 12h11" />,
  info: <><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.4M12 7.7v.1" /></>,
  back: <path d="M14.6 5.4L8 12l6.6 6.6" />,
  go: <path d="M9.4 5.4L16 12l-6.4 6.6" />,
  bike: <><circle cx="5.9" cy="15.6" r="3.9" /><circle cx="18.1" cy="15.6" r="3.9" /><path d="M5.9 15.6L9.4 8.7l2.3 6.9zM9.4 8.7h6.4l-4.1 6.9M15.8 8.7l2.3 6.9M9.4 8.7L8.9 6.6M7.5 6.6h3M15.8 8.7l-.7-2.5h2.7" /></>,
  ticket: <><path d="M3.6 7.6A1.6 1.6 0 0 1 5.2 6h13.6a1.6 1.6 0 0 1 1.6 1.6V10a2 2 0 0 0 0 4v2.4a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V14a2 2 0 0 0 0-4z" /><path d="M14.4 6.6v1.6M14.4 11.2v1.6M14.4 15.8v1.6" /></>,
  people: <><circle cx="9" cy="8.6" r="3.1" /><path d="M3.4 19.4c.6-3.2 2.8-5 5.6-5s5 1.8 5.6 5M15.2 5.9a3 3 0 0 1 0 5.6M17.6 14.6c1.7.6 2.8 2.2 3.1 4.8" /></>,
  flag: <path d="M5.4 21V3.8M5.4 4.4h11.8l-2.4 4 2.4 4H5.4" />,
  wave: <path d="M2.8 9.2c1.5-1.3 3.1-1.3 4.6 0s3.1 1.3 4.6 0 3.1-1.3 4.6 0 3.1 1.3 4.6 0M2.8 14.8c1.5-1.3 3.1-1.3 4.6 0s3.1 1.3 4.6 0 3.1-1.3 4.6 0 3.1 1.3 4.6 0" />,
  clock: <><circle cx="12" cy="12" r="8.6" /><path d="M12 7.4V12l3.2 2" /></>,
  lock: <><rect x="4.4" y="10.6" width="15.2" height="10" rx="2.2" /><path d="M8 10.6V7.6a4 4 0 0 1 8 0v3" /></>,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
};
export type IconName = keyof typeof CU;

export function Ic({ name, size = 16, flip = false, className = "" }: { name: IconName; size?: number; flip?: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" className={`bk-ic${flip ? " bk-ic-flip" : ""}${className ? ` ${className}` : ""}`} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{CU[name]}</svg>
  );
}

/** Each ride kind wears a drawn glyph beside its name (KIND_IC). */
const KIND_IC: Record<string, IconName> = { saturday: "people", petromin: "people", event: "ticket", workshop: "clock", swim: "wave", snd96: "flag", jcc: "bike" };
export const KindIc = ({ kind }: { kind: string }) => <Ic name={KIND_IC[kind] ?? "bike"} size={14} />;
