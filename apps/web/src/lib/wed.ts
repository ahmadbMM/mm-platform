// The Wednesday Community Ride (the booking app, 2026-11-25; the user: "a hybrid between Petromin Wednesday and Saturday
// Social Ride, starting point is the same as the Saturday social ride but bikes are not complimentary, it is paid the same
// way Petromin sessions are, community exclusive event, put it under MicroMobility Experiences but don't feature it, no
// specific distance or route, it starts at 7:00 PM, meeting at 6:30 PM"): ride_kind 'wed', event_kind 'community', session
// id '<date>-wc', every Wednesday from 25 November 2026. A date inside MicroMobility Experiences (the community card),
// never a card of its own and never featured as made (staff's switch still can); for community members alone, and shown
// to them alone (lib/farm.ts farmForMembers, as the Farm House Night and the Tee Painting Workshop: no date, Details or
// Events entry for anyone else). A bike ride: each rider picks a bike type and pays its standard ride fare at the desk
// (ride_prices: 57.5 SAR Hybrid, Mountain and Kids, 75 SAR Road; never the Petromin employees' fare), their own bike free,
// a helmet with every bike; first come first served with no approval, one place per member, no place limit said (no
// places-left count) and no ride groups, distance or route. It gathers, as the Saturday ride does: its "18:30 - 19:00" is
// the meeting, then the start ("Gathering 6:30 PM · Start 7 PM"). It meets at the Saturday ride's start point
// (sessions.meet_url, WED_MEET_URL when a row has none), said "Meeting point" with that map, never the circuit. It wears
// the community rides' green (the Saturday ride's colours), with no drawing of its own. Plain logic, so it can be tested.

/** The Saturday Social Ride's start point, where the Wednesday ride meets too (its map when a row has no meet_url). */
export const WED_MEET_URL = "https://maps.app.goo.gl/pdcMn1mGcCdabia7A?g_st=ic";

/** A Wednesday Community Ride date, by the session's kind. */
export const isWed = (s: { kind?: string | null } | null | undefined): boolean => s?.kind === "wed";

/** A session's meeting point's map: its own, else the Saturday start point on a Wednesday ride. */
export const wedMeetUrl = (kind: string | null | undefined, meetUrl: string | null | undefined): string | null =>
  meetUrl || (kind === "wed" ? WED_MEET_URL : null);
