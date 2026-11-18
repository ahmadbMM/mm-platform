// A session's venue on Instagram (the user, 2026-11-13: "add the insta account to the session of the farmhouse"; the
// booking app's 46689058): staff set a handle on the session (bike_slots._ig, beside _time: no column, no migration), and
// riders see it as a row on the date's Details and a link on its ticket. Read as the booking app reads it (_igClean,
// IG_HANDLE, _sessIg): a leading @ or an instagram.com address is taken off, anything after a slash, ? or # goes, and
// what is left must be a handle Instagram allows, else there is none. The first is the Farm House Night's,
// @thefarmhouse.jed, which only a community member sees with the rest of the night (lib/farm.ts farmForMembers).
// Plain logic, so it can be tested.

/** A handle Instagram allows: letters, digits, dots and underscores, 30 at most (the booking app's IG_HANDLE). */
export const IG_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/** What was typed, as a bare handle (the booking app's _igClean): "@thefarmhouse.jed",
 *  "https://www.instagram.com/thefarmhouse.jed/?hl=en" and "thefarmhouse.jed" are all "thefarmhouse.jed". */
export const igClean = (v: unknown): string =>
  String(v ?? "").trim().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "");

/** The handle a session's settings carry (bike_slots._ig, stored as JSON text or an object), or null for none or one
 *  Instagram would not allow (the booking app's _sessIg). */
export function igOf(slots: unknown): string | null {
  let o: unknown = slots;
  if (typeof o === "string") {
    try { o = JSON.parse(o); } catch { o = null; }
  }
  const h = igClean(o && typeof o === "object" ? (o as Record<string, unknown>)._ig : "");
  return IG_HANDLE.test(h) ? h : null;
}

/** The profile's address (the booking app's _socUrl('instagram', handle)). */
export const igUrl = (handle: string): string => `https://www.instagram.com/${encodeURIComponent(handle)}`;
