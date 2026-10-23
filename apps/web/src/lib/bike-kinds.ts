import type { RideKind } from "./rides";

// Which sessions are ridden on a bike (the owner, 2026-10-18: "make sure all non-cycling related sessions
// dont include anything about cycling anywhere especially in surveys registration etc."). The pool, the
// workshop, an event, Run for Her, Victory Lap and the DEFE 5KM Run have no bikes: what a rider reads about
// them (the rating, the ticket, the claim card, the booking steps) never says ride, rider or bike, and their
// nights never count towards Your rides or the ride badges. Plain logic, so it can be tested.

/** The kinds ridden on a bike (the booking app's KIND_TRAITS). */
export const BIKE_KINDS: ReadonlySet<RideKind> = new Set<RideKind>(["jcc", "saturday", "petromin", "snd96"]);
/** The kinds without a bike (the same list as lib/rides.ts rideKind's, lib/event-info.ts rentsBikes). */
export const NON_BIKE_KINDS: ReadonlySet<string> = new Set<RideKind>(["swim", "workshop", "event", "runher", "vlap", "defe5k"]);
/** A session id the booking app gives a kind without a bike (its _sessIdSuffix: '-tw' the workshop, '-ev' an
 *  event, '-rh' Run for Her; '-vl' Victory Lap, '-df' the DEFE 5KM Run), which answers when the session itself
 *  did not load. The pool's sessions carry no suffix of their own: only their kind tells. */
const NON_BIKE_ID = /^\d{4}-\d\d-\d\d-(tw|ev|rh|vl|df)(-|$)/;

/** A session without a bike: by its kind, or by its id when the session did not load. */
export const isNonBike = (kind: string | null | undefined, sessionId?: string | null): boolean =>
  (!!kind && NON_BIKE_KINDS.has(kind)) || NON_BIKE_ID.test(sessionId ?? "");
