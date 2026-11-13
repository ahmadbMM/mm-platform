// Farm House Night (the user, 2026-11-13: "create a seesion Nawar Farm House Night ... put it under micromobility
// experiences card not to public, every member can bring family members with them and add them to their bookings";
// rentals migration 20261114130000): ride_kind 'farm', event_kind 'community', session id '<date>-fh'. The first is Nawar
// Farm House Night on Thursday 19 November 2026 at Little Farmhouse, Dhahban: arrival from 4:30 PM, dinner at 8:30 PM.
// A date inside MicroMobility Experiences (the community card), never a card of its own, and "not to public": unlike yoga
// and the Saturday ride, which every visitor sees listed, the site shows it to a signed-in community member alone
// (farmForMembers): no date, Featured card, Details or Events entry for anyone else, and its words are the server's
// (content/farm-words.ts), never the public Website editor's schema nor the browser's dictionary. Free, and staff
// approve every place as on the Saturday Social Ride (needs_approval, the list hidden until published). A member books
// themselves and up to three more on one booking in the booking app, each by name (its party step, FARM_SEAT_MAX 4: the
// account holder and three with them, the user 2026-11-13; the database's _group_ride_cap says 4, 20261114150000); this site hands the booking over, as it does every date. No
// bike anywhere, so session and participant words; the activity waiver. It gathers, as the Saturday ride does: its
// "16:30 - 20:30" is the arrival, then dinner, and every page says "Arrival 4:30 PM · Dinner 8:30 PM" (the booking app's
// sessionTime, fhArrive and fhDinner; lib/rides.ts timesText with those words), never a gathering and a start.
// Its look is the booking app's "Harvest Supper", from the venue's own Instagram (@thefarmhouse.jed): the venue's rust
// tile, peach lettering in Rubik's heaviest weight, and its turkey's fanned tail drawn as rounded feathers rising from
// the far corner. Its logo is the venue's own Instagram picture, shown round as Instagram shows it
// (public/site/farm-logo.jpg, the booking app's assets/farm-logo.jpg, 150 px; the user, 2026-11-13: "make sure the logo
// of the session to be the same of the insta account"). Plain logic, so it can be tested (the booking app's _isFarm).

/** The logo: the venue's Instagram picture (@thefarmhouse.jed, 150 by 150), drawn round. */
export const FARM_MARK = "/site/farm-logo.jpg";
export const FARM_MARK_SIZE = { width: 150, height: 150 } as const;

/** A farm night, by the session's kind. */
export const isFarm = (s: { kind?: string | null } | null | undefined): boolean => s?.kind === "farm";


/** The sessions (or rides) a visitor may see named, from a list (the user, 2026-11-13: "put it under micromobility
 *  experiences card not to public"): a Farm House Night only to a signed-in community member (`member`, the booking app's
 *  own members' check, community_member); to anyone else, signed in or not, the list holds none, so no page, card,
 *  Featured card, Details or list of what is on offer names it. A member's own booking on one is theirs, and My Account
 *  shows it whatever. */
export const farmForMembers = <T extends { kind?: string | null }>(sessions: readonly T[], member: boolean): T[] =>
  member ? [...sessions] : sessions.filter((s) => s.kind !== "farm");
