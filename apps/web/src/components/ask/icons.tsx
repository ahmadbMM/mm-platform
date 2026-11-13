// The Ask pages' marks: small line drawings in the text's own colour. No emoji and no symbol typed as text anywhere.
type P = { size?: number };
const svg = (size: number, children: React.ReactNode, strokeWidth = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
export const IconUp = ({ size = 20 }: P) => svg(size, <path d="M12 19V5M5 12l7-7 7 7" />);
export const IconDown = ({ size = 20 }: P) => svg(size, <path d="M12 5v14M5 12l7 7 7-7" />);
export const IconPlus = ({ size = 20 }: P) => svg(size, <path d="M12 5v14M5 12h14" />);
export const IconMinus = ({ size = 20 }: P) => svg(size, <path d="M5 12h14" />);
export const IconClose = ({ size = 18 }: P) => svg(size, <path d="M6 6l12 12M18 6L6 18" />);
export const IconCheck = ({ size = 16 }: P) => svg(size, <path d="M5 12.5l4.5 4.5L19 7.5" />, 2.4);
/** Points the way the reading goes on: right in English, left in Arabic and Urdu (ask.css turns it). */
export const IconNext = ({ size = 24 }: P) => svg(size, <path d="M9 5l7 7-7 7" />, 2.2);
/** An upvote: a solid wedge pointing up. */
export const IconVote = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 5.5c.5 0 1 .2 1.3.7l6.2 8.6c.8 1.1 0 2.7-1.3 2.7H5.8c-1.3 0-2.1-1.6-1.3-2.7l6.2-8.6c.3-.5.8-.7 1.3-.7z" /></svg>
);
/** Full screen: four corners pointing out; and back out of it: the corners pointing in. */
export const IconFull = ({ size = 22 }: P) => svg(size, <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />);
export const IconSmall = ({ size = 22 }: P) => svg(size, <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />);
