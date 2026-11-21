"use client";

import SignIn from "@/components/account/SignIn";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./Testimonials.text";

// Signing in on /testimonials/write: the site's own sign-in form (the page draws again signed in). Since 2026-11-19 the
// form itself carries the way to an account for a visitor who has none ("New to MicroMobility? Create account"): the
// site's own sign-up (/signup), which comes back to this page signed in. `create` (the booking app's hand-over) is no
// longer used.
export default function TmSignIn({ locale }: { locale: string; create?: string }) {
  const t = useLocalize(T);
  return (
    <section className="tm-box tm-signin" aria-labelledby="tm-signin-h">
      <h2 id="tm-signin-h">{t.signinTitle}</h2>
      <SignIn locale={locale} />
    </section>
  );
}
