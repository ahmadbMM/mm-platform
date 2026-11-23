// The Tee Painting Workshop (the booking app, 2026-11-23): ride_kind 'paint', event_kind 'community', session id
// '<date>-tp'. The first is on Saturday 28 November 2026 from 3 to 6 PM at Red Mug Caffe: drawing and colouring on
// MicroMobility T-shirts. A date inside MicroMobility Experiences (the community card), never a card of its own, featured
// as made; for community members alone, and shown to them alone (lib/farm.ts farmForMembers, as the Farm House Night: no
// date, Featured card, Details or Events entry for anyone else, as the booking app hides it), one place per account, first come first served to its 20 places and then the waitlist, nobody
// approves it. No bike anywhere, so session and participant words; a start and an end, like yoga; the activity waiver.
// Paid: 130 SAR per person (sessions.price, paid_ride), said as the price alone. How to pay is announced later, so no
// page says how (no bank transfer, no receipt, no online payment), and nothing asks a T-shirt size.
// Its look is "Paint Splash": a white canvas with drops of the palette's colours, a T-shirt with brush strokes and
// paint drops for its mark (public/site/paint-mark.svg, drawn for the site after the booking app's assets/paint-mark.svg),
// the name in the palette's deep ink. Plain logic, so it can be tested.

/** The mark: a T-shirt with brush strokes across it and paint drops beside it (64 by 40). */
export const PAINT_MARK = "/site/paint-mark.svg";
export const PAINT_MARK_SIZE = { width: 64, height: 40 } as const;
/** Where it is when staff named no place (the booking app's _sessLoc). */
export const PAINT_VENUE = "Red Mug Caffe";

/** A Tee Painting Workshop date, by the session's kind. */
export const isPaint = (s: { kind?: string | null } | null | undefined): boolean => s?.kind === "paint";

/** What to know before arriving, as [label, value] rows (the ticket's and a date's Details): what it is. */
export type PaintWords = { whatK: string; whatV: string };
export const paintKnow = (w: PaintWords): [string, string][] => [[w.whatK, w.whatV]];
