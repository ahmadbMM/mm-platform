// Farm House Night (the user, 2026-11-13: "create a seesion Nawar Farm House Night ... put it under micromobility
// experiences card not to public, every member can bring family members with them and add them to their bookings";
// rentals migration 20261114130000): ride_kind 'farm', event_kind 'community', session id '<date>-fh'. The first is Nawar
// Farm House Night on Thursday 19 November 2026 at Little Farmhouse, Dhahban: arrival from 4:30 PM, dinner at 8:30 PM.
// A date inside MicroMobility Experiences (the community card), never a card of its own: members only, free, and staff
// approve every place as on the Saturday Social Ride (needs_approval, the list hidden until published). A member books
// themselves and up to four family members on one booking in the booking app, each by name (its party step; the
// database's _group_ride_cap reads Settings event_seat_max); this site hands the booking over, as it does every date. No
// bike anywhere, so session and participant words; the activity waiver. It gathers, as the Saturday ride does: its
// "16:30 - 20:30" is the arrival, then dinner, and every page says "Arrival 4:30 PM · Dinner 8:30 PM" (the booking app's
// sessionTime, fhArrive and fhDinner; lib/rides.ts timesText with those words), never a gathering and a start.
// Its look is the booking app's "Harvest Supper", from the venue's own Instagram (@thefarmhouse.jed): the venue's rust
// tile, peach lettering in Rubik's heaviest weight, and its turkey's fanned tail drawn as rounded feathers rising from
// the far corner; the mark is those feathers fanned behind a farmhouse gable (public/site/farm-mark.svg, the booking
// app's assets/farm-mark.svg). Plain logic, so it can be tested (the booking app's _isFarm).

/** The mark: rounded feathers fanned behind a farmhouse gable (64 by 40). */
export const FARM_MARK = "/site/farm-mark.svg";
export const FARM_MARK_SIZE = { width: 64, height: 40 } as const;

/** A farm night, by the session's kind. */
export const isFarm = (s: { kind?: string | null } | null | undefined): boolean => s?.kind === "farm";

