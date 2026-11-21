"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { HANDOFF_START_COOKIE, HANDOFF_START_MAX_AGE, HANDOFF_START_PATH } from "@/lib/account-core";
import { herePath, siteAuthHref } from "@/lib/signup";

// Create account and Forgot password under the site's sign-in (My Account, the live map). Since 2026-11-19 both are on
// this site (the user: "make sure all customers can do everything they want in the booking app to do it on the main
// website"): the booking app's hand-over for either (?handoff=site&auth=signup|forgot) opens the site's own page instead,
// /signup or /forgot-password, in the hand-over's language and coming back to the page the link is on.
//
// Any other hand-over still goes to the booking app, which hands the rider back here signed in (api/account/handoff). As
// they leave, this browser notes that it asked (a cookie only that route is sent, half an hour), so the hand-back signs
// it in at once; a hand-back link it did not ask for is asked about first.
const never = () => () => {};
/** The page the link is on (lib/signup.ts herePath), known once the page is up. */
const here = () => herePath(window.location.pathname, window.location.search);

export default function HandoffLink({ href, children }: { href: string; children: ReactNode }) {
  const page = useSyncExternalStore(never, here, () => "");
  const own = siteAuthHref(href, page);
  if (own) return <a href={own}>{children}</a>;
  const note = () => {
    try { document.cookie = `${HANDOFF_START_COOKIE}=1; Path=${HANDOFF_START_PATH}; Max-Age=${HANDOFF_START_MAX_AGE}; SameSite=Lax; Secure`; } catch { /* no cookies: the account page asks first */ }
  };
  return <a href={href} onClick={note}>{children}</a>;
}
