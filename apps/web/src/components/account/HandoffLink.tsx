"use client";

import type { ReactNode } from "react";
import { HANDOFF_START_COOKIE, HANDOFF_START_MAX_AGE, HANDOFF_START_PATH } from "@/lib/account-core";

// Create account and Forgot password under the site's sign-in (My Account, the live map): the booking app hands the
// rider back here signed in (api/account/handoff). As they leave, this browser notes that it asked (a cookie only that
// route is sent, half an hour), so the hand-back signs it in at once; a hand-back link it did not ask for is asked
// about first.
export default function HandoffLink({ href, children }: { href: string; children: ReactNode }) {
  const note = () => {
    try { document.cookie = `${HANDOFF_START_COOKIE}=1; Path=${HANDOFF_START_PATH}; Max-Age=${HANDOFF_START_MAX_AGE}; SameSite=Lax; Secure`; } catch { /* no cookies: the account page asks first */ }
  };
  return <a href={href} onClick={note}>{children}</a>;
}
