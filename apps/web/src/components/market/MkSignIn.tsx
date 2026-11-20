"use client";

import SignIn from "@/components/account/SignIn";
import { useLocalize } from "@/i18n/TxProvider";
import { T } from "./Market.text";

// Signing in on a Marketplace page that needs an account (selling, My listings, the inbox, a shop's application): the
// site's own sign-in form, which carries the way to a new account and draws the page again signed in. `title`: the
// box's heading when "Sign in to use the Marketplace" is not the one wanted.
export default function MkSignIn({ locale, title }: { locale: string; title?: string }) {
  const t = useLocalize(T);
  return (
    <section className="mk-box mk-signin" aria-labelledby="mk-signin-h">
      <h2 id="mk-signin-h">{title || t.signinTitle}</h2>
      <SignIn locale={locale} />
    </section>
  );
}
