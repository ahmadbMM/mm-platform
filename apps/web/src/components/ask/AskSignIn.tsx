"use client";

import SignIn from "@/components/account/SignIn";

// Signing in on an Ask page: the site's own sign-in form (the page draws again signed in, the session in a cookie
// this script never sees). Since 2026-11-19 the form itself carries the way to an account for a visitor who has none
// ("New to MicroMobility? Create account"): the site's own sign-up (/signup), which comes back to this page signed in.
// `create` (the booking app's hand-over) and `back` are no longer used.
export default function AskSignIn({ locale }: { locale: string; create?: string; back?: string }) {
  return (
    <div className="ask-signin">
      <SignIn locale={locale} />
    </div>
  );
}
