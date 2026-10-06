// The pop-ups' quiet windows (WaiverGateLoader, ShareGateLoader, RatingGateLoader): a signed-in
// "nothing to agree" or "nothing to rate" is kept a few minutes in this tab, so every page does not
// ask again. It is the signed-in account's answer, and the cookie that says which account that is
// cannot be read here (HttpOnly) - so a sign-in or a sign-out forgets all three, and so does the
// sign-in form (it is shown only to a visitor who is signed out). Kept, the next rider on a shared
// tablet would have their waiting waiver, run agreement or rating hidden for up to ten minutes.
// Nothing else changes when the gates ask.
export const WAIVER_QUIET = "mm_waiver_none";
export const SHARE_QUIET = "mm_share_none";
export const RATE_QUIET = "mm_rate_none";

export function forgetQuiet(): void {
  try {
    sessionStorage.removeItem(WAIVER_QUIET);
    sessionStorage.removeItem(SHARE_QUIET);
    sessionStorage.removeItem(RATE_QUIET);
  } catch { /* storage off: nothing kept */ }
}

/** Signs out of this site - its own cookie only; the booking app stays signed in - and draws the
 *  page again, signed out. Every sign-out button on the site goes through here. */
export function signOut(): void {
  forgetQuiet();
  fetch("/api/account", { method: "DELETE" })
    .catch(() => null)
    .finally(() => { forgetQuiet(); window.location.reload(); });
}
