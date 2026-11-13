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
/** The five reactions (contract H3: drawn marks of our own, each with a name a screen reader says - never an emoji):
 *  a raised thumb, a heart, two hands meeting, a burst, a thought bubble. */
export const IconLike = ({ size = 20 }: P) => svg(size, <path d="M7 10.5v9.5H4.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1H7zm0 0 3.6-7.2A2.4 2.4 0 0 1 13 5.7v3.3h5.4a2 2 0 0 1 2 2.4l-1.2 6.9a2 2 0 0 1-2 1.7H7" />, 1.9);
export const IconLove = ({ size = 20 }: P) => svg(size, <path d="M12 20.2S4.4 15.6 4.4 10.3A4.2 4.2 0 0 1 12 7.8a4.2 4.2 0 0 1 7.6 2.5c0 5.3-7.6 9.9-7.6 9.9z" />, 1.9);
export const IconClap = ({ size = 20 }: P) => svg(size, <><path d="M9.6 12.6 6.9 9.9a1.4 1.4 0 0 0-2 2l4.3 4.6a5.2 5.2 0 0 0 7.5.1l2.5-2.6a2.4 2.4 0 0 0 .5-2.6l-1.9-4.6a1.3 1.3 0 0 0-2.5.8l.7 2.2-4.9-5a1.4 1.4 0 0 0-2 2l3.3 3.4" /><path d="M9.6 12.6 7.9 10.8M4.4 4.8l1.2 1.4M7.6 3.2l.5 1.8M2.9 8l1.8.5" /></>, 1.9);
export const IconWow = ({ size = 20 }: P) => svg(size, <path d="m12 2.8 2 5.3 5.6-.9-3.2 4.6 3.9 4.1-5.6.4-.6 5.5L12 17.4l-4.1 4.4-.6-5.5-5.6-.4 3.9-4.1-3.2-4.6 5.6.9z" />, 1.9);
export const IconThink = ({ size = 20 }: P) => svg(size, <><path d="M7.4 14.4a3.9 3.9 0 0 1-.5-7.7 5 5 0 0 1 9.4-.8 4.1 4.1 0 0 1 .5 8.2z" /><circle cx="7.6" cy="17.9" r="1.2" /><circle cx="4.9" cy="20.5" r=".7" /></>, 1.9);
