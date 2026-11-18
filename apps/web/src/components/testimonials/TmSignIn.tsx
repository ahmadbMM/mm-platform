"use client";

import SignIn from "@/components/account/SignIn";
import { useLocalize } from "@/i18n/TxProvider";
import { ASK_BACK_COOKIE, ASK_BACK_MAX_AGE, ASK_BACK_PATH } from "@/lib/ask";
import { T } from "./Testimonials.text";

// Signing in on /testimonials/write: the site's own sign-in form (the page draws again signed in), and under it the way
// to an account for a visitor who has none. An account is created in the booking app, which hands the rider back signed
// in (api/account/handoff); as they leave, this page's address is noted in the cookie only that route is sent (the Ask
// pages' own, lib/ask.ts askBack), so they land back here and not on My Account.
export default function TmSignIn({ locale, create }: { locale: string; create: string }) {
  const t = useLocalize(T);
  const note = () => {
    try { document.cookie = `${ASK_BACK_COOKIE}=${encodeURIComponent("/testimonials/write")}; Path=${ASK_BACK_PATH}; Max-Age=${ASK_BACK_MAX_AGE}; SameSite=Lax; Secure`; } catch { /* no cookies: they land on My Account */ }
  };
  return (
    <section className="tm-box tm-signin" aria-labelledby="tm-signin-h">
      <h2 id="tm-signin-h">{t.signinTitle}</h2>
      <SignIn locale={locale} />
      <a className="tm-create" href={create} onClick={note}>{t.create}</a>
    </section>
  );
}
