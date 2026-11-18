// Members book first, as the booking app has it (rentals 6a6444d4, migration 20261118210800; the user, 2026-11-18:
// "Members book first: featured or limited sessions open to community members a few hours before everyone else. It isn't
// worth money, and it makes membership mean something now that sessions sell out."). Staff open a session everyone may book
// to Community members alone for 3 to 48 hours (the session forms' switch); sessions.public_at says until when, and the
// database refuses anyone else's place or waitlist row before it (_members_first_guard: MEMBERS_FIRST, P0001, detail =
// public_at). Riders read public_at with the row (anon may select it; lib/rides.ts SESSION_COLS_PUBLIC_AT).
// While it is ahead: a visitor who is not a member sees the date held, "Members book first" where its places are said and
// "Everyone from <day time>" under its time, and cannot choose it (the app's _bwOpensOn path, so a booking window not open
// yet is said first); a member sees a "Members first" mark there instead and books as usual; every visitor's Details say
// "Members book first: Everyone from <day time>". Once it passes, the date is as any other. micromobility.sa books none of
// these itself: its Book hands over to the booking app, which says the server's refusal in its own words (_mfErrOf), so the
// site draws the display alone.

/** When everyone may book (epoch ms) while that is still ahead of `now`, else 0. */
export function mfAt(s: { publicAt?: string | null }, now: number): number {
  const x = s.publicAt ? Date.parse(s.publicAt) : NaN;
  return Number.isFinite(x) && x > now ? x : 0;
}

/** The date is held from this visitor: members book first and they are not one (the app's _mfHeld). */
export const mfHeld = (s: { publicAt?: string | null }, member: boolean, now: number): boolean => !!mfAt(s, now) && !member;
