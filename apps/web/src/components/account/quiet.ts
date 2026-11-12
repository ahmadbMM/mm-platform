// The pop-ups' quiet windows (EmergencyGateLoader, SportGateLoader, WaiverGateLoader, ShareGateLoader, RaceGateLoader, RatingGateLoader): a signed-in
// "nothing to agree" or "nothing to rate" is kept a few minutes in this tab, so every page does not
// ask again. It is the signed-in account's answer, and the cookie that says which account that is
// cannot be read here (HttpOnly) - so a sign-in or a sign-out forgets them all, and so do the
// sign-in form (it is shown only to a visitor who is signed out) and the booking app's hand-over (isQuiet). Kept, the next rider on a shared
// tablet would have their waiting waiver, run agreement or rating hidden for up to ten minutes.
// Nothing else changes when the gates ask.
export const EM_QUIET = "mm_em_none";
export const SPORT_QUIET = "mm_sport_none";
export const WAIVER_QUIET = "mm_waiver_none";
export const SHARE_QUIET = "mm_share_none";
export const CLUB_QUIET = "mm_club_none";
export const RACE_QUIET = "mm_race_none";
export const RATE_QUIET = "mm_rate_none";

// A sign-in through the booking app's hand-over (api/account/handoff) lands on /account?handoff=done with no sign-in
// form on the way, so the first look at a window on that page load forgets them all, as a sign-in does.
let handedOver = false;

/** Whether `key`'s quiet window is still open in this tab: if so, the pop-up does not ask. */
export function isQuiet(key: string): boolean {
  try {
    if (!handedOver && new URLSearchParams(window.location.search).get("handoff") === "done") {
      handedOver = true;
      forgetQuiet();
      return false;
    }
    return Number(sessionStorage.getItem(key) || 0) > Date.now();
  } catch { return false; } // storage off: just ask
}

export function forgetQuiet(): void {
  try {
    sessionStorage.removeItem(EM_QUIET);
    sessionStorage.removeItem(SPORT_QUIET);
    sessionStorage.removeItem(WAIVER_QUIET);
    sessionStorage.removeItem(SHARE_QUIET);
    sessionStorage.removeItem(CLUB_QUIET);
    sessionStorage.removeItem(RACE_QUIET);
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
